# AGENTS.md — Interferometry Lab

Sim-specific context for AI assistants. General SceneryStack guidance:
[OpenLyceum/.github/AGENTS.md](https://github.com/OpenLyceum/.github/blob/main/AGENTS.md).
Fleet structure rules: [Baton/CONVENTIONS.md](https://github.com/OpenLyceum/Baton/blob/main/CONVENTIONS.md).

## Project

A physical-optics simulation of the Michelson, Mach-Zehnder and Fabry-Pérot interferometers.
Unlike a ray-tracing sim, everything here comes from **optical path difference**: the model
computes how it varies across a detector and the renderer turns that into an intensity field.

Read [`doc/model.md`](doc/model.md) before changing any physics, and
[`doc/implementation-notes.md`](doc/implementation-notes.md) before changing the renderer or the
colour pipeline. Both are current and specific; they are not stubs.

## The one abstraction to understand first

`src/common/model/FringeSpec.ts` is the contract between every screen model and the single
renderer. A model reduces its whole optical layout to a `FringeSpec`; `FringePatternNode`
evaluates it per pixel and knows nothing about mirrors.

```
Δ(u, v) = ringOpd·cos θ(u,v) + tiltX·u + tiltY·v + constantOpd
```

- `ringOpd` → circular fringes (arm difference, cavity round trip)
- `tiltX` / `tiltY` → straight fringes (mirror wedge)
- `constantOpd` → shifts the whole pattern (an insert in one arm)

A new interferometer is a new model that emits a `FringeSpec`. Do not add instrument-specific
branches to the renderer.

## Key files

| File | Purpose |
|---|---|
| `src/common/model/FringeSpec.ts` | Model → renderer contract; `FringeGroup` carries per-colour path offsets |
| `src/common/model/fringeIntensity.ts` | Pure interference maths — the sim's inner loop *and* all of its physics |
| `src/common/model/spectrum.ts` | Coherence envelopes, line splitting, doublet beats |
| `src/common/model/refractiveIndex.ts` | Gladstone-Dale gases, N-BK7 Sellmeier, tilted plates |
| `src/common/model/LightSourceModel.ts` | Source selection → spectral groups |
| `src/common/view/FringePatternNode.ts` | The renderer (CanvasNode) |
| `src/common/view/IntensityProfileNode.ts` | Bamboo chart of intensity across a cut through the detector |
| `src/michelson/view/CoherenceEnvelopeNode.ts` | Bamboo chart of visibility vs path difference |
| `src/common/TimeModel.ts` | Play/pause clock composed into the Mach-Zehnder and Fabry-Pérot models |
| `src/common/view/spectralColor.ts` | CIE XYZ colour pipeline — see the carve-out below |
| `src/common/view/InterferometryLabNumberControl.ts` | Themed slider; requires an accessible name and explicit keyboard steps |
| `src/{michelson,mach-zehnder,fabry-perot}/` | One folder per screen, `model/` + `view/` |

## Things that will bite you

- **Every optical length in the model is in nanometres.** Controls that read µm or mm use
  `UnitConversionProperty` at the view boundary (Michelson coarse stage, Fabry-Pérot spacing).
  Do not introduce mixed units into the model.
- **Do not sum colours in sRGB.** Use `spectralColor.ts`. Adding gamma-encoded values is not
  adding light, and averaging per-wavelength sRGB across the visible band gives yellow-green, not
  white. This was a real bug, fixed; see the implementation notes.
- **A Michelson arm is traversed twice.** Mirror travel `x` gives path difference `2x`; a gas
  cell of length `L` gives `2L(n−1)`. Missing the factor of two halves every fringe count.
- **Contrast and visibility are different things.** `spec.contrast` is a blanket multiplier
  (which-path marker, alignment loss). The source's coherence envelope is computed per spectral
  group inside the renderer from that group's own path difference. Both multiply.
- **Zero path difference with parallel mirrors shows a single flat tone, not fringes.** That is
  correct. `opdSpread()` exists so the a11y description says so rather than claiming rings.
- **Fringe counts are derived from a reference, never accumulated**, so they cannot drift.
- **A chart node must dispose every Property it created**, not just its `Multilink`. The
  formatter Properties behind an `accessibleParagraph` each link a model Property of their own, so
  leaving them alive keeps the node reachable from a model that outlives it. `tests/memory-leak.test.ts`
  catches this; it caught it once already.
- **The analysis charts pad their value axis** past what the physics can reach, because the traces
  that matter most are flat ones (a dark port at 0, a constant total at 1, a laser's visibility at
  1). Against the frame those look like an empty chart.

## Accessibility

The three required layers are wired: `accessibleName` on every control (sourced from the `a11y`
string group), a live `ScreenSummaryContent` per screen, and an explicit `pdomOrder` wrapper Node.

The live "current details" paragraph names the *kind* of pattern on the detector — rings, bars,
one flat fringe, or none — because that is the one thing a sighted user reads instantly and the
numbers do not convey. `MichelsonScreenSummaryContent` derives it from visibility, `opdSpread()`
and tilt.

Keyboard help leads with the slider section on all three screens: several controls (the
micrometer, mirror tilt) only reach their useful precision via shift-arrow.

## Compliance carve-outs

- **Hardcoded colors:** `src/common/view/spectralColor.ts` and `sourceColor.ts` construct colours in
  code. The compliance grep flags `new Color(...)` and `encodeSrgb(...)` as possible hardcoded
  colors. They are not theme colours — they are the output of a wavelength-to-colour computation,
  which is physics, not styling. Every *themeable* colour lives in `InterferometryLabColors.ts`.
  `scenery-phet`'s `VisibleColor` is deliberately not used for anything that gets summed, for the
  reasons in the implementation notes.
- **`tests/memory-leak.test.ts` diverges from the template**: its `forceGC()` takes a predicate
  and exits early. The template's version runs all fifteen `gc()` passes unconditionally in its
  last test and exceeds the 30 s timeout in this environment — it fails on a pristine template
  checkout too, so this is a fix rather than a deviation. Worth upstreaming.


### `package.json` overrides

JSON cannot carry comments, so the rationale for forced transitive pins lives here. Prefer
**tilde (`~`) or exact** versions — caret (`^`) lets minors drift under what is meant to be a
hard pin. Dependabot ignores these three names (see `.github/dependabot.yml`) so it does not
open PRs that fight the overrides. Revisit when SceneryStack drops or re-pins them upstream.

| Override | Pin | Why |
|---|---|---|
| `lodash` | `~4.18.1` | SceneryStack declares `~4.17.12`. Bump clears Dependabot/npm advisories patched in 4.18.x (e.g. GHSA-r5fr-rjxr-66jc, GHSA-f23m-r3pf-42rh). |
| `three` | `~0.125.2` | SceneryStack declares `^0.104.0`. Floor is 0.125.0 for GHSA-fq6p-x6j3-cmmq (ReDoS). Staying on the 0.125 line avoids a larger API jump; **0.125.x still has open CVEs** (e.g. XSS GHSA-7vvq-7r29-5vg3, fixed only in ≥0.137.0). Remove this override if/when SceneryStack stops depending on `three` or pins a patched line itself. LightPropagation keeps a higher `three` pin — do not force 0.125 there. |
| `brace-expansion` | `~5.0.9` | Transitive via `vite-plugin-pwa` / Workbox. Clears npm audit (originally GHSA-mh99-v99m-4gvg; keep ≥5.0.9 for GHSA-rgw5-rvv9-x895). |

## Testing

138 vitest specs; `happy-dom`, template `tests/setup.ts`.

| Path | Covers |
|---|---|
| `tests/spectrum.test.ts` | coherence, visibility envelopes, doublet beats, line splitting |
| `tests/fringeIntensity.test.ts` | detector geometry, two-beam and Airy intensity, finesse, `intensityProfile` |
| `tests/refractiveIndex.test.ts` | Sellmeier vs published indices, Gladstone-Dale, tilted plates |
| `tests/interferometerModels.test.ts` | all three models: derived values, controls, reset |
| `tests/memory-leak.test.ts` | dispose/WeakRef, extended to the four nodes that link model Properties |

Several assertions are anchored to **published** values (N-BK7 at 632.8 nm and 587.6 nm, its Abbe
number, air's refractivity) rather than to the implementation, so a wrong constant fails instead
of being locked in. Keep that property when adding tests.

## Commands

```bash
npm run lint && npm run check && npm run build && npm test
```

`npm run release` intentionally skips `npm test` in some sims — append `&& npm test` before the version bump so a release cannot ship a failing suite.

| Command | Description |
|---|---|
| `npm start` / `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run build:single` | Single-file build |
| `npm run check` | `tsc --noEmit` across app, scripts and tests |
| `npm run lint` / `npm run fix` | Biome check / auto-fix |
| `npm test` | Vitest |
| `npm run test:fuzz` / `:quick` | Playwright fuzz smoke |
| `npm run icons` | Regenerate PWA icons |

Use `?screens=1`, `?screens=2`, `?screens=3` to open a single screen directly — much faster than
clicking through the home screen when checking a change.
