# HappiNotes — Account Deletion Engineering Review

**Review date:** 2026-10-22
**Status:** Design review only; implementation not started
**Release verdict:** **BLOCKED**
**Primary design:** [`account-deletion-contract.md`](account-deletion-contract.md)

This review checks the proposed deletion state machine against the repository as it exists today. It identifies integration points and testable contracts; it does not add an endpoint, worker, model, migration, retention rule, or entitlement change.

## 1. Confirmed architecture and integration points

| Concern | Current evidence | Required integration point for deletion |
|---|---|---|
| JWT authentication | `backend/src/controllers/authController.ts:158-165` signs `{ id }` with `JWT_EXPIRES_IN` (default `7d` in `backend/src/config/env.ts:65`). `backend/src/middleware/auth.ts:16-43` verifies the token, loads `User.findById`, and checks only existence and `blocked`. | Extend the authenticated-user contract with an approved deletion state/version check. Every protected route must use the same middleware or an explicit account-active guard. |
| Optional authentication | `backend/src/middleware/auth.ts:51-81` sets `req.user` when a token is valid but does not reject blocked/deleting users in the same way. | Ensure optional reads cannot expose a pending/deleted account or be used to bypass the deletion gate. |
| User state | `backend/src/models/User.ts:14-70` has identity, password hash, role, `bookCollection`, `purchasedBooks`, favourites, FCM tokens, subscription snapshot, and `blocked`; no `deletionState`, `deletedAt`, `authVersion`, or `lastReauthenticatedAt`. | Add only the state/version fields approved by product/security. Define how a tombstone differs from a live user and how unique email/phone fields are released. |
| Email/phone authentication | `backend/src/routes/authRoutes.ts:99-119` exposes signup/login/OTP/reset routes. Password/PIN verification is in `authController.ts`; `signToken` is shared by email and phone login. | Add a deletion-specific recent-auth proof. Do not reuse a general login challenge without binding it to the deletion intent, user, expiry, and one-time use. |
| OTP records | `backend/src/models/Otp.ts` stores an HMAC OTP keyed by `identifier` and purpose with TTL; it has no `userId`. `authController.ts:109-138,363-425` creates/consumes records. | Cleanup must use the exact normalized identifiers captured before deletion and guard against deleting a newer account’s OTP after identifier reuse. |
| Password reset records | `backend/src/models/passwordResetToken.ts` stores `userId`, hash, attempts, and TTL. | Delete by `userId` as an idempotent checkpoint before final account removal. |
| FCM | `authController.ts:68-104` removes a token from other users and adds/removes it on the current `User`; routes are `POST/DELETE /auth/me/fcm-token` (`authRoutes.ts:116-117`). | Block registration while pending and pull all embedded tokens during cleanup. Do not assume Firebase-side deletion is required without an approved provider contract. |
| Self-service account route | `authRoutes.ts` has `/me/fcm-token`, `/me`, and `/me` update only; no deletion route. | Add the proposed re-auth, request, and status routes under `/auth/me`, behind the same authentication and rate-limit conventions. |
| Admin deletion | `adminRoutes.ts:10-21,84` is protected by admin middleware; `adminController.ts:405-418` calls `User.findByIdAndDelete` only. | Do not reuse this as self-service deletion. Later, either route admin deletion through the same job or explicitly restrict it to a separately reviewed emergency workflow. |
| One-time ledger | `StorePurchase` has a unique `(store, transactionKey)` and `userId/bookId`; `/payments/store/verify` claims with `$setOnInsert` and updates `User.purchasedBooks` (`storePurchaseRoutes.ts:105-143`). | The deletion worker must apply the signed purchase-retention policy. Purchase verification must reject users in a pending/deleted state and must not race into a new claim. |
| Subscription ledger and snapshot | `SubscriptionPurchase` has unique `(store, transactionKey)` plus user/product/expiry state. `/subscription-verify` writes the ledger then calls `applySubscriptionEntitlement` (`storePurchaseRoutes.ts:29-91`). | RTDN and purchase verification must not restore a pending/deleted user. The ledger policy must define whether claims are pseudonymized or retained for support/refunds. |
| Entitlement ordering | `subscriptionEntitlement.ts:17-62` compares transaction/expiry state and performs an optimistic `User.updateOne`; it does not know a deletion state. | Add a deletion-state guard to entitlement writes in the later implementation, with an explicit policy for retained ledger records and no account recreation grant. |
| RTDN | `storeNotificationRoutes.ts:56-108` verifies Google push identity and authoritative state, then updates an existing claim and calls entitlement logic. Apple handling is in `:111-154`. | Add a rule that pending/deleted users cannot receive new entitlement writes; preserve provider acknowledgement/ledger evidence according to policy. Do not let notifications recreate a User. |
| Database topology | `backend/src/config/database.ts:3-15` calls `mongoose.connect(uri)` and logs the host. No replica-set, transaction, write-concern, or queue configuration is established in the repository. | Treat cross-collection atomicity as unavailable until DevOps confirms topology. Use a staged idempotent job; a Mongo transaction is an optional optimization only after controlled verification. |
| Flutter session | The mobile client stores the JWT in secure storage and logout removes it locally. Settings currently has Premium, Language, Legal, and Logout (`flutter_app/lib/src/screens/main_shell.dart:752-793`). | Add a Delete account entry, status handling, re-auth UI, and local token clearing only after the backend accepts the request. |

