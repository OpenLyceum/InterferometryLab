/**
 * generate-icons.ts
 *
 * Rasterizes public/icons/icon.svg into the PNG icons, favicon.ico, and placeholder
 * PWA install screenshots used by the manifest. Run with: npm run icons
 *
 * Replace public/screenshots/{wide,narrow}.png with real sim shots before shipping
 * (e.g. Baton/scripts/generate-screenshots.sh → copy into public/screenshots/).
 * With --screenshots-from-assets, both PWA screenshots are rebuilt from the sim's
 * real capture, assets/screenshot.png (the Baton landing-page shot), letterboxed on
 * the theme colour. Otherwise branded placeholders are written only where no
 * screenshot exists yet, so re-running `npm run icons` never clobbers real shots;
 * --placeholder-screenshots overwrites them deliberately. Use --screenshots-only
 * with --screenshots-from-assets to refresh the pair without rasterizing icons.
 *
 * Template-owned. The screenshot background follows sim.config.json themeColor.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const { values: flags } = parseArgs({
  options: {
    "screenshots-only": { type: "boolean", default: false },
    "screenshots-from-assets": { type: "boolean", default: false },
    "placeholder-screenshots": { type: "boolean", default: false },
  },
});

const here = import.meta.dirname;
const publicDir = resolve(here, "..", "public");
const svg = readFileSync(resolve(publicDir, "icons", "icon.svg"));

const fromAssets = flags["screenshots-from-assets"];
const screenshotsOnly = flags["screenshots-only"];
const capture = resolve(here, "..", "assets", "screenshot.png");
if (screenshotsOnly && !fromAssets) {
  throw new Error("--screenshots-only requires --screenshots-from-assets");
}
if (fromAssets && !existsSync(capture)) {
  throw new Error("--screenshots-from-assets needs assets/screenshot.png (Baton/scripts/generate-screenshots.sh)");
}

const configPath = resolve(here, "..", "sim.config.json");
const { themeColor }: { themeColor?: unknown } = JSON.parse(readFileSync(configPath, "utf8"));
if (typeof themeColor !== "string" || !/^#[0-9a-f]{6}$/i.test(themeColor)) {
  throw new Error("sim.config.json themeColor must be a #rrggbb color");
}
const screenshotBackground: string = themeColor;

const density = 512;

if (!screenshotsOnly) {
  const pngTargets = [
    { size: 180, file: "icons/apple-touch-icon.png" },
    { size: 192, file: "icons/icon-192.png" },
    { size: 512, file: "icons/icon-512.png" },
  ];

  for (const { size, file } of pngTargets) {
    await sharp(svg, { density }).resize(size, size).png().toFile(resolve(publicDir, file));
  }

  const icoBuffers = await Promise.all(
    [16, 32, 48, 64].map((size) => sharp(svg, { density }).resize(size, size).png().toBuffer()),
  );
  writeFileSync(resolve(publicDir, "favicon.ico"), await pngToIco(icoBuffers));
}

/** Branded placeholder screenshots for the Web App Manifest `screenshots` member. */
async function writeScreenshot(width: number, height: number, file: string): Promise<void> {
  const iconSize = Math.round(Math.min(width, height) * 0.4);
  const icon = await sharp(svg, { density }).resize(iconSize, iconSize).png().toBuffer();
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: screenshotBackground,
    },
  })
    .composite([{ input: icon, gravity: "center" }])
    .png()
    .toFile(resolve(publicDir, file));
}

/** A real capture scaled to fit inside width×height, centred on the theme background. */
async function writeScreenshotFrom(source: string, width: number, height: number, file: string): Promise<void> {
  const fitted = await sharp(source).resize(width, height, { fit: "inside" }).png().toBuffer();
  await sharp({ create: { width, height, channels: 4, background: screenshotBackground } })
    .composite([{ input: fitted, gravity: "center" }])
    .png()
    .toFile(resolve(publicDir, file));
}

const overwriteScreenshots = flags["placeholder-screenshots"];
mkdirSync(resolve(publicDir, "screenshots"), { recursive: true });
for (const [width, height, file] of [
  [1280, 720, "screenshots/wide.png"],
  [720, 1280, "screenshots/narrow.png"],
] as const) {
  if (fromAssets) {
    await writeScreenshotFrom(capture, width, height, file);
  } else if (overwriteScreenshots || !existsSync(resolve(publicDir, file))) {
    await writeScreenshot(width, height, file);
  }
}
