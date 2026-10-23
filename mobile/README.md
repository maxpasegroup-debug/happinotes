# HappiNotes mobile app

This is the only active customer mobile app. It uses Expo and React Native to
build Android and iOS apps from one codebase.

## Run locally

1. Start the API as described in [`../backend/README.md`](../backend/README.md).
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the API address
   reachable from your device or simulator.
3. Install and start:

   ```powershell
   npm install
   npx expo start
   ```

Use your computer's LAN IP for a physical device; the phone's `localhost` is the
phone itself. `localhost` is only a development fallback. Test and production
builds require a configured, non-local URL.

## EAS builds

Profiles in `eas.json`:

- `development` — development client using EAS environment `development`.
- `test` — internal test build using EAS environment `preview`.
- `production` — store distribution using EAS environment `production`.

Each EAS environment needs its own `EXPO_PUBLIC_API_URL`. The selected
production API is `https://happinotes-production-6b44.up.railway.app/api`; add
it to the EAS `production` environment before building. Separate development
and test backends are not yet provisioned. EAS builds fail before installation
if the URL is missing; test/store builds reject localhost and require HTTPS.

Run builds from this directory, for example:

```powershell
eas build --platform android --profile test
eas build --platform ios --profile test
eas build --platform android --profile production
eas build --platform ios --profile production
```

In-app purchases need the custom native development client from the `development`
profile. Expo Go cannot load `expo-iap`; install the development build on a
physical device and use a Sandbox/TestFlight or Google Play test account.

See [`../DEPLOYMENT.md`](../DEPLOYMENT.md) for the full release procedure and
[`../LAUNCH_DECISIONS.md`](../LAUNCH_DECISIONS.md) for the fixed app IDs.
Use [`../PHASE6_DEVICE_CHECKLIST.md`](../PHASE6_DEVICE_CHECKLIST.md) to record
the Android/iOS device, purchase, restore, and store-review acceptance checks.
