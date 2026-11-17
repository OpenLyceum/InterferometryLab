import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // happy-dom gives a lightweight DOM so SceneryStack code can import.
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // --expose-gc lets us call global.gc() to force garbage collection
    execArgv: ["--expose-gc"],
    testTimeout: 30_000,
    // Drift guards (template-owned; see AGENTS.md → Testing):
    // a test that never calls expect() fails instead of passing vacuously,
    expect: { requireAssertions: true },
    // tests run in random order so hidden shared state between them shows up
    // (re-run a failing order with `npx vitest run --sequence.seed=<seed>`),
    sequence: { shuffle: { files: true, tests: true } },
    // spies, stubbed globals and env vars never leak into the next test,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    // and flaky tests get fixed, not retried.
    retry: 0,
  },
});
