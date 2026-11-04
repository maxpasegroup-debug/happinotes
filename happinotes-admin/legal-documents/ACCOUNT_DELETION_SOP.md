# Account Deletion Operations SOP

**Internal draft — current implementation cannot complete deletion.**

## Current behavior

The in-app request is authenticated and reauthenticated. The external form verifies the registered email with an OTP. The backend creates a reference and status token, stores a hash of the token and records request/processing history. The admin queue lists and reviews requests. The worker marks the account pending; removes password-reset and matching OTP artifacts; clears collections, favourites and FCM tokens; then sets `blocked_policy`. It retains profile identity, purchased-book links, `StorePurchase`, `SubscriptionPurchase` and embedded subscription entitlement. It does not finalize or mark completed.

## Safe handling until policy is approved

Do not bypass the gate, manually remove records, promise a completion date, or mark completed. Tell the requester the request was received/under review and is not complete. Escalate to the owner and privacy contact. Maintain restricted access to status credentials and request data. Explain that store subscription cancellation must be handled separately.

## Future processing after approval

Before enabling completion, obtain approved retention field mapping, lawful basis, period/trigger, provider deletion actions, backup/log process, purchase restoration/chargeback handling, entitlement removal, admin authorization roles, and escalation criteria. Implement idempotent checkpoints and auditable confirmation for every system. Verify completion only after all approved steps and exceptions are applied. No SLA is approved. A production rollout requires implementation review and a separate test/release approval.
