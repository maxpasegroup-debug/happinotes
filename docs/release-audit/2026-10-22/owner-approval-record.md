# HappiNotes — External Validation Authorization Record

**Record date:** 2026-10-22  
**Release verdict:** **BLOCKED**  
**Purpose:** Capture owner decisions and authorization boundaries for an isolated,
non-production validation window. This record is not permission to access
production systems, connect to shared databases, migrate data, deploy, publish,
or begin Phase 2.

## How to complete this record

- Owners must enter their own name, role, date, scope, and decision.
- Use only `Pending`, `Approved`, or `Rejected` for approval status.
- Do not enter passwords, API keys, service-account JSON, purchase tokens,
  OTPs, personal recipient addresses, or other secrets/personal data.
- Approval applies only to the explicitly listed non-production resources and
  permitted actions. Any scope change requires a new approval.
- Evidence must be redacted and stored in the approved evidence location.

## Authorization summary

| Workstream | Responsible person and role | Status | Approval date and scope | Resource readiness | Gate disposition |
|---|---|---|---|---|---|
| A — Legacy purchase ledger | **Name:** ____________________  **Role:** ____________________ | Pending | Date: __________  Scope: ____________________ | Pending — sanitized disposable snapshot and isolated clone required | Blocked |
| B — Google Play billing/RTDN | **Name:** ____________________  **Role:** ____________________ | Pending | Date: __________  Scope: ____________________ | Pending — license tester, test products, API and notification setup required | External validation not tested |
| C — Email OTP delivery | **Name:** ____________________  **Role:** ____________________ | Pending | Date: __________  Scope: ____________________ | Pending — one authorized test recipient and controlled delivery configuration | Live delivery pending |
| D — Clean CI validation | **Name:** ____________________  **Role:** ____________________ | Pending | Date: __________  Scope: ____________________ | Pending — clean runner and reproducible toolchain required | Blocked |
| E — Remaining release gates | **Name:** ____________________  **Role:** ____________________ | Pending | Date: __________  Scope: ____________________ | Decisions/evidence tracked below | Blocked/open |

## Workstream A — Legacy purchase ledger

**Purpose and risk:** Determine whether historical ledger records use legacy
raw purchase tokens or canonical transaction keys without touching deployed or
shared data. Risks include ownership transfer, product mismatch, duplicate
records, unique-index conflicts, and irreversible data changes.

| Field | Owner entry / requirement |
|---|---|
| Responsible person and role | Name: ____________________  Role: ____________________ |
| Approval status | Pending / Approved / Rejected: ____________________ |
| Approval date and scope | Date: __________  Scope: sanitized snapshot, isolated disposable clone, read-only inventory, authorized token verification, and rehearsal only. |
| Required resources and readiness | Sanitized non-production snapshot; isolation confirmation; disposable clone; approved read-only credentials supplied out-of-band; authorized Google verification process; unique-index metadata; rollback destination. Readiness: Pending / Ready: __________ |
| Permitted actions | Inspect schema/index metadata; produce redacted counts; classify canonical/raw-token candidates; verify candidates through an authorized non-production process; run the offline planner; rehearse against a disposable clone; record conflicts and rollback evidence. |
| Explicit exclusions | No connection to Railway or any shared/production MongoDB; no production reads or writes; no migration; no raw-token export; no ownership reassignment; no destructive cleanup. This record alone authorizes none of these actions. |
| Evidence required to close gate | Isolation confirmation; redacted baseline inventory; candidate classification; Google verification fingerprints and state only; ownership/product conflict report; duplicate and unique-index report; repeat/idempotency result; disposable-clone before/after counts; rollback rehearsal; operator and reviewer sign-off. |
| Outstanding dependencies and next action | Data owner approves the sanitized snapshot and clone. Backend operator then runs the read-only inventory and planner rehearsal. Any cross-owner/product conflict stops the exercise for review. |

**Current status:** `BLOCKED` pending owner approval, a verified
non-production snapshot, and rehearsal evidence. No database connection or
migration was performed.

