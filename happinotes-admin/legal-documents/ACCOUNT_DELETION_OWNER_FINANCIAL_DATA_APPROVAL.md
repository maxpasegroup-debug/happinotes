# HappiNotes — Owner Financial Data Approval

**Company:** AIRASKILL CITY PRIVATE LIMITED  
**Status:** Owner decision draft — not legal, finance, tax, or counsel approval.  
**Purpose:** Decide the proposed handling of every field in the `StorePurchase` and `SubscriptionPurchase` schemas when a HappiNotes account is deleted.  
**Safety:** The current `blocked_policy` gate remains unchanged. This document does not authorize source/schema changes, record deletion, migration, or completion of any account-deletion request.

## Decision guide

Recommendations use data minimisation as the default. A technical need to verify a store transaction or prevent duplicate claims does not by itself establish a legal retention requirement. “Retain provisionally” means only while a specifically approved purpose is being assessed and implemented; it is not a retention period or legal conclusion. Where finance/counsel confirmation is required, do not treat the field as approved for retention until that review is recorded.

The purchase ledgers do not contain actual amount paid, currency charged, GST/tax amount, invoice, refund amount, or refund date. They should not be treated as complete accounting or tax records based on the fields inspected.

## `StorePurchase` — one-time book purchases

Model: `backend/src/models/StorePurchase.ts`.

| Field | Current purpose | Personal/linkable assessment | Recommended decision | Owner choice |
|---|---|---|---|---|
| `_id` | MongoDB row identifier used for targeted updates. | Not a direct identity field, but can join to other app data. | **RETAIN only while required for an active operational purpose.** If the evidence row remains, this is an internal row key; it is not financial evidence itself. Remove the row and key when the approved disposal process permits. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `userId` | Foreign key to `User._id`; supports ownership checks and current store-account binding. | Direct internal account link; links the transaction to the user's broader account history. | **REMOVE during account deletion.** Do not keep the User profile or an identity map solely because this field exists. Any transaction-scoped provider binding is a separate decision and may still be pseudonymous data. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `transactionKey` | Unique provider transaction locator/deduplication key. Android values are hashed for new one-time claims; Apple values include environment and original transaction ID. | Pseudonymous and provider-linkable, even when hashed. | **DETACH from User identity and retain provisionally.** Keep only if the owner approves the operational purpose (provider reconciliation, duplicate prevention, or approved dispute handling) and finance/counsel confirm any applicable retention treatment. Restrict access. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `store` | Identifies Google Play or Apple and selects the provider flow. | Not identifying alone, but contributes to a transaction profile. | **RETAIN only while required for an active operational purpose.** Reassess after provider reconciliation is no longer needed; it does not prove the amount or tax paid. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `productId` | Provider product/SKU used to verify the purchase and identify the product. | May become linkable when joined to a transaction key or account. | **RETAIN only while required for an active operational purpose.** Retain after that only if finance/counsel approve its evidence purpose; it does not prove the actual checkout price or tax. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `bookId` | HappiNotes catalogue ID used to grant/revoke book access and map a product to a book. | Can expose a user's purchase or content preference if linked to a person or transaction. | **REMOVE during account deletion** from the retained transaction row by default. Keep only if finance/counsel explicitly confirm it is needed in transaction evidence; transaction-level product identification may be sufficient instead. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `active` | Current local purchase/revocation state used by access and notification handling. | Personal when tied to a transaction; not an access entitlement by itself once detached, but could be misused as one. | **RETAIN only while required for an active operational purpose.** After detachment it may describe provider state only and must never restore the deleted account's book access. Remove when no longer needed unless finance/counsel approve retaining it as evidence. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `createdAt` | Mongoose row creation time; not necessarily the actual store purchase time. | Transaction-linked metadata. | **NEEDS FINANCE/COUNSEL CONFIRMATION.** Do not present it as the purchase, invoice, or tax date. Retain only if a documented evidence purpose is confirmed. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `updatedAt` | Mongoose time of the latest ledger-row update. | Transaction-linked activity metadata. | **RETAIN only while required for an active operational purpose.** It can help operationally but is not a refund record or approved retention trigger. Remove or minimize after reconciliation unless finance/counsel confirm a continuing evidence need. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `__v` (Mongoose version key, if present) | Mongoose document version metadata; no purchase/accounting purpose found in inspected handlers. | Not identifying alone; may be linked through the record. | **REMOVE during account deletion** or disable for detached evidence if implementation permits. No independent purpose was identified. | ☐ ACCEPT ☐ REJECT ☐ AMEND |

