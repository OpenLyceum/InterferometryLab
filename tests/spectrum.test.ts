/**
 * spectrum.test.ts
 *
 * The coherence maths: how a source's linewidth limits how far the arms can
 * differ before the fringes wash out.
 */

import { describe, expect, it } from "vitest";
import {
  coherenceLength,
  doubletVisibility,
  fwhmToSigma,
  lineVisibility,
  meanWavelength,
  normalizeWeights,
  spectralSigmaK,
  spectrumVisibility,
  splitLine,
} from "../src/common/model/spectrum.js";

describe("Gaussian line widths", () => {
  it("converts FWHM to standard deviation", () => {
    // FWHM = 2√(2 ln 2) σ ≈ 2.3548 σ
    expect(fwhmToSigma(2.3548)).toBeCloseTo(1, 4);
  });

  it("relates wavelength spread to wavenumber spread by 2π/λ²", () => {
    const centerNm = 600;
    const fwhmNm = 10;
    const expected = (2 * Math.PI * fwhmToSigma(fwhmNm)) / (centerNm * centerNm);
    expect(spectralSigmaK(centerNm, fwhmNm)).toBeCloseTo(expected, 12);
  });
});

describe("lineVisibility", () => {
  it("is 1 at zero path difference", () => {
    expect(lineVisibility(0, 600, 10)).toBeCloseTo(1, 12);
  });

  it("is 1 everywhere for a monochromatic line", () => {
    expect(lineVisibility(1e9, 600, 0)).toBe(1);
  });

  it("falls monotonically as the path difference grows", () => {
    const at = (opd: number) => lineVisibility(opd, 600, 10);
    expect(at(1000)).toBeLessThan(at(0));
    expect(at(5000)).toBeLessThan(at(1000));
    expect(at(20000)).toBeLessThan(at(5000));
  });

  it("is even in the path difference", () => {
    expect(lineVisibility(-3000, 600, 10)).toBeCloseTo(lineVisibility(3000, 600, 10), 12);
  });

  it("passes 1/e at about half a coherence length", () => {
    const centerNm = 600;
    const fwhmNm = 10;
    const halfCoherence = 0.53 * coherenceLength(centerNm, fwhmNm);
    expect(lineVisibility(halfCoherence, centerNm, fwhmNm)).toBeCloseTo(1 / Math.E, 2);
  });

  it("is all but gone at one full coherence length", () => {
    const centerNm = 600;
    const fwhmNm = 10;
    const visibility = lineVisibility(coherenceLength(centerNm, fwhmNm), centerNm, fwhmNm);
    expect(visibility).toBeLessThan(0.05);
  });

  it("is wider for a narrower line", () => {
    const opd = 50_000;
    expect(lineVisibility(opd, 600, 0.1)).toBeGreaterThan(lineVisibility(opd, 600, 1));
  });
});

