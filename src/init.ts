/**
 * init.ts
 *
 * Initializes SceneryStack with simulation metadata.
 *
 * IMPORTANT: This file is the START of the EXECUTION chain (deepest import runs first):
 *   init.ts → assert.ts → splash.ts → brand.ts → main.ts
 *
 * Import nesting is the reverse (main → brand → splash → assert → init).
 * brand.js must be the first import in main.ts so this file runs before any other
 * SceneryStack module is imported.
 *
 * ── How to customize ─────────────────────────────────────────────────────────
 * 1. Change `name` to match your package.json "name" field (kebab-case)
 * 2. `version` is read from package.json — bump it there (`npm version`), never here
 * 3. Update `availableLocales` when you add new translation files
 */
import { init, madeWithSceneryStackSplashDataURI } from "scenerystack/init";
import { version } from "../package.json";

init({
  // Internal identifier used by SceneryStack for URL parameters and phetmarks.
  // Use kebab-case matching the package.json "name" field.
  name: "interferometry-lab",

  // Displayed in the About dialog (Help menu → About). Single source of truth is
  // package.json, so `npm version` / `npm run release` can never leave it stale.
  version,

  // Must match the id registered in src/brand.ts.
  brand: "made-with-scenerystack",

  // Default locale (ISO-639-1, optionally with ISO-3166-1 country code, e.g. "en_US").
  locale: "en",

  // All supported locales — must match the locale keys in src/i18n/StringManager.ts.
  availableLocales: ["en", "es", "fr"],

  // Splash screen shown while the simulation loads.
  splashDataURI: madeWithSceneryStackSplashDataURI,

  // Allow the user to switch locale at runtime via the Preferences dialog.
  allowLocaleSwitching: true,

  // Enables the "Projector Mode" color profile alongside the default dark theme.
  // Required when supportsProjectorMode: true is used in PreferencesModel (src/main.ts).
  colorProfiles: ["default", "projector"],
});
