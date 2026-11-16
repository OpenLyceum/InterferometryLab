import { FABRY_PEROT_MODEL_SETTINGS, FABRYPEROTMODEL_TIME_STEP } from "../../InterferometryLabConstants.js";
/**
 * FabryPerotModel.ts
 *
 * A Fabry-Pérot interferometer: two partly reflecting mirrors facing each other
 * across a gap, and the light that bounces between them.
 *
 * ── What makes this different ─────────────────────────────────────────────────
 * A Michelson or a Mach-Zehnder adds two beams. A Fabry-Pérot adds all of them:
 * light entering the cavity leaks a little out at each bounce, so the
 * transmitted field is an endless geometric series of ever-weaker, ever more
 * delayed copies. That series sums to the Airy distribution,
 *
 *      I = I_peak / ( 1 + F sin²(δ/2) ),        F = 4R/(1 − R)²
 *
 * which is not a cosine. A cosine spends half its time near its maximum; the
 * Airy function is nearly zero everywhere except at narrow spikes where every
 * round trip returns in phase. Raising R makes those spikes narrower without
 * limit — that is the whole reason this instrument exists, and why it can
 * separate two spectral lines a few picometres apart when a two-beam
 * interferometer cannot.
 *
 * ── Reading the numbers ───────────────────────────────────────────────────────
 * Three quantities describe any etalon and this model derives all three:
 *
 *  - **Free spectral range** λ²/2nd — how far apart in wavelength two peaks sit.
 *    Beyond it the orders overlap and the reading becomes ambiguous.
 *  - **Finesse** π√R/(1 − R) — how many resolvable positions fit in one free
 *    spectral range. It depends only on the mirrors, not on the spacing.
 *  - **Resolving power** λ/δλ = m·F — their product with the order m = 2nd/λ.
 *    Wide spacing buys resolution and spends free spectral range.
 */

import { BooleanProperty, DerivedProperty, NumberProperty, type TReadOnlyProperty } from "scenerystack/axon";
import type { TModel } from "scenerystack/joist";
import { type FringeSpec, toFringeGroups } from "../../common/model/FringeSpec.js";
import { airyPeakTransmission, reflectiveFinesse } from "../../common/model/fringeIntensity.js";
import type { SpectralGroup } from "../../common/model/spectrum.js";
import { TimeModel } from "../../common/TimeModel.js";
import {
  ABSORPTANCE_RANGE,
  CAVITY_SPACING_RANGE_UM,
  DETECTOR_APERTURE_TAN_THETA,
  LINE_SEPARATION_RANGE_PM,
  NM_PER_UM,
  PM_PER_NM,
  REFLECTANCE_RANGE,
  WAVELENGTH_RANGE_NM,
} from "../../InterferometryLabConstants.js";

/** Refractive index between the mirrors. The cavity is air-spaced. */
const CAVITY_INDEX = 1;

/**
 * Linewidth (FWHM, nm) of each source line. Narrow enough that the etalon's own
 * response, not the source, sets what the rings look like — which is the regime
 * an etalon is used in.
 */
const SOURCE_LINEWIDTH_NM: number = FABRY_PEROT_MODEL_SETTINGS.SOURCE_LINEWIDTH_NM;

/** How far the scan sweeps the spacing, in wavelengths. */
const SCAN_AMPLITUDE_WAVES: number = FABRY_PEROT_MODEL_SETTINGS.SCAN_AMPLITUDE_WAVES;

/** Scan period, seconds. */
const SCAN_PERIOD_S: number = FABRY_PEROT_MODEL_SETTINGS.SCAN_PERIOD_S;

/** One frame's worth of sweep, seconds — what the step-forward button advances. */
const MANUAL_STEP_DT: number = FABRYPEROTMODEL_TIME_STEP.SECONDS;

/**
 * Starting spacing, nm: exactly 340 half-waves of the default 589 nm line.
 *
 * An etalon only transmits at resonance, and landing on one at startup is worth
 * the contrivance — off resonance the centre of the pattern is dark and the
 * source line falls in the gap between transmission peaks, which is a correct
 * but thoroughly discouraging first impression.
 */
const INITIAL_SPACING_NM =
  (FABRY_PEROT_MODEL_SETTINGS.INITIAL_RESONANCE_ORDER * FABRY_PEROT_MODEL_SETTINGS.INITIAL_REFERENCE_WAVELENGTH) / 2;

/** Display gain: the Airy peak is already normalized to 1. */
const EXPOSURE = 1;

export class FabryPerotModel implements TModel {
  /** Wavelength of the source's main line, nm. */
  public readonly wavelengthProperty: NumberProperty;

  /** Whether a second line is present, for resolving-power tests. */
  public readonly twinLineProperty: BooleanProperty;

