# Phase 7 — Store release runbook

## Current release state

**Not submitted.** Phase 7 cannot safely proceed to store upload/review until
the following gates are met:

- [ ] Phase 6 Android and iOS device checklist is complete, including native
  purchase, restore, playback/background, and second-device access.
- [ ] EAS production environment contains the production API URL and required
  store credentials. Development and preview use separate non-production API
  hosts.
- [ ] The Railway production API health check succeeds and production auth,
  audio, purchase verification, and store notifications have been confirmed.
- [ ] App Store Connect and Google Play app records and monthly products exist
  for `com.happinotes.app` and the configured product IDs.
- [ ] Public privacy policy and support details, final screenshots and
  descriptions, and reviewer credentials are ready in both consoles.
- [ ] The release version and platform build numbers are unused/valid in the
  store records.

At the time of the Phase 7 pass, EAS CLI/account access and store consoles were
unavailable in this workspace, the production API host could not be reached,
and Phase 6 device/store tests remain incomplete. Do not label the apps approved
or production-ready until the store dashboards show approval.

## Build after the gates pass

From `mobile/`, with EAS CLI authenticated to the HappiNotes Expo account and
`EXPO_PUBLIC_API_URL` set in the EAS `production` environment:

```powershell
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
```

Install each resulting artifact on a real device and repeat the applicable
release checklist against those exact binaries. Preserve the EAS build IDs and
artifact links in the table below.

| Platform | EAS build ID/artifact | Device QA | Uploaded | Review status |
| --- | --- | --- | --- | --- |
| Google Play |  |  |  |  |
| App Store Connect |  |  |  |  |

## Upload and submit for review

After QA passes and the listing/reviewer information is complete, upload the
Android App Bundle and iOS archive using EAS Submit or the store consoles. EAS
uploading a binary does not itself mean the app has been submitted for review;
complete the final review submission in each store console and record the
submission IDs and status here.

```powershell
npx eas-cli submit --platform android --profile production
npx eas-cli submit --platform ios --profile production
```

Keep reviewer login credentials active. Provide working demo accounts for
account-based features and an expired subscription account so reviewers can
inspect the purchase flow. Do not include real customer or production secrets
in review notes.

## Post-release monitoring

For the first release window, monitor Railway and store dashboards for:

- sign-up/sign-in and password-reset errors, including Resend delivery failures;
- audio URL, playback start, background playback, and stream interruption errors;
- purchase verification failures, unmatched account bindings, and restore errors;
- Apple notification and Google RTDN delivery/processing failures;
- subscription renewals, expirations, refunds, revocations, and entitlement
  mismatches between store state and the HappiNotes account.

Record the release date, versions/build numbers, review outcomes, dashboard
owners, and any rollback or hotfix decision in the release notes before closing
Phase 7.
