# HappiNotes — Account Deletion Contract and Implementation Plan

**Document date:** 2026-10-22
**Status:** Design only; not implemented
**Release verdict:** **BLOCKED**
**Related evidence:** [`owner-approval-record.md`](owner-approval-record.md), [`release-blocker-register.md`](release-blocker-register.md), and [`test-and-deployment-evidence.md`](test-and-deployment-evidence.md)

This document converts the repository findings into an implementation-ready contract for product, privacy/legal, backend, mobile, payments, and operations review. It does not authorize a database connection, deletion, migration, external-page launch, deployment, or Phase 2 work.

## 1. Confirmed repository findings

The following statements are based on local source inspection. “Proven” means the relationship is explicit in the source; “inferred” means the proposed treatment needs owner confirmation.

| Data or service | Current location and owner | References/dependencies | Proposed deletion treatment | Evidence status and risk |
|---|---|---|---|---|
| Account identity and credentials | `backend/src/models/User.ts`; `User` owns name, email, phone, password hash, role, language, flags, timestamps | Email and phone are sparse unique fields; `authenticate` loads the user by JWT id (`backend/src/middleware/auth.ts`) | After the workflow completes, delete or retain an approved minimal tombstone; remove credentials and direct identifiers | **Proven:** fields and uniqueness. **Inferred:** tombstone/retention policy. |
| Collection, favourites, embedded purchase list | `User.bookCollection`, `User.favourites`, `User.purchasedBooks` | ObjectId references to `Content`; purchase list is also affected by `StorePurchase` | Remove account-owned embedded values with the User record; do not delete shared `Content` | **Proven:** embedded references. **Inferred:** whether any historical purchase evidence must be retained. |
| Subscription snapshot | `User.subscription` | Mirrors a store entitlement and is updated by verified purchase/RTDN handlers | Remove direct account snapshot only after an approved ledger-retention decision; never treat deletion as store cancellation | **Proven:** snapshot fields. **Inferred:** retained pseudonymous linkage and support policy. |
| Phone/email OTPs | `backend/src/models/Otp.ts` | Keyed by normalized `identifier`, not `userId`; TTL on `expiresAt`; purposes include signup/login/reset-pin/email flows | Delete unused records for the account’s identifiers, with a narrowly defined identifier-reuse guard; expired records may remain subject to TTL | **Proven:** identifier-only relationship and TTL. **Inferred:** safe cleanup when an identifier is reused by a later account. |
| Password reset challenges | `backend/src/models/passwordResetToken.ts` | Explicit `userId`; TTL on `expiresAt` | Delete all records for the user | **Proven:** direct reference. |
| Sessions and refresh tokens | No session/refresh-token collection found | Access is a stateless JWT (`JWT_EXPIRES_IN`, default `7d`); Flutter stores it in secure storage | Add a revocation/version check or deletion-state check before issuing/accepting requests; clear local token | **Proven:** no server-side session store. **Inferred:** token-version design. |
| FCM/device registrations | `User.fcmTokens`; `/auth/me/fcm-token` routes | Registration removes the same token from other users; no separate device collection | Pull all embedded tokens; optionally revoke provider registrations only if an external provider contract requires it | **Proven:** embedded storage. **Inferred:** provider-side cleanup requirement. |
| One-time store purchases | `backend/src/models/StorePurchase.ts` | Unique `(store, transactionKey)`; `userId` and `bookId`; drives `User.purchasedBooks` | Do not blindly delete. Choose verified historical-purchase retention/anonymization or a documented grandfather policy; remove account linkage only if support/refund rules permit | **Proven:** schema/index. **Inferred:** retention and ownership policy. |
| Subscription purchase ledger | `backend/src/models/SubscriptionPurchase.ts` | Unique `(store, transactionKey)`; `userId`, product/plan, active/expiry state; RTDN updates existing claims | Preserve an opaque, access-restricted ledger record if needed for refunds, fraud, support, or reconciliation; otherwise pseudonymize only after approval | **Proven:** schema/index and lifecycle use. **Inferred:** legal/business retention. |
| Shared content/catalog and media | `Content`, `StoreProduct`, Cloudinary URLs (`backend/src/models/Content.ts`, `StoreProduct.ts`, `adminContentController.ts`) | Admin-owned content may be referenced by many users | Never delete shared content or Cloudinary assets as part of a user deletion | **Proven:** no user ownership field. |
| Global notifications | `backend/src/models/Notification.ts` | Target/book fields; no `userId` field | Retain as global catalog records; remove only if a separate retention policy requires it | **Proven:** no per-user reference. |
| Logs and audit trail | `console` logging throughout backend; no dedicated audit model found | Existing logs may contain operational identifiers; `emailService.ts` currently logs recipient addresses | Add a privacy-preserving deletion audit record; stop logging direct identifiers where not required | **Proven:** no dedicated audit collection. **Inferred:** retention/observability policy. |
| External providers | Google Play/App Store, Resend, Firebase/FCM, Cloudinary | Provider accounts are outside MongoDB and have independent contracts | Use provider-specific cancellation/revocation/deletion processes where supported; app-account deletion must not claim to cancel a store subscription automatically | **Proven:** integrations in source. **Inferred:** provider-side deletion/cancellation scope. |

