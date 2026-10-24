# HappiNotes Phase 6 — Subscription Pricing & Billing Readiness Audit

**Audit date:** 2026-10-24  
**Scope:** Source and local test review only. No production service, database, store console, Railway configuration, or secrets were accessed. No billing code or configuration was changed.

## Executive verdict: BLOCKED

The code has a substantial store-verification and entitlement foundation, and the isolated backend billing tests pass. That is not evidence that either store’s current catalog is configured or that a real purchase, restore, renewal, or notification works. Production readiness remains blocked until the owner confirms the Apple and Google catalog identifiers and terms, store notification/API setup, and sandbox/device purchase flows. Source review also found risks that should be corrected before release: a shared product ID for both stores, incomplete Apple renewal status, and the Flutter API default pointing to the production Railway host.

The owner must decide whether new customers can buy monthly only or monthly and yearly. Current source exposes both active plans. Existing yearly entitlements use a supported plan key and are not removed by the plan bootstrap code, but production subscriber records and catalog state were intentionally not inspected.

## 1. Current billing architecture and purchase flow

| Step | Source and behavior |
|---|---|
| Plan records | [`backend/src/models/SubscriptionPlan.ts`](../backend/src/models/SubscriptionPlan.ts) defines `monthly`/`yearly`, one `productId`, immutable `billingPeriod` (`P1M`/`P1Y`), `priceInr`, and `active`. [`backend/src/services/subscriptionPlans.ts`](../backend/src/services/subscriptionPlans.ts) (`ensureSubscriptionPlans`) inserts monthly and yearly defaults with zero INR and active status when absent. It uses `$setOnInsert`; it does not rewrite existing plans from environment defaults. |
| Admin price edit | [`happinotes-admin/app/admin/(secure)/settings/page.tsx`](../happinotes-admin/app/admin/(secure)/settings/page.tsx) loads and edits the two plan prices. The authenticated admin API is [`backend/src/routes/adminSubscriptionPlanRoutes.ts`](../backend/src/routes/adminSubscriptionPlanRoutes.ts): `GET /admin/subscription-plans` and `PATCH /admin/subscription-plans/:key`. PATCH accepts a positive INR amount with at most two decimals, persists it, emits a plan-change event, then attempts Google Play sync. A Google sync failure leaves the database price saved and returns `success: true` with `googlePlaySync: "failed"` and a warning. |
| Mobile catalog | [`flutter_app/lib/core/payments/subscription_purchase_controller.dart`](../flutter_app/lib/core/payments/subscription_purchase_controller.dart) (`_reload`) calls authenticated `GET /payments/store/subscription-plans`, queries store product details, and uses `applicationUserName` for the backend-provided account token. `subscription_screen.dart` offers the plans returned by the backend. Source defaults both plans to active, and there is no admin active/inactive control. |
| Purchase and verify | The Flutter controller starts a store purchase, then posts store, product ID, transaction/verification data, and restore state to `POST /payments/store/subscription-verify`. [`backend/src/routes/storePurchaseRoutes.ts`](../backend/src/routes/storePurchaseRoutes.ts) requires an authenticated user, accepts only an active plan whose single configured product ID matches, verifies with the selected store, claims a unique transaction ledger row, and updates the user entitlement. The client-reported “purchased” state alone does not grant access. |
| Verification providers | [`backend/src/services/subscriptionPurchase.ts`](../backend/src/services/subscriptionPurchase.ts): Google Play Developer API subscription lookup checks product, account binding, provider state, and expiry; active purchases must be acknowledged. Apple App Store Server API lookup verifies the signed transaction, product, subscription type, account token, revocation, and expiry. |
| Entitlement | [`backend/src/models/SubscriptionPurchase.ts`](../backend/src/models/SubscriptionPurchase.ts) stores store, owner, plan key, product ID, transaction key, active/expiry and renewal state; store plus transaction key is unique. [`backend/src/services/subscriptionEntitlement.ts`](../backend/src/services/subscriptionEntitlement.ts) (`applySubscriptionEntitlement`) protects an existing active entitlement from an older/shorter unrelated transaction. A user has one current subscription snapshot in `User.subscription`. |
| Store lifecycle notifications | [`backend/src/routes/storeNotificationRoutes.ts`](../backend/src/routes/storeNotificationRoutes.ts) has Google RTDN and Apple App Store Server Notifications V2 endpoints. Google verifies Pub/Sub identity, fetches current Play state, and only updates a matching existing ledger claim/account. Apple verifies signed notifications and transactions and updates a matching existing claim. Unknown claims do not create entitlement. |
| Access checks | [`backend/src/controllers/contentController.ts`](../backend/src/controllers/contentController.ts) (`canAccessPremiumContent`) checks the stored active flag and expiry when premium content is requested. Previously purchased individual books are also checked through `purchasedBooks`. |
| Legacy one-time books | `storePurchaseRoutes.ts` still exposes `/products` and `/verify`; `StorePurchase`, `StoreProduct`, `storePurchase.ts`, and Flutter’s `store_purchase_controller.dart` preserve the older per-book purchase route. New premium content is described in source as using shared subscriptions, but existing one-time entitlements and verification paths remain. No Razorpay reference was found in the current source/docs search. |
| Website | The customer website has no working digital-content checkout. The subscription modal in `happinotes-admin/components/dashboard-client.tsx` and `desktop-dashboard-client.tsx` is unreachable (`subscribeOpen` is hardcoded false and its handler is a no-op); it contains a stale hardcoded ₹499/month placeholder. The profile page only describes app subscriptions. Admin settings only edit plan prices. |

