/**
 * Fleet-standard memory-leak regression suite (SceneryStackTemplate / QubitSketch pattern).
 *
 * Creates a disposable object inside a function boundary, disposes it, forces
 * garbage collection via global.gc (--expose-gc in vitest.config.ts), then asserts via
 * WeakRef that the object was collected. V8 requires a function boundary (not merely
 * a block scope) so local strong references die when the helper returns.
 *
 * Beyond the template's TimeModel checks, this covers every node in this sim that
 * holds listeners on model Properties: the fringe renderer, the photon mark
 * overlay, and the two analysis charts. All are created per screen rather than
 * per frame, but all subscribe to Properties they do not own, which is the shape
 * of leak this suite exists to catch.
 */

import { NumberProperty, Property, type ReadOnlyProperty } from "scenerystack/axon";
import { Color } from "scenerystack/scenery";
import { describe, expect, it } from "vitest";
import type { FringeSpec } from "../src/common/model/FringeSpec.js";
import { TimeModel } from "../src/common/TimeModel.js";
import { FringePatternNode } from "../src/common/view/FringePatternNode.js";
import { IntensityProfileNode } from "../src/common/view/IntensityProfileNode.js";
import { FabryPerotModel } from "../src/fabry-perot/model/FabryPerotModel.js";
import { TransmissionSpectrumNode } from "../src/fabry-perot/view/TransmissionSpectrumNode.js";
import type { PhotonMark } from "../src/mach-zehnder/model/MachZehnderModel.js";
import { PhotonMarksNode } from "../src/mach-zehnder/view/PhotonMarksNode.js";
import { MichelsonModel } from "../src/michelson/model/MichelsonModel.js";
import { CoherenceEnvelopeNode } from "../src/michelson/view/CoherenceEnvelopeNode.js";
import { describeDisposalLeaks, forceGC } from "./helpers/memoryLeak.js";

function createAndDisposeTimeModel(): WeakRef<object> {
  const model = new TimeModel();
  const ref = new WeakRef<object>(model);
  model.dispose();
  return ref;
}

/** A minimal, valid pattern description for constructing a renderer. */
function makeSpec(): FringeSpec {
  return {
    geometry: { ringOpdNm: 1000, constantOpdNm: 0, tiltXNm: 0, tiltYNm: 0, apertureTanTheta: 0.2 },
    groups: [{ wavelengthNm: 632.8, bandwidthNm: 0.002, weight: 1, opdOffsetNm: 0 }],
    terms: { kind: "two-beam", intensityA: 0.5, intensityB: 0.5, extraPhaseRad: 0 },
    contrast: 1,
    exposure: 0.5,
  };
}

function createAndDisposeFringePatternNode(specProperty: Property<FringeSpec>): WeakRef<object> {
  const node = new FringePatternNode(specProperty, { size: 32 });
  const ref = new WeakRef<object>(node);
  node.dispose();
  return ref;
}

function createAndDisposePhotonMarksNode(revisionProperty: NumberProperty): WeakRef<object> {
  const marks: PhotonMark[] = [];
  const node = new PhotonMarksNode(marks, revisionProperty, 32);
  const ref = new WeakRef<object>(node);
  node.dispose();
  return ref;
}

function createAndDisposeIntensityProfileNode(specProperty: Property<FringeSpec>): WeakRef<object> {
  const node = new IntensityProfileNode([{ specProperty, colorProperty: new Property(new Color("#4fc3f7")) }], {
    width: 64,
    height: 32,
  });
  const ref = new WeakRef<object>(node);
  node.dispose();
  return ref;
}

function createAndDisposeCoherenceEnvelopeNode(model: MichelsonModel): WeakRef<object> {
  const node = new CoherenceEnvelopeNode(model, { width: 64, height: 32 });
  const ref = new WeakRef<object>(node);
  node.dispose();
  return ref;
}

function createAndDisposeTransmissionSpectrum(model: FabryPerotModel): WeakRef<object> {
  const node = new TransmissionSpectrumNode(model, { width: 64, height: 32 });
  const chart = node.children[1];
  if (!chart) {
    throw new Error("The transmission chart is missing");
  }
  const ref = new WeakRef<object>(chart);
  node.dispose();
  return ref;
}

