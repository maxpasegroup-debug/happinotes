# HappiNotes Account Deletion Policy

**Review draft — not approved for publication.**

HappiNotes is operated by **AIRASKILL CITY PRIVATE LIMITED**. Support/privacy: **hello@happinotes.online**, **+91 8089239823**.

## Request and identity check

Request deletion from the signed-in app or through the public [account deletion form](/account-deletion). The web flow verifies control of the registered email with a one-time code. Phone-only external verification is not supported; use the signed-in app. The request receives a reference and status credential. Keep the credential private.

## Status

“Request received” means the request is recorded. “Under review” means it is queued or being reviewed. Neither means data deletion is complete. “Completed” must appear only after the backend confirms all approved deletion steps. The current worker intentionally pauses at a retention-policy gate, so current requests may not complete. No completion deadline has been approved.

## Current processing and limits

The worker marks the account pending, deletes password-reset and matching OTP records, clears collections, favourites and push tokens, and then blocks. It retains user profile/identity, purchased-book references, store purchase ledger, subscription records and entitlement. It does not perform approved anonymisation or purge support, provider, logs or backups. The admin queue can review and update some request statuses but cannot finalize data deletion. This is not yet a complete deletion implementation.

The owner direction is to delete authentication secrets and preferences; anonymise profile fields; erase email/phone except where approved retention applies; retain only necessary transaction evidence under restricted access; remove Premium after purchase/subscription handling; minimise support information; apply approved log/backup expiry; and keep only a minimal restricted request history. Counsel/finance have not set legal grounds, fields, periods or exceptions. These directions do not authorize deletion until an executable approved policy exists.

Account deletion does not cancel Google Play or Apple billing. Cancel separately in the store. Do not claim completion before the backend confirms it.
