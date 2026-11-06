# HappiNotes — Account Deletion Financial Data Decision

**Company:** AIRASKILL CITY PRIVATE LIMITED  
**Status:** Engineering decision draft for owner, finance, and counsel review; not legal or tax advice.  
**Scope:** Source-code inspection of purchase and subscription models, their references to user accounts, store verification/notification paths, and account-deletion processing. No database or production configuration was inspected.

## Executive recommendation

Keep the user's access entitlements separate from any transaction evidence. The deletion worker currently clears `User.purchasedBooks` and the embedded `User.subscription`, but leaves the `StorePurchase` and `SubscriptionPurchase` ledgers linked to `User._id`. That link and the ledgers' continued retention are unresolved; the source does not establish that any specific field or entire record must legally be retained.

Before choosing retention, have finance/counsel identify the exact records and fields needed for accounting, tax, refunds, chargebacks, fraud prevention, or provider verification. The schemas inspected do not contain a transaction amount paid, tax/GST amount, invoice, refund amount, or refund date. These purchase records therefore should not be treated as complete accounting or tax evidence without further finance verification.

Recommended direction after those decisions: retain only an approved field allowlist in a restricted transaction-evidence store, independent of the ordinary User profile. Remove the `User._id` relationship where operationally possible; delete or irreversibly de-link fields not needed for an approved purpose. Do not add a substitute identity mapping or retain the full profile by default. A store transaction identifier or stable pseudonym may still be personal or linkable data and must be assessed as such. Keep the deletion request at `blocked_policy` until every required disposition is approved and implemented. Do not mark deletion complete based on this report.

## Data locations and field-by-field assessment

“Necessary” below means the field can support a listed operational task based on source behavior. It does **not** mean a legal retention duty has been established. No retention period or legal ground is asserted.

### `StorePurchase` — one-time book purchases

Model: `backend/src/models/StorePurchase.ts`. Verified purchases are created by `backend/src/routes/storePurchaseRoutes.ts`; provider state is refreshed in `backend/src/routes/storeNotificationRoutes.ts`; purchase verification helpers are in `backend/src/services/storePurchase.ts`.

| Field | Purpose in source | Personal or linkable? | Accounting / tax / refund / fraud / verification relevance | Can retain without user identity? | Recommended disposition after approval |
|---|---|---|---|---|---|
| `_id` | Internal row identifier. | Not directly identifying alone; linkable inside database. | Useful for updates and references; not accounting evidence by itself. | Usually yes if retained as a transaction-row key. | Keep only if the approved evidence record requires an internal key; otherwise remove with the row. |
| `store` | Identifies Google Play or Apple. | Not personal alone; can contribute to a transaction profile. | Necessary to choose verification and notification handling. Does not prove amount or tax. | Yes. | Retain only if needed for approved evidence or provider verification. |
| `transactionKey` | Unique provider transaction lookup/deduplication key. New Android one-time claims use a SHA-256 purchase-token digest; Apple claims use environment plus original transaction ID. Legacy formats may differ. | **Pseudonymous/linkable**, especially because provider systems can resolve it; a hash does not make it anonymous. | Important for duplicate-claim prevention, transaction verification, and matching refunds/revocations. Does not itself show money paid, tax, or refund amount. | Potentially, if separated from `userId`; remains provider-linkable and needs restricted access. | Retain only if finance/support/security approve its purpose and access. Minimize/rotate/delete when no longer needed under an approved rule. Inventory legacy formats before changing. |
| `userId` | References `User._id`, links purchase to an account, and is used to derive the store account token checked on notifications. | **Yes: direct internal account linkage.** | Supports ownership checks, restoration, and binding provider events to the account. Not an accounting amount or tax record. | Yes in principle if detached, but removing it requires refactoring provider binding and restore logic. A replacement stable mapping can still be personal data. | Remove or de-link from retained financial evidence when approved. Do not replace it with an identity map by default. Ensure deleted-account purchases can never restore app access. |
| `bookId` | References purchased catalog content and is used to grant/revoke book access. | Can reveal a user's purchase/content preference when joined to a user or transaction. | May help identify what was purchased or investigate a dispute; not a complete accounting record. | Yes, if the transaction row is no longer linked to a user, subject to linkability review. | Remove from the ordinary user profile (already represented by clearing `purchasedBooks`). Retain in separate evidence only if finance/support establishes a need. |
| `productId` | Store product identifier used to verify the purchase and map it to a book. | Not directly identifying alone; transaction linkage may make it personal. | Useful for provider verification and product reconciliation; does not establish price charged or tax. | Yes. | Allowlist only if required for approved verification/evidence. |
| `active` | Current local purchase entitlement/revocation state. Store events may update it. | Personal when linked to a user/transaction. | Useful for refund/revocation and access reconciliation; not proof of refund amount or accounting entry. | Yes. | Do not leave this as an access entitlement on the deleted User. Keep only if approved transaction workflow needs it; ensure it cannot grant access to the deleted account. |
| `createdAt`, `updatedAt` | Row creation and latest update timestamps from Mongoose. | Can be personal when associated with a transaction. | Potentially useful to audit verification/state updates; does not show the legal retention trigger or tax period. | Yes, as transaction metadata, but still linkable if combined with provider identifiers. | Keep only timestamps needed for an approved evidence purpose; define their meaning and eventual disposal with finance/counsel. |

