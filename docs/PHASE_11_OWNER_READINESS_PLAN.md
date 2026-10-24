# HappiNotes Phase 11 — Owner Decisions and Environment Readiness

**Date:** 2026-10-24
**Purpose:** Close the release blockers recorded in [Phase 10](PHASE_10_RELEASE_GATE_AUDIT.md) before considering a signed mobile release.
**Current verdict:** **BLOCKED — owner decisions, store setup, mobile toolchains, database integration evidence, and sandbox/device verification are outstanding.**

This is a local repository/tooling plan. No production services, Railway settings, databases, store consoles, credentials, subscriber records, purchase transactions, or signing materials were accessed. No application code was changed. No release build is authorized by this plan.

## Current local evidence

Phase 10 recorded these local results: backend TypeScript build passed; the isolated backend suite passed 183/183; admin lint passed with 0 errors and 19 image optimization warnings; admin production build passed; and admin auth tests passed 4/4. These tests do not prove live provider/store behavior or MongoDB concurrency.

Local tool inspection for this phase found:

- `flutter`, `dart`, `gradle`, `xcodebuild`, `mongod`, `mongosh`, and `docker` are unavailable on this Windows machine.
- `java` and `adb` are available, but without Flutter/Gradle they cannot build or test this Flutter project.
- `flutter_app/.dart_tool/package_config.json` and `flutter_app/android/key.properties` are absent.
- The repository requires Dart `^3.12.0`; Android package source is `com.happinotes.happinotes_flutter`; iOS bundle source is `com.happinotes.happinotesFlutter`.
- Source requires an explicit `API_BASE_URL`; debug/test reject the known production API host, and release requires HTTPS. The Flutter config tests have not run because Flutter/Dart are unavailable.
- Source requires explicit Apple product mappings; the checked-in example does not supply them. Source defaults or examples are not proof of store catalog setup.
- CORS source requires an explicit production allowlist including the owner-confirmed `https://happinotes.online`. The actual Railway variable and the full production browser-origin list were not inspected.
- Rate limiting currently uses a process-local memory store. A configured shared store is not implemented; requesting a non-memory store fails rather than silently falling back.
- MongoDB concurrency/ownership tests currently use mocks. They do not prove real MongoDB atomic operations, unique indexes, or transaction/claim races.
- The expected Android signing properties/keystore were not found at the checked project locations. This does not establish whether the owner has the existing key stored elsewhere.

## Owner questionnaire

Please answer with product identifiers and non-secret configuration facts only. Do not put passwords, private keys, access tokens, purchase tokens, or other secrets in this document, chat, or source control.

1. **Plan policy:** Should new customers be offered monthly only, or monthly and yearly? Are trials or introductory offers planned? What terms/prices should each store show?
2. **Existing yearly subscribers:** Are yearly subscribers active today? Should yearly remain purchasable for new users? Confirm that all existing users keep their paid access and renewal/restore path while the new plan policy is applied.
3. **Google products:** What are the owner-confirmed Google Play monthly and (if applicable) yearly product/base-plan identifiers? Are these already active in the intended Play app record?
4. **Apple products:** What are the owner-confirmed Apple monthly and (if applicable) yearly subscription identifiers and subscription group? Are they configured in the intended App Store Connect app record?
5. **Store app identities:** Confirm the Play app package and App Store Connect bundle ID. Source currently declares `com.happinotes.happinotes_flutter` and `com.happinotes.happinotesFlutter`; does each console record match?
6. **Non-production API:** What is the owner-approved test/staging API origin? Does it have isolated test data, email delivery and store sandbox configuration? Do not provide production secrets.
7. **Browser origins:** Besides the confirmed admin/customer origin `https://happinotes.online`, which browser origins actually serve the production customer/admin website or other active web clients? Is `https://www.happinotes.online` active? Are any preview domains intended to call production?
8. **Rate limiting:** Is the deployed backend one instance or multiple instances/autoscaled? Is process-local limiting acceptable, or is a shared rate-limit store required before release?
9. **Signing material:** Where is the existing Android upload key held under the owner's approved secure process? Which Apple Developer team/account will provide iOS signing and App Store submission?

