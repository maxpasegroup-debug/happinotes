# Android AAB release checklist

This checklist is for the later controlled release procedure. It was not executed during the audit.

## Identity and policy

- [ ] Confirm Play package/application ID is exactly `com.happinotes.happinotes_flutter`.
- [ ] Confirm the Play app record and the uploaded artifact use the same package identity.
- [ ] Confirm the effective target API from the release manifest; meet the current Play requirement (new apps/updates: API 36+ from 2026-08-31).
- [ ] Complete privacy policy URL, terms/refund/subscription disclosures, Data safety, account-deletion questions, content rating, target audience, and store listing.
- [ ] Confirm the approved commercial model and legacy purchase policy.

## Backend/admin production configuration

- [ ] Verify Railway backend service root/build/start and active commit SHA.
- [ ] Verify admin service root `happinotes-admin`, build `npm run build`, start `npm run start`, domain and landing page.
- [ ] Set production `NODE_ENV`, `PORT`, `MONGODB_URI`, strong `JWT_SECRET`, authoritative admin bootstrap/rotation configuration, Resend/live OTP variables, Firebase service-account JSON, Cloudinary variables, CORS allowlist, and Google Play variables.
- [ ] Confirm `WHATSAPP_OTP_MODE` is live/non-test in production and no OTP is returned in responses.
- [ ] Confirm Mongo indexes, backup/restore runbook, Cloudinary folders/orphan policy, and health endpoint.
- [ ] Confirm Google Play service account has only required Android Publisher permissions and is linked to the Play developer account.

## Signing

- [ ] Keep `flutter_app/android/key.properties` and upload keystore outside Git/CI logs; never print passwords/private keys.
- [ ] Verify the local upload certificate matches the Play Console upload certificate (public fingerprint only).
- [ ] Confirm Play App Signing enrollment and app signing certificate.
- [ ] If the upload key changed, complete the Play Console upload-key reset procedure before upload.

## Build

- [ ] Start from the audited commit and a clean worktree.
- [ ] Run `flutter pub get` only with the committed lockfile and approved dependency policy.
- [ ] Run `flutter test`, `flutter analyze`, backend build/tests, admin TypeScript/lint/build in a clean environment.
- [ ] Build with production API configuration, e.g. `flutter build appbundle --release --build-name 1.0.2 --build-number <new-code>`; choose the next version deliberately. Do not overwrite an existing Play version code.
- [ ] Inspect the generated AAB manifest for package, version, target SDK, permissions, Firebase config, and release-only flags.
- [ ] Compute and record SHA-256, file size, build timestamp, commit SHA, and public signing fingerprints.

## Internal testing

- [ ] Upload the AAB to the internal track manually.
- [ ] Add license testers and confirm they use the Google account that downloaded the Play build.
- [ ] Install from the Play opt-in link; do not certify from a debug/sideloaded APK alone.
- [ ] Test fresh account, login, subscription monthly/yearly, pending/restore, renewal, cancellation, expiry, refund, account switch, and content access.
- [ ] Test catalog creation, coming-soon/new-episode notification, image/deep-link/in-app notification, and FCM token cleanup.
- [ ] Capture Play order/test transaction IDs without putting tokens in reports.

## Production approval

- [ ] No open P0/P1 blocker; all P2 accepted with owner/date.
- [ ] Play pre-launch report and policy checks reviewed.
- [ ] Monitoring, backups, incident contact, rollback/version strategy, and support/refund process ready.
- [ ] Product owner signs the evidence template.

