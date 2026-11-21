/**
 * Headless soak — template-owned, identical across the fleet.
 *
 * Run by hand, never in CI:  npm run test:soak:headless
 *
 * Builds every screen the way joist does (model + ScreenView), then repeats rounds of
 * what a student does, without a browser:
 *
 *   - press every visible, enabled control: buttons, checkboxes, radio buttons, switches,
 *     combo boxes, and press/release on draggable things (PressListener.click, the same
 *     path keyboard activation takes)
 *   - set every slider / NumberControl / spinner to its minimum, maximum and a random value
 *   - set writable model Properties to valid values (booleans, ranges, validValues)
 *   - step the active screen's model and view with normal, zero, tiny and huge dt
 *   - switch screens, toggle the projector color profile, cycle every locale
 *   - sim-specific actions passed in by the sim (record/clear, add/remove objects)
 *
 * Every round touches every control once in a seeded shuffled order, then presses Reset All
 * on each screen and restores the default profile and locale. After GC it records three
 * things, compared against the round after warm-up:
 *
 *   - listener count on every Property / Emitter reachable from the models, the views' own
 *     fields, and the sim's long-lived globals (colors, preferences)
 *   - scenery Node count in each ScreenView
 *   - retained JS heap (backstop)
 *
 * A metric that rises after every round fails, naming the Properties that grew. Counts are
 * exact after Reset All, so one leaked listener per interaction is enough to fail.
 *
 * Reproduce a run with SOAK_SEED=<seed from the test name>. Scale it with
 * SOAK_ROUNDS (default 5 measured rounds after one warm-up round).
 *
 * Views that build dialogs read the global joist Sim; the harness installs a minimal
 * stand-in (bounds, scale, selected screen, a popup layer) when none exists. Dialogs a
 * control opens join the round: their controls are pressed, and normalize closes them.
 *
 * Not covered here (see tests/soak/browser.spec.ts): real pointer drags, keyboard
 * navigation through the parallel DOM, rendering, and animation-frame timing.
 */

import { BooleanProperty, NumberProperty, Property, type ReadOnlyProperty, StringProperty } from "scenerystack/axon";
import { Bounds2, Dimension2 } from "scenerystack/dot";
import { localeProperty, type TModel } from "scenerystack/joist";
import { colorProfileProperty, Node, PressListener } from "scenerystack/scenery";
import { ResetAllButton } from "scenerystack/scenery-phet";
import type { Screen, ScreenView } from "scenerystack/sim";
import { describe, expect, it } from "vitest";
import { forceGC } from "./memoryLeak.js";

/** @public */
export type AnyScreen = Screen<TModel, ScreenView>;

/** Shared state handed to sim-specific actions. @public */
export type HeadlessSoakContext = {
  readonly screens: readonly AnyScreen[];
  readonly activeScreen: AnyScreen;
  /** Seeded random number in [0, 1). Use it instead of Math.random so runs replay. */
  readonly random: () => number;
};

/** A sim-specific action, run once per round per screen it applies to. @public */
export type HeadlessSoakAction = {
  readonly name: string;
  readonly run: (context: HeadlessSoakContext) => void;
};

/** @public */
export type HeadlessSoakOptions = {
  /** Builds the sim's screens exactly as main.ts does (fresh instances each call). */
  readonly screens: () => readonly AnyScreen[];
  /**
   * Long-lived objects whose Properties a leaking view would link to, by name (used in
   * failure messages): `{ SimColors, preferences }`. Their listener counts are tracked too.
   */
  readonly tracked?: () => Readonly<Record<string, object>>;
  /** Controls to never press, matched against their accessible name or class name. */
  readonly exclude?: RegExp;
  /** Extra per-round actions that only this sim knows how to do. */
  readonly actions?: readonly HeadlessSoakAction[];
  /** Set false when random model Property values put the model in states no control can. */
  readonly fuzzModelProperties?: boolean;
  /** Allowed retained-heap growth over the measured rounds when it climbs every round. */
  readonly maxHeapGrowthBytes?: number;
};

