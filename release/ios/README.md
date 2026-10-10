# iOS release (App Store)

| | |
|---|---|
| Bundle identifier | `com.certidevelopment.echostation` |
| Version | `1.0.0` (`expo.version`) |
| Build number | `1` (`expo.ios.buildNumber`, raise it for every upload) |
| Devices | iPhone and iPad (`supportsTablet: true`), all orientations |
| Encryption | `ITSAppUsesNonExemptEncryption = false` (no custom crypto, no network) |
| Privacy manifest | no tracking, no collected data; required-reason APIs declared for file timestamps and user defaults (used by React Native / Expo) |
| EAS profile | `production` with `credentialsSource: "remote"` (EAS manages certificates and profiles) |

## What you need

1. An **Apple Developer Program** membership (paid, 99 USD/year) for the team that will publish the app.
2. Access to **App Store Connect** for that team (Account Holder, Admin or App Manager).
3. An app record in App Store Connect:
   - *My Apps → + → New App* → platform iOS, name **Echo Station: The Living Ship**, primary language English (U.S.), bundle ID `com.certidevelopment.echostation` (register it under *Certificates, IDs & Profiles → Identifiers* first, or let EAS register it during the first build), SKU e.g. `echo-station-ios`.
4. A Mac is **not** required: EAS builds in the cloud.

No Apple credentials, certificates or keys belong in this repository. EAS stores the distribution certificate and provisioning profile on its servers; App Store Connect API keys (`.p8`) are gitignored if you ever download one.

## Build

```bash
npm install -g eas-cli
eas login
npm ci && npm run verify
eas build --platform ios --profile production
```

On the first run EAS asks you to log in with your Apple ID (2FA) and offers to create the **distribution certificate** and **App Store provisioning profile**. Accept; it stores them for later builds. To inspect or download them: `eas credentials -p ios`.

The build produces an `.ipa`.

## Upload to TestFlight / App Store Connect

```bash
eas submit --platform ios --profile production --latest
```

`eas submit` uploads to App Store Connect (asks for the Apple ID or an App Store Connect API key the first time). Alternatively download the `.ipa` and upload it with Apple's **Transporter** app on a Mac.

Then in App Store Connect:

1. **TestFlight**: the build appears after processing (10–30 min). Fill in *Test Information*, add internal testers, and answer the export-compliance question (*No* — already declared in Info.plist).
2. **App Store → 1.0 Prepare for Submission**: paste the texts from `release/store-metadata/app-store.md`, upload the screenshots from `release/store-assets/app-store/`, set the age rating, App Privacy (*Data Not Collected*), pricing (Free), select the build, and *Submit for Review*.

## Versions

- Every upload needs a new `ios.buildNumber` (and Play needs a new `android.versionCode`). Raise both in `app.json` before `eas build`.
- A new public version (1.0.1, 1.1.0…) changes `expo.version`.

## Status

No iOS build has been run yet: it needs the Apple Developer account login, which only the owner can provide interactively. Everything in the project is configured for it.
