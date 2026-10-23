# Final implementation roadmap

This order is deliberately minimal. Preserve existing working behavior and legacy records until each migration gate is proven.

## Phase 0 — baseline and preservation (complete with limitations)

**Objective:** freeze evidence and identify the deployable surfaces.  
**Evidence:** clean Git worktree at `13e55e2`; backend/admin/mobile topology recorded in this directory.  
**Remaining:** capture Railway service SHAs, environment names, health responses, and Play package/track state.  
**Gate:** does not block code work; all later phases depend on the recorded baseline.  
**Rollback:** no changes were made.

## Phase 1 — payment and credential security (P0/P1; first)

**Files/services:** `backend/src/services/subscriptionPurchase.ts`, `backend/src/routes/storePurchaseRoutes.ts`, `backend/src/config/ensureAdmin.ts`, `backend/src/config/env.ts`, auth tests.

**Changes:** require exact Google `obfuscatedExternalAccountId`; define acknowledgement outcomes (already acknowledged, transient retry, fatal failure); remove hard-coded bootstrap password; make `ADMIN_EMAIL` authoritative; reject production `WHATSAPP_OTP_MODE=test`; add safe startup validation without logging secrets.

**Tests:** missing/malformed/mismatched binding, replay to another user, duplicate verify, acknowledgement 2xx/already-ack/transient/401, startup env matrix, OTP response redaction.

**Acceptance:** no unbound purchase grants access; failed acknowledgement does not create active entitlement; no known admin credential; production cannot start with test OTP mode.

**Gate:** blocks AAB generation, internal testing, and production billing certification.  
**Rollback:** keep existing claims/read paths; deploy verifier in compatibility/read-only mode only if a migration is required, with an explicit temporary feature flag and audit log.

## Phase 2 — commercial model and lifecycle

**Objective:** approve subscription-only versus subscription-plus-grandfathered purchases.

**Files/services:** `Content`, `StorePurchase`, `StoreProduct`, `SubscriptionPlan`, `storePurchaseRoutes.ts`, `storeProductProvisioning.ts`, Flutter `book_purchase_screen.dart` and subscription controller, admin dashboard.

**Changes:** inventory legacy purchases; define grandfathering/expiry/refund behavior; hide or deprecate one-time UI/routes only after records are protected; keep historical product mappings for restore; reconcile monthly/yearly base plans and regional pricing with Play.

**Tests:** existing legacy entitlement, new subscription, restore, cancellation, expiry, refund, duplicate and out-of-order events.

**Gate:** subscription-only decision is required before production release; legacy migration can be staged after internal testing if historical customers are not affected.

## Phase 3 — backend/data hardening

**Files/services:** upload middleware, CORS/server startup, model indexes, health/shutdown, backup runbook, Cloudinary cleanup.

**Changes:** upload byte/count limits and file validation; explicit origin allowlist; rate-limit auth/uploads/verification; add indexes for content/notifications and verify with `explain`; define Mongo backups/restore and Cloudinary orphan policy; make required production env checks explicit.

**Tests:** oversized/malformed uploads, CORS allow/deny, rate limits, health/dependency failure, index explain, backup restore in a non-production clone.

**Gate:** P1 items block production; P2 limits can be staged only with documented risk acceptance.

## Phase 4 — mobile release readiness

**Files/services:** Flutter auth/session, subscription controller/screen, FCM, player, legal/profile/settings, Android Gradle.

**Changes:** rerun/fix tests and analyzer; make subscription product-not-found and stale-price states explicit; prove pending/restore/renewal/expiry; add account deletion path/link; decide iOS scope; improve FCM error observability; capture effective target SDK and release API URL.

**Manual tests:** fresh install, login/signup/OTP, wrong email recovery, account switch, offline/timeout, free/premium, audio interruptions, notification tap/terminated state, subscription purchase/restore/refund.

**Gate:** blocks AAB until clean compile/test and account-deletion/legal evidence are complete.

## Phase 5 — admin/deployment readiness

**Files/services:** `happinotes-admin`, Railway admin/backend services.

**Changes:** repair dependency/lint environment without arbitrary upgrades; verify landing page root and `/admin/login`; secure token storage in a later hardening change; verify Cloudinary and Play env names; record service root/build/start/domain/commit/health.

**Tests:** admin login/role denial/logout, plan price write and realtime mobile refresh, upload/create/edit/coming-soon notification, clean production build.

**Gate:** required before relying on admin for live catalog changes.

## Phase 6 — end-to-end certification

Use a Play internal-test build and test accounts. Record artifact SHA, Play version code, package identity, backend commit, device/OS, tester account, timestamps, and logs. Test all journeys in `release-evidence-template.md`.

**Gate:** no unresolved P0/P1; all known limitations explicitly accepted by the product owner.

## Phase 7 — signed AAB candidate

Verify the existing upload keystore against the Play upload certificate without printing private material; increment version code from `2`; build a signed AAB with production API configuration; inspect manifest, target SDK, signing certificate, size, and dependency licenses. Do not reuse an APK as a Play release artifact.

**Gate:** safe to generate only after Phases 1–5 and clean validation. Generation itself is not production approval.

## Phase 8 — Play internal testing and production gate

Upload the signed AAB manually through the authorized Play Console account, opt in testers, verify the Play-distributed install (not only a sideload), run subscription and notification scenarios, complete Data safety/privacy/account-deletion declarations, and review pre-launch/device reports.

**Production gate:** only after internal-track evidence, policy declarations, refund/restore/lifecycle evidence, monitoring/backup runbooks, and rollback/version strategy are signed off.

## Deferred safely after initial launch

- iOS Firebase/APNs and StoreKit, if Android-only is the approved first release.
- HttpOnly admin sessions if the admin remains private and a security hardening window is scheduled; do not defer if the admin is publicly exposed to untrusted users.
- Advanced media transformations/orphan cleanup and pagination optimization, provided upload limits and monitoring are in place.
- Product analytics and richer notification preferences.

## Explicit answers to release questions

1. **Complete and preserve:** core Flutter/backend/admin surfaces, Cloudinary upload path, FCM/in-app notification persistence, subscription plan CRUD/realtime plumbing, server-side verification skeleton, and unique purchase records.
2. **Broken/missing:** permissive Google binding, acknowledgement handling, hard-coded admin credential, test OTP default, Apple notification test, current validation/tooling evidence, account deletion, target/deployment proof, and model migration decision.
3. **Fix first:** Phase 1 security and payment correctness.
4. **Minimum sequence:** Phase 1 → model decision/lifecycle → backend limits/config → mobile/admin validation → internal-track E2E → signed AAB.
5. **Defer:** iOS if out of scope, non-critical UX/analytics, and advanced media cleanup.
6. **Generate signed AAB:** after P0/P1 fixes, clean validation, signing identity check, target SDK evidence, and production-config review.
7. **Upload internal AAB:** after a reproducible signed AAB and backend/admin deployment match are recorded.
8. **Production proof:** Play-distributed install, full subscription lifecycle, restore/refund, notifications, account deletion, policy forms, monitoring, backup/rollback.
9. **External actions:** Play product/base-plan/track setup, license testers, Play App Signing/upload certificate, Google service-account permissions, Railway service mapping/variables, Cloudinary account, Resend/OTP live provider, Data safety/privacy URLs.
10. **Single next action:** implement Phase 1 strictly and add the negative account-binding/acknowledgement/startup tests before touching release artifacts.

