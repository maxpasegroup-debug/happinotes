# Account Deletion Operations SOP

**Internal draft — current implementation cannot complete deletion.**

## Current behavior

The in-app request is authenticated and reauthenticated. The external form verifies the registered email with an OTP. Both flows create a reference and a derived high-entropy status bearer code; only its HMAC hash is stored. The requester must save the code before contact fields are removed. The admin queue lists requests and permits an admin to record that review has started; it cannot finalize deletion. Direct admin deletion of a user record is disabled. The worker marks the account pending; removes password-reset records and reauthentication proofs scoped to that user; unsets the password and increments the session version once; removes matching OTP artifacts; clears collections, favourites and FCM token references; replaces the profile name with a generic tombstone label; resets role/language; removes email and phone; clears purchased-book access and the embedded subscription entitlement. Each stage is idempotent and its checkpoint is written only under the current unexpired worker lease. The worker then sets `blocked_policy` while `StorePurchase`, `SubscriptionPurchase`, deletion audit history, support/provider data, runtime logs and backups remain undecided or outside repository access. It does not cancel store billing, finalize, or mark completed.

## Safe handling until policy is approved

Do not bypass the gate, manually remove remaining purchase/provider/log/backup records, promise a completion date, or mark completed. Tell the requester the request was received/under review and is not complete; ordinary profile/contact fields and HappiNotes entitlements may already have been removed. Escalate the precise field-level disposition to the owner, counsel and finance. The status bearer code cannot be reissued after contact fields are erased; advise the requester to save it securely. Explain that store subscription cancellation must be handled separately.

## Future processing after approval

Before enabling completion, obtain approved retention field mapping, lawful basis, period/trigger, provider deletion actions, backup/log process, purchase restoration/chargeback handling, entitlement removal, admin authorization roles, and escalation criteria. Implement idempotent checkpoints and auditable confirmation for every system. Verify completion only after all approved steps and exceptions are applied. No SLA is approved. A production rollout requires implementation review and a separate test/release approval.