No user-generated content collection or separate user-owned media collection was found. `Content` is admin/catalog data; this conclusion must be revisited if another service or data store is introduced.

## 2. Deletion policy decision table

These are safe defaults for review, not legal conclusions. No statutory retention period is asserted.

| Category | Safe default proposal | Decision required | Rationale/risk |
|---|---|---|---|
| Direct identity and password hash | Permanently delete after completion; retain only an opaque deletion/tombstone reference if required | Legal/privacy and product approve whether a tombstone is needed for abuse prevention or account recreation | Minimizes personal data; a tombstone prevents accidental reactivation without retaining the profile |
| OTP and reset material | Permanently delete active records for the account identifiers; rely on TTL for expired records | Backend/privacy confirm identifier-reuse guard and operational evidence | Removes authentication material; avoid deleting a newly created account’s OTP that happens to use the same identifier |
| FCM tokens | Permanently remove from the User document and invalidate local device association | Operations confirms whether Firebase-side cleanup is necessary | Prevents future pushes; no separate token collection was found |
| Collection and favourites | Permanently remove embedded references | Product confirms they are not needed for account recreation | These are account preferences, not shared content |
| One-time purchase ledger | **Pending:** retain pseudonymized record or grandfather verified access; do not delete by default | Product, payments, legal/privacy decide eligibility, refunds, fraud, and support requirements | Deleting can break valid ownership and refund evidence; retaining direct identity increases privacy exposure |
| Subscription purchase ledger | **Pending:** retain restricted pseudonymous financial/reconciliation record; clear account snapshot after access ends | Payments and legal/privacy approve fields, access controls, and retention | Account deletion does not cancel Play/App Store billing; blind deletion harms reconciliation and fraud controls |
| Shared content, store products, global notifications, Cloudinary media | Keep; do not treat as user data | Product confirms no hidden user-owned assets | These records are shared/admin-owned by current source evidence |
| Logs and deletion audit | Retain only minimum pseudonymous operational evidence with access controls; remove direct email/phone from routine logs | Legal/privacy and operations approve retention and redaction | Auditability is useful, but raw identifiers should not become a second profile store |
| Provider-side subscriptions | No automatic cancellation claim. Show Play/App Store management handoff and status consequences | Payments/product decide whether a separate cancellation helper is ever added | Store billing is controlled by the provider and may continue after app-account deletion |

The proposed user-facing contract is: deletion removes the HappiNotes account and account data covered by the approved policy; it does **not** cancel a store subscription. The user is shown the relevant store-management path before confirmation and told when premium access will end according to the store’s authoritative state.

### Timing and failure policy

- Prefer an asynchronous workflow. The request is accepted only after authorization and recent re-authentication, then moves through `requested → processing → completed` (or `failed` with a retryable class).
- Return the same neutral response for an already-deleted, pending, or unknown account where possible; do not create an email/phone enumeration oracle.
- Duplicate requests with the same idempotency key return the existing request status. Concurrent requests for the same user collapse to one active request under a unique user/state constraint.
- Mark the account `deletionPending` (or an equivalent state) before cleanup so new sign-ins, purchases, collection writes, FCM registration, and password resets are rejected or held. This state is a proposed contract, not an existing field.
- Do not claim MongoDB-wide atomicity. If the deployment is not confirmed to support transactions, use a durable job with per-collection checkpoints and idempotent operations. A retry resumes from the last checkpoint; unresolved provider or ledger work keeps the request incomplete.
- If a step fails, preserve only the minimum job metadata and expose a recoverable “deletion is still processing” or “try again/contact support” state. Never report success until all required steps and the approved ledger policy are complete.
- Recreation is a product decision. Safe default: block reuse of the identifier while a request is pending; after completion, allow a new account only under explicit policy and without restoring old entitlements automatically.

## 3. Proposed backend deletion contract (not implemented)

### Endpoints

