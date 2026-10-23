# Test and deployment evidence

Audit date: 2026-10-22. Commands were run without modifying source or production services.

## Historical Git baseline

The table below records the earlier audit snapshot and is retained for
traceability. It is not the current worktree state; the current state is
recorded in the Phase 1 closure sections below.

| Check | Result |
|---|---|
| `git status --short --branch` | PASS — `integrate-flutter-main...origin/main`; no staged, unstaged, or untracked changes. |
| HEAD | `13e55e270365fc7c121002a304bf42cd7fdcecb9` — `feat: Implement real-time subscription plan updates and enhance subscription screen interactions`. |
| `git diff origin/main..HEAD` | Empty; HEAD matches origin/main. |
| Local signing material | `flutter_app/android/key.properties` and `upload-keystore.jks` exist and are ignored; values were not printed or validated. |

## Backend checks

| Command | Result | Detail |
|---|---|---|
| `cd backend; npm run build` | PASS | TypeScript compiler exited 0. |
| `cd backend; npm test` | FAIL/BLOCKED | Node test runner could not spawn test files on Windows (`spawn EPERM`); aggregate run reported 0 tests executed. |
| `node --test test/storePurchase.test.cjs` | PASS | 16 passed, 0 failed. |
| `node --test test/storeProductProvisioning.test.cjs` | FAIL | 26 passed, 2 failed. One stale expectation still requires `validatePremiumPrice(...priceInr: 0)` to throw even though subscription-only admin writes zero book prices; one admin-content fixture lacks Cloudinary configuration and fails with `Cloudinary media storage is not configured`. |
| `node --test test/storeNotifications.test.cjs` | FAIL | 6 passed, 1 failed. `Apple refund uses current signed transaction state before removing access` timed out at ~10s; result status was undefined instead of 204. |
| `cd backend; npm run lint` | BLOCKED | `eslint` is not installed/available in the backend package. |

The provisioning and notification failures are current evidence, not historical assumptions. The failing tests must either be repaired to match the approved model or the implementation must be corrected; do not simply remove assertions.

## Admin checks

| Command | Result | Detail |
|---|---|---|
| `cd happinotes-admin; npx tsc --noEmit` | PASS | TypeScript validation exited 0. |
| `cd happinotes-admin; npm run lint` | BLOCKED | ESLint could not load `node_modules/esutils/lib/utils.js`; dependency installation/lockfile health needs controlled remediation. |
| `cd happinotes-admin; npm run build` | BLOCKED | Turbopack compiled successfully, then Next failed during TypeScript worker spawn with Windows `Error: spawn EPERM`. This is an environment/tooling blocker, not proof of a source error. |
| Admin deployment mapping | NOT VERIFIED | Source confirms `happinotes-admin/app/page.tsx` landing page and `/admin/login`; Railway root directory/domain/current commit were not queried during this audit. |

Expected Railway admin settings to verify manually: root directory `happinotes-admin`, build command `npm run build`, start command `npm run start`, and the public domain mapped to this service (not a root redirect to `/admin/login`).

## Flutter checks

| Command | Result | Detail |
|---|---|---|
| `cd flutter_app; flutter test --no-pub` | BLOCKED | No output after ~40 seconds; the audit-owned process was interrupted. No pass count is claimed. Historical “22 passed” is not current evidence. |
| `cd flutter_app; flutter analyze --no-pub` | BLOCKED | No output after ~40 seconds; the audit-owned process was interrupted. No clean analysis is claimed. |
| Android debug build | NOT RUN in this audit | Previous local history had a debug APK, but no current artifact is certified here. |
| Android release/AAB build | NOT RUN | Audit rules prohibit generating a production artifact; release feasibility was inspected from Gradle configuration only. |

The Gradle file requires `android/key.properties` and an upload keystore for release tasks (`flutter_app/android/app/build.gradle.kts:11-24`). The current `pubspec.yaml` version is `1.0.1+2`. The effective target SDK still delegates to the installed Flutter SDK (`build.gradle.kts:42-45`) and must be captured in a later controlled release build.

## Deployment and external evidence

- Backend runtime configuration is not reproduced locally; Railway variables, MongoDB data, Cloudinary account state, Google Play Console product/base-plan state, FCM delivery, and active deployment commit were not queried or changed.
- The backend default mobile URL is `https://happinotes-production-6b44.up.railway.app` (`flutter_app/lib/core/network/api_client.dart:27-30`). Verify this URL responds to `/health` and that the Railway deployment serving it matches the audited commit before testing.
- No signed AAB was generated or uploaded. No internal-track install or production-like purchase was performed in this audit.

## Required evidence rerun

After Phase 1 fixes, run the commands again in a clean Windows/CI environment with controlled dependencies. Capture exit codes, counts, commit SHA, APK/AAB SHA-256, effective target SDK, signing certificate fingerprints (public only), Play track/version code, tester account, device/OS, and timestamps in `release-evidence-template.md`.

## Phase 1 release-gate closure (2026-10-22 rerun)

This section is the current corrective-run evidence. The earlier tables above
remain the original audit baseline and are not overwritten.

### Git preservation

- `git status --short` shows the Phase 1 source/test changes and untracked audit
  documentation. No commit, push, reset, stash, or cleanup was performed.
- The existing mobile change in
  `flutter_app/lib/core/payments/subscription_purchase_controller.dart` remains
  present. `main_shell.dart` and `subscription_screen.dart` are not currently
  modified, so no changes were overwritten there.
- No secret values, purchase tokens, service-account material, or private keys
  were printed or added to this report.

