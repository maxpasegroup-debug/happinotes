# HappiNotes architecture and feature audit

## Repository topology

The repository contains three application surfaces:

| Directory | Role | Current relevance |
|---|---|---|
| `flutter_app/` | Flutter Android/iOS client | Active mobile application. |
| `backend/` | Node.js/Express/TypeScript API and workers | Active backend. Railway build is `npm install && npm run build`; start is `npm start` (`backend/railway.toml`). |
| `happinotes-admin/` | Next.js 16 admin/landing site | Intended Railway admin service; root `/` is a landing page and `/admin/login` is the admin entry. |
| `src/` | Root-level duplicate/legacy Next-style source | Relevance is not proven; do not deploy it as the admin service. |

`AUDIT_REPORT.md` and `IN_APP_PURCHASE_SETUP.md` are historical documents. The former describes React Native/Expo; the latter is titled one-time book purchases. They do not describe the audited Flutter/subscription baseline and must not be treated as current release evidence.

## Runtime architecture

1. Flutter uses Dio against `https://happinotes-production-6b44.up.railway.app` by default (`flutter_app/lib/core/network/api_client.dart:27-30`). The backend mounts routes at both `/api` and root (`backend/src/app.ts:62-65`) for compatibility.
2. Express uses MongoDB for users, content, subscription plans, purchases, product mappings, and notifications. Socket.IO emits catalog and subscription changes to open clients.
3. Admin authentication calls backend `/auth/login`; the browser stores the JWT in `localStorage` (`happinotes-admin/app/admin/login/page.tsx:21-33`).
4. Content media is uploaded in memory and streamed to Cloudinary. `/uploads` remains as a legacy local static path (`backend/src/app.ts:56-60`), but current admin upload handlers use Cloudinary.
5. FCM uses Android Firebase options in Flutter and Firebase Admin credentials in the backend. Catalog creation persists an in-app notification before attempting push delivery (`backend/src/services/catalogNotification.ts:32-50`).
6. Google Play subscription plans are represented by MongoDB `SubscriptionPlan` rows and synchronized to Play subscriptions/base plans by `googleSubscriptionCatalog.ts`. Legacy individual-book products are still represented by `StoreProduct`/`StorePurchase`.

## Feature inventory

| Feature | Source implementation | Evidence status |
|---|---|---|
| Email/password auth | `backend/src/controllers/authController.ts`; Flutter auth controllers/screens | Source confirmed; current device journey not re-run. |
| Email OTP login/signup | `authRoutes.ts`, `authController.ts`, Flutter `auth_screen.dart` | Source confirmed; production Resend configuration not externally verified. |
| Phone/WhatsApp OTP | `request-*otp` routes and `WHATSAPP_OTP_MODE` | Source confirmed; live delivery and fail-closed production mode unverified. |
| Session persistence | Flutter secure storage and Dio interceptor | Source confirmed. |
| Lifebook discovery/detail | `contentController.ts`, Flutter books features | Source confirmed; pagination/performance not proven. |
| Audio playback | `player_controller.dart`, `episode_player_screen.dart`, `just_audio` | Source confirmed; interruption/background/error recovery needs real-device evidence. |
| Free/premium access | Backend strips premium media unless active subscription; collection checks server-side | Source confirmed; security tests need expansion. |
| Monthly/yearly subscription | `SubscriptionPlan`, admin settings, Flutter controller/screen, Play API sync | Source confirmed; Play product availability and real device purchase not verified in this audit. |
| Restore/renewal/expiry | Flutter `restorePurchases`; backend verify and Google/Apple notification routes | Partial. Account binding/acknowledgement defects and Apple notification test failure block certification. |
| In-app notifications | `Notification` model, catalog notification service, Flutter notification controller/screen | Source confirmed; push delivery evidence is not a release certificate. |
| New live/coming-soon book notification | `adminContentController.ts:395-408` | Source confirmed for create flow; update/publish transition and FCM delivery require manual test. |
| New episode notification | Catalog notification service and admin content update path | Source likely; exact transition test needed. |
| Cloudinary media | `config/cloudinary.ts`, `adminContentController.ts:80-116` | Source confirmed; credentials and orphan cleanup unverified. |
| Admin plan editing | `happinotes-admin/app/admin/(secure)/settings/page.tsx` | Source confirmed; build is blocked by environment. |
| Admin landing page | `happinotes-admin/app/page.tsx` | Source confirmed; Railway root-directory/domain mapping unverified. |
| Account deletion | Admin can delete users; no user self-service deletion route/screen found | Missing for Play policy scope. |
| Legal disclosures | `flutter_app/lib/src/screens/legal_screen.dart` | Placeholder text only; legal review and public privacy URL not verified. |
| iOS FCM | `firebase_options.dart` throws for iOS; no `GoogleService-Info.plist` | Not implemented; separate iOS scope. |

## Subscription data flow

1. Admin PATCHes `/admin/subscription-plans/:key` with positive INR price.
2. Backend writes MongoDB first, emits `subscription-plans:changed`, then calls Google Play sync. A sync failure returns `googlePlaySync: failed` while preserving the backend price.
3. Mobile reloads plans on socket event, app resume, and initial user assignment. It calls Play product detail lookup by platform product ID.
4. If Play returns `notFoundIDs`, the UI intentionally disables the Subscribe button and shows “Some subscription plans are not available yet.” This is a configuration/propagation/device-track state, not evidence that MongoDB price writing failed.
5. Purchase proof is sent to `/payments/store/subscription-verify`; backend verifies with Google/Apple, records a unique claim, updates the user entitlement, and returns the active state.

## Architecture contradictions to resolve

- Current admin labels say subscription-only, but `Content.priceInr`, one-time purchase screens/routes, product mappings, and the provisioning worker remain. Decide whether historical individual purchases are grandfathered; do not delete records without a migration and rollback plan.
- Current backend upload path is Cloudinary, but `/uploads` and Railway volume documentation remain. Audit and migrate old URLs before removing the volume.
- The root-level `src/` application and `happinotes-admin/` both exist. Railway must explicitly use `happinotes-admin` as its root directory.
- Existing docs use old env names and purchase behavior. Update documentation only after the release model is approved.

