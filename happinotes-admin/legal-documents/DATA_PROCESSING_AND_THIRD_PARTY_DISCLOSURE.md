# Data Processing and Third-Party Disclosure Register

**Internal draft — verify against production accounts and signed contracts.**

| Provider/system evidenced in source | Apparent function / data path | Unverified before publication |
|---|---|---|
| MongoDB configured by `MONGODB_URI` | User, content, purchases/subscriptions, deletion workflow data. | Actual provider/cluster, region, backups, access, retention, contract and deletion guarantees. |
| Railway configuration | Backend deployment and process/stdout logs. | Project/service region, operators, log retention, backup/restore, incident terms and production environment. |
| Resend | Password-recovery and OTP email delivery; recipient email and message content/code. | Account region, subprocessors, retention, DPA, suppression/log retention and production sender. |
| Firebase Cloud Messaging | Push delivery using device tokens and notification payloads. | Firebase project settings, region, diagnostic data, token retention and provider terms. |
| Cloudinary | Catalogue cover/audio/video asset hosting. | Whether any personal data is uploaded, account region, delivery logs, retention and contract. |
| Google Play | Android purchase and subscription verification integration. Owner identifies Android as first launch platform. | Actual products, account configuration, countries, transaction data, live status, price cohorts and policies require production/Console confirmation. |
| Apple App Store services | StoreKit client and server-side verification/notification integration exists in source. Owner identifies iOS as a later release. | Production account configuration, data exchange, countries, live status, price cohorts and policies are not verified; do not describe Apple billing as currently active for the Android-first release. |
| User device/browser | Local/session storage, cached catalogue, preferences, admin token and playback progress. | Complete SDK/storage/network inventory, encryption, shared-device exposure and user clearing behavior. |

This list is code-derived and may be incomplete. No provider-region or contract statements should be published until confirmed. Add analytics, crash reporting, support desk, CDN, email/web hosting or other vendors if production uses them.
