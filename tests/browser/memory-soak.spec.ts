/**
 * Browser memory soak — template-owned, identical across the fleet.
 *
 * Not part of Fleet Health's fuzz smoke. Run explicitly:
 *   npm run test:soak
 *
 * Warm up the first sim screen, activate Reset All with GC between rounds, and assert
 * JS heap growth stays bounded. Catches retained listeners / nodes that unit
 * WeakRef suites miss when objects are intentionally long-lived.
 *
 * Requires Chromium flags: --js-flags=--expose-gc and --enable-precise-memory-info
 * (set at file scope so fuzz stays unchanged).
 */

import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const SOAK_ROUNDS: number = Math.max(5, parseInt(process.env["SOAK_ROUNDS"] || "15", 10) || 15);
/** Allow modest heap noise from caches / JIT; fail on clear linear growth. */
const MAX_GROWTH_RATIO: number = parseFloat(process.env["SOAK_MAX_GROWTH"] || "1.75") || 1.75;

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

test.describe("Memory soak", () => {
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

    await page.goto("/?ea&homeScreen=false");
    await page.waitForSelector("#sim", { state: "attached", timeout: 30_000 });

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
    const metricsPath = test.info().outputPath("heap-metrics.json");
    await writeFile(metricsPath, JSON.stringify({ baseline, after, ratio, rounds: SOAK_ROUNDS }));
    await test.info().attach("heap-metrics", {
      path: metricsPath,
      contentType: "application/json",
    });
    expect(
      ratio,
      `JS heap grew ${ratio.toFixed(2)}× after ${SOAK_ROUNDS} resets (baseline=${baseline}, after=${after})`,
    ).toBeLessThanOrEqual(MAX_GROWTH_RATIO);

    expect(errors, `console/page errors during soak:\n${errors.join("\n")}`).toEqual([]);
  });
});

async function clickResetAll(page: import("@playwright/test").Page): Promise<void> {
  // Activate the accessible button with the keyboard; the canvas covers the PDOM.
  const reset = page.getByRole("button", { name: /^(reset all|reset simulation|reset)$/i }).first();
  await expect(reset, "Reset button must be available; idle is not a reset soak").toBeVisible({ timeout: 30_000 });
  await reset.press("Space", { timeout: 5_000 });
}

async function forceBrowserGC(page: import("@playwright/test").Page): Promise<void> {
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