  /** Separation between the two source lines, pm. */
  public readonly lineSeparationProperty: NumberProperty;

  /** Intensity reflectance of each mirror. */
  public readonly reflectanceProperty: NumberProperty;

  /** Intensity absorptance of each mirror coating. */
  public readonly absorptanceProperty: NumberProperty;

  /** Nominal mirror spacing, nm. */
  public readonly spacingProperty: NumberProperty;

  /**
   * The scan clock. Playing sweeps the spacing the way a scanning etalon's piezo
   * does; paused, the cavity holds still. Being able to stop on a transmission
   * peak, and to creep up on one a frame at a time, is what makes the sweep
   * something to read rather than something to watch go past.
   */
  public readonly timer = new TimeModel();

  /** Sweep offset added to the spacing while scanning, nm. */
  public readonly scanOffsetProperty: NumberProperty;

  /** Spacing actually in effect, nm. */
  public readonly effectiveSpacingProperty: TReadOnlyProperty<number>;

  /**
   * Optical path of one round trip inside the cavity, 2nd (nm) — the path
   * difference between consecutive emerging beams, and the quantity the order
   * and the free spectral range are both built from.
   */
  public readonly roundTripPathProperty: TReadOnlyProperty<number>;

  /** The source's spectral lines. */
  public readonly linesProperty: TReadOnlyProperty<readonly SpectralGroup[]>;

  /** Reflective finesse π√R/(1 − R). */
  public readonly finesseProperty: TReadOnlyProperty<number>;

  /** Free spectral range λ²/2nd, nm. */
  public readonly freeSpectralRangeProperty: TReadOnlyProperty<number>;

  /** Resolving power λ/δλ = m·F. */
  public readonly resolvingPowerProperty: TReadOnlyProperty<number>;

  /** Smallest resolvable wavelength difference, pm. */
  public readonly resolutionLimitProperty: TReadOnlyProperty<number>;

  /** Peak transmission of the cavity, 0–1. */
  public readonly peakTransmissionProperty: TReadOnlyProperty<number>;

  /** Interference order at the centre of the pattern, m = 2nd/λ. */
  public readonly orderProperty: TReadOnlyProperty<number>;

  /** Whether the two source lines are far enough apart to be told apart. */
  public readonly resolvedProperty: TReadOnlyProperty<boolean>;

  /** The ring pattern on the detector. */
  public readonly fringeSpecProperty: TReadOnlyProperty<FringeSpec>;

