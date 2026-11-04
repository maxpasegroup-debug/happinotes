# Data Retention and Disposal Policy

**Internal review draft — no retention schedule is approved.**

## Rule

Keep personal information only under a documented purpose, approved lawful basis, owner, system location and retention trigger. Do not invent or apply retention periods from this draft. Legal and finance must approve every retention exception, especially transaction/accounting evidence and deletion history.

## Current state

MongoDB models include user identity/profile, authentication OTP/reset artifacts, preferences/device tokens, individual purchase references, subscription purchase/entitlement state and deletion requests. OTP and password-reset records have expiry/TTL behavior. The deletion worker removes reset/OTP artifacts and preferences/device tokens but stops before identity, purchases, entitlements and request completion. Server logs are emitted to stdout; hosting retention was not verified. No repository backup schedule or archive model was found. Provider-side deletion and backups were not inspected.

## Future approved schedule

For each category in [DATA_SAFETY_INVENTORY.md](DATA_SAFETY_INVENTORY.md), Legal/Finance must document: purpose; legal basis; minimum fields; delete/anonymise/retain action; exact duration or criteria and trigger; access controls; processor instruction; backup/log expiry; exceptions; evidence; and owner. Use automated, idempotent deletion with retry and completion evidence only after all required systems confirm. Reconcile store billing separately and do not destroy evidence needed for verified purchase restoration until approved.

## Prohibited until approval

No worker bypass, arbitrary TTL, broad deletion query, anonymisation transform, retention duration or “completed” state may be introduced without approved field mapping, test plan and operational sign-off.