### `SubscriptionPurchase` — recurring subscription lifecycle ledger

Model: `backend/src/models/SubscriptionPurchase.ts`. Verification and provider status lookup are in `backend/src/services/subscriptionPurchase.ts`; verification and restore paths are in `backend/src/routes/storePurchaseRoutes.ts`; server notifications update the ledger in `backend/src/routes/storeNotificationRoutes.ts`.

| Field | Purpose in source | Personal or linkable? | Accounting / tax / refund / fraud / verification relevance | Can retain without user identity? | Recommended disposition after approval |
|---|---|---|---|---|---|
| `_id` | Internal ledger-row identifier. | Not directly identifying alone; linkable inside database. | Useful for guarded updates, not financial evidence by itself. | Usually yes. | Keep only if needed as an internal transaction-row key. |
| `store` | Google Play or Apple. | Not personal alone. | Needed to select provider verification and lifecycle APIs; not proof of tax or consideration paid. | Yes. | Retain only for approved transaction/provider operations. |
| `transactionKey` | Provider subscription chain/claim key. Android is derived from the Play purchase token in the subscription service; Apple uses environment plus original transaction ID. | **Pseudonymous/linkable** to provider and subscription history. | Supports chain matching, duplicate prevention, verification, renewals and refunds/revocations. Does not show the actual amount or tax. | Potentially, but remains provider-linkable. | Restricted allowlist only after approval. Assess legacy values and provider re-identification risk. |
| `userId` | References `User._id`; used for account ownership and generating the external account token expected in store events. | **Yes: direct internal account linkage.** | Supports restore/ownership binding and notification correlation; not an accounting amount. | Possible only after decoupling current ownership/notification logic. | Remove/de-link from the ordinary profile and retained evidence if approved. Refactor provider matching so lifecycle events update a restricted evidence row but cannot recreate User entitlements. |
| `planKey` | Monthly/yearly plan classification. | Can reveal subscription behavior when linked to a person. | Useful for product/transaction classification; not invoice or tax evidence. | Yes. | Retain only if needed for approved reconciliation/support. |
| `productId` | Store subscription product identifier. | Not identifying alone; may become linkable through transaction data. | Needed to query provider subscription state and map a claim; not actual charged price. | Yes. | Retain only if required for approved verification/reconciliation. |
| `priceVersion` | HappiNotes plan version associated with the claim. | Can reveal offer/cohort when linked to user. | Helps explain the configured offer cohort, but is not proof of the store's actual charge, currency, tax, or invoice. | Yes. | Keep only if finance/support needs it; verify against store-specific product history rather than treating it as amount paid. |
| `active` | Latest locally recorded provider entitlement state. | Personal when linked to subscription chain. | Useful to reflect subscription/revocation state; not a refund amount or accounting record. | Yes. | Keep only for an approved restricted provider-evidence purpose; never use it to grant access to a deleted account. |
| `expiresAt` | Provider subscription expiry. | Personal subscription-history data when linked. | Useful for access and renewal state reconciliation; not proof of payment/tax. | Yes. | Retain only if approved for reconciliation/support. Do not infer a retention period. |
| `autoRenewing` | Whether provider reports automatic renewal. | Personal subscription behavior when linked. | Relevant to renewal/cancellation support and consumer communication; not accounting evidence. | Yes. | Retain only while an approved subscription support/reconciliation need exists; do not cancel billing from deletion processing. |
| `providerStateSignedAt` | Ordering timestamp for provider-signed lifecycle state, preventing stale events from overwriting newer state. | Linkable metadata with the transaction. | Useful for notification integrity and lifecycle ordering; not tax/accounting evidence by itself. | Yes. | Keep only if required to safely process provider events; restrict access and define expiry after legal/finance review. |
| `createdAt`, `updatedAt` | Ledger creation and update times. | Linkable transaction metadata. | Can support lifecycle audit; not a transaction amount, tax date determination, or approved retention trigger by itself. | Yes. | Keep only if needed for an approved purpose. |

