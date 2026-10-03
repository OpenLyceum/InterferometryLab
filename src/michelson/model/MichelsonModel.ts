/**
 * MichelsonModel.ts
 *
 * A Michelson interferometer: a beam splitter, a movable mirror M₁, a fixed
 * mirror M₂, and a detector.
 *
 * ── Where the path difference comes from ──────────────────────────────────────
 * Light leaves the splitter along two arms and comes back. Whatever the arms
 * differ by, the light travels *twice* — out and back — so moving M₁ by x
 * changes the optical path difference by 2x. Half a wavelength of mirror travel
 * therefore sweeps a whole fringe past the detector, and that factor of two is
 * why a Michelson measures displacement to a fraction of a wavelength.
 *
 * Three separate things add to the path difference here, and the sim keeps them
 * separate because each behaves differently across the detector:
 *
 *  1. The arm difference 2x. Rays leaving the axis at angle θ cross it at a
 *     slant and so see only 2x cos θ of it, which draws the pattern as circles.
 *  2. A tilt of M₂. This wedges the two wavefronts against each other, so the
 *     path difference grows linearly across the beam and the fringes straighten.
 *  3. An insert — the gas cell — in one arm. The beam passes through it twice,
 *     so it contributes 2L(n − 1), the same at every angle, and simply shifts
 *     the whole pattern.
 */

import { BooleanProperty, DerivedProperty, NumberProperty, type TReadOnlyProperty } from "scenerystack/axon";
import type { TModel } from "scenerystack/joist";
import { type FringeSpec, toFringeGroups } from "../../common/model/FringeSpec.js";
import { opticalPathDifference, tiltWedgeNm } from "../../common/model/fringeIntensity.js";
import { LightSourceModel } from "../../common/model/LightSourceModel.js";
import { gasIndex, mediumOpticalPathDelta, uncompensatedDispersionOpd } from "../../common/model/refractiveIndex.js";
import { spectrumVisibility } from "../../common/model/spectrum.js";
import {
  BEAMSPLITTER_SUBSTRATE_NM,
  DETECTOR_APERTURE_TAN_THETA,
  GAS_CELL_LENGTH_NM,
  GAS_CELL_PRESSURE_RANGE_KPA,
  MICHELSON_COARSE_RANGE_NM,
  MICHELSON_FINE_RANGE_NM,
  MIRROR_TILT_RANGE_URAD,
  ROOM_TEMPERATURE_K,
  STANDARD_PRESSURE_KPA,
} from "../../InterferometryLabConstants.js";

/**
 * Where the movable mirror starts, nm. Not zero: at zero path difference the
 * rings have expanded past the edge of the field and the detector shows a
 * single flat tone, which is a confusing thing to open on. Twenty micrometres
 * puts a few rings on the screen immediately.
 */
const INITIAL_COARSE_OFFSET_NM = 20000;

/**
 * Half the light goes each way at the splitter, so each route delivers half the
 * power to the detector.
 */
const ROUTE_INTENSITY = 0.5;

/**
 * Display gain. Two equal routes give an intensity between 0 and 2, so halving
 * it puts a bright fringe exactly at full scale.
 */
const EXPOSURE = 0.5;

export class MichelsonModel implements TModel {
  /** The lamp or laser illuminating the interferometer. */
  public readonly lightSource: LightSourceModel;

  /** Movable mirror displacement from the coarse stage, nm. */
  public readonly coarseOffsetProperty: NumberProperty;

  /** Additional displacement from the micrometer dial, nm. */
  public readonly fineOffsetProperty: NumberProperty;

  /** Tilt of M₂ about the vertical axis, µrad. Produces vertical fringes. */
  public readonly tiltHorizontalProperty: NumberProperty;

  /** Tilt of M₂ about the horizontal axis, µrad. Produces horizontal fringes. */
  public readonly tiltVerticalProperty: NumberProperty;

  /**
   * Whether the compensator plate is in the beam. It matters only for broadband
   * light: see {@link uncompensatedDispersionOpd}.
   */
  public readonly compensatorPlateProperty: BooleanProperty;

  /** Whether the gas cell is inserted in one arm. */
  public readonly gasCellEnabledProperty: BooleanProperty;

  /** Absolute pressure in the gas cell, kPa. */
  public readonly gasCellPressureProperty: NumberProperty;

  /**
   * Path difference the fringe counter was last zeroed at, nm. Counting from a
   * reference rather than accumulating means the count cannot drift, and it
   * matches how the measurement is actually made: zero the counter, move the
   * mirror, read off how many fringes went by.
   */
  public readonly countReferenceProperty: NumberProperty;

  /** Total displacement of the movable mirror, nm. */
  public readonly mirrorOffsetProperty: TReadOnlyProperty<number>;

  /** Refractive index of the gas in the cell. */
  public readonly gasIndexProperty: TReadOnlyProperty<number>;

  /**
   * Path difference contributed by the movable mirror alone, nm — twice its
   * displacement, because the arm is traversed both ways.
   */
  public readonly mirrorPathProperty: TReadOnlyProperty<number>;

  /** Path difference contributed by the gas cell alone, nm. */
  public readonly gasCellOpdProperty: TReadOnlyProperty<number>;

  /** Total optical path difference on the axis, nm. */
  public readonly pathDifferenceProperty: TReadOnlyProperty<number>;

  /** Fringe contrast at the current path difference, 0–1. */
  public readonly visibilityProperty: TReadOnlyProperty<number>;

  /** Fringes that have passed the centre since the counter was zeroed. */
  public readonly fringeCountProperty: TReadOnlyProperty<number>;

