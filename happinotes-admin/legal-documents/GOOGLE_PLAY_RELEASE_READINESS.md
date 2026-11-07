# Google Play Release Readiness — Privacy, Legal and Data Safety

**Status: NOT READY for release.** Static source audit only; no Play Console, artifact or production review.

## Blockers

- Account deletion requests do not complete. The worker removes ordinary profile/contact fields, authentication artifacts, preferences/device references and HappiNotes book/Premium access, but retains the User record/internal identifier and linked purchase/subscription ledgers and pauses at `blocked_policy`; support/provider/log/backup/deletion-history handling remains incomplete. Google Play requires in-app and external deletion methods and deletion of associated user data, subject to accurately disclosed justified retention. The current implementation is a release blocker until disposition decisions are approved and implemented. See the current [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) and [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).
- The privacy policy text is finalized with an effective date of 6 November 2026 and owner-authorized for publication; this is not legal or finance approval. Deployment and live URL accessibility are not verified. Other legal pages remain drafts. Owner intent is worldwide and 18+ with Android first; actual country availability and app age controls are unverified. Provider locations/contracts, retention, legal grounds, rights process and grievance details remain open.
- Google Play Data safety and Data deletion answers must match actual code, final SDKs, backend and production providers. A draft inventory is not a submission.
- Confirm app access/reviewer credentials, target audience/content rating, app category, store listing, support contact, privacy URL and deletion URL in Play Console.
- Confirm subscription products/base plans/offer, country availability, localized final checkout prices, price cohort behavior, cancellation/restore, tax treatment and billing disclosure using Play Console and test purchase accounts.
- Confirm signing, package identity, target API, policy declarations, permissions, release track and current Play requirements against the exact AAB. No AAB was built or inspected in this audit.

The Android Gradle file delegates `targetSdk` to `flutter.targetSdkVersion`; this source review cannot establish the resolved API level in the release manifest. As of the audit date, Google Play requires new apps and updates to target Android 16 / API 36 or higher starting August 31, 2026. Verify the resolved value in the exact release artifact before upload. The Gradle file shows compile SDK 37 and only INTERNET and POST_NOTIFICATIONS declared in the app manifest; plugin manifests and the final merged manifest still need review.

## Known public resources

- Privacy policy route in source: `https://happinotes.online/privacy-policy`
- Account deletion resource in source: `https://happinotes.online/account-deletion`
- Terms: `https://happinotes.online/terms`
- Subscription policy: `https://happinotes.online/subscription-policy`

The routes exist in source but their deployment, TLS, public availability, content encoding and production version were not checked. Do not enter them in Console until the public deployment is verified and approved.

## Official Play references

- [Account deletion requirement](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en-EN)
- [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- [Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
