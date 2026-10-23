# Release blocker register

Priorities: P0 critical security/data-loss/entitlement compromise; P1 mandatory production readiness; P2 important quality/reliability; P3 optional post-launch.

| ID | Priority | Finding and evidence | Impact | Required acceptance / gate | Confidence |
|---|---|---|---|---|---|
| PAY-001 | P0 | Google subscription `accountMatches` accepts missing/non-string external account identifiers (`backend/src/services/subscriptionPurchase.ts:27-30,53-56`). | Cross-account premium entitlement risk. | Exact expected token required; missing/malformed/mismatched values rejected; replay/account-switch tests pass. Blocks internal and production. | Confirmed |
| AUTH-001 | P0 | Known admin password literal and hard-coded email (`backend/src/config/ensureAdmin.ts:4-5,17-37`). | Account takeover after DB reset or accidental user exposure. | No password in source; one-time/secret bootstrap; rotation and reset tests pass. Blocks production; strongly blocks internal if admin is exposed. | Confirmed |
| PAY-002 | P1 | Google acknowledgement catch ignores every error (`subscriptionPurchase.ts:61-65`). | Unacknowledged purchases can be refunded; entitlement state diverges. | Already-acknowledged is explicitly handled; transient errors retry; fatal errors do not grant initial access. Blocks internal/production billing gate. | Confirmed |
| PAY-003 | P1 | Apple notification refund test fails (6 pass/1 fail; `test/storeNotifications.test.cjs:88-103`). | Refund/revocation lifecycle is not certified. | Test returns 204 and removes access using current verified transaction; duplicate/out-of-order tests pass. Blocks production. | Confirmed |
| QA-001 | P1 | Current Flutter test/analyze commands hang and were interrupted. | Mobile behavior and compile quality are unverified. | Clean test/analyze run with captured counts in CI or clean local environment. Blocks AAB. | Confirmed environment blocker |
| QA-002 | P1 | Admin build compiles then fails `spawn EPERM`; admin lint misses `esutils`. | Admin deployability is unverified. | Controlled dependency repair and build/lint pass; no source workaround that hides errors. Blocks admin deployment evidence. | Confirmed environment blocker |
| COMM-001 | P1 | Legacy individual-book fields/routes/worker remain while admin/mobile describe subscriptions (`Content.priceInr`, `StorePurchase`, `storeProductProvisioning`, `book_purchase_screen.dart`). | Confusing commercial behavior and migration/entitlement risk. | Product owner decision; grandfather/migrate historical records; subscription-only UI/routes documented and tested. Blocks production model gate. | Confirmed |
| AUTH-002 | P1 | `WHATSAPP_OTP_MODE` defaults to `test` and may return `testOtp` (`env.ts:30`, `authController.ts:297-323`). | OTP bypass/account takeover if production variable is missing. | Production startup rejects test mode; live provider smoke test; no OTP in response. Blocks production. | Confirmed |
| POLICY-001 | P1 | No user account deletion route/screen/web resource found. | Google Play account-deletion policy non-compliance. | In-app deletion or link plus external deletion web resource, data cleanup/retention evidence, Play form completed. Blocks production. | Confirmed |
| RELEASE-001 | P1 | Effective target SDK is delegated to Flutter; no release artifact evidence. | Play submission/discoverability risk. | Capture target API >= required level in release artifact and Play pre-launch checks. Blocks AAB upload. | Unverified |
| DEPLOY-001 | P1 | Active Railway deployment and admin service mapping do not match audited SHA by evidence. | Tests may target code different from production. | Record Railway service, root, commit SHA, health response, and environment names. Blocks internal/production certification. | Unverified |
| MEDIA-001 | P2 | Multer memory storage has no size/count limits (`backend/src/middleware/upload.ts:4-26`). | Memory exhaustion and upload abuse. | Byte/count limits, type validation, rate limits, rejected oversized-file tests. | Confirmed |
| API-001 | P2 | CORS allows broad hosted subdomains; Socket.IO defaults to all origins (`app.ts:35-48`, `server.ts:39-44`). | Increased cross-origin attack surface. | Explicit production allowlist and CORS tests. | Confirmed |
| ADMIN-001 | P2 | Admin JWT is stored in `localStorage` (`happinotes-admin/app/admin/login/page.tsx:32`). | XSS can steal admin token. | HttpOnly cookie/session and CSRF protection. | Confirmed |
| IOS-001 | P1 if iOS is in launch scope; P3 otherwise | FlutterFire options only configure Android; no iOS plist. | iOS FCM/push and release flow unavailable. | Decide scope; if iOS, configure Firebase/APNs/signing and real device test. | Confirmed |
| DOC-001 | P2 | `AUDIT_REPORT.md`, `IN_APP_PURCHASE_SETUP.md`, and backend docs contain stale/contradictory purchase architecture. | Operational mistakes and incorrect release decisions. | Replace/annotate current docs after model decision; link this audit. | Confirmed |

