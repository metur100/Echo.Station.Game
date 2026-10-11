# Release checklist — 1.0.0 (1)

Legend: [x] done and verified · [ ] to do · (owner) needs the account owner

## Build quality
- [x] `npm run typecheck` passes
- [x] `npm run lint` passes
- [x] `npm test` passes (unit, component and campaign playthrough tests)
- [x] Production JS bundle exports (`npm run bundle:check`)
- [x] Played on an Android emulator: new game, tutorial, build, repair, research, incident, expedition, save/continue, offline summary
- [x] Release (preview) APK installed and run on the emulator
- [ ] Played on a physical Android phone (release build)
- [ ] Played on an iPhone / iPad (owner: needs a device or Simulator)

## Android / Google Play
- [x] Package `com.certidevelopment.echostation`, version 1.0.0, versionCode 1
- [x] Upload keystore created, verified, excluded from git (see `release/android/README.md`)
- [ ] (owner) Keystore and passwords backed up to a password manager
- [x] Production AAB built and verified — see `release/android/BUILDS.md`
- [ ] (owner) Play Console app created, store listing and App content filled from `google-play.md`
- [ ] (owner) Real support e-mail entered (replace the TODO placeholder)
- [ ] (owner) Data safety: *no data collected*
- [ ] (owner) Content rating questionnaire
- [ ] (owner) Internal test → closed test (12 testers × 14 days for new personal accounts) → production

## iOS / App Store
- [x] Bundle ID `com.certidevelopment.echostation`, buildNumber 1, encryption exemption, privacy manifest
- [ ] (owner) Apple Developer membership and App Store Connect app record
- [ ] (owner) `eas build -p ios --profile production` (EAS creates the certificate and profile on first login)
- [ ] (owner) `eas submit -p ios` → TestFlight → App Review
- [ ] (owner) App Privacy: *Data Not Collected*; age rating questionnaire

## Store assets
- [x] Icons (Play 512, App Store 1024), feature graphic 1024 × 500, Play headers 5244 × 2950 and 3840 × 1646
- [x] Screenshots for Play phone / 7" / 10" and App Store 6.9" / 6.3" / 13"
- [ ] Trailer / app preview (plan in `screenshot-plan.md`)

## Website and legal
- [x] Website live on GitHub Pages with privacy policy and support section
- [x] Store buttons show "Coming soon" (no fake store links)
- [ ] Replace "Coming soon" with real store URLs after publication (`src/content/links.ts` in the website repo)
- [ ] (owner) Optional: custom domain (see the website's `docs/DEPLOYMENT.md`)
