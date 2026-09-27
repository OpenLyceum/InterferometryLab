/**
 * Playwright configuration for the optional fuzz smoke (tests/fuzz/).
 *
 * Template-owned: keep identical across the fleet (Baton check-template-drift).
 * FUZZ_DURATION (seconds) sizes the timeout; FUZZ_PORT (default 5173) lets
 * several sims fuzz in parallel without fighting over the dev-server port.
 */

import { defineConfig } from "@playwright/test";

const port = Math.max(1, parseInt(process.env["FUZZ_PORT"] || "5173", 10) || 5173);
const fuzzSeconds = Math.max(1, parseInt(process.env["FUZZ_DURATION"] || "30", 10) || 30);

export default defineConfig({
  testDir: "./tests/fuzz",
  timeout: (fuzzSeconds + 120) * 1000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    // A fixed location for sims that read geolocation, so fuzz runs are deterministic
    // and never block on a permission prompt. Harmless for sims that don't use it.
    geolocation: { latitude: 40.8, longitude: -74.0 },
    permissions: ["geolocation"],
  },
  webServer: {
    command: `npm run start -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        // Makes WebGPU available in headless Chromium on Linux, so sims with a WebGPU
        // path exercise it; without a GPU, requestAdapter() still resolves to null and
        // the sim's fallback runs. No effect on sims that don't touch WebGPU.
        launchOptions: {
          args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan"],
        },
      },
    },
  ],
});
