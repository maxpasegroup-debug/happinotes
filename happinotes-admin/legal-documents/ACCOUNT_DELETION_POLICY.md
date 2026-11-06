# HappiNotes Account Deletion Policy

**Review draft — not approved for publication.**

HappiNotes is operated by **AIRASKILL CITY PRIVATE LIMITED**. Support/privacy: **hello@happinotes.online**, **+91 8089239823**.

## Request and identity check

Request deletion from the signed-in app or through the public [account deletion form](/account-deletion). The web flow verifies control of the registered email with a one-time code. Phone-only external verification is not supported; use the signed-in app. The request receives a reference and status credential. Keep the credential private.

## Status

“Request received” means the request is recorded. “Under review” means it is queued or being reviewed. Neither means data deletion is complete. “Completed” must appear only after the backend confirms all approved deletion steps. The current worker intentionally pauses at a retention-policy gate, so current requests may not complete. No completion deadline has been approved.

## Current processing and limits

The worker marks the account pending, deletes password-reset records and account-deletion reauthentication proofs scoped to that user, unsets the password and increments the session version once, deletes matching OTP records, clears saved collections/favourites/push-token references, replaces the name with a generic tombstone label, resets language and role fields, removes email and phone, and clears purchased-book and embedded subscription entitlements. The `User` record retains its internal `_id` and deletion-state fields so the active request and purchase ledgers can still be processed; this is pseudonymous linkage, not irreversible anonymisation. StorePurchase and SubscriptionPurchase evidence remain behind the retention gate. Support, provider, log and backup data are not deleted by the worker. Admins can view requests and record that review has started, but cannot finalize a request or directly delete a user account. This is not yet a complete deletion implementation.

The target architecture is to erase ordinary profile/contact data; remove authentication artifacts, preferences, listening history if present, and device references; separate only specifically approved accounting evidence from the profile; revoke HappiNotes access without cancelling store billing; minimise provider/support/log/backup data; and retain only minimal restricted deletion evidence. The complete field inventory and unresolved decisions are in [ACCOUNT_DELETION_DATA_DISPOSITION_MATRIX.md](ACCOUNT_DELETION_DATA_DISPOSITION_MATRIX.md). Counsel/finance have not approved record-level grounds, fields, triggers, periods or exceptions. A general accounting label is not enough to retain an entire profile or transaction ledger. The worker therefore pauses after safe profile and entitlement cleanup while purchase, provider, support, log, backup, and audit dispositions remain unresolved. This is not a completed deletion.

Account deletion does not cancel Google Play or Apple billing. Cancel separately in the store. Do not claim completion before the backend confirms it.
