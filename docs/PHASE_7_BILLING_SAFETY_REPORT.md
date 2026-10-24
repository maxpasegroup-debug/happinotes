# HappiNotes Phase 7 — Billing Safety & Store Product Mapping

**Date:** 2026-10-24
**Verdict: BLOCKED** for store release certification. The source changes and backend checks are complete, but Flutter checks could not run, Apple subscription identifiers remain deliberately unconfigured, and neither store console nor sandbox purchases were verified.

## 1. Changes made and why

- Added an API URL validator and removed the Flutter production URL fallback. Every run/build must provide `API_BASE_URL`; non-release builds reject the known production Railway host and only allow plain HTTP for local/emulator hosts. Release builds require HTTPS. Invalid values fail without echoing their contents.
- Added explicit `storeProductIds.android` / `storeProductIds.ios` plan mappings. Existing `productId` remains as the legacy identifier and Android fallback so existing plan records and purchase claims do not require a migration.
- The backend resolves new purchases only from the selected store’s active mapping and still requires authoritative provider verification before writing an entitlement. Unknown and cross-store IDs fail closed.
- A legacy ID can be used on restore only when the authenticated user already has a ledger claim for that store/product. The provider still verifies account ownership and current transaction state. This retains compatibility for existing yearly claims without letting a client-supplied product name grant access.
- Added empty Apple product-ID variables to `.env.example`; no Apple IDs were invented. The API response/admin settings now show Apple as “Not configured” until an owner-confirmed value exists.
- Did not change prices, user subscription records, plan periods, store-console settings, renewal-state behavior, or deployment configuration.

## 2. Files changed

- `backend/.env.example`
- `backend/README.md`
- `backend/src/models/SubscriptionPlan.ts`
- `backend/src/routes/adminSubscriptionPlanRoutes.ts`
- `backend/src/routes/storePurchaseRoutes.ts`
- `backend/src/services/subscriptionPlans.ts`
- `backend/src/services/subscriptionProductMapping.ts` (new)
- `backend/test/subscriptionProductMapping.test.cjs` (new)
- `backend/test/subscriptionPurchaseRoutes.test.cjs`
- `flutter_app/README.md`
- `flutter_app/lib/core/network/api_client.dart`
- `flutter_app/lib/core/network/api_config.dart` (new)
- `flutter_app/lib/core/payments/subscription_purchase_controller.dart`
- `flutter_app/test/account_deletion_test.dart`
- `flutter_app/test/api_config_test.dart` (new)
- `flutter_app/test/store_purchase_test.dart`
- `happinotes-admin/app/admin/(secure)/settings/page.tsx`
- `docs/PHASE_7_BILLING_SAFETY_REPORT.md` (new)

Other pre-existing working-tree changes were preserved and not reverted.

## 3. Flutter API environment rules

The Flutter app reads `API_BASE_URL` only through `--dart-define`; the fallback is empty. A missing release value fails the Dart compile-time guard. Missing development values and malformed/unsupported URLs fail configuration before a request can be sent, with generic messages that do not echo the value.

| Build type | Accepted configuration |
|---|---|
| Debug/profile | Explicit HTTPS origin with a `dev`, `development`, `test`, `testing`, `staging`, or `sandbox` hostname label, or explicit HTTP local/emulator origin (`localhost`, loopback, Android emulator host). Production-looking hosts and the known production Railway host are rejected. |
| Release | An explicit API URL is required by a Dart compile-time guard; the runtime validator then requires a valid HTTPS API origin. No default is used. |
| All | URL credentials, paths, queries, fragments, malformed URLs, and unsupported schemes are rejected. The configured URL is not echoed in validation errors. |

