/**
 * interferometerModels.test.ts
 *
 * The three screen models: that their derived quantities agree with the physics,
 * that the controls move what they claim to move, and that Reset All really does
 * put everything back.
 */

import { describe, expect, it } from "vitest";
import { intensityAt, reflectiveFinesse } from "../src/common/model/fringeIntensity.js";
import { buildSpectrum } from "../src/common/model/LightSourceModel.js";
import { gasIndex } from "../src/common/model/refractiveIndex.js";
import { SourceType } from "../src/common/model/SourceType.js";
import { spectrumVisibility } from "../src/common/model/spectrum.js";
import { FabryPerotModel } from "../src/fabry-perot/model/FabryPerotModel.js";
import {
  GAS_CELL_LENGTH_NM,
  HENE_WAVELENGTH_NM,
  MICHELSON_COARSE_RANGE_NM,
  NM_PER_UM,
  STANDARD_PRESSURE_KPA,
} from "../src/InterferometryLabConstants.js";
import { BeamMode } from "../src/mach-zehnder/model/BeamMode.js";
import { MachZehnderModel } from "../src/mach-zehnder/model/MachZehnderModel.js";
import { MichelsonModel } from "../src/michelson/model/MichelsonModel.js";

describe("buildSpectrum", () => {
  it("gives a laser a single line at its own wavelength", () => {
    const spectrum = buildSpectrum(SourceType.HELIUM_NEON, 550, 10);
    expect(spectrum.groups).toHaveLength(1);
    expect(spectrum.groups[0]?.wavelengthNm).toBeCloseTo(HENE_WAVELENGTH_NM, 6);
  });

  it("gives lasers a coherence length of metres, not micrometres", () => {
    const spectrum = buildSpectrum(SourceType.HELIUM_NEON, 550, 10);
    // λ²/Δλ with Δλ = 0.002 nm is about 200 mm.
    expect((spectrum.centerNm * spectrum.centerNm) / spectrum.bandwidthNm).toBeGreaterThan(1e8);
  });

  it("gives the sodium lamp two equally weighted lines about 0.6 nm apart", () => {
    const spectrum = buildSpectrum(SourceType.SODIUM_LAMP, 550, 10);
    expect(spectrum.groups).toHaveLength(2);
    expect(spectrum.groups[0]?.weight).toBeCloseTo(0.5, 10);
    expect(spectrum.doubletSeparationNm).toBeCloseTo(0.597, 3);
  });

  it("puts the sodium lamp's first visibility null inside the mirror's travel", () => {
    // What the Michelson's visibility curve is there to show. The D lines beat
    // rather than decay, with the first null at λ₀²/2δλ ≈ 291 µm of path
    // difference and a full revival at twice that. Both have to be reachable, or
    // the classic measurement of the doublet spacing cannot be done on this
    // screen at all: the stage travels ±0.2 mm, worth ±0.4 mm of path difference.
    const spectrum = buildSpectrum(SourceType.SODIUM_LAMP, 550, 10);
    const firstNullNm = (spectrum.centerNm * spectrum.centerNm) / (2 * spectrum.doubletSeparationNm);

    expect(firstNullNm).toBeLessThan(2 * MICHELSON_COARSE_RANGE_NM.max);
    expect(spectrumVisibility(spectrum.groups, firstNullNm)).toBeLessThan(0.05);
    expect(spectrumVisibility(spectrum.groups, 2 * firstNullNm)).toBeGreaterThan(0.9);
  });

  it("splits white light into many groups spanning the visible band", () => {
    const spectrum = buildSpectrum(SourceType.WHITE_LIGHT, 550, 10);
    expect(spectrum.groups.length).toBeGreaterThan(5);
    const wavelengths = spectrum.groups.map((group) => group.wavelengthNm);
    expect(Math.min(...wavelengths)).toBeLessThan(470);
    expect(Math.max(...wavelengths)).toBeGreaterThan(630);
  });

  it("keeps a narrow filtered lamp as one group and splits a wide one", () => {
    expect(buildSpectrum(SourceType.FILTERED_LAMP, 550, 2).groups).toHaveLength(1);
    expect(buildSpectrum(SourceType.FILTERED_LAMP, 550, 50).groups.length).toBeGreaterThan(1);
  });
});

