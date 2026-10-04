/**
 * MachZehnderModel.ts
 *
 * A Mach-Zehnder interferometer: two beam splitters, two mirrors, two separate
 * paths, and — unlike a Michelson — two output ports.
 *
 * ── Why two ports matter ──────────────────────────────────────────────────────
 * The second beam splitter has two outputs, and they are complementary. Light
 * reaching port A by reflection picks up a half-wave that light reaching it by
 * transmission does not; at port B the roles are swapped. So the two ports carry
 * cosines exactly π out of step, and whatever leaves one is missing from the
 * other. When port A is dark, every photon is at port B.
 *
 * That is not a curiosity, it is where energy conservation shows up. A single
 * port looks as though interference can destroy light; both ports together show
 * it only ever moves it.
 *
 * ── Single photons ────────────────────────────────────────────────────────────
 * The same model runs the single-photon mode. Nothing about the interference
 * changes: the intensity pattern becomes a probability distribution, photons are
 * drawn from it one at a time, and the pattern reappears in the accumulated
 * counts. That is the whole content of "the photon interferes with itself".
 *
 * Turning on the which-path marker sets the contrast to zero. Once the path a
 * photon took is recorded anywhere, the two routes can no longer contribute a
 * joint amplitude, and both ports go to a flat 50/50 with no fringes.
 */

import {
  BooleanProperty,
  DerivedProperty,
  EnumerationProperty,
  NumberProperty,
  type TReadOnlyProperty,
} from "scenerystack/axon";
import { dotRandom, Vector2 } from "scenerystack/dot";
import type { TModel } from "scenerystack/joist";
import { type FringeSpec, toFringeGroups } from "../../common/model/FringeSpec.js";
import { intensityAt, tiltWedgeNm } from "../../common/model/fringeIntensity.js";
import { LightSourceModel } from "../../common/model/LightSourceModel.js";
import { plateOpticalPathDelta } from "../../common/model/refractiveIndex.js";
import { SourceType } from "../../common/model/SourceType.js";
import { spectrumVisibility } from "../../common/model/spectrum.js";
import { TimeModel } from "../../common/TimeModel.js";
import {
  DETECTOR_APERTURE_TAN_THETA,
  MAX_PHOTON_MARKS,
  MIRROR_TILT_RANGE_URAD,
  NM_PER_UM,
  PATH_IMBALANCE_RANGE_NM,
  PHOTON_RATE_RANGE,
  SAMPLE_INDEX_RANGE,
  SAMPLE_THICKNESS_RANGE_UM,
  SAMPLE_TILT_RANGE_DEG,
} from "../../InterferometryLabConstants.js";
import { BeamMode } from "./BeamMode.js";

/** Half the light takes each route. */
const ROUTE_INTENSITY = 0.5;

/** Two equal routes peak at 2; halving puts a bright fringe at full scale. */
const EXPOSURE = 0.5;

/** One frame's worth of emission, seconds — what the step-forward button advances. */
const MANUAL_STEP_DT = 1 / 60;

/** Minimum quadrature resolution along an axis with a nonzero mirror wedge. */
const MIN_PORT_SAMPLES = 24;

/** Samples per shortest-wavelength fringe, to keep the port average free of aliasing. */
const PORT_SAMPLES_PER_FRINGE = 8;

/**
 * A photon landing on a detector: where it hit, in detector coordinates.
 */
export type PhotonMark = {
  readonly position: Vector2;
};

export class MachZehnderModel implements TModel {
  public readonly lightSource: LightSourceModel;

  /** Extra path length in arm 1 relative to arm 2, nm. */
  public readonly pathImbalanceProperty: NumberProperty;

  /** Mirror tilt about the vertical axis, µrad. */
  public readonly tiltHorizontalProperty: NumberProperty;

  /** Mirror tilt about the horizontal axis, µrad. */
  public readonly tiltVerticalProperty: NumberProperty;

  /** Whether the sample slide is in one arm. */
  public readonly sampleEnabledProperty: BooleanProperty;

  /** Sample slide thickness, µm. */
  public readonly sampleThicknessProperty: NumberProperty;

  /** Sample slide refractive index. */
  public readonly sampleIndexProperty: NumberProperty;