## Blocker plan

Each entry lists the safe completion check and the evidence needed. Owner-facing checks in external consoles must be performed by the owner; do not send credentials or sensitive screenshots to Codex. Codex can inspect redacted evidence, update local source/docs when explicitly asked, and run local checks.

### A. Owner decisions

| Blocker / confirmation | Responsible | Safe verification procedure | Completion evidence | Dependencies and risks |
|---|---|---|---|---|
| Decide whether new sales are monthly-only or monthly plus yearly; define trial/introductory offer and customer-facing renewal terms. | Owner decides; Codex can map the decision into source after approval. | Compare the policy against both store catalogs and current app plan presentation in a test environment; do not change prices or plans during this readiness phase. | Written policy with platform-specific terms and confirmation of which plan keys remain purchasable. | Phase 6 reports both plans active by default. A policy change must not erase historical yearly mappings or current entitlements. |
| Determine the existing yearly subscriber population and continuity requirements without exposing personal data. | Owner obtains privacy-safe operational evidence; Codex can review a redacted summary. | Use approved read-only reporting to count/summarize plan/store/status/expiry cohorts; verify a test account's renewal/restore path separately. Do not export emails, tokens, or production records into this workspace. | Redacted aggregate counts, historical product mapping list, owner confirmation that paid periods/renewals remain supported. | Production records and console state were not inspected. Disabling a product/mapping could break renewals or restore for historical users. |
| Confirm app identities, production browser clients, test API, and backend instance/rate-limit expectations. | Owner. | Compare source declarations to owner-controlled Play/App Store records and DNS/deployment inventory. Identify every browser client that calls the backend. Share origins/identity facts only, not credentials. | Written confirmation of package/bundle IDs, full browser-origin list, non-production API origin, and single-/multi-instance topology. | Incorrect CORS origins break clients; an incomplete origin inventory blocks a restrictive production allowlist. Memory rate limits do not coordinate across instances. |

### B. Store-console configuration

| Blocker / confirmation | Responsible | Safe verification procedure | Completion evidence | Dependencies and risks |
|---|---|---|---|---|
| Google Play app identity, subscription products/base plans, active state, markets, prices and offer terms. | Owner in Play Console; Codex can compare confirmed IDs against local mappings. | Inspect the existing Play app record and each intended monthly/yearly subscription/base plan. Confirm identifiers exactly; do not rely on source fallback values. Check local prices/renewal terms and test-track availability. | Redacted checklist with package, product/base-plan IDs, billing periods, active/test status, market/price review and owner sign-off. | Must first decide new-plan policy and confirm package identity. A mismatch means products are not discoverable or verification fails. |
| Google server verification and RTDN configuration. | Owner configures Google Cloud/Play; Codex can perform local validation after safe non-production config is supplied. | Confirm service-account access to the exact Play app and API; verify Pub/Sub topic/subscription, OIDC audience/email and configured package. Deliver a test notification to a non-production endpoint and confirm backend re-queries current Play state. Never expose service-account JSON. | Owner confirms permission and notification setup; sanitized successful test delivery and corresponding non-production entitlement update. | Purchase must be verified by Play before entitlement. Notification setup and lifecycle behavior were not externally tested; an unauthorized/mismatched identity must fail closed. |
| Apple app identity, subscription group, product identifiers, terms, agreements and sandbox tester setup. | Owner in App Store Connect; Codex can compare confirmed identifiers with backend mappings. | Verify the app record/bundle, exact monthly/yearly subscription products and group, status, localized pricing/terms, agreements and sandbox testers. Do not invent or guess identifiers. | Redacted console checklist with exact owner-confirmed product IDs, group, periods, status, agreement/tester readiness and sign-off. | Apple IDs are blank/unset in the checked-in example. Requires owner policy and bundle identity confirmation. Missing/incorrect mapping intentionally blocks iOS purchase. |
| Apple server verification keys/IDs, trusted roots, environment and App Store Server Notifications V2. | Owner configures; Codex checks only variable names/presence in a safe non-production environment if later authorized. | Confirm server-side configuration from Apple-issued materials in the approved secret store; match bundle/App ID and Sandbox/Production mode; configure notification URL/version and test a sandbox notification. Do not paste credentials/JWS into reports. | Owner attestation of configuration, redacted notification test receipt/event result, and successful backend lookup against Sandbox. | No configuration values were read. The source checks provider requirements when called; mock tests do not prove Apple authentication or delivery. |
| Existing yearly product and restore/renewal compatibility on both stores. | Owner performs console and test-account confirmation; Codex can investigate failures locally. | Keep historical product mappings available. With a test account representing each store path, restore/renew an existing yearly test purchase under the same HappiNotes account; verify wrong-account claim is rejected. Do not use a real subscriber's purchase data as a test. | Redacted same-user restore/renewal results and cross-user rejection for each applicable store; owner confirms actual legacy SKU continuity. | Actual subscribers were not inspected. Apple legacy transactions without account binding and historical Google claim formats may need an owner-approved recovery procedure; never grant based only on client claims. |