## Workstream B — Google Play billing and RTDN

**Purpose and risk:** Validate subscription purchase, account binding,
acknowledgement, lifecycle ordering, and RTDN behavior using only authorized
license-test resources. Risks include real charges, cross-user entitlement,
unacknowledged purchases, and incorrect state transitions.

| Field | Owner entry / requirement |
|---|---|
| Responsible person and role | Name: ____________________  Role: ____________________ |
| Approval status | Pending / Approved / Rejected: ____________________ |
| Approval date and scope | Date: __________  Scope: named package, non-production backend, specified test products/base plans, license tester, and controlled notification window. |
| Required resources and readiness | Authorized Play Console owner; license-tester account; active monthly/yearly test products; package ID confirmation; least-privilege Play API service account; controlled Pub/Sub/RTDN endpoint; non-production backend configuration. Readiness: Pending / Ready: __________ |
| Permitted actions | Test new purchase, same-user restore, cross-user rejection, acknowledgement success/already-acknowledged/retry/failure, renewal, cancellation before expiry, grace, account hold, pause, expiry, refund/revocation, duplicate RTDN, and out-of-order RTDN. |
| Explicit exclusions | No production products, customer accounts, production purchase tokens, real customer charges, production entitlement changes, or unapproved Play Console changes. Never record full purchase tokens or service-account material. |
| Evidence required to close gate | Tester alias; app/version and product/base-plan identifiers; UTC timestamps; redacted token fingerprint; authoritative state/expiry/acknowledgement; HTTP result; entitlement result; RTDN delivery IDs/fingerprints; duplicate/out-of-order outcomes; reviewer sign-off. |
| Outstanding dependencies and next action | Payments owner supplies the test window and confirms backend/RTDN isolation. Operator executes the scenario matrix and records redacted evidence. Missing credentials or products leaves this gate `NOT TESTED`, not passed. |

**Current status:** `EXTERNAL VALIDATION NOT TESTED`. Unit and bounded tests
exist, but no Google Play sandbox, license-tester, or RTDN execution has been
claimed.

## Workstream C — Email OTP delivery

**Purpose and risk:** Verify the existing Resend email OTP path without sending
unsolicited messages or exposing OTP values. Phone OTP remains disabled in
production unless a separately approved real provider is implemented.

| Field | Owner entry / requirement |
|---|---|
| Responsible person and role | Name: ____________________  Role: ____________________ |
| Approval status | Pending / Approved / Rejected: ____________________ |
| Approval date and scope | Date: __________  Scope: one explicitly authorized test recipient, controlled environment, one bounded delivery verification, and failure-path checks. |
| Required resources and readiness | Authorized test recipient; approved non-production or explicitly controlled Resend configuration; delivery-observation method that does not expose the OTP/API key. Readiness: Pending / Ready: __________ |
| Permitted actions | Send one controlled test email; verify provider success/failure, timeout, missing configuration, expiry, attempt limit, replay, and rate-limit behavior using redacted evidence. Automated tests continue using stubs. |
| Explicit exclusions | No unsolicited messages; no production recipient lists; no OTP/API-key capture; no phone-provider substitution; no claim of live phone OTP capability. |
| Evidence required to close gate | Provider status/message ID and timestamps only; redacted delivery confirmation; failure responses; expiry/one-time/rate-limit results; reviewer sign-off. |
| Outstanding dependencies and next action | Auth/operations owner authorizes the recipient and confirms the controlled configuration. Operator performs the bounded check. If phone OTP is a product requirement, product owner must separately approve and fund a real provider implementation. |

**Current status:** `LIVE DELIVERY PENDING`. Automated coverage exists, but no
real Resend delivery was performed.

## Workstream D — Clean CI validation

**Purpose and risk:** Establish reproducible backend, admin, and Flutter
validation without weakening tests or terminating unknown processes.