1. `POST /auth/me/deletion-re-auth` — issue a one-time, short-lived deletion challenge after validating the authenticated account. For email accounts, use the existing email OTP delivery; for phone accounts, use the approved phone provider only if one exists. Do not return an OTP in production. Require a recent password/PIN or challenge response according to the approved policy.
2. `POST /auth/me/deletion-request` — authenticated request containing the one-time re-auth proof and an idempotency key. Validate that the proof belongs to the same user and has not been used. Create or return the existing `AccountDeletionRequest`.
3. `GET /auth/me/deletion-request/:requestId` — return status to the authenticated account or an opaque, separately authorized status token. Do not reveal whether another email/phone exists.

`DELETE /auth/me` may be offered as a thin alias only if the team wants REST semantics; it must use the same re-authentication, idempotency, and asynchronous state machine. The existing `DELETE /admin/users/:id` is not a self-service contract and must not be reused as one.

### Durable request record

Proposed `AccountDeletionRequest` fields: opaque request id; user id or a protected reference; status; idempotency key hash; requested/started/completed timestamps; workflow version; per-step checkpoints; retry count; redacted failure class; actor type; and a privacy-preserving audit reference. Do not store raw OTPs, bearer tokens, purchase tokens, or unnecessary email/phone values. Add a uniqueness rule for one active request per user and idempotency-key handling compatible with the actual Mongo deployment.

### Authorization and sequence

1. Validate the bearer JWT, load the user, reject blocked/deleted/pending states, and require recent re-authentication. A valid seven-day JWT alone is not sufficient for an irreversible action.
2. Atomically claim the user’s deletion state if the supported database operation allows it; otherwise use a compare-and-set update and treat duplicate-key/conflict results as “already pending.”
3. Disable new authentication, password reset, purchases, collection/favourite writes, and FCM registration for the pending account.
4. Revoke access: increment a proposed token-version/deletion marker checked by middleware, clear local Flutter credentials after the request is accepted, and invalidate any provider/device association that is in scope.
5. Delete active `Otp` records by the account’s normalized identifiers with a safe identifier-reuse guard; delete `PasswordResetToken` rows by `userId`.
6. Remove embedded collection, favourites, FCM tokens, and direct profile data. Do not delete `Content`, `StoreProduct`, or global `Notification` documents.
7. Apply the approved `StorePurchase` and `SubscriptionPurchase` policy. Preserve ownership/refund evidence where required, preferably with a pseudonymous user reference and restricted access. Never reassign a token or erase a ledger row solely because the app account was deleted.
8. Handle external subscription messaging: show the Play/App Store management path; do not call deletion “cancellation.” Any provider API action requires a separate approved design and controlled test.
9. Write a minimal completion/failure audit event and mark the request complete only when mandatory checkpoints succeed. A retry must be safe at every step.

### Observability and privacy

Use a request id, workflow version, step name, outcome, duration, and redacted error class. Hash or otherwise protect user references. Do not log email addresses, phone numbers, JWTs, OTPs, raw purchase tokens, service-account material, or Cloudinary secrets. Alert on repeated failures without exposing account identity.

## 4. Flutter experience (not implemented)

1. Add **Delete account** to Settings near Legal/Logout, with a clearly separated destructive action.
2. Explain consequences: account data removal, loss of app access, no automatic Play/App Store cancellation, and the store-management link. State that verified historical purchases are subject to the approved retention/grandfather policy.
3. Require identity confirmation/re-authentication appropriate to email or phone accounts; never make the final call from a preview or an unconfirmed dialog.
4. Show states: confirmation; re-authentication; request accepted/pending; completed (clear local token and return to signed-out landing); and recoverable failure with retry/support guidance. Keep the request id opaque and avoid displaying personal data in error text.
5. If a deletion request is pending, disable repeated destructive actions and show status on the next launch. Restore normal navigation only if the backend explicitly reports a retryable failure.
6. Support screen-reader labels, focus order, large text, localized consequences, and a non-color-only error indicator. Test email and phone paths independently.

## 5. External account-deletion resource (not implemented)

An externally accessible page is required by the product/privacy owner and store policy review, but no live URL exists in this repository. The owner must choose the domain, hosting, support mailbox, and deployment owner.

Minimum contract:

- Accept a deletion request using an account identifier without confirming whether it exists.
- Verify control with a short-lived email/phone challenge or an authenticated session; never accept an email address alone.
- Return a neutral acknowledgement and an opaque request/status reference. Do not expose account existence through timing, wording, or HTTP status differences.
- Show the same subscription-cancellation explanation and retention exceptions as the app.
- Permit status checks only with the opaque reference plus a fresh proof of control; rate-limit and audit attempts.
- Communicate completion/failure through the verified channel, without including secrets or raw purchase data.
- Add CSRF protection, secure cookies, anti-automation/rate limits, no-store headers for sensitive responses, accessibility, and localization.

