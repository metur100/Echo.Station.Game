# Asset manifest

All art and audio in ECHO STATION is original and generated in this repository. No stock images, franchise art or sampled audio.

## Game world (procedural, Skia)

| Asset | Source | Notes |
|---|---|---|
| Hull plates, rim light, engine pods, sensor mast | `src/game/rendering/shipPicture.ts` | world units: 64 × 32 px tiles, 24 px walls |
| Room shells (floor, back walls, light strips, front lip) | `shipPicture.ts › drawModule` | one shell per footprint, shaded from the upper left |
| Machinery for all 14 modules | `shipPicture.ts › drawMachinery` | reactor core, tanks, planters, bunks, consoles and specimen tank, crates, hatch, fins, emitter dish, containment rings, condenser crystal |
| Damage, cracks, breach, quarantine stripes, construction blueprint | `shipPicture.ts` | condition buckets ≥ 60 / 25 / 10 |
| Echo marks (contamination speckles, structural cracks) | `shipPicture.ts › drawEchoMarks` | harnessed variants recoloured |
| Anomalies: Bloom tendrils, Choir arcs, Frost crystals | `src/game/rendering/overlayGeometry.ts` + `ShipView.tsx` | animated |
| Overlays: power, heat, damage, echo; selection; build ghost; crew markers; status lamps | `ShipView.tsx` | |
| Starfield and nebulae | `src/components/Starfield.tsx` | static, seeded |
| Expedition star chart | `src/app/expeditions/index.tsx` | |

## Interface (vector)

| Asset | Source | Size |
|---|---|---|
| Icon set (UI, resources, modules, anomalies, research, achievements — ~75 icons) | `src/components/icons.ts`, rendered by `Icon.tsx` | 24 × 24 grid, 1.8 px round strokes |
| Crew portraits (Ines, Tomas, Mira, Elias) | `src/components/Portrait.tsx` | 100 × 100 viewBox, any size |
| Logo mark | `src/components/Logo.tsx` | 120 × 120 viewBox |

## App icon and splash

Source: `scripts/icon-art.mjs` (SVG) → `npm run icons` (renders with Edge/Chromium via playwright-core) → `assets/images/`.

| File | Size | Use |
|---|---|---|
| `icon.png` | 1024 × 1024 | iOS icon, Expo default icon |
| `android-icon-foreground.png` | 1024 × 1024 | adaptive icon foreground (mark inside the 66 % safe zone) |
| `android-icon-background.png` | 1024 × 1024 | adaptive icon background |
| `android-icon-monochrome.png` | 1024 × 1024 | Android 13+ themed icon |
| `splash-icon.png` | 1024 × 1024 | splash mark on `#050812` |
| `favicon.png` | 48 × 48 | web |

## Fonts

Bundled from `@expo-google-fonts` (SIL Open Font License 1.1), only the weights used:
Oxanium 600 / 700 (display), Inter 400 / 500 / 600 (interface).

## Audio

Source: `scripts/generate-sounds.mjs` → `npm run sounds` → `assets/sounds/` (16-bit mono WAV, 22 050 Hz).

| File | Length | Use |
|---|---|---|
| `tap`, `select` | < 0.2 s | UI feedback |
| `place`, `build` | 0.25 / 0.7 s | placement, construction complete |
| `warning`, `alarm`, `error` | 0.3–1.2 s | incidents, overloads, breaches, invalid actions |
| `research`, `success`, `mission`, `echo` | 0.5–2.2 s | research complete, objectives, expeditions, new echoes |
| `ambient` | 7.5 s loop | ship hum (follows the music volume) |
| `music` | 32 s loop | ambient pad (Am – Fmaj7 – C – G) |

Missing or failing audio never crashes the game (`src/audio/audio.ts` wraps every call).

## Store and website

- `release/store-assets/` — raw captures from the running game and captioned store compositions (see `release/store-metadata/screenshot-plan.md`).
- The website (separate repository `Echo.Station.Website`) uses its own original SVG artwork plus screenshots copied from `release/store-assets`.
