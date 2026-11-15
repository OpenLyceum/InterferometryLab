/**
 * Fleet architecture rules for SceneryStack simulations.
 *
 * Manual check during adoption (`npm run check:architecture`). Not wired into
 * CI or git hooks yet — see Baton/doc/dependency-cruiser.md.
 *
 * Optional overlay: commit `.dependency-cruiser.local.cjs` that exports
 * `{ omitRules?, forbidden?, options? }` to drop named fleet rules, add rules,
 * or merge `options.exclude.path`. Document `omitRules` under AGENTS carve-outs.
 *
 * @type {import("dependency-cruiser").IConfiguration}
 */

const SHARED_ROOTS = "common|preferences|i18n|assets";

const ORPHAN_PATH_NOT = [
  "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$",
  "\\.d\\.(c|m)?ts$",
  "(^|/)tsconfig\\.json$",
  // Sim bootstrap / PWA entry surfaces are reached outside the static graph.
  "^src/(main|init|brand|splash|assert)\\.ts$",
].join("|");

/** @type {import("dependency-cruiser").IConfiguration} */
const config = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Circular dependencies are prohibited. Type-only edges are ignored (they erase at compile time).",
      from: {},
      to: { circular: true, dependencyTypesNot: ["type-only"] },
    },
    {
      name: "no-model-to-view",
      severity: "error",
      comment:
        "Model code must not import view code. Keep state/physics free of Scenery nodes and UI.",
      from: { path: "(^|/)model/" },
      to: { path: "(^|/)view/" },
    },
    {
      name: "no-common-to-screen",
      severity: "error",
      comment:
        "Shared common/ code must not import screen-specific modules. Put shared pieces in common/ instead of reaching into a screen package.",
      from: { path: "^src/common/" },
      to: {
        path: "^src/[^/]+/",
        pathNot: `^src/(${SHARED_ROOTS})/`,
      },
    },
    {
      name: "no-preferences-to-screen",
      severity: "error",
      comment:
        "Preferences code is shared chrome and must not import screen-specific modules.",
      from: { path: "^src/preferences/" },
      to: {
        path: "^src/[^/]+/",
        pathNot: `^src/(${SHARED_ROOTS})/`,
      },
    },
    {
      name: "no-i18n-to-screen",
      severity: "error",
      comment: "i18n helpers must not import screen-specific modules.",
      from: { path: "^src/i18n/" },
      to: {
        path: "^src/[^/]+/",
        pathNot: `^src/(${SHARED_ROOTS})/`,
      },
    },
    {
      name: "no-assets-to-app",
      severity: "error",
      comment:
        "Asset modules must not import application code. Keep assets leaf-only (or only depending on other assets).",
      from: { path: "^src/assets/" },
      to: {
        path: "^src/",
        pathNot: "^src/assets/",
      },
    },
    {
      name: "no-cross-screen",
      severity: "error",
      comment:
        "Screen packages must not import other screen packages. Share via src/common/ (package boundary).",
      from: {
        path: "^src/([^/]+)/",
        pathNot: `^src/(${SHARED_ROOTS})/`,
      },
      to: {
        path: "^src/([^/]+)/",
        pathNot: `^src/(${SHARED_ROOTS})/|^src/$1/`,
      },
    },
    {
      name: "no-model-to-ui-packages",
      severity: "warn",
      comment:
        "Model code must not value-import scenerystack/scenery or scenerystack/sun (UI). Prefer axon/dot/phet-core/joist; scenery-phet units/TimeSpeed are allowed. Type-only scenery imports are allowed.",
      from: { path: "(^|/)model/" },
      to: {
        path: "node_modules/scenerystack/dist/.*/(scenery|sun)\\.js$",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "no-model-to-preferences-view",
      severity: "error",
      comment:
        "Model code may depend on *PreferencesModel but must not import *PreferencesNode (preferences view).",
      from: { path: "(^|/)model/" },
      to: { path: "(^|/)preferences/.*PreferencesNode\\.ts$" },
    },
    {
      name: "no-src-to-tests",
      severity: "error",
      comment: "Application src/ must not import the tests/ tree.",
      from: { path: "^src/" },
      to: { path: "^tests/" },
    },
    {
      name: "not-to-dev-dep",
      severity: "error",
      comment:
        "src/ must not import npm devDependencies (vitest, Playwright, happy-dom, etc.). Keep test tooling in tests/ and scripts/.",
      from: {
        path: "^src/",
        pathNot: "\\.(spec|test)\\.ts$",
      },
      to: {
        dependencyTypes: ["npm-dev"],
        // Avoid flagging ambient/type-only tooling surfaces.
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment:
        "Orphan module under src/ (no incoming or outgoing dependencies). Remove it, wire it up, or exclude it in a local overlay if it is an intentional unused toolkit stub.",
      from: {
        orphan: true,
        pathNot: ORPHAN_PATH_NOT,
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
      dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer", "npm-bundled", "npm-no-pkg"],
    },
    // TypeScript 7 is not yet supported by dependency-cruiser's tsc bridge; SWC parses sources.
    tsPreCompilationDeps: false,
    combinedDependencies: false,
    parser: "swc",
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },
  },
};

function excludePathString(exclude) {
  if (!exclude) {
    return "";
  }
  if (typeof exclude === "string") {
    return exclude;
  }
  if (typeof exclude.path === "string") {
    return exclude.path;
  }
  if (Array.isArray(exclude.path)) {
    return exclude.path.join("|");
  }
  return "";
}

try {
  // Optional sim-local overlay (not template-owned).
  const local = require("./.dependency-cruiser.local.cjs");
  if (local && typeof local === "object") {
    if (Array.isArray(local.omitRules) && local.omitRules.length > 0) {
      const omit = new Set(local.omitRules);
      config.forbidden = config.forbidden.filter((rule) => !omit.has(rule.name));
    }
    if (Array.isArray(local.forbidden)) {
      config.forbidden.push(...local.forbidden);
    }
    if (local.options && typeof local.options === "object") {
      const localExclude = excludePathString(local.options.exclude);
      const baseExclude = excludePathString(config.options.exclude);
      const merged = {
        ...config.options,
        ...local.options,
      };
      if (baseExclude || localExclude) {
        merged.exclude = {
          path: [baseExclude, localExclude].filter(Boolean).join("|"),
        };
      }
      config.options = merged;
    }
  }
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code !== "MODULE_NOT_FOUND") {
    throw error;
  }
}

module.exports = config;