## Deduplication notes

- PAY-001 and PAY-002 are separate: the first is entitlement isolation; the second is purchase lifecycle/acknowledgement.
- QA-001 and QA-002 are environment/tooling blockers, not claims that the source is definitely broken. They still block evidence-based release certification.
- COMM-001 covers model migration; individual concrete security defects remain in PAY-001/PAY-002.

## Current Phase 1 remaining-gate status (2026-10-22)

This dated section is the current release-gate disposition. The original
register above is retained as historical audit evidence. No production service,
database, environment variable, secret, deployment, or release artifact was
changed during this review.

| Gate / finding | Status | Evidence and remaining uncertainty | Owner action / acceptance criterion |
|---|---|---|---|
| PAY-001 — account binding and cross-user token reuse | PASS (unit/bounded evidence); external pending | Strict account binding, same-user restore policy, ownership checks, hashed token uniqueness, and route-level replay tests pass in the 99-test bounded run. No Google license-tester evidence is available. | Payments owner runs the controlled Play procedure below. Accept when Play state, account binding, restore, and cross-user rejection are evidenced without exposing tokens. |
| PAY-002 — acknowledgement | PASS (unit/bounded evidence); external pending | Success, already-acknowledged, transient, permanent, misleading-error, and retry cases are covered; entitlement is not granted on unclassified failure. | Payments owner verifies one real license-tester purchase and retry/idempotency behavior. |
| PAY-003 — lifecycle and RTDN | PASS (unit/bounded evidence); external pending | Grace, hold, pause, pending, expiry, cancellation-before-expiry, renewal ordering, revocation/refund mapping, duplicate RTDN, and stale-event protection pass. RTDN requires authenticated Pub/Sub, authoritative Play lookup, and an existing same-owner ledger claim. | Payments owner supplies sandbox/RTDN evidence for each state and confirms policy against current Google Play behavior. |
| AUTH-001 — administrator bootstrap | PASS (unit/static evidence); first-bootstrap procedure pending | No hard-coded credential remains; existing admin is unchanged; existing non-admin matching `ADMIN_EMAIL` fails closed; missing/invalid configuration is safe; repeated/concurrent cases are tested. | Auth owner performs a one-time bootstrap in an approved non-production environment using an out-of-band secret, then records only success/failure and audit metadata. |
| AUTH-002 — OTP configuration/delivery | UNIT PASS; LIVE DELIVERY PENDING | Production rejects test phone mode; email uses Resend and delivery failures propagate. No real Resend delivery was performed. No WhatsApp/SMS provider exists in this repository. | Auth/ops owner authorizes one test recipient and verifies Resend delivery, failure, expiry, rate/attempt limits, and one-time use. Phone OTP remains disabled or requires a separately approved provider. |
| QA-001 — Flutter analyzer/tests | BLOCKED | Local analyzer/test attempts produced no counts before timeout; four `dart.exe` and one `dartvm.exe` process were observed, but their command lines were inaccessible and none were terminated. | Mobile owner runs pinned Flutter checks on a clean CI runner with bounded timeouts and records command, exit code, duration, diagnostics, and test count. |
| QA-002 — admin build/lint | BLOCKED | Lockfile-based `npm ci --ignore-scripts` repaired the missing `esutils` file; TypeScript and ESLint now pass (0 errors, 18 image-optimization warnings). `next build` still fails in its TypeScript worker with Windows `spawn EPERM`. | Admin/DevEx owner validates the production build on a clean runner and records login/role/plan-price smoke evidence. |
| COMM-001 — subscription-only versus legacy products | BLOCKED / OWNER DECISION | Legacy price/purchase/provisioning code remains while the product direction is subscription-only. Historical entitlement continuity is not yet documented. | Product/backend owner chooses grandfather, migrate, or retire policy; inventory legacy records and test the chosen policy before release. |
| POLICY-001 — account deletion | BLOCKED / CONFIRMED GAP | Local inspection confirms signup exists, but there is no authenticated self-service deletion route or Flutter action; only admin `DELETE /admin/users/:id` performs a single-document delete. No cascade, retry/audit behavior, or external deletion resource was found. | Product/legal/backend owner approves retention and store-subscription handling, then implements/tests the complete in-app and external deletion paths. |
| RELEASE-001 — Android target SDK | OPEN / NOT PROVEN | `compileSdk = 37`, while `targetSdk = flutter.targetSdkVersion`; no generated release manifest or APK/AAB exists in the checkout. | Mobile/release owner captures the effective manifest target API on an approved clean runner and records Play-policy evidence. |
| DEPLOY-001 — Railway mapping | OPEN / OWNER CONFIRMATION REQUIRED | Repository verifies backend build/start/health configuration and infers service roots, but domains, environment, deployed health response, and commit mapping are not present locally. | DevOps owner confirms actual backend/admin services, roots, domains, environment, health response, and deployed commit SHA. |
| MEDIA-001 / API-001 / ADMIN-001 / IOS-001 / DOC-001 | OPEN (outside this gate closure) | Original audit findings remain unchanged and were not silently treated as fixed by Phase 1. | Assigned owners close each original acceptance criterion or formally defer it with launch-scope approval. |

