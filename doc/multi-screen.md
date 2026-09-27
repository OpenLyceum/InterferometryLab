# Multi-Screen Simulations

This sim was scaffolded by `npm run scaffold-screens` into `src/michelson/`, `src/mach-zehnder/`, `src/fabry-perot/` (fleet naming:
kebab folders with no `-screen` suffix). This guide covers the architecture and how to add
another screen by hand.

---

## Automated scaffold (preferred)

Already run for this sim — the prototype folder is gone, so a second run exits early.
Kept as reference for the next sim:

```sh
# One screen named after the sim (default when --screens is omitted)
npm run scaffold-screens

# N screens — titles, or kebab:Title pairs
npm run scaffold-screens -- --screens Intro,Lab
npm run scaffold-screens -- --screens intro:Intro,"series-rlc:Series RLC"

# Shared helpers under common/model/ (fleet style)
npm run scaffold-screens -- --screens Intro,Lab --shared-model
```

The scaffolder:

1. Copies the `sim-screen/` prototype into `src/<kebab>/` per screen
2. Writes `src/common/{Prefix}ScreenIcons.ts` stubs and wires icons on each Screen
3. Updates `main.ts`, locale JSON (`screens` + nested `a11y`), and `StringManager`
4. Removes the prototype `sim-screen/` folder

Then always:

```sh
npm run fix     # the emitted/renamed imports need Biome's organizeImports pass
npm run check
```

