# HappiNotes one-time book purchases

The Flutter app uses Google's and Apple's native payment sheets through Flutter's
`in_app_purchase` package. Each book is a separate non-consumable purchase.
Books are unlocked only after backend verification. Prices displayed at checkout
come from the store, including its currency and formatting, rather than `priceInr`.

## Automatic product provisioning

New premium books now queue independent Google Play and App Store Connect provisioning
jobs on the backend. Flutter checkout is unchanged. Follow
[backend product provisioning setup](backend/STORE_PRODUCT_PROVISIONING.md) for credentials,
pricing policy, migration, admin status/retry endpoints, and testing.
Apple review screenshots and submission remain manual; the first IAP must accompany
an app binary. A configured product is not automatically approved.

## Existing/manual store products and legacy mapping

1. Register the app in both consoles using the identifiers in the native projects:
   Android `com.happinotes.happinotes_flutter`; iOS
   `com.happinotes.happinotesFlutter`. Verify these are your intended published IDs
   before configuring products; do not rename an already published app ID.
2. In Google Play Console create a one-time product for each premium book, with an
   active purchase option, price, and availability. Purchases must remain
   non-consumable: the app never consumes them.
3. In App Store Connect create a **Non-Consumable** in-app purchase per book. Set
   its price, localization, and review information. This implementation binds
   ownership to one HappiNotes account and does not support Family Sharing.
4. Product IDs can differ between stores. Map both to the same MongoDB book ID.
   Set `IAP_PRODUCTS_JSON` on the **backend** Railway service, for example:

   ```json
   {
     "REPLACE_WITH_24_CHARACTER_BOOK_ID": {
       "android": "happinotes.book.example",
       "ios": "happinotes.book.example"
     }
   }
   ```

   Replace the placeholder with the real book `_id`. Products must map to distinct
   books within each store. Only live premium lifebooks appear in the purchase catalogue.
   Mapping is server configuration; it does not require shipping credentials in the app.
   Keep existing mappings stable so old purchases remain restorable.

## Google backend configuration

- Enable the Google Play Android Developer API and create a service account with
  access to the app and the permissions required to read purchases and acknowledge
  them. Complete the Play merchant/payments setup.
- Set `GOOGLE_PLAY_PACKAGE_NAME=com.happinotes.happinotes_flutter`.
- Set `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` to the service account JSON as a secret
  environment variable. Never commit it or put it in the Flutter app.
- Upload a properly release-signed Android build to an internal testing track.
  The project's release configuration currently uses a debug signing key;
  configure your upload key before publishing.
- Add license testers and install through the test track using a tester account.

## Apple backend configuration

Complete Apple's paid-app agreement, banking, and tax setup. Create an In-App
Purchase key in App Store Connect and configure these backend secrets:

| Variable | Value |
| --- | --- |
| `APPLE_BUNDLE_ID` | `com.happinotes.happinotesFlutter` |
| `APPLE_IAP_KEY_ID` | In-App Purchase key ID |
| `APPLE_IAP_ISSUER_ID` | Issuer ID from App Store Connect |
| `APPLE_IAP_PRIVATE_KEY` | Contents of the downloaded `.p8` key; real newlines or escaped `\n` |
| `APPLE_IAP_ENVIRONMENT` | `Sandbox` for testing; `Production` for paid release |
| `APPLE_APP_ID` | Numeric App Store app ID; required for Production |
| `APPLE_ROOT_CERTIFICATES_JSON` | JSON array of base64-encoded Apple root certificates in DER format |