describe("MichelsonModel", () => {
  it("doubles the mirror displacement into the path difference", () => {
    const model = new MichelsonModel();
    model.coarseOffsetProperty.value = 1000;
    model.fineOffsetProperty.value = 250;
    expect(model.mirrorOffsetProperty.value).toBeCloseTo(1250, 10);
    expect(model.pathDifferenceProperty.value).toBeCloseTo(2500, 10);
  });

  it("splits the path difference into the mirror's contribution and the cell's", () => {
    const model = new MichelsonModel();
    model.coarseOffsetProperty.value = 1000;
    model.fineOffsetProperty.value = 0;
    model.gasCellEnabledProperty.value = true;

    // The two labelled contributions are the whole of the path difference.
    expect(model.mirrorPathProperty.value).toBeCloseTo(2000, 10);
    expect(model.pathDifferenceProperty.value).toBeCloseTo(
      model.mirrorPathProperty.value + model.gasCellOpdProperty.value,
      10,
    );
  });

  it("zeroes the arms when asked", () => {
    const model = new MichelsonModel();
    model.coarseOffsetProperty.value = 50_000;
    model.fineOffsetProperty.value = 900;
    model.zeroTheArms();
    expect(model.pathDifferenceProperty.value).toBeCloseTo(0, 10);
  });

  it("counts fringes from wherever the counter was last zeroed", () => {
    const model = new MichelsonModel();
    model.zeroTheArms();
    model.resetFringeCount();
    expect(model.fringeCountProperty.value).toBeCloseTo(0, 10);

    // Half a wavelength of mirror travel is one whole fringe, because the light
    // makes the trip twice.
    model.fineOffsetProperty.value = HENE_WAVELENGTH_NM / 2;
    expect(model.fringeCountProperty.value).toBeCloseTo(1, 6);

    model.fineOffsetProperty.value = 5 * (HENE_WAVELENGTH_NM / 2);
    expect(model.fringeCountProperty.value).toBeCloseTo(5, 6);
  });

  it("adds nothing while the gas cell is out of the beam", () => {
    const model = new MichelsonModel();
    model.zeroTheArms();
    expect(model.gasCellOpdProperty.value).toBe(0);
    expect(model.pathDifferenceProperty.value).toBeCloseTo(0, 10);
  });

  it("counts the gas cell twice, once each way", () => {
    const model = new MichelsonModel();
    model.zeroTheArms();
    model.gasCellEnabledProperty.value = true;
    model.gasCellPressureProperty.value = STANDARD_PRESSURE_KPA;

    const index = model.gasIndexProperty.value;
    expect(model.gasCellOpdProperty.value).toBeCloseTo(2 * GAS_CELL_LENGTH_NM * (index - 1), 6);
  });

  it("shifts no fringes with the cell evacuated", () => {
    const model = new MichelsonModel();
    model.gasCellEnabledProperty.value = true;
    model.gasCellPressureProperty.value = 0;
    expect(model.gasIndexProperty.value).toBe(1);
    expect(model.gasCellFringeShiftProperty.value).toBeCloseTo(0, 10);
  });

  it("tracks the gas index against the Gladstone-Dale law", () => {
    const model = new MichelsonModel();
    model.gasCellPressureProperty.value = 50;
    expect(model.gasIndexProperty.value).toBeCloseTo(gasIndex(50, 293.15), 12);
  });

  it("has full visibility with a laser and none with white light far from zero", () => {
    const model = new MichelsonModel();
    model.zeroTheArms();
    model.coarseOffsetProperty.value = 50_000;
    expect(model.visibilityProperty.value).toBeGreaterThan(0.99);

    // 100 µm of path difference is a hundred times white light's coherence
    // length, so nothing survives.
    model.lightSource.sourceTypeProperty.value = SourceType.WHITE_LIGHT;
    expect(model.visibilityProperty.value).toBeLessThan(0.01);
  });

  it("puts the tilt into the fringe geometry and nowhere else", () => {
    const model = new MichelsonModel();
    model.tiltHorizontalProperty.value = 100;
    const geometry = model.fringeSpecProperty.value.geometry;
    expect(Math.abs(geometry.tiltXNm)).toBeGreaterThan(0);
    expect(geometry.tiltYNm).toBeCloseTo(0, 10);
    // Tilting a mirror must not change the on-axis path difference.
    expect(model.pathDifferenceProperty.value).toBeCloseTo(2 * model.mirrorOffsetProperty.value, 10);
  });

  it("applies no dispersion offset with the compensator in", () => {
    const model = new MichelsonModel();
    model.lightSource.sourceTypeProperty.value = SourceType.WHITE_LIGHT;
    model.compensatorPlateProperty.value = true;
    for (const group of model.fringeSpecProperty.value.groups) {
      expect(group.opdOffsetNm).toBe(0);
    }
  });

  it("spreads the colours apart with the compensator out", () => {
    const model = new MichelsonModel();
    model.lightSource.sourceTypeProperty.value = SourceType.WHITE_LIGHT;
    model.compensatorPlateProperty.value = false;
    const offsets = model.fringeSpecProperty.value.groups.map((group) => group.opdOffsetNm);
    const spread = Math.max(...offsets) - Math.min(...offsets);
    // Far beyond white light's micrometre of coherence, so no fringe survives.
    expect(spread).toBeGreaterThan(10_000);
  });

  it("reports the visibility loss when white light is uncompensated", () => {
    const model = new MichelsonModel();
    model.zeroTheArms();
    model.lightSource.sourceTypeProperty.value = SourceType.WHITE_LIGHT;
    expect(model.visibilityProperty.value).toBeCloseTo(1, 10);

    model.compensatorPlateProperty.value = false;
    expect(model.visibilityProperty.value).toBeLessThan(0.1);

    model.compensatorPlateProperty.value = true;
    expect(model.visibilityProperty.value).toBeCloseTo(1, 10);
  });

  it("restores every control on reset", () => {
    const model = new MichelsonModel();
    const before = {
      coarse: model.coarseOffsetProperty.value,
      tilt: model.tiltHorizontalProperty.value,
      pressure: model.gasCellPressureProperty.value,
    };

    model.coarseOffsetProperty.value = 90_000;
    model.fineOffsetProperty.value = 1500;
    model.tiltHorizontalProperty.value = 200;
    model.gasCellEnabledProperty.value = true;
    model.gasCellPressureProperty.value = 12;
    model.compensatorPlateProperty.value = false;
    model.lightSource.sourceTypeProperty.value = SourceType.WHITE_LIGHT;

    model.reset();

    expect(model.coarseOffsetProperty.value).toBe(before.coarse);
    expect(model.fineOffsetProperty.value).toBe(0);
    expect(model.tiltHorizontalProperty.value).toBe(before.tilt);
    expect(model.gasCellEnabledProperty.value).toBe(false);
    expect(model.gasCellPressureProperty.value).toBe(before.pressure);
    expect(model.compensatorPlateProperty.value).toBe(true);
    expect(model.lightSource.sourceTypeProperty.value).toBe(SourceType.HELIUM_NEON);
  });
});

