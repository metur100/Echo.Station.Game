# Android release (Google Play)

| | |
|---|---|
| Package | `com.certidevelopment.echostation` |
| Version | `1.0.0` (`expo.version` in `app.json`) |
| Version code | `1` (`expo.android.versionCode`, raise it for every upload) |
| EAS project | `@certi-development/echo-station-the-living-ship` (`ce0762fb-07aa-43c0-a416-3ba3ee84922e`) |
| Build profile | `production` → Android App Bundle (`.aab`), release-signed |
| Signing | upload key from **local** `credentials.json` (`credentialsSource: "local"`) |

## Signing key (upload key)

The upload keystore was generated with `keytool` (RSA 2048, 10 000 days validity):

| | |
|---|---|
| Keystore file | `credentials/android/echo-station-upload.jks` (this PC only) |
| Key alias | `echo-station` |
| Owner | `CN=Medin Turkes, O=Medin Turkes` |
| Passwords | in `credentials.json` (store and key password are the same random 32-character value) |
| SHA-1 | `95:A6:6E:71:20:BD:F0:1D:61:77:93:E7:42:66:3D:CC:D6:C0:61:62` |
| SHA-256 | `D2:CD:01:00:B3:DA:08:DA:D9:53:9C:F6:39:27:A7:E3:09:43:8B:42:A8:D7:76:DF:FE:1E:6B:38:6B:82:B0:A9` |

`credentials/` and `credentials.json` are listed in `.gitignore` and `.easignore`; they are **never** committed. EAS CLI reads them locally and sends the keystore to the build server over its authenticated API.

**Back it up now.** Copy `credentials/android/echo-station-upload.jks` and the contents of `credentials.json` into a password manager (e.g. a secure note with the file attached) or an encrypted backup. Do not e-mail it or put it in cloud folders that sync unencrypted.

- If you keep **Play App Signing** (recommended, the default), Google holds the app signing key and this file is only the *upload key*. If it is lost, an upload-key reset can be requested in Play Console → *App integrity* (takes a few days).
- Do **not** generate a new keystore once a build signed with this one has been uploaded.
- EAS-managed signing is the alternative: `eas credentials -p android` can upload this keystore to EAS (then set `credentialsSource` to `remote`), and you can download a backup from the same menu. With local credentials, the copy on this PC is the source of truth.

To read the passwords without printing them to a shared screen: open `credentials.json` locally.

## Build

```bash
npm install -g eas-cli          # once
eas login                       # account with access to certi-development
npm ci
npm run verify                  # typecheck + lint + tests
eas build --platform android --profile production
```

The CLI prints a build URL; when the build finishes, download the `.aab` from it (or `eas build:list --platform android`). Keep downloaded bundles in `release/builds/` (gitignored).

## Verify the artifact

```bash
# Package name, version and code
bundletool dump manifest --bundle=release/builds/echo-station-1.0.0-1.aab | findstr /R "package versionCode versionName"
# Signature: must be the upload key above (SHA-256 D2:CD:01:…), not a debug key
keytool -printcert -jarfile release/builds/echo-station-1.0.0-1.aab
# Not debuggable: the manifest must not contain android:debuggable="true"
bundletool dump manifest --bundle=release/builds/echo-station-1.0.0-1.aab | findstr debuggable
```

(`bundletool` ships with Android Studio or can be downloaded from https://github.com/google/bundletool/releases.)

For on-device QA of a release build, build an installable APK with the `preview` profile:

```bash
eas build --platform android --profile preview
adb install echo-station-preview.apk
```

## Upload to Google Play

1. Play Console → *Create app*: name *Echo Station: The Living Ship*, default language English (US), **Game**, **Free**.
2. Fill in *App content* and *Main store listing* from `release/store-metadata/google-play.md` and `privacy-checklist.md`.
3. *Testing → Internal testing → Create release*, upload the `.aab`, paste the release notes, *Review release → Start rollout*.
4. Keep **Play App Signing** enabled when asked.
5. Promote through closed testing to production once the Play requirements for new accounts are met.

Optional automation (needs a Google service-account key, never commit it):

```bash
eas submit --platform android --profile production   # uploads the latest build to the internal track as a draft
```

## Build log

See `release/android/BUILDS.md` for the builds that were actually run, their URLs and verification results.
