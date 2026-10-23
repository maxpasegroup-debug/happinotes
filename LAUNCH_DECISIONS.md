# HappiNotes mobile launch decisions

This document records the decisions for the Android and iOS launch. The customer
mobile app is built once from the Expo project in `mobile/` and released as a
separate Android build and iOS build.

## Phase 0 — Launch foundation

| Decision | Launch choice | Evidence / status |
| --- | --- | --- |
| Supported mobile source | Expo app in `mobile/` only | Recorded. `flutter_app/` is legacy/alternate and is not part of launch builds. |
| Android package ID | `com.happinotes.app` | Already configured in `mobile/app.json`; keep stable. |
| iOS bundle ID | `com.happinotes.app` | Already configured in `mobile/app.json`; keep stable. |
| Production API | `https://happinotes-production-6b44.up.railway.app/api` | Selected from the previous EAS build profiles. Add this to EAS `production`; live `/health` response still needs confirmation in Railway. |
| Release API environment | Separate EAS `development`, `preview` (test), and `production` environments | Build profiles are separated. Production URL is known; development and test API URLs still need to be provisioned in EAS. Test/store code rejects missing or localhost API URLs. |
| Membership name | **HappiNotes Premium** | Chosen for launch. |
| Membership term | Monthly, auto-renewing through the relevant app store | Store products and billing code will be implemented in later phases. |
| Membership benefits | Unlock all premium audiobooks and non-preview chapters | Free books remain available without membership. |
| Free trial | None for the first release | Can be reconsidered after launch. |
| Cross-platform account access | One verified membership unlocks the same HappiNotes account on Android and iOS | Store purchase/restore remains native to the platform where it was made. |

## Phase 0 completion check

- [x] Set Expo `mobile/` as the only launch mobile app.
- [x] Record stable Android and iOS identifiers.
- [x] Select the API host already used by EAS and align deployment documentation.
- [x] Record the monthly membership name, benefits, trial choice, and sharing rule.
- [x] Separate EAS development, test, and production build environments.
- [x] Prevent test and store builds from silently falling back to localhost.
- [ ] Verify the selected Railway `/health` endpoint in the Railway dashboard or from a network that can reach it.
- [ ] Create a separate staging backend before using preview builds for purchase testing.

The remaining unchecked items require access to Railway or a staging deployment;
they cannot be confirmed from repository files alone.

## Phase 1 - Expo-only project structure

- [x] Establish `mobile/` as the only active customer mobile app.
- [x] Keep the Flutter source for reference and label it archived.
- [x] Add one root project map and replace the generic Expo starter instructions.
- [x] Keep the staff website documented as a separate web app.
- [x] Add distinct EAS profiles for development, test, and store distribution.
- [x] Remove API URLs from profile literals and use named EAS environments.
- [x] Add a local API environment example and fail EAS builds with a missing or
  invalid API URL; test/store builds reject localhost and require HTTPS.
- [ ] Add `EXPO_PUBLIC_API_URL` to EAS `development`, `preview`, and `production`
  environments. Development and test endpoints still need to be provisioned;
  production must be entered using the selected URL above.

## Phase 2 - Email/password authentication

- [x] Use email and password for Expo sign-up and sign-in.
- [x] Normalize email case and trim whitespace on the app and API.
- [x] Keep account passwords as bcrypt hashes.
- [x] Remove phone/PIN/WhatsApp routes from the active Expo app and API.
- [x] Send reset codes through the Resend API from the backend only.
- [x] Hash reset codes, expire them after ten minutes, allow one use, and limit
  requests and guesses.
- [x] Return the same reset-request response for registered and unknown emails.
- [x] Remove the known JWT fallback and reject weak production secrets.
- [x] Remove automatic admin promotion from public email/phone sign-up.
- [ ] Set production `RESEND_API_KEY`, verified `RESEND_FROM`, and a strong
  `JWT_SECRET` in Railway before deploying the backend changes.
- [ ] Plan migration for any existing phone-only accounts before switching the
  production database. Such accounts cannot sign in until associated with a
  real email and password.

## Phase 3 - Store subscriptions

- [x] Define one HappiNotes Premium monthly membership with no trial and the
  existing premium audiobook/chapter benefits.
- [x] Define separate, stable Apple and Google product IDs and entitlement rules
  in [`STORE_PRODUCTS.md`](STORE_PRODUCTS.md).
- [x] Record cancellation, billing problem, refund, restore, and device-switch
  behavior.
- [ ] Create both store app records and subscription products; requires access
  to App Store Connect and Google Play Console.
- [ ] Confirm the matching price tiers and complete store listing/review details.
- [x] Replace Razorpay with native store billing and backend transaction
  verification; Razorpay purchase code has been removed.

Phase 3 is not launch-ready until the store records and native purchase,
verification, restore, and notification flows are complete. See
[`STORE_PRODUCTS.md`](STORE_PRODUCTS.md) for the canonical mapping and checklist.

The native purchase and verification source work was completed in Phase 4;
store records, credentials, and lifecycle notifications remain external setup.

## Phase 4 - Store purchase flow

- [x] Add Expo IAP native build support and retrieve platform product pricing
  from the store.
- [x] Support subscription purchase, pending payment, cancellation/failure, and
  restore.
- [x] Verify purchase evidence on the backend with the Apple and Google APIs,
  bind purchases to the signed-in account, and grant Premium only after a
  successful verification.
- [x] Remove the retired Razorpay purchase flow and its deployment settings.
- [ ] Configure App Store Connect/Google Play products and Railway verifier
  credentials, then complete sandbox tests on physical devices.
- [ ] Configure Apple Server Notifications and Google RTDN so refunds and
  subscription state changes propagate promptly.

Phase 4 source implementation is in place. Test-store purchases cannot grant
access while verifier credentials are missing; configure them and create the
store products before running sandbox tests. Expo IAP requires a custom native
development build, not Expo Go.

## Phase 6 - Cross-platform release verification

- [x] TypeScript check, lint, Expo configuration, app identifiers, production
  API URL validation, and localhost rejection checked in the repository.
- [x] Confirm no fixed/test OTP behavior or OTP logging path in mobile/backend
  source; reset codes are generated and delivered through the backend email
  service.
- [ ] Install and check all primary flows on real Android and iOS devices.
- [ ] Complete Apple Sandbox/TestFlight and Google Play test-track purchases,
  renewals, cancellation, refund/revocation, restore, and second-device access.
- [ ] Confirm public privacy policy and support contact, store listing assets,
  descriptions, and reviewer access are ready.
- [ ] Add the production API URL to EAS `production`, provision development and
  preview APIs, build and install both store artifacts, and confirm Railway
  `/health` from an unrestricted network.

The written acceptance checklist is [`PHASE6_DEVICE_CHECKLIST.md`](PHASE6_DEVICE_CHECKLIST.md).
Repository checks passed. Device/store checks and store review materials remain
open because this workspace has no EAS CLI, physical test devices, store account
access, or published privacy/support details. The production API health endpoint
could not be reached from this workspace during this pass.

## Phase 7 - Store release

- [ ] Build production Android and iOS binaries after the Phase 6 gates pass.
- [ ] Upload to Google Play and App Store Connect and submit each store record
  for review.
- [ ] Maintain active review credentials and store-specific review notes.
- [ ] After approval, monitor production auth, playback, purchase verification,
  store notification, and entitlement errors.

Release is not submitted. Follow [`PHASE7_RELEASE.md`](PHASE7_RELEASE.md) for
the remaining gates, commands, upload/review distinction, and monitoring record.
