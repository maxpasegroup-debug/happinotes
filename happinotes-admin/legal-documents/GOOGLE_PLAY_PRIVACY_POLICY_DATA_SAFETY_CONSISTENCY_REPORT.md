# HappiNotes — Google Play Privacy Policy and Data Safety Consistency Report

**Reviewed:** 6 November 2026  
**Status:** Review draft; not a Play Console declaration, legal approval, or release clearance.

## Summary

The repository contains the privacy-policy route and final policy text dated 6 November 2026, authorized by the owner for publication. That authorization is not counsel/finance approval. The source alone does not establish production provider settings, the final Android binary's complete data behavior, or the answers currently saved in Play Console. Do not submit Data Safety answers from this report.

The account-deletion workflow accepts in-app and external requests but does not complete the full deletion process: it pauses at `blocked_policy` after removing several profile, authentication and entitlement fields, while the account record, linked purchase/subscription ledgers, and other categories remain. Google Play's current [account deletion requirement](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) and [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en) require an in-app path and a public web path and require deletion of associated account data, subject to accurately disclosed necessary retention. The incomplete workflow is a material Play readiness blocker; policy text alone does not resolve it.

## Source-identified data and purposes

| Category to assess in Play Console | Repository evidence and observed purpose | Sharing/recipient indicated by source | Final declaration status |
|---|---|---|---|
| Personal information: name, email, phone, account identifier | Account creation, sign-in, account support and deletion request verification. | HappiNotes backend/database; email provider receives destination address for code delivery. | Requires reconciliation with shipped binary and production settings. |
| Authentication/security | Password verifier, session state, OTP, reset and reauthentication records; account protection and verification. | HappiNotes backend/database; Resend for email OTP delivery. | Exact retention and Play category answers need owner/security confirmation. |
| User-generated/account activity | Favourites, collections, library/purchased-book references, language/theme preferences, playback-completion browser state. | Backend/database for account features; user device/browser for local state. | Confirm whether any activity is shared or synchronized beyond the source paths found. |
| Purchases and subscriptions | Store, product/plan, transaction reference and purchase/subscription state; purchase validation and access control. | Google Play billing/verification for Android; Apple code is present for a later iOS path, but production operation is unverified. | Finance must confirm exact data received, retained, shared and Play classification. |
| Device identifiers and notifications | FCM token references and service notification content; push delivery. | Firebase Cloud Messaging. | Confirm Firebase production configuration and any provider diagnostics. |
| Deletion request/security credential | Reference, source/date/status/history, token hash and checkpoints; request verification and recovery/status display. | HappiNotes backend/database; external requester sees reference and bearer status credential. | Account-management/security treatment and retained history need legal/finance approval. |
| App/device/browser information | Secure app session storage, local preferences/cache, web local/session storage, request/network processing. | User device/browser; backend/hosting may produce operational logs. | Complete final SDK, manifest, network and production-log review remains required. |
| Support messages | No support-ticket model/API found in inspected repository; email/phone support channels exist. | Actual support mailbox/telephony providers are not source-confirmed. | Owner must identify real providers, records, access and retention before declaration. |
| Diagnostics, crash and advertising data | No direct analytics, advertising or crash-reporting dependency appears in the inspected Flutter manifest. This does not prove absence from transitive SDKs, infrastructure, provider consoles or release artifact. | Unknown until final binary and production settings are checked. | Do not answer “not collected” from direct dependencies alone. |

## Account deletion and external URL

- **In-app path:** present in source through the signed-in account deletion flow, with reauthentication.
- **External path:** website route `/account-deletion` uses the registered email OTP; phone-only external verification is not implemented.
- **Current result:** worker removes authentication artifacts and matching OTPs, invalidates sessions, clears preferences/favourites/collections/push-token references, replaces the name, removes email/phone, and removes embedded purchased-book/Premium access. It retains the User record/internal identifier and purchase/subscription ledgers; support, provider, operational-log, backup and deletion-history dispositions are incomplete. Requests can stop at `blocked_policy`; no fixed completion deadline is promised. Store subscriptions are not automatically cancelled.
- **External URL in source:** `https://happinotes.online/account-deletion`.
- **Live verification:** not verified. The repository defines the route, but the web inspection tool could not retrieve the live URL. Do not claim public availability, HTTPS behavior, current deployed content or Play readiness until independently checked from an ordinary browser/network.

## Privacy policy route and publication state

- **Source route:** `happinotes-admin/app/privacy-policy/page.tsx` renders `FINAL_PRIVACY_POLICY.md` at `/privacy-policy`.
- **Expected URL:** `https://happinotes.online/privacy-policy`.
- **Publication presentation:** the privacy route is configured without the shared draft banner and the canonical policy displays an effective date of 6 November 2026. Other legal routes keep their draft banners.
- **Live verification:** not verified. A source route does not prove the page is deployed, public, accessible worldwide, or serving this version. Live inspection was attempted but the URL could not be retrieved by the available web tool. The repository has no website deployment job; the Railway CLI sign-in attempt timed out before a deployment target could be inspected.
- **Console entry:** enter the URL only after deployment is complete and the live route is checked without login over HTTPS. Owner publication authorization does not certify the Data Safety form or full release compliance.

## Mismatches and blockers to close

1. **Deletion is not complete:** obtain finance/counsel field-level dispositions for purchase/subscription records, request history, support, logs and backups; implement approved checkpoints without bypassing `blocked_policy`; verify completed status only after all approved actions succeed.
2. **Age statement vs control:** owner intent is 18+ and worldwide, but source review did not establish age verification or prevention controls. Confirm Play target audience, actual country availability and safeguards; do not imply age enforcement.
3. **Provider configuration:** owner/operations must confirm production legal entities, services, roles, locations, subprocessors, contracts, sharing and retention for Railway, MongoDB, Resend, Firebase, Cloudinary, Google Play and any other active providers. Apple source integration is for a later iOS path; do not list it as active Android processing.
4. **Data Safety answers:** inspect the exact release artifact and transitive SDKs, Android manifest/permissions, Firebase configuration, production services/logging, and current Play Console form. Decide each collected/shared category and purpose from that evidence; this report does not fill or certify the form.
5. **Rights and legal text:** counsel must approve applicable India, GDPR/UK GDPR and other market-specific rights, legal grounds, retention exceptions, international-transfer language, child/privacy obligations, complaint escalation and any statutory contact/designation. For India, map the DPDP Act 2023 and DPDP Rules 2025 against the official phased commencement notifications; do not assume every substantive provision has the same commencement date ([Act commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf), [Rules 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)).
6. **Finance and consumer terms:** confirm store products, purchase data, refund/chargeback and tax practices, renewal/cancellation disclosures, and transaction records to retain.
7. **Publication verification:** deploy the owner-authorized privacy text, verify the privacy URL from a public browser over HTTPS without login, and confirm it renders matching company/contact details, the effective date and the account-deletion link. Verify the deletion URL separately.

## Decision

**Data Safety answers are not ready to submit.** The owner-authorized privacy policy is configured for publication on its dedicated route, but the live deployment must be confirmed before entering the URL in Play Console. The existing `GOOGLE_PLAY_ACCOUNT_DELETION_CHECKLIST.md` and `DATA_SAFETY_INVENTORY.md` remain worksheets, not submitted declarations. This report does not establish legal approval or full app release compliance.
