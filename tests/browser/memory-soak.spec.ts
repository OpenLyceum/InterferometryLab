/**
 * Browser memory soak — template-owned, identical across the fleet.
 *
 * Not part of Fleet Health's fuzz smoke. Run explicitly:
 *   npm run test:soak
 *
 * Warm up the sim, click Reset All repeatedly with GC between rounds, and assert
 * JS heap growth stays bounded. Catches retained listeners / nodes that unit
 * WeakRef suites miss when objects are intentionally long-lived.
 *
 * Requires Chromium flags: --js-flags=--expose-gc and --enable-precise-memory-info
 * (set on this describe only so fuzz stays unchanged).
 */

import { expect, test } from "@playwright/test";

const SOAK_ROUNDS: number = Math.max(5, parseInt(process.env["SOAK_ROUNDS"] || "15", 10) || 15);
/** Allow modest heap noise from caches / JIT; fail on clear linear growth. */
const MAX_GROWTH_RATIO: number = parseFloat(process.env["SOAK_MAX_GROWTH"] || "1.75") || 1.75;

test.describe("Memory soak", () => {
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

  test(`Reset All × ${SOAK_ROUNDS} keeps JS heap growth bounded`, async ({ page }) => {
    test.setTimeout(180_000);

    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/?ea");
    await page.waitForSelector("#sim", { timeout: 30_000 });

    // Warm-up: one reset + GC so first metrics are not cold-start dominated.
    await clickResetAll(page);
    await forceBrowserGC(page);
    const baseline = await heapUsed(page);
    expect(baseline, "baseline JSHeapUsedSize").toBeGreaterThan(0);

    for (let i = 0; i < SOAK_ROUNDS; i++) {
      await clickResetAll(page);
      await forceBrowserGC(page);
    }

    const after = await heapUsed(page);
    const ratio = after / baseline;
    expect(
      ratio,
      `JS heap grew ${ratio.toFixed(2)}× after ${SOAK_ROUNDS} resets (baseline=${baseline}, after=${after})`,
    ).toBeLessThanOrEqual(MAX_GROWTH_RATIO);

    expect(errors, `console/page errors during soak:\n${errors.join("\n")}`).toEqual([]);
  });
});

async function clickResetAll(page: import("@playwright/test").Page): Promise<void> {
  // scenery-phet ResetAllButton exposes an accessible name; fall back to common labels.
  const reset = page.getByRole("button", { name: /reset all/i });
  if ((await reset.count()) > 0) {
    await reset.first().click({ timeout: 5_000 });
    return;
  }
  const alt = page.getByRole("button", { name: /^reset$/i });
  if ((await alt.count()) > 0) {
    await alt.first().click({ timeout: 5_000 });
    return;
  }
  // Sims without a discoverable Reset All still exercise the session via reload-free noop;
  // the heap check then mainly guards against pageerror / console leaks during idle.
}

async function forceBrowserGC(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(async () => {
    const gc = (globalThis as unknown as { gc?: () => void }).gc;
    for (let i = 0; i < 5; i++) {
      gc?.();
      await new Promise<void>((r) => setTimeout(r, 20));
    }
  });
}

async function heapUsed(page: import("@playwright/test").Page): Promise<number> {
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
