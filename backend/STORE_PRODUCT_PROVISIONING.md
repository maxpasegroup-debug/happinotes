# Backend store product provisioning

This extends the existing one-time book checkout. No Flutter purchase code or UI was
changed for provisioning. No real store requests have been tested locally: all provider
and database calls in the new unit tests are mocks.

## Data and lifecycle

`StoreProduct` creates MongoDB collection `storeproducts` with one unique record per
`Content` book. It stores `bookId`, an immutable initial INR price, pricing policy,
Android/iOS `productId`, independent status, synchronization error, attempts,
next attempt time, last synchronization time, processing lease, and timestamps.
`ios.resourceId` stores Apple's management ID, distinct from the purchase SKU.
Both platform product IDs have unique partial indexes. Product IDs are deterministic:
`happinotes.book.<lowercase MongoDB book ID>`.

States: `pending`, `processing`, `ready`, `awaiting_review`, `failed`, `legacy`.
The in-process worker starts after MongoDB connects, checks every 30 seconds, and uses
MongoDB as a durable queue with separate per-platform atomic leases. Expired leases
recover crashed jobs. Failed jobs retry with exponential delay capped at six hours;
awaiting-review products are rechecked every six hours. Admin retries queue immediately.
Each platform progresses independently. Provider error bodies/private keys are never
stored or returned. Apple resource IDs are checkpointed before subsequent configuration.

Both `/admin/books` and multipart `/admin/contents` creation/update paths enqueue premium
lifebooks. A free-to-premium update also queues provisioning. A reconciliation scan repairs
a crash between saving a book and creating its mapping. Saving the book does not wait
for store API requests. No products are deleted/deactivated on unpublishing or making a
book free. Deleting the actual book still removes the content, so unpublish instead of
deleting books that people purchased.

## Pricing policy: initial_exact_inr_india_only_v1

- New products start with the book's positive `priceInr`, with at most two decimals.
- Availability is initially India only, with INR pricing. No automatic global conversion.
- Google receives the exact INR amount. Apple's India price point must match exactly;
  there is no rounding to a different tier. An unavailable price point records a failure.
- The first price is frozen in the mapping. Later admin price edits do not change store
  prices, even when provisioning is retried. Set the intended price before creating the book.
- Existing products/schedules are read and preserved; no automatic repricing is performed.
- If the frozen amount is unsupported, a human must choose/configure an acceptable Apple
  price in App Store Connect, then retry. Flutter displays the store's actual price. A future
  explicit price-change workflow is outside this implementation.
- Existing availability is preserved. No automatic removal of territories or store products.

## Legacy migration

Keep existing `IAP_PRODUCTS_JSON` intact for the first deployment. The worker and product
lookup import it into MongoDB idempotently. Imported IDs are marked `legacy` and are
never recreated, repriced, or activated by the worker. A missing platform can receive
the deterministic new ID. Conflicting mappings fail visibly instead of overwriting IDs.
Import includes unpublished book mappings. Confirm database records/old restoration,
then remove the legacy environment variable or set it to `{}`. Newly created books do
not require edits to this variable. Do not replace any SKU used in past transactions.

## Backend environment variables

Existing Google verification credentials are reused:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_PLAY_PACKAGE_NAME` | Published Android package name |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Secret Google service-account JSON |
| `GOOGLE_PLAY_REGIONS_VERSION` | New: supported region configuration version for creation |
| `APP_STORE_CONNECT_APP_ID` | New: App Store Connect app resource ID |
| `APP_STORE_CONNECT_KEY_ID` | New: catalogue API key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | New: catalogue API issuer ID |
| `APP_STORE_CONNECT_PRIVATE_KEY` | New: secret catalogue API `.p8` key; actual or escaped newlines |

The existing Apple purchase-verification variables remain required separately:
`APPLE_BUNDLE_ID`, `APPLE_APP_ID`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`,
`APPLE_IAP_PRIVATE_KEY`, `APPLE_IAP_ENVIRONMENT`, `APPLE_ROOT_CERTIFICATES_JSON`.
Never put these secrets in Flutter or commit populated `.env` files. Configuration
failure is recorded per store; the other platform can continue. The backend stays running.

## Admin APIs

All require a valid HappiNotes admin Bearer token and are rate limited.
Paths also work with the existing `/api` prefix.

| Method and path | Behavior |
| --- | --- |
| `GET /admin/store-products/:bookId` | Returns mapping and independent status/errors |
| `POST /admin/store-products/:bookId/retry` | Queues pending/failed/review states; optional body `{"store":"ios"}` or `{"store":"android"}` |
| `POST /admin/store-products/migrate` | Idempotently imports legacy environment mappings |

There is no public provisioning endpoint and no credentials in these responses.
`GET /payments/store/products` keeps its existing Flutter response shape:
`{accountToken, products:[{bookId, android?, ios?}]}`. It offers only live premium books,
with ready/imported platform IDs. On an explicitly Sandbox Apple verification backend,
configured `awaiting_review` iOS products are also exposed for pre-review sandbox testing.
Production does not offer unapproved new Apple products.
`POST /payments/store/verify` reverse-looks up database mappings, retaining all historical
states for restoration even after unpublishing. Ownership is still granted only after
the existing store verification succeeds.

## Google Play setup

