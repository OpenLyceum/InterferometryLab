/**
 * Browser soak — template-owned, identical across the fleet.
 *
 * Not part of Fleet Health's fuzz smoke. Run explicitly:
 *   npm run test:soak:browser   (npm run test:soak runs the headless soak first)
 *
 * Each scenario repeats one sim-agnostic workload, forcing GC and sampling the JS heap
 * after every round. It fails when the final sample exceeds the post-warm-up baseline
 * by more than SOAK_MAX_GROWTH×, or when the heap rose at every sample and the total
 * climb exceeds SOAK_MAX_CLIMB_MIB (a steady leak too small for the ratio). Catches retained listeners / nodes / histories that
 * the unit WeakRef suites miss when objects are intentionally long-lived.
 *
 *   Reset All        activate Reset All on the first screen, SOAK_ROUNDS times
 *   Screen cycling   visit every nav-bar screen, SOAK_ROUNDS times (skipped for one screen)
 *   Running          on each screen press Play (if present) and let it animate,
 *                    sampling every SOAK_RUN_SECONDS / SOAK_SAMPLES seconds
 *   Pointer fuzz     the sim's own ?fuzz input driver (drags, presses, screen changes,
 *                    Reset All) for SOAK_FUZZ_SECONDS, sampling as it goes
 *   Keyboard fuzz    ?fuzzBoard through the parallel DOM, same sampling
 *
 * The fuzz scenarios are the ones that find interaction leaks (a listener added per
 * drag, a node per click, data rows never cleared). Reproduce a failure with the seed
 * printed in the test name: SOAK_SEED=<seed> npm run test:soak:browser.
 *
 * Env: SOAK_ROUNDS (15), SOAK_RUN_SECONDS (20 per screen), SOAK_SAMPLES (5),
 * SOAK_FUZZ_SECONDS (60 per mode), SOAK_SEED (random; shared with the headless soak), SOAK_FUZZ_RATE (100),
 * SOAK_MAX_GROWTH (1.75), SOAK_MAX_CLIMB_MIB (8). Sim-specific soak scenarios go in a separate
 * tests/browser/*.spec.ts file, not here.
 *
 * Requires Chromium flags: --js-flags=--expose-gc and --enable-precise-memory-info
 * (set at file scope so fuzz stays unchanged).
 */

import { writeFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

const SOAK_ROUNDS: number = Math.max(5, parseInt(process.env["SOAK_ROUNDS"] || "15", 10) || 15);
const SOAK_RUN_SECONDS: number = Math.max(5, parseFloat(process.env["SOAK_RUN_SECONDS"] || "20") || 20);
const SOAK_SAMPLES: number = Math.max(3, parseInt(process.env["SOAK_SAMPLES"] || "5", 10) || 5);
/** Allow modest heap noise from caches / JIT; fail on clear linear growth. */
const MAX_GROWTH_RATIO: number = parseFloat(process.env["SOAK_MAX_GROWTH"] || "1.75") || 1.75;
/** A heap that rose at every sample may climb at most this much in total. */
const MAX_CLIMB_BYTES: number = (parseFloat(process.env["SOAK_MAX_CLIMB_MIB"] || "8") || 8) * 1024 * 1024;
const SOAK_FUZZ_SECONDS: number = Math.max(10, parseFloat(process.env["SOAK_FUZZ_SECONDS"] || "60") || 60);
const SOAK_SEED: string = process.env["SOAK_SEED"] || String(Math.floor(Math.random() * 1_000_000));
const SOAK_FUZZ_RATE: string = process.env["SOAK_FUZZ_RATE"] || "100";

/** Same input drivers as tests/fuzz/fuzz.spec.ts; the fuzzer is seeded through randomSeed. */
const FUZZ_MODES: readonly { readonly label: string; readonly query: string }[] = [
  { label: "pointer-fuzz", query: `fuzz&fuzzRate=${SOAK_FUZZ_RATE}` },
  { label: "keyboard-fuzz", query: "fuzzBoard" },
];

/** Nav-bar buttons are named "<Screen name> Screen"; exclude full-screen toggles. */
const SCREEN_BUTTON = /^(?!.*full ?screen).+ screen$/i;

test.use({
  launchOptions: {
    args: [
      "--js-flags=--expose-gc",
      "--enable-precise-memory-info",
      "--enable-unsafe-webgpu",
      "--enable-features=Vulkan",
    ],
  },
});

test.describe("Browser soak", () => {
  test(`Reset All × ${SOAK_ROUNDS} keeps JS heap growth bounded`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors = await openSim(page);

    await soak(page, "reset-all", {
      warmUp: () => clickResetAll(page),
      round: () => clickResetAll(page),
      rounds: SOAK_ROUNDS,
    });
    expectNoErrors(errors);
  });

  test(`Screen cycling × ${SOAK_ROUNDS} keeps JS heap growth bounded`, async ({ page }) => {
    test.setTimeout(300_000);
    const errors = await openSim(page);
    const screens = await screenButtonNames(page);
    test.skip(screens.length < 2, "single-screen sim: nothing to cycle");

    const visitAll = async (): Promise<void> => {
      for (const name of screens) {
        await goToScreen(page, name);
      }
    };
    await soak(page, "screen-cycling", { warmUp: visitAll, round: visitAll, rounds: SOAK_ROUNDS });
    expectNoErrors(errors);
  });

  test(`Running ${SOAK_RUN_SECONDS}s per screen keeps JS heap growth bounded`, async ({ page }) => {
    const errors = await openSim(page);
    const screens = await screenButtonNames(page);
    // One soak per screen, plus warm-up and load headroom.
    test.setTimeout((Math.max(1, screens.length) * SOAK_RUN_SECONDS * 1.5 + 120) * 1000);

    const interval = (SOAK_RUN_SECONDS * 1000) / SOAK_SAMPLES;
    for (const name of screens.length > 0 ? screens : [null]) {
      if (name !== null) {
        await goToScreen(page, name);
      }
      await pressPlayIfPaused(page);
      await soak(page, `running-${slug(name ?? "sim")}`, {
        warmUp: () => animateFor(page, interval),
        round: () => animateFor(page, interval),
        rounds: SOAK_SAMPLES,
      });
    }
    expectNoErrors(errors);
  });

  for (const mode of FUZZ_MODES) {
    test(`${mode.label} ${SOAK_FUZZ_SECONDS}s (seed ${SOAK_SEED}) keeps JS heap growth bounded`, async ({ page }) => {
      test.setTimeout((SOAK_FUZZ_SECONDS * 1.5 + 120) * 1000);
      const errors = await openSim(page, `${mode.query}&ea&randomSeed=${SOAK_SEED}`);
      // The fuzzer starts on load; warm-up covers the first screens, caches and data fills.
      const interval = (SOAK_FUZZ_SECONDS * 1000) / (SOAK_SAMPLES + 1);
      await soak(page, mode.label, {
        warmUp: () => animateFor(page, interval),
        round: () => animateFor(page, interval),
        rounds: SOAK_SAMPLES,
      });
      expectNoErrors(errors);
    });
  }
});

/** Load the sim (past the home screen by default) and collect console/page errors. */
async function openSim(page: Page, query = "ea&homeScreen=false"): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  await page.goto(`/?${query}`);
  await page.waitForSelector("#sim", { state: "attached", timeout: 30_000 });
  return errors;
}

function expectNoErrors(errors: readonly string[]): void {
  expect(errors, `console/page errors during soak:\n${errors.join("\n")}`).toEqual([]);
}

/**
 * Warm up once, take a GC'd baseline, then run `rounds` rounds sampling the heap after
 * each. Attaches the samples and asserts final/baseline stays within MAX_GROWTH_RATIO and
 * that a heap rising at every sample climbed no more than MAX_CLIMB_BYTES.
 */