### Backend validation

| Command | Result | Evidence |
|---|---|---|
| `cd backend; npm run build` | PASS | TypeScript compiler exited 0. |
| `cd backend; node --test --test-isolation=none test/*.test.cjs` | PASS | 99 passed, 0 failed, 0 skipped; exit 0; completed in 6.41 seconds. |
| `cd backend; npm test` | BLOCKED | 10 test files failed before executing tests (`0 passed, 10 failed, 0 skipped`) with Windows `spawn EPERM`; exit 1; completed in 54.4 ms. The bounded runner above is separate evidence and does not make the default script pass. |
| `cd backend; git diff --check` | PASS | No whitespace errors; only LF/CRLF normalization warnings. |

The earlier two provisioning failures and Apple notification timeout now pass
in the bounded suite. They were fixed/test-isolated rather than suppressed.

### Gate 1 — legacy Google token compatibility: BLOCKED

The current `SubscriptionPurchase` and `StorePurchase` schemas contain only
`transactionKey` and a unique `(store, transactionKey)` index. Available Git
history (`fe3ca22`, `4670e96`, `918134d`) also shows transaction-key storage and
SHA-256 generation; no raw-token schema or migration exists in this checkout.
This is not evidence about the contents of a deployed MongoDB database.

`backend/src/services/legacyPurchaseTokenMigration.ts` is an offline planner,
not a runtime route. It requires Google verification before treating a legacy
value as a raw token, leaves ambiguous 64-hex values for manual review,
preserves owner/product identity, detects cross-owner collisions, and produces
an idempotent same-owner duplicate plan. Its eight disposable-fixture tests pass
as part of the 99-test run.

Required evidence before closing this gate: a read-only inventory from a
non-production snapshot, Google verification of candidate raw tokens, a
disposable-clone rehearsal with unique-index/duplicate/rollback evidence, and
an approved migration owner. No migration was run.

### Gate 2 — Google Play purchase and RTDN: UNIT PASS / EXTERNAL PENDING

Unit tests cover exact account binding, replay/cross-user ownership, duplicate
tokens, acknowledgement success/already-acknowledged/transient/permanent
failures, cancellation before expiry, expiry, grace period, account hold,
pause, pending state, renewal ordering, duplicate RTDN delivery, and stale
out-of-order entitlement updates. RTDN accepts only authenticated Pub/Sub
notifications, performs an authoritative Play lookup, and updates an existing
same-owner ledger claim; it cannot create a claim.