### `User` purchase and subscription fields

Model: `backend/src/models/User.ts`; cleanup: `backend/src/services/accountDeletionWorker.ts`.

| Field | Purpose in source | Personal or linkable? | Necessary for financial/accounting tasks? | Can retain without user identity? | Recommended treatment |
|---|---|---|---|---|---|
| `_id` | Stable MongoDB account ID; referenced by purchase/subscription and deletion-request records. Also feeds store account-token binding. | **Yes, pseudonymous identifier** because related records resolve it to account history. | Useful for app ownership and provider association; not itself financial evidence. | Could retain as a transaction-scoped pseudonym only if approved, but current reference graph makes it a cross-record identity link. | Do not retain the whole User profile because ledgers reference this key. After approved evidence separation, remove or de-link the User reference as far as operationally possible. Any stable substitute link requires privacy/legal review. |
| `purchasedBooks[]` | Per-user book access entitlement. | **Yes**, reveals account-linked purchase/library choices. | No: it is entitlement state, not the financial evidence itself. | Not applicable once access is removed. | Clear during deletion. Current worker sets it to an empty array; it does not delete the separate `StorePurchase` ledger. |
| `subscription` | Embedded access/provider cache: `store`, `planKey`, `productId`, `priceVersion`, `transactionKey`, `active`, `expiresAt`, `autoRenewing`, `lastVerifiedAt`, `providerStateSignedAt`. | **Yes/linkable**, particularly `transactionKey` and subscription activity. | Operationally useful as app entitlement state, but not a ledger of actual amounts, tax, invoice, or refunds. | Not needed in the profile after deletion; any approved provider evidence belongs in a separate restricted record. | Unset the entire embedded field to revoke HappiNotes Premium. Current worker does this. Do not treat this as cancellation of store billing or deletion of the separate subscription ledger. |
| `email`, `phoneNumber`, `name`, `password`, profile settings | Identity/contact/authentication or ordinary profile information. | Yes. | Not shown by these schemas to be necessary financial evidence. | The purchase schemas have separate fields; do not copy these into financial records without a specifically approved need. | Remove/anonymise through the approved profile/auth deletion stages. Current worker removes contact/auth data and replaces name/resets settings. |

### Other account links and shared commercial data

| Record/reference | Link or purpose | Relevance and recommendation |
|---|---|---|
| `AccountDeletionRequest.userId` (`backend/src/models/AccountDeletionRequest.ts`) | Links request status/history to `User._id`. | Not financial evidence. Keep only the minimum restricted workflow/audit record after an approved decision; eventually de-link or pseudonymise if allowed and technically compatible with status/idempotency. It remains under the existing deletion policy gate. |
| `AccountDeletionReauth.userId`, reset token and OTP identifiers | Authentication/request verification records associated with account. | Not financial evidence. The worker deletes user-scoped reauthentication/reset proofs and matching OTP records. No reason to copy them to purchase evidence. |
| `SubscriptionPlan` and `StoreProduct` | Shared plan/price catalogue and store product provisioning state; no per-user key in their schemas. | Not user transaction records and should not be deleted for a single account. Price versions/product IDs do not establish what an individual actually paid. |
| Provider account tokens | Derived from `User._id` for Google/Apple purchase binding in `backend/src/routes/storeNotificationRoutes.ts` and purchase services; not stored as a dedicated ledger field. | A deterministic token is pseudonymous/linkable. Current notifications use it to verify ownership. Decoupling the financial evidence from `userId` requires an approved redesign of provider binding and restore rules; never allow a notification to recreate access for a deleted account. |