The current `authenticate` middleware already performs a database lookup on each protected request, which makes a deletion-state check feasible without a cache. It does not, however, invalidate an already-issued token after logout or deletion; a missing user is rejected only after the document is removed.

## 2. Proposed API and state-machine contract

The following is a concrete proposal, not an implemented API.

### 2.1 States

`requested` → `processing` → `completed`

`processing` may move to `failed_retryable` or `failed_manual`; a retry returns to `processing`. `completed` and `failed_manual` are terminal for that request. A separate `cancelled` state should only be added if product explicitly allows cancellation before irreversible cleanup.

The User should be marked `deletionPending` before cleanup. A completed deletion should be represented by removal or an approved tombstone, not by leaving a normal active User with a hidden flag.

### 2.2 Proposed endpoints

#### `POST /auth/me/deletion-re-auth`

Requires a valid bearer token and a rate limit. Request shape:

```json
{ "method": "password" }
```

or an approved email/phone challenge method. Response contains only an opaque, short-lived proof identifier; never the OTP or secret. The proof record must bind to `userId`, intent `account-deletion`, method, expiry, attempt count, and a one-time-used marker. A phone method is blocked unless a real approved phone provider exists; the current repository deliberately fails phone delivery outside test mode (`authController.ts:25-33`).

#### `POST /auth/me/deletion-request`

Requires the current bearer token, an unexpired unused deletion proof, and an idempotency key. Suggested request:

```json
{ "proof": "opaque-proof", "idempotencyKey": "client-generated-unique-value" }
```

Suggested `202 Accepted` response:

```json
{
  "success": true,
  "requestId": "opaque-request-id",
  "status": "requested"
}
```

The service must hash or otherwise protect the idempotency key, return the existing request for a replay of the same key, and collapse concurrent active requests for the same user. Do not echo email, phone, JWT, purchase token, or internal Mongo identifiers.

#### `GET /auth/me/deletion-request/:requestId`

Requires the same authenticated user or a separately authorized opaque status proof. Response exposes only `requested`, `processing`, `completed`, `failed_retryable`, or `failed_manual`, plus a retry-safe message and timestamps that do not reveal sensitive data. Unknown or unauthorized request IDs should not disclose another account’s existence.

`DELETE /auth/me` can be a thin alias only if the team wants DELETE semantics; it must delegate to the same proof, idempotency, and asynchronous workflow.

### 2.3 Durable request record

Proposed `AccountDeletionRequest` fields:

- opaque request id and protected user reference;
- status, workflow version, idempotency-key hash;
- requested/started/completed timestamps;
- per-step checkpoints and retry count;
- redacted failure class and actor type;
- minimal audit reference.

Do not store raw OTPs, bearer tokens, purchase tokens, service-account material, or unnecessary direct identifiers. Enforce one active request per user and deterministic replay of the same idempotency key. The exact unique indexes depend on the chosen schema and Mongo topology.

### 2.4 Authorization rules

1. Require `authenticate`; reject blocked, already-deleted, and completed accounts.
2. Require recent re-authentication bound to the deletion intent. A valid seven-day JWT alone is insufficient.
3. Mark the User pending with compare-and-set semantics before scheduling cleanup.
4. Once pending, reject new login, password-reset completion, purchase verification, collection/favourite writes, and FCM registration for that account. Reads may return only a deletion-pending response.
5. Do not use a client `restore` flag, email/phone lookup, or admin identity as self-service authorization.

## 3. JWT invalidation strategy

### Current behavior

`signToken` emits only `{ id }` and an expiry. `authenticate` verifies the signature, loads the User by id, and checks `blocked`; it does not compare a token version, issue time, or deletion state. Flutter logout removes only its local token. Therefore, an already-issued JWT remains usable until expiry unless the User is missing or middleware gains a new rejection condition.

### Option A — deletion-state check (recommended minimum)