1. Register the app with the intended package ID and finish developer/payments setup.
2. Enable Android Publisher API. Create a service account and grant app access in Play
   Console with catalogue-management permissions plus purchase read/acknowledge permissions.
3. Configure the Google variables on the backend. Choose a currently supported
   [RegionsVersion](https://developers.google.com/android-publisher/api-ref/rest/v3/RegionsVersion).
4. Upload a properly signed internal-track build. Release builds require local
   `flutter_app/android/key.properties` and its upload keystore; debug signing is
   prohibited for release builds. Back up the private signing files securely.
5. Add license testers and install through the internal testing track.

The backend uses official `monetization.onetimeproducts.patch` with `allowMissing=true`
only after a missing-product lookup, creates a legacy-compatible single-quantity buy
option, and activates it through `purchaseOptions:batchUpdateStates`. Existing products
are inspected and preserved; incompatible options require manual inspection.
References: [product API](https://developers.google.com/android-publisher/api-ref/rest/v3/monetization.onetimeproducts),
[creation](https://developers.google.com/android-publisher/api-ref/rest/v3/monetization.onetimeproducts/patch),
[activation](https://developers.google.com/android-publisher/api-ref/rest/v3/monetization.onetimeproducts.purchaseOptions/batchUpdateStates).

## Apple setup and limits

1. Configure the app/bundle ID and complete developer agreements, banking, and tax setup.
2. Create an App Store Connect API team key with Account Holder/Admin/App Manager access
   suitable for the app and set the four `APP_STORE_CONNECT_*` variables.
3. Configure the separate existing IAP server verification key and trusted certificates.
   Use a separate backend with `APPLE_IAP_ENVIRONMENT=Sandbox` for tests.
4. On a Mac, build/sign the existing app and use TestFlight or a real sandbox device.
5. Supply the IAP review screenshot and complete review information in App Store Connect.
6. Submit the first IAP with the app binary through App Store Connect. Subsequent products
   also require submission/review; submission and screenshot upload are not automated here.
7. After approval, queue an iOS retry or let the worker recheck. It records `ready` only
   when Apple's product state reports `APPROVED`.

The backend creates `NON_CONSUMABLE` via `/v2/inAppPurchases`, finds existing products
by immutable SKU after ambiguous failures, checkpoints the management ID, creates a
draft version and its English localization using Apple's current version-based workflow,
configures an exact India price schedule and India availability if missing. It never
fabricates screenshots, approval, or an app-binary submission. Full automatic availability
is not possible for the first product because Apple's official review flow requires the
binary submission. [Official Apple workflow](https://developer.apple.com/documentation/appstoreconnectapi/managing-in-app-purchases).

## Exact one-book test

1. Configure test-store credentials and the sandbox backend; use an isolated tester account.
2. Preserve/import any historical mappings, inspect the new database indexes, and confirm
   an old purchase still restores. This requires a real MongoDB/store integration check.
3. Choose an exact supported Apple India price before creating the test book.
4. Create one premium lifebook with that price using either existing admin creation path.
   Save its returned MongoDB ID. Do not manually create its store products beforehand.
5. Poll `GET /admin/store-products/<bookId>` with an admin token. Confirm both SKUs equal
   `happinotes.book.<bookId>`, Google becomes `ready`, and Apple records a management ID
   plus `awaiting_review` (or `ready` after approval). Inspect any recorded error.
6. Retry the same book twice. Confirm the consoles contain exactly one product per SKU.
   In App Store Connect, open the created IAP, supply its actual review screenshot and
   finish any missing review metadata before attempting sandbox checkout.
7. Temporarily remove/replace one platform's test credential, create another test book,
   and confirm the other platform succeeds. Restore credentials and queue only the failed
   platform. Do not alter working production credentials for this test.
8. Mark the first book live. Authenticate as a normal user and call
   `GET /payments/store/products`; confirm platform IDs and unchanged response shape.
9. Install the Android internal-track build and the iOS TestFlight/sandbox build using
   `--dart-define=API_BASE_URL=<sandbox backend URL>`. Open the book and check native price.
10. Purchase on each platform using separate tester accounts. Confirm verification,
    `StorePurchase` ledger, `User.purchasedBooks`, and access. Test cancel/pending/failure.
11. Reinstall/sign in and Restore Purchases. Unpublish the book and confirm its transaction
    can still be verified/restored without deleting/deactivating either store product.
12. Configure store notifications and test refunds. On production Apple, complete approval
    and use production verification credentials before offering the new product for sale.

## Local checks and remaining integration work

Run `npm run build` then `npm test` in `backend`; run `flutter test` and `flutter analyze`
in `flutter_app`. New tests mock MongoDB, Google auth/HTTP and Apple HTTP. They cover
stable IDs, duplicate jobs, partial failure, retries, lease recovery, management-ID
checkpointing, migration, free-to-premium updates, credentials, authorization, exact price
selection, existing-price preservation, API response compatibility, and verification.

Real MongoDB index/lease behavior, real provider payload acceptance and permissions,
propagation delays, signing, first Apple review, native purchases/restoration and refund
delivery still require the integration test above. No deployment or real catalogue
mutation was performed by the local unit tests.

Local validation for this implementation: backend build passed; 51 backend tests and
22 Flutter tests passed. `flutter analyze` returned 21 existing issues (one warning and
20 informational lints), with no analyzer errors. Flutter files were not edited in this task.
