/**
 * Vitest setup file — runs before every test file.
 *
 * SceneryStack requires a Canvas 2D context and an AudioContext at import time.
 * happy-dom does not provide working versions, so we patch in minimal mocks
 * before any scenerystack code loads, then call init() once for the suite.
 *
 * Template-owned: identical across the fleet except the `name` passed to init()
 * (Baton check-template-drift substitutes it). Extend mocks in the template, or
 * record a sim-specific variant under AGENTS.md → "Compliance carve-outs".
 */

import { afterEach, beforeEach } from "vitest";

// ── shared no-op helpers ─────────────────────────────────────────────────────
const noop: () => void = () => {
  /* no-op */
};
const noopReturn: (val: unknown) => () => unknown = (val: unknown) => (): unknown => val;

// ── Canvas 2D mock ───────────────────────────────────────────────────────────
function createMockContext2D(): CanvasRenderingContext2D {
  const ctx: Record<string, unknown> = {
    canvas: { width: 1, height: 1 },
    save: noop,
    restore: noop,
    scale: noop,
    rotate: noop,
    translate: noop,
    transform: noop,
    setTransform: noop,
    getTransform: noopReturn({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    resetTransform: noop,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    miterLimit: 10,
    lineDashOffset: 0,
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    direction: "ltr",
    shadowBlur: 0,
    shadowColor: "rgba(0,0,0,0)",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    imageSmoothingEnabled: true,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    strokeText: noop,
    measureText: () => ({
      width: 0,
      actualBoundingBoxAscent: 0,
      actualBoundingBoxDescent: 0,
      fontBoundingBoxAscent: 0,
      fontBoundingBoxDescent: 0,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 0,
      emHeightAscent: 0,
      emHeightDescent: 0,
    }),
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    bezierCurveTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    arcTo: noop,
    ellipse: noop,
    rect: noop,
    fill: noop,
    stroke: noop,
    clip: noop,
    isPointInPath: noopReturn(false),
    isPointInStroke: noopReturn(false),
    getLineDash: noopReturn([]),
    setLineDash: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: noopReturn(null),
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: noop,
    drawImage: noop,
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

// ── Web Audio mock ───────────────────────────────────────────────────────────
/** An AudioParam that accepts every scheduling call. */
function mockParam(value: number): AudioParam {
  return {
    value,
    defaultValue: value,
    setValueAtTime: noop,
    linearRampToValueAtTime: noop,
    exponentialRampToValueAtTime: noop,
    setTargetAtTime: noop,
    setValueCurveAtTime: noop,
    cancelScheduledValues: noop,
    cancelAndHoldAtTime: noop,
  } as unknown as AudioParam;
}

/** An AudioNode with connect / disconnect plus the given fields. */
function mockNode<T>(fields: Record<string, unknown> = {}): T {
  return { connect: noop, disconnect: noop, addEventListener: noop, removeEventListener: noop, ...fields } as T;
}

function mockBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
  const data = Array.from({ length: Math.max(1, channels) }, () => new Float32Array(length));
  return {
    length,
    duration: length / sampleRate,
    sampleRate,
    numberOfChannels: data.length,
    getChannelData: (channel: number) => data[channel] ?? new Float32Array(length),
    copyToChannel: noop,
    copyFromChannel: noop,
  } as unknown as AudioBuffer;
}

class MockAudioContext {
  readonly sampleRate = 44100;
  readonly state: AudioContextState = "running";
  readonly currentTime = 0;
  readonly destination = mockNode<AudioDestinationNode>({ maxChannelCount: 2 });
  readonly listener = {} as AudioListener;
  createGain(): GainNode {
    return mockNode<GainNode>({ gain: mockParam(1) });
  }
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
    return mockBuffer(channels, length, sampleRate);
  }
  createBufferSource(): AudioBufferSourceNode {
    return mockNode<AudioBufferSourceNode>({
      buffer: null,
      loop: false,
      start: noop,
      stop: noop,
      onended: null,
      playbackRate: mockParam(1),
      detune: mockParam(0),
    });
  }
  createOscillator(): OscillatorNode {
    return mockNode<OscillatorNode>({
      type: "sine",
      start: noop,
      stop: noop,
      setPeriodicWave: noop,
      frequency: mockParam(440),
      detune: mockParam(0),
    });
  }
  createPeriodicWave(): PeriodicWave {
    return {} as PeriodicWave;
  }
  createBiquadFilter(): BiquadFilterNode {
    return mockNode<BiquadFilterNode>({
      type: "lowpass",
      frequency: mockParam(350),
      Q: mockParam(1),
      gain: mockParam(0),
      detune: mockParam(0),
    });
  }
  createStereoPanner(): StereoPannerNode {
    return mockNode<StereoPannerNode>({ pan: mockParam(0) });
  }
  createDelay(): DelayNode {
    return mockNode<DelayNode>({ delayTime: mockParam(0) });
  }
  createConvolver(): ConvolverNode {
    return mockNode<ConvolverNode>({ buffer: null, normalize: true });
  }
  createAnalyser(): AnalyserNode {
    return mockNode<AnalyserNode>({
      fftSize: 2048,
      frequencyBinCount: 1024,
      getFloatFrequencyData: noop,
      getByteFrequencyData: noop,
      getFloatTimeDomainData: noop,
      getByteTimeDomainData: noop,
    });
  }
  createDynamicsCompressor(): DynamicsCompressorNode {
    return mockNode<DynamicsCompressorNode>({
      threshold: mockParam(-24),
      knee: mockParam(30),
      ratio: mockParam(12),
      attack: mockParam(0.003),
      release: mockParam(0.25),
    });
  }
  decodeAudioData(_data: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve(mockBuffer(1, 0, 44100));
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
}
(globalThis as Record<string, unknown>)["AudioContext"] = MockAudioContext;
(globalThis as Record<string, unknown>)["webkitAudioContext"] = MockAudioContext;

// ── Web Worker mock ──────────────────────────────────────────────────────────
// happy-dom has no Worker. Models that construct one as a field initializer
// (e.g. an OpenCV or physics worker) still need the constructor to exist.
// Messages are swallowed: a real worker cannot run under happy-dom anyway.
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage: () => void = noop;
  terminate: () => void = noop;
  addEventListener: () => void = noop;
  removeEventListener: () => void = noop;
  dispatchEvent: () => boolean = () => false;
}
if (typeof globalThis.Worker === "undefined") {
  (globalThis as Record<string, unknown>)["Worker"] = MockWorker;
}

// ── patch getContext("2d") before any scenerystack import ────────────────────
// Also pins getContext("webgpu") to null: happy-dom has no WebGPU, so code with a
// WebGPU path exercises its unsupported branch deterministically.
//
// `origGetContext` is narrowed to a single loose signature before delegating —
// its real type is a large overload union (widened further by @webgpu/types),
// and a spread argument cannot be applied to an overload union.
type LooseGetContext = (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) => unknown;
// Detached on purpose: it is only ever invoked as `origGetContext.call(this, …)` below.
// oxlint-disable-next-line typescript/unbound-method
const origGetContext = HTMLCanvasElement.prototype.getContext as unknown as LooseGetContext;
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
  if (contextId === "2d") {
    const ctx = createMockContext2D();
    (ctx as unknown as Record<string, unknown>)["canvas"] = this;
    return ctx;
  }
  if (contextId === "webgpu") {
    return null;
  }
  return origGetContext.call(this, contextId, ...args);
} as typeof HTMLCanvasElement.prototype.getContext;

// ── SceneryStack init ────────────────────────────────────────────────────────
// Dynamic import on purpose: a static `import` is hoisted and would load
// scenerystack/init before the mocks above are installed. (The `vitest` import at the
// top keeps this file an ES module, which top-level await requires.)
const { init, madeWithSceneryStackSplashDataURI } = await import("scenerystack/init");

// The by-hand headless soak (vitest.soak.config.ts sets SOAK_HEADLESS=1) cycles every locale
// that has a strings file and the projector profile; unit tests stay on en / default.
const soak = process.env["SOAK_HEADLESS"] === "1";
const { readdirSync } = await import("node:fs");
const soakLocales = soak
  ? readdirSync(`${process.cwd()}/src/i18n`)
      .map((file) => /^strings_(.+)\.json$/.exec(file)?.[1])
      .filter((locale): locale is string => locale !== undefined)
  : [];

init({
  // Must match the package.json "name" (and the name in src/init.ts).
  name: "interferometry-lab",
  version: "1.0.0-test",
  brand: "made-with-scenerystack",
  locale: "en",
  availableLocales: soak && soakLocales.length > 0 ? soakLocales : ["en"],
  splashDataURI: madeWithSceneryStackSplashDataURI,
  allowLocaleSwitching: soak,
  colorProfiles: soak ? ["default", "projector"] : ["default"],
});

// ── console guard ────────────────────────────────────────────────────────────
// Any console.error / console.warn during a test fails that test: SceneryStack
// reports assertion-style problems (bad option, leaked listener, NaN layout) via
// the console, and the fuzz suite already fails on them in the browser. A test
// that expects a warning silences it explicitly:
//   vi.spyOn(console, "warn").mockImplementation(() => undefined);
// (restoreMocks in vitest.config.ts undoes the spy after the test). Calls are
// recorded and reported in afterEach rather than thrown on the spot, so library
// code that catches errors cannot swallow the failure.
const consoleProblems: string[] = [];
for (const level of ["error", "warn"] as const) {
  // biome-ignore lint/suspicious/noConsole: the guard wraps console on purpose
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]): void => {
    consoleProblems.push(`console.${level}: ${args.map((arg) => String(arg)).join(" ")}`);
    original(...args);
  };
}
beforeEach(() => {
  consoleProblems.length = 0;
});
afterEach(() => {
  if (consoleProblems.length > 0) {
    const report = consoleProblems.splice(0).join("\n  ");
    throw new Error(`Unexpected console output during the test (silence it explicitly if intended):\n  ${report}`);
  }
});