### Gate 1: safe offline legacy-token inventory and migration rehearsal

This procedure is read-only until an owner approves a disposable, non-production
snapshot. It must never connect to a deployed Railway MongoDB instance.

1. Export schema/index metadata and a redacted ledger inventory from an
   owner-approved snapshot. Record counts, store, transaction-key shape, owner
   user ID hash, product ID, expiry/state, and timestamps; do not export raw
   purchase tokens into tickets or chat.
2. Classify keys as canonical SHA-256, candidate raw token, ambiguous 64-hex,
   duplicate same-owner, or cross-owner conflict. Use the offline planner only;
   do not infer ownership from a client `restore` flag.
3. For candidate raw tokens, perform Google verification with an authorized
   non-production credential and record only a token fingerprint, package,
   product, state, expiry, and verification timestamp. Unverified or ambiguous
   values stay manual-review items.
4. Rehearse the idempotent plan against a disposable clone. Check the
   `(store, transactionKey)` unique index before applying it; stop on any
   cross-owner/product conflict. Same-owner duplicates require an explicit
   merge record preserving the existing owner and entitlement history.
5. Capture a before/after row-count and ownership report, planner version/hash,
   operator, timestamp, and approval. Define rollback as restoring the snapshot
   or reversing only the staged clone transaction; no production rollback is
   authorized by this document.

Acceptance requires owner sign-off, clean disposable-clone rehearsal, no
unresolved cross-owner conflict, verified uniqueness, and an auditable rollback
plan. The current repository evidence is insufficient to assert that deployed
records are compatible, so this gate remains BLOCKED.

### Gate 2: controlled Google Play license-tester and RTDN procedure

Required prerequisites are an authorized Play Console owner, a license-tester
account, an internal/closed testing build with the subscription base plans
active, package/product IDs, non-production backend configuration, and a
controlled Pub/Sub/RTDN endpoint. Do not place purchase tokens or service
account JSON in evidence.

