# HappiNotes Phase 8 — Apple Subscription Lifecycle

**Date:** 2026-10-24  
**Verdict: PASS WITH LIMITATIONS**

This phase extended the existing App Store Server API and subscription ledger. All work was local. No production services or data, Railway settings, App Store Connect, Google Play Console, or release signing were accessed. No prices, product identifiers, subscriber records, credentials, or dependency files were changed.

## Lifecycle behavior

| Lifecycle case | Before this phase | Current backend behavior |
|---|---|---|
| Initial purchase | Verified a signed transaction, selected product/type, `appAccountToken`, revocation, and transaction expiry. | Keeps those checks, then requests Apple’s current subscription status and verifies the signed transaction and renewal payload before recording entitlement. A status lookup failure fails closed. |
| Successful renewal | Notification handling looked up the transaction named by that notification. It did not refresh the whole subscription chain’s current status. | Notifications refresh current status by original transaction ID. The backend applies only verified status and expiry; a repeated event resolves to the same current state. |
| Failed renewal / billing retry | Billing retry was not distinguished from ordinary active state. `autoRenewing` was set equal to `active`. | The backend uses Apple’s status enum and signed renewal data. Billing retry without a valid grace period does not extend access past transaction expiry. Renewal state is read from signed `autoRenewStatus`. |
| Grace period / recovery | Not implemented. | A verified `BILLING_GRACE_PERIOD` status can extend access only to the signed `gracePeriodExpiresDate`. Recovery is reflected by a fresh current-status query. |
| Cancellation | Cancellation could be reported as non-renewing access, but renewal state was inaccurate and lifecycle status was not refreshed. | An active subscription remains entitled through its verified expiry when renewal is off; `autoRenewing` reports the signed renewal setting. |
| Expiration | Access relied on the transaction expiry and did not use current subscription status. | `EXPIRED`, elapsed transaction expiry, or elapsed verified grace expiry does not grant access. Existing content access checks still enforce expiry. |
| Refund / revocation | One-time Apple refunds were refreshed from transaction lookup. Subscription revocation state was not handled through current chain status. | `REVOKED` status or a signed transaction revocation removes subscription entitlement, subject to the monotonic state guard. |
| Upgrade / downgrade | Not explicitly supported or mapped through lifecycle events. | Still unsupported. The verified current product must match the product on the existing claim. A product switch is not applied. Owner-confirmed Apple mappings and a deliberate plan-switch policy are needed before supporting switches. |
| Duplicate / out-of-order notification | Duplicate writes were mostly repeatable, but no signed-state ordering field existed. | Every subscription notification refreshes Apple’s current status. Optional `providerStateSignedAt` fields and conditional writes prevent an older signed result from replacing newer state. |
| Restore / account ownership | An authenticated user could restore only a transaction whose unique ledger claim belonged to that same user; purchase verification also checked the account token. | Retains those checks and additionally verifies account binding in the current signed transaction and, when present, the signed renewal data. Notifications only update an existing chain claim. |

Apple notification authenticity continues to be checked with App Store Server Notifications V2 signature verification. When a notification contains signed renewal data, that JWS is verified too; renewal-only notifications can refresh the matching existing chain. Subscription entitlement is never accepted from client-reported state. Google Play verification and RTDN processing were not changed.

## Implementation and files

- `backend/src/services/subscriptionPurchase.ts` — obtains current Apple subscription status, verifies signed transaction and renewal data, derives active/grace/expiry/revocation and renewal state, and returns Apple’s signed timestamp.
- `backend/src/routes/storeNotificationRoutes.ts` — refreshes current Apple subscription status for notifications and applies it only to an existing owner claim. Writes are conditional on provider-state order.
- `backend/src/routes/storePurchaseRoutes.ts` — persists the verified Apple state and guards against applying a stale verification result.
- `backend/src/models/SubscriptionPurchase.ts` and `backend/src/models/User.ts` — add optional `providerStateSignedAt` fields. Existing documents remain schema-compatible; no migration is required.
- `backend/src/services/subscriptionEntitlement.ts` — rejects older signed lifecycle state and uses a conditional update to avoid a stale concurrent overwrite.
- `backend/test/subscriptionPurchase.test.cjs`, `backend/test/storeNotifications.test.cjs`, `backend/test/subscriptionEntitlement.test.cjs` — cover Apple state derivation, ownership, grace, expiry, revocation, provider failures, duplicate notification refresh, and ordering.
- `docs/PHASE_8_APPLE_LIFECYCLE_REPORT.md` — this report.

