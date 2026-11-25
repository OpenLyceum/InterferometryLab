import type { Plugin } from "vite";
import type { VitePWAOptions } from "vite-plugin-pwa";

type PwaConfig = {
  title: string;
  shortName: string;
  themeColor: string;
  backgroundColor: string;
  precacheExtensions: string[];
  pwaId?: string;
};

type WorkboxOptions = NonNullable<VitePWAOptions["workbox"]>;

/** Workbox precache ceiling — SceneryStack bundles exceed the default 2 MB limit. */
const WORKBOX_MAX_FILE_BYTES = 12 * 1024 * 1024;

/**
 * Supply the HTML description and theme color from the same sources as the manifest. Runs before Vite's own
 * `%ENV%` replacement (order: "pre").
 */
export function simMetadataHtml(description: string, themeColor: string): Plugin {
  const escaped = description.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return {
    name: "sim-metadata-html",
    transformIndexHtml: {
      order: "pre",
      handler: (html: string): string =>
        html
          .replaceAll("%SIM_DESCRIPTION%", escaped)
          // Replace legacy literals too, so an older index.html works during template sync.
          .replace(
            /(<meta\s+name="theme-color"\s+content=")(?:%SIM_THEME_COLOR%|#[0-9a-f]{6})(?=")/i,
            (_match, prefix: string) => prefix + themeColor,
          ),
    },
  };
}

/** Shared by the standard build and sims with custom Vite pipelines. */
export function pwaOptions(
  simConfig: PwaConfig,
  { name, description }: { name: string; description: string },
  { globIgnores: extraIgnores = [], runtimeCaching }: Pick<WorkboxOptions, "globIgnores" | "runtimeCaching"> = {},
): Partial<VitePWAOptions> {
  return {
    // Let the next worker wait until all tabs using the current version are closed.
    registerType: "prompt",
    includeAssets: ["favicon.ico"],
    // The Workbox glob already includes the manifest icons and Apple touch icon.
    includeManifestIcons: false,
    manifest: {
      id: simConfig.pwaId ?? name,
      name: simConfig.title,
      // biome-ignore lint/style/useNamingConvention: Web App Manifest spec requires snake_case keys
      short_name: simConfig.shortName,
      description,
      categories: ["education", "science"],
      // biome-ignore lint/style/useNamingConvention: Web App Manifest spec requires snake_case keys
      theme_color: simConfig.themeColor,
      // biome-ignore lint/style/useNamingConvention: Web App Manifest spec requires snake_case keys
      background_color: simConfig.backgroundColor,
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
          label: simConfig.title,
        },
        {
          src: "screenshots/narrow.png",
          sizes: "720x1280",
          type: "image/png",
          // biome-ignore lint/style/useNamingConvention: Web App Manifest spec requires snake_case keys
          form_factor: "narrow",
          label: simConfig.title,
        },
      ],
    },
    workbox: {
      maximumFileSizeToCacheInBytes: WORKBOX_MAX_FILE_BYTES,
      globIgnores: ["screenshots/**", "**/*-single.html", ...extraIgnores],
      ...(runtimeCaching ? { runtimeCaching } : {}),
      // Lets <Pages URL>/<Repo>-single.html (the build:single file Baton's deploy.yml adds
      // after this build) reach returning visitors instead of the fallback index.html.
      navigateFallbackDenylist: [/-single\.html$/],
      globPatterns: [
        `**/*.{${["js", "css", "html", "svg", "png", "woff2", ...simConfig.precacheExtensions].join(",")}}`,
      ],
    },
  };
}