Download trusted roots directly from [Apple PKI](https://www.apple.com/certificateauthority/).
The backend retrieves current transaction data from Apple and verifies its signed
certificate chain and environment. Configure a separate sandbox backend for
TestFlight/sandbox testing; the production backend deliberately does not silently
accept sandbox transactions. Local Xcode StoreKit transactions are not accepted
by this server-verification path.

On a Mac, enable the In-App Purchase capability for the Runner target and verify
StoreKit 2 support on the test device. Use Sandbox Apple Accounts or TestFlight.

## Deployment and verification

Use a new test HappiNotes account with no previous simulated book unlocks. The
premium book screen refreshes account ownership and store prices on opening; the
checkout also fetches fresh product details before launching the native sheet.
Pending payments keep the book locked and disable another purchase of that book,
while Restore remains available. Purchased/restored callbacks use the existing
`POST /payments/store/verify` endpoint. Duplicate deliveries are serialized and
deduplicated; an explicit Restore re-verifies previous transactions.

The default API remains the existing production backend. To test against a separate
sandbox backend without editing source code, pass its public URL when building:

```sh
flutter build appbundle --dart-define=API_BASE_URL=https://YOUR_SANDBOX_BACKEND
flutter build ipa --dart-define=API_BASE_URL=https://YOUR_SANDBOX_BACKEND
```

The iOS build requires macOS/Xcode. Configure this backend with
`APPLE_IAP_ENVIRONMENT=Sandbox` for TestFlight/Apple sandbox transactions. This
build setting contains only a public backend URL; store credentials stay on the server.

Local automated tests use fake store callbacks and backend responses, not real
Google Play or Apple payments. They cover pending, cancellation, failure,
restoration, verification retries, repeated callbacks, product unavailability,
store completion retries, and signing out during verification.

1. Configure products, mapping, and backend secrets, then deploy the backend.
2. Ship rebuilt Flutter apps; a Railway deployment does not update installed mobile apps.
3. Purchase a book using store testers. Confirm the store price, payment sheet,
   verified unlock, and full episode playback.
4. Test cancellation, pending payment, app restart during checkout, offline
   verification followed by Restore, and an already-owned product.
5. Reinstall and sign into the same HappiNotes account; use **Purchased stories →
   Restore** or the checkout's **Restore purchases** button. Existing account
   ownership also syncs from the backend across Android and iOS.
6. Verify a different HappiNotes account cannot claim the same transaction.

The backend stores an idempotent purchase ledger with a unique transaction index.
Android tokens are hashed in this ledger; private keys and tokens are never
returned in provider error responses. The test-payment endpoint is disabled in
production regardless of `PAYMENTS_TEST_MODE`.

## Refund notifications

Configure Google Play RTDN with an authenticated Pub/Sub push subscription pointing
to `/payments/notifications/google` on your backend. Include voided-purchase
notifications. Set `IAP_GOOGLE_NOTIFICATION_AUDIENCE` to that full HTTPS URL and
`IAP_GOOGLE_NOTIFICATION_EMAIL` to the push service account email. The endpoint
verifies Google's identity token before querying the latest purchase state.

Configure App Store Server Notifications **V2** to send to
`/payments/notifications/apple`; configure sandbox and production URLs separately.
The endpoint verifies Apple's signature, fetches the current transaction, and
updates ownership. Configure Pub/Sub retry/dead-letter handling and monitor failed
notification delivery in both consoles. Duplicate and delayed notifications use
current store state; another active purchase of the same book preserves access.

## Remaining release work

The code integration can be checked locally, but real payment and restore behavior
must be validated on both stores after their products and credentials are created.
No store accounts or products were created by this change. Configure and test both
refund notification endpoints before a public paid release. A periodic reconciliation
process is recommended to recover from missed notifications. Existing test unlocks also
require a deliberate cleanup plan before release.

## Official references

- [Flutter purchase integration](https://pub.dev/packages/in_app_purchase)
- [Google purchase lifecycle](https://developer.android.com/google/play/billing/lifecycle/one-time)
- [Google billing testing](https://developer.android.com/google/play/billing/test)
- [Apple server verification library](https://github.com/apple/app-store-server-library-node)
- [Apple sandbox testing](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/overview-of-testing-in-sandbox)