| Field | Owner entry / requirement |
|---|---|
| Responsible person and role | Name: ____________________  Role: ____________________ |
| Approval status | Pending / Approved / Rejected: ____________________ |
| Approval date and scope | Date: __________  Scope: disposable/clean runner, pinned dependencies/toolchains, bounded commands, and evidence capture only. |
| Required resources and readiness | Clean Windows or CI runner; Node/npm and lockfile installation; pinned Flutter revision; Java/Android tooling; isolated workspace; timeout and log-retention policy. Readiness: Pending / Ready: __________ |
| Permitted actions | Run backend build and deterministic tests; run admin typecheck/lint/build after a clean lockfile install; run `flutter pub get`, `flutter analyze --no-pub`, and `flutter test --no-pub`; capture exit codes, durations, diagnostics, and counts. |
| Explicit exclusions | Do not kill unrelated processes; do not change global toolchain settings; do not modify source merely to suppress failures; do not generate an AAB or publish a release. |
| Current outstanding issues | Backend default `npm test` fails before execution with Windows `spawn EPERM`; bounded isolation-none runner passes 99 tests. Admin local `esutils/lib/utils.js` is missing despite the lockfile entry; admin build also hits `spawn EPERM`. Flutter commands previously timed out without counts. Five Dart/Dart VM processes were observed and not terminated. |
| Evidence required to close gate | Runner identity; tool versions; clean-install result; exact commands; exit codes; elapsed times; backend test counts; admin lint/typecheck/build results; Flutter analyzer diagnostics and test count; reviewer sign-off. |
| Outstanding dependencies and next action | DevEx/mobile owners designate the clean runner and preserve the bounded runner as separate evidence. Repair dependencies with the committed lockfile only; then rerun each check independently. |

**Current status:** `BLOCKED` until clean-runner evidence is captured.

## Workstream E — Remaining release gates

These decisions may be prepared independently of the external validation
window, but none may be represented as closed without the evidence below.

| Gate | Decision-maker / owner | Current status | Evidence required | May proceed independently? | Next action |
|---|---|---|---|---|---|
| Account deletion | Product, backend, and legal owner | Open / not tested | Authenticated in-app deletion or link; public external deletion resource; cleanup/retention behavior; non-destructive end-to-end test; Play declaration evidence | Yes, source/design work can proceed without external credentials | Confirm required retention exceptions and implement/test both paths. |
| Effective Android target SDK | Mobile/release owner | Open / not tested | Release manifest or equivalent build evidence showing effective target API and Play pre-launch evidence | Yes, inspection can proceed without production access; release artifact generation remains separately prohibited here | Use the approved clean runner to capture the effective target SDK. |
| Railway service/domain/commit/health mapping | DevOps/release owner | Open / not verified | Backend/admin service names, roots, build/start commands, domain, environment, health response, and deployed commit SHA; no variable values | Documentation can be prepared independently; external query requires owner authorization | Owner records the mapping through the approved Railway process. |
| Subscription-only versus grandfathered legacy purchases | Product/backend owner | Blocked / decision pending | Signed choice: grandfather, migrate, or retire; legacy-record inventory; entitlement and UI tests matching the decision | Policy discussion can proceed independently; data inventory requires Workstream A approval | Product owner signs the policy and backend owner documents historical entitlement handling. |

## Approval signatures

| Workstream | Owner name and role | Decision | Date | Signature or approved-record reference |
|---|---|---|---|---|
| A | ____________________ | Pending / Approved / Rejected | __________ | ____________________ |
| B | ____________________ | Pending / Approved / Rejected | __________ | ____________________ |
| C | ____________________ | Pending / Approved / Rejected | __________ | ____________________ |
| D | ____________________ | Pending / Approved / Rejected | __________ | ____________________ |
| E | ____________________ | Pending / Approved / Rejected | __________ | ____________________ |

## Record disposition

Until the required approvals and evidence are completed, the release verdict
remains **BLOCKED**. This document does not authorize Phase 2, production
release, deployment, AAB generation, database migration, Play Console changes,
or live OTP delivery.