## `SubscriptionPurchase` — recurring subscription lifecycle

Model: `backend/src/models/SubscriptionPurchase.ts`.

| Field | Current purpose | Personal/linkable assessment | Recommended decision | Owner choice |
|---|---|---|---|---|
| `_id` | MongoDB row identifier used for targeted provider-state updates. | Not a direct identity field, but can join to other app data. | **RETAIN only while required for an active operational purpose.** It is a row key, not financial evidence itself. Remove it with the record when approved disposal permits. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `userId` | Foreign key to `User._id`; supports account ownership, restore, and current store-account binding. | Direct internal account link to a person's subscription history. | **REMOVE during account deletion.** Do not retain the full User record or another identity map for restore convenience. Detached claims must not be reattached to any account. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `transactionKey` | Provider subscription-chain locator and unique claim key. Android is derived from the Play token; Apple uses environment and original transaction ID. | Pseudonymous and provider-linkable, even if token-derived or hashed. | **DETACH from User identity and retain provisionally.** Keep only while an approved provider reconciliation, duplicate-prevention, or dispute purpose exists. Finance/counsel must confirm any evidence retention; the hash/key is not anonymous by itself. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `store` | Identifies the provider and selects subscription verification/notification APIs. | Not identifying alone; may contribute to a linked activity profile. | **RETAIN only while required for an active operational purpose.** It does not establish amount charged or tax. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `productId` | Store subscription SKU used to query provider state and map the plan. | May become linkable with transaction and subscription data. | **RETAIN only while required for an active operational purpose.** Retention beyond that requires an approved evidence purpose; it is not proof of the customer's localized amount or tax. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `planKey` | HappiNotes monthly/yearly classification. | Can reveal subscription behavior when joined to a transaction. | **REMOVE during account deletion** by default. It is an app classification and may be derivable from product metadata. Retain only if finance/counsel identify a specific evidence need. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `priceVersion` | HappiNotes plan/offer version associated with the claim. | Can reveal a subscriber's offer cohort. | **REMOVE during account deletion** by default. It does not prove actual localized store price, currency, tax, or amount paid. Retain only if finance/counsel confirm a specific evidence purpose. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `active` | Latest local provider entitlement state. | Personal subscription-state data; must not function as deleted-account access. | **RETAIN only while required for an active operational purpose.** After account detachment it is provider evidence only; it must never grant Premium access. Remove when operational reconciliation ends unless an approved evidence need remains. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `expiresAt` | Provider-reported subscription expiry used by entitlement and lifecycle logic. | Personal subscription-history data. | **RETAIN only while required for an active operational purpose.** After detachment it must not provide account access. Retention beyond provider reconciliation needs finance/counsel confirmation. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `autoRenewing` | Latest provider-reported renewal state. | Personal subscription behavior. | **RETAIN only while required for an active operational purpose.** It does not cancel store billing. Remove when no longer needed for lifecycle reconciliation unless finance/counsel confirm otherwise. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `providerStateSignedAt` | Orders signed provider states so stale events do not overwrite newer state. | Linkable lifecycle metadata. | **RETAIN only while required for an active operational purpose.** Keep only as long as needed to safely order provider events; it is not accounting evidence by itself. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `createdAt` | Mongoose row creation time; not necessarily the actual subscription purchase/renewal date. | Transaction-linked metadata. | **NEEDS FINANCE/COUNSEL CONFIRMATION.** Do not use it as proof of a charge, invoice, or tax date. Retain only if a documented evidence purpose is confirmed. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `updatedAt` | Mongoose time of the latest ledger-row update. | Transaction-linked lifecycle metadata. | **RETAIN only while required for an active operational purpose.** It may support event processing but is not a refund record or approved retention trigger. Remove or minimize after reconciliation unless an evidence need is confirmed. | ☐ ACCEPT ☐ REJECT ☐ AMEND |
| `__v` (Mongoose version key, if present) | Mongoose document version metadata; no transaction/accounting purpose found in inspected handlers. | Not identifying alone; linked through the row. | **REMOVE during account deletion** or disable for detached evidence if implementation permits. No independent purpose was identified. | ☐ ACCEPT ☐ REJECT ☐ AMEND |