  /** Sample slide tilt away from normal incidence, degrees. */
  public readonly sampleTiltProperty: NumberProperty;

  /** Continuous beam, or one photon at a time. */
  public readonly beamModeProperty: EnumerationProperty<BeamMode>;

  /** Photon emission rate, photons per second. */
  public readonly photonRateProperty: NumberProperty;

  /** Whether a marker records which path each photon takes. */
  public readonly whichPathProperty: BooleanProperty;

  /** Photons detected at each port since the counts were last cleared. */
  public readonly countsAProperty: NumberProperty;
  public readonly countsBProperty: NumberProperty;

  /** Photons emitted since the counts were last cleared. */
  public readonly photonsEmittedProperty: NumberProperty;

  /** Where recent photons landed, per port, for the build-up display. */
  public readonly marksA: PhotonMark[] = [];
  public readonly marksB: PhotonMark[] = [];

  /** Bumped whenever a photon is added, so the view knows to repaint. */
  public readonly photonRevisionProperty: NumberProperty;

  /**
   * The emission clock. Single photons arrive far too fast to watch: at the
   * default rate the pattern is drawn in a couple of seconds, and "one photon at
   * a time" is a claim about a process nobody gets to see happen. Pausing, and
   * stepping a frame at a time, is what turns the accumulation into something
   * that can be examined while it is still sparse.
   */
  public readonly timer = new TimeModel(true);

  /** Optical path added by the sample slide, nm. */
  public readonly samplePathProperty: TReadOnlyProperty<number>;

  /** Total optical path difference on the axis, nm. */
  public readonly pathDifferenceProperty: TReadOnlyProperty<number>;

  /** Fringe contrast, 0 when the which-path marker is on. */
  public readonly contrastProperty: TReadOnlyProperty<number>;

  /** Fringe visibility at the current path difference, 0–1. */
  public readonly visibilityProperty: TReadOnlyProperty<number>;

  /** Patterns at the two output ports. */
  public readonly portASpecProperty: TReadOnlyProperty<FringeSpec>;
  public readonly portBSpecProperty: TReadOnlyProperty<FringeSpec>;

  /** Share of the light leaving by each port, 0–1. They sum to 1. */
  public readonly portAFractionProperty: TReadOnlyProperty<number>;
  public readonly portBFractionProperty: TReadOnlyProperty<number>;

  /** Time carried over between frames when the rate is below one per frame. */
  private photonAccumulator = 0;