### C. Flutter and Android tooling

| Blocker / confirmation | Responsible | Safe verification procedure | Completion evidence | Dependencies and risks |
|---|---|---|---|---|
| Install/select a Flutter SDK compatible with the repository (`Dart ^3.12.0`) and resolve packages. | Owner on Windows development machine. | Install Flutter through the official Flutter setup process, open a new terminal, run `flutter --version` and `flutter doctor -v`; from `flutter_app/`, run `flutter pub get`. Keep the SDK and lockfile policy consistent with the repository; do not upgrade dependencies just to clear a warning. | Captured SDK/Dart versions, successful `flutter doctor -v`, and successful dependency resolution. | Current machine has no Flutter/Dart or `.dart_tool` config. Network/package access may be needed on owner's machine. SDK incompatibility could alter generated/package state; review lockfile changes before keeping them. |
| Run Flutter static analysis and tests with an explicit non-production API. | Owner runs; Codex can diagnose from sanitized output. | From `flutter_app/`, run `flutter analyze` and `flutter test`. For any runtime test/manual debug session requiring API traffic, explicitly pass `--dart-define=API_BASE_URL=https://<confirmed-test-api>`; ensure this is a non-production host. Source config rejects implicit/known production selection in debug/test. | Full command output showing zero analysis errors and passing tests; record explicit test API environment by name/origin only. | Flutter tests have not run. Production API use during debug/testing risks modifying live accounts/content. A test alias that resolves to production is not safe. |
| Confirm Android package, resolved target SDK/version code, Android SDK/toolchain, and existing upload-key availability. | Owner confirms Play identity and locates existing key securely; Codex can review non-secret Gradle metadata. | Confirm Play Console package matches `com.happinotes.happinotes_flutter`. Install Android Studio/SDK and compatible Flutter tooling; run `flutter doctor -v`. Inspect the resolved `targetSdk` and `versionCode` from a local non-release configuration/source. Check that the existing upload key works through the approved secure signing path without displaying passwords or exporting it. Do not create/rotate keys. | Redacted Play identity match; resolved target SDK/version; owner confirmation that the existing upload key is available and recognized by Play. No private key or password copied into repo/chat. | Local `key.properties` and checked expected keystore paths are absent. Flutter target SDK/version are delegated to Flutter values and were not resolved. This gate remains open until key ownership/availability is verified. |
| Check release signing configuration and distribution prerequisites without creating a release artifact. | Owner supplies local secure configuration; Codex can review build config only after owner prepares it. | After all non-signing gates pass, use a local signing preflight or approved CI secret binding to confirm Gradle selects the intended upload key; do not build an AAB in this phase. Keep `key.properties` and keystore out of source control. | Sanitized proof of signing config resolution, key alias/certificate fingerprint matched to Play's registered upload certificate, and clean repository status for credentials. | Release build is expressly out of scope now. Losing/replacing the upload key can prevent updates. Verify backup/recovery policy with the owner. |

