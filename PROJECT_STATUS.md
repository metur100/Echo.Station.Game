# Project status

Last updated: 11 October 2026. Legend: ✅ done and verified · 🔄 in progress · ⛔ blocked (needs the owner) · ❔ not verified

## Game

| Area | Status | Notes |
|---|---|---|
| Simulation engine (fixed 4 Hz timestep, deterministic, commands, validation) | ✅ | unit + property-based tests |
| Power, life support, temperature, wear/breaches, hull | ✅ | `docs/SIMULATION.md` |
| Crew (3 + rescued survivor), tasks, traits, memories | ✅ | |
| Anomalies (Bloom, Choir, Frost) and Echo Memory | ✅ | echoes anchored to cells, consequences recorded |
| Research (18), expeditions (4), incidents (11), objectives (14), endings (3), achievements (15) | ✅ | campaign bot reaches an ending in ~105–125 min ship time |
| Saves (3 slots, backup, migrations, corruption recovery, serialised writes), offline progression | ✅ | |
| Isometric Skia renderer, camera, gestures, overlays | ✅ | played on Android emulator (Expo Go) |
| All 22 required screens | ✅ | boot, menu, slots, intro, ship + inspector + build + pause + incident, research, crew, crew detail, expedition map, mission detail, log, Echo archive, stats, achievements, settings, manual (tutorial), game over, ending, credits |
| Audio (synthesised SFX, ambient, music), haptics | ✅ | volumes and haptics in Settings |
| Accessibility (labels, non-colour status, reduced motion, larger text) | ✅ | ❔ no screen-reader pass done |
| Localisation-ready strings (English) | ✅ | string-completeness test |
| Performance | ✅ / ❔ | dev build on emulator: 47–60 fps UI/JS after optimisation; release-build check on the preview APK pending |
| Physical device test | ❔ | not done (no device attached) |

## Release

| Item | Status | Notes |
|---|---|---|
| EAS project linked (`ce0762fb-…`) | ✅ | `@certi-development/echo-station-the-living-ship` |
| Upload keystore | ✅ | `credentials/android/echo-station-upload.jks`, alias `echo-station`, gitignored |
| Keystore backup | ⛔ | owner: copy keystore + `credentials.json` to a password manager |
| Android production AAB | ✅ / 🔄 | see `release/android/BUILDS.md` |
| iOS build | ⛔ | needs the owner's Apple Developer login (`eas build -p ios`) |
| Store texts, privacy answers, checklist | ✅ | `release/store-metadata/` |
| Store screenshots, icons, feature graphic | ✅ | `release/store-assets/` |
| Trailer | ⛔ | plan in `release/store-metadata/screenshot-plan.md` |
| Play Console / App Store Connect setup, submission | ⛔ | owner accounts |
| Support e-mail | ⛔ | owner: replace the TODO in `google-play.md` |

## Website

| Item | Status |
|---|---|
| Separate repo `Echo.Station.Website` (Vite + React + TS) | ✅ |
| Live on GitHub Pages: https://metur100.github.io/Echo.Station.Website/ | ✅ (HTTP 200 verified) |
| Privacy policy matches the app (no data collected) | ✅ |
| Store buttons "Coming soon", trailer placeholder | ✅ |
| Real screenshots in the gallery | 🔄 |

## Known limitations

- iOS has not been built or run (no Apple account access in this environment); the UI is React Native and shared with Android.
- The game has only been played on an Android emulator, not on physical phones.
- First Skia render after a screen mounts is slow in development builds on the emulator (several seconds); the release build is being checked.
- English only (strings are ready for more languages).
- No trailer yet; store listings ship without video.