  public constructor() {
    // A Mach-Zehnder's arms are separate, so its path difference is set by
    // construction rather than by a mirror on a stage; the sodium doublet's
    // millimetre-scale beats are out of reach here, and the picker leaves it out.
    this.lightSource = new LightSourceModel({
      availableTypes: [
        SourceType.HELIUM_NEON,
        SourceType.GREEN_LASER,
        SourceType.BLUE_LASER,
        SourceType.FILTERED_LAMP,
        SourceType.WHITE_LIGHT,
      ],
    });

    this.pathImbalanceProperty = new NumberProperty(0, {
      range: PATH_IMBALANCE_RANGE_NM,
      units: "nm",
    });

    // Opens with the mirrors parallel: no wedge, so the whole field is one
    // fringe and every photon leaves by port A while port B sits dark. That is
    // the screen's headline result, and it is worth showing before the fringes.
    this.tiltHorizontalProperty = new NumberProperty(0, { range: MIRROR_TILT_RANGE_URAD });
    this.tiltVerticalProperty = new NumberProperty(0, { range: MIRROR_TILT_RANGE_URAD });

    this.sampleEnabledProperty = new BooleanProperty(false);
    this.sampleThicknessProperty = new NumberProperty(20, { range: SAMPLE_THICKNESS_RANGE_UM });
    this.sampleIndexProperty = new NumberProperty(1.5, { range: SAMPLE_INDEX_RANGE });
    this.sampleTiltProperty = new NumberProperty(0, { range: SAMPLE_TILT_RANGE_DEG });

    this.beamModeProperty = new EnumerationProperty(BeamMode.CONTINUOUS);
    this.photonRateProperty = new NumberProperty(400, { range: PHOTON_RATE_RANGE });
    this.whichPathProperty = new BooleanProperty(false);

    this.countsAProperty = new NumberProperty(0);
    this.countsBProperty = new NumberProperty(0);
    this.photonsEmittedProperty = new NumberProperty(0);
    this.photonRevisionProperty = new NumberProperty(0);

    this.samplePathProperty = new DerivedProperty(
      [this.sampleEnabledProperty, this.sampleThicknessProperty, this.sampleIndexProperty, this.sampleTiltProperty],
      (enabled, thicknessUm, index, tiltDeg) =>
        enabled ? plateOpticalPathDelta(thicknessUm * NM_PER_UM, index, (tiltDeg * Math.PI) / 180) : 0,
    );

    this.pathDifferenceProperty = new DerivedProperty(
      [this.pathImbalanceProperty, this.samplePathProperty],
      (imbalance, samplePath) => imbalance + samplePath,
    );

    this.contrastProperty = new DerivedProperty([this.whichPathProperty], (whichPath) => (whichPath ? 0 : 1));

    // Two separate losses of contrast multiply here: the which-path marker,
    // which destroys interference outright, and the source's own coherence
    // envelope, which fades it as the arms are pulled apart.
    this.visibilityProperty = new DerivedProperty(
      [this.contrastProperty, this.lightSource.spectrumProperty, this.pathDifferenceProperty],
      (contrast, spectrum, pathDifference) => contrast * spectrumVisibility(spectrum.groups, pathDifference),
    );

    const geometryProperty = new DerivedProperty(
      [this.pathDifferenceProperty, this.tiltHorizontalProperty, this.tiltVerticalProperty],
      (pathDifference, tiltHorizontal, tiltVertical) => ({
        // Both routes are collimated and cross the recombining splitter at the
        // same angle, so there is no ray-angle term here: no rings, only the
        // wedge the mirror tilt introduces.
        ringOpdNm: 0,
        constantOpdNm: pathDifference,
        tiltXNm: tiltWedgeNm(tiltHorizontal),
        tiltYNm: tiltWedgeNm(tiltVertical),
        apertureTanTheta: DETECTOR_APERTURE_TAN_THETA,
      }),
    );

    const makePort = (extraPhaseRad: number): TReadOnlyProperty<FringeSpec> =>
      new DerivedProperty(
        [this.lightSource.spectrumProperty, geometryProperty, this.contrastProperty],
        (spectrum, geometry, contrast): FringeSpec => ({
          geometry,
          groups: toFringeGroups(spectrum.groups),
          terms: {
            kind: "two-beam",
            intensityA: ROUTE_INTENSITY,
            intensityB: ROUTE_INTENSITY,
            extraPhaseRad,
          },
          contrast,
          exposure: EXPOSURE,
        }),
      );

    this.portASpecProperty = makePort(0);
    // The half-wave that makes the ports complementary.
    this.portBSpecProperty = makePort(Math.PI);

    this.portAFractionProperty = new DerivedProperty([this.portASpecProperty], (spec) => portFraction(spec));
    this.portBFractionProperty = new DerivedProperty([this.portBSpecProperty], (spec) => portFraction(spec));
  }

  /** Clears the photon counts and the accumulated marks. */
  public clearCounts(): void {
    this.photonAccumulator = 0;
    this.countsAProperty.value = 0;
    this.countsBProperty.value = 0;
    this.photonsEmittedProperty.value = 0;
    this.marksA.length = 0;
    this.marksB.length = 0;
    this.photonRevisionProperty.value++;
  }

  public reset(): void {
    this.lightSource.reset();
    this.pathImbalanceProperty.reset();
    this.tiltHorizontalProperty.reset();
    this.tiltVerticalProperty.reset();
    this.sampleEnabledProperty.reset();
    this.sampleThicknessProperty.reset();
    this.sampleIndexProperty.reset();
    this.sampleTiltProperty.reset();
    this.beamModeProperty.reset();
    this.photonRateProperty.reset();
    this.whichPathProperty.reset();
    this.timer.reset();
    this.clearCounts();
    this.photonAccumulator = 0;
  }

