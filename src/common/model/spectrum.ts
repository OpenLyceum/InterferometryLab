/**
 * spectrum.ts
 *
 * Pure spectral maths: how a source's finite linewidth turns into a coherence
 * length, and how a continuous spectrum is discretized for rendering.
 *
 * ── Why a source has a coherence length ───────────────────────────────────────
 * A perfectly monochromatic wave interferes with a delayed copy of itself no
 * matter how large the delay. A real source carries a spread of wavelengths, and
 * each wavelength accumulates a different phase over the same optical path
 * difference (OPD). Beyond some OPD the individual patterns are shifted enough
 * relative to one another that their sum washes out.
 *
 * For a Gaussian spectral line of centre λ₀ and full width at half maximum Δλ,
 * the modulus of the complex degree of coherence is itself a Gaussian in the OPD:
 *
 *      V(Δ) = exp( −σ_k² Δ² / 2 ),     σ_k = 2π σ_λ / λ₀²,   σ_λ = Δλ / 2√(2 ln 2)
 *
 * V is the fringe visibility (I_max − I_min)/(I_max + I_min). It falls to 1/e at
 * Δ ≈ 0.53 λ₀²/Δλ and to about 3 % at Δ = λ₀²/Δλ, which is why λ₀²/Δλ is quoted
 * as *the* coherence length: it is the path difference by which the fringes have
 * effectively gone, not merely faded.
 *
 * ── Discretizing a broadband source ───────────────────────────────────────────
 * A white-light source is represented as a handful of adjacent Gaussian groups
 * that tile the visible band, each carrying its own colour and its own analytic
 * visibility envelope. Summing groups (rather than summing bare monochromatic
 * lines) matters: a finite set of monochromatic lines is periodic in Δ, so its
 * fringes would revive at large OPD. Groups with the correct width do not — each
 * one damps on its own, so the total envelope decays once and stays decayed.
 */

import InterferometryLabNamespace from "../../InterferometryLabNamespace.js";

/** 2√(2 ln 2) — converts a Gaussian FWHM to a standard deviation. */
const FWHM_TO_SIGMA = 2 * Math.sqrt(2 * Math.LN2);

/** Half-width, in standard deviations, of the sampled span of a narrow line. */
const SAMPLE_HALF_SPAN_SIGMA = 2.2;

/**
 * A Gaussian slice of a source's spectrum. The renderer evaluates one
 * interference pattern per group and adds the results.
 */
export type SpectralGroup = {
  /** Centre wavelength in vacuum, nm. */
  readonly wavelengthNm: number;
  /** Full width at half maximum of this group, nm. Zero means monochromatic. */
  readonly bandwidthNm: number;
  /** Relative optical power. Weights across a source's groups sum to 1. */
  readonly weight: number;
};

/**
 * Standard deviation in wavelength (nm) of a line with the given FWHM.
 */
export function fwhmToSigma(fwhmNm: number): number {
  return fwhmNm / FWHM_TO_SIGMA;
}

/**
 * Standard deviation in angular wavenumber (rad/nm) of a Gaussian line.
 * Uses the narrow-band relation |dk/dλ| = 2π/λ², which is exact to first order
 * and better than 0.1 % for every line this sim can produce.
 */
export function spectralSigmaK(centerNm: number, fwhmNm: number): number {
  return (2 * Math.PI * fwhmToSigma(fwhmNm)) / (centerNm * centerNm);
}

/**
 * Fringe visibility of a single Gaussian line at the given optical path
 * difference: the Gaussian envelope that multiplies the cosine term.
 *
 * @param opdNm - optical path difference, nm (sign is irrelevant)
 * @param centerNm - centre wavelength, nm
 * @param fwhmNm - spectral full width at half maximum, nm
 */
export function lineVisibility(opdNm: number, centerNm: number, fwhmNm: number): number {
  if (fwhmNm <= 0) {
    return 1;
  }
  const sigmaK = spectralSigmaK(centerNm, fwhmNm);
  const exponent = -0.5 * sigmaK * sigmaK * opdNm * opdNm;
  // exp() underflows to 0 well before this matters; the guard just avoids the call.
  return exponent < -50 ? 0 : Math.exp(exponent);
}

/**
 * Coherence length L_c = λ₀²/Δλ, nm — the practical limit on how far the arms may
 * differ before the fringes are gone. Visibility is down to about 3 % here,
 * having passed 1/e at roughly half this distance.
 *
 * Returns Infinity for a strictly monochromatic line.
 */
export function coherenceLength(centerNm: number, fwhmNm: number): number {
  return fwhmNm <= 0 ? Number.POSITIVE_INFINITY : (centerNm * centerNm) / fwhmNm;
}

/**
 * Visibility of an equal-weight doublet (two lines separated by δλ) as a
 * function of OPD: the classic |cos(π Δ δλ / λ₀²)| beat that makes Michelson
 * fringes vanish and revive periodically. Provided for readouts and tests; the
 * renderer gets the same result by summing the two lines.
 *
 * @param opdNm - optical path difference, nm
 * @param centerNm - mean wavelength of the pair, nm
 * @param separationNm - wavelength difference between the lines, nm
 */
