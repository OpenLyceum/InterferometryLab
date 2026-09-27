/**
 * Optional Playwright fuzz smoke — template-owned, identical across the fleet.
 *
 * Two runs, each for FUZZ_DURATION seconds:
 *  - pointer fuzz (`?fuzz`): random mouse/touch input on the display
 *  - keyboard fuzz (`?fuzzBoard`): random keyboard input through the parallel DOM,
 *    which the pointer fuzz never touches (e.g. a CSP that blocks Scenery's inline
 *    `onclick` handlers only shows up here)
 *
 * Both carry `?ea`: without it assertions are silent and the test cannot fail on an
 * invalid internal state. Sim-specific Playwright tests go in their own
 * tests/fuzz/*.spec.ts files, not in this one.
 *
 * Usage:
 *   npm run test:fuzz                 # default 30s per run
 *   npm run test:fuzz:quick           # 10s
 *   npm run test:fuzz:long            # 300s
 *   npm run test:fuzz -- 90           # 90s
 *   npm run test:fuzz -- --duration 90
 *   FUZZ_DURATION=90 npm run test:fuzz
 *   FUZZ_SEED=12345 npm run test:fuzz
 *   FUZZ_POINTERS=5 npm run test:fuzz # multitouch
 *   FUZZ_PORT=5190 npm run test:fuzz  # parallel runs across sims
 */

import { expect, type Page, test } from "@playwright/test";

const FUZZ_DURATION_SECONDS: number = parseInt(process.env["FUZZ_DURATION"] || "30", 10);
const FUZZ_DURATION: number = FUZZ_DURATION_SECONDS * 1000;
const FUZZ_SEED: string = process.env["FUZZ_SEED"] || Math.floor(Math.random() * 1_000_000).toString();
const FUZZ_RATE: string = process.env["FUZZ_RATE"] || "100";
const FUZZ_POINTERS: string = process.env["FUZZ_POINTERS"] || "1";

interface ConsoleMessage {
  type: string;
  text: string;
  location: string;
  timestamp: number;
}

const FUZZ_MODES: readonly { readonly name: string; readonly query: string }[] = [
  { name: "pointer fuzz", query: `fuzz&fuzzRate=${FUZZ_RATE}&fuzzPointers=${FUZZ_POINTERS}` },
  { name: "keyboard fuzz", query: "fuzzBoard" },
];

test.describe("Fuzz Testing", () => {
  for (const mode of FUZZ_MODES) {
    test(`${mode.name} should run without console errors`, async ({ page }) => {
      test.setTimeout(FUZZ_DURATION + 120_000);
      await runFuzz(page, `/?${mode.query}&ea&randomSeed=${FUZZ_SEED}`);
    });
  }
});

async function runFuzz(page: Page, fuzzUrl: string): Promise<void> {
  const errors: ConsoleMessage[] = [];
  const assertions: ConsoleMessage[] = [];
  const startTime = Date.now();

  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();
    const timestamp = Date.now() - startTime;
    const message: ConsoleMessage = {
      type,
      text,
      location: `${location.url}:${location.lineNumber}:${location.columnNumber}`,
      timestamp,
    };
    if (type === "error") {
      errors.push(message);
    } else if (text.includes("Assertion failed") || text.includes("AssertionError")) {
      assertions.push(message);
    }
  });

  page.on("pageerror", (error) => {
    errors.push({
      type: "pageerror",
      text: error.message,
      location: error.stack || "unknown",
      timestamp: Date.now() - startTime,
    });
  });

  await page.goto(fuzzUrl);
  await page.waitForSelector("#sim", { timeout: 30_000 });

  const checkInterval = 2000;
  let elapsed = 0;
  while (elapsed < FUZZ_DURATION) {
    const waitTime = Math.min(checkInterval, FUZZ_DURATION - elapsed);
    await page.waitForTimeout(waitTime);
    elapsed += waitTime;
    try {
      await page.evaluate(() => window.document.hasFocus);
    } catch {
      break;
    }
  }

  // Report the messages themselves (not just a count) so a failure is readable in CI.
  expect(
    errors.map((e) => e.text),
    `Found ${errors.length} console errors (seed ${FUZZ_SEED}, ${fuzzUrl})`,
  ).toEqual([]);
  expect(
    assertions.map((a) => a.text),
    `Found ${assertions.length} assertion failures (seed ${FUZZ_SEED}, ${fuzzUrl})`,
  ).toEqual([]);
}
