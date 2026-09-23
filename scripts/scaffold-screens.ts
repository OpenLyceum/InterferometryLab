#!/usr/bin/env tsx
/**
 * scripts/scaffold-screens.ts
 *
 * Emits N screen packages from the template's `src/sim-screen/` prototype
 * (fleet folder naming: `src/intro/`, not `intro-screen/`), wires main.ts,
 * StringManager, locale JSON, and a stub `{Prefix}ScreenIcons.ts` module, then
 * repoints AGENTS.md / README.md / doc/*.md at the emitted screens.
 *
 * Run after `npm run rename` (create-sim always does both). Safe on a pristine
 * template too (prefix stays `Sim`).
 *
 * Usage:
 *   npm run scaffold-screens -- --screens Intro,Lab
 *   npm run scaffold-screens -- --screens intro:Intro,"series-rlc:Series RLC"
 *   npm run scaffold-screens -- --screens Friction
 *   npm run scaffold-screens              # one screen from package.json display name / id
 *
 * Options:
 *   --screens <list>   Comma-separated titles, or kebab:Title pairs
 *   --prefix <Pascal>  Override sim prefix (default: detect from *Colors.ts)
 *   --shared-model     Emit src/common/model/SharedModel.ts; each screen model composes it
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

// ── Argument parsing ──────────────────────────────────────────────────────────

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, "src");

interface ScreenSpec {
  /** JSON / StringProperty key (camelCase): intro, seriesRlc */
  key: string;
  /** Folder name (kebab): intro, series-rlc */
  kebab: string;
  /** Class prefix (Pascal): Intro, SeriesRlc */
  pascal: string;
  /** Display title: Intro, Series RLC */
  title: string;
  /** Tandem id: introScreen */
  tandem: string;
}

