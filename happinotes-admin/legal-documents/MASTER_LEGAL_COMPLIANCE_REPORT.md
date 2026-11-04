# HappiNotes legal, privacy and release-readiness audit

**Audit date:** 2026-11-04
**Entity:** AIRASKILL CITY PRIVATE LIMITED
**Scope:** HappiNotes web application and Flutter mobile application source in this repository. This is an engineering and compliance-readiness audit, not legal advice, a legal opinion, a security certification, or proof of production configuration.

## Executive decision

**Release decision: NOT READY for a public Google Play release on the evidence available.** The account-deletion API accepts and tracks requests, but the worker pauses at `blocked_policy`; the app currently cannot complete deletion. Google Play requires deletion both in-app and through an external web resource and expects associated data to be deleted, subject to disclosed justified retention. The retention and deletion behavior must be approved, implemented, and verified before claiming readiness.

The policies in this package are review drafts. The legal entity and contact details below are owner-confirmed, but the documents are not approved by counsel or finance. Store prices are proposals; live prices and markets cannot be confirmed from source. No deployment, push, build, AAB, production access, or tests were performed.

## Confirmed operator details

**AIRASKILL CITY PRIVATE LIMITED**
2619, T2, 6th Floor, HiLITE Business Park, HiLITE City, near Guruvayurappan College, Kozhikode – 673014, Kerala, India.
Support and privacy contact: hello@happinotes.online · +91 8089239823
Website: https://happinotes.online

## What the product does

The repository contains a Flutter client for audio/video stories and related content, accounts, favourites and collections, push notifications, and Google Play / Apple store purchase flows. A Next.js website provides the public experience and admin tools. A TypeScript/Express backend stores accounts, content, purchase/subscription state and deletion requests in MongoDB. Source configuration indicates Railway hosting, Resend email delivery, Firebase Cloud Messaging, Cloudinary media, and Google Play / Apple verification integrations; actual production project settings, regions, contracts, retention and account status were not accessible or verified.

## Findings and risk

| Area | Source finding | Readiness |
|---|---|---|
| Privacy notice | Source-based inventory and contacts exist, but provider regions, complete vendor list, purposes, legal bases, age audience, rights process and retention periods remain unconfirmed. | Draft; legal and owner review |
| Account deletion | In-app authenticated request and external email OTP workflow share a queue. Phone-only users lack external verification. Worker deletes password-reset/OTP records and clears favourites, collections and push tokens, then blocks. It retains profile, purchases, subscription and entitlement. | **Release blocker** |
| Subscription | Google Play and Apple in-app purchase code exists; provider verification and backend entitlement records exist. Checkout price comes from the store product; the app also displays offer/reference amounts from backend plan configuration. If admin/store sync is stale or differs, the discount copy could disagree with checkout. Store product/configuration, localized prices, tax, live market availability and price-change behavior require console verification. | Technical/account review; reconcile backend price metadata to each store before publication |
| Pricing | Admin settings contain regional prices, per-store publish actions/status and India proposed ₹1,999 reference / ₹699 offer. No evidence here establishes that store sync succeeded or that those amounts are live. | Do not advertise as live |
| Cookies and tracking | Web source uses session storage for external deletion status and local storage for admin token and playback progress. No dedicated analytics, advertising or crash-reporting package was identified in the reviewed Flutter manifest/source. This does not establish production network behavior or hosting telemetry. | Confirm production tools and cookie consent obligations |
| Children | No verified target audience or age gate/parental-consent implementation was established. | **Owner/legal/Play blocker** |
| Support / grievances | Email and phone are confirmed; no support-ticket model was found. A named statutory grievance officer/designation and response process were not confirmed. | **Owner/legal blocker** |
| Security / incident response | Password hashing, authentication and store-verification controls appear in code. The admin web client stores its bearer token in browser local storage. No independent security review, full threat model, incident response evidence, vendor assurance, backup testing or production control evidence was supplied. | Operations review required; assess admin XSS/session safeguards and access controls |
| Markets | Code includes country/territory pricing and store availability mechanisms. No authoritative launch-country list or active country configuration was verified. | Confirm console and business markets |

## International applicability approach

Do not assume the entire world is a current target market merely because the website is reachable or regional pricing is supported. A competent launch-market assessment must compare (a) company establishment, (b) store availability, (c) advertising/marketing, (d) actual user locations, and (e) payment and support arrangements. A short screening matrix is in [INTERNATIONAL_COMPLIANCE_MATRIX.md](INTERNATIONAL_COMPLIANCE_MATRIX.md). Counsel should determine which laws apply before launch in each intended market.

## Required before release

1. Counsel and finance approve retention categories, lawful grounds, periods, deletion exceptions, refund/tax terms, consumer rights, age eligibility and jurisdiction-specific disclosures.
2. Implement the approved deletion outcome end-to-end. Do not mark a request complete while retained data, provider-side deletion, backup treatment, or entitlements remain unresolved.
3. Confirm whether deletion must cancel or preserve access to content purchases; communicate that deleting an account does not cancel store billing, and give store cancellation steps.
4. Confirm all production processors, subprocessors, regions, contracts, security controls, backup/log expiry and incident contacts.
5. Complete Google Play Data safety and Data deletion declarations from actual release data flows and SDK behavior; provide the public deletion link and privacy notice.
6. Confirm Play target audience, app access credentials for review, subscription products/base plans/offers, country availability, taxes, account ownership and live store pricing in Play Console. Complete Apple checks separately when preparing iOS.
7. Make sure in-app and public legal links, subscription screen notices, restore flow, cancellation guidance, contact and privacy notices match actual behavior.
8. Obtain legal/finance approval of the final publication text and the final release artifact. This report itself does not authorize a release.

## Source references checked

- [India DPDP Act, 2023 — India Code](https://www.indiacode.nic.in/handle/123456789/22067) and [DPDP Rules 2025 / commencement information — MeitY](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025%3B). Commencement is staged; verify the Gazette and corrigendum before relying on a date.
- [GDPR — EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj): territorial scope and data-subject rights depend on facts and applicable provisions.
- [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en-EN) and [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).
- [Google Play target API requirement](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en): as of the audit date new apps/updates must target API 36 or higher. Flutter Gradle configuration delegates the final target SDK to the Flutter plugin, so the merged release manifest was not verified.
- [Google Play Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) and [subscription setup guidance](https://developer.apple.com/app-store/subscriptions/) confirm app-side account deletion, accessible privacy/terms links, clear localized renewal price and restore access as review topics; Apple release readiness remains separate and unverified.
- [UK DMCC Act 2024, Part 4](https://www.legislation.gov.uk/ukpga/2024/13/part/4) and [UK subscription-contract guidance](https://www.gov.uk/government/publications/subscription-contracts) (as applicable from statutory commencement; assess current rules for launch date).
- [US FTC COPPA rule amendments](https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-312-coppa-final-rule-amendments) and [FTC guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).
- [India Consumer Affairs e-commerce guidance](https://consumeraffairs.nic.in/sites/default/files/file-uploads/latestnews/Guidelines%20on%20e-Commerce.pdf). Applicability and required role designation must be assessed by counsel against current legislation and business model.

## Limits

This is a static source/configuration review and public-law-source screening. It does not verify Railway, Google Play Console, Apple App Store Connect, MongoDB, Firebase, Resend, Cloudinary, DNS, TLS, analytics, backups, financial/tax records, contracts, actual users, app binary behavior or external developer account settings. No application tests or build were run, as instructed.