The new database fields are optional. There is no required schema migration. Existing yearly ledger claims and Google Play fields remain intact.

## Verification

Commands run from `backend/`:

| Command | Result |
|---|---|
| `npm.cmd run build` | **PASS** — TypeScript compilation. |
| `node --test --test-reporter=dot test/subscriptionPurchase.test.cjs test/subscriptionEntitlement.test.cjs test/storeNotifications.test.cjs` | **PASS — 41/41 tests.** |
| `npm.cmd run test:isolated` | **PASS — 183/183 tests.** |
| `git diff --check` from `backend/` (repository root detected by Git) | **PASS** — no whitespace errors. Git printed existing LF/CRLF normalization warnings for unrelated modified files. |

Admin lint/build was not run because this phase changes no admin code. Tests use mocked Apple APIs and Mongo models. They do not prove App Store credentials, Apple API connectivity, webhook delivery, or actual MongoDB conditional-write concurrency.

## Apple configuration blockers and sandbox work

The Phase 7 report records both Apple monthly/yearly product-ID variables as deliberately unconfigured. The checked-in example also leaves the Apple App ID and API credential fields blank. No production environment was inspected, so this report cannot say whether a live environment has those values. The owner must confirm the actual App Store Connect product IDs, subscription group, bundle identifier, app ID, API key/issuer setup, trusted Apple root certificates, server API environment, and App Store Server Notifications V2 URL before enabling purchases. This report does not provide or invent any values.

Before release, complete sandbox/TestFlight checks with owner-configured Apple products and credentials:

1. Buy monthly and yearly products with separate test accounts and verify same-account restore.
2. Verify a successful renewal updates expiry and renewal state.
3. Turn off renewal and verify access remains through the paid expiry while renewal state is off.
4. Exercise billing retry and grace-period entry/recovery using Apple’s sandbox-supported scenarios; confirm access ends at the signed grace expiry if recovery fails.
5. Exercise expiration, refund/revocation, and repeated/out-of-order notifications; verify access is removed only from Apple’s current verified state.
6. Verify a different HappiNotes account cannot claim or restore the transaction.
7. If plan switches will be sold, test upgrades and downgrades only after product mapping and switch semantics are implemented and reviewed.

Until those checks pass, Apple release readiness remains blocked despite the code/test verdict above.

## Flutter verification status and next steps

Phase 7 found no `flutter` or `dart` executable and no `flutter_app/.dart_tool/package_config.json`. The repository declares Dart `^3.12.0`. Flutter analysis/tests were not run in this phase; no SDK or package installation was attempted.

On the owner’s development machine, install/use a Flutter SDK whose bundled Dart satisfies `flutter_app/pubspec.yaml` (`>=3.12.0 <4.0.0`), open PowerShell in `flutter_app/`, and run:

```powershell
flutter --version
dart --version
flutter pub get
flutter analyze
flutter test
```

Resolve any reported source or test issues before a device sandbox test. Do not change SDK constraints or dependencies merely to make the local toolchain fit.

## Remaining blockers and recommended next phase

1. **Apple configuration and sandbox evidence:** owner confirmation of catalog and server configuration, followed by TestFlight/sandbox lifecycle tests, is required before release.
2. **Plan switches:** upgrade/downgrade lifecycle mapping remains unsupported; decide whether monthly/yearly switching is offered and implement the confirmed Apple mapping before enabling it.
3. **Real datastore concurrency:** the atomic filters are covered with unit mocks, not a live MongoDB integration test. Verify race behavior against a disposable test MongoDB instance before release.
4. **Flutter checks:** install/use the compatible SDK and pass `flutter analyze` and `flutter test`.

**Recommended next phase:** owner-confirm Apple catalog/configuration, implement and test product-switch mapping only if it is part of the intended offer, then run sandbox lifecycle and real-Mongo concurrency checks. Do not treat this phase’s mocked tests as Apple integration certification.
