import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const biome = join(root, "node_modules/@biomejs/biome/bin/biome");

// Runs the real biome.json and the real plugins over fixture files, so the override
// wiring (src/** only, *Colors.ts excluded) is tested along with each pattern.
type Hit = { path: string; line: number; message: string };

function lint(files: Record<string, string>): Hit[] {
  const directory = mkdtempSync(join(tmpdir(), "biome-plugins-"));
  try {
    const config = JSON.parse(readFileSync(join(root, "biome.json"), "utf8"));
    config.vcs = { enabled: false };
    writeFileSync(join(directory, "biome.json"), JSON.stringify(config));
    cpSync(join(root, "biome-plugins"), join(directory, "biome-plugins"), { recursive: true });
    for (const [name, source] of Object.entries(files)) {
      mkdirSync(dirname(join(directory, name)), { recursive: true });
      writeFileSync(join(directory, name), source);
    }
    const result = spawnLint(directory);
    const report = JSON.parse(result) as {
      diagnostics: { category: string; message: string; location: { path: string; start: { line: number } } }[];
    };
    return report.diagnostics
      .filter((diagnostic) => diagnostic.category === "plugin")
      .map((diagnostic) => ({
        path: diagnostic.location.path,
        line: diagnostic.location.start.line,
        message: diagnostic.message,
      }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function spawnLint(directory: string): string {
  const result = spawnSync(
    process.execPath,
    [biome, "lint", "--reporter=json", "--only=plugin", "--max-diagnostics=none", "."],
    {
      cwd: directory,
      encoding: "utf8",
      timeout: 20_000,
    },
  );
  assert.ifError(result.error);
  return result.stdout;
}

function lines(hits: Hit[], fragment: string): number[] {
  return hits.filter((hit) => hit.message.includes(fragment)).map((hit) => hit.line);
}

test("no-math-random flags Math.random() and leaves dotRandom alone", () => {
  const hits = lint({ "src/a.ts": "export const a = Math.random();\nexport const b = dotRandom.nextDouble();\n" });
  assert.deepEqual(lines(hits, "dotRandom"), [1]);
});

test("no-hardcoded-text flags literal display words only", () => {
  const hits = lint({
    "src/a.ts": [
      'new Text("Mass");',
      'new RichText("Mass", { font });',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the fixture is source text with a template literal
      "new Text(`Mass: ${m} kg`);",
      "new Text(massStringProperty, { font });",
      'new Text("×");',
      'new Text("");',
      'new Text("0.00");',
      'new Text("z");',
      'new Text("pH");',
      'new Text("KNO₃");',
      'new RichText("mc²");',
      'new RichText("B<sub>0</sub>");',
      'new RichText("Mass<sub>0</sub>");',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the fixture is source text with a template literal
      "new Text(`${value}`);",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the fixture is source text with a template literal
      "new Text(`${index + 1}`);",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the fixture is source text with a template literal
      "new Text(`${rate} Hz`);",
      "",
    ].join("\n"),
  });
  assert.deepEqual(lines(hits, "StringManager"), [1, 2, 3, 13]);
});

test("no-inline-color flags hardcoded colors outside *Colors.ts", () => {
  const source = [
    "new Color(255, 0, 0);",
    'new Path(s, { fill: "red", stroke: "#fff", lineWidth: 2 });',
    'new Color("#ff0000");',
    'new Path(s, { fill: SimColors.fooProperty, stroke: "transparent" });',
    "new Color(r, g, b);",
    "new Color(table[index]);",
    "new Color(Math.round(red), 0, 0);",
    "new Color(this.trail.r, this.trail.g, this.trail.b);",
    'new Rectangle(0, 0, 1, 1, { fill: "rgba(0,0,0,0.01)" });',
    'new Rectangle(0, 0, 1, 1, { fill: "rgba(0,0,0,0)", stroke: "rgba(0, 0, 0, 0)" });',
    'new Rectangle(0, 0, 1, 1, { fill: "rgba(0,0,0,0.45)" });',
    "",
  ].join("\n");
  const hits = lint({ "src/view/A.ts": source, "src/SimColors.ts": source });
  const colorHits = hits.filter((hit) => hit.message.includes("*Colors.ts"));
  assert.deepEqual(
    colorHits.map((hit) => `${hit.path}:${hit.line}`),
    ["src/view/A.ts:1", "src/view/A.ts:2", "src/view/A.ts:2", "src/view/A.ts:3", "src/view/A.ts:11"],
  );
});

test("plugins only run under src/", () => {
  const hits = lint({ "scripts/a.ts": 'Math.random(); new Text("Mass"); new Color(1, 2, 3);\n' });
  assert.deepEqual(hits, []);
});