Digital books/audio are digital content. Google Play’s policy generally requires Play Billing for digital content and subscriptions distributed through Play, subject to program-specific exceptions ([Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en)). Apple’s baseline rule likewise requires in-app purchase for digital content/subscriptions, with specific exceptions and entitlements that must be assessed for the app’s classification ([App Review Guidelines, section 3.1](https://developer.apple.com/app-store/review/guidelines/)). Do not treat the website placeholder as a usable checkout or assume an exception applies.

## 2. Plans, prices, and discounts

### What source establishes

- Both monthly and yearly plans exist in models, defaults, admin settings, purchase response, and the Flutter subscription screen. Both are active by default when first inserted. There is no monthly-only switch or active-plan control in the admin interface.
- Monthly defaults to product ID `happinotes_premium_monthly`; yearly defaults to `happinotes_premium_yearly`. The environment variable names are Google-specific. Existing Mongo plan records are not overwritten by these defaults because bootstrap uses `$setOnInsert`.
- There is no source-configured price to report. A missing plan record is inserted with `priceInr: 0`; actual current Mongo values and actual store prices were not inspected.
- The plan model has no original price, discount percentage, savings, promotion, trial, offer duration, eligibility, or localized currency fields. It only represents a recurring period and an INR backend price. Thus the app/backend do not calculate discount percentages or totals and cannot explain offer eligibility from their own data.
- Admin price validation rejects non-finite, zero/negative values, and more than two decimal places. The model allows zero (used for an unconfigured default); the Google sync helper rejects non-positive values. No discount percentage exists to validate.
- Google catalog sync in `googleSubscriptionCatalog.ts` sends INR pricing for the India region and marks the base plan available to new subscribers. It does not sync Apple prices or define discount offers.
- Flutter displays the localized `ProductDetails.price` when the store returns a product. It falls back to the backend INR amount if no store product is available; in that state its Subscribe button is disabled and it displays an availability message. The backend fallback may differ from the store’s charge, especially after a failed catalog sync or in other regions.
- Saving in admin persists the backend price before Google synchronization. A reported sync failure therefore leaves two values: the newly saved backend fallback and whatever price Play currently serves. The success response/warning is visible in the admin page, but this is still a source-of-truth split. Apple is not synchronized from this endpoint at all.
- No subscription offer-selection or discount breakdown is implemented in Flutter. Current UI shows plan name and a price, without a complete renewal/introductory-offer disclosure. Do not advertise a discount or trial based on console configuration until the app can display the terms returned by the store.

### Policy and pricing decisions still required

Before catalog changes, the owner must set the intended new-customer plan policy (monthly only, or monthly plus yearly), the agreed terms/prices for each market, whether any existing yearly plan remains purchasable, treatment of already-paid periods, and any trial/introductory offer and eligibility. Store price localization/tax treatment must be checked in each console. The app should show the store-localized price and renewal term as the amount the customer will be charged; any backend price should be clearly treated as a fallback/catalog reference, not a second charge authority.

## 3. Existing and changing subscribers

- **Existing yearly subscribers:** `SubscriptionPlanKey`, the plan model, purchase ledger, and `User.subscription` all retain `yearly`. The bootstrap does not overwrite existing plan IDs/prices. Content access depends on the user's verified snapshot and expiry rather than requiring a currently purchasable plan. This is compatible in source, but the actual yearly product, existing user records, renewals, and store state are unknown because no production data/console was accessed.
- **New monthly subscribers:** The client can buy monthly when the backend returns it as active and the store returns a matching product. No store sandbox purchase was performed. Monthly is not exclusive: yearly is also offered by current source.
- **New yearly subscribers:** Same path as monthly with `P1Y`; yearly remains active by default and editable in admin. There is no implemented monthly-only enforcement.
- **Cancelled but still entitled:** Google `SUBSCRIPTION_STATE_CANCELED` remains active until verified expiry; its auto-renew flag is false. Apple access remains active until transaction expiry if not revoked, but the Apple path incorrectly reports `autoRenewing` as equal to `active` (details below).
- **Expired, paused, on-hold, pending, refunded/revoked:** Google purchase verification returns inactive for expired, paused, on-hold, pending or past-expiry state; grace-period is active. Apple checks transaction expiry and revocation. Store notification code refreshes from providers for known claims. Real lifecycle delivery has not been verified.
- **Renewals/retries:** Google reuses a hashed purchase token as its stable claim key and fetches current state from Play for purchase verification and RTDN. Apple uses environment plus `originalTransactionId`; notification handling fetches the identified transaction but does not read signed renewal information or subscription status. Apple auto-renewal, grace-period, and billing-retry state are consequently incomplete.
- **Restore:** Flutter exposes Restore subscription. Android may restore a missing account binding only when the proof already has a ledger claim for the same user/product. A mismatched owner never passes. Apple verifies a signed transaction with the current account token; there is no legacy unbound-Apple restore exception. Existing Apple purchases made without the account token may therefore need an explicit recovery plan.
- **Duplicate verification/notifications:** Unique store/transaction ledger claims and owner checks make purchase verification retryable. Google duplicate RTDN has an isolated test and re-fetches current state. Apple subscription duplicate/out-of-order notification integration is not covered by a corresponding isolated test. The actual notification delivery configuration is unverified.
- **Plan changes:** The app displays the active subscription card instead of both purchase options, and no upgrade/downgrade flow is present. The entitlement helper prevents an unrelated shorter active transaction from replacing a longer existing entitlement. If product migration is later needed, do not retire old IDs or overwrite catalog mappings until restore/renewal compatibility is demonstrated.
- **Access expiry risk:** `canAccessPremiumContent` treats `active: true` with no `expiresAt` as entitled indefinitely. The live provider verification paths normally require a future expiry before granting active access, which reduces the risk for new verified subscriptions. The schema makes expiry optional, so a legacy or malformed active snapshot can still grant indefinite access. This warrants a data-safe remediation and an audit of records before release; no data was queried here.
- **Admin complimentary access:** No subscription-specific complimentary grant was identified in the inspected billing paths. Do not infer complimentary entitlements from store purchase records.

## 4. Store readiness (assessed independently)

### Google Play Billing

| Check | Source evidence | Still unverified |
|---|---|---|
| App identity / product IDs | Backend example has Android package `com.happinotes.happinotes_flutter`; Google-specific monthly/yearly variables and matching fallback SKU strings exist. Flutter asks the store for each plan’s `productId`. | Actual Play Console package, subscription product IDs, base plan IDs/states, localized markets, pricing, offer configuration, and whether they match current database records. |
| Purchase/ownership verification | Google Play Developer API `subscriptionsv2` lookup verifies product, account ID and state; active subscriptions are acknowledged before granting access. Client-only success is insufficient. | Service account permissions, package/API setup, actual license tester and Play track purchase, acknowledgement and restore on device. |
| Renewals/notifications | RTDN endpoint validates Google identity and package, looks up current provider status, checks an existing same-owner claim and updates entitlement. | Pub/Sub topic/subscription, notification audience/email, endpoint URL, delivery/retry monitoring, renewal, grace, hold, pause, cancellation, refund/expiry events. |
| Pricing | Admin sync creates/updates INR price for India; mobile uses localized Play price when available. | Actual Play price/tax/localized prices and comparison with backend fallback. Existing product catalog was not fetched. |
| Offers | No server/app discount model or offer selection is present. | Whether offers exist in Console; eligibility and displayed terms must be tested before advertising them. |

### Apple In-App Purchase

| Check | Source evidence | Still unverified |
|---|---|---|
| App identity / product IDs | Backend example expects bundle ID `com.happinotes.happinotesFlutter`; Apple transaction verification checks the product ID against the same plan `productId` used by Android. | App Store Connect bundle, app record, auto-renewable product IDs, subscription group/periods/prices and whether those IDs exactly equal the backend’s shared product IDs. No Apple-specific monthly/yearly SKU variables were found. |
| Purchase/ownership verification | App Store Server API transaction lookup and signed-transaction verification check product ID, auto-renewable type, `appAccountToken`, revocation and expiry. | In-App Purchase key/issuer/app ID, trusted root certificates, production/sandbox environment correctness, accepted agreements/tax/banking, sandbox purchase and restore. |
| Renewals/notifications | App Store Server Notifications V2 route verifies signed payload/transaction and updates an existing ledger claim. | Notification URL/version/status in App Store Connect, delivery history, renewal/cancel/refund/expiry in sandbox and production. |
| Auto-renew and grace | `appleSubscription` and Apple notification handling set `autoRenewing` equal to `active`; no signed renewal info or current subscription-status lookup is used. | Correct auto-renew status, billing retry, grace-period and expiration behavior have not been proven. |
| Pricing/offers | No Apple catalog sync and no app-side offer selection/discount disclosure. Flutter uses localized product price if found. | Product price, territories, introductory/promotional offers, eligibility and review metadata in App Store Connect. |

Apple recommends in-app purchase for digital subscriptions and requires clear subscription value, duration, and price disclosures; Apple review also expects a complete, testable submission ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)). Google provides license testers and test tracks for billing tests ([Google Play Billing test guidance](https://developer.android.com/google/play/billing/test)). These checks require the owner’s store accounts and test devices; they were not run as part of this audit.

## 5. Website and accidental production API use

The customer website cannot currently purchase or manage digital subscriptions. Both dashboard clients contain a hardcoded ₹499/month modal, but `subscribeOpen` is always false and `handleSubscribe` is a no-op. Treat it as dormant legacy UI, not a functional offer. Remove or implement it in a later, policy-reviewed phase; do not enable the hardcoded value.

[`flutter_app/lib/core/network/api_client.dart`](../flutter_app/lib/core/network/api_client.dart) uses compile-time `String.fromEnvironment('API_BASE_URL')`, but defaults to the production Railway API host. There are no separate flavors or safe dev/test default in the inspected source. Therefore an ordinary debug build or local store test that omits `--dart-define=API_BASE_URL=...` can call production. The backend’s test purchase simulation checks both non-production `NODE_ENV` and `PAYMENTS_TEST_MODE=true`, but that does not redirect the mobile app or make store verification test-only. Store purchase verification uses the configured provider environment and can still create real production effects if testers use real accounts. Build/test workflows need explicit environment isolation before store tests.

## 6. Ranked risks

| Severity | Finding | Evidence / release impact |
|---|---|---|
| **High** | Flutter defaults to the production API during development/testing. | `ApiClient.baseUrl` defaults to the Railway host; `API_BASE_URL` is optional compile-time input. A local test can unintentionally use production accounts/backend. |
| **High** | Apple SKU mapping is not independent from Google. | `SubscriptionPlan` has one immutable `productId`; defaults use Google-specific variables and Flutter sends the same ID for iOS. Apple console IDs are unknown. iOS can only work if Apple’s IDs exactly match those shared IDs; otherwise it fails product lookup/verification. |
| **High** | Apple renewal lifecycle is incomplete and renewal status is misreported. | Apple sets `autoRenewing = active` and ignores renewal info/status APIs. Cancelled-but-entitled users can appear to renew; grace/retry states are not reliably applied. Access may stop or be shown incorrectly during Apple billing recovery. |
| **High** | Backend price can diverge from the billed store price. | Admin saves DB price before Google sync; failure still returns success with warning; Apple is never synced here. Mobile price fallback uses DB INR. Customer price must be confirmed against the actual store product before accepting purchases. |
| **Medium** | Missing expiry on an active entitlement can grant premium indefinitely. | Schema permits optional `expiresAt`, and `canAccessPremiumContent` accepts active plus missing expiry. Verified providers require expiry for active status, but legacy/malformed records remain a risk. |
| **Medium** | Monthly-only business intent is not implemented. | Monthly and yearly are active by default, both are editable and both are shown by Flutter. Decide whether new yearly sales should continue; preserve existing yearly subscribers separately from new-sale availability. |
| **Medium** | Google catalog update may replace sibling base plans. | On a price change, `googleSubscriptionCatalog.ts` sends only the edited plan in a `basePlans` update. If an actual product has additional base plans, confirm Google update-mask semantics and catalog shape before using this path; no Play catalog was inspected. |
| **Medium** | Offer/discount terms are not modeled or presented. | No offer/discount, original price, duration, eligibility or savings calculation exists. Store-side offers must not be advertised as app-supported until selection and clear disclosure are tested. |
| **Medium** | Apple legacy purchases without account binding may not restore. | Apple verification requires exact `appAccountToken`; no unbound-restore path exists. Determine whether any pre-existing Apple purchasers lack this field before promising restore compatibility. |
| **Low** | Website placeholder is stale and not a checkout. | Hidden no-op modal displays ₹499/month. It is not active today, but could mislead if accidentally re-enabled. |
| **Low** | Billing tests are primarily isolated mocks. | They check decision logic, not live provider credentials, Mongo concurrency, store-console catalog, device purchase sheet, notification delivery, or financial settlement. |

## 7. Verification executed

Commands were run locally only; no database or external store/API request was made by the audit.

| Command | Result |
|---|---|
| `node --test test/subscriptionPurchaseRoutes.test.cjs test/subscriptionPurchase.test.cjs test/subscriptionEntitlement.test.cjs test/storeNotifications.test.cjs test/storeProductProvisioning.test.cjs test/legacyPurchaseTokenMigration.test.cjs` (from `backend/`) | **PASS — 72/72 tests.** Isolated Node tests with mocked provider/database boundaries. |
| `npm.cmd run test:isolated` (from `backend/`) | **PASS — 167/167 tests.** |
| `npm.cmd run build` (from `backend/`) | **PASS — TypeScript build.** |
| `npm.cmd run lint` (from `happinotes-admin/`) | **PASS — 0 errors, 19 `<img>` optimization warnings.** |
| `npm.cmd run build` (from `happinotes-admin/`, with `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:1` set for the command) | **PASS — production Next.js build.** The override avoided embedding the production API host during build verification. |
| `flutter test` / `flutter analyze` | **NOT RUN — blocked.** Flutter CLI was unavailable in the environment, and `flutter_app/.dart_tool/package_config.json` was absent. No dependencies were installed. `flutter_app/test` currently has a store-purchase test but no subscription-controller test. |
| `git diff --check` | Run after creating this report; result recorded in completion summary. |

Passing isolated tests are not MongoDB integration tests and do not prove true concurrent database behavior or store behavior. The Apple subscription renewal/restore scenarios above are not covered by the existing test set.

## 8. External confirmation still required

Before enabling release purchases, the owner/store operators need to confirm:

1. Whether newly sold subscriptions should be monthly only or monthly plus yearly; separately confirm grandfathering and renewal of existing yearly subscribers.
2. Exact Google Play package, monthly/yearly product IDs and base plan IDs, region availability, prices, renewal terms and any offers.
3. Exact App Store Connect bundle/app ID, subscription group, monthly/yearly product IDs, prices, terms, localization and offers. Confirm whether they exactly match the current shared backend product IDs.
4. Google service-account access and RTDN configuration, including Pub/Sub identity/audience and delivery to the backend endpoint.
5. Apple IAP API signing key/certificates, Production versus Sandbox selection, App Store Server Notifications V2 URL, and delivery status.
6. Flutter dev/test/release API URLs and a build process that cannot silently use production for local/test builds.
7. Tester accounts, Play internal test track/license testers, Apple sandbox testers, and real-device purchase/restore checks across second device/account.
8. End-to-end monthly and yearly: pending, cancel before expiry, renewal, billing retry/grace, hold, expiry, refund/revocation, duplicate/out-of-order notification, account deletion, and recovery after failed verification.
9. Existing subscriber impact and catalog state, using a controlled export/read-only review by the owner. No production records were read here.

## 9. Recommended next phases

1. **Product and grandfathering decision:** Owner documents sale policy (monthly/yearly), regions, price/renewal terms, offers, and the treatment of existing yearly and historical one-time purchasers. Do not change records yet.
2. **Catalog compatibility design:** Confirm both stores’ exact product IDs. Design explicit per-store IDs (while retaining old IDs/claims for restore and renewal) if they differ. Decide how existing DB rows and currently paying subscribers remain mapped.
3. **Price and offer integrity:** Establish store-localized price as the customer charge source; make admin save/sync status explicit and safe when a provider sync fails; do not show a backend fallback as a guaranteed store charge. Model and disclose offers only if both purchase flows can identify eligibility and terms.
4. **Apple lifecycle correctness:** Use authoritative subscription status/renewal data for auto-renewal, grace and billing retry; process cancellation, expiration and refund/revocation while preserving access through verified expiry. Add isolated tests and provider-sandbox tests.
5. **Environment isolation:** Give Flutter explicit dev/test/release configurations; make accidental production backend use impossible in local/test builds. Keep store verification on sandbox/test accounts until reviewed.
6. **Compatibility and access audit:** Define a safe migration/reconciliation plan for yearly subscriptions, missing-expiry records, Apple legacy account bindings, and one-time book ledger claims before any catalog changes.
7. **Store acceptance:** Run real Android Play test-track and Apple sandbox flows, notification delivery, restore on another device, and test the customer-visible price/disclosure. Then obtain owner approval for release submission as a separate phase.

**Recommended immediate next phase:** Phase 7 should be a product-ID and subscriber-compatibility design review with the owner and store console owners, followed by the Apple lifecycle and environment-isolation implementation. No product IDs, prices, or sale policy should be changed until that review is approved.
