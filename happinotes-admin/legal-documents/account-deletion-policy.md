# HappiNotes Account Deletion Policy

**Review draft — not approved for publication.**

HappiNotes is operated by **AIRASKILL CITY PRIVATE LIMITED**. Support/privacy: **hello@happinotes.online**, **+91 8089239823**.

## Request and identity check

Request deletion from the signed-in app or through the public [account deletion form](/account-deletion). The web flow verifies control of the registered email with a one-time code. Phone-only external verification is not supported; use the signed-in app. The request receives a reference and status credential. Keep the credential private.

## Status

“Request received” means the request is recorded. “Under review” means it is queued or being reviewed. Neither means data deletion is complete. “Completed” must appear only after the backend confirms all approved deletion steps. The current worker intentionally pauses at a retention-policy gate, so current requests may not complete. No completion deadline has been approved.

## Current processing and limits

The worker removes authentication artifacts, saved preferences and device references, replaces the profile name with a generic tombstone label, resets profile settings, removes email/phone, and revokes HappiNotes Premium and purchased-book access. It retains the internal account key while purchase and deletion records remain linked. StorePurchase and SubscriptionPurchase evidence remain behind the policy gate. Support, provider, log and backup data are not deleted by the worker. Admins can review requests but cannot manually finalize them. This is not a complete deletion implementation.

The target architecture is to erase ordinary profile/contact data; remove authentication artifacts, preferences, listening history if present, and device references; separate only specifically approved accounting evidence from the profile; revoke HappiNotes access without cancelling store billing; minimise provider/support/log/backup data; and retain only minimal restricted deletion evidence. Counsel/finance have not approved record-level grounds, fields, triggers, periods or exceptions. A general accounting label is not enough to retain an entire profile or transaction ledger. The worker removes profile/contact fields and access, then pauses while remaining dispositions are unresolved. This is not a completed deletion.

Account deletion does not cancel Google Play or Apple billing. Cancel separately in the store. Do not claim completion before the backend confirms it.