### D. iOS/macOS requirements

| Blocker / confirmation | Responsible | Safe verification procedure | Completion evidence | Dependencies and risks |
|---|---|---|---|---|
| Provide a supported macOS/Xcode environment and validate the iOS project with compatible Flutter tooling. | Owner. | On the Mac, install/select the Flutter version required by the repo and Xcode version supported by that Flutter release. Run `flutter doctor -v`, then from `flutter_app/` run `flutter pub get`, `flutter analyze`, and `flutter test`. Validate the iOS project in Xcode without archiving/signing for distribution. | Sanitized tool versions, clean `flutter doctor` relevant to iOS, passing analysis/tests and successful project open/build validation that does not create a release archive. | `xcodebuild` is unavailable on Windows. Flutter/Dart are also missing locally. iOS verification cannot be substituted by source inspection. |
| Confirm App Store Connect app record, bundle ID, signing team, certificates/profiles, review materials. | Owner in Apple Developer/App Store Connect; Codex can inspect non-secret project settings. | Confirm source bundle `com.happinotes.happinotesFlutter` matches the app record. Confirm team, distribution certificate, provisioning profile, capabilities, app privacy/support listing and reviewer access. Verify signing readiness on the owner-controlled Mac without uploading or submitting. | Redacted identity/team/profile/capability checklist and successful local signing-preflight result; no certificates/private keys shared. | Store record and signing assets were not examined. App ID/product mapping and paid agreement are prerequisites for sandbox/review. |
| Confirm signed-archive prerequisites only after all other gates close. | Owner approves; Codex may assist if explicitly asked. | Review archive settings, version/build number, entitlements and signing identity. Do not create an archive in this phase. | Owner's explicit sign-off that all mandatory gates and submission metadata are ready. | This is a final gated action; archive/signing is prohibited until explicit owner approval after evidence review. |

### E. Disposable MongoDB integration testing

| Blocker / confirmation | Responsible | Safe verification procedure | Completion evidence | Dependencies and risks |
|---|---|---|---|---|
| Provision a disposable MongoDB for tests only. | Owner provides local/container/CI test service; Codex can add tests/use it. | Use a fresh isolated database with a clearly test-only URI and no production credentials/network route. Before running any test, verify the selected database host/name is disposable and ensure cleanup is limited to that database. Never use Railway or production connection strings. | Test setup instructions and a sanitized assertion that tests connect only to the designated disposable instance; successful create/drop of a uniquely named test database. | No MongoDB server/client/container tooling or integration harness is available here. A typo in the URI can destroy or alter real data; require explicit host/database safeguards. |
| Verify real atomicity, uniqueness and user ownership. | Codex implements/runs tests against disposable DB after safe infrastructure exists; owner reviews test scope. | Run parallel requests against the real Mongoose model/indexes for email OTP challenge consumption and attempt limits, reset OTP consume/session revocation, unique store transaction claim, same-owner restore, cross-owner rejection, duplicate/out-of-order notification state, and competing entitlement writes. Confirm indexes are actually created in test DB. | Test output proving only one successful consume/claim where required; counter never exceeds policy; wrong user receives no entitlement; duplicate/stale event cannot override newer state; test DB cleanup evidence. | Existing mocked concurrency tests are useful regression checks but cannot establish Mongo behavior. Mongo deployment/index/version differences may expose failures. Do not add production migrations as part of test setup. |

### F. Production configuration verification