The page must not be described as live or compliant until the owner has supplied the URL, security review, evidence of verification, and the corresponding store declaration.

## 6. Test matrix

Automated tests must use disposable fixtures and stubbed providers. They must not delete real accounts, send real OTPs, or create charges.

| Area | Unit tests | Integration/controlled tests | Acceptance evidence |
|---|---|---|---|
| Authorization | Missing/invalid JWT; blocked user; non-owner; expired/replayed re-auth proof; email and phone account variants | Authenticated request through the real route and middleware | Unauthorized requests receive the same safe error; no deletion occurs |
| Re-authentication | Recent-auth window, one-time use, wrong identifier, malformed proof, rate limits | Stubbed email/approved phone provider success, timeout, rejection, missing configuration | No false success; no OTP/token in response or logs |
| Idempotency/concurrency | Same key repeated; different keys same user; concurrent compare-and-set; already pending/completed | Parallel requests against a disposable Mongo instance | Exactly one durable request; no duplicate cleanup or contradictory status |
| Sessions | Token-version/deletion-state checks; local credential clear contract | Existing token after pending/completed state | Subsequent API calls are rejected; no refresh-token path remains usable |
| OTP/reset cleanup | Identifier-reuse guard; `PasswordResetToken` by user id; TTL-safe behavior | Snapshot fixtures with email and phone records | Only the target account’s records are removed |
| FCM | Embedded token cleanup; shared-token edge case; registration blocked while pending | Stub Firebase/device cleanup if approved | No future pushes to deleted account; no other user’s token removed accidentally |
| Purchases/entitlements | Store ledger retention policy; cross-user ownership; stale subscription; historical purchase handling | Disposable clone with Android/iOS ledger fixtures and provider stubs | No token reassignment; no accidental entitlement grant/revocation; policy evidence retained |
| Partial failure/retry | Fail each checkpoint; resume and idempotency; redacted error classes | Kill/restart worker on disposable environment | Retry converges to completion or a documented manual-review state |
| Audit/privacy | Required metadata only; no direct identifiers/secrets; access control | Review redacted logs and audit record | Reviewer confirms privacy-safe traceability |
| Flutter | Confirmation, re-auth, pending, completed, failure, offline, localization, accessibility | Stub backend responses; no real deletion | UI never performs irreversible action without confirmation and proof |
| External page | Enumeration resistance, CSRF, rate limit, challenge replay, no-store, status authorization | Controlled test domain and authorized recipient | Security review and redacted evidence; URL owner-approved |
| Store handoff | Message/link for Play and App Store; cancellation-before-expiry wording | License-tester only if separately approved | User is not told that app deletion cancels billing |

## 7. Approval and implementation gate

| Owner | Exact decision | Safe default proposal | Evidence required before code |
|---|---|---|---|
| Product | Immediate vs asynchronous deletion; account recreation; treatment of collection/favourites | Asynchronous, idempotent request; recreate only after completion and never restore access automatically | Signed product decision and acceptance copy |
| Legal/privacy | Data categories to delete, anonymize, or retain; audit/log limits; external page obligations | Delete direct identity; retain only minimum pseudonymous records that are explicitly justified | Approved retention matrix and privacy text |
| Backend/data | Request schema, transaction support, worker/queue, token-version strategy, identifier-reuse handling | Durable staged job with compare-and-set and per-step checkpoints | Architecture decision, disposable Mongo rehearsal, rollback evidence |
| Mobile | Settings UX, re-auth prompts, pending/retry behavior, localization/accessibility | Explicit confirmation + status screen + local token clear after acceptance | UX specification and Flutter integration tests |
| Payments | Ledger retention, grandfathered historical purchases, refund/support access, subscription handoff | Do not delete ledgers or revoke verified access until policy is signed; no automatic store cancellation | Product/payment policy and controlled purchase tests |
| Operations/DevOps | Worker monitoring, support escalation, external page hosting/domain, incident handling | Redacted request metrics and a manual-review queue for stuck jobs | Runbook, alerts, owner rota, approved domain/security review |

Implementation must not begin until these decisions are recorded in the owner approval process. The existing [`owner-approval-record.md`](owner-approval-record.md) remains the authorization boundary for external validation resources; this document does not grant access.

## 8. Smallest safe next implementation step

Obtain the signed product/legal/payments decisions for ledger retention, subscription messaging, recreation, and the external deletion resource. Then implement only the backend request state machine and tests in a disposable environment, before adding Flutter UI or any data-destructive worker. Keep the release **BLOCKED** until the route, cascade policy, external resource, and controlled tests have evidence.

No application source, database, external provider, production variable, deployment, release artifact, commit, or push was changed or used for this design task.
