/**
 * Vitest config for the by-hand headless soak (`npm run test:soak:headless`). Template-owned.
 *
 * Kept apart from vitest.config.ts so `npm test` and CI never run it. SOAK_HEADLESS=1 tells
 * tests/setup.ts to enable every locale and the projector color profile.
 */

import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.js";

const merged = mergeConfig(
  base,
  defineConfig({
    test: {
      env: { SOAK_HEADLESS: "1" },
      // Print the coverage line even when the soak passes.
      silent: false,
      testTimeout: 600_000,
      // One long test per file; shuffling only reorders files.
      sequence: { shuffle: { files: true, tests: false } },
    },
  }),
);
// mergeConfig concatenates arrays; the soak must replace the unit-test include list.
merged["test"] = { ...merged["test"], include: ["tests/soak/**/*.soak.ts"] };

export default merged;