  /** Fringes the gas cell alone is responsible for shifting. */
  public readonly gasCellFringeShiftProperty: TReadOnlyProperty<number>;

  /** The pattern on the detector. */
  public readonly fringeSpecProperty: TReadOnlyProperty<FringeSpec>;

  public constructor() {
    this.lightSource = new LightSourceModel();

    this.coarseOffsetProperty = new NumberProperty(INITIAL_COARSE_OFFSET_NM, {
      range: MICHELSON_COARSE_RANGE_NM,
      units: "nm",
    });

    this.fineOffsetProperty = new NumberProperty(0, {
      range: MICHELSON_FINE_RANGE_NM,
      units: "nm",
    });

    this.tiltHorizontalProperty = new NumberProperty(0, { range: MIRROR_TILT_RANGE_URAD });
    this.tiltVerticalProperty = new NumberProperty(0, { range: MIRROR_TILT_RANGE_URAD });

    this.compensatorPlateProperty = new BooleanProperty(true);
    this.gasCellEnabledProperty = new BooleanProperty(false);
    this.gasCellPressureProperty = new NumberProperty(STANDARD_PRESSURE_KPA, {
      range: GAS_CELL_PRESSURE_RANGE_KPA,
      units: "kPa",
    });

    // The counter starts zeroed where the mirror starts, so the reading is
    // "fringes since you began" rather than a number inherited from the layout.
    this.countReferenceProperty = new NumberProperty(2 * INITIAL_COARSE_OFFSET_NM, { units: "nm" });

    this.mirrorOffsetProperty = new DerivedProperty(
      [this.coarseOffsetProperty, this.fineOffsetProperty],
      (coarse, fine) => coarse + fine,
    );

    this.mirrorPathProperty = new DerivedProperty([this.mirrorOffsetProperty], (offset) => 2 * offset);

    this.gasIndexProperty = new DerivedProperty([this.gasCellPressureProperty], (pressureKPa) =>
      gasIndex(pressureKPa, ROOM_TEMPERATURE_K),
    );

    this.gasCellOpdProperty = new DerivedProperty(
      [this.gasCellEnabledProperty, this.gasIndexProperty],
      // Doubled: the beam crosses the cell on the way out and again on the way back.
      (enabled, index) => (enabled ? 2 * mediumOpticalPathDelta(GAS_CELL_LENGTH_NM, index) : 0),
    );

    this.pathDifferenceProperty = new DerivedProperty(
      [this.mirrorPathProperty, this.gasCellOpdProperty],
      (mirrorPath, cellOpd) => mirrorPath + cellOpd,
    );

    this.fringeCountProperty = new DerivedProperty(
      [this.pathDifferenceProperty, this.countReferenceProperty, this.lightSource.meanWavelengthProperty],
      (pathDifference, reference, wavelengthNm) => (pathDifference - reference) / wavelengthNm,
    );

    this.gasCellFringeShiftProperty = new DerivedProperty(
      [this.gasCellOpdProperty, this.lightSource.meanWavelengthProperty],
      (cellOpd, wavelengthNm) => cellOpd / wavelengthNm,
    );

    this.fringeSpecProperty = new DerivedProperty(
      [
        this.lightSource.spectrumProperty,
        this.mirrorOffsetProperty,
        this.gasCellOpdProperty,
        this.tiltHorizontalProperty,
        this.tiltVerticalProperty,
        this.compensatorPlateProperty,
      ],
      (spectrum, mirrorOffsetNm, cellOpdNm, tiltHorizontal, tiltVertical, compensated): FringeSpec => ({
        geometry: {
          ringOpdNm: 2 * mirrorOffsetNm,
          constantOpdNm: cellOpdNm,
          tiltXNm: tiltWedgeNm(tiltHorizontal),
          tiltYNm: tiltWedgeNm(tiltVertical),
          apertureTanTheta: DETECTOR_APERTURE_TAN_THETA,
        },
        groups: toFringeGroups(
          spectrum.groups,
          compensated
            ? undefined
            : (wavelengthNm) => uncompensatedDispersionOpd(wavelengthNm, spectrum.centerNm, BEAMSPLITTER_SUBSTRATE_NM),
        ),
        terms: {
          kind: "two-beam",
          intensityA: ROUTE_INTENSITY,
          intensityB: ROUTE_INTENSITY,
          extraPhaseRad: 0,
        },
        contrast: 1,
        exposure: EXPOSURE,
      }),
    );

    this.visibilityProperty = new DerivedProperty(
      [this.fringeSpecProperty],
      (spec) => spec.contrast * spectrumVisibility(spec.groups, opticalPathDifference(spec.geometry, 0, 0)),
    );
  }

  /**
   * Sets the arms equal, undoing everything the mirror controls have done. The
   * quickest route to the white-light fringe, which is otherwise a needle in a
   * micrometre-wide haystack.
   */
  public zeroTheArms(): void {
    this.coarseOffsetProperty.value = 0;
    this.fineOffsetProperty.value = 0;
  }

  /** Zeroes the fringe counter at the current path difference. */
  public resetFringeCount(): void {
    this.countReferenceProperty.value = this.pathDifferenceProperty.value;
  }

  public reset(): void {
    this.lightSource.reset();
    this.coarseOffsetProperty.reset();
    this.fineOffsetProperty.reset();
    this.tiltHorizontalProperty.reset();
    this.tiltVerticalProperty.reset();
    this.compensatorPlateProperty.reset();
    this.gasCellEnabledProperty.reset();
    this.gasCellPressureProperty.reset();
    this.countReferenceProperty.reset();
  }

  /** Nothing in a Michelson evolves on its own; every change is a user action. */
  public step(_dt: number): void {
    // Intentionally empty.
  }
}
