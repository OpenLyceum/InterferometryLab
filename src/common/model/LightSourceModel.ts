import { LIGHT_SOURCE_MODEL_SETTINGS } from "../../InterferometryLabConstants.js";
/**
 * LightSourceModel.ts
 *
 * The source on the optical table: which lamp or laser is selected, and the
 * spectrum that follows from it.
 *
 * Everything downstream of this class sees only a list of {@link SpectralGroup}s
 * — the interferometers do not care whether the light came from a laser or a
 * filtered lamp, only how wide its spectrum is.
 */

import { DerivedProperty, EnumerationProperty, NumberProperty, type TReadOnlyProperty } from "scenerystack/axon";
import {
  BANDWIDTH_RANGE_NM,
  BLUE_LASER_WAVELENGTH_NM,
  BROADBAND_LINE_COUNT,
  GREEN_LASER_WAVELENGTH_NM,
  HENE_WAVELENGTH_NM,
  LASER_BANDWIDTH_NM,
  SODIUM_D1_WAVELENGTH_NM,
  SODIUM_D2_WAVELENGTH_NM,
  WAVELENGTH_RANGE_NM,
  WHITE_LIGHT_BANDWIDTH_NM,
  WHITE_LIGHT_CENTER_NM,
} from "../../InterferometryLabConstants.js";
import { SourceType } from "./SourceType.js";
import { coherenceLength, normalizeWeights, type SpectralGroup, splitLine } from "./spectrum.js";

/**
 * Doppler-broadened width (FWHM, nm) of a single sodium D line in a low-pressure
 * discharge lamp. Each line on its own stays coherent over tens of millimetres;
 * it is the *pair* that makes the fringes come and go.
 */
const SODIUM_LINE_BANDWIDTH_NM: number = LIGHT_SOURCE_MODEL_SETTINGS.SODIUM_LINE_BANDWIDTH_NM;

/**
 * A filtered lamp narrower than this is rendered as one group: a single Gaussian
 * whose analytic envelope is exact, and whose colour does not visibly vary
 * across the band. Wider bands are split so their colours separate.
 */
const SINGLE_GROUP_BANDWIDTH_NM: number = LIGHT_SOURCE_MODEL_SETTINGS.SINGLE_GROUP_BANDWIDTH_NM;

/** Wavelength (nm) of one group per this many nm of bandwidth, once split. */
const NM_PER_GROUP: number = LIGHT_SOURCE_MODEL_SETTINGS.NM_PER_GROUP;

/** Wavelength bounds (nm) of the band the broadband source is sampled over. */
const BROADBAND_MIN_NM: number = LIGHT_SOURCE_MODEL_SETTINGS.BROADBAND_MIN_NM;
const BROADBAND_MAX_NM: number = LIGHT_SOURCE_MODEL_SETTINGS.BROADBAND_MAX_NM;

/** The spectrum a source produces, plus the summary numbers a readout wants. */
export type SourceSpectrum = {
  /** Renderable spectral groups; weights sum to 1. */
  readonly groups: readonly SpectralGroup[];

  /** Power-weighted mean wavelength, nm. */
  readonly centerNm: number;

  /**
   * Width (FWHM, nm) that governs how quickly fringes fade with path
   * difference. For a doublet this is one line's width, not the line spacing —
   * the spacing produces revivals rather than decay.
   */
  readonly bandwidthNm: number;

  /**
   * Separation between the two lines of a doublet source, nm; 0 for every other
   * source. Sets the period of the visibility beat.
   */
  readonly doubletSeparationNm: number;
};

export type LightSourceModelOptions = {
  /** Sources this screen offers, in the order they appear in the picker. */
  readonly availableTypes?: readonly SourceType[];

  /** Source selected initially and restored by Reset All. */
  readonly initialType?: SourceType;
};

const DEFAULT_TYPES: readonly SourceType[] = [
  SourceType.HELIUM_NEON,
  SourceType.GREEN_LASER,
  SourceType.BLUE_LASER,
  SourceType.SODIUM_LAMP,
  SourceType.FILTERED_LAMP,
  SourceType.WHITE_LIGHT,
];

export class LightSourceModel {
  /** Which lamp or laser is on the table. */
  public readonly sourceTypeProperty: EnumerationProperty<SourceType>;

  /** Centre wavelength of the filtered lamp, nm. Ignored by the fixed sources. */
  public readonly filterWavelengthProperty: NumberProperty;

  /** Bandwidth of the filtered lamp, nm. Ignored by the fixed sources. */
  public readonly filterBandwidthProperty: NumberProperty;

  /** The spectrum the selected source emits. */
  public readonly spectrumProperty: TReadOnlyProperty<SourceSpectrum>;

  /** The selected source's spectral groups, for anything that only needs those. */
  public readonly groupsProperty: TReadOnlyProperty<readonly SpectralGroup[]>;

  /** Coherence length λ²/Δλ, nm — how far the arms may differ before fringes fade. */
  public readonly coherenceLengthProperty: TReadOnlyProperty<number>;

  /** Mean wavelength of the selected source, nm. */
  public readonly meanWavelengthProperty: TReadOnlyProperty<number>;