type Pressable = { readonly node: Node; readonly listener: PressListener; readonly label: string };
type ValueControl = {
  readonly node: Node;
  readonly label: string;
  readonly property: { value: number };
  readonly range: { min: number; max: number };
};
type CountedEmitter = { getListenerCount(): number };
type Snapshot = { readonly listeners: Map<string, number>; readonly nodes: number; readonly heap: number };

const ROUNDS = Math.max(3, parseInt(process.env["SOAK_ROUNDS"] || "5", 10) || 5);
const SEED = parseInt(process.env["SOAK_SEED"] || "", 10) || Math.floor(Math.random() * 1_000_000);
/** Controls whose effects leave the sandbox (hardware, files, network) by default. */
const DEFAULT_EXCLUDE =
  /connect|bluetooth|camera|webcam|microphone|serial|usb|download|upload|import|export|open file|load file|save|print|full ?screen/i;
const DT_CHOICES = [1 / 60, 1 / 60, 1 / 60, 1 / 30, 0, 1e-4, 0.5, 2] as const;

/**
 * Register the soak suite. One test: warm-up round, then SOAK_ROUNDS measured rounds.
 *
 * @public
 */
export function describeHeadlessSoak(options: HeadlessSoakOptions): void {
  describe("Headless soak", () => {
    it(`stays leak-free over ${ROUNDS} rounds of interaction (seed ${SEED})`, { timeout: 600_000 }, async () => {
      const random = mulberry32(SEED);
      installSimStub();
      const screens = options.screens();
      expect(screens.length, "describeHeadlessSoak needs at least one screen").toBeGreaterThan(0);
      for (const screen of screens) {
        screen.initializeModel();
        screen.initializeView(new StringProperty("Soak"), new StringProperty("Soak"), screens.length, false);
      }
      const tracked = options.tracked?.() ?? {};
      const log: string[] = [];
      const errors: string[] = [];

      const runRound = (round: number): void => {
        playRound(round, screens, options, random, log, errors);
      };

      runRound(0);
      const snapshots: Snapshot[] = [await snapshot(screens, tracked)];
      const coverage = screens.map((screen, i) => {
        activate(screens, screen);
        const presses =
          findPressables(screen.view, options.exclude).length + findPressables(screen.view, undefined, true).length;
        const values = findValueControls(screen.view, options.exclude).length;
        const props = options.fuzzModelProperties === false ? 0 : settableProperties(screen.model).length;
        return {
          line: `screen${i}: ${presses} pressables (incl. Reset All), ${values} value controls, ${props} model Properties`,
          presses,
        };
      });
      activate(screens, screens[0]!);
      // biome-ignore lint/suspicious/noConsole: by-hand tool; the coverage line is its main output.
      console.log(
        `headless soak seed ${SEED}: ${coverage.map((c) => c.line).join("; ")}; ` +
          `${snapshots[0]!.listeners.size} emitters and ${snapshots[0]!.nodes} nodes tracked`,
      );
      expect(
        coverage.reduce((sum, c) => sum + c.presses, 0),
        "found no pressable controls; is the view built and visible?",
      ).toBeGreaterThan(0);
      for (let round = 1; round <= ROUNDS; round++) {
        runRound(round);
        snapshots.push(await snapshot(screens, tracked));
      }
      // ScreenViews are never disposed (joist keeps them for the whole session; dispose throws).

      expect(errors, `actions threw (seed ${SEED}):\n${errors.slice(0, 20).join("\n")}`).toEqual([]);
      report(snapshots, options.maxHeapGrowthBytes ?? 2 * 1024 * 1024, log);
    });
  });
}

// ── Actions ──────────────────────────────────────────────────────────────────

