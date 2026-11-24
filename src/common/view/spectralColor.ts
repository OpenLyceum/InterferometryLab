import { roundSymmetric } from "scenerystack/dot";

/**
 * spectralColor.ts
 *
 * Converts wavelengths to colour, and adds them up the way light actually adds.
 *
 * ── Why not just look up an sRGB value per wavelength ─────────────────────────
 * Because the sim adds colours together. A white-light interferogram is the sum
 * of fifteen overlapping single-wavelength patterns, and two things go wrong if
 * that sum is done on sRGB triples:
 *
 *  1. sRGB is gamma-encoded. Adding encoded values is not the same as adding
 *     light; the result is systematically too bright in the mid-tones and the
 *     fringe contrast comes out wrong.
 *  2. Summing per-wavelength sRGB approximations across the visible band does
 *     not produce white. It produces a yellow-green, because the approximations
 *     are clipped renderings of saturated colours rather than the tristimulus
 *     responses that are additive by construction.
 *
 * So this module works in CIE XYZ, where the whole point of the space is that
 * tristimulus values add linearly. Each wavelength contributes its colour
 * matching functions, the sum converts once to linear sRGB, and the gamma
 * encoding happens last — at the pixel.
 *
 * The colour matching functions are the multi-lobe Gaussian fits from Wyman,
 * Sloan & Shirley, "Simple Analytic Approximations to the CIE XYZ Color Matching
 * Functions" (JCGT 2013), accurate to well under a percent across the visible
 * band and far cheaper than a table lookup.
 */

/** A single Gaussian lobe, skewed by having a different width on each side. */
function lobe(x: number, alpha: number, mu: number, sigma1: number, sigma2: number): number {
  const t = (x - mu) * (x < mu ? 1 / sigma1 : 1 / sigma2);
  return alpha * Math.exp(-0.5 * t * t);
}

/** CIE 1931 x̄ colour matching function. */
function xBar(nm: number): number {
  return lobe(nm, 1.056, 599.8, 37.9, 31.0) + lobe(nm, 0.362, 442.0, 16.0, 26.7) + lobe(nm, -0.065, 501.1, 20.4, 26.2);
}

/** CIE 1931 ȳ colour matching function. */
function yBar(nm: number): number {
  return lobe(nm, 0.821, 568.8, 46.9, 40.5) + lobe(nm, 0.286, 530.9, 16.3, 31.1);
}

/** CIE 1931 z̄ colour matching function. */
function zBar(nm: number): number {
  return lobe(nm, 1.217, 437.0, 11.8, 36.0) + lobe(nm, 0.681, 459.0, 26.0, 13.8);
}

/**
 * Linear sRGB of an equal-energy spectrum.
 *
 * sRGB's white point is D65, not the flat spectrum a broadband lamp is modelled
 * as, so a flat spectrum lands slightly off-white. Dividing each channel by this
 * reference adapts the result to an equal-energy white — the same trick as a
 * camera's white balance, and the reason the broadband source in this sim comes
 * out white rather than straw-coloured.
 */
const EQUAL_ENERGY_RGB = [1.2044, 0.9484, 0.9088] as const;

/**
 * Linear sRGB for a single wavelength, adapted to an equal-energy white and
 * scaled so the brightest channel of a saturated colour reaches 1.
 *
 * Negative components — wavelengths outside the sRGB gamut, which is most of the
 * cyan region — are clipped to zero. That desaturates those colours slightly;
 * there is no way to show them on a normal display, and clipping is what every
 * spectrum rendering does.
 */
export function wavelengthToLinearRgb(nm: number): readonly [number, number, number] {
  const x = xBar(nm);
  const y = yBar(nm);
  const z = zBar(nm);

  // CIE XYZ to linear sRGB (IEC 61966-2-1).
  const r = 3.2406 * x - 1.5372 * y - 0.4986 * z;
  const g = -0.9689 * x + 1.8758 * y + 0.0415 * z;
  const b = 0.0557 * x - 0.204 * y + 1.057 * z;

  return [
    Math.max(0, r) / EQUAL_ENERGY_RGB[0],
    Math.max(0, g) / EQUAL_ENERGY_RGB[1],
    Math.max(0, b) / EQUAL_ENERGY_RGB[2],
  ];
}

/** Resolution of the linear-to-sRGB encoding table. */
const GAMMA_TABLE_SIZE = 1024;

/**
 * Lookup table for the sRGB transfer function, so the per-pixel path never calls
 * Math.pow. The table is indexed by linear intensity and holds the 0–255 byte.
 */
const gammaTable = ((): Uint8Array => {
  const table = new Uint8Array(GAMMA_TABLE_SIZE + 1);
  for (let i = 0; i <= GAMMA_TABLE_SIZE; i++) {
    const linear = i / GAMMA_TABLE_SIZE;
    const encoded = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
    table[i] = roundSymmetric(255 * Math.min(1, Math.max(0, encoded)));
  }
  return table;
})();

/**
 * Encodes a linear light value (0–1, values above 1 clipped) as an sRGB byte.
 */
export function encodeSrgb(linear: number): number {
  if (linear <= 0) {
    return 0;
  }
  if (linear >= 1) {
    return 255;
  }
  return gammaTable[(linear * GAMMA_TABLE_SIZE) | 0] ?? 0;
}