export function doubletVisibility(opdNm: number, centerNm: number, separationNm: number): number {
  return Math.abs(Math.cos((Math.PI * opdNm * separationNm) / (centerNm * centerNm)));
}

/**
 * Splits a Gaussian line into `count` adjacent groups that tile it.
 *
 * Each group is centred on its own slice of the line and given the slice's
 * width, so the groups reassemble the original line rather than sampling it at
 * isolated points. `clampRange` trims the span to the detectable band (there is
 * no point rendering ultraviolet groups).
 *
 * @param centerNm - centre wavelength, nm
 * @param fwhmNm - full width at half maximum, nm
 * @param count - number of groups; 1 returns the line unchanged
 * @param minNm - lower wavelength bound of the sampled span, nm
 * @param maxNm - upper wavelength bound of the sampled span, nm
 */
export function splitLine(
  centerNm: number,
  fwhmNm: number,
  count: number,
  minNm: number,
  maxNm: number,
): SpectralGroup[] {
  if (count <= 1 || fwhmNm <= 0) {
    return [{ wavelengthNm: centerNm, bandwidthNm: fwhmNm, weight: 1 }];
  }

  const sigma = fwhmToSigma(fwhmNm);
  const lo = Math.max(minNm, centerNm - SAMPLE_HALF_SPAN_SIGMA * sigma);
  const hi = Math.min(maxNm, centerNm + SAMPLE_HALF_SPAN_SIGMA * sigma);
  if (hi <= lo) {
    return [{ wavelengthNm: centerNm, bandwidthNm: fwhmNm, weight: 1 }];
  }

  const sliceWidth = (hi - lo) / count;
  const groups: SpectralGroup[] = [];
  let total = 0;

  for (let i = 0; i < count; i++) {
    const wavelengthNm = lo + sliceWidth * (i + 0.5);
    const z = (wavelengthNm - centerNm) / sigma;
    const weight = Math.exp(-0.5 * z * z);
    total += weight;
    // Each slice is itself Gaussian-ish; give it the FWHM its width implies so the
    // groups' envelopes add up to the parent line's envelope instead of reviving.
    groups.push({ wavelengthNm, bandwidthNm: sliceWidth * FWHM_TO_SIGMA * 0.5, weight });
  }

  return groups.map((group) => ({ ...group, weight: group.weight / total }));
}

/**
 * Rescales a set of groups so their weights sum to 1. Used when several lines
 * (e.g. the two sodium D lines) are concatenated into one source spectrum.
 */
export function normalizeWeights(groups: readonly SpectralGroup[]): SpectralGroup[] {
  const total = groups.reduce((sum, group) => sum + group.weight, 0);
  if (total <= 0) {
    return groups.map((group) => ({ ...group, weight: 1 / Math.max(1, groups.length) }));
  }
  return groups.map((group) => ({ ...group, weight: group.weight / total }));
}

/** Power-weighted mean wavelength (nm) of a spectrum. */
export function meanWavelength(groups: readonly SpectralGroup[]): number {
  const total = groups.reduce((sum, group) => sum + group.weight, 0);
  if (total <= 0) {
    return 0;
  }
  return groups.reduce((sum, group) => sum + group.weight * group.wavelengthNm, 0) / total;
}

/**
 * Overall fringe visibility of a whole spectrum at a given OPD: the amplitude of
 * the summed cosine terms, normalized by total power. This is what the on-screen
 * visibility readout reports.
 *
 * Each group contributes weight · V_group(Δ) · cos(2πΔ/λ_group); the resultant
 * amplitude is the modulus of their phasor sum. Renderable groups may carry a
 * dispersive OPD offset, which affects both their phase and coherence envelope.
 */
export function spectrumVisibility(
  groups: readonly (SpectralGroup & { readonly opdOffsetNm?: number })[],
  opdNm: number,
): number {
  let real = 0;
  let imaginary = 0;
  let total = 0;

  for (const group of groups) {
    const groupOpdNm = opdNm + (group.opdOffsetNm ?? 0);
    const envelope = group.weight * lineVisibility(groupOpdNm, group.wavelengthNm, group.bandwidthNm);
    const phase = (2 * Math.PI * groupOpdNm) / group.wavelengthNm;
    real += envelope * Math.cos(phase);
    imaginary += envelope * Math.sin(phase);
    total += group.weight;
  }

  return total > 0 ? Math.hypot(real, imaginary) / total : 0;
}

InterferometryLabNamespace.register("spectrum", {
  fwhmToSigma,
  spectralSigmaK,
  lineVisibility,
  coherenceLength,
  doubletVisibility,
  splitLine,
  normalizeWeights,
  meanWavelength,
  spectrumVisibility,
});
