# HAPPINOTES — OWNER DECISION & RELEASE APPROVAL SHEET

**Company:** AIRASKILL CITY PRIVATE LIMITED  
**Review date:** 4 November 2026  
**Current release status:** NO-GO  
**Record status:** Recommendations for owner review; no legal/finance approval or release authorization is recorded here.

## 1. Decisions recommended for owner approval

| Area | Recommended decision |
| --- | --- |
| Account deletion | Retain the existing safety gate until approved deletion rules are implemented. |
| Authentication data | Delete credentials, reset tokens, OTPs and reauthentication proofs as approved. |
| Profile data | Anonymise or erase personal fields according to counsel-approved rules. |
| Purchases | Retain only transaction evidence justified by applicable requirements. |
| Subscriptions | Do not automatically cancel store billing. Handle entitlement removal according to approved rules. |
| Support records | Minimise unnecessary personal information. |
| Logs and backups | Apply documented retention, redaction and expiry procedures. |
| Deletion audit history | Retain only a minimal, restricted audit record for an approved period. |
| Google Play target API | Retain API 36 configuration. |
| Signing key | Preserve the existing upload keystore. Never replace it without a verified recovery plan. |

## 2. Decisions requiring legal or finance review

These must not be invented by engineering:

- Applicable legal grounds and retention periods.
- Exact purchase and subscription records that must be retained.
- Treatment of refunds, chargebacks and accounting records.
- Consumer cancellation and renewal disclosures.
- GST and applicable market tax treatment.
- Launch countries and governing-law choices.
- Age eligibility and children safeguards.
- Vendor disclosures and international data transfers.
- Grievance officer designation and statutory responsibilities.

## 3. Technical release requirements

Before AAB generation:

- Complete the approved account-deletion implementation.
- Approve and publish the required legal pages.
- Verify Google Play subscription products and pricing.
- Verify Railway deployment and MongoDB compatibility.
- Confirm Play Console package and version-code availability.
- Confirm the upload certificate matches Play Console.
- Complete the Data Safety and App content declarations.
- Verify the production API origin and release configuration.

## 4. Release authorization

No production publication is authorized by this document.

Final verification, AAB generation, and Google Play submission require separate explicit authorization after the release blockers are resolved.
