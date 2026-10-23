# HappiNotes store subscriptions

This is the canonical product map for the Android and iOS launches. Store
records must use these identifiers; product IDs are difficult or impossible to
change after publication.

## Membership

| Field | Launch value |
| --- | --- |
| Customer-facing name | HappiNotes Premium |
| Billing term | Monthly auto-renewing subscription |
| Trial | None |
| Benefits | All premium audiobooks and non-preview chapters |
| Reference price | INR 299/month, carried forward from the existing monthly plan |
| Access account | The signed-in HappiNotes account that completed the verified purchase |

The INR 299 value is the existing backend monthly price and a proposed store
base price. Confirm the available price tier and final consumer price in both
consoles before submitting. Local storefront prices, taxes, and currency
conversion may differ; do not show a hard-coded INR amount in the app. Display
the localized price returned by the store.

## Platform product IDs

| Store | Product ID | Product type |
| --- | --- | --- |
| Apple App Store Connect | `com.happinotes.premium.monthly` | Auto-Renewable Subscription, one month |
| Google Play Console | `happinotes_premium_monthly` | Subscription with a one-month auto-renewing base plan |

Use `monthly` as the Google base plan ID. The app sends the active offer token
for that base plan to Google Play Billing.

Use one Apple subscription group named `HappiNotes Premium`; the product is its
monthly tier. The Google product has one monthly base plan. Do not create yearly
or lifetime products for the first launch. The two store IDs are deliberately
platform-specific while representing the same HappiNotes membership.

Suggested store description:

> Unlock every Premium audiobook and all full chapters in the HappiNotes
> listening library. Your subscription renews monthly until cancelled. Manage or
> cancel it in your Apple or Google account settings.

## Subscription behavior

- **Cancel:** stop future renewal; keep Premium access through the paid-through
  date reported by the store.
- **Billing problem:** keep access only while the store reports an active
  entitlement or an applicable grace period. Revoke it when the store reports
  expiration or billing-retry termination.
- **Refund or revoke:** follow the store's verified refund/revocation event and
  remove the entitlement from its effective date. Do not trust a client-only
  claim.
- **New device, same store account:** offer the platform's restore/sync action,
  then attach the verified transaction to the signed-in HappiNotes account.
- **Switch between iOS and Android:** native restore is platform-specific. The
  user signs into the same HappiNotes account; the backend can keep access on
  both platforms only while it independently verifies the originating store
  entitlement as active. A purchase in one store cannot be restored as a
  purchase in the other store.
- **Multiple store purchases:** avoid creating a second active purchase when
  the account already has Premium. If duplicate purchases occur, each store
  subscription remains managed and cancellable in that store.

## Store setup and implementation status

Store records and prices are **not yet created**. They require access to the
Apple Developer/App Store Connect and Google Play Console accounts. Both records
must be associated with the existing app identifiers `com.happinotes.app`.

The Expo subscribe screen uses `expo-iap` to fetch the store-localized monthly
price, start a platform purchase, and restore purchases. The backend verifies
Apple signed transaction JWS data with Apple's App Store Server Library and
Google purchase tokens with the Android Publisher API. It binds the transaction
to the signed-in HappiNotes account and updates Premium only after verification.
Purchase evidence is not logged or trusted solely because the client reports
success. The former Razorpay checkout, webhook, plans, offers, and environment
variables have been removed from active code.

The backend stores each verified platform subscription in its own record with
the store, product ID, paid-through expiry, latest transaction/order ID, a
hashed purchase identifier, and whether the store says it will renew. Apple
Server Notifications V2 events are signature-verified and deduplicated by
notification UUID. Google RTDN push requests require Google OIDC authentication;
each event then triggers an Android Publisher API status lookup. Both paths
refresh the HappiNotes account entitlement, while admin complimentary grants
remain marked as `admin` and separate from store purchases.

`expo-iap` and `expo-dev-client` are installed for native builds. The existing
EAS `development` profile creates a custom development client; do not use Expo
Go for purchase tests. Test transactions require the corresponding App Store
Sandbox/TestFlight or Google Play license/internal-testing setup, plus the
Railway verifier credentials described in [`backend/RAILWAY.md`](backend/RAILWAY.md).

Before store submission, finish these tasks:

- [ ] Create the iOS and Android app records under the existing bundle/package IDs.
- [ ] Create the product IDs above with the monthly renewal terms and no trial.
- [ ] Confirm the available price tier and set matching launch-market pricing.
- [ ] Complete localized descriptions, subscription disclosures, screenshots,
  review notes, and reviewer access details in each console.
- [x] Implement native store purchase, pending/failure/cancel, and restore flows
  in Expo.
- [x] Verify Apple and Google purchase evidence on the backend before enabling
  access; reject evidence linked to a different HappiNotes account.
- [x] Expire verified access when the store-reported paid period ends.
- [x] Receive Apple App Store Server Notifications V2 and authenticated Google
  Play RTDN events; verify event authenticity and reconcile purchases against
  store state before updating account access.
- [x] Deduplicate store events and keep complimentary admin access separate
  from Apple/Google purchase records.
- [ ] Configure Apple verification certificates/App Store ID and Google Play
  service account credentials in Railway.
- [ ] Configure Apple Server Notifications V2 to post to
  `https://YOUR_API_DOMAIN/api/store-notifications/apple`.
- [ ] Configure Google Play RTDN to publish to a Pub/Sub topic with an
  authenticated push subscription targeting
  `https://YOUR_API_DOMAIN/api/store-notifications/google`; set its OIDC
  audience to that exact URL and use the configured service account email.
- [ ] Test sandbox purchases, cancellation, billing retry, restore, refund, and
  same-account access across both platforms.
- [x] Remove Razorpay checkout, plans, webhook, dependencies, and environment
  variables from active source.
