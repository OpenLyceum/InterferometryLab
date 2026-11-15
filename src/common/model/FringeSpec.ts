/**
 * FringeSpec.ts
 *
 * The contract between an interferometer model and the fringe renderer.
 *
 * Each screen's model reduces its whole optical layout — arm lengths, mirror
 * tilts, inserted samples, cavity spacing — to a FringeSpec, which says how the
 * optical path difference varies across the detector and how the recombining
 * light adds up. The renderer knows nothing about mirrors or beam splitters; it
 * evaluates this description per pixel.
 *
 * That boundary is deliberate. It keeps three quite different instruments behind
 * one renderer, and it makes the physics a pure function of plain data, so the
 * whole intensity field can be unit-tested without a canvas.
 *
 * ── Detector coordinates ──────────────────────────────────────────────────────
 * Positions on the detector are given as (u, v), each running from −1 at one
 * edge to +1 at the other, with (0, 0) on the optical axis. The mapping from
 * (u, v) to a ray angle lives in `apertureTanTheta`.
 */

import type { SpectralGroup } from "./spectrum.js";

/**
 * A spectral group as the renderer needs it: the source's own line, plus any
 * path difference that this colour alone experiences.
 *
 * The offset exists because dispersion is real. Glass in one arm is worth a
 * different number of wavelengths to red light than to blue, so a single global
 * path difference cannot describe the instrument once uncompensated glass is in
 * it. Every group gets its own offset and the renderer adds it before working
 * out either the phase or the coherence envelope.
 */
export type FringeGroup = SpectralGroup & {
  /** Extra optical path difference seen by this group alone, nm. */
  readonly opdOffsetNm: number;
};

/**
 * Attaches per-colour path offsets to a source's spectrum.
 *
 * @param groups - the source's spectral groups
 * @param opdOffset - offset in nm for a given wavelength; defaults to none
 */
export function toFringeGroups(
  groups: readonly SpectralGroup[],
  opdOffset?: (wavelengthNm: number) => number,
): FringeGroup[] {
  return groups.map((group) => ({
    ...group,
    opdOffsetNm: opdOffset ? opdOffset(group.wavelengthNm) : 0,
  }));
}

/**
 * How optical path difference varies over the detector.
 *
 * The total OPD at a point is
 *
 *      Δ(u, v) = ringOpdNm · cos θ(u, v) + tiltXNm · u + tiltYNm · v + constantOpdNm
 *
 * Each term produces a recognisable kind of fringe:
 *
 *  - `ringOpdNm` — the arm difference (or cavity round trip). Because it is
 *    multiplied by cos θ, rays leaving the axis have a slightly shorter path,
 *    and the pattern is a set of concentric circles: fringes of equal
 *    inclination. This is the term the movable mirror changes.
 *  - `tiltXNm` / `tiltYNm` — a wedge between the two wavefronts, from tilting a
 *    mirror. OPD then varies linearly across the detector and the fringes are
 *    straight: fringes of equal thickness.
 *  - `constantOpdNm` — an insert (gas cell, sample slide) that shifts every
 *    fringe together without changing the pattern's shape.
 */
export type FringeGeometry = {
  /** OPD term multiplied by cos θ, nm. Produces circular fringes. */
  readonly ringOpdNm: number;

  /** Angle-independent OPD term, nm. Shifts the whole pattern. */
  readonly constantOpdNm: number;

  /** Additional OPD at the u = +1 edge of the detector, nm. Produces straight fringes. */
  readonly tiltXNm: number;

  /** Additional OPD at the v = +1 edge of the detector, nm. */
  readonly tiltYNm: number;

  /**
   * tan θ at the detector edge — the half-angle the detector subtends as seen
   * through the viewing lens. Converts (u, v) to a ray angle:
   * tan θ = apertureTanTheta · √(u² + v²).
   */
  readonly apertureTanTheta: number;
};

/**
 * Two routes recombining — a Michelson or a Mach-Zehnder.
 *
 *      I = I_A + I_B + 2 √(I_A I_B) · V · cos δ
 */
export type TwoBeamTerms = {
  readonly kind: "two-beam";

  /** Relative intensity arriving by the first route. */
  readonly intensityA: number;

  /** Relative intensity arriving by the second route. */
  readonly intensityB: number;

  /**
   * Phase added on top of the propagation phase, radians. A hard π appears here
   * for the complementary output port of a beam splitter, which is why one port
   * of a Mach-Zehnder is dark whenever the other is bright.
   */
  readonly extraPhaseRad: number;
};

/**
 * Many routes recombining — light bouncing repeatedly inside a Fabry-Perot
 * cavity. The geometric series of round trips sums to the Airy distribution,
 * whose peaks sharpen without limit as the mirrors get more reflective.
 */
export type MultiBeamTerms = {
  readonly kind: "multi-beam";

  /** Intensity reflectance R of each cavity mirror. */
  readonly reflectance: number;

  /** Intensity absorptance A of each cavity mirror coating. */
  readonly absorptance: number;

  /** Phase added on top of the round-trip propagation phase, radians. */
  readonly extraPhaseRad: number;
};

type InterferenceTerms = TwoBeamTerms | MultiBeamTerms;

/**
 * A complete description of the pattern on a detector: where the light is, what
 * colours it contains, and how it combines.
 */
export type FringeSpec = {
  readonly geometry: FringeGeometry;

  /** The source spectrum, already split into renderable groups. */
  readonly groups: readonly FringeGroup[];

  readonly terms: InterferenceTerms;

  /**
   * A blanket multiplier on fringe contrast, 0–1, for visibility losses the
   * geometry does not describe: imperfect beam overlap, or a which-path marker
   * that destroys interference outright.
   */
  readonly contrast: number;

  /** Display gain applied after the physics, so dim patterns stay legible. */
  readonly exposure: number;
};