For each scenario, record the tester alias (not a personal email), app version,
product/base-plan ID, UTC timestamp, device/OS, HTTP result, token fingerprint,
authoritative Play state, acknowledgement state, expiry, and entitlement result:

1. Purchase monthly and yearly plans; verify backend Play lookup, strict account
   binding, acknowledgement, and entitlement only after verification.
2. Restore after reinstall with the same account; verify explicit same-user
   restoration. Repeat with a different app account and confirm rejection.
3. Retry acknowledgement after a transient failure and after an already
   acknowledged response; confirm idempotent success only for the documented
   already-acknowledged case.
4. Cancel before expiry, renew, enter grace, account hold, pause, expire, and
   refund/revoke. Confirm entitlement follows authoritative state and timestamps.
5. Deliver duplicate and out-of-order RTDN events. Confirm each event causes a
   fresh Play lookup, cannot create or transfer a ledger claim, and leaves the
   newest valid entitlement intact.

No external sandbox/license-tester/RTDN execution was available in this review;
these checks are PENDING, not passed. Google documents that grace can retain
access, account hold and pause remove access, cancellation before expiry retains
benefits until expiry, and RTDN should trigger a fresh state lookup:
<https://developer.android.com/google/play/billing/lifecycle/subscriptions>.

### Gate 3: controlled Resend email-OTP procedure

An owner must authorize one test recipient and a non-production or explicitly
controlled live Resend configuration. Run one successful email request and
capture only provider status/message ID and timestamps, never the OTP or API
key. Verify that missing configuration, timeout, provider rejection, expired
code, excessive attempts, replay, and rate-limit responses fail safely and do
not authenticate the user. Automated tests must continue to use stubs and send
no real messages. Phone OTP is not live-capable in this repository and remains
disabled in production unless a separately approved provider is implemented.

### Phase 1 recommendation

**ACCEPT WITH CONDITIONS for the remediation package only; do not approve a
production release and do not begin Phase 2.** The critical conditions are the
non-production ledger compatibility rehearsal, controlled Google Play external
validation, authorized Resend delivery evidence, clean Flutter/CI evidence, and
closure or explicit owner approval for the remaining account-deletion,
target-SDK, Railway mapping, admin build/lint, and commercial-model blockers.

## Latest validation addendum (2026-10-22)

The latest bounded evidence is recorded in
`test-and-deployment-evidence.md`. The disposition below is intentionally
conservative: local/unit evidence is not substituted for external or release
evidence.

| Priority | Current blocker | Exact exit criterion | Owner/dependency |
|---|---|---|---|
| P1 | Legacy ledger compatibility | Owner-approved non-production snapshot, redacted inventory, Google verification of raw-token candidates, collision/unique-index report, disposable-clone rehearsal, and rollback record. | Backend/data owner; no deployed MongoDB access until approval. |
| P1 | Google Play external lifecycle | License-tester purchase/restore/cross-user rejection, acknowledgement retry, renewal, cancellation, grace/hold/pause/expiry/refund, duplicate/out-of-order RTDN evidence. | Payments owner and Play Console/RTDN authorization. |
| P1 | Resend live delivery | One authorized test recipient receives an OTP; provider success/failure, expiry, attempts, replay, and rate-limit behavior are recorded without OTP/API-key exposure. | Auth/ops owner; phone OTP stays disabled without a real provider. |
| P1 | Flutter validation | Pinned clean CI runner reports independent `flutter analyze --no-pub` and `flutter test --no-pub` exit codes, durations, diagnostics, and test counts. | Mobile owner; local Dart processes are not to be terminated by this review. |
| P1 | Node/admin CI | Backend `npm test` now passes through the platform-specific serial wrapper (99/99); the original worker-isolation diagnostic still reproduces `spawn EPERM`. Admin TypeScript and ESLint pass after lockfile repair (0 errors, 18 image warnings), but `next build` still fails its TypeScript worker with `spawn EPERM`. | DevEx/admin owner; validate the admin build on a clean runner and record smoke evidence; do not suppress tests or lint. |
| P1 | Account deletion | Authenticated in-app deletion and external web deletion resource, retention policy, cleanup test, and Play declaration evidence. | Product/backend/legal owner. |
| P1 | Android target SDK | Release manifest proves target API 36+ for the current 2026 new-app/update policy; capture artifact and Play pre-launch evidence. | Mobile/release owner. |
| P1 | Railway mapping | Record backend/admin service names, roots, build/start commands, domains, health response, environment, and deployed commit SHA. | DevOps owner; no variable values in evidence. |
| P1 | Subscription-only model | Product owner signs grandfather/migrate/retire decision for legacy individual purchases and historical entitlements. | Product/backend owner. |

