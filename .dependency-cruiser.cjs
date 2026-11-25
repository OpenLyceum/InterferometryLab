/**
 * Fleet architecture rules for SceneryStack simulations.
 *
 * Enforced by template CI, pre-push and release (`npm run check:architecture`).
 * See Baton/doc/dependency-cruiser.md for fleet adoption.
 *
 * Optional overlay: commit `.dependency-cruiser.local.cjs` that exports
 * `{ omitRules?, forbidden?, options? }` to drop named fleet rules, add rules,
 * or merge `options.exclude.path`. Weakening rules requires AGENTS carve-outs.
 * Other option overrides and duplicate rule names are rejected.
 *
 * @type {import("dependency-cruiser").IConfiguration}
 */

const SHARED_ROOTS = "common|preferences|i18n|assets";

// Optional starter components are public entry points only in the template itself.
// Forks must use or remove them, just like every other application module.
// Split the package name to preserve this test during fleet name substitution.
const ENTRY_PATH =
  require("./package.json").name === ["scenerystack", "template"].join("-")
    ? "^src/main\\.ts$|^src/common/(SimControlOptions|SimPanel|TimeModel)\\.ts$"
    : "^src/main\\.ts$";

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
      name: "no-unresolved",
      severity: "error",
      comment: "Imports must resolve. Fix invented package names, stale paths and missing files.",
      from: { path: "^src/" },
      to: { couldNotResolve: true },
    },
    {
      name: "no-undeclared-packages",
      severity: "error",
      comment: "Declare runtime packages directly in dependencies; do not rely on transitive installs.",
      from: { path: "^src/" },
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "no-duplicate-dep-types",
      severity: "error",
      comment: "Declare each imported package in one dependency category.",
      from: { path: "^src/" },
      to: { moreThanOneDependencyType: true },
    },
    {
      name: "not-to-deprecated",
      severity: "warn",
      comment: "Replace packages marked deprecated in their installed package metadata.",
      from: { path: "^src/" },
      to: { dependencyTypes: ["deprecated"] },
    },
    {
      name: "no-node-builtins",
      severity: "error",
      comment: "Browser application code must not depend on Node built-ins. Keep tooling in scripts/.",
      from: { path: "^src/" },
      to: { dependencyTypes: ["core"], dependencyTypesNot: ["type-only"] },
    },
    {
      name: "no-src-to-tooling",
      severity: "error",
      comment: "Application code must stay in src/; never import scripts, configs or sibling checkouts.",
      from: { path: "^src/" },
      to: {
        pathNot: "^src/|(^|/)node_modules/|^package\\.json$|^assets/.*\\.(svg|png|jpe?g|gif|webp|avif|ico)$",
        couldNotResolve: false,
        dependencyTypesNot: [
          "npm",
          "npm-dev",
          "npm-optional",
          "npm-peer",
          "npm-bundled",
          "npm-no-pkg",
          "npm-unknown",
          "core",
        ],
      },
    },
    {
      name: "no-app-to-bootstrap",
      severity: "error",
      comment: "Only the bootstrap chain may import bootstrap modules. Move shared values to a separate module.",
      from: { path: "^src/", pathNot: "^src/(main|init|brand|splash|assert)\\.ts$" },
      to: { path: "^src/(main|init|brand|splash|assert)\\.ts$" },
    },
    {
      name: "no-model-to-view-transitive",
      severity: "error",
      comment: "Models must not reach view code through helpers or re-export barrels either.",
      from: { path: "(^|/)model/" },
      to: { path: "(^|/)view/|(^|/)preferences/.*PreferencesNode\\.ts$", reachable: true },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies are prohibited. Type-only edges are ignored (they erase at compile time).",
      from: {},
      to: {
        circular: true,
        dependencyTypesNot: ["type-only"],
        viaOnly: { dependencyTypesNot: ["type-only"] },
      },
    },
    {
      name: "no-model-to-view",
      severity: "error",
      comment: "Model code must not import view code. Keep state/physics free of Scenery nodes and UI.",
      from: { path: "(^|/)model/" },
      to: { path: "(^|/)view/" },
    },
    {
      name: "no-root-to-screen",
      severity: "error",
      comment: "Only src/main.ts wires screens. Move screen-specific helpers into their screen package.",
      from: { path: "^src/[^/]+$", pathNot: "^src/main\\.ts$" },
      to: { path: "^src/[^/]+/", pathNot: `^src/(${SHARED_ROOTS})/` },
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
      comment: "Preferences code is shared chrome and must not import screen-specific modules.",
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
      comment: "Screen packages must not import other screen packages. Share via src/common/ (package boundary).",
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
      severity: "error",
      comment:
        "Model code must not value-import scenerystack/scenery or scenerystack/sun (UI). Prefer axon/dot/phet-core/joist; scenery-phet units/TimeSpeed are allowed. Type-only scenery imports are allowed.",
      from: { path: "(^|/)model/" },
      to: {
        path: "node_modules/scenerystack/dist/.*/(scenery|sun)\\.js$",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "no-model-to-colors",
      severity: "error",
      comment: "Models expose domain state; views map it to the simulation's color palette.",
      from: { path: "(^|/)model/" },
      to: { path: "(^|/)[^/]*Colors\\.ts$", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "no-model-to-preferences-view",
      severity: "error",
      comment: "Model code may depend on *PreferencesModel but must not import *PreferencesNode (preferences view).",
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
      from: { path: "^src/" },
      to: {
        dependencyTypes: ["npm-dev"],
        // Avoid flagging ambient/type-only tooling surfaces.
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "no-unreachable-from-entry",
      severity: "error",
      comment: "Source modules must be reachable from the application entry point. Put test-only helpers in tests/.",
      from: { path: ENTRY_PATH },
      to: { path: "^src/", pathNot: `${ENTRY_PATH}|\\.d\\.(c|m)?ts$`, reachable: false },
    },
    {
      name: "no-orphans",
      severity: "error",
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
      conditionNames: ["import", "browser", "module", "default", "types"],
      aliasFields: ["browser"],
      mainFields: ["browser", "module", "main", "types", "typings"],
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

// Resolve separately: only an absent overlay is optional. Errors INSIDE it must fail.
let localPath;
try {
  localPath = require.resolve("./.dependency-cruiser.local.cjs");
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") {
    throw error;
  }
}

if (localPath) {
  const fs = require("node:fs");
  const path = require("node:path");
  const local = require(localPath);
  if (!local || typeof local !== "object" || Array.isArray(local)) {
    throw new Error("Architecture overlay must export an object.");
  }
  for (const key of Object.keys(local)) {
    if (!["omitRules", "forbidden", "options"].includes(key)) {
      throw new Error(`Unsupported architecture overlay key: ${key}`);
    }
  }
  const guidancePath = path.join(__dirname, "AGENTS.md");
  const guidance = fs.existsSync(guidancePath) ? fs.readFileSync(guidancePath, "utf8") : "";
  const carveOuts = guidance.split(/^## Compliance carve-outs\s*$/m)[1]?.split(/^## /m)[0] || "";
  function requireCarveOut(name) {
    if (
      !carveOuts.split("\n").some((line) => /^\s*- /.test(line) && line.includes(`\`${name}\``) && /:\s*\S/.test(line))
    ) {
      throw new Error(
        `Document \`${name}\`: reason under AGENTS.md ## Compliance carve-outs before weakening architecture checks.`,
      );
    }
  }
  const names = new Set(config.forbidden.map((rule) => rule.name));
  if (local.omitRules !== undefined) {
    if (!Array.isArray(local.omitRules)) {
      throw new Error("omitRules must be an array of fleet rule names.");
    }
    for (const name of local.omitRules) {
      if (!names.has(name)) {
        throw new Error(`Unknown architecture rule in omitRules: ${name}`);
      }
      requireCarveOut(name);
    }
    config.forbidden = config.forbidden.filter((rule) => !local.omitRules.includes(rule.name));
  }
  if (local.forbidden !== undefined) {
    if (!Array.isArray(local.forbidden)) {
      throw new Error("forbidden must be an array of additional architecture rules.");
    }
    for (const rule of local.forbidden) {
      if (!rule.name || names.has(rule.name)) {
        throw new Error(`Architecture overlay rules need unique names: ${rule.name}`);
      }
      names.add(rule.name);
      config.forbidden.push(rule);
    }
  }
  if (local.options !== undefined) {
    if (
      !local.options ||
      typeof local.options !== "object" ||
      Array.isArray(local.options) ||
      Object.keys(local.options).some((key) => key !== "exclude")
    ) {
      throw new Error(
        "Architecture overlays may only customize options.exclude; parser, resolution and graph traversal are fleet-owned.",
      );
    }
    if (local.options.exclude !== undefined) {
      requireCarveOut(".dependency-cruiser.local.cjs");
      const exclude = local.options.exclude;
      if (
        typeof exclude !== "string" &&
        (!exclude ||
          typeof exclude !== "object" ||
          Array.isArray(exclude) ||
          Object.keys(exclude).some((key) => key !== "path") ||
          !(
            typeof exclude.path === "string" ||
            (Array.isArray(exclude.path) && exclude.path.every((value) => typeof value === "string"))
          ))
      ) {
        throw new Error("Architecture overlay exclude must be a regex string or { path: string | string[] }.");
      }
      const localExclude = excludePathString(exclude);
      if (!localExclude || new RegExp(localExclude).test("")) {
        throw new Error("Architecture overlay excludes must not match the empty string.");
      }
      config.options.exclude = { path: localExclude };
    }
  }
}

module.exports = config;
