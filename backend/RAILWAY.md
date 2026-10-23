# Deploy the HappiNotes backend to Railway

## Create the service

1. Create a Railway project from the repository.
2. Set the backend service root directory to `/backend`.
3. Set the config file to `/backend/railway.json`.
4. Add a MongoDB service or configure another supported MongoDB connection.
5. Generate a public domain and confirm `https://YOUR-DOMAIN/health` responds.

## Required production variables

Set these in the Railway backend service. Railway supplies `PORT` automatically.

```env
NODE_ENV=production
USE_EMBEDDED_MONGODB=false
MONGODB_URI=${{MongoDB.MONGO_URL}}
JWT_SECRET=<at least 32 random characters; do not use the example placeholder>
JWT_EXPIRES_IN=7d
RESEND_API_KEY=<server-side Resend API key>
RESEND_FROM=HappiNotes <no-reply@your-verified-domain.com>
APPLE_ROOT_CERTIFICATES_BASE64=<comma-separated base64 DER Apple root certificates>
APPLE_APP_ID=<numeric App Store Connect Apple ID>
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=<service-account JSON with Android Publisher API access>
GOOGLE_PUBSUB_AUDIENCE=https://YOUR_API_DOMAIN/api/store-notifications/google
GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL=<email of the Pub/Sub push authentication service account>
```

The backend refuses to start in production without a sufficiently strong JWT
secret and both Resend settings. Verify the sender domain in Resend before
launch. Keep `RESEND_API_KEY` only in Railway; it must never be included in
Expo/EAS variables.

Store billing fails closed until the Apple root certificates and Apple app ID,
and the Google Play service account JSON, are configured. Keep the Google
service-account private key in Railway only. See [`../STORE_PRODUCTS.md`](../STORE_PRODUCTS.md)
for store records, product IDs, and setup requirements. Optional variables such
as CORS, Cloudinary, Sentry, and push notifications are described in `.env.example`.

For Google verification, link the service account to the Play Console developer
account and grant access to this app's subscription data. For Apple, use the
numeric Apple ID shown for the app in App Store Connect and configure Apple's
public DER root certificates as comma-separated base64 in Railway.

## Store server notifications

Apple App Store Connect should send Server Notifications V2 to
`https://YOUR_API_DOMAIN/api/store-notifications/apple`. The backend verifies
the signed notification and its transaction/renewal payloads using Apple's
root certificates before reconciling membership.

For Google Play, enable Real-time developer notifications for this app and
publish them to a Pub/Sub topic. Create an authenticated push subscription
pointing at `https://YOUR_API_DOMAIN/api/store-notifications/google`. Configure
OIDC authentication with the exact same URL as the audience, and set
`GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL` to that service account's email. The
backend validates the token and then queries the Google Play Developer API for
the canonical subscription state; the notification itself never grants access.
Keep the Play API service-account key and Pub/Sub configuration in Railway,
never in the Expo app.

## Provision the first admin

1. Create the staff account using email and password in the Expo app.
2. In a restricted MongoDB administrator session, update that account's role to
   `admin` using the procedure in [`README.md`](README.md).

Public sign-up never grants admin access based on email or phone number.

## Existing account migration

Phone/PIN authentication has been removed. Phone-only accounts must be migrated
to real email addresses and passwords before switching an existing production
database. The app does not expose a phone-login fallback or synthetic email
conversion path.
