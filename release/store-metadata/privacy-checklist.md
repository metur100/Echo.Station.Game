# Privacy disclosures checklist

Verified against the code of build 1.0.0 (1).

## What the app does with data

| Question | Answer | Evidence |
|---|---|---|
| Accounts / sign-in | None | no auth code or SDK |
| Network requests | None at runtime | no `fetch`/HTTP client in `src/`; the only links open the website in the system browser when the player taps them (Credits screen) |
| Analytics | None transmitted | `src/analytics/analytics.ts` keeps at most 100 events in memory on the device and never sends them; no analytics SDK installed |
| Crash reporting | None | no crash SDK |
| Advertising / ad IDs | None | no ad SDK; `AD_ID` permission not requested |
| In-app purchases | None | `src/monetization/monetization.ts` is a disabled boundary; no billing SDK |
| Stored data | Save games (3 slots + backups) and settings, as JSON files in the app's private documents folder | `src/persistence/storage.ts`, `src/state/settingsStore.ts` |
| Data leaves the device | Never (except the OS's own app backup, if the user has it enabled) | — |
| Permissions | Android (verified in the AAB manifest): `VIBRATE` (haptics), `MODIFY_AUDIO_SETTINGS` and `WAKE_LOCK` (audio playback), `INTERNET` and `ACCESS_NETWORK_STATE` (added by default by React Native / Expo modules — the game makes no network requests). All are normal permissions with no runtime prompt. Blocked: microphone, storage, overlay, foreground service. iOS: none requested | `app.json`, `bundletool dump manifest` |
| Children | Not designed for children; collects nothing from anyone | — |
| Deleting data | Uninstalling deletes everything; individual slots can be deleted in *Load game* | — |

## Google Play — Data safety form

- Does your app collect or share any of the required user data types? → **No**
- Is all of the user data collected by your app encrypted in transit? → not applicable (nothing collected)
- Do you provide a way for users to request that their data is deleted? → not applicable (nothing collected; local data is deleted on uninstall)

Result: *No data collected · No data shared*.

## Apple — App Privacy

- Do you or your third-party partners collect data from this app? → **No** → *Data Not Collected*.
- Privacy manifest (`app.json › ios.privacyManifests`): `NSPrivacyTracking: false`, no tracking domains, no collected data types; required-reason APIs declared: file timestamps (`C617.1`), user defaults (`CA92.1`).

## If this changes

Adding analytics, crash reporting, ads or purchases requires, before release:
1. updating the website privacy policy,
2. re-answering both store forms,
3. a consent prompt where required (GDPR / ATT),
4. updating this checklist.
