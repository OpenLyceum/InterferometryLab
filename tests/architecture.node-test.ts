import assert from "node:assert/strict";
import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = join(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");

// Use the actual CLI, parser and resolver: matching regexes alone misses graph regressions.
type Files = Record<string, string>;

function cruise(
  files: Files,
  overlay?: string,
  guidance = "",
  packageMetadata: Record<string, unknown> = {},
): SpawnSyncReturns<string> {
  const directory = mkdtempSync(join(tmpdir(), "architecture-"));
  try {
    copyFileSync(join(root, ".dependency-cruiser.cjs"), join(directory, ".dependency-cruiser.cjs"));
    mkdirSync(join(directory, "node_modules"));
    for (const name of ["scenerystack", "vitest"]) {
      symlinkSync(join(root, "node_modules", name), join(directory, "node_modules", name), "dir");
    }
    const contents: Files = {
      "package.json": JSON.stringify({
        name: "architecture-fixture",
        type: "module",
        dependencies: { scenerystack: "*" },
        devDependencies: { vitest: "*" },
        ...packageMetadata,
      }),
      "AGENTS.md": guidance,
      "node_modules/undeclared-fixture/package.json": JSON.stringify({ name: "undeclared-fixture", main: "index.js" }),
      "node_modules/undeclared-fixture/index.js": "export const value = 1;",
      ...files,
    };
    if (overlay !== undefined) {
      contents[".dependency-cruiser.local.cjs"] = overlay;
    }
    for (const [name, source] of Object.entries(contents)) {
      mkdirSync(dirname(join(directory, name)), { recursive: true });
      writeFileSync(join(directory, name), source);
    }
    const result = spawnSync(process.execPath, [cli, "--config", ".dependency-cruiser.cjs", "src"], {
      cwd: directory,
      encoding: "utf8",
      timeout: 20_000,
    });
    assert.ifError(result.error);
    return result;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function violations(result: SpawnSyncReturns<string>): string[] {
  assert.equal(result.stderr, "", result.stderr);
  return [...result.stdout.matchAll(/^\s+(?:error|warn|info) ([^:]+):/gm)].map((match) => match[1] ?? "");
}

const forbidden: [string, Files][] = [
  ["no-unresolved", { "src/main.ts": 'import "./Imagined.js";' }],
  ["no-undeclared-packages", { "src/main.ts": 'import "undeclared-fixture";' }],
  ["no-node-builtins", { "src/main.ts": 'import { readFileSync } from "node:fs";' }],
  [
    "no-src-to-tooling",
    { "src/main.ts": 'import "../scripts/helper.js";', "scripts/helper.ts": "export const x = 1;" },
  ],
  ["no-src-to-tests", { "src/main.ts": 'import "../tests/helper.js";', "tests/helper.ts": "export const x = 1;" }],
  ["not-to-dev-dep", { "src/main.test.ts": 'import { test } from "vitest";' }],
  ["no-app-to-bootstrap", { "src/common/helper.ts": 'import "../init.js";', "src/init.ts": "export const x = 1;" }],
  [
    "no-root-to-screen",
    {
      "src/main.ts": 'import "./intro/Screen.js";',
      "src/intro/Screen.ts": 'import "../root-helper.js";',
      "src/root-helper.ts": 'export * from "./lab/Screen.js";',
      "src/lab/Screen.ts": "export const screen = 1;",
    },
  ],
  [
    "no-model-to-view",
    { "src/lab/model/Model.ts": 'import "../view/View.js";', "src/lab/view/View.ts": "export const x = 1;" },
  ],
  [
    "no-model-to-view-transitive",
    {
      "src/lab/model/Model.ts": 'import "../../common/barrel.js";',
      "src/common/barrel.ts": 'export * from "../common/view/View.js";',
      "src/common/view/View.ts": "export const x = 1;",
    },
  ],
  ["no-model-to-ui-packages", { "src/lab/model/Model.ts": 'import { Node } from "scenerystack/scenery";' }],
  ["no-model-to-ui-packages", { "src/lab/model/Model.ts": 'import { Panel } from "scenerystack/sun";' }],
  [
    "no-model-to-preferences-view",
    {
      "src/lab/model/Model.ts": 'import "../../preferences/SimPreferencesNode.js";',
      "src/preferences/SimPreferencesNode.ts": "export const x = 1;",
    },
  ],
  ...["common", "preferences", "i18n"].map((folder): [string, Files] => [
    `no-${folder}-to-screen`,
    {
      [`src/${folder}/helper.ts`]: 'import "../lab/model/Model.js";',
      "src/lab/model/Model.ts": "export const x = 1;",
    },
  ]),
  [
    "no-assets-to-app",
    { "src/assets/data.ts": 'import "../common/helper.js";', "src/common/helper.ts": "export const x = 1;" },
  ],
  [
    "no-cross-screen",
    {
      "src/intro/model/Model.ts": 'import "../../lab/model/Model.js";',
      "src/lab/model/Model.ts": "export const x = 1;",
    },
  ],
  [
    "no-cross-screen",
    {
      "src/intro/model/Model.ts": 'void import("../../lab/model/Model.js");',
      "src/lab/model/Model.ts": "export const x = 1;",
    },
  ],
  ["no-circular", { "src/common/a.ts": 'import "./b.js";', "src/common/b.ts": 'import "./a.js";' }],
];

for (const [rule, files] of forbidden) {
  test(`rejects ${rule}: ${Object.keys(files)[0]}`, () => {
    const result = cruise(files);
    assert.ok(violations(result).includes(rule), result.stdout);
    assert.notEqual(result.status, 0);
  });
}

test("allows bootstrap metadata, same-screen imports, shared models, and type-only UI imports", () => {
  const result = cruise({
    "src/main.ts": 'import "./brand.js"; import "./intro/Screen.js";',
    "src/brand.ts": 'import "./splash.js";',
    "src/splash.ts": 'import "./assert.js";',
    "src/assert.ts": 'import "./init.js";',
    "src/init.ts": 'import metadata from "../package.json"; export const name = metadata.name;',
    "src/intro/Screen.ts": 'import "./model/Model.js"; import "./view/View.js";',
    "src/intro/model/Model.ts":
      'import type { Node } from "scenerystack/scenery"; import "../../common/model/SharedModel.js";',
    "src/common/model/SharedModel.ts":
      'import { NumberProperty } from "scenerystack/axon"; export const value = new NumberProperty(0);',
    "src/intro/view/View.ts": 'import "../model/Model.js";',
  });
  assert.deepEqual(violations(result), [], result.stdout);
  assert.equal(result.status, 0);
});

test("uses the fleet config when another default config is present", () => {
  const result = cruise({
    ".dependency-cruiser.json": '{ "forbidden": [] }',
    "src/main.ts": 'import "./missing.js";',
  });
  assert.deepEqual(violations(result), ["no-unresolved"], result.stdout);
  assert.notEqual(result.status, 0);
});

const source = { "src/main.ts": 'import "./missing.js";' };
const failClosedOverlays: [string, string][] = [
  ["missing overlay dependency", 'require("./absent.cjs");'],
  ["overlay runtime exception", 'throw new Error("overlay exploded");'],
  ["malformed overlay", "module.exports = null;"],
  ["unknown rule omission", 'module.exports = { omitRules: ["typo"] };'],
  ["undocumented rule omission", 'module.exports = { omitRules: ["no-unresolved"] };'],
  ["parser override", 'module.exports = { options: { parser: "tsc" } };'],
  [
    "duplicate rule",
    'module.exports = { forbidden: [{ name: "no-unresolved", severity: "ignore", from: {}, to: {} }] };',
  ],
  ["undocumented exclusion", 'module.exports = { options: { exclude: "^src/main\\\\.ts$" } };'],
];

for (const [description, overlay] of failClosedOverlays) {
  test(`fails closed on ${description}`, () => {
    const result = cruise(source, overlay);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.length > 0, result.stdout);
  });
}

test("accepts an explicitly documented rule omission", () => {
  const result = cruise(
    source,
    'module.exports = { omitRules: ["no-unresolved"] };',
    "## Compliance carve-outs\n- `no-unresolved`: fixture intentionally imports a missing file.\n",
  );
  assert.ok(!violations(result).includes("no-unresolved"));
});

test("accepts documented file exclusions without changing remaining rules", () => {
  const result = cruise(
    { ...source, "src/common/unsupported.ts": "export const unused = 1;" },
    'module.exports = { options: { exclude: { path: ["^src/common/unsupported\\\\.ts$"] } } };',
    "## Compliance carve-outs\n- `.dependency-cruiser.local.cjs`: skip a parser-unsupported fixture.\n",
  );
  assert.deepEqual(violations(result), ["no-unresolved"]);
});

test("allows cycles broken by an erased type-only edge", () => {
  const result = cruise({
    "src/main.ts": 'import "./common/a.js";',
    "src/common/a.ts": 'import { value } from "./b.js"; export type A = typeof value;',
    "src/common/b.ts": 'import type { A } from "./a.js"; export const value = 1;',
  });
  assert.deepEqual(violations(result), [], result.stdout);
  assert.equal(result.status, 0);
});

test("accepts additional uniquely named local rules", () => {
  const result = cruise(
    { "src/main.ts": 'import "./common/helper.js";', "src/common/helper.ts": "export const x = 1;" },
    'module.exports = { forbidden: [{ name: "local-boundary", severity: "error", from: { path: "^src/main" }, to: { path: "^src/common/" } }] };',
  );
  assert.deepEqual(violations(result), ["local-boundary"]);
  assert.notEqual(result.status, 0);
});

test("rejects an exclusion that matches everything, even when documented", () => {
  const result = cruise(
    source,
    'module.exports = { options: { exclude: ".*" } };',
    "## Compliance carve-outs\n- `.dependency-cruiser.local.cjs`: intentionally overbroad fixture.\n",
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must not match the empty string/);
});

test("allows static images outside src while rejecting executable asset helpers", () => {
  const image = cruise({
    "src/main.ts": 'import image from "../assets/photo.jpg";',
    "assets/photo.jpg": "image fixture",
  });
  assert.deepEqual(violations(image), [], image.stdout);
  assert.equal(image.status, 0);
  const helper = cruise({
    "src/main.ts": 'import "../assets/helper.js";',
    "assets/helper.ts": "export const value = 1;",
  });
  assert.ok(violations(helper).includes("no-src-to-tooling"), helper.stdout);
  assert.notEqual(helper.status, 0);
});

test("rejects model value imports of root color modules", () => {
  const result = cruise({
    "src/main.ts": 'import "./lab/model/Model.js";',
    "src/lab/model/Model.ts": 'import "../../FixtureColors.js";',
    "src/FixtureColors.ts": "export const palette = {};",
  });
  assert.ok(violations(result).includes("no-model-to-colors"), result.stdout);
  assert.notEqual(result.status, 0);
});

test("allows erased model imports of color-module types", () => {
  const result = cruise({
    "src/main.ts": 'import "./lab/model/Model.js";',
    "src/lab/model/Model.ts": 'import type { Palette } from "../../FixtureColors.js"; export type Model = Palette;',
    "src/FixtureColors.ts": "export type Palette = { name: string };",
  });
  assert.deepEqual(violations(result), [], result.stdout);
  assert.equal(result.status, 0);
});

test("rejects unreachable modules even when they have outgoing dependencies", () => {
  const result = cruise({
    "src/main.ts": 'import "./common/live.js";',
    "src/common/live.ts": "export const value = 1;",
    "src/common/dead.ts": 'export { value } from "./live.js";',
  });
  assert.deepEqual(violations(result), ["no-unreachable-from-entry"], result.stdout);
  assert.notEqual(result.status, 0);
});

test("allows literal dynamic entry imports and ambient declarations", () => {
  const result = cruise({
    "src/main.ts": 'void import("./common/lazy.js");',
    "src/common/lazy.ts": "export const value = 1;",
    "src/environment.d.ts": "declare const environment: string;",
  });
  assert.deepEqual(violations(result), [], result.stdout);
  assert.equal(result.status, 0);
});

test("optional toolkit entry points belong to the template only", () => {
  const files = {
    "src/main.ts": 'import "scenerystack/axon";',
    "src/common/SimControlOptions.ts": 'import "scenerystack/sun";',
    "src/common/SimPanel.ts": 'import "scenerystack/sun";',
    "src/common/TimeModel.ts": 'import "scenerystack/axon";',
  };
  const template = cruise(files, undefined, "", { name: ["scenerystack", "template"].join("-") });
  assert.deepEqual(violations(template), [], template.stdout);
  assert.equal(template.status, 0);
  const fork = cruise(files);
  assert.equal(violations(fork).filter((rule) => rule === "no-unreachable-from-entry").length, 3, fork.stdout);
  assert.notEqual(fork.status, 0);
});

test("rejects an imported package declared in multiple dependency categories", () => {
  const result = cruise({ "src/main.ts": 'import "scenerystack/axon";' }, undefined, "", {
    devDependencies: { scenerystack: "*", vitest: "*" },
  });
  assert.ok(violations(result).includes("no-duplicate-dep-types"), result.stdout);
  assert.notEqual(result.status, 0);
});

test("warns on installed package deprecation metadata", () => {
  const result = cruise(
    {
      "src/main.ts": 'import "deprecated-fixture";',
      "node_modules/deprecated-fixture/package.json": JSON.stringify({
        name: "deprecated-fixture",
        main: "index.js",
        deprecated: "Use its replacement.",
      }),
      "node_modules/deprecated-fixture/index.js": "export const value = 1;",
    },
    undefined,
    "",
    { dependencies: { "deprecated-fixture": "*" } },
  );
  assert.deepEqual(violations(result), ["not-to-deprecated"], result.stdout);
  assert.equal(result.status, 0);
});

test("resolves browser conditional exports, browser entry fields and browser aliases", () => {
  const result = cruise(
    {
      "src/main.ts": 'import "conditional-fixture"; import "entry-fixture"; import "alias-fixture";',
      "node_modules/conditional-fixture/package.json": JSON.stringify({
        name: "conditional-fixture",
        exports: { node: "./missing-node.js", browser: "./browser.js", default: "./missing-default.js" },
      }),
      "node_modules/conditional-fixture/browser.js": "export const value = 1;",
      "node_modules/entry-fixture/package.json": JSON.stringify({
        name: "entry-fixture",
        browser: "browser.js",
        main: "missing-node.js",
      }),
      "node_modules/entry-fixture/browser.js": "export const value = 1;",
      "node_modules/alias-fixture/package.json": JSON.stringify({
        name: "alias-fixture",
        main: "node.js",
        browser: { "./node.js": "./browser.js" },
      }),
      "node_modules/alias-fixture/browser.js": "export const value = 1;",
    },
    undefined,
    "",
    { dependencies: { "conditional-fixture": "*", "entry-fixture": "*", "alias-fixture": "*" } },
  );
  assert.deepEqual(violations(result), [], result.stdout);
  assert.equal(result.status, 0);
});
