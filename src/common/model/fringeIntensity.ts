/**
 * fringeIntensity.ts
 *
 * Evaluates a {@link FringeSpec} at a point on the detector.
 *
 * These are the sim's inner-loop functions — the renderer calls them a few tens
 * of thousands of times per frame — but they are also the whole of its physics,
 * so they are kept pure and free of any rendering or Scenery dependency. The
 * unit tests exercise exactly the code the screen runs.
 */

import { BEAM_HALF_WIDTH_NM, RAD_PER_URAD } from "../../InterferometryLabConstants.js";
import InterferometryLabNamespace from "../../InterferometryLabNamespace.js";
import type { FringeGeometry, FringeSpec, MultiBeamTerms, TwoBeamTerms } from "./FringeSpec.js";
import { lineVisibility } from "./spectrum.js";

const TWO_PI = 2 * Math.PI;

/**
 * cos θ for the ray reaching detector point (u, v), where θ is measured from the
 * optical axis. With tan θ = apertureTanTheta · ρ, this is 1/√(1 + tan²θ).
 *
 * The `cos θ` is the entire reason a Michelson shows rings: an off-axis ray
 * crosses the arm difference at a slant, so it sees slightly less of it.
 */
export function axialCosine(geometry: FringeGeometry, u: number, v: number): number {
  const tanTheta = geometry.apertureTanTheta * Math.sqrt(u * u + v * v);
  return 1 / Math.sqrt(1 + tanTheta * tanTheta);
}

/**
 * Optical path difference (nm) at detector point (u, v).
 */
export function opticalPathDifference(geometry: FringeGeometry, u: number, v: number): number {
  return (
    geometry.ringOpdNm * axialCosine(geometry, u, v) +
    geometry.tiltXNm * u +
    geometry.tiltYNm * v +
    geometry.constantOpdNm
  );
}

/**
 * OPD-per-unit-detector-coordinate (nm) introduced by a mirror tilted by the
 * given angle in microradians. A mirror tilted by α deflects the reflected
 * wavefront by 2α, so the path difference across the beam changes by 2α times
 * the beam radius — the wedge that turns circular fringes into straight ones.
 *
 * Used by the two-beam interferometers (Michelson, Mach-Zehnder), which tilt a
 * mirror by the same physics to produce the same wedge term in their
 * FringeGeometry. The Fabry-Pérot does not tilt and passes zero.
 *
 * @param tiltUradians - mirror tilt, µrad
 */
export function tiltWedgeNm(tiltUradians: number): number {
  return 2 * tiltUradians * RAD_PER_URAD * BEAM_HALF_WIDTH_NM;
}

/**
 * Total spread of optical path difference across the detector, nm.
 *
 * This is what decides whether there is a *pattern* at all. Fringes need the
 * path difference to vary by at least a wavelength somewhere on the screen;
 * below that the whole field sits on one fringe and shows a single flat tone,
 * however high the contrast would be. That is the normal state of a
 * well-aligned interferometer at zero path difference, and it surprises people.
 */
export function opdSpread(geometry: FringeGeometry): number {
  // The corner of a square detector is the extreme angle, at ρ = √2.
  const cornerTan = Math.SQRT2 * geometry.apertureTanTheta;
  const cornerCosine = 1 / Math.sqrt(1 + cornerTan * cornerTan);
  return (
    Math.abs(geometry.ringOpdNm) * (1 - cornerCosine) + 2 * Math.abs(geometry.tiltXNm) + 2 * Math.abs(geometry.tiltYNm)
  );
}

/**
 * Intensity of two recombining beams:
 *
 *      I = I_A + I_B + 2 √(I_A I_B) · V · cos δ
 *
 * `visibility` folds together the source's coherence envelope and any blanket
 * contrast loss. When it reaches 0 the cosine vanishes and the two beams simply
 * add their powers — light, but no fringes.
 *
 * @param opdNm - optical path difference at this point, nm
 * @param wavelengthNm - wavelength of the spectral group, nm
 * @param terms - the two routes' intensities and any fixed phase offset
 * @param visibility - fringe contrast at this OPD, 0–1
 */
export function twoBeamIntensity(opdNm: number, wavelengthNm: number, terms: TwoBeamTerms, visibility: number): number {
  const phase = (TWO_PI * opdNm) / wavelengthNm + terms.extraPhaseRad;
  const interference = 2 * Math.sqrt(terms.intensityA * terms.intensityB) * visibility * Math.cos(phase);
  return terms.intensityA + terms.intensityB + interference;
}

/**
 * Peak transmission of a lossy Fabry-Perot cavity, (T / (1 − R))².
 *
 * With absorbing mirrors T = 1 − R − A, so the peaks fall away sharply as R
 * approaches 1 at fixed A: a high-finesse etalon made from lossy coatings is
 * sharp but dim, which is the practical trade-off in real instruments.
 */
export function airyPeakTransmission(reflectance: number, absorptance: number): number {
  const transmittance = Math.max(0, 1 - reflectance - absorptance);
  const denominator = 1 - reflectance;
  if (denominator <= 0) {
    return 0;
  }
  const ratio = transmittance / denominator;
  return ratio * ratio;
}

/**
 * Coefficient of finesse F = 4R/(1 − R)², the sharpness parameter of the Airy
 * distribution. It grows without bound as R → 1.
 */
