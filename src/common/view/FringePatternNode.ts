/**
 * FringePatternNode.ts
 *
 * Renders a {@link FringeSpec} as the image on a detector screen.
 *
 * ── How it draws ──────────────────────────────────────────────────────────────
 * The intensity field is evaluated on a square sample grid, written into an
 * ImageData, and then drawn scaled up to the node's size with smoothing on. The
 * grid is coarser than the node so that the expensive part — the physics — runs
 * at a fixed cost regardless of how large the detector is drawn.
 *
 * The loops run pixel-outer, group-inner, over a plan built once per repaint.
 * Path difference depends only on position, so it is computed once per pixel and
 * shared by every colour; everything that depends only on the spectral group —
 * its display colour, its share of the power — is folded into the plan up front.
 * The per-pixel work is then just calls into the shared physics module, rather
 * than a second copy of the equations living in the renderer.
 *
 * ── Why the CPU ───────────────────────────────────────────────────────────────
 * A fragment shader is the obvious home for a per-pixel intensity formula, and
 * this pattern would suit one well. It is not used here: a monochromatic frame
 * measures ~3 ms on a 240² grid, comfortably inside the frame budget, and
 * staying on the CPU keeps the physics in one testable TypeScript module instead
 * of duplicated into GLSL, with no WebGL context to lose or fall back from.
 * See doc/implementation-notes.md for the measurements.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { Bounds2 } from "scenerystack/dot";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { CanvasNode, type CanvasNodeOptions } from "scenerystack/scenery";
import { FRINGE_SAMPLES_BROADBAND, FRINGE_SAMPLES_MONOCHROMATIC } from "../../InterferometryLabConstants.js";
import type { FringeSpec } from "../model/FringeSpec.js";
import { airyIntensity, opticalPathDifference, twoBeamIntensity } from "../model/fringeIntensity.js";
import { lineVisibility } from "../model/spectrum.js";
import { encodeSrgb, wavelengthToLinearRgb } from "./spectralColor.js";

/** Above this many spectral groups the sample grid drops to the coarse size. */
const BROADBAND_GROUP_THRESHOLD = 3;

/** Cache of wavelength (rounded to nm) to linear sRGB, shared by all detectors. */
const colorCache = new Map<number, readonly [number, number, number]>();

/** One spectral group with its per-repaint constants folded into its colour. */
type GroupPlan = {
  readonly wavelengthNm: number;
  readonly bandwidthNm: number;
  readonly opdOffsetNm: number;
  readonly red: number;
  readonly green: number;
  readonly blue: number;
};

/**
 * Linear sRGB for a wavelength, memoized to the nearest nanometre.
 */
function linearColor(wavelengthNm: number): readonly [number, number, number] {
  const key = Math.round(wavelengthNm);
  const cached = colorCache.get(key);
  if (cached) {
    return cached;
  }
  const rgb = wavelengthToLinearRgb(key);
  colorCache.set(key, rgb);
  return rgb;
}

export type FringePatternNodeOptions = CanvasNodeOptions & {
  /** Side length of the square pattern, in view pixels. */
  size: number;
};

export class FringePatternNode extends CanvasNode {
  private readonly specProperty: TReadOnlyProperty<FringeSpec>;
  private readonly size: number;
  private readonly specListener: () => void;

  /**
   * Offscreen canvas holding the sampled pattern, scaled up when drawn. It must
   * stay: putImageData ignores the canvas transform, so writing the samples
   * straight into the scenery context lands them at the top-left of the whole
   * display instead of inside the detector. drawImage respects the transform.
   */
  private sampleCanvas: HTMLCanvasElement | null = null;
  private sampleContext: CanvasRenderingContext2D | null = null;
  private imageData: ImageData | null = null;

  /** Side length of the current sample grid. */
  private sampleCount = 0;

  public constructor(specProperty: TReadOnlyProperty<FringeSpec>, providedOptions: FringePatternNodeOptions) {
    const options = optionize<FringePatternNodeOptions, EmptySelfOptions, CanvasNodeOptions>()(
      { canvasBounds: new Bounds2(0, 0, providedOptions.size, providedOptions.size) },
      providedOptions,
    );
    super(options);

    this.specProperty = specProperty;
    this.size = providedOptions.size;

    this.specListener = () => this.invalidatePaint();
    this.specProperty.link(this.specListener);
  }