  /**
   * Emits photons in single-photon mode.
   *
   * Each photon is drawn from the joint distribution the two paths produce
   * together — it is never assigned a path. That is the point of the mode: a
   * photon that took a definite route could not produce fringes, and the moment
   * the which-path marker records one, these draws go to an even 50/50 and the
   * fringes stop appearing.
   */
  public step(dt: number): void {
    this.timer.step(dt);
    if (!this.timer.isPlayingProperty.value) {
      return;
    }
    this.emit(dt);
  }

  /**
   * Emits one frame's worth of photons regardless of the clock — what the
   * step-forward button does while paused. At the lowest emission rate a frame
   * is worth a third of a photon, so stepping really does deliver them one at a
   * time.
   */
  public stepOnce(): void {
    this.emit(MANUAL_STEP_DT);
  }

  private emit(dt: number): void {
    if (this.beamModeProperty.value !== BeamMode.SINGLE_PHOTON) {
      return;
    }

    this.photonAccumulator += dt * this.photonRateProperty.value;
    const count = Math.floor(this.photonAccumulator);
    if (count <= 0) {
      return;
    }
    this.photonAccumulator -= count;

    const specA = this.portASpecProperty.value;
    const specB = this.portBSpecProperty.value;
    const scratch = new Float64Array(specA.groups.length);

    let landedA = 0;
    let landedB = 0;

    for (let i = 0; i < count; i++) {
      // The beam illuminates the aperture evenly, so where a photon crosses the
      // wavefront is uniform. What is not uniform is where it goes next: the two
      // ports' intensities always add to the full beam, and the local phase
      // decides how that one photon's worth of probability is divided between
      // them. No photon is lost — destructive interference at one port is
      // constructive at the other.
      const position = new Vector2(dotRandom.nextDoubleBetween(-1, 1), dotRandom.nextDoubleBetween(-1, 1));
      const intensityA = intensityAt(specA, position.x, position.y, scratch);
      const intensityB = intensityAt(specB, position.x, position.y, scratch);
      const total = intensityA + intensityB;
      const toPortA = total <= 0 ? dotRandom.nextBoolean() : dotRandom.nextDouble() * total < intensityA;

      if (toPortA) {
        pushMark(this.marksA, position);
        landedA++;
      } else {
        pushMark(this.marksB, position);
        landedB++;
      }
    }

    this.photonsEmittedProperty.value += count;
    if (landedA > 0) {
      this.countsAProperty.value += landedA;
    }
    if (landedB > 0) {
      this.countsBProperty.value += landedB;
    }
    if (landedA > 0 || landedB > 0) {
      this.photonRevisionProperty.value++;
    }
  }
}

/** Adds a mark, discarding the oldest once the display is full. */
function pushMark(marks: PhotonMark[], position: Vector2): void {
  if (marks.length >= MAX_PHOTON_MARKS) {
    marks.shift();
  }
  marks.push({ position });
}

/**
 * Mean intensity over the detector for one port, as a fraction of the total
 * light. Resolve the shortest-wavelength fringes on each axis before averaging;
 * a fixed grid can repeatedly land on dark fringes and misreport a bright port.
 * The Mach-Zehnder has no ring term, so an axis without tilt needs only one sample.
 */
function portFraction(spec: FringeSpec): number {
  const shortestWavelength = Math.min(...spec.groups.map((group) => group.wavelengthNm));
  const samplesForTilt = (tiltNm: number): number =>
    tiltNm === 0
      ? 1
      : Math.max(MIN_PORT_SAMPLES, Math.ceil((PORT_SAMPLES_PER_FRINGE * 2 * Math.abs(tiltNm)) / shortestWavelength));
  const samplesX = samplesForTilt(spec.geometry.tiltXNm);
  const samplesY = samplesForTilt(spec.geometry.tiltYNm);
  const scratch = new Float64Array(spec.groups.length);
  let total = 0;

  for (let iy = 0; iy < samplesY; iy++) {
    const v = (2 * (iy + 0.5)) / samplesY - 1;
    for (let ix = 0; ix < samplesX; ix++) {
      const u = (2 * (ix + 0.5)) / samplesX - 1;
      total += intensityAt(spec, u, v, scratch);
    }
  }

  // Each port's mean intensity is already scaled so that the two ports' means
  // add to 1: exposure halves a peak of 2, and the ports are complementary.
  return total / (samplesX * samplesY);
}
