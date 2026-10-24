# HappiNotes Phase 9 — Store Sandbox Readiness

**Date:** 2026-10-24  
**Overall verdict: BLOCKED — configuration and real-store evidence are still required.**

This is a source and local-test audit. No live store consoles, production services/data, Railway settings, or real purchases were accessed. No prices, product IDs, credentials, subscriber records, or release artifacts were changed. Phase 8 lifecycle code is present, but the repository cannot establish that either store catalog or notification delivery is configured.

Status labels below distinguish **Confirmed by repository evidence**, **Requires owner confirmation**, **Requires store-console verification**, and **Not implemented**. A source default or example value is not evidence that a product exists in a store.

## 1. Catalog and configuration inventory

### Google Play

| Item | Repository evidence | Status and owner action |
|---|---|---|
| Android package | `flutter_app/android/app/build.gradle.kts` uses `com.happinotes.happinotes_flutter`; this matches the package in `backend/.env.example`. | **Confirmed by repository evidence. Requires store-console verification** that the Play app record uses this exact package. |
| Monthly product | `GOOGLE_PLAY_SUBSCRIPTION_MONTHLY_PRODUCT_ID`; source/example fallback is `happinotes_premium_monthly`. | **Confirmed by repository evidence** as a candidate mapping. **Requires owner confirmation** that this is the intended monthly SKU; **requires store-console verification** that it exists and has the intended active base plan. |
| Yearly product | `GOOGLE_PLAY_SUBSCRIPTION_YEARLY_PRODUCT_ID`; source/example fallback is `happinotes_premium_yearly`. | Yearly is supported by source (`yearly`, `P1Y`) and historical yearly claims are preserved. **Requires owner confirmation** that it remains available to new customers; **requires store-console verification** of the product/base plan. Do not remove historical yearly recognition. |
| Internal mapping | `monthly` → `P1M`; `yearly` → `P1Y`. Android resolves `storeProductIds.android`; legacy `productId` remains an Android fallback. Plan initialization uses `$setOnInsert`, so it does not overwrite existing plan rows. | **Confirmed by repository evidence.** Existing database mappings were not inspected. |
| Purchase verification config | `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`. Admin plan price synchronization also requires `GOOGLE_PLAY_REGIONS_VERSION`. | Names are **confirmed by repository evidence**. Actual configured values, service-account API access, and permissions **require owner confirmation**. Values were not read. |
| Verification endpoint | `POST /api/payments/store/subscription-verify`. Android sends `store: "android"`, `productId`, and `verificationData`; backend checks Play state, account binding, and expiry before granting. | **Confirmed by repository evidence.** |
| Notification endpoint | `POST /api/payments/notifications/google`. Expects a Pub/Sub push envelope with an authorization Bearer identity token and `message.data` containing base64-encoded JSON, including `packageName` and `subscriptionNotification.subscriptionId` / `purchaseToken`. Server checks `IAP_GOOGLE_NOTIFICATION_AUDIENCE`, `IAP_GOOGLE_NOTIFICATION_EMAIL`, and configured package, then fetches current Play state. | Format and checks are **confirmed by repository evidence**. Pub/Sub topic, push subscription, OIDC audience/email and Play RTDN configuration **require owner confirmation and store/cloud-console verification**. |
| Sandbox access | Backend source has Play Billing verification and RTDN handling; it does not prove a license-tester list or test track exists. | **Requires store-console verification.** Use a Play license tester and a test distribution matching the package; verify products and base plans in Play Console. Official guidance: [Play Billing test guide](https://developer.android.com/google/play/billing/test), [license tester/internal test guidance](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en), and [RTDN setup](https://developer.android.com/google/play/billing/getting-ready?authuser=0). |

The IDs shown above are source defaults, not confirmation of Play Console products. Google’s current subscription status is checked after RTDN, as required by the source implementation and [Google Play’s RTDN setup guidance](https://developer.android.com/google/play/billing/getting-ready?authuser=0).

### Apple App Store

| Item | Repository evidence | Status and owner action |
|---|---|---|
| iOS bundle identifier | Xcode project and `backend/.env.example` use `com.happinotes.happinotesFlutter`. | **Confirmed by repository evidence. Requires store-console verification** against the App Store Connect app record. |
| Monthly product | `APPLE_IAP_SUBSCRIPTION_MONTHLY_PRODUCT_ID` is blank in the checked-in example. The iOS mapper uses an explicit Apple mapping/environment value; it does not fall back to the Google or legacy shared `productId`. | **Not configured in repository example. Requires owner confirmation** of the intended exact ID and **store-console verification** that the auto-renewable subscription exists in the correct group. |
| Yearly product | `APPLE_IAP_SUBSCRIPTION_YEARLY_PRODUCT_ID` is blank in the checked-in example. Source supports the yearly plan and same-owner historical yearly claims. | **Not configured in repository example. Requires owner confirmation** whether new yearly sales continue and which exact ID to use; **requires store-console verification**. Preserve existing yearly recognition. |
| Internal mapping | `monthly` → `P1M`; `yearly` → `P1Y`; iOS requires an explicit Apple store product mapping. Missing Apple IDs are omitted and cannot resolve using Google IDs. | **Confirmed by repository evidence.** Database plan values were not inspected. |
| Subscription verification config | `APPLE_IAP_ENVIRONMENT`, `APPLE_BUNDLE_ID`, `APPLE_IAP_PRIVATE_KEY`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, and `APPLE_ROOT_CERTIFICATES_JSON`; Production additionally requires `APPLE_APP_ID`. | Variable names and code requirements are **confirmed by repository evidence**. The example is Sandbox-oriented and leaves key/app-ID values blank or placeholder-like. Actual server configuration, key permissions, root certificates, bundle/app identity and environment **require owner confirmation**. No values were read. |
| Separate catalog-provisioning config | `APP_STORE_CONNECT_PRIVATE_KEY`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, and `APP_STORE_CONNECT_APP_ID` are used by the legacy one-time product catalog provisioning client. They are distinct from the `APPLE_IAP_*` subscription verification names in source. | **Confirmed by repository evidence.** Do not assume these are required for subscription verification; owner should confirm whether legacy one-time catalog provisioning is still used and how its credentials are managed. |
| Verification endpoint | `POST /api/payments/store/subscription-verify`. iOS sends `store: "ios"`, `productId`, and `transactionId`; backend verifies the signed transaction, account token, then fetches current Apple subscription status and verifies signed renewal/transaction data. | **Confirmed by repository evidence.** |
| Notification endpoint | `POST /api/payments/notifications/apple`. Expects JSON `{ "signedPayload": "<App Store Server Notifications V2 JWS>" }`; backend verifies the notification signature, verifies signed renewal data when present, and refreshes current subscription status for an existing claim. | Format and verification are **confirmed by repository evidence**. Sandbox notification URL/version and delivery **require App Store Connect verification**. |
| Sandbox access | The code supports a Sandbox environment, but no sandbox tester or App Store Connect catalog was inspected. | **Requires store-console verification.** Owner must set up Sandbox Apple Accounts, subscription products/groups, an active Paid Apps Agreement, and sandbox server notifications. Apple’s [sandbox testing guide](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox?changes=_1) covers product/test-account prerequisites; [notification setup](https://developer.apple.com/documentation/appstoreservernotifications/enabling-app-store-server-notifications) and [sandbox URL setup](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/enter-server-urls-for-app-store-server-notifications) cover server events. |

Apple’s sandbox and TestFlight use test transactions and do not charge testers; nevertheless, they require owner-created App Store Connect products and sandbox accounts. See Apple’s [sandbox overview](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/overview-of-testing-in-sandbox). No Apple sandbox transaction has been run.

## 2. Configuration safety validation

Existing source/tests already establish:

- Missing Apple product IDs are omitted from the iOS map; Google IDs are never aliased to Apple IDs.
- Unknown and cross-store product IDs fail to resolve; ambiguous mappings fail closed.
- Legacy yearly claims can resolve only through the same-store/same-user claim path during restore.
- Flutter’s `API_BASE_URL` has no implicit production fallback. Debug/test validation rejects the known production API host; release requires an explicit HTTPS URL. The relevant checks are in `flutter_app/lib/core/network/api_config.dart` and `flutter_app/test/api_config_test.dart`.

I made one small local diagnostics improvement: a missing store setting now names the setting key in the error, without exposing its value. The regression test puts a fake private-key marker in the environment and checks that only the missing setting name appears. This changes no startup policy or verification decision. **Google verification behavior is unchanged.**

The backend does not have a separate production-startup gate for Apple/Google purchase settings: required values are checked when the corresponding purchase/provider operation runs. Do not configure guessed values. The test that prevents implicit production API selection exists in Flutter source, but could not be executed here because Flutter/Dart are unavailable.

## 3. Sandbox test matrix

For every scenario, capture store state, app result, backend response, and the resulting entitlement/expiry from an isolated test account. Keep raw purchase tokens, JWS payloads, credentials, and personal account data out of logs and shared reports. Product/plan, environment, test time, redacted test-account label, outcome, and an internal claim ID are sufficient evidence.

| Case | Preconditions and action | Google Play expected backend/access | Apple expected backend/access | Evidence and test type |
|---|---|---|---|---|
| 1. New monthly purchase | Configure confirmed monthly product; sign in as a fresh test account; buy once. | Provider lookup binds the Play account, records a single owner claim and future expiry; premium becomes available. | Configure confirmed Apple monthly product; purchase with the app account token; signed current state is recorded; premium becomes available. | Store test receipt/order view, sanitized verification response and entitlement expiry. Automated mocked tests **plus real store sandbox**. |
| 2. Yearly purchase | Only if owner confirms new yearly sales and configures the separate yearly SKU/base plan. | `yearly`/`P1Y` claim with Play product and verified expiry. | `yearly`/`P1Y` claim with the confirmed Apple product and verified expiry. | Product/plan and expiry evidence. Automated mapping tests **plus real store sandbox**; existing yearly users are not modified. |
| 3. Cancel before completion | Start a purchase and cancel/dismiss the store sheet before confirmation. | No verified purchase claim and no premium entitlement. | Same: no verified transaction claim and no premium entitlement. | App screen/state and unchanged test-account entitlement. Store flow required; route behavior can be automated. |
| 4. Restore on same account | First complete a sandbox purchase; sign in to the same HappiNotes account on a second install/device; restore. | Same owner claim remains; current Play state/expiry is returned; access restored. | Existing claim owner and current signed Apple state must match; access restored. | Redacted original claim reference, owner label and returned expiry. Automated ownership logic **plus real sandbox/device restore**. |
| 5. Restore/claim from another account | Use the same store transaction while signed in to a different HappiNotes account. | External account binding/ledger owner mismatch rejects claim; second account receives no access. | `appAccountToken`/existing owner claim mismatch rejects; second account receives no access. | Safe rejection status and both test accounts’ entitlement snapshots. Automated tests exist for account checks; confirm on sandbox. |
| 6. Successful renewal | Complete purchase and wait for or accelerate a sandbox renewal. | Current Play lookup/RTDN advances expiry; same user retains access. | Apple status API/notification returns current signed transaction and renewed expiry; same user retains access. | Before/after expiry, store event and notification receipt. Real sandbox required; provider logic is mocked in unit tests. |
| 7. Failed renewal and recovery | Use store test controls to create payment failure, then repair payment. | Grace retains access through Play expiry; hold/expired removes it; recovery restores active state and current expiry. | Billing retry alone does not extend access past paid expiry; verified grace retains access to signed grace expiry; recovery is reflected by refreshed status. | Provider status/event timestamps, expiry and access before/after. Real store sandbox required; mocked status tests cover backend branches. Play test guidance: [renewal and payment-failure tests](https://developer.android.com/google/play/billing/test?authuser=6). |
| 8. Grace-period access | Configure/trigger a grace period in store test tools. | `IN_GRACE_PERIOD` plus future provider expiry remains entitled; hold does not. | `BILLING_GRACE_PERIOD` plus verified `gracePeriodExpiresDate` remains entitled only until that date. | Status category, signed/provider expiry and access result. Automated tests cover logic; real sandbox state transition required. |
| 9. Expiry | Allow a test subscription and any grace period to expire. | Current Play state/expiry is inactive; premium content is denied. | Apple status/transaction/grace expiry is inactive; premium content is denied. | Provider expiry and authenticated content-access result. Clock-boundary unit tests can be automated; store expiry needs sandbox. |
| 10. Refund/revocation | Refund/revoke a sandbox test purchase using supported store controls. | Authoritative Play state/notification deactivates the matching claim; no premium access remains. | Apple `REVOKED`/revocation state deactivates entitlement; no premium access remains. | Store refund status, delivered event, backend entitlement and content-access result. Automated state tests **plus real sandbox**. |
| 11. Duplicate notifications | Deliver the same authenticated/signed notification twice for the test claim. | Re-fetch current Play state; same claim and entitlement remain idempotent. | Verify signed V2 event then refresh Apple current status; same claim/state remains idempotent. | Notification delivery IDs/timestamps and before/after claim state. Automated mocked route tests exist; sandbox delivery still required. |
| 12. Out-of-order notifications | Deliver an older event after a newer renewal/status event. | Re-fetching current provider state prevents old message contents from rolling back current state. | Re-fetch current Apple status; signed timestamp guard rejects an older provider result. | Event order, current provider result, stored signed state and entitlement. Automated logic tests exist; Mongo race needs real integration testing. |
| 13. Network failure during verification | Simulate provider timeout before verification completes. | Verification fails safely (no new claim/access); retry after service recovery. | Apple transaction/status API failure fails closed; no new entitlement; retry after recovery. | Sanitized error category/status and unchanged entitlement. Automated mocked tests; no live outage required. |
| 14. App restart/session recovery | Purchase successfully; force-close/reopen app; restore/check account while still signed in. | Customer session restores; Play current state/expiry yields access only while valid. | Customer session restores; Apple restore/status yields access only while valid. | Redacted session state, restore response, premium screen and expiry. Automated service tests **plus real device/store sandbox**. |

Automated test coverage does not equal sandbox completion. No scenario above was run against either store during this phase.

## 4. Owner confirmation checklist

Before scheduling sandbox testing, the owner should confirm:

1. Whether new customers can buy monthly only or monthly and yearly. Preserve yearly mappings/claims regardless of that decision.
2. The exact Android monthly/yearly IDs and active base plans, and exact Apple monthly/yearly IDs and subscription group. Verify each independently in its own console; do not copy one store’s IDs into the other.
3. Android package and iOS bundle identity match the existing store app records.
4. Store-localized prices, renewal period, regional availability, grace/billing-retry behavior, and cancellation/refund test accounts. No price was checked or changed here.
5. Backend credential availability and required permissions using the variable names in the tables. Do not send credential values in chat or reports.
6. Google Play Developer API service account access; Play license testers/internal test track; Pub/Sub topic/subscription, push auth audience/email, and RTDN notification selection.
7. Apple Developer/App Store Connect access, active Paid Apps Agreement, sandbox tester accounts, subscription product status, App Store Server API key setup, root certificates, and sandbox App Store Server Notifications V2 URL.
8. Whether legacy one-time Apple catalog provisioning is still used. Its `APP_STORE_CONNECT_*` credential group is separate in code from subscription verification’s `APPLE_IAP_*` group.
9. How plan upgrades/downgrades should work. Apple plan switching is **not implemented**; current notification processing requires the verified product to match the existing claim. Do not offer product switches until mapped and tested.
10. Whether historical Apple claims have a verified matching `appAccountToken` and whether historical Google claims use hashed token keys. The backend does not permit an unbound Apple claim to bypass account ownership, and Phase 7 identified older raw Google token keys as a possible restore-compatibility issue. No production ledger was inspected, so these cases remain owner-confirmation items.

## 5. Disposable MongoDB integration testing

The backend’s existing test infrastructure is `node:test` plus Mongoose model/provider mocks. There is no Mongo integration test script, no `mongodb-memory-server` dependency in the backend lockfile, and no repository-declared disposable test database. This environment has no `docker`, `mongod`, or `mongosh` command. A `backend/.local-mongodb/mongod.lock` file exists, but it does not establish that the database is running, disposable, or safe to use; it was not opened or connected to.

Therefore **no real MongoDB concurrency tests were added or claimed**. Existing mocked tests verify the intended filter/ordering logic only. They do not prove Mongo’s atomic behavior.

Safe next setup: provide a dedicated disposable local MongoDB instance (for example, an owner-approved temporary container) bound only to loopback and a database named specifically for tests, such as `happinotes_phase9_test`. Add a separate integration-test command that refuses to run unless the URI host is `127.0.0.1`/`localhost` and the database name ends in `_test`; create unique fixture users/products, clean up only that dedicated database, then test concurrent verification, duplicate notifications, stale event writes and ownership. Never point it at a Railway or other shared URI. No new test database or dependency was installed here.

## 6. Flutter readiness

The current environment has no `flutter` or `dart` executable, and `flutter_app/.dart_tool/package_config.json` is absent. The repository declares Dart `^3.12.0` in `flutter_app/pubspec.yaml`; Flutter analysis and tests were not run. No SDK or package install was attempted.

On the owner’s development machine, install/use Flutter with bundled Dart satisfying `>=3.12.0 <4.0.0`, open PowerShell in `flutter_app/`, then run:

```powershell
flutter --version
dart --version
flutter pub get
flutter analyze
flutter test
```

The repository tests cover explicit `API_BASE_URL`, reject missing values and reject the known production host for non-release builds. A release build requires an explicit HTTPS API origin. These source tests still need execution with Flutter available.

## 7. Commands run and results

From `backend/`:

| Command | Result |
|---|---|
| `npm.cmd run build` | **PASS** — TypeScript build. |
| `node --test test/subscriptionProductMapping.test.cjs test/storePurchase.test.cjs test/subscriptionPurchase.test.cjs test/subscriptionPurchaseRoutes.test.cjs test/storeNotifications.test.cjs` | **PASS — 64/64 tests.** |
| `npm.cmd run test:isolated` | **PASS — 183/183 tests.** |
| `git diff --check` | **PASS** — no whitespace errors; Git printed pre-existing line-ending normalization warnings for unrelated modified files. |

Flutter commands were checked for availability but not run: `flutter` and `dart` are unavailable. Store consoles, production services/data and MongoDB were not accessed. No admin lint/build was run because admin code did not change.

## 8. Remaining release blockers and next step

- Apple subscription product IDs are unset in the checked-in example; actual owner-managed configuration is unknown.
- Neither store’s real product/base-plan records, prices, notification endpoints, tester accounts or API permissions were verified.
- No Play or Apple sandbox purchase/lifecycle test has occurred.
- No real MongoDB concurrency test has occurred.
- Flutter `pub get`, `analyze`, and `test` remain unrun because the SDK is unavailable here.
- Apple upgrade/downgrade mapping is not implemented.
- Historical restore compatibility for older Apple transactions without an account token or older Google claims stored with raw purchase tokens is unverified.

**Recommended next step:** owner confirms the product catalog and test-account/configuration checklist without sharing credentials, then arranges isolated Play and Apple sandbox environments. After that, run the device lifecycle matrix, Flutter checks, and MongoDB integration suite against a clearly disposable local database. Do not treat repository defaults or mocked tests as store validation.

## Official sandbox references

- [Google Play Billing test guide](https://developer.android.com/google/play/billing/test)
- [Google Play test-track setup](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en)
- [Google Play RTDN setup](https://developer.android.com/google/play/billing/getting-ready?authuser=0)
- [Apple sandbox in-app purchase testing](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox?changes=_1)
- [Apple sandbox tester setup](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/create-a-sandbox-apple-account/)
- [Apple App Store Server Notifications setup](https://developer.apple.com/documentation/appstoreservernotifications/enabling-app-store-server-notifications)
- [Apple sandbox notification URL configuration](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/enter-server-urls-for-app-store-server-notifications)
