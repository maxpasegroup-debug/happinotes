# HappiNotes security and payment audit

## Confirmed payment findings

### P0 — Google account binding is not strict

`backend/src/services/subscriptionPurchase.ts:27-30` treats a missing or non-string `obfuscatedExternalAccountId` as a match whenever an expected account exists. The subscription verifier then accepts the product line at lines 53-56. The mobile client supplies a deterministic account token, but a client-supplied token is not proof by itself; the Google response must contain the exact expected identifier.

**Impact:** a valid Play token that is not bound to the current HappiNotes account could be accepted by the verify endpoint. This threatens entitlement isolation and account switching.

**Required acceptance:** with expected account `A`, Google responses containing missing, empty, malformed, or account `B` identifiers must be rejected; only exact account `A` succeeds. Add tests for replay by another authenticated user and account switching.

### P1 — Google acknowledgement errors are swallowed

At `backend/src/services/subscriptionPurchase.ts:61-68`, every acknowledgement exception is ignored. An already-acknowledged response may be harmless, but timeouts, 401/403, rate limits, and server errors are not equivalent.

**Impact:** the service may persist active access without a successful acknowledgement, risking automatic refunds and an entitlement state that cannot be reconciled reliably.

**Required acceptance:** explicitly classify “already acknowledged” as success; hold/retry on transient errors; fail verification on authorization/configuration errors; never grant an initial entitlement merely because the acknowledgement request was attempted. Add retry/idempotency tests.

### P1 — Lifecycle coverage is incomplete

Google RTDN and Apple notification routes exist (`backend/src/routes/storeNotificationRoutes.ts`), but the Apple refund test currently fails after a 10-second wait (`6 passed, 1 failed`). The implementation must be tested for renewal, grace period, account hold, pause if enabled, cancellation, expiry, refund, revocation, duplicate/out-of-order events, and restore.

Google’s current testing guidance says license testers can use accelerated renewal/state transitions, and unacknowledged test purchases are refunded after a short test window. See [Google’s Billing test guide](https://developer.android.com/google/play/billing/test) and [subscription lifecycle documentation](https://developer.android.com/google/play/billing/lifecycle/subscriptions).

## Authentication and admin security

### P0 — Hard-coded admin bootstrap password

`backend/src/config/ensureAdmin.ts:4,17-37` contains a known default password and hard-coded primary email. The comment says it uses `process.env.ADMIN_EMAIL`, but the implementation ignores that variable and always uses `admin@happinotes.in`.

**Required:** bootstrap only from a one-time secret or a pre-created admin; remove the password literal; fail startup if an expected admin is absent; provide a controlled password rotation procedure; test database-reset behavior.

### P1 — Test OTP default is unsafe for production

`backend/src/config/env.ts:30` defaults `WHATSAPP_OTP_MODE` to `test`; phone OTP endpoints include `testOtp` when that mode is active (`authController.ts:297-323,358-369`). Production startup must require live mode and live provider configuration, and tests must verify no OTP appears in production responses.

### P2 — Admin JWT in localStorage

`happinotes-admin/app/admin/login/page.tsx:32` and the secure layout use `localStorage`. Any XSS in the admin origin can read and exfiltrate the token. A later hardening phase should use an HttpOnly, Secure, SameSite cookie/session, CSRF protection for state-changing requests, and a short admin token lifetime/rotation.

### P1 — Account deletion and privacy evidence absent

The app creates accounts but no authenticated self-service deletion endpoint/screen was found. Google Play requires both an in-app path and an external web resource for account deletion when an app permits account creation; associated data must be deleted, subject only to disclosed legal retention. See [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111).

`flutter_app/lib/src/screens/legal_screen.dart:12-30` contains short placeholder policy text and explicitly says it needs legal review. A public privacy URL, terms, subscription cancellation/refund language, Data safety answers, and data-retention policy are not verified.

## API and media security

- `backend/src/middleware/upload.ts:4-26` uses unbounded `multer.memoryStorage()` and MIME-prefix checks only. Add per-route byte/count limits, validate file signatures where practical, reject oversized files before buffering, and rate-limit uploads.
- `backend/src/app.ts:35-48` allows all `*.vercel.app`/`*.railway.app` origins. `backend/src/server.ts:39-44` sets Socket.IO CORS to `true` if no list is configured. Production should allow only the actual admin domain(s) and required mobile origins.
- Cloudinary credentials are loaded server-side (`backend/src/config/cloudinary.ts:3-19`); do not put them in Flutter or Next public variables. Current handlers use `secure_url`, which is good, but public delivery/access policy and orphan deletion are not audited.
- Error handling generally redacts provider errors, but logs still contain operational identifiers such as book IDs and token counts. Confirm that no request bodies, purchase tokens, JWTs, or service-account material reach Railway logs.

## Google Play policy/security gates

- The effective target SDK is delegated to Flutter and must be captured from the release artifact. Current Play policy says new apps and updates must target Android 16/API 36 or higher from 2026-08-31; see [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878).
- Android release artifacts must be signed with an upload key and enrolled in Play App Signing. Local ignored signing files exist, but certificate identity and Play Console enrollment were not verified. See [Android app signing](https://developer.android.com/studio/publish/app-signing).
- A Play license tester/internal-track build is not equivalent to production readiness. Test accounts, package identity, track opt-in, acknowledgement, renewal, refund, and non-license-tester behavior must be evidenced.

## Security acceptance order

1. Strict account binding and acknowledgement state machine.
2. Remove hard-coded admin credential and enforce live OTP mode.
3. Add account deletion and publish accurate legal/privacy documentation.
4. Add upload limits, CORS allowlist, rate limits, and startup configuration checks.
5. Execute adversarial and lifecycle tests before any production AAB decision.

