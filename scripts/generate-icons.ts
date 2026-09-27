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
 * --placeholder-screenshots overwrites them deliberately.
 *
 * Template-owned: keep identical across the fleet. The background colour comes from
 * the `theme-color` meta in index.html (which must also match the manifest
 * `theme_color`), so nothing here is sim-specific.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "..", "public");
const svg = readFileSync(resolve(publicDir, "icons", "icon.svg"));

/** Parse the `<meta name="theme-color">` value from index.html into an RGBA background. */
const readThemeBackground = (): { r: number; g: number; b: number; alpha: number } => {
  const html = readFileSync(resolve(here, "..", "index.html"), "utf8");
  const match = /<meta\s+name="theme-color"\s+content="#([0-9a-fA-F]{6})"/.exec(html);
  if (!match?.[1]) {
    throw new Error('index.html must declare <meta name="theme-color" content="#rrggbb">');
  }
  const n = Number.parseInt(match[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff, alpha: 1 };
};

/** Theme background matching index.html `theme-color` / manifest `theme_color`. */
const THEME_BG = readThemeBackground();

const density = 512;

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

/** Branded placeholder screenshots for the Web App Manifest `screenshots` member. */
async function writeScreenshot(width: number, height: number, file: string): Promise<void> {
  const iconSize = Math.round(Math.min(width, height) * 0.4);
  const icon = await sharp(svg, { density }).resize(iconSize, iconSize).png().toBuffer();
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: THEME_BG,
    },
  })
    .composite([{ input: icon, gravity: "center" }])
    .png()
    .toFile(resolve(publicDir, file));
}

/** A real capture scaled to fit inside width×height, centred on the theme background. */
async function writeScreenshotFrom(source: string, width: number, height: number, file: string): Promise<void> {
  const fitted = await sharp(source).resize(width, height, { fit: "inside" }).png().toBuffer();
  await sharp({ create: { width, height, channels: 4, background: THEME_BG } })
    .composite([{ input: fitted, gravity: "center" }])
    .png()
    .toFile(resolve(publicDir, file));
}

const capture = resolve(here, "..", "assets", "screenshot.png");
const fromAssets = process.argv.includes("--screenshots-from-assets");
const overwriteScreenshots = process.argv.includes("--placeholder-screenshots");
if (fromAssets && !existsSync(capture)) {
  throw new Error("--screenshots-from-assets needs assets/screenshot.png (Baton/scripts/generate-screenshots.sh)");
}
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