describe("coherenceLength", () => {
  it("is λ²/Δλ", () => {
    expect(coherenceLength(600, 10)).toBeCloseTo(36_000, 6);
  });

  it("is infinite for a monochromatic source", () => {
    expect(coherenceLength(600, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it("is about a micrometre for white light", () => {
    // 550 nm centre, 300 nm wide — the reason white-light fringes only exist
    // within a wavelength or two of zero path difference.
    expect(coherenceLength(550, 300)).toBeGreaterThan(800);
    expect(coherenceLength(550, 300)).toBeLessThan(1200);
  });
});

describe("doubletVisibility", () => {
  const centerNm = 589.3;
  const separationNm = 0.597;

  it("is 1 at zero path difference", () => {
    expect(doubletVisibility(0, centerNm, separationNm)).toBeCloseTo(1, 12);
  });

  it("vanishes at odd multiples of λ²/2δλ", () => {
    const firstNull = (centerNm * centerNm) / (2 * separationNm);
    expect(doubletVisibility(firstNull, centerNm, separationNm)).toBeCloseTo(0, 10);
    expect(doubletVisibility(3 * firstNull, centerNm, separationNm)).toBeCloseTo(0, 10);
  });

  it("revives at even multiples", () => {
    const firstNull = (centerNm * centerNm) / (2 * separationNm);
    expect(doubletVisibility(2 * firstNull, centerNm, separationNm)).toBeCloseTo(1, 10);
  });
});

describe("splitLine", () => {
  it("returns the line unchanged when asked for one group", () => {
    const groups = splitLine(550, 300, 1, 390, 710);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.wavelengthNm).toBe(550);
  });

  it("returns weights that sum to 1", () => {
    const groups = splitLine(550, 300, 15, 390, 710);
    const total = groups.reduce((sum, group) => sum + group.weight, 0);
    expect(total).toBeCloseTo(1, 12);
  });

  it("keeps every group inside the requested band", () => {
    for (const group of splitLine(550, 300, 15, 390, 710)) {
      expect(group.wavelengthNm).toBeGreaterThanOrEqual(390);
      expect(group.wavelengthNm).toBeLessThanOrEqual(710);
    }
  });

  it("weights the centre of the line most heavily", () => {
    const groups = splitLine(550, 100, 9, 390, 710);
    const heaviest = groups.reduce((best, group) => (group.weight > best.weight ? group : best));
    expect(Math.abs(heaviest.wavelengthNm - 550)).toBeLessThan(15);
  });

  it("gives each group a width matching its slice, so the groups tile the line", () => {
    const groups = splitLine(550, 100, 10, 390, 710);
    for (const group of groups) {
      expect(group.bandwidthNm).toBeGreaterThan(0);
      expect(group.bandwidthNm).toBeLessThan(100);
    }
  });
});

describe("normalizeWeights", () => {
  it("rescales weights to sum to 1", () => {
    const groups = normalizeWeights([
      { wavelengthNm: 500, bandwidthNm: 1, weight: 3 },
      { wavelengthNm: 600, bandwidthNm: 1, weight: 1 },
    ]);
    expect(groups[0]?.weight).toBeCloseTo(0.75, 12);
    expect(groups[1]?.weight).toBeCloseTo(0.25, 12);
  });
});

describe("meanWavelength", () => {
  it("is the power-weighted mean", () => {
    const mean = meanWavelength([
      { wavelengthNm: 500, bandwidthNm: 0, weight: 0.25 },
      { wavelengthNm: 600, bandwidthNm: 0, weight: 0.75 },
    ]);
    expect(mean).toBeCloseTo(575, 10);
  });
});

describe("spectrumVisibility", () => {
  it("is 1 at zero path difference for any spectrum", () => {
    const groups = splitLine(550, 300, 15, 390, 710);
    expect(spectrumVisibility(groups, 0)).toBeCloseTo(1, 10);
  });

  it("matches the single-line envelope for a single group", () => {
    const groups = [{ wavelengthNm: 600, bandwidthNm: 10, weight: 1 }];
    expect(spectrumVisibility(groups, 4000)).toBeCloseTo(lineVisibility(4000, 600, 10), 10);
  });

  it("cancels equal monochromatic groups whose offsets differ by half a wavelength", () => {
    const groups = [
      { wavelengthNm: 600, bandwidthNm: 0, weight: 0.5, opdOffsetNm: 0 },
      { wavelengthNm: 600, bandwidthNm: 0, weight: 0.5, opdOffsetNm: 300 },
    ];
    expect(spectrumVisibility(groups, 0)).toBeCloseTo(0, 12);
  });

  it("applies an OPD offset to the coherence envelope as well as the phase", () => {
    const groups = [{ wavelengthNm: 600, bandwidthNm: 10, weight: 1, opdOffsetNm: -4000 }];
    expect(spectrumVisibility(groups, 4000)).toBeCloseTo(1, 10);
    expect(spectrumVisibility(groups, 0)).toBeCloseTo(lineVisibility(4000, 600, 10), 10);
  });

  it("reproduces the doublet beat for two equal narrow lines", () => {
    const centerNm = 589.3;
    const separationNm = 0.597;
    const groups = [
      { wavelengthNm: centerNm - separationNm / 2, bandwidthNm: 0, weight: 0.5 },
      { wavelengthNm: centerNm + separationNm / 2, bandwidthNm: 0, weight: 0.5 },
    ];
    const firstNull = (centerNm * centerNm) / (2 * separationNm);
    expect(spectrumVisibility(groups, firstNull)).toBeLessThan(0.02);
    expect(spectrumVisibility(groups, 2 * firstNull)).toBeGreaterThan(0.98);
  });

  it("decays for a broadband source and does not revive", () => {
    const groups = splitLine(550, 300, 15, 390, 710);
    // Well beyond the coherence length the fringes must stay gone; a spectrum
    // sampled as bare monochromatic lines would show spurious revivals here.
    for (let opd = 5000; opd <= 60_000; opd += 2500) {
      expect(spectrumVisibility(groups, opd)).toBeLessThan(0.05);
    }
  });
});
