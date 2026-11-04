# HappiNotes Data Safety Inventory

**Source audit: 2026-11-04.** Engineering inventory for owner/legal review; not a completed Play Console declaration. Include collected/shared data from every SDK and production provider before submission.

| Data category | Source evidence | Purpose / recipient indication | Deletion / retention status |
|---|---|---|---|
| Name and account identifier | `User.name`, email, phone in MongoDB | Account/authentication; backend and email provider as applicable. | Profile retained at policy gate; approved completion not implemented. |
| Password/authentication | Hashed password field, session version; OTP and reset artifacts | Account security; backend. | OTP/reset artifacts deleted by worker; password and profile retained. |
| Email/phone | `User`; OTP identifier; Resend recipient | Sign-in, OTP, support. | Identity fields retained at gate; external deletion verifies email only. |
| User content/preferences | Favourites, book collection; device cache/preferences | Library and app functionality. | Favourites/collection cleared by worker; local cache clearing not orchestrated. |
| Purchase history | StorePurchase / SubscriptionPurchase, transaction/product IDs, user link | Verify purchase, access, restoration, accounting support. | Retained at gate; necessity/period not approved. |
| Subscription status | Embedded User subscription and subscription ledger | Premium access and lifecycle. | Retained at gate; app-store billing remains separate. |
| Premium entitlement | `User.subscription`, `User.purchasedBooks`, purchase active state | Determine access to subscribed and individually purchased content. | Retained at gate; removal sequence depends on purchase restoration and billing decisions. |
| Device identifiers | FCM tokens in User | Push delivery via Firebase. | Cleared by worker; Firebase-side retention not verified. |
| Support communications | No support ticket model/API found; owner provides support email and telephone. External mailbox/call data not visible in repository. | Customer support and privacy requests. | Worker does not process external mailbox or call records; owner/provider retention is unknown. |
| Deletion request | User reference, request source/status/history, token hash | Verify, track and process deletion. | No TTL; request history retained; approved period absent. |
| Content/media | Content metadata and media URLs; Cloudinary | Deliver curated catalogue. | User deletion does not remove shared catalogue assets. |
| Local/browser state | Flutter preferences/cache; web sessionStorage/localStorage | App cache, progress, admin auth, deletion tracking. | Client-side clearing behavior and lifetimes need full review. |
| Operational logs | Backend console output; Railway runtime likely receives process logs. | Operations/debugging. | Provider retention not verified. |
| Backups/archives | No repo backup job/model found. | Database/provider may have backups. | Actual existence, region, expiry and deletion not verified. |
| Analytics/ads/crash reports | No dedicated package identified in reviewed Flutter manifest/source. | Production configuration may add services. | Must verify final SDK and network inventory. |

## Google Play declaration work remaining

Confirm each category against final binary, SDK list, backend, store APIs and Railway/Firebase/Resend/Cloudinary settings; classify collection, sharing, purpose, optionality, encryption in transit, deletion request and account deletion behavior per current Play form. Source inspection alone cannot truthfully complete or submit the form. Current deletion gate means full data deletion is not available.