Until the P1 rows above have measurable evidence, the final disposition is
**PASS WITH CONDITIONS for review only**, not production approval. Phase 2 is
not authorized.

## Owner-approval package for external validation

Do not place passwords, API keys, service-account JSON, purchase tokens, OTPs,
or personal recipient data in chat, tickets, or audit files. Each owner should
approve only the minimum access needed and provide redacted evidence.

| Checklist item | Purpose and risk | Required access/approval | Evidence to capture | Exit criterion |
|---|---|---|---|---|
| Sanitized MongoDB snapshot | Establish whether legacy ledgers contain raw tokens without touching shared data. Risk: exposing customer or payment data. | Backend/data owner approval; snapshot must be sanitized and non-production. | Snapshot ID, creation time, collection/index metadata, row counts, and isolation confirmation; no raw tokens. | Data owner signs that the clone is disposable and isolated. |
| Disposable clone and rehearsal | Test duplicate/collision handling and rollback safely. Risk: accidental writes to a shared database. | Backend/data owner plus operator approval; isolated credentials supplied out-of-band. | Clone connection identity (non-secret), unique-index report, planner version, before/after counts, rollback rehearsal. | Rehearsal is repeatable, idempotent, and rollback is demonstrated. |
| Read-only ledger inventory | Classify canonical, raw-token candidate, ambiguous, duplicate, and conflict records. Risk: misclassification or ownership transfer. | Explicit read-only approval from the data owner. | Redacted record IDs, key shape, user-ID fingerprints, product IDs, expiry/state, and classification counts. | No unresolved cross-owner/product conflict; reviewer signs inventory. |
| Google Play license tester/products | Validate purchase, restore, acknowledgement, lifecycle, and ownership behavior. Risk: real charges or production entitlement changes. | Play Console owner authorizes a license tester, test products/base plans, package, and non-production backend. | Tester alias, product/base plan, app version, timestamps, state/expiry/acknowledgement, token fingerprint only. | All listed scenarios pass in the controlled environment. |
| Play API and RTDN test setup | Validate authoritative state refresh and notification ownership. Risk: accepting forged or misrouted notifications. | Play/API owner authorizes the service account, Pub/Sub topic/subscription, push identity, and audience/email configuration out-of-band. | Redacted HTTP status, notification type/time, Play state, ledger owner fingerprint, and idempotency result. | Duplicate/out-of-order events update only an existing matching claim. |
| Resend test recipient | Verify real email delivery and failure handling. Risk: unsolicited messages or exposing OTPs. | Auth/ops owner explicitly authorizes one test recipient and a controlled Resend configuration. | Provider status/message ID, timestamps, delivery/failure class; never OTP or API key. | Delivery, timeout, rejection, expiry, replay, and rate-limit cases are recorded. |
| Test approver/reviewer | Ensure evidence is independently accepted. Risk: unreviewed external results being treated as release proof. | Name/role of one operator and one reviewer for each workstream. | Approval record with scope, environment, date, and redacted evidence references. | Reviewer signs the gate disposition; no production approval is implied. |

### Safe execution order

1. Owners approve the scope and disposable resources above.
2. Operators verify isolation and record the non-production environment identity.
3. Run the read-only inventory and planner rehearsal before any staged write.
4. Run Play license-tester and RTDN scenarios against the non-production backend.
5. Run the controlled Resend delivery check.
6. Reviewer compares evidence with the exit criteria and updates the gate
   status. No production migration, deployment, or release follows from this
   checklist alone.

