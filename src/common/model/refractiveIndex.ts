/**
 * refractiveIndex.ts
 *
 * Refractive index of the media a beam can pass through, and the optical path
 * length (OPL) each one adds.
 *
 * The whole simulation reduces to one quantity — the optical path difference
 * between two routes — so every element here answers the same question: how many
 * nanometres of vacuum is this piece of glass or gas worth?
 */

import { AIR_INDEX_STP, STANDARD_PRESSURE_KPA, STANDARD_TEMPERATURE_K } from "../../InterferometryLabConstants.js";
import InterferometryLabNamespace from "../../InterferometryLabNamespace.js";

/**
 * Sellmeier coefficients for Schott N-BK7, the standard borosilicate crown used
 * for beam splitters and sample slides. λ is in micrometres in this formula.
 */
const BK7_TERMS = [
  { b: 1.03961212, c: 0.00600069867 },
  { b: 0.231792344, c: 0.0200179144 },
  { b: 1.01046945, c: 103.560653 },
] as const;

/**
 * Refractive index of N-BK7 glass at the given wavelength, from the three-term
 * Sellmeier equation
 *
 *      n² − 1 = Σᵢ Bᵢ λ² / (λ² − Cᵢ)
 *
 * Dispersion is the point of using the real formula rather than a constant: it
 * is what destroys white-light fringes in an uncompensated Michelson.
 *
 * @param wavelengthNm - vacuum wavelength, nm
 * @internal Exported for unit tests; not part of the application API.
 */
export function bk7Index(wavelengthNm: number): number {
  const um2 = (wavelengthNm / 1000) ** 2;
  let nSquared = 1;
  for (const term of BK7_TERMS) {
    nSquared += (term.b * um2) / (um2 - term.c);
  }
  return Math.sqrt(nSquared);
}

/**
 * Refractive index of a gas at the given pressure and temperature, from the
 * Gladstone-Dale relation: the refractivity (n − 1) of a dilute gas is
 * proportional to its number density, so
 *
 *      n − 1 = (n_STP − 1) · (P / P_STP) · (T_STP / T)
 *
 * This is the law a student verifies by counting fringes while evacuating a
 * cell: N fringes over a cell of length L means n − 1 = N λ / 2L.
 *
 * @param pressureKPa - absolute gas pressure, kPa
 * @param temperatureK - gas temperature, K
 * @param indexAtSTP - index of the gas at 0 °C and 1 atm (defaults to dry air)
 */
export function gasIndex(pressureKPa: number, temperatureK: number, indexAtSTP: number = AIR_INDEX_STP): number {
  const refractivity =
    (indexAtSTP - 1) * (pressureKPa / STANDARD_PRESSURE_KPA) * (STANDARD_TEMPERATURE_K / temperatureK);
  return 1 + refractivity;
}

/**
 * Extra optical path length introduced by inserting a plane-parallel plate into
 * a beam, relative to the empty path it replaces:
 *
 *      ΔOPL(θ) = t · ( √(n² − sin²θ) − cos θ )
 *
 * At normal incidence this is the familiar t(n − 1). Tilting the plate makes the
 * beam take a longer route through it, which is how a sample slide is used to
 * sweep fringes continuously rather than in jumps.
 *
 * @param thicknessNm - plate thickness along its normal, nm
 * @param index - refractive index of the plate
 * @param incidenceRad - angle between the beam and the plate normal, radians
 */
export function plateOpticalPathDelta(thicknessNm: number, index: number, incidenceRad: number): number {
  const sinTheta = Math.sin(incidenceRad);
  const inside = index * index - sinTheta * sinTheta;
  // Total external reflection is impossible for n ≥ 1, but guard the sqrt anyway.
  const transmitted = inside > 0 ? Math.sqrt(inside) : 0;
  return thicknessNm * (transmitted - Math.cos(incidenceRad));
}

/**
 * Optical path length added by a column of gas of the given length, relative to
 * the same length of vacuum.
 *
 * @param lengthNm - geometric length of the gas column, nm
 * @param index - refractive index of the gas
 */
export function mediumOpticalPathDelta(lengthNm: number, index: number): number {
  return lengthNm * (index - 1);
}

/**
 * Dispersive optical path difference left over when a Michelson's beam splitter
 * substrate is *not* compensated.
 *
 * One arm crosses the splitter substrate twice more than the other. The
 * achromatic part of that extra glass is absorbed into where the movable
 * mirror's zero sits — that is exactly what a real operator does when finding
 * the white-light fringe. What cannot be dialled out is the dispersion: n varies
 * across the source's band, so different colours reach zero OPD at different
 * mirror positions and the white-light fringe never forms. Inserting the
 * compensator plate puts identical glass in the other arm and cancels it.
 *
 * @param wavelengthNm - wavelength of the group being evaluated, nm
 * @param referenceNm - the source's mean wavelength, nm (zero by definition here)
 * @param substrateThicknessNm - beam splitter substrate thickness, nm
 */
export function uncompensatedDispersionOpd(
  wavelengthNm: number,
  referenceNm: number,
  substrateThicknessNm: number,
): number {
  return 2 * substrateThicknessNm * (bk7Index(wavelengthNm) - bk7Index(referenceNm));
}

InterferometryLabNamespace.register("refractiveIndex", {
  bk7Index,
  gasIndex,
  plateOpticalPathDelta,
  mediumOpticalPathDelta,
  uncompensatedDispersionOpd,
});