  /** True when the wavelength and bandwidth controls apply to the selected source. */
  public readonly isFilteredProperty: TReadOnlyProperty<boolean>;

  /** The sources this screen offers. */
  public readonly availableTypes: readonly SourceType[];

  public constructor(options?: LightSourceModelOptions) {
    this.availableTypes = options?.availableTypes ?? DEFAULT_TYPES;

    this.sourceTypeProperty = new EnumerationProperty(options?.initialType ?? SourceType.HELIUM_NEON, {
      validValues: [...this.availableTypes],
    });

    this.filterWavelengthProperty = new NumberProperty(WHITE_LIGHT_CENTER_NM, {
      range: WAVELENGTH_RANGE_NM,
      units: "nm",
    });

    this.filterBandwidthProperty = new NumberProperty(LIGHT_SOURCE_MODEL_SETTINGS.FILTER_BANDWIDTH_DEFAULT, {
      range: BANDWIDTH_RANGE_NM,
      units: "nm",
    });

    this.spectrumProperty = new DerivedProperty(
      [this.sourceTypeProperty, this.filterWavelengthProperty, this.filterBandwidthProperty],
      (type, filterWavelengthNm, filterBandwidthNm) => buildSpectrum(type, filterWavelengthNm, filterBandwidthNm),
    );

    this.groupsProperty = new DerivedProperty([this.spectrumProperty], (spectrum) => spectrum.groups);

    this.coherenceLengthProperty = new DerivedProperty([this.spectrumProperty], (spectrum) =>
      coherenceLength(spectrum.centerNm, spectrum.bandwidthNm),
    );

    this.meanWavelengthProperty = new DerivedProperty([this.spectrumProperty], (spectrum) => spectrum.centerNm);

    this.isFilteredProperty = new DerivedProperty(
      [this.sourceTypeProperty],
      (type) => type === SourceType.FILTERED_LAMP,
    );
  }

  public reset(): void {
    this.sourceTypeProperty.reset();
    this.filterWavelengthProperty.reset();
    this.filterBandwidthProperty.reset();
  }
}

/**
 * Builds the spectrum for a source. Kept as a free function so tests can call it
 * without constructing Properties.
 * @internal Exported for unit tests; not part of the application API.
 */
export function buildSpectrum(type: SourceType, filterWavelengthNm: number, filterBandwidthNm: number): SourceSpectrum {
  if (type === SourceType.SODIUM_LAMP) {
    // Equal weights: the D2 line is genuinely the stronger of the pair, but the
    // textbook demonstration — and the measurement of the doublet spacing —
    // depends on the fringes vanishing completely at the visibility nulls, which
    // only happens when the two lines contribute equally.
    const groups = normalizeWeights([
      { wavelengthNm: SODIUM_D2_WAVELENGTH_NM, bandwidthNm: SODIUM_LINE_BANDWIDTH_NM, weight: 1 },
      { wavelengthNm: SODIUM_D1_WAVELENGTH_NM, bandwidthNm: SODIUM_LINE_BANDWIDTH_NM, weight: 1 },
    ]);
    return {
      groups,
      centerNm: (SODIUM_D1_WAVELENGTH_NM + SODIUM_D2_WAVELENGTH_NM) / 2,
      bandwidthNm: SODIUM_LINE_BANDWIDTH_NM,
      doubletSeparationNm: SODIUM_D1_WAVELENGTH_NM - SODIUM_D2_WAVELENGTH_NM,
    };
  }

  if (type === SourceType.WHITE_LIGHT) {
    return {
      groups: splitLine(
        WHITE_LIGHT_CENTER_NM,
        WHITE_LIGHT_BANDWIDTH_NM,
        BROADBAND_LINE_COUNT,
        BROADBAND_MIN_NM,
        BROADBAND_MAX_NM,
      ),
      centerNm: WHITE_LIGHT_CENTER_NM,
      bandwidthNm: WHITE_LIGHT_BANDWIDTH_NM,
      doubletSeparationNm: 0,
    };
  }

  if (type === SourceType.FILTERED_LAMP) {
    const groupCount =
      filterBandwidthNm <= SINGLE_GROUP_BANDWIDTH_NM
        ? 1
        : Math.min(BROADBAND_LINE_COUNT, Math.ceil(filterBandwidthNm / NM_PER_GROUP));
    return {
      groups: splitLine(filterWavelengthNm, filterBandwidthNm, groupCount, BROADBAND_MIN_NM, BROADBAND_MAX_NM),
      centerNm: filterWavelengthNm,
      bandwidthNm: filterBandwidthNm,
      doubletSeparationNm: 0,
    };
  }

  const laserWavelengthNm =
    type === SourceType.GREEN_LASER
      ? GREEN_LASER_WAVELENGTH_NM
      : type === SourceType.BLUE_LASER
        ? BLUE_LASER_WAVELENGTH_NM
        : HENE_WAVELENGTH_NM;

  return {
    groups: [{ wavelengthNm: laserWavelengthNm, bandwidthNm: LASER_BANDWIDTH_NM, weight: 1 }],
    centerNm: laserWavelengthNm,
    bandwidthNm: LASER_BANDWIDTH_NM,
    doubletSeparationNm: 0,
  };
}