## Local release-gate closure cross-reference (2026-10-22)

Repository-only account-deletion, target-SDK, Railway-mapping, legacy-policy,
and CI findings are recorded in the **Local release-gate closure audit** in
`test-and-deployment-evidence.md`. That audit confirms the release remains
blocked and does not replace the owner approvals in `owner-approval-record.md`.

### Clean CI workflow status (2026-10-23)

The repository now contains `.github/workflows/clean-validation.yml` with
separate backend, admin, and pinned-Flutter jobs. Local YAML parsing and the
backend/admin command equivalents pass where previously reported; the hosted
workflow has not run because no commit or push was performed. QA-001 and QA-002
therefore remain **BLOCKED** until an authorized hosted run records Flutter
analyzer/test results and the admin production-build result.

### Account-deletion foundation (2026-10-23) — IMPLEMENTED / POLICY GATES OPEN

The policy-independent backend foundation is now implemented and locally
validated. `AccountDeletionRequest` stores a durable, idempotent request with
active-request uniqueness, retry counters, leases, sanitized failure fields,
and explicit cleanup/entitlement checkpoints. `AccountDeletionReauth` stores
only a hashed, short-lived one-time proof. `User.deletionState` is set with a
compare-and-set update before any cleanup work.

Authenticated middleware rejects existing JWTs for pending/completed accounts
and accounts with an active deletion request. A deletion-only middleware keeps
same-account retry requests idempotent. Login/reset/FCM/profile/collection/
favourite/test-purchase writes, purchase verification, subscription entitlement
writes, and Google/Apple notification entitlement writes re-check account
writability. Catalog/admin push recipient queries exclude pending/deleted
accounts. RTDN may update an existing ledger lifecycle record, but cannot
grant a pending account access or create a claim.

Focused deletion tests cover HMAC-protected idempotency, concurrent duplicate
collapse, failed compare-and-set/manual-review state, re-auth proof hashing,
JWT rejection, active-request write blocking, and RTDN entitlement races. The
bounded backend suite is now **109 passed, 0 failed, 0 skipped**; `npm run
build` passes. At that evidence point no cleanup worker, purchase-ledger
deletion/anonymization, subscription cancellation, Flutter UI, or external
deletion webpage was implemented; the worker execution was added in the
follow-up section below. The remaining items are still policy/owner-dependent
release blockers.

The deletion route also exposes an authenticated status read and the service
provides lease-bounded claim/failure transitions used by the worker below.
Those transitions do not finalize policy-dependent states.

**Acceptance condition:** obtain approved retention and account-recreation
decisions, then implement and test the checkpointed cleanup worker and the
in-app/external deletion surfaces in a disposable environment. The release
remains **BLOCKED** and Phase 2 is not authorized.

### Account-deletion worker execution (2026-10-23) — IMPLEMENTED / POLICY GATE OPEN

`backend/src/services/accountDeletionWorker.ts` now runs inside the existing
backend process. `server.ts` starts it after database/admin startup, and each
replica uses MongoDB's atomic `findOneAndUpdate` claim with a five-minute
lease. A bounded batch processes at most ten requests per tick; the same
request cannot be claimed concurrently while its lease is valid, and an
expired lease is recoverable after a worker restart. `ACCOUNT_DELETION_WORKER_ENABLED=false`
is available only to intentionally disable the worker in a non-production
process.

The worker has durable, idempotent checkpoints for access blocking, password-
reset/OTP cleanup, and non-financial preferences/device tokens. It records
retryable failures with redacted metadata and skips already-completed stages.
It deliberately stops at `blocked_policy` after those safe stages: User
identity, StorePurchase, SubscriptionPurchase, subscription entitlements,
financial records, and any policy-dependent retention step are not deleted,
anonymized, revoked, or marked completed. Pending accounts remain blocked
until approved retention, account-recreation, and entitlement decisions are
implemented and tested.

