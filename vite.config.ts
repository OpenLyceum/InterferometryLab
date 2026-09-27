import type { Plugin, Rollup } from "vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { description, name } from "./package.json";

/**
 * Security headers required for:
 *  - COOP/COEP: SharedArrayBuffer support
 *  - CSP: restrict resource loading to same-origin + known blob/data exceptions
 *  - Referrer / Permissions: tighten default browser leakage
 *  - X-Content-Type-Options: prevent MIME sniffing
 *  - X-Frame-Options: prevent clickjacking (belt-and-suspenders alongside frame-ancestors)
 */
const securityHeaders: Record<string, string> = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Content-Security-Policy": [
    "default-src 'self'",
    // TODO(scenerystack): drop 'unsafe-eval' when SceneryStack no longer needs
    // Function/eval for query-parameter parsing — reopen a CSP audit then.
    // 'unsafe-eval' is required for SceneryStack query parameter parsing
    "script-src 'self' 'unsafe-eval'",
    // Event-handler attributes are governed by script-src-attr, separately from
    // inline <script>. SceneryStack's ParallelDOM.pdomInputEnabledListener sets an
    // inline `onclick` on any control whose input it disables (`return false`, then
    // `""` when re-enabled) — e.g. the time-control step button whenever the clock
    // starts or stops. 'unsafe-hashes' lets exactly those two handlers through;
    // anything else still fails. Without it the fuzz suite fails on the CSP console
    // error. Regenerate: printf 'return false' | openssl dgst -sha256 -binary | base64
    "script-src-attr 'unsafe-hashes' " +
      "'sha256-GZIcz60Uwd6wT3vaYke/atSr53TehbYAPepOa3d03Vw=' " +
      "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
    "worker-src blob: 'self'",
    // TODO(scenerystack): drop 'unsafe-inline' when SceneryStack stops setting
    // element.style / cssText for theming (same CSP revisit as unsafe-eval).
    // Inline styles are set via element.style / cssText throughout the UI layer
    "style-src 'self' 'unsafe-inline'",
    // data: for icons
    "img-src 'self' data:",
    "media-src 'self' blob:",
    // blob: for fetch inside workers
    "connect-src 'self' blob:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

/** Single-file mode: inline every imported asset as base64 (effectively unlimited). */
const INLINE_LIMIT_BYTES = 100 * 1024 * 1024;

/** Workbox precache ceiling — SceneryStack bundles exceed the default 2 MB limit. */
const WORKBOX_MAX_FILE_BYTES = 12 * 1024 * 1024;

/** Escape a string for literal use inside a `RegExp`. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Decode a Rollup asset source (string or bytes) to text. */
function assetSourceToText(source: string | Uint8Array): string {
  return typeof source === "string" ? source : Buffer.from(source).toString("utf8");
}

/**
 * Return `html` with the tag that references `fileName` replaced by an inline
 * `<script>`/`<style>`, or `null` when this asset is not referenced.
 *
 * The replacement is a function (never a string) so `$` sequences in the JS/CSS
 * are not interpreted as `String.prototype.replace` special patterns.
 */
function inlineAsset(html: string, fileName: string, item: Rollup.OutputChunk | Rollup.OutputAsset): string | null {
  const ref = escapeRegExp(fileName);

  if (item.type === "chunk") {
    const scriptTag = new RegExp(`<script[^>]*\\bsrc="[^"]*${ref}"[^>]*></script>`);
    if (!scriptTag.test(html)) {
      return null;
    }
    // Escape `</script>` so an inlined occurrence cannot close the tag early.
    const code = item.code.replace(/<\/script>/g, "<\\/script>");
    return html.replace(scriptTag, () => `<script type="module">${code}</script>`);
  }

  if (fileName.endsWith(".css")) {
    const linkTag = new RegExp(`<link[^>]*\\bhref="[^"]*${ref}"[^>]*>`);
    if (!linkTag.test(html)) {
      return null;
    }
    const css = assetSourceToText(item.source);
    return html.replace(linkTag, () => `<style>${css}</style>`);
  }

  return null;
}

/**
 * Fill `%SIM_DESCRIPTION%` in index.html from package.json, so the page meta tags,
 * the PWA manifest and package.json can never disagree. Runs before Vite's own
 * `%ENV%` replacement (order: "pre").
 */
function simMetadataHtml(): Plugin {
  const escaped = description.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return {
    name: "sim-metadata-html",
    transformIndexHtml: {
      order: "pre",
      handler: (html: string): string => html.replaceAll("%SIM_DESCRIPTION%", escaped),
    },
  };
}