export function coefficientOfFinesse(reflectance: number): number {
  const denominator = 1 - reflectance;
  return denominator <= 0 ? Number.POSITIVE_INFINITY : (4 * reflectance) / (denominator * denominator);
}

/**
 * Reflective finesse F = π√R/(1 − R): the ratio of peak spacing to peak width,
 * i.e. how many distinguishable positions there are within one free spectral
 * range. This is the number quoted on an etalon's data sheet.
 */
export function reflectiveFinesse(reflectance: number): number {
  const denominator = 1 - reflectance;
  return denominator <= 0 ? Number.POSITIVE_INFINITY : (Math.PI * Math.sqrt(reflectance)) / denominator;
}

/**
 * Transmitted intensity of a Fabry-Perot cavity — the Airy distribution:
 *
 *      I = I_peak / ( 1 + F sin²(δ/2) )
 *
 * Low R gives a broad cos²-like ripple; high R leaves narrow spikes separated by
 * near-darkness, because only wavelengths that survive hundreds of round trips
 * in phase get through.
 *
 * `contrast` interpolates toward the incoherent average, standing in for the
 * finite coherence of the source.
 *
 * @param opdNm - round-trip optical path difference at this point, nm
 * @param wavelengthNm - wavelength of the spectral group, nm
 * @param terms - mirror reflectance, absorptance and any fixed phase offset
 * @param contrast - fringe contrast, 0–1
 */
export function airyIntensity(opdNm: number, wavelengthNm: number, terms: MultiBeamTerms, contrast: number): number {
  const delta = (TWO_PI * opdNm) / wavelengthNm + terms.extraPhaseRad;
  const coefficient = coefficientOfFinesse(terms.reflectance);
  const sine = Math.sin(delta / 2);
  const peak = airyPeakTransmission(terms.reflectance, terms.absorptance);
  const airy = peak / (1 + coefficient * sine * sine);

  if (contrast >= 1) {
    return airy;
  }
  // The incoherent limit: the mean of the Airy function over δ, which is
  // peak / √(1 + F).
  const mean = peak / Math.sqrt(1 + coefficient);
  return mean + contrast * (airy - mean);
}

/**
 * Total intensity at detector point (u, v), summed over the source's spectral
 * groups. Returns the per-group intensities through `out` so the caller can
 * weight them by colour; the return value is the total.
 *
 * @param spec - the pattern description
 * @param u - horizontal detector coordinate, −1 to +1
 * @param v - vertical detector coordinate, −1 to +1
 * @param out - array of at least `spec.groups.length` entries, filled with each
 *              group's weighted intensity
 */
export function intensityAt(spec: FringeSpec, u: number, v: number, out: Float64Array): number {
  const opdNm = opticalPathDifference(spec.geometry, u, v);
  const terms = spec.terms;
  let total = 0;
  let index = 0;

  for (const group of spec.groups) {
    const groupOpdNm = opdNm + group.opdOffsetNm;
    const visibility = spec.contrast * lineVisibility(groupOpdNm, group.wavelengthNm, group.bandwidthNm);
    const intensity =
      terms.kind === "two-beam"
        ? twoBeamIntensity(groupOpdNm, group.wavelengthNm, terms, visibility)
        : airyIntensity(groupOpdNm, group.wavelengthNm, terms, visibility);

    const weighted = intensity * group.weight * spec.exposure;
    out[index++] = weighted;
    total += weighted;
  }

  return total;
}

/**
 * Intensity on the optical axis — the value a point detector at the centre of
 * the pattern would read. Screens use this for their numeric readouts and, in
 * the Mach-Zehnder, to decide where single photons land.
 */
function axialIntensity(spec: FringeSpec): number {
  const scratch = new Float64Array(spec.groups.length);
  return intensityAt(spec, 0, 0, scratch);
}

/**
 * Intensity along a horizontal cut through the centre of the detector: `v = 0`,
 * `u` running −1 to +1, sampled at pixel centres the same way the renderer
 * samples its grid.
 *
 * This is the trace a slit detector scanned across the pattern would record, and
 * it is what turns the image into a measurement — the depth of the modulation
 * *is* the visibility, and the number of ripples *is* the fringe count. It lives
 * here rather than in the plotting node so that it stays a pure function of a
 * {@link FringeSpec}, testable without a canvas, like the rest of the physics.
 *
 * @param spec - the pattern description
 * @param sampleCount - number of points across the detector
 * @param out - optional buffer of at least `sampleCount` entries to fill
 * @returns the filled buffer
 */
export function intensityProfile(spec: FringeSpec, sampleCount: number, out?: Float64Array): Float64Array {
  const result = out && out.length >= sampleCount ? out : new Float64Array(sampleCount);
  const scratch = new Float64Array(spec.groups.length);

  for (let i = 0; i < sampleCount; i++) {
    const u = (2 * (i + 0.5)) / sampleCount - 1;
    result[i] = intensityAt(spec, u, 0, scratch);
  }

  return result;
}

InterferometryLabNamespace.register("fringeIntensity", {
  axialCosine,
  opticalPathDifference,
  tiltWedgeNm,
  opdSpread,
  twoBeamIntensity,
  airyPeakTransmission,
  coefficientOfFinesse,
  reflectiveFinesse,
  airyIntensity,
  intensityAt,
  axialIntensity,
  intensityProfile,
});
