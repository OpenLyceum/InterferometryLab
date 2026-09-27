#!/usr/bin/env tsx
/**
 * scripts/test-fuzz.ts
 *
 * Runs the Playwright fuzz smoke (`?fuzz&ea`) for a chosen duration.
 *
 * Usage:
 *   npm run test:fuzz                 # default 30s
 *   npm run test:fuzz:quick           # 10s
 *   npm run test:fuzz:long            # 300s
 *   npm run test:fuzz -- 90           # 90s
 *   npm run test:fuzz -- --duration 90
 *   FUZZ_DURATION=90 npm run test:fuzz
 *
 * Extra Playwright args pass through:
 *   npm run test:fuzz -- 60 --headed
 */
import { spawnSync } from "node:child_process";

const DEFAULT_SECONDS = 30;

const parseDuration = (raw: string, source: string): string => {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`${source} must be a positive integer (seconds), got ${JSON.stringify(raw)}`);
  }
  return String(n);
};

const parseArgs = (argv: string[]): { duration: string; extra: string[] } => {
  let duration = parseDuration(process.env["FUZZ_DURATION"] ?? String(DEFAULT_SECONDS), "FUZZ_DURATION");
  const extra: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) {
      continue;
    }
    if (arg === "--duration" || arg === "-d") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        throw new Error(`${arg} requires a duration in seconds`);
      }
      duration = parseDuration(next, arg);
      i++;
    } else if (arg.startsWith("--duration=")) {
      duration = parseDuration(arg.slice("--duration=".length), "--duration");
    } else if (/^\d+$/.test(arg) && extra.length === 0) {
      duration = parseDuration(arg, "duration");
    } else {
      extra.push(arg);
    }
  }
  return { duration, extra };
};

const { duration, extra } = parseArgs(process.argv.slice(2));

const result = spawnSync("playwright", ["test", "--project=chromium", ...extra], {
  stdio: "inherit",
  env: { ...process.env, FUZZ_DURATION: duration },
});

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