| Blocker / confirmation | Responsible | Safe verification procedure | Completion evidence | Dependencies and risks |
|---|---|---|---|---|
| Confirm Railway variable presence/policy without revealing values or changing settings. | Owner inspects Railway; Codex does not access the Railway project. | Compare required variable *names* from `backend/.env.example` and startup validators to configured service settings. The owner checks presence, scope and environment in Railway. Do not paste values or screenshots with values; do not change variables in this phase. | Owner checklist marks each required name present/absent and correct environment/scope; any mismatch recorded by variable name only. | This phase does not verify actual values or live behavior. Avoid logging, copying, or transmitting secrets. Store verification configuration is evaluated during provider calls and can be incomplete while startup still succeeds. |
| Validate production CORS against all active browser clients. | Owner confirms clients/origins; Codex can review local source config/tests. | Build a canonical origin inventory (scheme + host + optional port; no path). Confirm owner-known `https://happinotes.online` and decide whether `www` or other client/preview origins are real production clients. Ensure preview deployments do not use production API unless explicitly intended. Compare exact list to Railway value without exposing other variables. | Owner-signed origin list, source CORS tests passing for Express and Socket.IO policy, and Railway allowlist confirmed to match. | Missing or extra origins can break access or expose API to unwanted browser origins. No real origin besides the confirmed domain should be assumed. Actual Railway value was not read. |
| Confirm JWT, admin, Resend and phone OTP production policies. | Owner checks secret store/config; Codex can verify source validator using synthetic tests only. | Confirm strong JWT secret exists without revealing it; valid admin email is configured; Resend key/from address are present; WhatsApp/phone OTP mode is disabled because there is no production phone provider. Validate actual email delivery only through a non-production account/test API. | Owner confirms presence/policy by variable name; successful non-production email OTP delivery; no raw values in report/logs. | A source validator passing with synthetic values does not prove Railway is configured. Resend sender/domain setup and provider delivery were not externally checked. |
| Decide whether process-local rate limiting fits the actual topology. | Owner decides topology/risk; Codex implements a shared store only after explicit approved architecture/task. | Confirm instance count/autoscaling. If one instance, document the residual restart/replica limitation and owner acceptance; if multiple instances, choose a supported shared store and require tested startup failure/behavior before claiming shared protection. Current unsupported shared mode fails closed. | Written topology and risk acceptance, or implementation/configuration plus multi-instance integration test evidence for an approved shared store. | Current counters are per process and can be bypassed across instances/restarts. Do not describe them as distributed. No shared store is implemented. |

### G. Manual and sandbox testing

| Blocker / confirmation | Responsible | Safe verification procedure | Completion evidence | Dependencies and risks |
|---|---|---|---|---|
| Exercise customer authentication, session, admin authorization and account recovery. | Owner uses test accounts; Codex can investigate defects. | Against a dedicated non-production backend, test email signup/challenge, resend cooldown, expiry/wrong attempts, sign-in, password reset and old-token revocation, new login, logout, profile/favourites, admin login and server-side role checks. Confirm email via Resend only in test environment. | Sanitized checklist with outcome/timestamp and no passwords, OTPs, JWTs, personal emails or raw provider errors. | Automated tests passed but provider and browser/device experience remain unverified. Never test using production user accounts or real recovery codes. |
| Exercise audiobook creation/media safety and app visibility. | Owner on staging/test storage; Codex can resolve local defects. | Create/edit books with valid image/MP3; attempt executable/unsupported input; simulate upload failure; add/reorder/remove lessons; preview; verify draft/publish/unpublish visibility for ordinary account. Confirm failure preserves form state and does not leave public partial books. | Test record with file types/sizes, storage result, cleanup result, visible/published status and no public URLs containing sensitive data. | Local media tests and admin build passed, but real Cloudinary permissions/storage timeout and browser flows were not run. Use test bucket/account, not production content. |
| Complete Google Play internal-test purchase/lifecycle matrix. | Owner runs using license tester/test track; Codex supports defects. | Once exact catalog and API config are confirmed, test fresh monthly (and yearly if offered), same-account restore on second install, wrong-account restore rejection, renewal, failed payment/recovery, grace/hold, expiry, refund/revocation, duplicate/out-of-order RTDN, acknowledgment and premium content gating. Exercise only sandbox/test track accounts. | Redacted store order/test reference, product/plan/expiry/state, notification delivery outcome and app/backend entitlement result for each row. Keep purchase tokens and account data private. | Product, Play API access, test track, package and RTDN setup must be complete first. Mock tests are not live store evidence. |
| Complete Apple Sandbox/TestFlight purchase/lifecycle matrix. | Owner runs using sandbox testers; Codex supports defects. | Once exact Apple IDs and server config are confirmed, test fresh monthly (yearly only if offered), same-account restore, wrong-account rejection, renewal, billing retry vs grace and recovery, expiry, refund/revocation, duplicate/out-of-order notifications and content gating. Preserve old yearly SKU/restore checks where existing subscribers are affected. | Redacted transaction reference, product/plan/verified expiry or grace expiry, notification result and app/backend entitlement result. Never share signed payloads or credentials. | App Store Connect record, agreements, products, sandbox testers and notification URL must exist. Source status logic and mocks do not prove Apple production authenticity/delivery. |
| Run end-to-end cross-platform and store review readiness. | Owner on Android/iOS test devices; Codex can fix scoped issues. | Verify login, reset, book listing/playback/background audio, premium gating, purchase/restore, privacy/support links, store descriptions/screenshots and reviewer access on both platforms. Use non-production data and approved test products. | Signed-off device matrix, store listing/reviewer checklist and redacted crash/error review. | Flutter tests/toolchains and real sandbox flows are prerequisites. Do not use a production transaction to compensate for a missing sandbox test. |