describe("Memory leak regression", () => {
  it("TimeModel is collected after dispose", async () => {
    const ref = createAndDisposeTimeModel();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("double dispose() does not throw", () => {
    const model = new TimeModel();
    model.dispose();
    expect(() => model.dispose()).not.toThrow();
  });

  it("repeated create/dispose cycles leave no survivors", async () => {
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push(createAndDisposeTimeModel());
    }
    await forceGC(refs);
    const survivors = refs.filter((r) => r.deref() !== undefined).length;
    expect(survivors).toBe(0);
  });

  it("FringePatternNode unlinks from the spec it does not own", () => {
    const specProperty = new Property<FringeSpec>(makeSpec());
    expect(specProperty.hasListeners()).toBe(false);
    const node = new FringePatternNode(specProperty, { size: 32 });
    expect(specProperty.hasListeners()).toBe(true);
    node.dispose();
    expect(specProperty.hasListeners()).toBe(false);
  });

  it("FringePatternNode is collected after dispose", async () => {
    const specProperty = new Property<FringeSpec>(makeSpec());
    const ref = createAndDisposeFringePatternNode(specProperty);
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("PhotonMarksNode unlinks from the revision Property it does not own", () => {
    const revisionProperty = new NumberProperty(0);
    expect(revisionProperty.hasListeners()).toBe(false);
    const node = new PhotonMarksNode([], revisionProperty, 32);
    expect(revisionProperty.hasListeners()).toBe(true);
    node.dispose();
    expect(revisionProperty.hasListeners()).toBe(false);
  });

  it("PhotonMarksNode is collected after dispose", async () => {
    const revisionProperty = new NumberProperty(0);
    const ref = createAndDisposePhotonMarksNode(revisionProperty);
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("IntensityProfileNode unlinks from the spec it does not own", () => {
    const specProperty = new Property<FringeSpec>(makeSpec());
    expect(specProperty.hasListeners()).toBe(false);
    const node = new IntensityProfileNode([{ specProperty, colorProperty: new Property(new Color("#4fc3f7")) }], {
      width: 64,
      height: 32,
    });
    expect(specProperty.hasListeners()).toBe(true);
    node.dispose();
    expect(specProperty.hasListeners()).toBe(false);
  });

  it("IntensityProfileNode is collected after dispose", async () => {
    const specProperty = new Property<FringeSpec>(makeSpec());
    const ref = createAndDisposeIntensityProfileNode(specProperty);
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  /**
   * The model outlives the node here, which is what makes this a real check: a
   * listener left behind on any of the model's Properties would keep the node
   * reachable and the WeakRef alive. A `hasListeners` check cannot be used for
   * this node — the model derives its own visibility and fringe count from the
   * same Properties, so they have listeners before the node is even built.
   */
  it("CoherenceEnvelopeNode is collected after dispose, with its model still alive", async () => {
    const model = new MichelsonModel();
    const ref = createAndDisposeCoherenceEnvelopeNode(model);
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
    expect(model.pathDifferenceProperty.value).toBeDefined();
  });

  it("TransmissionSpectrumNode releases model listeners and tolerates subsequent changes", () => {
    const model = new FabryPerotModel();
    const specProperty = model.fringeSpecProperty as ReadOnlyProperty<FringeSpec>;
    const resolvedProperty = model.resolvedProperty as ReadOnlyProperty<boolean>;
    expect(specProperty.hasListeners()).toBe(false);
    expect(resolvedProperty.hasListeners()).toBe(false);
    const node = new TransmissionSpectrumNode(model, { width: 64, height: 32 });
    expect(specProperty.hasListeners()).toBe(true);
    expect(resolvedProperty.hasListeners()).toBe(true);

    node.disposeSubtree();
    expect(specProperty.hasListeners()).toBe(false);
    expect(resolvedProperty.hasListeners()).toBe(false);
    expect(() => {
      model.spacingProperty.value += 1000;
      model.absorptanceProperty.value = 0.01;
      model.twinLineProperty.value = true;
    }).not.toThrow();
  });

  it("the disposed transmission chart is collected while its model stays alive", async () => {
    const model = new FabryPerotModel();
    const ref = createAndDisposeTransmissionSpectrum(model);
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
    expect(model.effectiveSpacingProperty.value).toBeDefined();
  });
});

describeDisposalLeaks([{ name: "TimeModel", create: () => new TimeModel(), idempotentDispose: true }]);
