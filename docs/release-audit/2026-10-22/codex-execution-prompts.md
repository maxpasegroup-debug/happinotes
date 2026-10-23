# Ready-to-paste Codex execution prompts

Each prompt is intentionally scoped. Paste one phase at a time after reviewing its evidence. Every prompt prohibits unrelated refactoring and production actions.

## Phase 1 — payment security and credential hardening

> Inspect the existing HappiNotes code at the current commit before editing. Preserve all existing behavior and user changes. Fix only the confirmed release blockers in `backend/src/services/subscriptionPurchase.ts`, `backend/src/routes/storePurchaseRoutes.ts`, `backend/src/config/ensureAdmin.ts`, and `backend/src/config/env.ts`: require exact Google external-account binding, classify acknowledgement outcomes without swallowing arbitrary errors, remove the hard-coded admin password/authoritative email mismatch, and fail closed for production test OTP mode. Do not print or rotate secrets, change production data, deploy, or refactor unrelated code. Add focused unit tests for missing/malformed/mismatched account IDs, replay/account-switch attempts, already-acknowledged/transient/fatal acknowledgement errors, bootstrap configuration, and OTP response redaction. Run only the relevant tests plus TypeScript build and report exact outcomes and remaining risks.

## Phase 2 — subscription-only model decision and lifecycle

> First inspect current `SubscriptionPlan`, `StorePurchase`, `StoreProduct`, `Content`, mobile purchase screens, and admin content routes. Do not delete legacy records or routes. Produce a migration design for the approved subscription-only model, preserving historical customer entitlements and rollback. If implementation is authorized, change only the smallest required compatibility layer, then add tests for monthly/yearly purchase, restore, renewal, cancellation, grace/account-hold behavior, expiry, refund, duplicate/out-of-order notifications, and legacy entitlement. Do not touch Play production data or deploy.

## Phase 3 — backend production hardening

> Inspect the existing Express app and tests. Add bounded upload sizes/counts, explicit production CORS/Socket.IO allowlists, auth/upload/verification rate-limit coverage, required-environment validation, safe health/dependency behavior, and indexes only where query evidence supports them. Preserve Cloudinary and current API compatibility. Do not log secrets, run migrations against production, or upgrade dependencies arbitrarily. Add tests for oversized/malformed uploads, denied origins, rate limits, startup env matrix, and index/query behavior. Run backend build/tests/lint and report exact results.

## Phase 4 — Flutter release readiness

> Inspect the current Flutter app and preserve the subscription/realtime changes. Do not redesign screens or change the commercial model. Fix only confirmed defects in auth/session, subscription product availability, pending/restore/error handling, FCM observability, account deletion entry point/link, and release configuration. Configure iOS only if explicitly in scope. Add/update widget/unit tests and run Flutter test/analyze in a clean environment. Do not generate/upload a production artifact. Report package, version, target SDK, API URL, and manual device test evidence.

## Phase 5 — admin and Railway readiness

> Inspect `happinotes-admin` and Railway configuration. Preserve the landing page at `/` and admin login at `/admin/login`. Repair only dependency/tooling issues needed for deterministic TypeScript/lint/build validation, without arbitrary upgrades. Verify plan-price save, Google sync warning behavior, media upload, coming-soon/new-episode notification, auth/role denial, and API URL. Do not deploy or change Railway variables. Report root/build/start/domain/commit requirements and exact command outcomes.

## Phase 6 — end-to-end QA

> Using the approved internal-test build and non-production/test accounts, execute every journey in `release-evidence-template.md`: auth, content, playback, subscription lifecycle, restore/refund, account switch, FCM/in-app notifications, Cloudinary media, offline/timeouts, and admin catalog updates. Do not change source or production data during test execution. Record device/OS, Play track, version code, backend/admin commit, timestamps, request IDs, and outcomes. Stop and report any P0/P1 failure.

## Phase 7 — signed AAB candidate

> Inspect signing configuration and Play certificate identity without exposing private material. Starting from a clean audited commit, run approved validation, increment version code, build a release AAB with production API configuration, inspect manifest/target SDK/permissions, compute SHA-256, and write evidence. Do not upload to Play or modify production. If signing or target evidence is missing, stop with a precise blocker.

## Phase 8 — internal track and production gate

> Do not upload without explicit operator confirmation. Prepare the Play Console checklist, verify the AAB identity/signature/version, and execute only the authorized internal-track workflow. Test the Play-distributed build, review pre-launch/policy/Data safety/account-deletion evidence, and produce a go/no-go report. Never claim production readiness from a successful upload alone; require the full evidence template and unresolved-risk sign-off.