async function soak(
  page: Page,
  label: string,
  workload: { warmUp: () => Promise<void>; round: () => Promise<void>; rounds: number },
): Promise<void> {
  await workload.warmUp();
  await forceBrowserGC(page);
  const baseline = await heapUsed(page);
  expect(baseline, `${label}: baseline JSHeapUsedSize`).toBeGreaterThan(0);

  const samples: number[] = [];
  for (let i = 0; i < workload.rounds; i++) {
    await workload.round();
    await forceBrowserGC(page);
    samples.push(await heapUsed(page));
  }

  const after = samples[samples.length - 1]!;
  const ratio = after / baseline;
  const climbing = samples.every((sample, i) => sample > (i === 0 ? baseline : samples[i - 1]!));
  const metricsPath = test.info().outputPath(`heap-metrics-${label}.json`);
  await writeFile(
    metricsPath,
    JSON.stringify({ label, baseline, after, ratio, climbing, samples, rounds: workload.rounds }),
  );
  await test.info().attach(`heap-metrics-${label}`, { path: metricsPath, contentType: "application/json" });

  const mib = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
  const trace = `baseline ${mib(baseline)}, samples ${samples.map(mib).join(" → ")}`;
  expect(
    ratio,
    `${label}: JS heap grew ${ratio.toFixed(2)}× over ${workload.rounds} rounds (${trace})`,
  ).toBeLessThanOrEqual(MAX_GROWTH_RATIO);
  expect(
    climbing && after - baseline > MAX_CLIMB_BYTES,
    `${label}: JS heap rose at every sample, ${mib(after - baseline)} in total (limit ${mib(MAX_CLIMB_BYTES)}; ${trace})`,
  ).toBe(false);
}

async function clickResetAll(page: Page): Promise<void> {
  // Activate the accessible button with the keyboard; the canvas covers the PDOM.
  const reset = page.getByRole("button", { name: /^(reset all|reset simulation|reset)$/i }).first();
  await expect(reset, "Reset button must be available; idle is not a reset soak").toBeVisible({ timeout: 30_000 });
  await reset.press("Space", { timeout: 5_000 });
}

/** Accessible names of the nav-bar screen buttons, in order (empty for one-screen sims). */
async function screenButtonNames(page: Page): Promise<string[]> {
  await expect(page.getByRole("button", { name: /^(reset all|reset simulation|reset)$/i }).first()).toBeVisible({
    timeout: 30_000,
  });
  const names = await page
    .getByRole("button", { name: SCREEN_BUTTON })
    .evaluateAll((buttons) => buttons.map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim()));
  return [...new Set(names.filter((n) => n.length > 0))];
}

async function goToScreen(page: Page, name: string): Promise<void> {
  const button = page.getByRole("button", { name, exact: true }).first();
  await button.press("Enter", { timeout: 5_000 });
  // Let the screen switch render and its first animation frames run.
  await animateFor(page, 250);
}

/** Press a visible "Play" button if the active screen has one; running sims are left alone. */
async function pressPlayIfPaused(page: Page): Promise<void> {
  const play = page.getByRole("button", { name: /^play$/i }).first();
  if (await play.isVisible().catch(() => false)) {
    await play.press("Space", { timeout: 5_000 });
  }
}

/**
 * Let the sim animate for `ms` of wall-clock time, counted in requestAnimationFrame
 * callbacks so the wait proves frames (and so model steps) actually ran.
 */
async function animateFor(page: Page, ms: number): Promise<void> {
  const frames = await page.evaluate(
    (duration) =>
      new Promise<number>((resolve) => {
        const start = performance.now();
        let count = 0;
        const tick = (now: number): void => {
          count++;
          if (now - start >= duration) {
            resolve(count);
          } else {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
  expect(frames, "no animation frames ran; the sim is not stepping").toBeGreaterThan(1);
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function forceBrowserGC(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const gc = (globalThis as unknown as { gc?: () => void }).gc;
    if (!gc) {
      throw new Error("Browser GC unavailable (need --js-flags=--expose-gc)");
    }
    for (let i = 0; i < 5; i++) {
      gc();
      await new Promise<void>((r) => setTimeout(r, 20));
    }
  });
}

async function heapUsed(page: Page): Promise<number> {
  // page.metrics() is not in current Playwright typings; precise memory info is
  // enabled via launch args above and exposed on performance.memory in Chromium.
  const used = await page.evaluate(() => {
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return memory?.usedJSHeapSize ?? 0;
  });
  if (used <= 0) {
    throw new Error("performance.memory.usedJSHeapSize unavailable (need --enable-precise-memory-info)");
  }
  return used;
}
