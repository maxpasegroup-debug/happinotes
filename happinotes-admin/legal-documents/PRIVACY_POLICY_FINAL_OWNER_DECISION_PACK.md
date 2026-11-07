# Privacy Policy Final Owner Decision Pack

**Internal decision draft — not a privacy policy, legal opinion, or publication approval.**  
Repository review: 6 November 2026. Other legal pages and internal decision documents retain their draft labels; the owner has authorized publication of the Privacy Policy. The account-deletion `blocked_policy` remains in force.

Use this pack to collect decisions. “Recommendation” is engineering guidance only; it is not an approved company decision. No legal ground, retention period, provider location, or approval is assumed.

## 1. Confirmations the company owner must provide

| Decision required | Why it matters | Responsible | Recommendation (not approved) |
|---|---|---|---|
| Confirm that the owner-provided intent remains worldwide availability and 18+ minimum age; identify any launch-country or platform exclusions. | The owner supplied worldwide and 18+ as product intent. Specific rights, child safeguards and store declarations still depend on each market, actual availability and implemented age controls. | Owner, with counsel | Record worldwide/18+ as owner intent, not as legal approval or proof that the app enforces age. Counsel must determine country applicability and the owner must confirm actual launch availability. |
| Complete production vendor/subprocessor list and legal names, including database/hosting, email, push, media, website/CDN, support, analytics, crash reporting and monitoring providers. Identify which company account owns each service. | The policy must accurately identify who receives or processes data and for what function. Source package names and `.env.example` placeholders do not prove production use. | Owner / operations | Reconcile each provider against production accounts and signed agreements; do not state “none” based only on missing direct SDKs. |
| For each provider: data categories, purpose, role, processing region, subprocessors, retention, backup/log behavior and applicable contract/DPA. | Needed to disclose recipients, international transfers, retention and deletion limits. | Owner / operations, with counsel | Publish only verified details. Where a provider's role or location is unknown, resolve it before publication. |
| Actual collection and use across the consumer app, website and admin portal, including device/browser storage, playback markers, IP/request logs, diagnostics and any cookies or telemetry. | The policy and Play Data Safety answers must match all shipped and deployed surfaces. | Owner / product / engineering | Use the final release binary and production settings as evidence; distinguish consumer data from staff/admin data if separate notices are appropriate. |
| Account/privacy support and statutory grievance contacts, and who is accountable for each request type. | Users need a real route for privacy requests and complaints; statutory designations must not be invented. | Owner | Confirm the current support/privacy email and phone remain valid and designate named roles only after appointment. |

## 2. Finance decisions required

| Decision required | Why it matters | Responsible | Recommendation (not approved) |
|---|---|---|---|
| Which exact purchase, refund, chargeback, tax and subscription fields serve an active operational or accounting purpose; identify any retention exception field by field. | Purchase ledgers remain linked to the User record at the deletion gate. A generic accounting label does not justify retaining a complete profile or ledger. | Finance, with counsel | Minimise by default; separate transaction evidence from ordinary identity and restrict access. Do not set a period or legal ground without finance/counsel support. |
| For each approved retained field, specify purpose, applicable provision if established, retention trigger and period/criteria, access controls, and disposal/anonymisation at expiry. | These are necessary for the privacy notice, deletion behavior and Data Safety declarations. | Finance / counsel | Record “unresolved” rather than inventing a legal period. |
| What transaction data is received from Google Play/Apple, what remains in HappiNotes, and who handles renewals, cancellation, refunds, restoration and support. | The policy must distinguish store billing data from HappiNotes account access and explain the effect of account deletion. | Finance / product | Preserve the current code-backed statement that account deletion does not automatically cancel store billing; verify actual store configuration and customer process. |

## 3. Qualified legal counsel decisions required