/** One round: every screen in shuffled order, then global toggles, then normalize. */
function playRound(
  round: number,
  screens: readonly AnyScreen[],
  options: HeadlessSoakOptions,
  random: () => number,
  log: string[],
  errors: string[],
): void {
  for (const screen of shuffle(random, [...screens])) {
    activate(screens, screen);
    const context: HeadlessSoakContext = { screens, activeScreen: screen, random };
    for (const action of buildActions(screen, context, options, options.exclude, random)) {
      try {
        action.run();
        log.push(`r${round} ${action.name}`);
      } catch (error) {
        if (!action.tolerant) {
          errors.push(`r${round} ${action.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (log.length > 40) {
        log.shift();
      }
    }
  }
  globalActions(random);
  normalize(screens, options.exclude);
}

type RoundAction = { readonly name: string; readonly run: () => void; readonly tolerant?: boolean };

/** Every control on the active screen once, steps in between, shuffled by the seed. */
function buildActions(
  screen: AnyScreen,
  context: HeadlessSoakContext,
  options: HeadlessSoakOptions,
  exclude: RegExp | undefined,
  random: () => number,
): RoundAction[] {
  const view = screen.view;
  const actions: RoundAction[] = [];

  const popupPressables = simStub ? findPressables(simStub.popupLayer, exclude) : [];
  for (const pressable of [...findPressables(view, exclude), ...popupPressables]) {
    const root = popupPressables.includes(pressable) ? simStub!.popupLayer : view;
    actions.push({
      name: `press "${pressable.label}"`,
      run: () => {
        if (isShowing(pressable.node, root) && pressable.listener.canClick()) {
          pressable.listener.click(null);
        }
      },
    });
  }
  for (const control of findValueControls(view, exclude)) {
    for (const pick of ["min", "max", "random"] as const) {
      actions.push({
        name: `set "${control.label}" to ${pick}`,
        run: () => {
          const { min, max } = control.range;
          control.property.value = pick === "min" ? min : pick === "max" ? max : min + (max - min) * random();
        },
      });
    }
  }
  if (options.fuzzModelProperties !== false) {
    for (const [path, property] of settableProperties(screen.model)) {
      actions.push({ name: `model ${path}`, run: () => setValidValue(property, random), tolerant: true });
    }
  }
  for (const action of options.actions ?? []) {
    actions.push({ name: action.name, run: () => action.run(context) });
  }
  // Interleave stepping so each change is integrated, the way frames follow input.
  const steps = Math.max(5, Math.ceil(actions.length / 3));
  for (let i = 0; i < steps; i++) {
    const dt = DT_CHOICES[Math.floor(random() * DT_CHOICES.length)]!;
    const frames = 1 + Math.floor(random() * 20);
    actions.push({
      name: `step ${frames}×${dt}`,
      run: () => {
        for (let f = 0; f < frames; f++) {
          screen.model.step?.(dt);
          screen.view.step?.(dt);
        }
      },
    });
  }
  return shuffle(random, actions);
}

/** Projector profile and every locale once per round, as the Preferences dialog would. */
function globalActions(random: () => number): void {
  const profiles = (colorProfileProperty.validValues ?? []) as readonly string[];
  for (const profile of shuffle(random, [...profiles])) {
    colorProfileProperty.value = profile;
  }
  for (const locale of shuffle(random, [...localeProperty.availableRuntimeLocales])) {
    localeProperty.value = locale;
  }
}

/** Return to the reference state before measuring: Reset All everywhere, defaults on. */
function normalize(screens: readonly AnyScreen[], exclude: RegExp | undefined): void {
  closePopups();
  colorProfileProperty.value = "default";
  localeProperty.value = localeProperty.availableRuntimeLocales.includes("en")
    ? "en"
    : localeProperty.availableRuntimeLocales[0]!;
  for (const screen of screens) {
    activate(screens, screen);
    for (const pressable of findPressables(screen.view, exclude, true)) {
      pressable.listener.click(null);
    }
    screen.model.step?.(1 / 60);
    screen.view.step?.(1 / 60);
  }
  activate(screens, screens[0]!);
}

function activate(screens: readonly AnyScreen[], active: AnyScreen): void {
  simStub?.selectedScreenProperty.set(active);
  for (const screen of screens) {
    screen.activeProperty.value = screen === active;
    screen.view.visible = screen === active;
  }
}

// ── Scene-graph discovery ────────────────────────────────────────────────────

/** Visible, input-enabled nodes with a PressListener (or only Reset All buttons). */
function findPressables(root: Node, exclude: RegExp | undefined, resetAllOnly = false): Pressable[] {
  const found: Pressable[] = [];
  walkShowing(root, (node) => {
    if (resetAllOnly && !(node instanceof ResetAllButton)) {
      return;
    }
    // Reset All runs in normalize(); pressing it mid-round would hide every other leak.
    if (!resetAllOnly && node instanceof ResetAllButton) {
      return;
    }
    const label = labelOf(node);
    if (!resetAllOnly && (DEFAULT_EXCLUDE.test(label) || exclude?.test(label))) {
      return;
    }
    for (const listener of node.inputListeners) {
      if (listener instanceof PressListener) {
        found.push({ node, listener, label });
      }
    }
  });
  return found;
}

/** Sliders, NumberControls and spinners: anything built on AccessibleValueHandler. */
function findValueControls(root: Node, exclude: RegExp | undefined): ValueControl[] {
  const found: ValueControl[] = [];
  walkShowing(root, (node) => {
    const handler = node as unknown as {
      _valueProperty?: { value: unknown };
      _enabledRangeProperty?: { value: { min: number; max: number } };
    };
    const property = handler._valueProperty;
    const range = handler._enabledRangeProperty?.value;
    const label = labelOf(node);
    if (!(property && range) || typeof property.value !== "number" || exclude?.test(label)) {
      return;
    }
    if (!(Number.isFinite(range.min) && Number.isFinite(range.max))) {
      return;
    }
    found.push({ node, label, property: property as { value: number }, range });
  });
  return found;
}

/** Depth-first over children that a student could see and reach. */
function walkShowing(root: Node, visit: (node: Node) => void): void {
  const seen = new Set<Node>();
  const recurse = (node: Node): void => {
    if (seen.has(node) || !node.visible || !node.inputEnabled || node.pickable === false) {
      return;
    }
    seen.add(node);
    visit(node);
    for (const child of node.children) {
      recurse(child);
    }
  };
  recurse(root);
}

/** True while every ancestor up to `root` is visible and accepts input. */
function isShowing(node: Node, root: Node): boolean {
  let current: Node | undefined = node;
  while (current && current !== root) {
    if (!(current.visible && current.inputEnabled) || current.pickable === false) {
      return false;
    }
    current = current.parents[0];
  }
  return current === root;
}

function labelOf(node: Node): string {
  const pdom = node as unknown as { accessibleName?: unknown; innerContent?: unknown; labelContent?: unknown };
  for (const candidate of [pdom.accessibleName, pdom.innerContent, pdom.labelContent]) {
    const text = typeof candidate === "string" ? candidate : (candidate as { value?: unknown } | null)?.value;
    if (typeof text === "string" && text.trim().length > 0) {
      return text.trim();
    }
  }
  return node.constructor.name;
}

function countNodes(root: Node): number {
  const seen = new Set<Node>();
  const recurse = (node: Node): void => {
    if (seen.has(node)) {
      return;
    }
    seen.add(node);
    for (const child of node.children) {
      recurse(child);
    }
  };
  recurse(root);
  return seen.size;
}

// ── Object-graph discovery ───────────────────────────────────────────────────

/**
 * Every object with getListenerCount() reachable from `roots` through own fields, arrays,
 * Maps and Sets, keyed by a readable path. Does not descend into scenery Nodes other than
 * a root (a view's children are counted by countNodes instead).
 */
function emitters(roots: readonly [string, object][]): Map<string, CountedEmitter> {
  const found = new Map<string, CountedEmitter>();
  const seen = new WeakSet<object>();
  const visit = (value: unknown, path: string, depth: number, isRoot: boolean): void => {
    if (value === null || typeof value !== "object" || seen.has(value) || depth > 6) {
      return;
    }
    seen.add(value);
    if (typeof (value as Partial<CountedEmitter>).getListenerCount === "function") {
      found.set(path, value as CountedEmitter);
    }
    if (value instanceof Node && !isRoot) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        visit(item, `${path}[${i}]`, depth + 1, false);
      });
      return;
    }
    if (value instanceof Map || value instanceof Set) {
      let i = 0;
      for (const item of value.values()) {
        visit(item, `${path}<${i++}>`, depth + 1, false);
      }
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      visit(child, `${path}.${key}`, depth + 1, false);
    }
  };
  for (const [name, root] of roots) {
    visit(root, name, 0, true);
  }
  return found;
}

function settableProperties(model: object): [string, ReadOnlyProperty<unknown>][] {
  const out: [string, ReadOnlyProperty<unknown>][] = [];
  for (const [path, emitter] of emitters([["model", model]])) {
    const property = emitter as unknown as Partial<ReadOnlyProperty<unknown>> & { isSettable?: () => boolean };
    if (typeof property.isSettable === "function" && property.isSettable() && hasValidValueSource(property)) {
      out.push([path, property as ReadOnlyProperty<unknown>]);
    }
  }
  return out;
}

function hasValidValueSource(property: Partial<ReadOnlyProperty<unknown>>): boolean {
  const range = (property as { rangeProperty?: { value?: { min: number; max: number } } }).rangeProperty?.value;
  return (
    typeof property.value === "boolean" ||
    (property.validValues?.length ?? 0) > 0 ||
    (typeof property.value === "number" && range !== undefined && Number.isFinite(range.min + range.max))
  );
}

function setValidValue(property: ReadOnlyProperty<unknown>, random: () => number): void {
  const settable = property as unknown as { value: unknown };
  const range = (property as unknown as { rangeProperty?: { value: { min: number; max: number } } }).rangeProperty
    ?.value;
  if (property.validValues && property.validValues.length > 0) {
    settable.value = property.validValues[Math.floor(random() * property.validValues.length)];
  } else if (typeof property.value === "boolean") {
    settable.value = !property.value;
  } else if (range) {
    settable.value = range.min + (range.max - range.min) * random();
  }
}

// ── Measurement and verdict ──────────────────────────────────────────────────

async function snapshot(screens: readonly AnyScreen[], tracked: Readonly<Record<string, object>>): Promise<Snapshot> {
  await forceGC();
  const roots: [string, object][] = [
    ["colorProfileProperty", colorProfileProperty],
    ["localeProperty", localeProperty],
  ];
  screens.forEach((screen, i) => {
    roots.push([`screen${i}.model`, screen.model], [`screen${i}.view`, screen.view]);
  });
  for (const [name, object] of Object.entries(tracked)) {
    roots.push([name, object]);
  }
  const listeners = new Map<string, number>();
  for (const [path, emitter] of emitters(roots)) {
    listeners.set(path, emitter.getListenerCount());
  }
  return {
    listeners,
    nodes: screens.reduce((sum, screen) => sum + countNodes(screen.view), simStub ? countNodes(simStub.popupLayer) : 0),
    heap: process.memoryUsage().heapUsed,
  };
}

function report(snapshots: readonly Snapshot[], maxHeapGrowthBytes: number, log: readonly string[]): void {
  const [baseline, ...rounds] = snapshots;
  if (!baseline || rounds.length === 0) {
    throw new Error("headless soak recorded no rounds");
  }
  /** Strictly higher after every measured round than the round before. */
  const rising = (series: readonly number[]): boolean =>
    series.length > 1 && series.slice(1).every((value, i) => value > series[i]!);
  const tail = `\nlast actions:\n  ${log.slice(-15).join("\n  ")}\nreplay: SOAK_SEED=${SEED} npm run test:soak:headless`;

  // Listener counts: per path, the ones that rose after every measured round.
  const growing: string[] = [];
  for (const [path, base] of baseline.listeners) {
    const series = [base, ...rounds.map((s) => s.listeners.get(path) ?? 0)];
    if (rising(series)) {
      growing.push(`${path}: ${series.join(" → ")}`);
    }
  }
  const totals = snapshots.map((s) => [...s.listeners.values()].reduce((a, b) => a + b, 0));
  expect(
    growing,
    `listener counts rose every round (total ${totals.join(" → ")}):\n  ${growing.slice(0, 12).join("\n  ")}${tail}`,
  ).toEqual([]);

  const nodes = snapshots.map((s) => s.nodes);
  expect(rising(nodes), `ScreenView node count rose every round: ${nodes.join(" → ")}${tail}`).toBe(false);

  const heap = snapshots.map((s) => s.heap);
  const growth = heap[heap.length - 1]! - heap[0]!;
  const mib = (b: number): string => `${(b / 1024 / 1024).toFixed(1)} MiB`;
  expect(
    rising(heap) && growth > maxHeapGrowthBytes,
    `retained heap rose every round by ${mib(growth)} (limit ${mib(maxHeapGrowthBytes)}): ${heap.map(mib).join(" → ")}${tail}`,
  ).toBe(false);
}

// ── Sim stand-in ─────────────────────────────────────────────────────────────

type SimStub = {
  readonly popupLayer: Node;
  readonly selectedScreenProperty: Property<AnyScreen | null>;
};
let simStub: SimStub | null = null;

/** Minimal phet.joist.sim for views that build Dialogs / popups (only if none exists). */
function installSimStub(): void {
  const phet = (globalThis as unknown as { phet: { joist: { sim?: unknown } } }).phet;
  if (phet.joist.sim) {
    return;
  }
  const popupLayer = new Node();
  const selectedScreenProperty = new Property<AnyScreen | null>(null);
  const layoutBounds = new Bounds2(0, 0, 1024, 618);
  simStub = { popupLayer, selectedScreenProperty };
  phet.joist.sim = {
    boundsProperty: new Property(layoutBounds),
    screenBoundsProperty: new Property(layoutBounds),
    scaleProperty: new NumberProperty(1),
    dimensionProperty: new Property(new Dimension2(1024, 618)),
    selectedScreenProperty,
    activeSimScreensProperty: new Property([]),
    simNameProperty: new StringProperty("Soak"),
    displayedSimNameProperty: new StringProperty("Soak"),
    activeProperty: new BooleanProperty(true),
    browserTabVisibleProperty: new BooleanProperty(true),
    isConstructionCompleteProperty: new BooleanProperty(true),
    locale: "en",
    showPopup: (popup: Node) => {
      if (!popupLayer.hasChild(popup)) {
        popupLayer.addChild(popup);
      }
    },
    hidePopup: (popup: Node) => {
      if (popupLayer.hasChild(popup)) {
        popupLayer.removeChild(popup);
      }
    },
  };
}

/** Close every open dialog the way its close button would. */
function closePopups(): void {
  for (const popup of [...(simStub?.popupLayer.children ?? [])]) {
    const closable = popup as unknown as { hide?: () => void };
    if (typeof closable.hide === "function") {
      closable.hide();
    }
    if (simStub?.popupLayer.hasChild(popup)) {
      simStub.popupLayer.removeChild(popup);
    }
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────

/** Small seeded PRNG so a failing order replays exactly. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(random: () => number, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