  /**
   * Allocates (or reallocates) the sample grid for the current spectrum. A
   * broadband source costs one full pass per spectral group, so its grid is
   * coarsened to hold the frame time roughly constant; its fringes are washed
   * out and low-contrast anyway, so the detail is not missed.
   */
  private prepareBuffers(groupCount: number): void {
    const wanted = groupCount > BROADBAND_GROUP_THRESHOLD ? FRINGE_SAMPLES_BROADBAND : FRINGE_SAMPLES_MONOCHROMATIC;
    if (this.sampleCount === wanted && this.sampleContext && this.imageData) {
      return;
    }

    this.sampleCount = wanted;
    this.sampleCanvas = document.createElement("canvas");
    this.sampleCanvas.width = wanted;
    this.sampleCanvas.height = wanted;
    this.sampleContext = this.sampleCanvas.getContext("2d");
    this.imageData = this.sampleContext?.createImageData(wanted, wanted) ?? null;
  }

  /**
   * Scale that maps a fully illuminated, unmodulated source to white.
   *
   * Summing the groups' linear colours weighted by power gives the source's own
   * colour — saturated red for a helium-neon laser, near-neutral for a broadband
   * lamp. Dividing by that sum's largest component brightens the pattern to fill
   * the display range while leaving the hue alone, so a laser stays red and
   * white light comes out white.
   */
  private whiteBalance(spec: FringeSpec): number {
    let red = 0;
    let green = 0;
    let blue = 0;
    for (const group of spec.groups) {
      const [r, g, b] = linearColor(group.wavelengthNm);
      red += r * group.weight;
      green += g * group.weight;
      blue += b * group.weight;
    }
    const peak = Math.max(red, green, blue);
    return peak > 0 ? 1 / peak : 1;
  }

  /**
   * Precomputes, once per repaint, everything about a spectral group that does
   * not vary across the detector: its display colour already multiplied by its
   * share of the power, the exposure, and the white balance.
   */
  private planGroups(spec: FringeSpec): GroupPlan[] {
    const balance = this.whiteBalance(spec);
    return spec.groups.map((group) => {
      const [red, green, blue] = linearColor(group.wavelengthNm);
      const scale = group.weight * spec.exposure * balance;
      return {
        wavelengthNm: group.wavelengthNm,
        bandwidthNm: group.bandwidthNm,
        opdOffsetNm: group.opdOffsetNm,
        red: red * scale,
        green: green * scale,
        blue: blue * scale,
      };
    });
  }

  public override paintCanvas(context: CanvasRenderingContext2D): void {
    const spec = this.specProperty.value;
    this.prepareBuffers(spec.groups.length);

    const sampleContext = this.sampleContext;
    const imageData = this.imageData;
    const sampleCanvas = this.sampleCanvas;
    if (!(sampleContext && imageData && sampleCanvas)) {
      return;
    }

    const n = this.sampleCount;
    const geometry = spec.geometry;
    const terms = spec.terms;
    const contrast = spec.contrast;
    const plans = this.planGroups(spec);
    const pixels = imageData.data;

    let p = 0;
    for (let iy = 0; iy < n; iy++) {
      // (u, v) span −1 to +1 across the detector, sampled at pixel centres.
      const v = (2 * (iy + 0.5)) / n - 1;

      for (let ix = 0; ix < n; ix++) {
        const u = (2 * (ix + 0.5)) / n - 1;

        // Path difference depends only on position, so it is computed once and
        // reused by every colour in the spectrum.
        const opdNm = opticalPathDifference(geometry, u, v);

        let red = 0;
        let green = 0;
        let blue = 0;

        for (const plan of plans) {
          const groupOpdNm = opdNm + plan.opdOffsetNm;
          const visibility = contrast * lineVisibility(groupOpdNm, plan.wavelengthNm, plan.bandwidthNm);
          const intensity =
            terms.kind === "two-beam"
              ? twoBeamIntensity(groupOpdNm, plan.wavelengthNm, terms, visibility)
              : airyIntensity(groupOpdNm, plan.wavelengthNm, terms, visibility);

          red += intensity * plan.red;
          green += intensity * plan.green;
          blue += intensity * plan.blue;
        }

        // Everything above this point is linear light; the sRGB transfer
        // function is applied once, here, at the very end.
        pixels[p] = encodeSrgb(red);
        pixels[p + 1] = encodeSrgb(green);
        pixels[p + 2] = encodeSrgb(blue);
        pixels[p + 3] = 255;
        p += 4;
      }
    }

    sampleContext.putImageData(imageData, 0, 0);

    // Smoothing turns the sample grid back into the continuous field it stands
    // for; without it the coarse broadband grid reads as visible blocks.
    context.imageSmoothingEnabled = true;
    context.drawImage(sampleCanvas, 0, 0, this.size, this.size);
  }

  public override dispose(): void {
    this.specProperty.unlink(this.specListener);
    this.sampleCanvas = null;
    this.sampleContext = null;
    this.imageData = null;
    super.dispose();
  }
}
