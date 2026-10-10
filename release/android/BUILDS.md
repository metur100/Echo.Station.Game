# Android build log

Builds that were actually run on EAS, with what was verified. Artifacts live on EAS (links expire after the EAS retention period) and locally in `release/builds/` (gitignored).

| Build | Profile | Commit | Result | Artifact |
|---|---|---|---|---|
| [5954b4d8](https://expo.dev/accounts/certi-development/projects/echo-station-the-living-ship/builds/5954b4d8-e2f6-42ee-9039-a46c7e55d5da) | production (AAB) | `8521332` (before the save-concurrency fix) | ✅ finished | [.aab](https://expo.dev/artifacts/eas/59srlwDdlAk7rRyTWtN6j54BmvmrCNnux5bUlpF49qo.aab) — superseded, do not upload |
| [9c2d2f8c](https://expo.dev/accounts/certi-development/projects/echo-station-the-living-ship/builds/9c2d2f8c-578b-47f0-8e73-6e34bd37c446) | preview (APK) | `237f84a` | ✅ finished, installed and played on the emulator | [.apk](https://expo.dev/artifacts/eas/2y14JYB9hmwaA_kJEBKsreN96N_P24wHKvnENha9M90.apk) |
| [993f2dca](https://expo.dev/accounts/certi-development/projects/echo-station-the-living-ship/builds/993f2dca-e88e-4894-a01d-2feb3ea97cb7) | production (AAB) | `618e43b` | ✅ finished — **upload this one** | [.aab](https://expo.dev/artifacts/eas/ylukRjTdoPeg4SAdspLrml4gnDxRG7i6BO6coxhoPcc.aab), local copy `release/builds/echo-station-1.0.0-1.aab` (117.6 MB) |

## Verification of the production AAB (build 993f2dca)

`bundletool validate` passes.

```text
bundletool dump manifest
  package="com.certidevelopment.echostation"
  android:versionCode="1"  android:versionName="1.0.0"
  android:minSdkVersion="24"  android:targetSdkVersion="36"
  no android:debuggable attribute (release build)
  permissions: VIBRATE, MODIFY_AUDIO_SETTINGS, WAKE_LOCK, INTERNET, ACCESS_NETWORK_STATE,
               com.certidevelopment.echostation.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION

keytool -printcert -jarfile release/builds/echo-station-1.0.0-1.aab
  Owner: CN=Medin Turkes, O=Medin Turkes
  SHA256: D2:CD:01:00:B3:DA:08:DA:D9:53:9C:F6:39:27:A7:E3:09:43:8B:42:A8:D7:76:DF:FE:1E:6B:38:6B:82:B0:A9   (= upload key)
```

targetSdkVersion 36 meets Google Play's current target-API requirement (API 35+ for new apps since August 2025); re-check the Play Console requirements at upload time.

## Release-build check (preview APK on the emulator)

- Cold start (`am start -W`): 5.7 s to first frame on the emulator, menu renders fully.
- New game → intro → ship screen works; settings persist; continuing a save shows the offline summary.
- Frame timing on this emulator is limited by its OpenGL translation layer: the stock Android Settings app scrolls at a 77 ms median frame time on the same emulator, and the game's ship screen measures in the same range. Real frame rates must be checked on a physical phone.
