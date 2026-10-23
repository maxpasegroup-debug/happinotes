# HappiNotes Deployment

## Backend on Railway

1. Create a Railway project from the GitHub repository.
2. Set the service root to `backend`.
3. Add environment variables from `backend/.env.example`.
4. Use MongoDB Atlas for `MONGODB_URI`.
5. Deploy with the included `backend/railway.json`.

Production must also have a random `JWT_SECRET` (at least 32 characters),
`RESEND_API_KEY`, and a verified `RESEND_FROM` sender. The backend refuses to
start in production if the JWT secret or Resend settings are missing or invalid.
Keep the Resend key in Railway; it is never an Expo/EAS variable.

Production API target:

```text
https://happinotes-production-6b44.up.railway.app/api
```

## Admin on Vercel

1. Create a Vercel project from the GitHub repository.
2. Set the root directory to `admin`.
3. Add:

```text
BACKEND_API_URL=https://happinotes-production-6b44.up.railway.app/api
NEXT_PUBLIC_API_URL=https://happinotes-production-6b44.up.railway.app/api
```

## Cloudinary

Create folders:

```text
happinotes/covers
happinotes/audio
happinotes/chapters
```

Use signed uploads and set credentials in Railway.

## Store subscriptions

The Expo app uses `expo-iap` for Apple App Store and Google Play Billing. The
app sends signed transaction evidence to the authenticated backend, which
verifies it with Apple or Google before setting Premium access. See
[`STORE_PRODUCTS.md`](STORE_PRODUCTS.md) for product IDs and lifecycle behavior.

Set `APPLE_ROOT_CERTIFICATES_BASE64`, `APPLE_APP_ID`, and
`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` in Railway before testing purchases. These
are backend settings; never add the Google service-account key to the app or
EAS. Native purchases require an EAS development/store build, not Expo Go.

## EAS API environments

The Expo build profiles use separate EAS environments:

| Build profile | EAS environment | Intended API |
| --- | --- | --- |
| `development` | `development` | Local or development backend |
| `test` | `preview` | Test/staging backend |
| `production` | `production` | Production backend |

Create `EXPO_PUBLIC_API_URL` in each environment under the Expo project's
Environment Variables settings. Use the Railway development, test, and
production API URLs for the corresponding environment. The selected production
value is `https://happinotes-production-6b44.up.railway.app/api`; add it to the
EAS `production` environment before building. It is not hard-coded in `eas.json`.
Development and test backend URLs are not yet configured in this repository; do
not copy the production URL into those environments. EAS builds fail before
installation if the API URL is missing or invalid; test/store builds also reject
localhost and require HTTPS.

For local Expo development, copy `mobile/.env.example` to `mobile/.env` and set
`EXPO_PUBLIC_API_URL` to a backend reachable from the device or simulator.

## Android Build

From `mobile`:

```powershell
eas login
eas build:configure
eas build --platform android --profile production
```

For an internal test APK, use `eas build --platform android --profile test`.

## iOS Build

From `mobile`, use the same Expo project and production profile:

```powershell
eas build --platform ios --profile production
```

For an internal iOS test build, use `eas build --platform ios --profile test`.

The Expo app's Android package and iOS bundle ID are both `com.happinotes.app`.
Keep these identifiers stable after store records are created.

## Current mobile app source

`mobile/` is the single supported Expo app for Android and iOS. `flutter_app/`
is archived reference code and is not part of the launch build. The `test` EAS
profile uses the EAS `preview` environment; it does not mean the production API
is suitable for testing. Provision a dedicated test backend before using that
profile.

The production API URL above is the URL previously present in EAS profiles and
selected as the canonical production target. Add it to the EAS `production`
environment. Confirm that `/health` responds successfully in Railway before
store submission.

## Membership launch decision

The launch product is **HappiNotes Premium**, a monthly auto-renewing
membership with no trial. Its store product mapping and access rules are in
[`STORE_PRODUCTS.md`](STORE_PRODUCTS.md). Store app records, products, and
verification credentials still need to be configured before sandbox purchases
can succeed.
