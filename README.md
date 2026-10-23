# HappiNotes

HappiNotes is an audiobook learning app. The customer mobile app is the single
Expo application in `mobile/`, built from one codebase for Android and iOS.

## Project map

- `mobile/` — Expo and React Native customer app, including audio playback.
- `backend/` — TypeScript, Express, and MongoDB API for accounts, books,
  listening progress, and Apple/Google subscription verification.
- `admin/` — separate Next.js staff website for managing the catalog and users.
- `flutter_app/` — archived Flutter client retained for reference; not a launch
  target and not part of the active mobile product.

## Local development

1. Start the backend by following [`backend/README.md`](backend/README.md).
2. In `mobile/`, copy `.env.example` to `.env` and set
   `EXPO_PUBLIC_API_URL` to the backend URL reachable from your device.
3. Install dependencies and start Expo:

   ```powershell
   cd mobile
   npm install
   npx expo start
   ```

For a physical phone, use the computer's LAN IP rather than `localhost` in the
local API URL. Store and test builds require an explicit, non-local API URL.
In-app purchase screens require an EAS development build; Expo Go does not
include the native store billing modules. See [`STORE_PRODUCTS.md`](STORE_PRODUCTS.md)
for product IDs and the required store-verification setup.

## Build Android and iOS

Use [EAS Build](https://docs.expo.dev/build/introduction/) from `mobile/`:

```powershell
eas build --platform android --profile development
eas build --platform ios --profile development
eas build --platform android --profile test
eas build --platform ios --profile test
eas build --platform android --profile production
eas build --platform ios --profile production
```

Build profiles map to separate EAS environments: `development` uses the
development environment, `test` uses the EAS `preview` environment, and
`production` uses the production environment. Set `EXPO_PUBLIC_API_URL` in each
environment in Expo project settings. EAS builds fail if a URL is missing or
invalid. The selected production URL is
`https://happinotes-production-6b44.up.railway.app/api`; add it to EAS before
building. Development and test backend URLs must be provisioned separately;
never point test builds at live customer data.

For the canonical release setup and platform identifiers, see
[`DEPLOYMENT.md`](DEPLOYMENT.md) and [`LAUNCH_DECISIONS.md`](LAUNCH_DECISIONS.md).
Before release, complete [`PHASE6_DEVICE_CHECKLIST.md`](PHASE6_DEVICE_CHECKLIST.md)
and follow [`PHASE7_RELEASE.md`](PHASE7_RELEASE.md).

## Staff website

The admin site is a separate staff-only web application in `admin/`. It is not
another customer mobile app. See its package scripts and the deployment guide
for local development and hosting.