  public constructor() {
    this.wavelengthProperty = new NumberProperty(FABRY_PEROT_MODEL_SETTINGS.WAVELENGTH_DEFAULT, {
      range: WAVELENGTH_RANGE_NM,
      units: "nm",
    });
    this.twinLineProperty = new BooleanProperty(false);
    this.lineSeparationProperty = new NumberProperty(FABRY_PEROT_MODEL_SETTINGS.LINE_SEPARATION_DEFAULT, {
      range: LINE_SEPARATION_RANGE_PM,
    });

    this.reflectanceProperty = new NumberProperty(FABRY_PEROT_MODEL_SETTINGS.REFLECTANCE_DEFAULT, {
      range: REFLECTANCE_RANGE,
    });
    this.absorptanceProperty = new NumberProperty(0, { range: ABSORPTANCE_RANGE });
    this.spacingProperty = new NumberProperty(INITIAL_SPACING_NM, {
      range: CAVITY_SPACING_RANGE_UM.times(NM_PER_UM),
      units: "nm",
    });

    this.scanOffsetProperty = new NumberProperty(0, { units: "nm" });

    this.effectiveSpacingProperty = new DerivedProperty(
      [this.spacingProperty, this.scanOffsetProperty],
      (spacing, offset) => spacing + offset,
    );

    this.roundTripPathProperty = new DerivedProperty(
      [this.effectiveSpacingProperty],
      (spacing) => 2 * CAVITY_INDEX * spacing,
    );

    this.linesProperty = new DerivedProperty(
      [this.wavelengthProperty, this.twinLineProperty, this.lineSeparationProperty],
      (wavelengthNm, twinLine, separationPm): readonly SpectralGroup[] => {
        if (!twinLine) {
          return [{ wavelengthNm, bandwidthNm: SOURCE_LINEWIDTH_NM, weight: 1 }];
        }
        const halfSeparationNm = separationPm / PM_PER_NM / 2;
        return [
          { wavelengthNm: wavelengthNm - halfSeparationNm, bandwidthNm: SOURCE_LINEWIDTH_NM, weight: 0.5 },
          { wavelengthNm: wavelengthNm + halfSeparationNm, bandwidthNm: SOURCE_LINEWIDTH_NM, weight: 0.5 },
        ];
      },
    );

    this.finesseProperty = new DerivedProperty([this.reflectanceProperty], (reflectance) =>
      reflectiveFinesse(reflectance),
    );

    this.freeSpectralRangeProperty = new DerivedProperty(
      [this.wavelengthProperty, this.effectiveSpacingProperty],
      (wavelengthNm, spacingNm) => (wavelengthNm * wavelengthNm) / (2 * CAVITY_INDEX * spacingNm),
    );

    this.orderProperty = new DerivedProperty(
      [this.wavelengthProperty, this.effectiveSpacingProperty],
      (wavelengthNm, spacingNm) => (2 * CAVITY_INDEX * spacingNm) / wavelengthNm,
    );

    this.resolvingPowerProperty = new DerivedProperty(
      [this.orderProperty, this.finesseProperty],
      (order, finesse) => order * finesse,
    );

    this.resolutionLimitProperty = new DerivedProperty(
      [this.wavelengthProperty, this.resolvingPowerProperty],
      (wavelengthNm, resolvingPower) =>
        resolvingPower > 0 ? (PM_PER_NM * wavelengthNm) / resolvingPower : Number.POSITIVE_INFINITY,
    );

    this.peakTransmissionProperty = new DerivedProperty(
      [this.reflectanceProperty, this.absorptanceProperty],
      (reflectance, absorptance) => airyPeakTransmission(reflectance, absorptance),
    );

    // The Rayleigh-style criterion an etalon is quoted against: two lines count
    // as resolved once they are further apart than the instrument's own
    // resolution limit.
    this.resolvedProperty = new DerivedProperty(
      [this.twinLineProperty, this.lineSeparationProperty, this.resolutionLimitProperty],
      (twinLine, separationPm, limitPm) => twinLine && separationPm >= limitPm,
    );

    this.fringeSpecProperty = new DerivedProperty(
      [this.linesProperty, this.effectiveSpacingProperty, this.reflectanceProperty, this.absorptanceProperty],
      (lines, spacingNm, reflectance, absorptance): FringeSpec => ({
        geometry: {
          // One round trip of the cavity, shortened off-axis by cos θ — the same
          // geometry that gives a Michelson its rings, but read out through a
          // far sharper function.
          ringOpdNm: 2 * CAVITY_INDEX * spacingNm,
          constantOpdNm: 0,
          tiltXNm: 0,
          tiltYNm: 0,
          apertureTanTheta: DETECTOR_APERTURE_TAN_THETA,
        },
        groups: toFringeGroups(lines),
        terms: { kind: "multi-beam", reflectance, absorptance, extraPhaseRad: 0 },
        contrast: 1,
        exposure: EXPOSURE,
      }),
    );
  }

  /**
   * Transmission of the cavity at a given wavelength on the axis. Used to draw
   * the spectrum plot; the ring pattern uses the same physics per pixel.
   */
  public transmissionAt(wavelengthNm: number): number {
    const delta = (2 * Math.PI * 2 * CAVITY_INDEX * this.effectiveSpacingProperty.value) / wavelengthNm;
    const reflectance = this.reflectanceProperty.value;
    const coefficient = (4 * reflectance) / (1 - reflectance) ** 2;
    const sine = Math.sin(delta / 2);
    return this.peakTransmissionProperty.value / (1 + coefficient * sine * sine);
  }

  public reset(): void {
    this.wavelengthProperty.reset();
    this.twinLineProperty.reset();
    this.lineSeparationProperty.reset();
    this.reflectanceProperty.reset();
    this.absorptanceProperty.reset();
    this.spacingProperty.reset();
    this.scanOffsetProperty.reset();
    this.timer.reset();
  }

  /**
   * Sweeps the spacing while the scan clock is running. A real scanning
   * Fabry-Pérot pushes one mirror with a piezo through a wavelength or two, so
   * the transmission peaks march across the source's spectrum and the rings
   * collapse into the centre — the trace this produces *is* the measured
   * spectrum.
   *
   * The clock only advances while playing, so a paused cavity holds the spacing
   * it stopped at rather than snapping back.
   */
  public step(dt: number): void {
    this.timer.step(dt);
    this.updateScanOffset();
  }

  /** Advances the sweep by one frame regardless of the clock — the step button. */
  public stepOnce(): void {
    this.timer.timeProperty.value += MANUAL_STEP_DT;
    this.updateScanOffset();
  }

  private updateScanOffset(): void {
    const phase = (2 * Math.PI * this.timer.timeProperty.value) / SCAN_PERIOD_S;
    this.scanOffsetProperty.value = SCAN_AMPLITUDE_WAVES * this.wavelengthProperty.value * 0.5 * Math.sin(phase);
  }
}