Independent models by default. Pass `--shared-model` to emit
`src/common/model/SharedModel.ts` and compose it into each screen model
(see [Shared model](#4--shared-model) below).

---

## Architecture patterns

### Single-screen (template default)

```
main.ts
  └─ MichelsonScreen            (Screen<MichelsonModel, MichelsonScreenView>)
       ├─ MichelsonModel         owns all state
       └─ MichelsonScreenView    owns all visuals
```

### Multi-screen with independent state (simplest)

Each screen is completely self-contained. Use this when screens have no shared
physical state — for instance an "Intro" that is purely explanatory and a "Lab"
with interactive controls.

```
main.ts
  ├─ IntroScreen           (Screen<IntroModel, IntroScreenView>)
  │    ├─ IntroModel
  │    └─ IntroScreenView
  └─ LabScreen             (Screen<LabModel, LabScreenView>)
       ├─ LabModel
       └─ LabScreenView
```

### Multi-screen with shared helpers (fleet style)

Put reusable physics in `src/common/model/` under a **domain** name. Each screen
model composes its own instance — code is shared, live state usually is not:

```
common/model/RlcCircuitModel.ts   (or SkyModel, TimeMaster, …)
main.ts
  ├─ IntroScreen → IntroModel { circuit = new RlcCircuitModel() }
  └─ LabScreen   → LabModel   { circuit = new RlcCircuitModel() }
```

### Multi-screen with one live shared instance (optional)

When screens must mutate the **same** Properties, construct once in `main.ts`
and pass the instance into each Screen/Model. Prefer domain names in
`common/model/` — there is no `*RootModel` and no top-level `src/model/`
(see Baton CONVENTIONS).

---

## Step-by-step: adding a second screen by hand

Prefer `npm run scaffold-screens` when creating the sim. Use this section when
growing an already-scaffolded sim.

### 1 — Add strings

`src/i18n/strings_en.json` (and every other locale file):

```json
{
  "title": "Friction",
  "screens": {
    "intro": "Intro",
    "lab": "Lab"
  }
}
```

**Important:** All locale files must define identical keys. TypeScript will error
at compile time if any key is missing (see the `satisfies` checks in
`StringManager.ts`).

### 2 — Expose screen-name properties in StringManager

```typescript
// src/i18n/StringManager.ts
public getScreenNames(): {
  readonly introStringProperty: ReadOnlyProperty<string>;
  readonly labStringProperty:   ReadOnlyProperty<string>;
} {
  return {
    introStringProperty: stringProperties.screens.introStringProperty,
    labStringProperty:   stringProperties.screens.labStringProperty,
  };
}
```

### 3 — Create the second screen folder

Mirror the structure of an existing screen package. Fleet convention: **kebab
folder names without a `-screen` suffix**:

```
src/
├─ common/
│   └─ FrictionScreenIcons.ts   # createIntroIcon(), createLabIcon(), …
├─ intro/
│   ├─ IntroScreen.ts
│   ├─ model/
│   │   └─ IntroModel.ts
│   └─ view/
│       ├─ IntroScreenView.ts
│       ├─ IntroScreenSummaryContent.ts
│       └─ IntroKeyboardHelpContent.ts
└─ lab/
    ├─ LabScreen.ts
    ├─ model/
    │   └─ LabModel.ts
    └─ view/
        ├─ LabScreenView.ts
        ├─ LabScreenSummaryContent.ts
        └─ LabKeyboardHelpContent.ts
```

Each screen file follows the same `Screen<Model, View>` pattern as the
template's `MichelsonScreen.ts`. Screen icons live in one shared module under
`src/common/` (see [Home screen icons](#home-screen-icons)) — do **not** put
a `*ScreenIcon.ts` next to each screen.

### 4 — Shared model

**Automated:** `npm run scaffold-screens -- --screens Intro,Lab --shared-model`
writes `src/common/model/SharedModel.ts` and has each screen model compose
`public readonly shared = new SharedModel()` (same pattern as ACPhasor's
`RlcCircuitModel` / RotatingSky's `SkyModel`). Rename `SharedModel` to a domain
noun when you know it.

**Manual:** add a domain model under `common/model/` and compose it:

```typescript
// src/common/model/FrictionSurface.ts
import { NumberProperty, StringProperty } from "scenerystack/axon";

export class FrictionSurface {
  public readonly surfaceTypeProperty = new StringProperty("wood");
  public readonly normalForceProperty = new NumberProperty(10, { units: "N" });

  public reset(): void {
    this.surfaceTypeProperty.reset();
    this.normalForceProperty.reset();
  }
}
```

Per-screen models compose it (fleet default):

```typescript
// src/intro/model/IntroModel.ts
import { FrictionSurface } from "../../common/model/FrictionSurface.js";

export class IntroModel implements TModel {
  public readonly surface = new FrictionSurface();

  public step(_dt: number): void { /* … */ }
  public reset(): void { this.surface.reset(); }
}
```

### 5 — Register both screens in main.ts

```typescript
// src/main.ts  (inside onReadyToLaunch)

const screens = [
  new IntroScreen({
    name: stringManager.getScreenNames().introStringProperty,
    tandem: Tandem.ROOT.createTandem("introScreen"),
    backgroundColorProperty: InterferometryLabColors.backgroundColorProperty,
  }),
  new LabScreen({
    name: stringManager.getScreenNames().labStringProperty,
    tandem: Tandem.ROOT.createTandem("labScreen"),
    backgroundColorProperty: InterferometryLabColors.backgroundColorProperty,
  }),
];

const sim = new Sim(stringManager.getTitleStringProperty(), screens, { … });
```

Screen models own their composed `common/model/` helpers; `main.ts` only builds the
`screens` array (unless you deliberately share one live instance — see above).

---

## Screen options reference

| Option | Type | Purpose |
|---|---|---|
| `name` | `ReadOnlyProperty<string>` | Localizable tab label |
| `tandem` | `Tandem` | PhET-iO registration root |
| `backgroundColorProperty` | `TReadOnlyProperty<Color>` | Screen background |
| `createKeyboardHelpNode` | `() => Node` | Per-screen keyboard help |
| `homeScreenIcon` | `ScreenIcon` | Icon on the home screen |
| `navigationBarIcon` | `ScreenIcon` | Smaller icon in the nav bar |
| `maxDT` | `number` | Maximum allowed dt in seconds |
| `targetFrameRate` | `number` | Target FPS for `step()` |

---

## Home screen icons

Multi-screen sims show a home screen by default. Each screen needs a
`homeScreenIcon` and usually a `navigationBarIcon`, or SceneryStack falls
back to a generic placeholder.

### Fleet convention

Put **all** screen icons in one module:

```
src/common/InterferometryLabScreenIcons.ts
```

Export one factory per screen named `create{Screen}Icon()`:

| Screen | Factory |
|---|---|
| Intro | `createIntroIcon()` |
| Lab | `createLabIcon()` |
| … | `create…Icon()` |

Wire both icons in each `*Screen.ts` constructor via `optionize` defaults
(same pattern as MotionsOfTheSun / TheRamp):

```typescript
import { createIntroIcon } from "../common/FrictionScreenIcons.js";

optionize<IntroScreenOptions, EmptySelfOptions, ScreenOptions>()(
  {
    backgroundColorProperty: FrictionColors.backgroundColorProperty,
    createKeyboardHelpNode: () => new IntroKeyboardHelpContent(),
    homeScreenIcon: createIntroIcon(),
    navigationBarIcon: createIntroIcon(),
  },
  options,
);
```

Do **not** use per-screen classes like `intro-screen/IntroScreenIcon.ts`.

### Icon module skeleton

Draw on the standard PhET **548 × 373** canvas with scenery primitives and
`*Colors` `ProfileColorProperty`s so icons follow default / projector mode:

```typescript
/**
 * FrictionScreenIcons.ts
 *
 * Programmatic home-screen / navigation-bar icons for each Friction screen.
 * Drawn on the standard PhET 548 × 373 canvas using FrictionColors.
 */
import { Node, Rectangle } from "scenerystack/scenery";
import { ScreenIcon } from "scenerystack/sim";
import FrictionColors from "../FrictionColors.js";

const W = 548;
const H = 373;

function background(): Rectangle {
  return new Rectangle(0, 0, W, H, { fill: FrictionColors.backgroundColorProperty });
}

function iconFrom(content: Node): ScreenIcon {
  return new ScreenIcon(content, {
    maxIconWidthProportion: 1,
    maxIconHeightProportion: 1,
    fill: FrictionColors.backgroundColorProperty,
  });
}

export function createIntroIcon(): ScreenIcon {
  // Distinctive motif for the Intro screen (keep it readable at navbar size too).
  return iconFrom(
    new Node({
      children: [
        background(),
        new Rectangle(180, 120, 188, 133, {
          fill: FrictionColors.accentColorProperty,
          cornerRadius: 12,
        }),
      ],
    }),
  );
}

export function createLabIcon(): ScreenIcon {
  return iconFrom(
    new Node({
      children: [
        background(),
        // … Lab-specific motif …
      ],
    }),
  );
}
```

Each icon should be a miniature of what that screen is about so learners can
tell the screens apart on the home screen.

---

## Accessibility across screens

Each screen must have its own `ScreenSummaryContent` and `KeyboardHelpContent`.
The strings live under per-screen keys in the a11y block:

```json
"a11y": {
  "intro": {
    "screenSummary": { … },
    "currentDetails": "…"
  },
  "lab": {
    "screenSummary": { … },
    "currentDetails": "…"
  }
}
```

Expose them via separate methods in `StringManager`:

```typescript
public getIntroA11yStrings() { return stringProperties.a11y.intro; }
public getLabA11yStrings()   { return stringProperties.a11y.lab; }
```

---

## Using this template beyond a direct copy

### GitHub template repository

The repository is a GitHub **template**. Use the **"Use this template"** button
on GitHub to create a new repository, then:

```sh
npm install
npm run rename -- --id my-sim --name "My Simulation"
npm run scaffold-screens -- --screens Intro,Lab   # or omit --screens for one screen
npm run fix
npm run check
```

`rename` picks up `repository.url` from your `origin` remote; if you cloned the template
directly rather than using **Use this template**, set it in `package.json` by hand.

### Baton `create-sim` (recommended for agents / fleet)

From the OpenLyceum workspace:

```sh
Baton/scripts/create-sim.sh \
  --repo MySim \
  --name "My Simulation" \
  --screens Intro,Lab \
  --shared-model \
  --onboard
```

Creates the GitHub repo from this template, clones it beside `Baton`, runs
rename + scaffold-screens + check. `--onboard` finishes catalog, screenshot,
WebP, Pages index, and the OpenLyceum README Layout row; add `--pr` to open
follow-up PRs. See [`Baton/doc/add-simulation.md`](https://github.com/OpenLyceum/Baton/blob/main/doc/add-simulation.md).

### Monorepo / workspace setup

For organisations building a suite of simulations, a pnpm/npm workspace lets
you share tooling while keeping each sim independent:

```
physics-sims/
├─ package.json          # workspace root (workspaces: ["sims/*"])
├─ sims/
│   ├─ friction/         # forked from this template
│   ├─ waves/
│   └─ optics/
└─ shared/               # optional: shared assets, design tokens
```

Each sim is still independently deployable; the workspace just gives you a
single `npm run build --workspaces` command to build all of them.

### Git subtree for template updates

To pull template improvements back into an existing fork:

```sh
# One-time: add the template as a remote
git remote add template https://github.com/OpenLyceum/SceneryStackTemplate.git

# Pull template changes into a branch for review
git fetch template
git merge template/main --allow-unrelated-histories --squash
```

Review the diff carefully — class-name changes in the template may conflict
with your sim-specific renames.
