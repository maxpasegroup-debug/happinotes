# HappiNotes release audit — executive summary

Audit date: 2026-10-22 (Asia/Calcutta)  
Repository: `C:\Users\kkyad\OneDrive\Desktop\happinotes`  
Audited commit: `13e55e270365fc7c121002a304bf42cd7fdcecb9` (`integrate-flutter-main`, tracking `origin/main`)

## Scope and method

This was a read-only audit and release plan. Source, configuration, tests, documentation, and local build tooling were inspected. No application code, production data, Railway variables, Google Play Console state, credentials, database records, deployment, or release artifact was changed. Secrets were not printed.

## Overall verdict

**Production rollout readiness: FAIL. Internal-testing AAB readiness: BLOCKED.**

The product has a working Flutter client, Express/MongoDB backend, Next.js admin, Cloudinary media path, FCM/in-app notifications, and Android subscription plumbing. The latest subscription-plan realtime changes are present in the audited commit and the backend TypeScript build passes. However, the release cannot be certified because two purchase-security correctness defects are confirmed, the deterministic admin bootstrap password is hard-coded, current Flutter validation is blocked by a hanging local toolchain, the admin production build is blocked by Windows `spawn EPERM`, and Play/deployed-code evidence is absent.

## What is implemented

- Flutter Android application ID: `com.happinotes.happinotes_flutter`; current package version `1.0.1+2` (`flutter_app/pubspec.yaml:19`).
- Email/password and OTP-based account flows, session storage, content browsing, favourites/collection, audio player, notifications, and legal screen.
- Shared monthly/yearly subscription plans. The admin PATCH route persists the MongoDB price, emits `subscription-plans:changed`, then attempts Google Play catalog synchronization (`backend/src/routes/adminSubscriptionPlanRoutes.ts:18-55`).
- Mobile subscription loader reads backend plans, queries store product IDs, shows store pricing when available, verifies purchases on the backend, restores purchases, and handles pending/error states (`flutter_app/lib/core/payments/subscription_purchase_controller.dart:67-239`).
- Server-side premium access and purchase records with unique `(store, transactionKey)` indexes (`backend/src/models/SubscriptionPurchase.ts:31-33`, `backend/src/models/StorePurchase.ts:10-12`).
- FCM token registration, persisted in-app catalog notifications, push delivery, invalid-token cleanup, and realtime catalog/subscription events.
- Cloudinary upload implementation for thumbnails, intro/conclusion, lessons, notes, silence media, and notification media (`backend/src/controllers/adminContentController.ts:80-116`).
- Google Play subscription/product API integration and a durable legacy one-time-product provisioning worker.

## Confirmed strengths

- Git worktree is clean; audited HEAD equals `origin/main`.
- Backend TypeScript compilation passed (`npm run build`).
- `backend/test/storePurchase.test.cjs`: 16/16 passed.
- Admin TypeScript validation passed (`npx tsc --noEmit`).
- Sensitive provider errors are generally redacted before persistence (`backend/src/services/storeProductProviders.ts:29-36`).
- Subscription plan price is persisted before slower Play synchronization, so the backend price is not lost when Play is temporarily unavailable.
- Purchase records are idempotent and unique by hashed token/transaction key.

## Release-blocking risks

1. **P0 — Google account binding is permissive.** `accountMatches` returns true when the expected account is present but Google omits or returns a non-string external account identifier (`backend/src/services/subscriptionPurchase.ts:27-30,53-56`). A verified purchase can therefore be associated without proving the intended HappiNotes account.
2. **P1 — Google acknowledgement errors are swallowed.** Any acknowledgement error, including credentials, network, or API errors, is ignored (`backend/src/services/subscriptionPurchase.ts:61-68`). Access can be stored while acknowledgement has not succeeded, creating refund/reconciliation risk.
3. **P0 — Known admin password is embedded in source.** A missing primary admin is recreated with a known literal (`backend/src/config/ensureAdmin.ts:4,17-37`; value intentionally omitted). This is incompatible with production secret management.
4. **P1 — Production OTP can default to test mode.** `WHATSAPP_OTP_MODE` defaults to `test` (`backend/src/config/env.ts:30`), and test OTPs are returned by phone OTP endpoints (`backend/src/controllers/authController.ts:297-323,358-369`). Production must fail closed.
5. **P1 — Account deletion is not exposed as an authenticated self-service/API flow.** The app creates accounts, but routes expose FCM-token removal and language update only; no user account deletion route was found (`backend/src/routes/authRoutes.ts`, `flutter_app/lib/src/screens`). Google Play requires in-app and external deletion paths for apps with account creation.
6. **P1 — Subscription-only commercial model is not fully migrated.** `Content.priceInr`, `StorePurchase`, book product mapping, legacy purchase UI, and provisioning worker remain active. The admin currently writes zero book prices, but old records and routes remain. A migration/compatibility decision is required before deleting anything.
7. **P1 — Current automated evidence is not green.** Product provisioning: 26 passed/2 failed; notification tests: 6 passed/1 failed (Apple refund test timed out and returned no 204). Aggregate backend tests fail under Windows `spawn EPERM`; Flutter test/analyze commands hung and were interrupted; admin build compiled then failed at TypeScript worker spawn.
8. **P1 — Effective target SDK is not proven.** `compileSdk = 37`, but `targetSdk` delegates to the Flutter toolchain (`flutter_app/android/app/build.gradle.kts:27-45`). The effective manifest target must be captured before submission; current Play policy requires API 36 for new apps and updates from 2026-08-31.
9. **P2 — Upload memory and CORS are over-permissive.** Multer uses unlimited `memoryStorage` with no file-size/count limits (`backend/src/middleware/upload.ts:1-26`); Express allows every `*.vercel.app` and `*.railway.app` origin and Socket.IO falls back to `origin: true` (`backend/src/app.ts:12-48`, `backend/src/server.ts:35-44`).
10. **P1 — Production/deployment match is unverified.** Railway service configuration and active deployment commit were not queried during this audit; screenshots/history are not sufficient evidence.

## Separate iOS scope

The current FlutterFire options contain Android configuration only; iOS/macOS/web/Windows/Linux throw `UnsupportedError` (`flutter_app/lib/firebase_options.dart:18-54`), and no iOS `GoogleService-Info.plist` was found. This is not a blocker for an explicitly Android-only first release, but it is a separate blocker for an iOS release.

## Release gates

| Gate | Verdict | Evidence |
|---|---|---|
| Feature implementation completeness | PASS WITH LIMITATIONS | Core flows exist; legacy one-time flow and device evidence remain. |
| Security readiness | FAIL | Account binding, acknowledgement, bootstrap password, OTP fail-closed gaps. |
| Backend/database readiness | FAIL | Test failures, legacy migration, limits/backups/startup validation outstanding. |
| Mobile QA readiness | BLOCKED | Flutter test/analyze did not complete in current environment. |
| Admin/deployment readiness | BLOCKED | TypeScript passes; lint dependency and Windows build spawn blockers; deployment match unverified. |
| Android signing readiness | PASS WITH LIMITATIONS | Ignored `key.properties` and `upload-keystore.jks` exist locally; certificate/value verification not performed. |
| Internal-testing AAB readiness | BLOCKED | No release AAB generated in this audit; effective target and end-to-end evidence incomplete. |
| Production rollout readiness | FAIL | P0/P1 findings and policy evidence remain. |

## Minimum safe next action

Implement and test Phase 1 in `final-implementation-roadmap.md`: strict Google account binding and acknowledgement state handling, remove the hard-coded admin bootstrap password, and force live OTP configuration in production. Then rerun the evidence matrix before generating any AAB.

