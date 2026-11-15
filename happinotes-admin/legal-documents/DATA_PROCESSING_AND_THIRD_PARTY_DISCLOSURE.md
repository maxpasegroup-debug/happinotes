# Data Processing and Third-Party Disclosure Register

**Internal draft — verify against production accounts and signed contracts.**

| Provider/system evidenced in source | Apparent function / data path | Unverified before publication |
|---|---|---|
| MongoDB configured by `MONGODB_URI` | User, content, purchases/subscriptions, deletion workflow data and per-installation security reports (optional foreground device location with accuracy/time). | Actual provider/cluster, region, backups, access, retention, contract and deletion guarantees. |
| Railway configuration | Backend deployment and process/stdout logs. | Project/service region, operators, log retention, backup/restore, incident terms and production environment. |
| Resend | Password-recovery and OTP email delivery; recipient email and message content/code. | Account region, subprocessors, retention, DPA, suppression/log retention and production sender. |
| Firebase Cloud Messaging | Push delivery using device tokens and notification payloads. | Firebase project settings, region, diagnostic data, token retention and provider terms. |
| Cloudinary | Catalogue cover/audio/video asset hosting. | Whether any personal data is uploaded, account region, delivery logs, retention and contract. |
| Google Play | Android purchase and subscription verification integration. Owner identifies Android as first launch platform. | Actual products, account configuration, countries, transaction data, live status, price cohorts and policies require production/Console confirmation. |
| Apple App Store services | StoreKit client and server-side verification/notification integration exists in source. Owner identifies iOS as a later release. | Production account configuration, data exchange, countries, live status, price cohorts and policies are not verified; do not describe Apple billing as currently active for the Android-first release. |
| ipapi.co / ipwho.is | Admin server sends the recorded public IP for approximate geolocation; ipwho.is is a backup. No account identifiers or auth token are sent. | Confirm provider accounts, quotas, privacy arrangements and regional handling; align mobile and store disclosures. |
| Serper / Google image search and reference image hosts | Admin server sends only the reported model or resolved product name to Serper when configured. Admin browser loads the selected reference image. | Verify provider terms, source image rights, model matching and disclosure. No user account token or user IP is sent in the search. |
| Wikimedia Commons / Wikidata | Admin server searches only the reported device model for a licensed reference photo. | Verify matching, attribution, provider terms and deployment behavior. |
| OpenStreetMap tiles | Admin browser loads tiles for the displayed IP-derived or separately consented device location. | Confirm tile-policy compliance and usage capacity. |
| User device/browser | Local/session storage, cached catalogue, preferences, admin token and playback progress. | Complete SDK/storage/network inventory, encryption, shared-device exposure and user clearing behavior. |

This list is code-derived and may be incomplete. No provider-region or contract statements should be published until confirmed. Add analytics, crash reporting, support desk, CDN, email/web hosting or other vendors if production uses them.


VPN access checks use the local Android network API and the existing authenticated backend; no external VPN intelligence provider is called. MongoDB stores app installation hashes, detection incident identifiers, count, server-observed IP and timestamps. The latest 50 detection records are removed during account deletion; active hashed installation/email restrictions persist until administrator review. Include these non-anonymous security records in the operational retention/access review. Optional device-location reports also include collection status/check time, under their existing inactivity expiry.