## Refund, cancellation, accounting, and tax record audit

In the inspected models and backend references:

- There is no dedicated refund, chargeback, tax invoice, GST, tax amount, currency-paid, gross/net amount, or accounting-voucher model associated with a user purchase.
- `StorePurchase.active` and subscription `active`/`expiresAt`/`autoRenewing` are state fields, not complete refund or accounting records. Store notification code can re-check provider state and update these fields; it does not create a complete local refund record.
- Product price and price-version history live in shared plan/catalogue records. They are configured product prices, not evidence of the customer's exact localized checkout amount or tax paid.
- The source does not automatically cancel a Google Play or Apple subscription during account deletion. Store billing remains controlled by the relevant store and customer actions.
- Store verification keys are operational transaction identifiers. Hashing a provider token does not by itself establish that the result is anonymous or that it must be retained.

Finance must identify which external store statements, payout reports, invoices, tax records, refund records, or accounting vouchers actually serve the company's books and are retained outside these app models. Counsel/finance must then map any requirement to exact fields and applicable facts. This repository audit cannot establish that the current purchase/subscription rows are legally required records.

## Recommended target disposition

1. **Ordinary profile:** remove direct identity/contact/authentication data; do not retain the User document merely because a financial row points to it.
2. **Access state:** clear `User.purchasedBooks` and unset `User.subscription`. Preserve no path by which provider events, restore APIs, or purchase verification can recreate access for a deletion-pending/completed account.
3. **Financial evidence:** create/retain only an approved field-level evidence record separated from the User profile. Candidate fields for finance/counsel review are store, a provider transaction locator, product/plan classification, provider state, and only the timestamps needed to explain the transaction. This is a candidate list, not a retention approval.
4. **Identity linkage:** remove `userId` from any retained evidence where possible. If provider verification requires a pseudonymous binding, document the exact binding, why it is needed, who can resolve it, and how/when it is removed. Do not use email, phone, full User profile, or a new identity map as a shortcut.
5. **Unneeded fields:** delete or de-link book/user association, stale entitlement cache, and transaction metadata not necessary for the approved evidence purpose. Hashing a token alone is not a deletion decision.
6. **Refunds and notifications:** allow authenticated provider events to update only the restricted evidence state needed for refund/revocation reconciliation. Keep deleted-account entitlement writes fenced off. Preserve duplicate-claim protection only to the extent approved and implementable without retaining the full profile.
7. **Completion gate:** keep `blocked_policy` until finance/counsel approve exact fields, purposes, legal provisions if established, applicability, retention trigger/period if established, access, and disposal; engineering then implements and records the lease-fenced result. No manual completion override and no completion claim based on this draft.

## Owner and finance/counsel decisions required

- Which records outside the app (store payout reports, invoices, tax records, vouchers) are the actual accounting source of record?
- Which exact app-ledger fields, if any, are needed for accounting, tax, refunds, chargebacks, fraud prevention, or provider verification after account deletion?
- What is the applicable legal provision and company-specific applicability for each field? What trigger and period apply, if established?
- Which roles may access retained evidence, and what audit controls apply?
- Can transaction notifications be safely reconciled after `userId` is removed, using transaction identifiers alone or another approved non-profile binding?
- How should deleted-account refund/support cases be handled while preventing account restoration and without retaining unnecessary identity?
- What is the approved disposal method at expiry, including backups, exports, provider logs, and deletion-request history?

Until those questions are resolved, treat the store ledgers as **unresolved data in a blocked workflow**, not as legally approved retained records. Do not delete them ad hoc, do not treat them as anonymous, and do not mark the account deletion complete.