## Non-production store test matrix

Complete the applicable rows on **both** Google Play and Apple. If a plan is not offered to new users, record that policy and still verify historical yearly restore/renewal when applicable. For every row, retain redacted evidence: test platform/environment, test account label (not email), product/plan, time, result, provider state, verified expiry/grace expiry, notification result, and whether premium content was accessible.

| Scenario | Google Play non-production procedure | Apple Sandbox/TestFlight procedure | Pass evidence |
|---|---|---|---|
| Catalog discovery and displayed terms | Test account sees only configured active product/base plan; localized store price and renewal term are accurate. | Sandbox tester sees only explicitly mapped Apple product; localized store price/term is accurate. | Product matches owner-approved mapping and customer-visible terms; no guessed/fallback product is treated as configured. |
| New monthly purchase | Buy once in internal/test track; backend verifies with Play before access. | Buy once with sandbox tester; backend verifies signed transaction/current status and account token. | One correct same-user ledger claim and access through verified period. |
| New yearly purchase (if policy allows) | Repeat for yearly base plan. | Repeat for explicit Apple yearly product. | Correct yearly plan/period/expiry; if disabled for new sales, existing legacy path remains intact. |
| Same-account restore | Reinstall/second device, authenticate same HappiNotes account, restore. | Restore same Apple transaction while signed in to the same account. | Existing owner claim restored and verified current expiry returned; no duplicate entitlement. |
| Cross-account restore | Try the same store purchase while signed in as another HappiNotes user. | Repeat with a different HappiNotes user; validate account-token/ledger ownership. | Backend rejects claim; second user receives no premium access. |
| Renewal and duplicate delivery | Allow/accelerate a renewal; deliver duplicate RTDN and verify current Play state. | Allow/accelerate renewal; deliver duplicate notification and verify current Apple status. | Expiry advances from provider evidence; duplicate events are idempotent. |
| Failed billing, recovery and grace | Exercise payment failure, recovery, grace/hold states through supported test controls. | Exercise billing retry, verified grace, and billing recovery with Sandbox controls. | Access follows provider-verified expiry/grace only; billing retry alone does not overgrant. Recovery updates current state. |
| Expiration | Let a test subscription and any grace period expire. | Let Sandbox subscription and any grace period expire. | Backend denies premium at verified expiry; UI reflects expired state. |
| Refund/revocation | Refund/revoke test purchase; observe current state/RTDN. | Revoke/refund test transaction; observe signed status/notification. | Matching claim loses access; other users/transactions remain unchanged. |
| Out-of-order/stale notification | Replay an older test event after newer state. | Replay an older signed test notification after newer state if test tooling permits. | Current authoritative provider state and monotonic guard prevent rollback. |
| Yearly legacy continuity | Use a test account/legacy mapping that matches a historical yearly path. | Use a test account/legacy Apple claim if available; confirm owner-binding assumptions. | Renewal/restore works for owner and preserves already-paid period; unsupported legacy cases are documented and have a support/recovery path. |