## Access restoration and notification safeguards

These are required design conditions for any later approved implementation; they are not changes made by this decision draft.

- Clear `User.purchasedBooks` and unset the embedded `User.subscription` as the current worker does. This revokes HappiNotes book/Premium access; it does **not** cancel Google Play or Apple billing.
- A detached transaction row must have no `userId`. Restore endpoints must require an existing linked claim whose `userId` matches the authenticated account. If `userId` is absent, reject restore and never attach the claim to a different or newly created account.
- Keep duplicate-claim protection using the unique store/transaction key while its retention is approved. A unique key prevents re-claiming but does not itself authorize access.
- Google and Apple notifications must continue authenticating the provider event and checking the verified transaction key, product, store/environment, and current authoritative provider state. For a detached row, notifications may update only the approved transaction state; they must not write any User entitlement.
- Current notification code uses `userId` to check Google obfuscated account ID and Apple `appAccountToken`. Before detaching records, engineering must implement and review the detached-claim verification path. Do not weaken provider signature, package, product, transaction-key, or authoritative lookup checks. Do not create a replacement identity mapping unless the owner separately approves it and finance/counsel assess its linkability.
- Provider notifications may indicate a renewal or active store subscription. That must not recreate HappiNotes access for a deletion-pending/completed account. Store billing remains separate and is not automatically cancelled.

## Data that must not appear in customer or ordinary admin APIs

- Do not expose `transactionKey`, raw store tokens/receipts, provider account-binding tokens, retained financial evidence, or internal financial audit history through customer APIs.
- Do not add transaction rows to ordinary admin user listings, account-deletion request responses, or general reports. Existing account-deletion admin views should return only the minimum data needed for request review.
- Any future financial evidence view requires a separately approved, least-privilege finance permission, field masking, purpose-limited access, and an audit record of staff actor, action, time, and evidence-row reference. Do not log raw provider tokens or full transaction keys.

## Decisions requiring finance/counsel confirmation

1. Which external records (store statements, payout reports, invoices, accounting vouchers, tax documents, refund or chargeback records) are the actual source of record for the company?
2. Whether any field in these app ledgers is needed for accounting, tax, consumer disputes, refunds, chargebacks, fraud prevention, or provider reconciliation, and the exact purpose for each field.
3. The applicable legal provision and company-specific applicability for any retained field, if established; the retention trigger and period, if established; access restrictions; and disposal method. No legal ground or period is supplied here.
4. Whether `transactionKey` may remain detached from User identity for a specific operational/evidence purpose, and when it can be removed.
5. Whether any transaction-scoped provider binding is necessary after `userId` is removed. Such a value may remain personal/linkable and is not approved by default.
6. Whether `bookId`, `productId`, `planKey`, or `priceVersion` are needed in a minimal evidence row, rather than only for active product operations.
7. How to handle support/refund inquiries after a transaction is detached, without restoring access or retaining unnecessary identity.

Until those decisions are documented, the transaction ledgers remain unresolved data behind `blocked_policy`; their presence is not an approved legal retention exception. No deletion request may be marked completed on the basis of this draft.

## Final owner decision

**Owner decision:** ACCEPT  
**Owner:** AIRASKILL CITY PRIVATE LIMITED — Owner/Founder approval  
**Date:** 05 November 2026  

The proposed field recommendations and safeguards are accepted as owner direction, subject to required finance/counsel review and later technical implementation. This is not legal approval and does not authorize a migration or release the `blocked_policy` gate.

Additional direction / notes:

______________________________________________________________________________

______________________________________________________________________________

Finance reviewer (if assigned): ____________________  Date: ______________  
Counsel reviewer (if assigned): ____________________  Date: ______________

Owner acceptance does not substitute for any required finance, tax, or legal review. No source code, schema, records, policies, or deletion status are changed by this draft.
