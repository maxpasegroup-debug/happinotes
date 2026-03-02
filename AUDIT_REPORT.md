# Happinotes – Complete Technical Audit Report

**Auditor role:** Senior production mobile architect / CTO prep for launch  
**Date:** 2025  
**Verdict:** Not production-ready. Critical gaps in auth guard, premium protection surface, release signing, and billing flow.

---

## 1. PROJECT STRUCTURE OVERVIEW

### Tech stack
- **Frontend:** React Native 0.81.5, Expo ~54, React 19.1, TypeScript 5.9
- **Backend:** Node.js, Express 4.18, TypeScript 5.3, Mongoose 8
- **DB:** MongoDB (Mongoose)
- **App framework:** Expo (expo-router 6, file-based routing)

### State management
- **No global store.** Local `useState` only. User/session: `getToken()` + `getMe()` per screen or layout; no React Context for auth. Theme: `ThemeContext` (mode/colors). Subscription state: loaded in Profile and (app) layout via `getMe()`.

### API architecture
- **REST.** Single backend base URL hardcoded in `mobile/services/api.ts`: `https://happinotes-production.up.railway.app`. All calls use `fetch` + Bearer token where required. No env-based API URL (e.g. staging vs prod).

### Folder structure
- **mobile/** – `app/` (expo-router: index, signup, forgot-password, verify-otp, reset-password, (app)/, (admin)/), `components/`, `constants/`, `context/`, `hooks/`, `services/`, `theme/`, `assets/`
- **backend/** – `src/` (config, controllers, middleware, models, routes, services, utils)
- Clear split between app and backend; mobile has no feature-based grouping (e.g. auth/, billing/).

### Structural issues
- **BASE_URL hardcoded** in `api.ts` – no per-environment config; staging/prod swap requires code change.
- **Duplicate/legacy auth flow:** `forgot-password.tsx` is a fake OTP flow (local random OTP, “Check console”); real flow is verify-otp + reset-password with backend. Login links to `/forgot-password`, so users hit the broken screen unless you change the link.
- **(app) group has no route guard** – unauthenticated users can open `/(app)/library` etc. if they navigate there; only the root layout redirects *to* (app) when token exists.
- **Admin settings route declared** in `(admin)/_layout.tsx` but **no `settings.tsx`** – dead route.

---

## 2. AUTHENTICATION SYSTEM

### Login / signup
- **Login:** Implemented. `POST /auth/login`, validation, bcrypt compare, JWT, returns token + user. Mobile: `login()` + `saveToken()` + `router.replace("/(app)/library")`.
- **Signup:** Implemented. `POST /auth/signup`, validation, bcrypt (12 rounds), role = admin iff `email === env.ADMIN_EMAIL`, JWT + user returned. Mobile: signup screen, then replace to library.

### JWT / session
- **JWT only.** Payload: `{ id }`. `env.JWT_EXPIRES_IN` (default 7d). No refresh token; no refresh endpoint; no rotation. When token expires, user must log in again.

### Token storage
- **expo-secure-store** (`authStorage.ts`). Not AsyncStorage. Secure on device; no token in plain storage.

### Refresh token logic
- **None.** Single long-lived JWT. Expiry handled only at request time (401 from backend).

### Logout
- **Correct.** Profile: `deleteToken()` then `router.replace("/")`. Token removed; redirect to login.

### Security risks
- **No rate limiting** on `/auth/login` or `/auth/forgot-password` – brute force and enumeration possible.
- **JWT in payload only** – role/subscription not in token; backend always loads user from DB (good), but every authenticated request hits DB.
- **Forgot-password entry point broken** – `/forgot-password` does not call backend; users don’t get real OTP. Real flow (verify-otp → reset-password) exists but login links to the fake screen.

---

## 3. AUDIOBOOK SYSTEM (CORE BUSINESS)

### CRUD
- **Backend:** Create/update/delete only via **admin** (`POST/PUT/DELETE /admin/books`). List/detail: `GET /books`, `GET /books/:id` (optional auth). No public “create book” for users.
- **Admin panel:** (admin)/books, create-book, edit-book; calls admin API. Books have title, description, coverImage, audioUrl, introAudioUrl, fullAudioUrl, status, type.

### File storage
- **No backend file storage.** Book model stores **URLs only** (coverImage, audioUrl, introAudioUrl, fullAudioUrl). Admin submits URLs (e.g. Cloudinary/S3); no upload endpoint in codebase. Location of files (Cloudinary, S3, or other) is not defined in code.

### Streaming
- **No streaming implementation in app.** Library screen lists books (title, description, badge); no `expo-av` or other player; no screen that plays `fullAudioUrl` or `introAudioUrl`. So “audiobook” is catalog only; playback is **NOT IMPLEMENTED**.

### Access control
- **List/detail:** `optionalAuthenticate`. If no token or invalid token, `req.user` is undefined → `canAccessPremiumContent(req)` is false → premium books returned without `fullAudioUrl`. If valid token + active subscription, `fullAudioUrl` included. **Server-side stripping is correct.**
- **Collection add:** Authenticated; premium books require `req.user.subscriptionActive` (and expiry enforced in auth middleware). **Server enforces.**

### Premium flagging
- **Backend:** Book has `type: 'free' | 'premium'`. Premium: `fullAudioUrl` only when `hasActiveSubscription(req.user)`. Free: always get `fullAudioUrl` (or legacy `audioUrl`).
- **Client:** Library badge uses `item.audioUrl` (“Premium Available” vs “Subscribe to Unlock”). API response no longer includes `audioUrl` (stripped); response has `fullAudioUrl` / `introAudioUrl`. So badge logic is **out of date** – should use `item.type === 'premium'` or presence of `fullAudioUrl` for display.

### Server-side validation
- **Direct access to audio URLs:** If admin stores a **public URL** (e.g. public S3/Cloudinary), anyone with the URL can access the file. Backend does **not** proxy or sign audio; it only omits `fullAudioUrl` from API when user is not subscribed. So **premium protection depends entirely on URL secrecy**. If URLs are ever exposed (e.g. client leak, log, or public CDN), premium content is not protected.

---

## 4. SUBSCRIPTION & PAYMENTS STATUS

### Google Play Billing
- **Implemented** via `react-native-iap` (^12.15.0) in `mobile/services/billing.ts`.

### Billing library version
- **react-native-iap:** ^12.15.0 (in package.json).

### Purchase flow
- **Implemented:** initConnection, requestSubscription(productId), purchaseUpdatedListener → verifyWithBackend(purchaseToken, productId) → finishTransaction → onVerified(user). Profile: “Subscribe ₹499 / month” when !subscriptionActive; on press calls requestSubscription(PREMIUM_PRODUCT_ID). **Note:** Android v12+ often requires `subscriptionOffers` (with offerToken from getSubscriptions); current code uses `{ sku: productId }` only – may fail on Android with “subscriptionOffers are required”.

### Restore purchases
- **NOT IMPLEMENTED.** No `getAvailablePurchases()` or “Restore” in Profile. Users who reinstall or switch devices cannot restore subscription without purchasing again or admin activating.

### Backend verification
- **Implemented.** `POST /payments/google/verify` (authenticate): reads `GOOGLE_PLAY_SERVICE_ACCOUNT` (JSON), uses androidpublisher v3 `purchases.subscriptions.get`, checks paymentState 1/2 and expiryTimeMillis, sets user subscriptionActive + subscriptionExpiry, returns user. **Correct.**

### Google Play Developer API
- **Integrated.** googleapis, JWT from service account, scope androidpublisher. Package: `com.happinotes.app`. **Requires** `GOOGLE_PLAY_SERVICE_ACCOUNT` in backend env (missing → 400).

### Product IDs
- **Defined in mobile:** `billing.ts`: `PREMIUM_PRODUCT_ID = "happinotes_premium_monthly"`. Must match subscription ID in Play Console.

### Premium unlock: server vs client
- **Server:** Books API strips `fullAudioUrl` when !hasActiveSubscription. Collection add rejects premium when !subscriptionActive. Auth middleware runs `expireSubscriptionIfNeeded`. **All enforcement is server-side.**
- **Client:** Profile shows Subscribe button when !user.subscriptionActive; Library/collections only show what API returns. No client-only “premium” gate that could be bypassed for content.

### Bypass risk
- **Revenue/content bypass:** If a user gets a valid subscription (real purchase or server bug), they get premium. No client-side bypass of premium content because content is gated by API response. **Risk:** Backend must never return `fullAudioUrl` to non-subscribers; current logic is correct. **Remaining risk:** Public audio URLs (see Section 3).

---

## 5. PREMIUM CONTENT PROTECTION AUDIT

### API manipulation
- **Books list/detail:** Optional auth. Without token → no fullAudioUrl for premium. With token but no subscription → same. With token + subscription → fullAudioUrl. Attacker cannot “inject” subscription; it’s read from DB in auth middleware. **No bypass by manipulating books API.**
- **Collection add:** Requires auth + subscription for premium books. **Enforced.**

### Premium APIs
- **No “premium-only” route** that returns premium content by route name. Premium is enforced by **response shaping** (omit fullAudioUrl) and **collection add** check. So “premium APIs” are the same routes with different responses. **Protected.**

### Middleware
- **No dedicated “requireSubscription” middleware.** Checks are in booksController (canAccessPremiumContent) and collectionController (premium + subscriptionActive). Auth middleware only attaches user and expires subscription; it does not block by subscription. **Acceptable** for current design.

### Subscription in DB
- **Stored:** User has subscriptionActive (boolean) and subscriptionExpiry (Date). Updated by: Google verify endpoint, admin activate-user-subscription, and expireSubscriptionIfNeeded in auth middleware. **Correct.**

### Expiry
- **Handled.** On every authenticated request, auth middleware runs expireSubscriptionIfNeeded: if subscriptionActive && subscriptionExpiry <= now, sets subscriptionActive = false and saves. **Correct.**

### Direct URL access
- **Critical gap.** If fullAudioUrl (or introAudioUrl) is a **public HTTP URL**, anyone with the link can play it. Backend does not proxy or sign URLs. **Protection = URL secrecy.** For production, use signed/private URLs or proxy through backend with auth.

---

## 6. BACKEND AUDIT

### Railway
- **Referred to in mobile:** BASE_URL = `https://happinotes-production.up.railway.app`. Implies backend is (or will be) on Railway. No Railway config files in repo (expected for cloud deploy).

### Environment variables
- **env.ts:** NODE_ENV, PORT, MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN, ADMIN_EMAIL. Production: JWT_SECRET and ADMIN_EMAIL required (throw if missing/fallback). **No GOOGLE_PLAY_SERVICE_ACCOUNT** in env.ts – used only in paymentsController from process.env; if missing, verify returns 400. **BREVO_API_KEY** required for OTP email (emailService). **Risks:** MONGODB_URI default is localhost; production must set it. No explicit list of required env for production in one place.

### MongoDB schema
- **User:** name, email, password (select: false), role, subscriptionActive, subscriptionExpiry, bookCollection, timestamps. **Adequate.**
- **Book:** title, description, coverImage, audioUrl, introAudioUrl, fullAudioUrl, status, type, timestamps. **Adequate.** No indexes defined beyond _id; consider index on status + type for list queries.
- **PasswordResetToken:** userId, otpHash, expiresAt, attempts; TTL index on expiresAt. **Good.**

### Input validation
- **express-validator** on auth (signup, login, forgot-password, verify-otp, reset-password) and admin (book create/update). Books GET have no body; collection/admin use params. **Adequate** for current routes. No sanitization of URL strings (e.g. coverImage, audioUrl) – risk if ever rendered in admin or used in redirects.

### Rate limiting
- **None.** No rate-limit middleware. Login, signup, forgot-password, and verify-otp are open to brute force and abuse.

### CORS
- **app.use(cors())** with no options – **all origins allowed**. Acceptable for a single mobile app if you control the client; for web or multiple origins, restrict origin.

### Logging
- **Minimal.** console.log in server (port, MongoDB connected), emailService (OTP sent/failed). No request logging, no structured logger, no log levels. **Insufficient for production debugging and audit.**

### Error handling
- **Centralized.** errorHandler middleware: AppError (statusCode + message), ValidationError 400, JWT errors 401, else 500. Production hides stack. **Adequate.** No alerting or reporting.

---

## 7. PRODUCTION READINESS CHECK

| Item | Status | Note |
|------|--------|------|
| Secure authentication | **PARTIAL** | SecureStore, bcrypt, JWT; no rate limit, no refresh, forgot-password entry broken |
| Secure audiobook delivery | **NOT IMPLEMENTED** | No playback; URLs are public if stored as such; no proxy/signing |
| Subscription billing integration | **PARTIAL** | IAP + backend verify done; Android subscriptionOffers may be required; no restore |
| Server-side subscription validation | **READY** | Books and collection enforce subscription; expiry in middleware |
| Admin upload panel | **PARTIAL** | Admin CRUD for books (URLs only); no file upload; no Cloudinary/S3 wiring |
| Payment fraud prevention | **PARTIAL** | Google server-side verify; no receipt replay checks beyond single verify |
| App versioning | **PARTIAL** | version 1.0.0 in app.json / package; versionCode 1 in Android |
| Release signing | **NOT IMPLEMENTED** | Android release uses **debug** keystore; Play Store will reject |
| Privacy policy compliance | **PARTIAL** | Legal screen exists; no proof of policy URL or in-store compliance |
| Play Store compliance risks | **PARTIAL** | Billing implemented; restore missing; policy/support links depend on content |

---

## 8. CRITICAL BLOCKERS BEFORE LAUNCH

1. **Android release signing**  
   Release build uses debug keystore. **Play Store will reject.** Generate release keystore and set `signingConfigs.release` in `android/app/build.gradle`.

2. **Premium audio URL exposure**  
   If audio files are served at public URLs, anyone with the link can access them. **Revenue leakage and terms violation.** Either use private/signed URLs and proxy through backend with auth, or a CDN with signed/short-lived URLs.

3. **Forgot-password flow**  
   Login links to `/forgot-password`, which does not call backend and shows fake OTP. **User-facing bug and support burden.** Either wire forgot-password to backend (forgot-password → verify-otp → reset-password) or point “Forgot password?” to a screen that calls the real API.

4. **(App) route guard**  
   Unauthenticated users can open `/(app)/library` (and other (app) routes) if they navigate directly. **Weak access control.** Add guard in `(app)/_layout.tsx`: no token or getMe fails → redirect to `/`.

5. **Restore purchases**  
   No way to restore subscription on reinstall/new device. **Play policy and bad UX.** Add “Restore purchases” using getAvailablePurchases (or equivalent) and re-verify with backend, then refresh user.

6. **GOOGLE_PLAY_SERVICE_ACCOUNT**  
   Backend must have this set in production or Google verify returns 400. **Deploy blocker** for paid subscriptions.

---

## 9. RECOMMENDED ORDER TO COMPLETE REMAINING WORK

1. **Android release signing**  
   Create release keystore; add `signingConfigs.release`; use it in release buildType. Document keystore backup and env (e.g. KEYSTORE_PATH, passwords). **Unblocks store submission.**

2. **Forgot-password**  
   - Option A: Change login “Forgot password?” to navigate to a screen that collects email and calls `POST /auth/forgot-password`, then navigate to verify-otp with email.  
   - Option B: Replace `forgot-password.tsx` so it uses the same backend (forgot-password → verify-otp → reset-password).  
   Remove or repurpose the current fake OTP screen.

3. **(App) auth guard**  
   In `(app)/_layout.tsx`: on mount, getToken(); if none, router.replace("/"). If token, getMe(); on failure, router.replace("/"). Only render tabs when authenticated. Prevents unauthenticated access to app section.

4. **Premium audio protection**  
   Decide where audio is hosted (e.g. S3, Cloudinary). Implement either: (a) private buckets + signed URLs generated by backend when user has access, or (b) backend proxy that checks auth/subscription and streams file. Remove any long-lived public URLs for premium content.

5. **Restore purchases**  
   In billing: add `restorePurchases()` (e.g. getAvailablePurchases or getPurchaseHistory). For each valid subscription, call verifyWithBackend and update user. In Profile, add “Restore purchases” button; on success refresh user. Ensures compliance and better UX.

6. **Android subscriptionOffers**  
   Test purchase on Android. If you get “subscriptionOffers are required”, fetch subscription offers (getSubscriptions), then call requestSubscription with the offer token for `happinotes_premium_monthly`.

7. **Backend env and ops**  
   Document and set for production: MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, GOOGLE_PLAY_SERVICE_ACCOUNT, BREVO_API_KEY, PORT. Add simple request logging (method, path, status, duration). Optionally add rate limiting on auth routes.

8. **Library premium badge**  
   Change Library badge from `item.audioUrl` to `item.type === 'premium'` or presence of `item.fullAudioUrl` (depending on desired UX) so it matches API response.

9. **Optional**  
   CORS origin allowlist if you add web or multiple apps. Remove or implement (admin) settings screen. Add privacy policy URL and ensure it’s reachable from app and store listing.

---

**End of audit.**  
No sugarcoating: auth surface and (app) guard are weak, premium delivery is not secure if URLs are public, and release signing is missing. Fix blockers in the order above before launch.