From `flutter_app/`, local Android emulator development can use:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000
```

For iOS simulator/local development:

```powershell
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:5000
```

Flutter checks:

```powershell
flutter analyze
flutter test
```

Intentional release compilation requires the owner-confirmed HTTPS origin explicitly. The example below prompts for it; it was **not run** during this phase:

```powershell
$apiOrigin = Read-Host 'Enter the owner-confirmed production API origin'
flutter build appbundle --release --dart-define="API_BASE_URL=$apiOrigin"
```

See [`flutter_app/README.md`](../flutter_app/README.md) for the configuration guidance. No release build/AAB was produced.

## 4. Product mapping

The internal plan keys remain `monthly` (`P1M`) and `yearly` (`P1Y`). Apple IDs are left unset because no confirmed App Store Connect IDs were present in the repository or Phase 6 audit.

| Internal plan | Google Play ID from repository | Apple ID | Legacy handling |
|---|---|---|---|
| Monthly | `GOOGLE_PLAY_SUBSCRIPTION_MONTHLY_PRODUCT_ID`, documented fallback `happinotes_premium_monthly` | `APPLE_IAP_SUBSCRIPTION_MONTHLY_PRODUCT_ID` — **unconfigured; owner must confirm** | Existing `SubscriptionPlan.productId` remains available for existing same-user ledger restores. |
| Yearly | `GOOGLE_PLAY_SUBSCRIPTION_YEARLY_PRODUCT_ID`, documented fallback `happinotes_premium_yearly` | `APPLE_IAP_SUBSCRIPTION_YEARLY_PRODUCT_ID` — **unconfigured; owner must confirm** | Existing yearly `planKey` and ledger claim remain supported for same-user restore. |

The mapping helper [`backend/src/services/subscriptionProductMapping.ts`](../backend/src/services/subscriptionProductMapping.ts) checks the requested store’s explicit identifier. It rejects unknown products and duplicate mappings that would make the plan ambiguous. It never treats the Google ID as an Apple ID. Apple checkout remains unavailable until its identifiers are configured. A restore may use a legacy ledger mapping only when the current authenticated account already owns a matching store/product claim.

No database migration is required for this additive mapping: the new store-specific field is optional and the old `productId` field is retained. Existing database contents were not read or modified. Actual yearly subscribers and their records still require an owner-controlled, read-only inventory before any future catalog migration.

## 5. Existing yearly subscriber compatibility

- The yearly plan enum, `P1Y` period, ledger `planKey`, and user entitlement shape are unchanged.
- Existing plan rows with only `productId` continue to expose that identifier for Android compatibility; the old product value is not overwritten by `$setOnInsert` defaults.
- The API only permits legacy product resolution during restore when a same-user ledger claim matches the selected store/product and carries the existing plan key. Store verification and ownership checks still run before entitlement updates.
- A yearly transaction that has **no matching subscription ledger claim** cannot use this legacy restore path. This may affect older Apple/Google purchases that were never claimed by the current backend. The production ledger was not inspected, so this case remains unresolved.
- Existing active entitlements continue to use the existing expiry/access logic. This phase did not modify entitlement expiry or Apple lifecycle handling.

## 6. Verification and exact results

| Command | Result |
|---|---|
| `npm.cmd run build` from `backend/` | **PASS** — TypeScript compilation. |
| `node --test test/subscriptionProductMapping.test.cjs test/subscriptionPurchaseRoutes.test.cjs test/subscriptionPurchase.test.cjs test/subscriptionEntitlement.test.cjs test/storeNotifications.test.cjs` from `backend/` | **PASS — 43/43 tests.** Includes valid mapping, unknown/cross-store rejection, Apple-unconfigured behavior, legacy yearly restore, and existing provider/entitlement cases. |
| `npm.cmd run test:isolated` from `backend/` | **PASS — 174/174 tests.** |
| `npm.cmd run lint` from `happinotes-admin/` | **PASS — 0 errors, 19 `<img>` optimization warnings.** |
| `npm.cmd run build` from `happinotes-admin/`, with `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:1` for the build process | **PASS.** |
| `flutter --version`, `dart --version`, `flutter analyze`, `flutter test` from `flutter_app/` | **BLOCKED.** PowerShell reports `flutter` and `dart` are not recognized commands. `flutter_app/.dart_tool/package_config.json` is absent. The project declares Dart `^3.12.0` in `pubspec.yaml`; no dependency resolution or installation was attempted. |
| `git diff --check` | Run after this report is written; result recorded in completion summary. |

The backend tests are isolated tests with mocked database/provider boundaries. They do not verify MongoDB concurrency, Play/App Store console setup, purchase sheets, real receipts, notification delivery, or settlement.

## 7. Remaining Apple renewal-state blockers

This phase intentionally did not change Apple lifecycle processing. `appleSubscription` still reports `autoRenewing` as the same value as entitlement `active`, so a cancelled-but-not-expired subscription can be shown as renewing. Apple renewal information/current status is not used for billing retry or grace-period state. Implement and test those cases in a later phase before certifying Apple subscription lifecycle behavior.

## 8. Manual store-console work still required

1. Owner confirms whether yearly sales continue for new customers; existing yearly subscribers remain a separate compatibility obligation.
2. Confirm exact monthly and yearly product identifiers, terms, prices, regions and offers independently in Play Console and App Store Connect. Do not copy Google values into Apple configuration by assumption.
3. After Apple identifiers are confirmed, set the two backend Apple product-ID variables through the authorized configuration process. This phase did not edit Railway variables.
4. Confirm Google Play package/base plans, service-account permissions, RTDN identity and delivery; confirm App Store bundle/product group, IAP API credentials, production/sandbox selection and App Store Server Notifications V2 delivery.
5. Run Play internal-track/license-tester and Apple sandbox transactions on real devices: purchase, restore on another device, cancel, renew, expiry, refund/revocation, failed verification and duplicate/out-of-order notifications.
6. Check old yearly and historical purchase restoration using a controlled, owner-approved read-only inventory before changing any catalog IDs.

## 9. Remaining limitations and next phase

- No store IDs, prices, or environment values have been verified against external consoles.
- Apple subscription IDs are explicitly unconfigured, so the iOS subscription product is not ready for new purchase checkout.
- Flutter source changes and tests could not be run/analyzed without the SDK; install/use the repository-compatible Flutter SDK (Dart `^3.12.0`) and then run the two commands above. Do not change the lockfile to work around the missing SDK.
- The known production host is blocked for non-release builds, but development must still be given the owner’s actual development/local URL explicitly. No production URL was used to test a release build.
- Apple renewal-state handling remains a separate blocker and was intentionally left unchanged.

**Recommended next phase:** confirm both store catalogs and existing ledger coverage with the owners, then implement Apple renewal/status handling and add Flutter subscription-controller tests. Only after those are verified should sandbox purchases and release preparation proceed.

No production systems/data, Railway settings, secrets, store-console settings, database migrations, deployment, or AAB signing were used in this phase.