describe("MachZehnderModel", () => {
  it("sends all the light to one port when the arms match", () => {
    const model = new MachZehnderModel();
    expect(model.pathDifferenceProperty.value).toBeCloseTo(0, 10);
    expect(model.portAFractionProperty.value).toBeCloseTo(1, 2);
    expect(model.portBFractionProperty.value).toBeCloseTo(0, 2);
  });

  it("conserves the light between the two ports at every path difference", () => {
    const model = new MachZehnderModel();
    for (const imbalance of [0, 79, 158, 237, 316, 500, 1234]) {
      model.pathImbalanceProperty.value = imbalance;
      const total = model.portAFractionProperty.value + model.portBFractionProperty.value;
      expect(total).toBeCloseTo(1, 6);
    }
  });

  it("averages rapid blue-laser fringes without aliasing them into a dark port", () => {
    const model = new MachZehnderModel();
    model.lightSource.sourceTypeProperty.value = SourceType.BLUE_LASER;

    for (const [horizontal, vertical] of [
      [293, 0],
      [0, 293],
      [292.8, 292.8],
    ]) {
      model.tiltHorizontalProperty.value = horizontal ?? 0;
      model.tiltVerticalProperty.value = vertical ?? 0;
      // A monochromatic cosine integrated over [-1, 1] has mean sinc(k).
      // The laser's coherence envelope changes this by less than 10^-7 here.
      const sinc = (tilt: number): number => {
        const phase = (2 * Math.PI * 2 * tilt * 1e-6 * 10e6) / 488;
        return phase === 0 ? 1 : Math.sin(phase) / phase;
      };
      const expectedA = (1 + sinc(horizontal ?? 0) * sinc(vertical ?? 0)) / 2;
      expect(model.portAFractionProperty.value).toBeCloseTo(expectedA, 4);
      expect(model.portAFractionProperty.value + model.portBFractionProperty.value).toBeCloseTo(1, 10);
    }
  });

  it("swaps the ports over half a wavelength of imbalance", () => {
    const model = new MachZehnderModel();
    model.pathImbalanceProperty.value = HENE_WAVELENGTH_NM / 2;
    expect(model.portAFractionProperty.value).toBeCloseTo(0, 2);
    expect(model.portBFractionProperty.value).toBeCloseTo(1, 2);
  });

  it("adds t(n − 1) for a slide at normal incidence", () => {
    const model = new MachZehnderModel();
    model.sampleEnabledProperty.value = true;
    model.sampleThicknessProperty.value = 10;
    model.sampleIndexProperty.value = 1.5;
    model.sampleTiltProperty.value = 0;
    expect(model.samplePathProperty.value).toBeCloseTo(10 * NM_PER_UM * 0.5, 6);
  });

  it("lengthens the route through a tilted slide", () => {
    const model = new MachZehnderModel();
    model.sampleEnabledProperty.value = true;
    model.sampleThicknessProperty.value = 10;
    model.sampleIndexProperty.value = 1.5;
    const flat = model.samplePathProperty.value;
    model.sampleTiltProperty.value = 25;
    expect(model.samplePathProperty.value).toBeGreaterThan(flat);
  });

  it("kills the contrast when the which-path marker is on", () => {
    const model = new MachZehnderModel();
    expect(model.contrastProperty.value).toBe(1);
    model.whichPathProperty.value = true;
    expect(model.contrastProperty.value).toBe(0);
    // Both ports then take exactly half the light, whatever the path difference.
    expect(model.portAFractionProperty.value).toBeCloseTo(0.5, 6);
    expect(model.portBFractionProperty.value).toBeCloseTo(0.5, 6);
  });

  it("emits no photons in continuous mode", () => {
    const model = new MachZehnderModel();
    model.step(1);
    expect(model.photonsEmittedProperty.value).toBe(0);
  });

  it("detects every photon it emits — none are lost to interference", () => {
    const model = new MachZehnderModel();
    model.beamModeProperty.value = BeamMode.SINGLE_PHOTON;
    model.photonRateProperty.value = 500;
    for (let i = 0; i < 20; i++) {
      model.step(0.1);
    }
    const emitted = model.photonsEmittedProperty.value;
    expect(emitted).toBeGreaterThan(500);
    expect(model.countsAProperty.value + model.countsBProperty.value).toBe(emitted);
  });

  it("sends single photons to the bright port when the arms match", () => {
    const model = new MachZehnderModel();
    model.beamModeProperty.value = BeamMode.SINGLE_PHOTON;
    model.photonRateProperty.value = 500;
    for (let i = 0; i < 10; i++) {
      model.step(0.1);
    }
    expect(model.countsBProperty.value).toBe(0);
    expect(model.countsAProperty.value).toBe(model.photonsEmittedProperty.value);
  });

  it("splits single photons evenly once the paths are marked", () => {
    const model = new MachZehnderModel();
    model.beamModeProperty.value = BeamMode.SINGLE_PHOTON;
    model.whichPathProperty.value = true;
    model.photonRateProperty.value = 2000;
    for (let i = 0; i < 30; i++) {
      model.step(0.1);
    }
    const emitted = model.photonsEmittedProperty.value;
    const fractionA = model.countsAProperty.value / emitted;
    expect(fractionA).toBeGreaterThan(0.4);
    expect(fractionA).toBeLessThan(0.6);
  });

  it("emits no photons while the clock is paused, and resumes when it is played", () => {
    const model = new MachZehnderModel();
    model.beamModeProperty.value = BeamMode.SINGLE_PHOTON;
    model.timer.isPlayingProperty.value = false;

    model.step(1);
    expect(model.photonsEmittedProperty.value).toBe(0);

    model.timer.isPlayingProperty.value = true;
    model.step(1);
    expect(model.photonsEmittedProperty.value).toBeGreaterThan(0);
  });

  it("emits a frame's worth of photons per manual step while paused", () => {
    const model = new MachZehnderModel();
    model.beamModeProperty.value = BeamMode.SINGLE_PHOTON;
    model.timer.isPlayingProperty.value = false;
    model.photonRateProperty.value = 600;

    // 600 per second at one sixtieth of a second is exactly ten per press.
    model.stepOnce();
    expect(model.photonsEmittedProperty.value).toBe(10);
    model.stepOnce();
    expect(model.photonsEmittedProperty.value).toBe(20);
  });

  it("loses all fringe visibility once the paths are marked", () => {
    const model = new MachZehnderModel();
    expect(model.visibilityProperty.value).toBeCloseTo(1, 6);
    model.whichPathProperty.value = true;
    expect(model.visibilityProperty.value).toBe(0);
  });

  it("clears the counts and the accumulated marks", () => {
    const model = new MachZehnderModel();
    model.beamModeProperty.value = BeamMode.SINGLE_PHOTON;
    model.step(1);
    expect(model.photonsEmittedProperty.value).toBeGreaterThan(0);

    model.clearCounts();
    expect(model.photonsEmittedProperty.value).toBe(0);
    expect(model.countsAProperty.value).toBe(0);
    expect(model.marksA).toHaveLength(0);
    expect(model.marksB).toHaveLength(0);
  });
});