function toKebab(input: string): string {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function kebabToCamel(kebab: string): string {
  return kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function kebabToPascal(kebab: string): string {
  const camel = kebabToCamel(kebab);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function titleToPascal(title: string): string {
  return title
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("")
    .replace(/[^A-Za-z0-9]/g, "");
}

function parseScreens(raw: string | undefined): ScreenSpec[] {
  if (!raw || raw.trim() === "") {
    // Default: one screen from package name / README title leftovers
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      name?: string;
      description?: string;
    };
    const id = pkg.name && pkg.name !== "scenerystack-template" ? pkg.name : "sim";
    const titleGuess =
      // Prefer vite/html title already rewritten by rename
      (() => {
        try {
          const html = readFileSync(join(ROOT, "index.html"), "utf8");
          const m = html.match(/<title>([^<]+)<\/title>/);
          if (m?.[1] && m[1] !== "SceneryStack Template") {
            return m[1].trim();
          }
        } catch {
          // ignore
        }
        return null;
      })() ?? kebabToPascal(id);
    return [specFromParts(toKebab(id), titleGuess)];
  }

  // Split on commas not inside quotes
  const parts: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (const ch of raw) {
    if (ch === '"' && !inQuotes) {
      inQuotes = true;
      continue;
    }
    if (ch === '"' && inQuotes) {
      inQuotes = false;
      continue;
    }
    if (ch === "," && !inQuotes) {
      if (cur.trim()) {
        parts.push(cur.trim());
      }
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) {
    parts.push(cur.trim());
  }

  return parts.map((part) => {
    const colon = part.indexOf(":");
    if (colon !== -1) {
      const kebab = toKebab(part.slice(0, colon));
      const title = part.slice(colon + 1).trim();
      return specFromParts(kebab, title);
    }
    const title = part.trim();
    return specFromParts(toKebab(title), title);
  });
}

function specFromParts(kebab: string, title: string): ScreenSpec {
  if (!kebab) {
    console.error("Invalid screen name (empty kebab).");
    process.exit(1);
  }
  const pascal = titleToPascal(title) || kebabToPascal(kebab);
  const key = kebabToCamel(kebab);
  return {
    key,
    kebab,
    pascal,
    title,
    tandem: `${key}Screen`,
  };
}

function detectPrefix(explicit: string | undefined): string {
  if (explicit) {
    return explicit;
  }
  const colors = readdirSync(SRC).filter((f) => f.endsWith("Colors.ts"));
  const only = colors.length === 1 ? colors[0] : undefined;
  if (only) {
    return basename(only, "Colors.ts");
  }
  if (existsSync(join(SRC, "SimColors.ts"))) {
    return "Sim";
  }
  console.error("Could not detect sim prefix from *Colors.ts; pass --prefix.");
  process.exit(1);
}

function replaceAll(str: string, search: string, replacement: string): string {
  return str.split(search).join(replacement);
}

function transformPrototype(text: string, screen: ScreenSpec, simPrefix: string): string {
  // Longest class names first
  let out = text;
  const pairs: Array<[string, string]> = [
    ["SimScreenSummaryContent", `${screen.pascal}ScreenSummaryContent`],
    ["SimKeyboardHelpContent", `${screen.pascal}KeyboardHelpContent`],
    ["SimScreenView", `${screen.pascal}ScreenView`],
    ["SimScreen", `${screen.pascal}Screen`],
    ["SimModel", `${screen.pascal}Model`],
    ["getA11yStrings()", `get${screen.pascal}A11yStrings()`],
  ];
  for (const [from, to] of pairs) {
    out = replaceAll(out, from, to);
  }
  // The prototype header tells the reader to run scaffold-screens; in emitted screens that
  // advice is stale, so point at main.ts and the shared icon module instead.
  out = out.replace(
    / \* For multi-screen simulations, run `npm run scaffold-screens` \(preferred\) or\n \* duplicate this file \(e\.g\. IntroScreen\.ts, LabScreen\.ts\), add each screen to the\n \* screens array in src\/main\.ts, and put shared create\*Icon\(\) factories in\n \* src\/common\/\{SimName\}ScreenIcons\.ts \(see doc\/multi-screen\.md\)\.\n/,
    ` * Registered in the screens array in src/main.ts. Its home-screen and navigation-bar\n * icons come from create${screen.pascal}Icon() in src/common/${simPrefix}ScreenIcons.ts\n * (see doc/multi-screen.md).\n`,
  );

  // Placeholder label: prefer screen title over leftover sim title
  out = out.replace(
    /new Text\("([^"]*)", \{/,
    `new Text("${screen.title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}", {`,
  );

  // Inject screen icons into Screen class defaults when transforming *Screen.ts
  if (out.includes(`export class ${screen.pascal}Screen`) && !out.includes("homeScreenIcon")) {
    const iconImport = `import { create${screen.pascal}Icon } from "../common/${simPrefix}ScreenIcons.js";\n`;
    out = out.replace(
      `import ${simPrefix}Colors from "../${simPrefix}Colors.js";\n`,
      `import ${simPrefix}Colors from "../${simPrefix}Colors.js";\n${iconImport}`,
    );
    // Also handle still-SimColors path if somehow unchanged
    if (!out.includes(`${simPrefix}ScreenIcons`)) {
      out = out.replace(/import (\w+)Colors from "\.\.\/\1Colors\.js";\n/, (m) => `${m}${iconImport}`);
    }
    out = out.replace(
      `createKeyboardHelpNode: () => new ${screen.pascal}KeyboardHelpContent(),`,
      [
        `createKeyboardHelpNode: () => new ${screen.pascal}KeyboardHelpContent(),`,
        `          homeScreenIcon: create${screen.pascal}Icon(),`,
        `          navigationBarIcon: create${screen.pascal}Icon(),`,
      ].join("\n"),
    );
  }

  return out;
}

function findPrototypeDir(): string {
  const preferred = join(SRC, "sim-screen");
  if (existsSync(preferred) && existsSync(join(preferred, "SimScreen.ts"))) {
    return preferred;
  }
  // Legacy post-rename layout: {id}-screen/
  for (const entry of readdirSync(SRC, { withFileTypes: true })) {
    if (!(entry.isDirectory() && entry.name.endsWith("-screen"))) {
      continue;
    }
    const full = join(SRC, entry.name);
    const screens = readdirSync(full).filter((f) => f.endsWith("Screen.ts") && !f.includes("View"));
    if (screens.length === 1) {
      return full;
    }
  }
  console.error("No prototype screen package found (expected src/sim-screen/).");
  process.exit(1);
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function emitScreenPackage(protoDir: string, screen: ScreenSpec, simPrefix: string): void {
  const destRoot = join(SRC, screen.kebab);
  if (existsSync(destRoot)) {
    console.error(`Refusing to overwrite existing screen folder: src/${screen.kebab}/`);
    process.exit(1);
  }

  // Map prototype relative paths → dest paths with renamed filenames
  const files = walkFiles(protoDir);
  for (const from of files) {
    const rel = relative(protoDir, from);
    const destRel = rel
      .split(/[/\\]/)
      .map((seg) => {
        let s = seg;
        s = replaceAll(s, "SimScreenSummaryContent", `${screen.pascal}ScreenSummaryContent`);
        s = replaceAll(s, "SimKeyboardHelpContent", `${screen.pascal}KeyboardHelpContent`);
        s = replaceAll(s, "SimScreenView", `${screen.pascal}ScreenView`);
        s = replaceAll(s, "SimScreen", `${screen.pascal}Screen`);
        s = replaceAll(s, "SimModel", `${screen.pascal}Model`);
        // Legacy renamed prototype files ({Prefix}Screen.ts)
        if (simPrefix !== "Sim") {
          s = replaceAll(s, `${simPrefix}ScreenSummaryContent`, `${screen.pascal}ScreenSummaryContent`);
          s = replaceAll(s, `${simPrefix}KeyboardHelpContent`, `${screen.pascal}KeyboardHelpContent`);
          s = replaceAll(s, `${simPrefix}ScreenView`, `${screen.pascal}ScreenView`);
          s = replaceAll(s, `${simPrefix}Screen`, `${screen.pascal}Screen`);
          s = replaceAll(s, `${simPrefix}Model`, `${screen.pascal}Model`);
        }
        return s;
      })
      .join("/");

    const to = join(destRoot, destRel);
    mkdirSync(dirname(to), { recursive: true });
    let text = readFileSync(from, "utf8");

    // If prototype was already renamed at class level, map Prefix* → screen*
    if (simPrefix !== "Sim" && text.includes(`${simPrefix}Screen`)) {
      text = replaceAll(text, `${simPrefix}ScreenSummaryContent`, "SimScreenSummaryContent");
      text = replaceAll(text, `${simPrefix}KeyboardHelpContent`, "SimKeyboardHelpContent");
      text = replaceAll(text, `${simPrefix}ScreenView`, "SimScreenView");
      text = replaceAll(text, `${simPrefix}Screen`, "SimScreen");
      text = replaceAll(text, `${simPrefix}Model`, "SimModel");
    }

    text = transformPrototype(text, screen, simPrefix);
    writeFileSync(to, text, "utf8");
    console.log(`  wrote    ${relative(ROOT, to)}`);
  }
}

function writeScreenIcons(screens: ScreenSpec[], simPrefix: string): void {
  const path = join(SRC, "common", `${simPrefix}ScreenIcons.ts`);
  const exports = screens
    .map(
      (s) => `
export function create${s.pascal}Icon(): ScreenIcon {
  return iconFrom(
    new Node({
      children: [background()],
    }),
  );
}`,
    )
    .join("\n");

  const body = `/**
 * ${simPrefix}ScreenIcons.ts
 *
 * Programmatic home-screen / navigation-bar icons for each screen.
 * Drawn on the standard PhET 548 × 373 canvas using ${simPrefix}Colors.
 * Replace the stub backgrounds with screen-specific motifs.
 */
import { Node, Rectangle } from "scenerystack/scenery";
import { ScreenIcon } from "scenerystack/sim";
import ${simPrefix}Colors from "../${simPrefix}Colors.js";

const W = 548;
const H = 373;

function background(): Rectangle {
  return new Rectangle(0, 0, W, H, { fill: ${simPrefix}Colors.backgroundColorProperty });
}

function iconFrom(content: Node): ScreenIcon {
  return new ScreenIcon(content, {
    maxIconWidthProportion: 1,
    maxIconHeightProportion: 1,
    fill: ${simPrefix}Colors.backgroundColorProperty,
  });
}
${exports}
`;
  writeFileSync(path, body, "utf8");
  console.log(`  wrote    ${relative(ROOT, path)}`);
}

function updateLocaleFiles(screens: ScreenSpec[]): void {
  const localeFiles = ["strings_en.json", "strings_es.json", "strings_fr.json"];
  for (const file of localeFiles) {
    const path = join(SRC, "i18n", file);
    const json = JSON.parse(readFileSync(path, "utf8")) as {
      title: string;
      screens: Record<string, string>;
      a11y: Record<string, unknown>;
      preferences: unknown;
    };

    const flatA11y = json.a11y;
    // Detect the shape structurally: the single-screen prototype has screenSummary at the
    // top level, a scaffolded sim has it one level down under each screen key. Never infer
    // from the requested screen keys — a screen named "Controls" collides with the
    // prototype's a11y.controls block and would nest the wrong subtree.
    const isFlat = Object.hasOwn(flatA11y, "screenSummary");
    const firstNestedKey = Object.keys(flatA11y)[0];
    const templateA11y = isFlat
      ? flatA11y
      : firstNestedKey !== undefined
        ? (flatA11y[firstNestedKey] as Record<string, unknown>)
        : flatA11y;

    const screensObj: Record<string, string> = {};
    const a11yObj: Record<string, unknown> = {};
    for (const s of screens) {
      screensObj[s.key] = s.title;
      // Keep English template copy for es/fr stubs (translator can refine later)
      a11yObj[s.key] = structuredClone(templateA11y);
    }
    json.screens = screensObj;
    json.a11y = a11yObj;
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`, "utf8");
    console.log(`  updated  ${relative(ROOT, path)}`);
  }
}

function updateStringManager(screens: ScreenSpec[]): void {
  const path = join(SRC, "i18n", "StringManager.ts");
  let text = readFileSync(path, "utf8");

  const nameFields = screens.map((s) => `    readonly ${s.key}StringProperty: ReadOnlyProperty<string>;`).join("\n");
  const nameReturns = screens
    .map((s) => `      ${s.key}StringProperty: stringProperties.screens.${s.key}StringProperty,`)
    .join("\n");

  const a11yGetters = screens
    .map(
      (s) => `  /** Accessibility strings for the ${s.title} screen. */
  public get${s.pascal}A11yStrings() {
    return stringProperties.a11y.${s.key};
  }`,
    )
    .join("\n\n");

  const methods = `  /**
   * The simulation title shown in the navigation bar and browser tab.
   * Updates automatically when the locale changes.
   */
  public getTitleStringProperty(): ReadOnlyProperty<string> {
    return stringProperties.titleStringProperty;
  }

  /**
   * Screen name StringProperties used when constructing Screen instances.
   * Each property updates automatically when the locale changes.
   */
  public getScreenNames(): {
${nameFields}
  } {
    return {
${nameReturns}
    };
  }

${a11yGetters}

  /**
   * Simulation-specific preference labels shown in Preferences → Simulation.
   */
  public getPreferences() {
    return stringProperties.preferences;
  }
}
`;

  // Replace from the first instance method through the end of the class.
  const start = text.indexOf("  /**\n   * The simulation title");
  const altStart = text.indexOf("  public getTitleStringProperty");
  const cut = start !== -1 ? start : altStart;
  if (cut === -1) {
    console.error("StringManager.ts: could not find getTitleStringProperty to rewrite.");
    process.exit(1);
  }
  // Drop any leftover methods if title block was already removed (re-run / partial)
  const classOpen = text.indexOf("export class StringManager");
  const getInstanceEnd = text.indexOf("return StringManager.instance;", classOpen);
  const afterGetInstance = text.indexOf("}", getInstanceEnd);
  const afterBlock = text.indexOf("}", afterGetInstance + 1);
  // Prefer cutting at title JSDoc when present; else right after getInstance()
  const rewriteFrom = cut !== -1 ? cut : afterBlock + 1;
  const before = text.slice(0, rewriteFrom).replace(/\s+$/, "\n\n");
  text = `${before}${methods}`;

  writeFileSync(path, text, "utf8");
  console.log(`  updated  ${relative(ROOT, path)}`);
}

function updateMain(screens: ScreenSpec[], simPrefix: string): void {
  const path = join(SRC, "main.ts");
  let text = readFileSync(path, "utf8");

  // Drop old screen imports (sim-screen or any ./…/…Screen.js)
  text = text.replace(/^import \{ \w+Screen \} from "\.\/.+Screen\.js";\n/gm, "");
  text = text.replace(/^import \{ \w+RootModel \} from "\.\/model\/\w+RootModel\.js";\n/gm, "");
  text = text.replace(/^import \{ SharedModel \} from "\.\/common\/model\/SharedModel\.js";\n/gm, "");

  const imports = screens
    .map((s) => `import { ${s.pascal}Screen } from "./${s.kebab}/${s.pascal}Screen.js";`)
    .join("\n");

  // Insert after SimColors / *Colors import
  if (/import \w+Colors from "\.\/\w+Colors\.js";\n/.test(text)) {
    text = text.replace(/(import \w+Colors from "\.\/\w+Colors\.js";\n)/, `$1${imports}\n`);
  } else {
    text = text.replace(/(import "\.\/brand\.js";\n)/, `$1\n${imports}\n`);
  }

  const screenEntries = screens
    .map(
      (s) => `    new ${s.pascal}Screen({
      name: stringManager.getScreenNames().${s.key}StringProperty,
      tandem: Tandem.ROOT.createTandem("${s.tandem}"),
      backgroundColorProperty: ${simPrefix}Colors.backgroundColorProperty,
    }),`,
    )
    .join("\n");

  const screensBlock = `  const screens = [
${screenEntries}
  ];`;

  text = text.replace(/ {2}const screens = \[[\s\S]*?\];/, screensBlock);

  writeFileSync(path, text, "utf8");
  console.log(`  updated  ${relative(ROOT, path)}`);
}

/**
 * Docs shipped with the template point at the `sim-screen/` prototype and its `Sim*`
 * classes, which no longer exist once screens are emitted. Rewrite those references to
 * the first screen (as the fleet forks did by hand) so no `Sim*` name survives the fork.
 */
function updateDocs(screens: ScreenSpec[], simPrefix: string): void {
  const first = screens[0];
  if (!first) {
    return;
  }
  const docDir = join(ROOT, "doc");
  const paths = [join(ROOT, "AGENTS.md"), join(ROOT, "README.md")];
  if (existsSync(docDir)) {
    for (const entry of readdirSync(docDir)) {
      if (entry.endsWith(".md")) {
        paths.push(join(docDir, entry));
      }
    }
  }

  // Longest names first so shorter ones do not eat their prefixes.
  const pairs: Array<[string, string]> = [
    ["src/sim-screen", `src/${first.kebab}`],
    ["sim-screen/", `${first.kebab}/`],
    ["SimScreenSummaryContent", `${first.pascal}ScreenSummaryContent`],
    ["SimKeyboardHelpContent", `${first.pascal}KeyboardHelpContent`],
    ["SimScreenView", `${first.pascal}ScreenView`],
    ["SimScreenOptions", `${first.pascal}ScreenOptions`],
    ["SimScreen", `${first.pascal}Screen`],
    ["SimModel", `${first.pascal}Model`],
    ["getA11yStrings()", `get${first.pascal}A11yStrings()`],
    ["{SimName}ScreenIcons", `${simPrefix}ScreenIcons`],
  ];

  // Template-only prose in doc/multi-screen.md: token substitution alone would leave a
  // fork claiming to ship an un-scaffolded prototype.
  const screenList = screens.map((s) => `\`src/${s.kebab}/\``).join(", ");
  const prose: Array<[string, string]> = [
    [
      "This template ships as a **single-screen** prototype (`src/sim-screen/`). New sims\nshould call `npm run scaffold-screens` (or `Baton/scripts/create-sim.sh`) so screen\nfolders use fleet naming (`src/intro/`, not `intro-screen/`). This guide covers the\narchitecture and how to extend an existing sim by hand.",
      `This sim was scaffolded by \`npm run scaffold-screens\` into ${screenList} (fleet naming:\nkebab folders with no \`-screen\` suffix). This guide covers the architecture and how to add\nanother screen by hand.`,
    ],
    [
      "## Automated scaffold (preferred)\n\nAfter `npm run rename` (or via `create-sim.sh`):",
      "## Automated scaffold (preferred)\n\nAlready run for this sim — the prototype folder is gone, so a second run exits early.\nKept as reference for the next sim:",
    ],
  ];

  for (const path of paths) {
    let original: string;
    try {
      original = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    let text = original;
    if (basename(path) === "multi-screen.md") {
      for (const [from, to] of prose) {
        text = replaceAll(text, from, to);
      }
    }
    for (const [from, to] of pairs) {
      text = replaceAll(text, from, to);
    }
    if (text !== original) {
      writeFileSync(path, text, "utf8");
      console.log(`  updated  ${relative(ROOT, path)}`);
    }
  }
}

/**
 * Fleet pattern (ACPhasor RlcCircuitModel, RotatingSky SkyModel, MotionsOfTheSun
 * TimeMaster): domain helpers live under common/model/ and each screen model
 * composes its own instance. Rename SharedModel to a domain noun when you know it.
 */
function writeSharedModel(): void {
  const dir = join(SRC, "common", "model");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "SharedModel.ts");
  const body = `/**
 * SharedModel.ts
 *
 * Stub for cross-screen physics/state helpers. Lives under common/model/ per
 * Baton CONVENTIONS (no top-level src/model/). Fleet sims use domain names here
 * (e.g. SkyModel, RlcCircuitModel, TimeMaster) — rename this file when the
 * domain is clear.
 *
 * Each screen model typically owns its own instance (\`new SharedModel()\`), matching
 * ACPhasor / RotatingSky. For a single live instance shared across screens, construct
 * once in main.ts and pass it into each Screen/Model instead.
 */
import { BooleanProperty } from "scenerystack/axon";

export class SharedModel {
  /** Example shared toggle — replace with real cross-screen Properties. */
  public readonly exampleEnabledProperty = new BooleanProperty(false);

  public reset(): void {
    this.exampleEnabledProperty.reset();
  }
}
`;
  writeFileSync(path, body, "utf8");
  console.log(`  wrote    ${relative(ROOT, path)}`);
}

/**
 * Compose SharedModel into each screen model (fleet style — not injected from main).
 */
function wireSharedModel(screens: ScreenSpec[]): void {
  for (const screen of screens) {
    const modelPath = join(SRC, screen.kebab, "model", `${screen.pascal}Model.ts`);
    let model = readFileSync(modelPath, "utf8");
    if (model.includes("SharedModel")) {
      continue;
    }

    model = model.replace(
      /import type \{ TModel \} from "scenerystack\/joist";\n/,
      `import type { TModel } from "scenerystack/joist";\nimport { SharedModel } from "../../common/model/SharedModel.js";\n`,
    );
    model = model.replace(
      new RegExp(`export class ${screen.pascal}Model implements TModel \\{\\n`),
      `export class ${screen.pascal}Model implements TModel {\n` +
        `  /** Shared helpers — rename SharedModel to a domain type when known. */\n` +
        `  public readonly shared = new SharedModel();\n\n`,
    );
    if (model.includes("public reset(): void {") && !model.includes("this.shared.reset()")) {
      model = model.replace(/public reset\(\): void \{\n/, "public reset(): void {\n    this.shared.reset();\n");
    }
    writeFileSync(modelPath, model, "utf8");
    console.log(`  updated  ${relative(ROOT, modelPath)}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  const screenList = parseScreens(getArg("--screens"));
  const prefix = detectPrefix(getArg("--prefix"));
  const sharedModel = hasFlag("--shared-model");
  const protoDir = findPrototypeDir();

  // Validate unique kebabs / keys
  const kebabs = new Set<string>();
  const keys = new Set<string>();
  for (const s of screenList) {
    if (kebabs.has(s.kebab) || keys.has(s.key)) {
      console.error(`Duplicate screen id: ${s.kebab} / ${s.key}`);
      process.exit(1);
    }
    kebabs.add(s.kebab);
    keys.add(s.key);
  }

  console.log("\nScaffolding screens:");
  for (const s of screenList) {
    console.log(`  - ${s.title}  →  src/${s.kebab}/  (${s.pascal}*, key=${s.key})`);
  }
  console.log(`  sim prefix: ${prefix}`);
  console.log(`  prototype:  ${relative(ROOT, protoDir)}`);
  console.log(`  shared model (common/model): ${sharedModel ? "yes" : "no"}`);
  console.log("");

  for (const s of screenList) {
    emitScreenPackage(protoDir, s, prefix);
  }

  writeScreenIcons(screenList, prefix);
  updateLocaleFiles(screenList);
  updateStringManager(screenList);
  if (sharedModel) {
    writeSharedModel();
    wireSharedModel(screenList);
  }
  updateMain(screenList, prefix);

  console.log("\nRewriting docs that referenced the prototype…");
  updateDocs(screenList, prefix);

  console.log("\nRemoving prototype screen package…");
  rmSync(protoDir, { recursive: true, force: true });
  console.log(`  removed  ${relative(ROOT, protoDir)}`);

  console.log("\nDone.");
  console.log("\nNext steps:");
  console.log("  1. npm run fix     (emitted imports need Biome's organizeImports pass)");
  console.log("  2. npm run check");
  if (screenList.length > 1) {
    console.log(`  3. docs now reference the ${screenList[0]?.title} screen only — tailor them for all screens`);
  }
}

main();
