# Google Play Account Deletion Checklist — HappiNotes

**Status:** NOT READY — engineering and owner worksheet; no Play Console answers have been submitted.  
**Company:** AIRASKILL CITY PRIVATE LIMITED  
**Reviewed:** 2026-11-04

Google Play requires an in-app path and an external web resource for apps that create accounts. Data Safety deletion answers and listing links must reflect the real implementation. Google allows limited data retention for legitimate reasons such as security, fraud prevention or regulatory compliance, with clear disclosure; provider-held data should also be addressed. See [Understanding Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111) and [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311).

## Engineering evidence to verify before making declarations

- [x] In-app deletion entry point and reauthentication exist in source.
- [x] Public `/account-deletion` page submits an email-verified request without asking for password/PIN.
- [x] Both flows use the same backend request and worker lifecycle.
- [x] Request reference and status tracking exist; external status token is stored as a hash.
- [x] User access is blocked and auth secrets, OTP/reset/reauth artifacts and preferences/device token references are cleaned in current worker steps.
- [x] Ordinary profile fields/contact and HappiNotes purchase/Premium access are removed through lease-fenced, idempotent worker checkpoints.
- [x] Store billing is not automatically cancelled; public wording directs users to manage/cancel in the relevant store.
- [x] Store subscription notifications cannot update entitlement for a non-writable/deleting account through current entitlement guard.
- [ ] Residual `User._id` linkage and deletion tombstone have an approved final disposition; profile name/contact fields are already removed/anonymised locally.
- [ ] Purchase/subscription ledgers have approved field-level dispositions and only any specifically approved evidence remains; `User.purchasedBooks` is already cleared locally.
- [ ] Final worker verification confirms embedded Premium and purchased-book access remain absent after processing; local revocation and non-restoration guard are implemented, but full deletion is still blocked by unresolved ledger disposition.
- [ ] Support records, provider-side data, logs, exports and backups have an approved process and confirmation evidence.
- [ ] Minimal audit record has an approved field list, access policy and retention trigger.
- [ ] Worker reaches `completed` only after all mandatory checkpoints succeed or an approved documented retention exception is satisfied.
- [ ] The external flow remains recoverable under the approved policy after account email is removed.
- [ ] Public privacy/account deletion pages are approved, deployed, accessible without login, and match actual behavior.
- [ ] Final release build and provider configuration have been verified; no such verification was done in this task.

## Data Safety / Play Console owner worksheet

Answer from the production configuration and exact release binary, not from assumptions:

1. Does the app create accounts? **Source evidence: yes.** Confirm in Play Console.
2. Is there an in-app account deletion path? **Source evidence: request path exists; full deletion is blocked.** Do not declare full deletion as available until the worker completes the approved data disposition.
3. Is there an external deletion URL? **Source route:** `https://happinotes.online/account-deletion`. Do not submit until deployed, publicly reachable, HTTPS-valid, and consistent with the approved final process.
4. Does deletion remove all account-associated data? **Current source: no.** The worker pauses at `blocked_policy`; state this accurately and resolve before release declaration.
5. Is any data retained? If so, list each field, reason, applicable rule and applicability evidence, trigger/period, access restriction, and disposal method in the [data disposition matrix](ACCOUNT_DELETION_DATA_DISPOSITION_MATRIX.md). Do not use a blanket “accounting” exception.
6. Do service providers receive user data? Source shows MongoDB/Railway, Resend, Firebase, Cloudinary (catalogue media), and Play/Apple purchase APIs. Confirm actual providers, data categories, sub-processors, regions, contracts and deletion capabilities.
7. Are device-held data and third-party SDK collection accounted for? Confirm on the final binary and test-device behavior; source audit alone is not sufficient.
8. Are there children, ads, health, financial or government-related declarations? Owner must answer based on intended audience and product operation; engineering must not guess.

## Release gate

**Do not claim “account deletion completed” or submit a Play declaration that implies associated data deletion while the request is only `blocked_policy`.** No manual admin completion action is permitted. Close every unchecked engineering item, obtain legal/finance approval for exceptions, publish approved policy wording, then independently verify the production page and Play Console answers before release.