Raw Google purchase tokens, Apple JWS/signed payloads, provider credentials, OTPs, emails and passwords must never be placed in this report, test output, or routine logs.

## Disposable MongoDB integration test scope

These tests must target an isolated, disposable test database only. **Production, Railway, and any database containing real users/subscribers are expressly excluded.** Verify the URI and database name before execution. Use synthetic users and test products, unique database names, and cleanup constrained to that test database.

Required integration cases:

1. Parallel signup/email OTP guesses: persisted attempt counter reaches the configured maximum and challenge consumption succeeds only once.
2. Parallel password-reset guesses and concurrent correct reset: no attempt-limit bypass; code claim, password change and session revocation remain atomic/consistent; replay is rejected.
3. Session version: old token rejected after reset, new token accepted, unrelated user's token still accepted, database role still controls admin access.
4. Store claim uniqueness: parallel duplicate transaction/purchase claims create one ledger owner; cross-user claim fails; same-user restore succeeds only after provider verification.
5. Notification idempotency/order: duplicate events are safe; stale events cannot roll verified current status backward; expiry/revocation changes the correct user's entitlement only.
6. Schema/index verification: expected unique and lookup indexes exist in the disposable database; tests exercise actual Mongoose operations rather than model stubs.

Completion requires passing output against the disposable server, confirmation of database/version/index setup, and proof the test URI was not production. Mocked tests remain valuable but do not satisfy this gate.

## Windows owner setup checklist — Flutter and Android

1. Install a Flutter SDK whose bundled Dart satisfies the repository's `^3.12.0` constraint. Use the official Flutter Windows installation instructions and keep the SDK path stable.
2. Install Android Studio and the required Android SDK/platform/build tools. Install Git and any Flutter-required Windows tooling from official sources.
3. Add Flutter and Android SDK tools to PATH; open a fresh PowerShell terminal and run `flutter --version`, `dart --version`, `flutter doctor -v`, `java -version`, and `adb version`.
4. Resolve only the warnings needed for Android development. Do not change SDK constraints or dependency versions just to silence warnings.
5. From `D:\APPS\WEB\happinotes\flutter_app`, run `flutter pub get`, `flutter analyze`, and `flutter test`. Review any generated lockfile/worktree changes; preserve existing work.
6. For manual debug/API tests, pass the owner-confirmed non-production API explicitly, for example `flutter run --dart-define=API_BASE_URL=https://<confirmed-test-api>`. The placeholder is not a URL to use. Do not omit the define or use production for tests.
7. Confirm Android source package against Play Console; resolve target SDK/version values from the selected Flutter setup. Do not create/sign an AAB during this readiness phase.
8. Locate the existing upload keystore using the owner's secure process. Do not create, rotate, email, upload to chat, commit, or print it. Do not store its password in source control. Only prepare signing after all release gates pass and owner approval is explicit.

## macOS owner setup checklist — iOS

