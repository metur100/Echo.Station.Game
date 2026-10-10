# Screenshot and trailer plan

## Source of truth

Every screenshot is a capture of the **real game** running in Expo Go on an Android emulator. Scenes are real game states built by the engine (`src/dev/demoState.ts`, opened through the development-only `/dev-demo` route): a mid-campaign Meridian with an overload's residual energy around the reactor, the Lumen Bloom in hydroponics, Void Frost in the airlock, crew at work and research running. Nothing is painted over or mocked up.

The captioned versions are **promotional compositions**: the unmodified capture, scaled into a framed panel, with one caption above it. Captions describe features that exist in this build.

Note for iOS: the captures come from Android (React Native renders the same UI); the status bar is Android's demo-mode bar (9:41, full battery). If Apple review objects, recapture on an iOS Simulator with the same scenes.

## Pipeline

```bash
npx expo start --go --port 8082                    # Metro
node release/tools/capture-screenshots.mjs         # raw captures for every size → release/store-assets/raw/<device>/
node release/tools/compose-store-assets.mjs        # captioned screenshots, icon, feature graphic → release/store-assets/<store>/
```

## Sizes

| Store | Folder | Pixels |
|---|---|---|
| Google Play phone | `google-play/phone` | 1080 × 1920 |
| Google Play 7" tablet | `google-play/tablet-7` | 1200 × 1920 |
| Google Play 10" tablet | `google-play/tablet-10` | 1600 × 2560 |
| App Store iPhone 6.9" (required) | `app-store/iphone-6.9` | 1320 × 2868 |
| App Store iPad 13" (required) | `app-store/ipad-13` | 2064 × 2752 |
| Play icon | `google-play/icon-512.png` | 512 × 512 |
| Play feature graphic | `google-play/feature-graphic-1024x500.png` | 1024 × 500 |
| App Store icon | `app-store/icon-1024.png` | 1024 × 1024 (no alpha) |

## Order and captions

| # | Scene | Caption | Sub-caption |
|---|---|---|---|
| 1 | Ship overview | Keep a living ship alive | A real-time simulation of power, air, food, water and heat |
| 2 | Inspector on the Bloom | Every anomaly follows rules | See why the Lumen Bloom grows — and which room it takes next |
| 3 | Echo archive | The ship remembers | Overloads, breaches and decisions leave echoes that come back |
| 4 | Build placement | Build room by room | 14 modules on an isometric hull, placed by hand |
| 5 | Crew detail | A crew with history | Skills, traits, fatigue and memories shape every task |
| 6 | Power overlay | Read the ship at a glance | Power, heat, damage and echo overlays |
| 7 | Research tree | Four research branches | Turn dangerous anomalies into technology |
| 8 | Expedition map | Explore what lies beyond | Four destinations and a campaign with three endings |
| 9 | Incident | Hard calls, real consequences | Incidents read the actual state of your ship |

Play allows 2–8 phone screenshots: upload 1–8. The App Store allows up to 10: upload all 9.

## Trailer plan (not produced yet)

A 25–30 s app preview (App Store: portrait 886 × 1920 or the device's native resolution, 15–30 s; Play: YouTube link):

1. 0–4 s — boot screen, the Meridian drifting, title *ECHO STATION*.
2. 4–9 s — the reactor running hot; tap, inspect, send Ines to repair; the battery bar fills.
3. 9–14 s — drag an oxygen generator into place; construction completes; oxygen turns positive.
4. 14–19 s — the Bloom spreading toward hydroponics; the inspector shows "Feeding on residual energy".
5. 19–24 s — the Echo archive; caption "The ship remembers."
6. 24–30 s — expedition map, launch to the Lantern; end card with the logo and "Coming to Android and iOS".

Record with `adb shell screenrecord` on the emulator at 1080 × 1920 (store sizes as above), cut and caption in any video editor; captions must only show what the build does. Until it exists, store listings ship without video and the website shows a designed "trailer in production" placeholder.
