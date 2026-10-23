# Phase 6 — Android and iOS release checklist

This checklist is the shared acceptance record for the Android and iOS release.
Do not mark a device or store item complete until it has been exercised on an
installed native build. Fill in the build number, device, OS version, tester,
date, and outcome for each run.

## Automated repository checks

- [x] Mobile TypeScript check (`npx tsc --noEmit`).
- [x] Expo public config resolves one Android package and iOS bundle ID:
  `com.happinotes.app`.
- [x] Production API URL passes the EAS build validator.
- [x] A production build with `localhost` API URL is rejected by the validator.
- [x] No fixed/test OTP or OTP logging path found in mobile/backend source; reset
  codes are created and emailed by the backend.
- [x] Mobile lint has no warnings.
- [ ] Android and iOS production EAS builds complete and install successfully.
- [ ] Confirm production Railway `/health` from an unrestricted network; this
  workspace could not connect to the host during this pass.

Run checks from `mobile/`:

```powershell
npx tsc --noEmit
npm run lint
npx expo config --type public --json
```

## Device run record

| Platform | Device and OS | Build | Tester/date | Result / issue |
| --- | --- | --- | --- | --- |
| Android |  |  |  |  |
| iOS |  |  |  |  |

## App behavior — run every item on both platforms

- [ ] Fresh install, launch, onboarding, and navigation through every main tab.
- [ ] Sign up with email/password; verify invalid input and duplicate email
  messages; sign out and sign back in.
- [ ] Request a reset code for a registered account; receive it through Resend,
  enter it, reset password, and sign in with the new password.
- [ ] Request reset for an unknown email and confirm the app gives the same
  generic response without disclosing account existence.
- [ ] Browse book lists, featured/upcoming books, book detail, and free previews.
- [ ] Confirm locked premium chapters/audio stay locked without an active
  entitlement, and open after an entitlement becomes active.
- [ ] Play, pause, seek, change playback speed, lock the screen, background the
  app, use headset controls, receive an interruption, and return to playback.
- [ ] Confirm playback recovery and progress after app background/foreground,
  force-close/relaunch, and network interruption.
- [ ] Open membership screen; confirm the native store localized monthly price,
  product wording, and terms display correctly.
- [ ] Confirm purchase pending, store cancellation, store error, and offline
  states leave Premium locked until backend verification succeeds.

## Store purchases and account linking

- [ ] Apple Sandbox/TestFlight: buy monthly membership; confirm the backend
  grants access only after verification.
- [ ] Google Play internal/closed test track: buy monthly membership; confirm
  backend verification and access.
- [ ] Cancel on each store; confirm access remains through the paid-through
  expiry and does not renew.
- [ ] Exercise billing retry/grace where test tooling permits; verify access
  follows the store status and expiry.
- [ ] Refund/revoke a test transaction; confirm server notification removes
  access and a repeated notification does not duplicate/grant access.
- [ ] Restore on the original platform and confirm the same HappiNotes account
  regains only the store-verified entitlement.
- [ ] Sign in to the same HappiNotes account on a second device; confirm access
  follows backend entitlement without purchasing again.
- [ ] Sign in on the opposite platform; confirm the shared account sees the
  existing valid entitlement and does not suggest cross-store restore.
- [ ] Expire a test subscription and confirm premium chapters/audio lock again.

## Store listing and review readiness

- [ ] Public privacy policy URL is live and entered in both store records.
- [ ] Public support contact/URL is live and entered in both store records.
- [ ] Final store name, descriptions, subscription disclosures, localized
  monthly prices, screenshots, app icon, and age/content ratings are complete.
- [ ] App Review notes explain account creation, OTP reset, audio access, and
  monthly membership; provide stable demo account credentials and an expired
  subscription account for review of the purchase flow.
- [ ] Google Play reviewer access and test-track instructions are ready.
- [ ] Final production build contains the production HTTPS API URL and no
  development server, test OTP, or test-store-only behavior.

## Current blockers to closing Phase 6

- Physical Android and iOS devices, OS versions, and store test accounts are not
  connected to this workspace, so device/store items above remain unchecked.
- EAS `production` needs `EXPO_PUBLIC_API_URL` set to
  `https://happinotes-production-6b44.up.railway.app/api`; dedicated `development`
  and `preview` APIs still need provisioning. Without these remote values, native
  EAS builds cannot be run reliably.
- EAS CLI is not installed in this workspace, and no native Android/iOS devices
  or store test accounts are available here.
- The repository has no published privacy policy or support URL/contact, and
  App Store Connect/Play Console screenshots and reviewer credentials are not
  included here; supply them in the respective store listings before review.