describe("FabryPerotModel", () => {
  it("derives finesse from the mirrors alone", () => {
    const model = new FabryPerotModel();
    model.reflectanceProperty.value = 0.9;
    expect(model.finesseProperty.value).toBeCloseTo(reflectiveFinesse(0.9), 10);

    const before = model.finesseProperty.value;
    model.spacingProperty.value = 30 * NM_PER_UM;
    expect(model.finesseProperty.value).toBeCloseTo(before, 10);
  });

  it("reports the round trip 2nd, which is the order times the wavelength", () => {
    const model = new FabryPerotModel();
    model.spacingProperty.value = 100 * NM_PER_UM;
    expect(model.roundTripPathProperty.value).toBeCloseTo(2 * 100 * NM_PER_UM, 10);
    expect(model.orderProperty.value).toBeCloseTo(
      model.roundTripPathProperty.value / model.wavelengthProperty.value,
      6,
    );
  });

  it("derives the free spectral range as λ²/2nd", () => {
    const model = new FabryPerotModel();
    model.wavelengthProperty.value = 600;
    model.spacingProperty.value = 100 * NM_PER_UM;
    expect(model.freeSpectralRangeProperty.value).toBeCloseTo((600 * 600) / (2 * 100 * NM_PER_UM), 10);
  });

  it("trades free spectral range for resolving power as the cavity lengthens", () => {
    const model = new FabryPerotModel();
    model.spacingProperty.value = 50 * NM_PER_UM;
    const shortFsr = model.freeSpectralRangeProperty.value;
    const shortPower = model.resolvingPowerProperty.value;

    model.spacingProperty.value = 200 * NM_PER_UM;
    expect(model.freeSpectralRangeProperty.value).toBeLessThan(shortFsr);
    expect(model.resolvingPowerProperty.value).toBeGreaterThan(shortPower);
  });

  it("gives resolving power as the product of order and finesse", () => {
    const model = new FabryPerotModel();
    expect(model.resolvingPowerProperty.value).toBeCloseTo(model.orderProperty.value * model.finesseProperty.value, 8);
  });

  it("starts on a resonance, so the centre of the pattern is bright", () => {
    const model = new FabryPerotModel();
    expect(model.orderProperty.value).toBeCloseTo(Math.round(model.orderProperty.value), 6);
    expect(model.transmissionAt(model.wavelengthProperty.value)).toBeCloseTo(1, 6);
  });

  it("resolves a pair only once they are further apart than its own limit", () => {
    const model = new FabryPerotModel();
    model.twinLineProperty.value = true;

    const limitPm = model.resolutionLimitProperty.value;
    expect(limitPm).toBeLessThan(model.lineSeparationProperty.range.max);

    model.lineSeparationProperty.value = limitPm * 0.5;
    expect(model.resolvedProperty.value).toBe(false);

    model.lineSeparationProperty.value = limitPm * 1.5;
    expect(model.resolvedProperty.value).toBe(true);
  });

  it("resolves a closer pair as the reflectance rises", () => {
    const model = new FabryPerotModel();
    model.reflectanceProperty.value = 0.5;
    const coarseLimit = model.resolutionLimitProperty.value;
    model.reflectanceProperty.value = 0.99;
    expect(model.resolutionLimitProperty.value).toBeLessThan(coarseLimit);
  });

  it("keeps peak transmission at 1 without absorption and drops it with", () => {
    const model = new FabryPerotModel();
    expect(model.peakTransmissionProperty.value).toBeCloseTo(1, 10);
    model.reflectanceProperty.value = 0.98;
    model.absorptanceProperty.value = 0.01;
    expect(model.peakTransmissionProperty.value).toBeLessThan(0.4);
  });

  it("does not move the spacing while the scan clock is paused", () => {
    const model = new FabryPerotModel();
    const before = model.effectiveSpacingProperty.value;
    model.step(1);
    expect(model.effectiveSpacingProperty.value).toBe(before);
  });

  it("steps the sweep forward while paused, so a peak can be walked onto", () => {
    const model = new FabryPerotModel();
    const before = model.scanOffsetProperty.value;
    model.stepOnce();
    expect(model.scanOffsetProperty.value).not.toBe(before);
    expect(model.timer.isPlayingProperty.value).toBe(false);
  });

  it("sweeps the spacing by about a wavelength while scanning", () => {
    const model = new FabryPerotModel();
    model.timer.isPlayingProperty.value = true;
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < 200; i++) {
      model.step(0.05);
      minimum = Math.min(minimum, model.scanOffsetProperty.value);
      maximum = Math.max(maximum, model.scanOffsetProperty.value);
    }
    // Enough travel to carry the transmission peaks across a full order.
    expect(maximum - minimum).toBeGreaterThan(model.wavelengthProperty.value / 2);
  });

  it("renders a sharper ring pattern at higher reflectance", () => {
    const model = new FabryPerotModel();
    const scratch = new Float64Array(4);
    const offAxisIntensity = (): number => {
      const spec = model.fringeSpecProperty.value;
      return intensityAt(spec, 0.06, 0, scratch);
    };

    model.reflectanceProperty.value = 0.3;
    const broad = offAxisIntensity();
    model.reflectanceProperty.value = 0.97;
    expect(offAxisIntensity()).toBeLessThan(broad);
  });
});

describe("Photon count restart", () => {
  it("clears fractional emission time along with the photon counts", () => {
    const model = new MachZehnderModel();
    model.beamModeProperty.value = BeamMode.SINGLE_PHOTON;
    model.photonRateProperty.value = 20;
    model.stepOnce();
    model.stepOnce();
    model.clearCounts();
    model.stepOnce();
    expect(model.photonsEmittedProperty.value).toBe(0);
    model.stepOnce();
    model.stepOnce();
    expect(model.photonsEmittedProperty.value).toBe(1);
  });
});
