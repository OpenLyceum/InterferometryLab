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
class MockAudioContext {
  readonly sampleRate = 44100;
  readonly state: AudioContextState = "running";
  readonly destination = {} as AudioDestinationNode;
  createGain(): GainNode {
    return {
      gain: { value: 1, setValueAtTime: noop, linearRampToValueAtTime: noop },
      connect: noop,
      disconnect: noop,
    } as unknown as GainNode;
  }
  createBufferSource(): AudioBufferSourceNode {
    return {
      buffer: null,
      connect: noop,
      disconnect: noop,
      start: noop,
      stop: noop,
      playbackRate: { value: 1 },
    } as unknown as AudioBufferSourceNode;
  }
  createOscillator(): OscillatorNode {
    return { connect: noop, start: noop, stop: noop, frequency: { value: 440 } } as unknown as OscillatorNode;
  }
  createDynamicsCompressor(): DynamicsCompressorNode {
    return { connect: noop, disconnect: noop } as unknown as DynamicsCompressorNode;
  }
  decodeAudioData(_data: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve({
      length: 0,
      duration: 0,
      sampleRate: 44100,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(0),
    } as unknown as AudioBuffer);
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
import { init, madeWithSceneryStackSplashDataURI } from "scenerystack/init";

init({
  // Must match the package.json "name" (and the name in src/init.ts).
  name: "interferometry-lab",
  version: "1.0.0-test",
  brand: "made-with-scenerystack",
  locale: "en",
  availableLocales: ["en"],
  splashDataURI: madeWithSceneryStackSplashDataURI,
  allowLocaleSwitching: false,
  colorProfiles: ["default"],
});
