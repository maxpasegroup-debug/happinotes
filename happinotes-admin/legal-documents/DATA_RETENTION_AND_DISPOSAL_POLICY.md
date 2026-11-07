# Data Retention and Disposal Policy

**Internal review draft — no retention schedule is approved. Source state reviewed 6 November 2026.**

## Rule

Keep personal information only under a documented purpose, approved lawful basis, owner, system location and retention trigger. Do not invent or apply retention periods from this draft. Legal and finance must approve every retention exception, especially transaction/accounting evidence and deletion history.

## Current state

The deletion worker removes password-reset and reauthentication proofs and matching OTPs, invalidates sessions, clears preferences/favourites/collections/push-token references, replaces the profile name, resets selected settings, removes email and phone, and clears purchased-book access and embedded Premium entitlement. It does not delete the User record/internal identifier or detach StorePurchase and SubscriptionPurchase ledgers; the request stops at `blocked_policy`. Support/provider records, logs, backups and deletion-request history are not fully handled by the worker. OTP/reset expiry mechanisms exist in source; exact production retention and provider-side behavior are unverified. Server logs are emitted to stdout; host retention was not verified. No repository backup schedule or archive model was found.

## Future approved schedule

For each category in [DATA_SAFETY_INVENTORY.md](DATA_SAFETY_INVENTORY.md), Legal/Finance must document: purpose; legal basis; minimum fields; delete/anonymise/retain action; exact duration or criteria and trigger; access controls; processor instruction; backup/log expiry; exceptions; evidence; and owner. Use automated, idempotent deletion with retry and completion evidence only after all required systems confirm. Reconcile store billing separately and do not destroy evidence needed for verified purchase restoration until approved.

## Prohibited until approval

No worker bypass, arbitrary TTL, broad deletion query, anonymisation transform, retention duration or “completed” state may be introduced without approved field mapping, test plan and operational sign-off.