No Google Play sandbox, license-tester, or controlled RTDN delivery was run.
External validation remains pending. The implementation mapping follows the
documented behavior that grace retains entitlement, account hold and pause do
not, canceled subscriptions retain access until expiry, and expired state
removes access. Confirm against the [Play subscription lifecycle
documentation](https://developer.android.com/google/play/billing/lifecycle/subscriptions)
and [SubscriptionPurchaseV2 reference](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2)
with a license tester before release.

### Gate 3 — Resend email OTP: UNIT PASS / LIVE DELIVERY PENDING

The application has email OTP and phone OTP flows. Email delivery uses the
existing Resend integration; tests cover provider success, missing
configuration, timeout/error propagation, expiry/one-time storage behavior, and
test-code isolation without sending a real OTP. Production requires Resend
configuration. Phone OTP is explicitly disabled in production because no real
WhatsApp/SMS provider exists in this repository; phone-dependent product flows
remain blocked until an approved provider is implemented.

### Gate 4 — Flutter and Windows validation: BLOCKED

`flutter_app/.metadata` pins Flutter revision `559ffa3f75e7402d65a8def9c28389a9b2e6fe42`;
`pubspec.yaml` is version `1.0.1+2`, and Android `targetSdk` delegates to the
installed Flutter SDK. `flutter test --no-pub` and `flutter analyze --no-pub`
were not completed; the prior audit timed out after roughly 40 seconds with no
counts. A read-only process check found four long-running `dart.exe` processes
under `C:\src\flutter\bin\cache\dart-sdk\bin`; Windows denied access to their
command lines, so no process was terminated.

The original backend worker-isolation command is reproducibly `spawn EPERM` on
Windows. The repository default now uses a platform-specific serial wrapper
and passes all 99 tests; `npm run test:isolated` remains the explicit
diagnostic for the unsupported worker path. Admin build/lint and Flutter
validation remain separate unresolved gates.

### Gate 5 — release recommendation

**ACCEPT WITH CONDITIONS for the Phase 1 remediation package; not a production
release approval.** Conditions are: complete the legacy-token database
inventory/migration rehearsal, run controlled Google Play sandbox/RTDN tests,
verify Resend delivery in a non-automated controlled account, and obtain clean
Flutter/CI evidence. Existing audit blockers for account deletion, effective
target SDK, Railway deployment/commit mapping, admin build/lint environment,
and the subscription-only legacy-product decision remain open. Phase 2 must not
begin, and no release artifact may be generated or published, until the
critical conditions are reviewed and accepted.

### Remaining blockers and owners

| Severity | Owner/action |
|---|---|
| P1 | Backend/data owner: inventory deployed ledgers and rehearse the offline token migration; no production write until approved. |
| P1 | Payments owner: run Play license-tester lifecycle and authenticated RTDN scenarios, recording external evidence. |
| P1 | Auth/ops owner: verify Resend live delivery; decide whether phone OTP is required or formally deferred. |
| P1 | Mobile/build owner: resolve Flutter SDK/process hang and capture analyzer/test counts in clean CI. |
| P1 | DevEx owner: resolve Windows Node worker `spawn EPERM` or designate CI as the required runner. |
| P1 | Release owner: close account-deletion, target-SDK, deployment-mapping, admin-build, and commercial-model gates from the original register. |

## Phase 1 release-evidence closure addendum (latest bounded checks)

This addendum supersedes only the command outcomes in the earlier closure
section; the historical baseline remains unchanged. It records the latest
read-only checks and does not certify external services or a release.

### Toolchain and command evidence

| Area | Command/configuration | Actual outcome |
|---|---|---|
| Node/backend | `node --version`, `npm --version` | Node `v24.11.1`, npm `11.6.2`. Backend scripts are `build: tsc`, `test: node scripts/run-tests.cjs`, and diagnostic `test:isolated: node --test test/*.test.cjs`. |
| Backend build | `cd backend; npm run build` | PASS, exit 0. |
| Backend bounded tests | `cd backend; node --test --test-isolation=none test/*.test.cjs` | PASS, exit 0: 99 passed, 0 failed, 0 skipped, about 7.3 seconds. |
| Backend default tests | `cd backend; npm test` | PASS, exit 0: 99 passed, 0 failed, 0 skipped; wrapper elapsed about 8.5 seconds. The original worker-isolation failure remains reproducible through `npm run test:isolated`. |
| Admin TypeScript | `cd happinotes-admin; npx tsc --noEmit` | PASS, exit 0, about 7.1 seconds. |
| Admin lint | `cd happinotes-admin; npm run lint` | FAIL, exit 1: ESLint runs after lockfile repair and reports 16 application-code errors and 25 warnings. No lint rule was weakened. |
| Admin production build | `cd happinotes-admin; npm run build` | FAIL, exit 1: Turbopack compiled successfully, then TypeScript phase failed with Windows `spawn EPERM`. |
| Flutter | `flutter_app/.metadata`, `pubspec.yaml`, `android/app/build.gradle.kts` | Pinned Flutter revision `559ffa3f75e7402d65a8def9c28389a9b2e6fe42`; app `1.0.1+2`; `compileSdk = 37`; effective `targetSdk = flutter.targetSdkVersion`. A bounded `flutter --version` probe did not return an exit code. Five Dart/Dart VM processes from the Flutter SDK were observed; none were terminated and analyzer/test counts remain unavailable. |
| CI discovery | `.github` workflow search | No repository CI workflow was found. |

### Remaining requirement evidence

- **Account deletion - NOT TESTED / OPEN.** Source inspection found admin-only
  `DELETE /admin/users/:id` and FCM-token removal, but no authenticated
  self-service account deletion route or mobile/web deletion resource. The owner
  must implement or link both required deletion paths, document legal retention,
  and capture a non-destructive end-to-end test.
- **Android target SDK - NOT TESTED / OPEN.** The project does not pin an
  effective target API in `build.gradle.kts`; it delegates to the installed
  Flutter SDK. `compileSdk` is 37, but that is not proof of the manifest target.
  Google currently requires Android 16/API 36 or higher for new apps and app
  updates submitted from August 31, 2026; existing apps need API 35 or higher
  for availability to new users. Verify the generated manifest in a release
  build before acceptance: <https://support.google.com/googleplay/android-developer/answer/11926878>.
- **Railway mapping - NOT TESTED / OPEN.** Local documentation specifies the
  backend build/start commands (`npm run build`, `npm start`) and the admin
  service expectation (`happinotes-admin`, `npm run build`, `npm run start`),
  but no Railway service, environment, domain, health response, or deployed SHA
  was queried. DevOps must record those fields without recording variable
  values.
- **Subscription-only commercial model - BLOCKED / OWNER DECISION.** The
  mobile subscription screen and backend plan catalogue expose monthly/yearly
  plans, while legacy `priceInr`, `StorePurchase`, store-product provisioning,
  and one-time purchase UI remain in the repository. The product owner must
  choose grandfather, migrate, or retire behavior and approve historical
  entitlement handling before release.

### External validation readiness (not executed)

- **Google Play:** The register contains the license-tester/RTDN procedure and
  expected evidence. It requires owner-authorized tester accounts, active
  non-production products/base plans, controlled RTDN delivery, and a backend
  environment that is not production. No sandbox purchase or RTDN delivery was
  claimed.
- **Legacy tokens:** The planner is offline-only and tested with disposable
  fixtures. A redacted inventory, Google verification, unique-index check,
  disposable-clone rehearsal, and rollback approval are still required. No
  deployed MongoDB was accessed.
- **Resend:** Automated tests use stubs only. One owner-authorized recipient is
  required for live delivery evidence; record provider status/message ID only,
  never OTPs or API keys. Phone OTP remains disabled because no real phone
  provider exists in this repository.

### Latest recommendation

**PASS WITH CONDITIONS for remediation review only; production release remains
blocked and Phase 2 must not begin.** The highest-priority exits are the
non-production ledger rehearsal, Google Play external lifecycle evidence,
authorized Resend delivery check, clean Flutter/CI validation, and closure of
account deletion, target SDK, Railway mapping, admin lint/build, and commercial
model decisions.

## External validation and CI execution notes

## Local CI remediation results (2026-10-22)

This section records the bounded remediation checks performed after the earlier
baseline. Earlier rows remain historical evidence; these results are the
current disposition. No deployment, production access, migration, release
build, or secret change was performed.

| Area | Exact command | Result |
|---|---|---|
| Backend default test script | `cd backend; npm test` | **PASS**, exit 0; 99 passed, 0 failed, 0 skipped; wrapper elapsed about 8.5 seconds. `backend/scripts/run-tests.cjs` uses the supported `--test-isolation=none` mode on Windows, where file-worker spawning reproducibly returns `spawn EPERM`. |
| Backend build | `cd backend; npm run build` | **PASS**, exit 0; elapsed about 11.2 seconds. |
| Backend worker-isolation diagnostic | `cd backend; npm run test:isolated` | **FAIL/diagnostic**, exit 1; 10 file-level workers failed before test execution, 0 tests passed, with `spawn EPERM`. This confirms the wrapper is the environment workaround; it does not suppress test failures. |
| Admin dependency restoration | `cd happinotes-admin; npm ci --ignore-scripts --no-audit --no-fund --prefer-offline --loglevel=verbose` | **PASS**, exit 0; lockfile install completed and restored `esutils/lib/utils.js`, local ESLint/Next files, and package links. The install took about 7 minutes; the lockfile was not changed. |
| Admin TypeScript | `cd happinotes-admin; npx tsc --noEmit` | **PASS**, exit 0; elapsed about 4.2 seconds. |
| Admin lint | `cd happinotes-admin; npm run lint` | **PASS**, exit 0; 0 errors and 18 warnings. Remaining warnings are Next.js image-optimization recommendations for existing `<img>` usage. |
| Admin production build | `cd happinotes-admin; npm run build` | **FAIL**, exit 1; Turbopack compiled successfully in about 9.3 seconds, then the TypeScript phase failed with Windows `spawn EPERM` (total about 14.2 seconds). |
| Flutter process safety/version | `flutter --version --no-version-check`; `dart --version`; `Get-Process dart,dartvm ...` | **BLOCKED**; the Flutter probe produced no output and was interrupted after about 50 seconds because it did not return. Direct Dart version passed: `3.12.0`; Flutter checkout identifies as `3.44.0`, project revision `559ffa3f75e7402d65a8def9c28389a9b2e6fe42`. Four `dart.exe` and one `dartvm.exe` remain under `C:\src\flutter\bin\cache\dart-sdk\bin`; no existing process was terminated. Analyzer/test counts remain unavailable. |
| Repository whitespace check | `git diff --check` | **PASS**; no whitespace errors (Git may report LF/CRLF normalization warnings). |

**Root-cause disposition:** the backend worker-spawn failure is confirmed on
this Windows environment and is avoided by the repository's platform-specific
serial runner while retaining the original isolation command as
`test:isolated`. The incomplete admin `node_modules` tree was confirmed and
repaired from the existing lockfile. Admin lint errors are now fixed; the
remaining 18 warnings are image-optimization recommendations, and the build
worker `spawn EPERM` remains an environment blocker.
OneDrive location, antivirus, Windows policy, and Dart process contention are
possible explanations but were not proven. Flutter remains blocked pending a
clean pinned runner; no unknown process was terminated.

The backend runner change is limited to `backend/package.json` and
`backend/scripts/run-tests.cjs`; no test files or application behavior were
changed to hide failures. The overall release verdict remains **BLOCKED**.

### Backend runner decision

The repository's original default `node --test test/*.test.cjs` starts one
worker per file and reproducibly fails on this Windows environment with
`spawn EPERM` before executing tests. The platform-specific wrapper now uses
the supported bounded invocation `node --test --test-isolation=none
test/*.test.cjs` on Windows and retains default isolation on other platforms.
The original worker-isolation command remains available as `npm run
test:isolated` for diagnostics; it still reproduces the Windows failure. Tests
were not changed to hide failures.

### Admin dependency restoration

`happinotes-admin/package-lock.json` records `esutils@2.0.3`; the initial local
`node_modules/esutils` directory was incomplete and lacked `lib/utils.js`. A
lockfile install with `npm ci --ignore-scripts --no-audit --no-fund
--prefer-offline` repaired the local tree without changing the lockfile.
TypeScript and ESLint now pass. ESLint reports 18 remaining image-optimization
warnings; no lint rule was weakened. The production build still fails in its
TypeScript worker with Windows `spawn EPERM`, so a clean runner is still
required for admin build evidence.

### Flutter CI procedure

Use the pinned Flutter revision in `.metadata` on a clean CI runner. Run
`flutter pub get`, then independently run `flutter analyze --no-pub` and
`flutter test --no-pub` with bounded timeouts. Record Flutter/Dart versions,
exit codes, durations, analyzer diagnostics, and test counts. The local probe
left Dart processes and produced no reliable exit code, so local Flutter status
remains BLOCKED; no process was terminated and no global configuration was
changed.

### Owner approval dependency

The legacy-token, Google Play, and Resend procedures in the register require
explicit owner approval and non-production resources. Until those approvals,
the sanitized snapshot, license tester/products, RTDN configuration, and
authorized Resend recipient exist, all external checks are **BLOCKED/NOT
TESTED**, not passed.

## Local release-gate closure audit (2026-10-22)

This section records repository-only findings from the local checkout. No
production or shared environment, database, credential, Play Console, Resend
recipient, Railway service, or release artifact was accessed. The owner
approval fields remain in `owner-approval-record.md`; they are not repeated
here.

### Account deletion — BLOCKED / NOT IMPLEMENTED

**Evidence inspected:**

- Account creation is supported by email and phone signup at
  `backend/src/routes/authRoutes.ts:99` and `backend/src/controllers/authController.ts:168-231`.
- Authenticated user routes expose `/auth/me`, language update, and FCM-token
  removal only (`backend/src/routes/authRoutes.ts:116-119`). There is no
  `DELETE /auth/me` or equivalent self-service deletion route.
- The Flutter account/settings surface shows Legal and Logout but no delete
  account action (`flutter_app/lib/src/screens/main_shell.dart:776-793`).
- The only user deletion route is admin-protected `DELETE /admin/users/:id`
  (`backend/src/routes/adminRoutes.ts:18-21,79-84`). Its controller calls
  `User.findByIdAndDelete` and returns success without ownership checks,
  cascade cleanup, retry/idempotency handling, or an audit record
  (`backend/src/controllers/adminController.ts:405-418`).
- User data represented in this repository includes embedded collections,
  favourites, purchased-book IDs, FCM tokens, and subscription state
  (`backend/src/models/User.ts`). Separate user-linked records exist in
  `Otp`, `PasswordResetToken`, `StorePurchase`, and `SubscriptionPurchase`.
  No deletion test or cascade service was found for these records.
- `flutter_app/lib/src/screens/legal_screen.dart:12-30` contains placeholder
  policy text and no deletion link. No public external account-deletion
  resource is present in the repository.

**Security and lifecycle assessment:** Deleting the local user document would
not cancel a Google Play or App Store subscription. External billing remains
controlled by the store, and purchase/entitlement records cannot be silently
represented as cancelled. A retention policy for financial or fraud records
has not been approved and must not be invented in implementation.

**Progress without external credentials:** The requirement can be designed and
tested locally. No real account or data should be deleted during this phase.

**Smallest safe next action:** Product, legal, and backend owners should first
approve the deletion/retention contract and whether store-subscription
management is linked or separately instructed. Then implement an authenticated,
idempotent deletion request with ownership checks, a reviewed cascade/erasure
plan for every user-linked collection, explicit handling of external store
subscriptions, and an external web deletion resource. Add tests for
unauthenticated access, wrong-user access, repeat requests, partial failure
recovery, linked-record cleanup, auditability, and subscription continuity.

### Android target SDK — OPEN / NOT PROVEN

**Repository evidence:**

- `flutter_app/android/app/build.gradle.kts:27-45` sets `compileSdk = 37` but
  sets `targetSdk = flutter.targetSdkVersion`; the effective value is supplied
  by the installed Flutter SDK rather than pinned in this repository.
- `flutter_app/.metadata` pins a Flutter revision, but does not record the
  generated Android manifest target value.
- No existing release APK/AAB or merged release manifest was found at the
  checked build paths. No release build was generated for this audit.

**Assessment:** `compileSdk` and `targetSdk` are different settings. The
repository does not contain sufficient evidence to prove the effective target
SDK. For the intended 2026 submission, verify the applicable Play target API
policy directly before release:
[Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878).

**Progress without external credentials:** Configuration inspection can proceed
locally. Release-artifact verification must happen on an approved clean runner
and is intentionally not performed here.

**Smallest safe next action:** On the designated clean runner, generate the
approved release artifact, inspect the merged/packaged manifest with Android
build tooling, record the effective `targetSdk`, and retain the command output
as evidence. Do not infer it from `compileSdk`.

### Railway mapping from repository evidence only

| Item | Finding | Confidence |
|---|---|---|
| Backend service directory | `backend/` contains `railway.toml`, `package.json`, TypeScript source, and compiled-server scripts. | Verified from repository evidence; intended Railway root is inferred as `backend/`. |
| Backend build | `backend/railway.toml:4-5` uses `npm install && npm run build`; `backend/package.json:8` defines `tsc`. | Verified from repository evidence. |
| Backend start | `backend/railway.toml:7-8` uses `npm start`; `backend/package.json:9` runs `node dist/server.js`. | Verified from repository evidence. |
| Backend health | `backend/src/app.ts:52-54` exposes `GET /health` returning a success JSON message. | Verified from repository evidence. |
| Admin service directory | `happinotes-admin/package.json` defines Next build/start/lint scripts. No admin Railway manifest is present. | Service root `happinotes-admin/` is inferred; owner confirmation required. |
| Admin build/start | `npm run build` and `npm run start` are defined in the admin package. | Verified from repository evidence; service wiring inferred. |
| Backend domain | `flutter_app/lib/core/network/api_client.dart:27-30` contains a default `happinotes-production-6b44.up.railway.app`; backend CORS also lists other Railway and custom domains. | Owner confirmation required; repository values conflict and do not prove deployment. |
| Admin domain | No authoritative admin domain is defined in deployment configuration. | Owner confirmation required. |
| Commit/deployment identity | Git branch and local history are available, but no Railway deployment metadata is in the repository. | Owner confirmation required. |

**Progress without external credentials:** Build/start/health documentation can
be prepared locally. Current domain, environment, health response, and deployed
commit cannot be certified without the DevOps owner’s approved Railway review.

**Smallest safe next action:** DevOps records the actual service roots, domains,
environment, health response, and deployed commit SHA through the approved
Railway process without including variable values in audit evidence.

### Legacy-purchase policy decision brief — BLOCKED / OWNER DECISION

The checkout contains both models:

- **Subscription path:** monthly/yearly `SubscriptionPlan` records, admin plan
  routes, mobile `SubscriptionScreen`, `SubscriptionPurchase`, and verified
  subscription/RTDN handling.
- **Historical one-time path:** `Content.priceInr`, `StorePurchase`, product
  mappings/provisioning, `StorePurchaseController`, `/payments/store/products`,
  `/payments/store/verify`, and `book_purchase_screen.dart`. `book_detail.dart`
  explicitly preserves historical one-time playback while new premium access
  uses shared plans.

| Option | Customer impact | Security/migration impact | Required tests and evidence |
|---|---|---|---|
| Subscription-only for new and historical users | Simplifies the product model, but may remove or alter access that prior customers reasonably expect. | Requires a verified historical-purchase policy and safe migration/entitlement decision; cannot silently revoke valid ownership. | New monthly/yearly purchase, restore, renewal, expiry/refund, legacy-user access, cross-user rejection, and UI/catalog tests. |
| Grandfather verified historical purchases | Preserves continuity for customers with verifiable one-time records while all new purchases use subscriptions. | Requires token-key compatibility inventory, Google verification, owner/product matching, collision handling, and auditable migration or compatibility lookup. | Legacy raw/canonical key cases, duplicate/cross-user conflict tests, replay protection, restore, refund/revocation, and rollback rehearsal. |

The product/business owner must choose the policy, eligibility window, treatment
of unverifiable or conflicting records, and whether external-store refunds or
cancellations affect grandfathered access. No option is selected and no
entitlement behavior or migration was changed by this audit.

**Progress without external credentials:** Policy drafting, code inventory, and
test design can proceed. Any data inventory, token verification, or migration
requires the approved non-production resources in the owner record.

**Smallest safe next action:** Obtain a signed product/backend decision and
convert it into explicit acceptance criteria before removing or changing any
legacy path.

### Local validation environment — BLOCKED / TOOLING EVIDENCE INCOMPLETE

**Historical observed facts (earlier Windows baseline):**

The latest local results and the prepared hosted workflow are recorded below
and supersede this baseline for current status.

- `cd backend; npm test` fails before executing tests because the Node test
  runner cannot spawn file workers on this Windows environment (`spawn EPERM`).
- `node --test --test-isolation=none test/*.test.cjs` is a separate bounded
  runner and previously passed 99 tests; changing test concurrency did not make
  the default worker-based command pass.
- `cd happinotes-admin; npx tsc --noEmit` passed. Admin lint cannot load the
  installed `node_modules/esutils/lib/utils.js`, although the lockfile records
  `esutils@2.0.3`. The production build reaches compilation and then fails at
  the TypeScript worker with `spawn EPERM`.
- Flutter analyzer/test commands previously timed out without reliable counts.
  A read-only process inspection still shows four `dart.exe` and one `dartvm.exe`
  under `C:\src\flutter\bin\cache\dart-sdk\bin`, all started on 2026-10-22.
  They were not terminated; command-line metadata was not available.

**Confirmed versus hypothetical:** Worker-spawn failure, missing local admin
dependency file, and Flutter timeout are confirmed observations. OneDrive,
antivirus, Windows policy, and process contention are possible causes but were
not proven by this audit.

**Progress without external credentials:** A clean isolated worktree or
designated CI runner can validate these commands without production access.

**Smallest safe next action:** Use a clean runner/worktree with the committed
lockfiles, record tool versions and bounded command results, run backend/admin
checks independently, and run Flutter analyzer/tests independently. Do not
terminate the existing Dart processes or repeatedly rerun the hanging local
commands.

### Local-audit disposition

The account-deletion, effective-target-SDK, Railway mapping, and commercial
policy gates remain open. Local source/configuration evidence narrows the next
actions but does not close any release blocker. The overall release verdict is
**BLOCKED**, and Phase 2 is not authorized.

The implementation-ready account-deletion contract and test matrix are recorded
in [`account-deletion-contract.md`](account-deletion-contract.md). That document
was design-only at the time of its review; the policy-independent request and
access-protection foundation is now implemented, while no cleanup worker,
external resource, or database operation has been executed.

### Clean CI workflow setup (2026-10-23) — PREPARED / HOSTED NOT RUN

Added [`clean-validation.yml`](../../../.github/workflows/clean-validation.yml)
with separate least-privilege Ubuntu jobs for backend, admin, and Flutter. The
workflow uses `npm ci` with the existing lockfiles, runs the repository's actual
test/build scripts, checks out the Flutter revision from `flutter_app/.metadata`,
uses `flutter pub get --enforce-lockfile`, and uploads analyzer/test logs.

Local YAML parsing passed. Local backend tests (99 passed, 0 failed), backend
build, admin lint (0 errors, 18 image warnings), and admin TypeScript validation
also passed. Hosted execution has not occurred because this workflow has not
been committed or pushed; no clean-runner or Flutter hosted result is claimed.

## Account-deletion foundation (2026-10-23)

Implemented only the policy-independent backend gate: durable request and
reauth models, an HMAC-protected idempotency flow, compare-and-set pending
state, JWT middleware rejection, deletion-flow retry/status authentication,
lease-bounded worker claim/failure transitions, and write/entitlement guards.
Provider purchase and RTDN ledger lifecycle updates
remain authoritative but cannot grant entitlement after deletion begins; push
recipient queries also exclude pending/deleted accounts. No
financial ledger was deleted or anonymized, no subscription was cancelled, and
no production or shared database was accessed.

Validation actually completed from `backend/`:

- `npm run build` — exit 0.
- `npm test` — exit 0; 109 passed, 0 failed, 0 skipped (serial bounded wrapper,
  elapsed approximately 3.3 seconds).
- Focused deletion tests include eight account-deletion cases plus purchase and
  RTDN race regressions; they run within the 109-test suite.
- `git diff --check` — exit 0 (only existing line-ending normalization
  warnings are reported by Git).

At the time of this foundation evidence, the deletion worker/checkpoint
processor, policy-dependent cleanup and ledger retention, Flutter deletion UI,
external deletion page, and controlled external Google/Resend validation
remained open. The worker execution was added in the dated section below;
policy-dependent cleanup and the other gates remain open. This evidence does
not establish full account-deletion compliance or production readiness; the
release verdict stays **BLOCKED**.

## Account-deletion worker execution (2026-10-23)

The worker entry point is `backend/src/services/accountDeletionWorker.ts`.
`backend/src/server.ts` starts it in the existing backend process after MongoDB
connection and admin bootstrap; no new queue or infrastructure dependency was
introduced. Each tick claims up to ten requests using an atomic MongoDB
conditional update and a five-minute lease. Repeated workers cannot claim the
same request while the lease is valid; an expired lease is eligible for a
subsequent worker invocation. `ACCOUNT_DELETION_WORKER_ENABLED=false` can
disable the timer for an intentionally worker-disabled non-production process.

Implemented safe checkpoints:

- Access marker: ensure the account remains `deletionState=pending`.
- Authentication artifacts: delete password-reset records by `userId` and
  OTP records by the still-owned normalized email/phone identifiers.
- Preferences/devices: clear `bookCollection`, `favourites`, and `fcmTokens`.
- Durable checkpoint writes are lease-owned and skipped on retry once complete.

The worker then records `blocked_policy` with
`POLICY_APPROVAL_REQUIRED`. It does not delete or anonymize User identity,
StorePurchase, SubscriptionPurchase, `purchasedBooks`, subscription
entitlements, financial records, or policy-dependent audit/retention data. It
does not mark deletion completed or cancel a store subscription. Retryable
exceptions record only a sanitized code/fixed message; the original exception
text is not persisted in the deletion record.

Validation after the worker implementation:

- `npm run build` — exit 0.
- `npm test` — exit 0; **114 passed, 0 failed, 0 skipped** (serial bounded
  wrapper; elapsed approximately 3.6 seconds).
- Worker-focused tests cover atomic next claims/lease recovery, policy-gated
  stopping, partial cleanup failure metadata, and restart-safe checkpoint
  skipping.
- `git diff --check` — exit 0 (line-ending normalization warnings only).

No worker was run against MongoDB during validation. No production/shared
database, deployment, migration, secret, purchase, or external provider was
accessed. The worker foundation is implemented, but the release remains
**BLOCKED** until retention/account-recreation/entitlement policy is approved
and the remaining Flutter, external billing, OTP, deletion-surface, target-SDK,
and deployment evidence gates are closed.

## Flutter account-deletion UX (2026-10-23)

Implemented `AccountDeletionScreen` and the Profile settings entry. The
repository layer uses the exact backend contracts:

- `POST /auth/me/deletion-re-auth` with the existing password/PIN credential.
- `POST /auth/me/deletion-request` with the one-time proof and an in-memory
  idempotency key.
- `GET /auth/me/deletion-request` for status restoration and refresh.

The UI requires consequence acknowledgement, credential reauthentication, and
a final confirmation. It handles requested, processing, failed-retryable,
failed-manual, blocked-policy, completed, and unknown states. It never reports
an incomplete request as deleted, does not persist the proof, and explains that
Google Play/App Store subscriptions are not cancelled by app-account deletion.

Added `flutter_app/test/account_deletion_test.dart` for status parsing, the
confirmation flow, duplicate-action prevention through pending states,
policy-blocked rendering, and server-failure handling.

Local validation was attempted but remains blocked by the existing Windows
Dart environment:

- `dart format ...` — no output; interrupted after approximately 15 seconds.
- `flutter test test/account_deletion_test.dart --no-pub` — no output;
  interrupted after approximately 15 seconds.
- `flutter analyze --no-pub` — no output; interrupted after approximately
  15 seconds.

Five existing Dart/DartVM processes were inspected by process name, start time,
CPU, and SDK path; none were terminated. No Flutter pass is claimed. Backend
worker/build/test evidence remains unchanged, and the release verdict remains
**BLOCKED** pending clean-runner Flutter validation, deletion-policy approval,
and the external deletion resource.

## External deletion page and CI formatting evidence (2026-10-23)

Added the public Next.js informational route `/account-deletion` at
`happinotes-admin/app/account-deletion/page.tsx`. The page directs signed-in
users to the existing in-app deletion flow, explains request/status handling,
warns that store subscriptions are separate, and does not collect credentials
or call an authenticated endpoint. No unauthenticated web deletion contract
exists in the backend. No verified public support mailbox was found in the
repository; publication therefore requires owner configuration of
`NEXT_PUBLIC_SUPPORT_EMAIL` and approval of the public contact/domain.

Updated `.github/workflows/clean-validation.yml` so the pinned Flutter job
checks `dart format --output=none --set-exit-if-changed lib test`, then runs
`flutter analyze --no-pub` and repository-wide `flutter test --no-pub`. The
revision is read from `flutter_app/.metadata` and is
`559ffa3f75e7402d65a8def9c28389a9b2e6fe42`; the full test command includes
`flutter_app/test/account_deletion_test.dart` by normal Flutter test discovery.
No hosted workflow run was performed, and the local Flutter commands remain
blocked by the existing Windows Dart-process hang. Release status remains
**BLOCKED**.

### Current disposition clarification (2026-10-23)

Earlier sections in this file preserve historical baselines. The current
evidence should be read as follows: the account-deletion flow and worker
foundation are implemented but remain policy-gated; `/account-deletion` is an
informational, unpublished route rather than a web deletion endpoint; and
publication still requires owner configuration of an approved, verified
`NEXT_PUBLIC_SUPPORT_EMAIL` plus public domain approval. The pinned Flutter CI
checks are configured but hosted validation is **NOT TESTED**; local Flutter
commands remain **BLOCKED** by the existing Dart-process hang. Admin lint and
TypeScript validation are **PASS** locally (0 lint errors, 18 existing
warnings), while the Windows production build remains pending a reliable
clean-runner result. No release gate is closed by these local results; the
overall verdict remains **BLOCKED**.

The subsequent hosted run `39909295456` on commit `527f48c` completed the
admin lint, TypeScript, and production-build job successfully. This supersedes
the local Windows build limitation for hosted admin validation; the backend
and Flutter jobs from that run still failed.

## First hosted clean-validation run (2026-10-23)

The GitHub Actions summary for run `39909295456` records execution on commit
`527f48c` on `main`:

- **Admin lint, type-check, and production build — PASS** (36 seconds shown).
- **Backend tests and build — FAIL** (11 seconds shown).
- **Flutter analysis and tests — FAIL** (35 seconds shown).

The supplied run summary does not expose the failing step or log message for
the backend or Flutter jobs. Their causes therefore remain **UNRESOLVED**, not
inferred from the workflow configuration. No artifacts were shown. The admin
job result is hosted evidence for this commit; backend and Flutter gates remain
open pending the detailed job logs and a corrective rerun.

## Backend dependency and CI ordering repair (2026-10-23)

The backend lockfile was regenerated with npm `10.9.3`. It now contains the
missing nested `mongoose` peer entry for `gcp-metadata@5.3.0`; no unrelated
package-version upgrades were introduced. Because the resolved direct
`google-auth-library@11.1.0` dependency uses `gcp-metadata@9.0.4` (Node `>=22`),
the backend package engine and backend CI job now require Node `22.x`.

The backend workflow was also reordered to build before testing because
`scripts/run-tests.cjs` loads compiled files from `dist`. Isolated validation
with npm `10.9.3` produced:

- `npm ci --ignore-scripts --no-audit --no-fund` — **PASS**, exit 0.
- `npm run build` — **PASS**, exit 0.
- `npm test` — **PASS**, exit 0; **114 passed, 0 failed, 0 skipped**.

These are local isolated results. The hosted workflow must be rerun on the
updated commit before the backend gate can be marked hosted-pass.

Local validation for this page/workflow change:

- `cd happinotes-admin; npx tsc --noEmit` — **PASS**, exit 0 (about 6.9s).
- `cd happinotes-admin; npm run lint` — **PASS**, exit 0; 0 errors and 18
  existing image-optimization warnings.
- `git diff --check` — **PASS**, exit 0 (line-ending normalization warnings
  only).
- No hosted GitHub Actions run was started, so clean-runner formatting,
  analyzer, and test results remain **NOT TESTED**.

## Hosted CI failure analysis and pending rerun (2026-10-23)

The supplied hosted run `39909295456` ran commit `527f48c`. The current
inspection found `HEAD` and `origin/main` at `0f0241f`, whose backend workflow
already selects Node `22.x` and runs the build before tests. The old run's Node
20 dependency/lockfile failure therefore predates the repair; it did not test
the current backend workflow.

The Flutter job's shallow checkout (`fetch-depth: 1`) did not provide the Git
tag/history metadata used by Flutter's version resolver, producing
`0.0.0-unknown`. The workflow now fetches full history and tags while checking
out the exact `.metadata` revision `559ffa3f75e7402d65a8def9c28389a9b2e6fe42`.
It also runs `flutter doctor -v` before `flutter pub get` so the installed
framework metadata is visible in CI logs. This correction is local and
uncommitted; no hosted rerun has been observed.

Validation status:

- Backend isolated clean install with npm `10.9.3`: PASS, exit 0.
- Backend build: PASS, exit 0.
- Backend tests: PASS, exit 0; 114 passed, 0 failed, 0 skipped.
- Flutter format/analyze/tests: NOT TESTED in a hosted runner; local Windows
  commands remain blocked by the previously observed Dart process hang.
- `git diff --check`: PASS, exit 0.

The next evidence event is a new GitHub Actions run on the owner-published
workflow change. Until that run independently confirms Node 22 installation,
backend build/tests, Flutter revision metadata, formatting, analysis, and full
tests, the release verdict remains **BLOCKED**.

## Flutter version-detection repair (2026-10-23)

The pinned Flutter revision remains
`559ffa3f75e7402d65a8def9c28389a9b2e6fe42`. Local full-checkout evidence:

- `git -C C:\src\flutter rev-parse HEAD` — exact pinned SHA.
- `git -C C:\src\flutter tag --points-at <pinned SHA>` — `3.44.0`.
- `git -C C:\src\flutter describe --tags --always --long <pinned SHA>` —
  `3.44.0-0-g559ffa3f75e`.

The workflow now explicitly fetches tags after checkout, logs those metadata
checks, and fails before dependency resolution when the stable tag is absent
or Flutter prints `0.0.0-unknown`. This is a fail-closed diagnostic repair;
it does not hardcode a version, alter `pubspec.yaml`/`pubspec.lock`, or change
the pinned revision. A new hosted run is required to determine whether the
previous failure came from an older commit or hosted checkout metadata.

The metadata verification command completed successfully locally. The Git Bash
syntax probe could not start because the Windows environment raised the known
signal-pipe `Win32 error 5`/spawn limitation; no hosted Flutter command has
been claimed as passing.