Add a `deletionState`/`deletedAt` field and make `authenticate` reject `pending`, `completed`, or tombstone users after the existing `User.findById` lookup. Because all protected routes should pass through this middleware, a state flip immediately invalidates existing JWTs without changing token claims.

**Advantages:** smallest token migration; uses an existing per-request database read; invalidates all existing tokens at the point the state changes.
**Costs:** every protected request still depends on the User lookup; any route that bypasses `authenticate` or uses `optionalAuthenticate` must be reviewed; a race remains for a request already admitted before the state flip.

### Option B — security version in the JWT

Add `authVersion` (or `securityVersion`) to User, include it in every new token, and compare the claim in `authenticate`. Increment it when deletion begins and reject mismatches. Existing tokens without the claim must be rejected or treated according to an explicit migration policy; accepting missing claims would leave old tokens valid.

**Advantages:** supports general credential/session revocation.
**Costs:** changes signup/login and every token issuer; requires a database read or trusted cache on every request; needs a rollout that deliberately expires legacy tokens; does not remove the need for a deletion-state check while the job runs.

### Option C — denylist

Not recommended as the primary design. A denylist adds storage, cleanup, race, and privacy complexity and is unnecessary while middleware already loads User. It could be reserved for exceptional token compromise handling with a bounded TTL.

**Decision:** engineering may implement Option A as the minimum deletion gate. Product/security must approve whether Option B becomes the long-term session-revocation standard and whether old tokens are forcibly invalidated.

## 4. Cleanup dependency graph and recovery model

```text
recent re-auth + idempotency
            |
            v
mark User deletionPending (CAS) ----> reject new auth/purchase/write paths
            |
            +--> delete active OTPs (identifier guarded)
            +--> delete PasswordResetToken rows (userId)
            +--> pull FCM tokens and embedded preferences
            +--> apply approved StorePurchase policy
            +--> apply approved SubscriptionPurchase policy
            +--> write redacted completion/failure audit event
            |
            v
finalize User removal or approved tombstone
```

The graph is intentionally staged. `StorePurchase`, `SubscriptionPurchase`, and `User` are separate collections, and `database.ts` does not prove a replica set or transaction support. A deletion worker must therefore persist a checkpoint after each idempotent step and resume after process loss.

### Required race protections

- **Purchase verification versus deletion:** set pending before cleanup and have `/payments/store/verify`, `/subscription-verify`, and test purchase routes reject pending users. A verification that began earlier must not create a new claim after the pending marker wins.
- **RTDN versus deletion:** notification handlers may update an existing ledger claim only when the account is still eligible. They must not recreate a User or re-grant a retained claim to a newly created account.
- **FCM registration versus cleanup:** the pending check must cover both registration and cleanup; otherwise a token can be re-added after it was pulled.
- **OTP identifier reuse:** capture the account’s normalized identifiers and require the cleanup query to match the intended account generation/ownership guard. Since `Otp` has no `userId`, a plain `deleteMany({ identifier })` is unsafe after reuse.
- **Admin deletion versus self-service:** the existing direct `findByIdAndDelete` can race with the worker and bypass ledger cleanup. It must be placed behind the same reviewed workflow or explicitly isolated before implementation is enabled.

### Failure examples and recovery

| Failure point | Unsafe result | Required recovery |
|---|---|---|
| Request creation before pending marker | Duplicate jobs or a second request | Unique active-request constraint and compare-and-set; same idempotency key returns the original request |
| Pending marker succeeds, OTP cleanup fails | Account is blocked but secrets remain temporarily | Retry from the OTP checkpoint; expose `processing`, not success |
| Ledger policy step fails | User could be removed while refund/ownership evidence is unresolved | Keep the User pending; retry or route to manual review |
| Worker dies after FCM cleanup | Partial cleanup | Checkpoint makes the next run skip completed steps and continue |
| User is deleted before final audit | No trace of completion or support evidence | Write minimal completion audit before final removal, or retain an approved tombstone |
| RTDN arrives after account removal | Notification could throw or recreate access | Treat missing/deleted claim as a no-op with redacted telemetry; never create a User |
| Retry after completion | Duplicate destructive operations | Terminal status and idempotent deletes return completed |

Operational visibility should use request id, workflow version, step, outcome, duration, retry count, and redacted failure class. Alerts must not include email, phone, JWT, OTP, raw purchase token, or service-account data.

## 5. Purchase and entitlement integrity

The current purchase paths use a unique transaction key and ownership checks, but entitlement updates are separate writes:

- one-time verification claims `StorePurchase`, then updates `User.purchasedBooks` (`storePurchaseRoutes.ts:122-140`);
- subscription verification claims/updates `SubscriptionPurchase`, then calls `applySubscriptionEntitlement` (`storePurchaseRoutes.ts:61-80`);
- RTDN updates an existing claim and calls the same entitlement helper (`storeNotificationRoutes.ts:77-88`).

Deletion must not remove a ledger merely to make the User disappear. The payments owner must decide whether a retained record is linked to an opaque tombstone, whether verified historical access is grandfathered, and how refunds/support work. Until then:

1. Keep the ledger policy step as a hard completion gate.
2. Do not allow a pending/deleted account to initiate new claims.
3. Do not let a later account with the same email/phone inherit a prior transaction key.
4. Prevent RTDN or a stale verification from writing `User.subscription` after finalization.
5. Preserve existing lifecycle ordering in `subscriptionEntitlement.ts`; deletion is an additional eligibility gate, not a replacement for provider-state checks.

## 6. Failure-injection and concurrency test plan

All automated tests use disposable fixtures and provider stubs. No real account, database, OTP, purchase, or provider is used.

### Unit tests

- Re-auth proof is bound to user, intent, expiry, method, and one-time use.
- Missing, malformed, expired, replayed, and wrong-user proofs fail without account changes.
- Idempotency-key hashing and active-request state transitions are deterministic.
- `authenticate` rejects pending/completed/tombstone users and mismatched security versions if Option B is selected.
- OTP cleanup cannot remove a newer account’s record sharing an identifier.
- Each cleanup checkpoint is idempotent; terminal completion cannot run destructive steps again.
- Ledger-policy adapter never reassigns a transaction or creates a new claim.
- Audit records contain only allowlisted fields and redacted failure classes.

### Route/integration tests

- Email and phone account paths, including phone-provider-unavailable behavior.
- Unauthorized user, blocked user, malformed request, duplicate request, and concurrent requests.
- Existing JWT before pending marker, during processing, after completion, and after an approved tombstone.
- Password reset, FCM registration, collection/favourite writes, one-time purchase, subscription verification, and RTDN during pending state.
- Same-user retry after a worker interruption; different user using the same idempotency key; unknown request/status id.
- Admin deletion route cannot bypass the reviewed workflow once the implementation is introduced.

### Failure-injection tests

Inject a failure after each checkpoint, restart the worker, and verify convergence. Include Mongo duplicate-key/conflict, timeout, process crash, provider failure, stale claim, missing User, and audit-write failure. Confirm that a failure never returns success, never leaves a new account with old entitlement, and never logs secret material.

### Controlled non-production tests

Only after owner approvals: disposable Mongo clone, approved Google/Apple license test products, controlled Resend recipient, and reviewed external deletion page. Capture redacted request ids, statuses, counts, and timestamps only.

## 7. Engineering choices versus owner decisions

### Safe for engineering after approval of the contract

- Add request/proof models and route validation.
- Use the existing `authenticate` lookup plus a deletion-state guard.
- Implement compare-and-set state transitions, idempotency hashes, checkpoints, bounded retries, and redacted telemetry.
- Add tests with disposable fixtures and stubs.
- Add middleware checks to purchase, collection, favourites, FCM, reset, and login paths.

### Requires explicit owner decision

- Delete versus pseudonymize versus retain each purchase/entitlement field.
- Grandfathered historical one-time purchases and account recreation.
- Whether deletion is cancellable before finalization.
- Recent-authentication factors and the phone OTP provider requirement.
- Whether to add a general security-version mechanism or use deletion-state invalidation only.
- Store subscription messaging and any future provider cancellation helper.
- Audit-log retention, support access, legal exceptions, and external deletion-page domain/hosting.
- Worker infrastructure, retry limits, manual-review ownership, and incident escalation.

## 8. Smallest safe implementation sequence

1. Obtain signed product, legal/privacy, payments, backend/data, mobile, and operations decisions recorded through `owner-approval-record.md`.
2. Confirm the non-production Mongo topology and create disposable fixtures; do not use deployed data.
3. Add only the request/proof schema, deletion-state guard, and route-level authorization tests.
4. Add the staged worker with checkpointed cleanup and failure-injection tests; keep purchase ledger treatment behind the approved policy adapter.
5. Add route guards to all write and entitlement paths, then run concurrency/restart tests.
6. Add Flutter UI and external-page implementation only after backend behavior and copy are approved.
7. Reassess the release blocker register with observed evidence. Keep the release **BLOCKED** until the deletion workflow, external resource, retention policy, and controlled tests are accepted.

No source code, database, provider, production variable, deployment, release artifact, commit, or push was changed or used for this review.