1. Use a supported Mac with the Xcode version compatible with the selected Flutter SDK; install Flutter/Dart and Xcode command-line tools.
2. Run `flutter doctor -v`, `flutter --version`, `dart --version`, and `xcodebuild -version`.
3. From the repository's `flutter_app/` directory run `flutter pub get`, `flutter analyze`, and `flutter test`.
4. Open the iOS project/workspace in Xcode and confirm bundle ID `com.happinotes.happinotesFlutter` matches the owner-confirmed App Store Connect app. Check team, capabilities, deployment target and version/build settings.
5. Confirm signing certificate and provisioning profile through the owner's Apple Developer account. Do not export or share private signing material.
6. Validate a non-distribution test run and sandbox purchase using an approved test API. Do not create an App Store archive, upload, or submit in this readiness phase.

## Final release approval checklist

No Android AAB or iOS archive is authorized until **every mandatory item below passes and the owner explicitly approves signing after reviewing the evidence**.

- [ ] Phase 10 local backend build/tests and website lint/build/auth tests still pass on the final reviewed source.
- [ ] Flutter packages resolve; `flutter analyze` and `flutter test` pass on compatible SDK; API configuration is explicit and tested against non-production.
- [ ] Disposable MongoDB integration tests pass for atomic OTP/reset/session and purchase ownership/notification behavior.
- [ ] Monthly/yearly policy and existing yearly subscriber continuity are documented and approved.
- [ ] Google app/product/base-plan identifiers, terms, developer API access, RTDN identity/setup and test track are owner-confirmed and tested.
- [ ] Apple bundle/product/group/terms, agreements, server verification configuration and notification setup are owner-confirmed and tested.
- [ ] Real Google and Apple sandbox/test-track evidence covers purchase, restore, wrong-account rejection, renewal, failure/recovery/grace, expiry, refund/revocation and notification duplication/order.
- [ ] Android package, resolved SDK/version and availability/ownership of the existing upload key are confirmed; iOS bundle/team/signing/profile/App Store configuration are confirmed.
- [ ] Owner confirms required production configuration names/presence securely, complete CORS origin inventory and allowlist, email readiness, API environments and rate-limit topology policy.
- [ ] Manual Android/iOS/browser checks, admin audiobook/media checks, playback/premium gating, privacy/support/store listings and reviewer access are complete.
- [ ] Final diff and release evidence are reviewed; no secret or production data is included in the report or repository.
- [ ] **Owner explicitly approves the specific signed release build after all mandatory gates pass.**

Until these conditions are met, keep the release gate **BLOCKED**. A passing mocked test, a source default, or a configuration example cannot substitute for owner/store-console/device evidence.

## Phase 10 cross-check

All Phase 10 gates are represented above:

| Phase 10 gate | Plan sections |
|---|---|
| 1 Backend build/full suite | Current local evidence; final approval checklist |
| 2 Website lint/build | Current local evidence; manual/sandbox testing; final checklist |
| 3 Authentication/session | Production configuration; manual/sandbox testing; final checklist |
| 4 Audiobook/media | Manual/sandbox testing; final checklist |
| 5 Google billing | Store-console configuration; Google matrix; final checklist |
| 6 Apple billing | Store-console configuration; Apple matrix; final checklist |
| 7 Yearly subscribers | Owner decisions; store-console compatibility; matrix; final checklist |
| 8 Flutter/API environment | Flutter/Android section; Windows checklist; final checklist |
| 9 MongoDB concurrency/ownership | Disposable MongoDB section; final checklist |
| 10 Android identity/signing | Flutter/Android section; Windows checklist; final checklist |
| 11 iOS identity/signing | iOS/macOS section; final checklist |
| 12 Production secrets/config/CORS/rate limits | Production configuration section; questionnaire; final checklist |
| 13 Sandbox evidence/owner actions | Store-console configuration; manual/sandbox matrix; final checklist |

## Recommended next action

The owner should first answer the questionnaire's subscription policy, existing yearly subscriber, exact store product/app identity, non-production API, browser-origin and rate-limit questions. With those decisions, prepare the store sandbox/test tracks and the owner's Windows/macOS toolchains. Keep all credentials in their approved secret stores and keep all tests on non-production services. Codex should next receive the answers and sanitized evidence, then close local Flutter/MongoDB and source-level follow-ups without accessing production or signing a release.
