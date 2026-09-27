# Interferometry Lab

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

An interactive physical-optics simulation of the three interferometers every optics course
covers — **Michelson**, **Mach-Zehnder** and **Fabry-Pérot** — built with
[SceneryStack](https://scenerystack.org/), Vite 8, TypeScript 7, and Biome 2.

Geometric-optics simulators are common. This one is a *physical* optics simulator: it tracks
optical path length, phase and partial coherence, and renders the interference pattern those
produce rather than drawing a picture of one.

**[Launch the simulation →](https://openlyceum.github.io/InterferometryLab)**

## Features

- **Michelson** — coarse and micrometer mirror travel, mirror tilt to drive circular fringes into
  straight ones, an evacuable gas cell for the classic index-of-refraction measurement, a
  compensator plate, a fringe counter, an intensity trace across the detector, and a visibility
  curve that shows the coherence envelope — flat for a laser, a needle for white light, and the
  sodium doublet's nulls and revivals
- **Mach-Zehnder** — both complementary output ports shown at once, an insertable sample slide
  with adjustable thickness, index and tilt, and a single-photon mode that builds the pattern one
  detection at a time (pausable and steppable), with a which-path marker that erases it — and a
  trace of both ports whose dashed total stays flat, so interference visibly moves light rather
  than destroying it
- **Fabry-Pérot** — mirror reflectance from 0.04 to 0.99, absorption, cavity spacing and a
  scanning mode you can pause and step onto a transmission peak, with live finesse, free spectral
  range and resolving power, plus a transmission spectrum showing whether two lines are resolved
- **Six light sources** from a helium-neon laser to white light, spanning 200 mm to 1 µm of
  coherence length — including the sodium doublet and its visibility beats
- Physically computed colour: white-light fringes come out with the correct achromatic centre and
  coloured orders, summed in linear light through CIE XYZ
- An optional Preferences overlay labelling each optical element with what it contributes to the
  optical path difference — including the factor of two a Michelson arm carries and a
  Mach-Zehnder's does not
- Full keyboard access and live screen-reader descriptions of the pattern and of both charts
- English, Spanish, and French localization via `StringManager`
- Default and projector color profiles
- Progressive Web App (installable, offline-capable)
- Shared GitHub Actions CI via `OpenLyceum/Baton`

### Documentation

| Document | Contents |
|---|---|
| [`doc/model.md`](doc/model.md) | The physics: coherence, path difference, the three instruments |
| [`doc/implementation-notes.md`](doc/implementation-notes.md) | Architecture, the renderer, the colour pipeline |

## Quick Start

```bash
npm install
npm run icons    # generate PNG icons from public/icons/icon.svg
npm start        # dev server → http://localhost:5173
```

## Scripts

| Command | Description |
|---|---|
| `npm start` / `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run Vitest unit tests (includes memory-leak suite) |
| `npm run test:fuzz` | Optional Playwright fuzz smoke: pointer (`?fuzz`) + keyboard (`?fuzzBoard`), with `?ea`, 30s each |
| `npm run test:fuzz -- 90` | Same fuzz for 90 seconds (`--duration 90` or `FUZZ_DURATION=90` also work) |
| `npm run test:fuzz:quick` | Shorter fuzz smoke (10s) |
| `npm run test:fuzz:long` | Longer fuzz smoke (300s) |
| `npm run check` | TypeScript type check |
| `npm run lint` | Biome lint check |
| `npm run format` | Auto-format all files |
| `npm run fix` | Lint + auto-fix |
| `npm run icons` | Regenerate PNG icons from `public/icons/icon.svg` |
| `npm run release` | `check && lint && build && test`, then version patch + push tags |
| `npm run clean` | Remove `dist/` |

New sims start at `version: "0.0.0"` in `package.json`. Bump only when cutting a release (for example `npm version patch` and a matching git tag). Keep `name` in kebab-case; it is separate from the SceneryStack sim identifier in `src/init.ts`, which reads its `version` from `package.json`.

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| [SceneryStack](https://scenerystack.org/) | ^3.0.0 | Simulation framework |
| [Vite](https://vitejs.dev/) | ^8 | Build tool + dev server |
| [TypeScript](https://www.typescriptlang.org/) | ^7 | Type-safe JavaScript |
| [Biome](https://biomejs.dev/) | ^2.5 | Linting + formatting |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | ^1 | PWA + service worker |

## License

GNU Affero General Public License v3.0 — see [OpenLyceum org license](https://github.com/OpenLyceum/.github/blob/main/LICENSE).

## Contributing

See [OpenLyceum contributing guidelines](https://github.com/OpenLyceum/.github/blob/main/CONTRIBUTING.md).
Report bugs via GitHub Issues; use org issue templates.