Focused worker coverage now includes atomic next-claim/lease recovery,
policy-gated completion, partial-failure retry metadata, and restart-safe
checkpoint skipping. Backend validation is **114 passed, 0 failed, 0
skipped** and the TypeScript build passes. This closes only the worker
execution foundation; account-deletion compliance and release approval remain
blocked.

### Flutter account-deletion UX (2026-10-23) — IMPLEMENTED / VALIDATION BLOCKED

The Flutter Profile settings now expose a clearly separated **Delete account**
entry and `AccountDeletionScreen`. The screen uses the implemented
`POST /auth/me/deletion-re-auth`, `POST /auth/me/deletion-request`, and
`GET /auth/me/deletion-request` contracts, keeps the one-time proof only in
memory, generates an idempotency key per request attempt, requires consequence
acknowledgement plus credential reauthentication plus a final confirmation,
and renders requested/processing/retryable/manual/policy-blocked/completed and
unknown states without claiming deletion while incomplete. It links back to
the existing Premium screen and explicitly says store subscriptions are not
cancelled by account deletion.

Focused widget/model coverage was added in
`flutter_app/test/account_deletion_test.dart`. Local `dart format`,
`flutter test test/account_deletion_test.dart --no-pub`, and
`flutter analyze --no-pub` were attempted with bounded waits but produced no
output and hung in the existing Windows Dart environment; each command was
interrupted after approximately 15 seconds. Existing Dart processes were
inspected and not terminated. Therefore no Flutter test or analyzer pass is
claimed. The release remains **BLOCKED** pending clean-runner Flutter
validation, policy approval, and the external deletion resource.

### External deletion information page and CI follow-up (2026-10-23) — PREPARED / VALIDATION BLOCKED

The public Next.js site now contains an informational `/account-deletion`
route at `happinotes-admin/app/account-deletion/page.tsx`. It describes the
authenticated in-app request, status handling, the separate store-subscription
cancellation path, and safe support guidance. It does not collect passwords,
PINs, OTPs, purchase tokens, or call the authenticated deletion API. Because
the repository contains no proven public support mailbox and no unauthenticated
web deletion endpoint, the page displays a publication dependency until the
owner configures `NEXT_PUBLIC_SUPPORT_EMAIL` with an approved, verified address
and decides whether a secure web request flow is required.

`.github/workflows/clean-validation.yml` now explicitly checks `dart format`
before `flutter analyze` and the repository-wide `flutter test --no-pub` on the
Flutter revision read from `.metadata` (`559ffa3f75e7402d65a8def9c28389a9b2e6fe42`).
The existing local Dart-process hang remains unresolved; no hosted workflow run
was executed in this session. Release status remains **BLOCKED**.

### Current disposition clarification (2026-10-23)

The original blocker table and earlier sections are retained as historical
baseline evidence; they are not a claim that newer implementation work is
absent. The current status is:

- **POLICY-001 — account deletion: BLOCKED / implemented with conditions.**
  Authenticated Flutter/backend request and status handling, the policy-gated
  worker foundation, and the public informational `/account-deletion` route
  exist. A secure unauthenticated web-request contract, approved retention and
  account-recreation policy, approved public support address/domain, and clean
  Flutter validation are still missing. The informational page does not itself
  submit or confirm deletion.
- **QA-001 — Flutter validation: BLOCKED / hosted validation not tested.** The
  workflow is configured for non-mutating formatting, analyzer, and full test
  checks on the pinned Flutter revision, but local Dart commands previously
  hung and no hosted run has been executed.
- **QA-002 — admin validation: lint/type-check pass; production build pending.**
  Local lint passes with 0 errors and 18 existing warnings, and the TypeScript
  check passes. The Windows production-build `spawn EPERM` issue remains
  unresolved; a clean-runner build result is still required.
- **External deletion page: PREPARED / NOT PUBLISHED.** The page consumes
  `NEXT_PUBLIC_SUPPORT_EMAIL` only when an owner supplies an approved, verified
  address. No support address is inferred from unrelated admin or mail-sender
  variables, and no public deployment/domain has been verified.

These clarifications preserve the dated historical findings above. They do not
close any release gate or authorize Phase 2.