| Decision required | Why it matters | Responsible | Recommendation (not approved) |
|---|---|---|---|
| Applicable legal basis/purpose for each processing activity by launch market, including account, authentication, purchases, notifications, security and support. | The current policy expressly leaves legal bases unresolved. | Qualified privacy counsel | Map each purpose to the applicable jurisdiction and actual practice; do not use a generic basis for every category. |
| Applicable user rights, exceptions, identity checks, request channels, response times and complaint/escalation process. | The current rights section says these depend on law and audience but does not tell users what applies or how to exercise each right. | Qualified privacy counsel | Supply market-specific wording and validated operational steps; do not invent deadlines. |
| Children’s privacy and age/parental-consent requirements. | Target age is unconfirmed and must align with product controls and Play declarations. | Qualified privacy counsel, with owner | Decide after the owner confirms the actual audience and safeguards. |
| Cross-border transfers, required safeguards, controller/processor roles, vendor notices and any required grievance/statutory disclosures. | Provider regions and contracts are not verified. | Qualified privacy counsel | Review actual contracts and service regions before drafting transfer or statutory-contact claims. |
| Record-level retention grounds/periods and deletion limits, including logs, backups and deletion-request history. | The deletion worker currently stops at `blocked_policy`; counsel/finance have not approved the exceptions. | Qualified privacy counsel with finance | Approve only evidence-supported, limited exceptions. Keep the gate until approved rules are implemented and verified. |
| Security and incident-response wording that accurately describes deployed safeguards and applicable notice duties. | Source authentication controls do not establish production encryption, incident procedures or provider safeguards. | Qualified privacy counsel, with security owner | Avoid absolute-security claims; approve wording only after security/operations confirm controls. |

## 4. Engineering tasks required before publication

- Reconcile the final Android release binary, Flutter dependencies, website code, backend data flows and production provider settings into one current data inventory; include transitive SDK and telemetry behavior.
- Verify actual provider setup, regions, logging/backup destinations, deletion controls and restore procedures with the account owners. Do not use `.env.example` values as production evidence.
- Complete the approved account-deletion operations. Current behavior removes several account fields and entitlements but retains the User identifier/deletion state and purchase/subscription evidence; requests can remain at `blocked_policy`. Do not claim complete deletion until approved checkpoints and exceptions are implemented and verified.
- Make the privacy policy, account-deletion page, in-app legal screen and Play Data Safety/Data deletion answers match the implemented behavior and approved disclosures.
- The owner has authorized publication of the privacy notice dated 6 November 2026. The privacy route is configured to show the final text without the shared draft notice; other legal pages retain their draft notice. Verify the deployed public URL over HTTPS without login and confirm it renders the exact authorized text before entering it in Play Console.
- Owner authorization to publish does not constitute legal, finance or operational approval. Record those reviews separately; do not characterize this policy as legally approved or globally compliant.

## 5. Existing facts verified from repository source

- The `User` model contains account name, optional email/phone, password verifier, language preference, favourites, collections, purchased-book references, FCM tokens, embedded subscription entitlement and session version.
- The deletion worker removes password/reset/reauthentication artifacts and matching OTPs; resets selected profile fields; removes email/phone; clears favourites, collections, FCM-token references and embedded book/Premium entitlements.
- The worker does **not** delete the User document or its internal identifier. Purchase/subscription ledgers and other unresolved categories remain behind `blocked_policy`; the source therefore does not implement complete account/data deletion.
- External deletion uses verification of the registered email; phone-only external verification is unsupported. Account deletion does not automatically cancel Google Play or Apple billing.
- Source integrations exist for Resend email, Firebase Cloud Messaging, Cloudinary, MongoDB configuration, Railway deployment configuration, and Google Play/Apple purchase paths. The source identifies these integrations, not their live accounts, regions or settings.
- Flutter and web code use local/session storage for preferences, tokens, cached/catalogue state and a web playback-completion marker. No backend listening-position history field was found in the reviewed source; this does not establish what production SDKs or infrastructure collect.

## 6. Items that cannot currently be verified

- Production vendor accounts, provider legal entities, regions, subprocessors, contracts, actual retention, telemetry, database encryption, backup/log configuration and deletion guarantees.
- Whether Google Play products/configuration are live and exactly which transaction details are exchanged. Apple billing source integration exists, but its production configuration and operational status are unverified; owner intent is Android first and iOS later.
- Actual Play availability by country, app-enforced age controls, applicable legal grounds, statutory contacts, user-rights deadlines, cross-border safeguards, tax/accounting retention requirements and counsel/finance approval. Worldwide market and 18+ minimum age are owner-provided intent only.
- Whether the public privacy route is currently deployed and accessible worldwide over valid HTTPS. The repository contains the route but source alone does not prove live availability.
- Completion of account deletion and deletion of support/provider/log/backup data; source documents explicitly leave these decisions or operations unresolved.

## Decision record

Owner, finance and counsel decisions must be recorded against the items above before this pack can be closed. The privacy policy text is no longer presented as a draft on its dedicated website route, as authorized by the owner; deployment and live URL verification remain to be confirmed. This document is not legal approval or Google Play approval.