/**
 * Dependency-free single-file plugin. After the bundle is generated, splice every
 * JS chunk and CSS asset that `index.html` references directly into the HTML as
 * inline tags, drop those now-orphaned files, and strip external icon links so the
 * result has no outbound references — `dist/index.html` is the entire build.
 *
 * Safe because the production bundle is self-contained: no web workers, no .wasm,
 * no `import.meta.url`, no runtime fetches of local files.
 */
function inlineSingleFile(): Plugin {
  return {
    name: "inline-single-file",
    enforce: "post",
    generateBundle(_options: Rollup.NormalizedOutputOptions, bundle: Rollup.OutputBundle): void {
      for (const htmlName of Object.keys(bundle)) {
        const htmlAsset = bundle[htmlName];
        if (!htmlName.endsWith(".html") || htmlAsset?.type !== "asset" || typeof htmlAsset.source !== "string") {
          continue;
        }

        let html = htmlAsset.source;
        for (const fileName of Object.keys(bundle)) {
          const item = bundle[fileName];
          if (!item) {
            continue;
          }
          const inlined = inlineAsset(html, fileName, item);
          if (inlined !== null) {
            html = inlined;
            delete bundle[fileName];
          }
        }

        // Drop external favicon/touch-icon links — public/ is not emitted in single mode.
        htmlAsset.source = html.replace(/\s*<link[^>]*\brel="(?:icon|apple-touch-icon)"[^>]*>/g, "");
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `vite build --mode single` produces a single self-contained dist/index.html.
  const single = mode === "single";

  return {
    // So the build can be served from an arbitrary path
    base: "./",
    build: {
      // Requires Vite 8+ / esbuild ≥0.24. Run `npm ci` if build errors on ES2024.
      target: "es2024",
      // SceneryStack bundles exceed Vite's default 500 kB chunk warning.
      chunkSizeWarningLimit: 5000,
      ...(single && {
        // Inline every imported asset as a base64 data URI instead of emitting files.
        assetsInlineLimit: INLINE_LIMIT_BYTES,
        // Emit one CSS file (no per-chunk split) so there is a single tag to inline.
        cssCodeSplit: false,
        // Skip copying public/ (favicon, icons) — nothing external should remain.
        copyPublicDir: false,
        rollupOptions: {
          // Collapse dynamic imports into the single entry chunk.
          output: { inlineDynamicImports: true },
        },
      }),
    },
    server: {
      headers: securityHeaders,
    },
    preview: {
      headers: securityHeaders,
    },
    plugins: single
      ? [simMetadataHtml(), inlineSingleFile()]
      : [
          simMetadataHtml(),
          VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.ico", "icons/apple-touch-icon.png"],
            manifest: {
              id: name,
              name: "Interferometry Lab",
              // biome-ignore lint/style/useNamingConvention: Web App Manifest spec requires snake_case keys
              short_name: "InterferometryLab",
              description,
              categories: ["education", "science"],
              // biome-ignore lint/style/useNamingConvention: Web App Manifest spec requires snake_case keys
              theme_color: "#1a1a2e",
              // biome-ignore lint/style/useNamingConvention: Web App Manifest spec requires snake_case keys
              background_color: "#000000",
              display: "standalone",
              // biome-ignore lint/style/useNamingConvention: Web App Manifest spec requires snake_case keys
              display_override: ["window-controls-overlay", "standalone"],
              // No `orientation` — leave free so portrait-friendly sims are not forced landscape.
              icons: [
                {
                  src: "icons/icon-192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
                {
                  src: "icons/icon-512.png",
                  sizes: "512x512",
                  type: "image/png",
                },
                {
                  src: "icons/icon.svg",
                  sizes: "any",
                  type: "image/svg+xml",
                  purpose: "maskable",
                },
              ],
              // Placeholder shots from `npm run icons`; replace with real sim screenshots before shipping.
              screenshots: [
                {
                  src: "screenshots/wide.png",
                  sizes: "1280x720",
                  type: "image/png",
                  // biome-ignore lint/style/useNamingConvention: Web App Manifest spec requires snake_case keys
                  form_factor: "wide",
                  label: "Interferometry Lab",
                },
                {
                  src: "screenshots/narrow.png",
                  sizes: "720x1280",
                  type: "image/png",
                  // biome-ignore lint/style/useNamingConvention: Web App Manifest spec requires snake_case keys
                  form_factor: "narrow",
                  label: "Interferometry Lab",
                },
              ],
            },
            workbox: {
              maximumFileSizeToCacheInBytes: WORKBOX_MAX_FILE_BYTES,
              globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
            },
          }),
        ],
  };
});
