# Happinotes Backend

Production-ready Node.js + Express + MongoDB API built with TypeScript.

## Project structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts    # MongoDB connection
│   │   └── env.ts         # Environment variables
│   ├── models/
│   │   ├── Book.ts        # Book schema
│   │   ├── User.ts        # User schema
│   │   └── index.ts
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── booksController.ts
│   │   ├── collectionController.ts
│   │   ├── happyBiteAudioUploadController.ts
│   │   └── adminController.ts
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   ├── booksRoutes.ts
│   │   ├── collectionRoutes.ts
│   │   ├── adminRoutes.ts
│   │   └── index.ts
│   ├── middleware/
│   │   ├── auth.ts        # JWT authentication
│   │   ├── admin.ts       # Admin role check
│   │   ├── errorHandler.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── errors.ts      # AppError, UnauthorizedError, etc.
│   │   └── index.ts
│   ├── app.ts             # Express app setup
│   └── server.ts          # DB connect + listen
├── .env.example
├── test/
│   ├── happyBiteAudioUpload.test.cjs  # Large audio upload regression checks
│   └── happyBiteCollection.test.cjs   # Saved Happy Bites and access regression checks
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Happy Bites audio uploads

`POST /admin/contents/upload-happy-bite-audio` accepts one multipart `media`
MP3 behind the existing authentication and admin authorization middleware.
It has no application file-size cap. Files are staged in the operating system
temporary directory, validated using bounded reads, and uploaded to Cloudinary
in 6 MB chunks. Temporary files are removed after success or failure. The
response retains `url`, `mediaType`, and detected `durationSeconds` for the admin.
Storage-provider and hosting limits still apply.

Deploy this endpoint before using the updated Happy Bites admin upload form.
The existing `/admin/contents/upload-media` and audiobook uploads retain their
50 MB limit; Happy Bites thumbnails retain their 5 MB limit.

## package.json (main scripts)

| Script   | Command        | Description                    |
|----------|----------------|--------------------------------|
| `dev`    | `npm run dev`  | Run with ts-node-dev (reload)  |
| `build`  | `npm run build`| Compile TypeScript to `dist/`  |
| `start`  | `npm start`    | Run compiled `dist/server.js` |

Dependencies: `express`, `mongoose`, `bcryptjs`, `jsonwebtoken`, `helmet`, `cors`, `dotenv`, `express-validator`.

## Run locally

1. **Clone and install**
   ```bash
   cd backend
   npm install
   ```

2. **Environment**
   - Copy `.env.example` to `.env`
   - For local development, use `NODE_ENV=development` and `PORT=3000`.
     Production requires an explicit `PORT`; Railway normally supplies it.
     `npm run dev` does not override values copied from a production `.env`.
   - Set `MONGODB_URI` (e.g. local MongoDB or MongoDB Atlas)
   - Set `JWT_SECRET` to at least 32 cryptographically random bytes (256 bits), with at least 12 distinct bytes. For example, generate it locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`; do not commit or print the generated value into logs or reports. Production rejects missing, short, placeholder, fallback, or low-diversity values without displaying the configured value.
   - Rate limits use the installed `express-rate-limit` process-local memory store. They protect each backend process independently and are not shared across Railway replicas. `RATE_LIMIT_STORE` may be omitted or set to `memory`; unsupported values such as `redis` fail startup instead of silently falling back. A shared store requires a separately reviewed adapter and infrastructure configuration.
   - Set `ADMIN_EMAIL` to the real administrator account.
   - If that account is not yet in MongoDB, set a strong, unique
     `ADMIN_BOOTSTRAP_PASSWORD` for one startup only, then remove the variable
     and restart. The backend never replaces an existing admin password and
     never grants the admin role during normal signup.
   - The repository has no WhatsApp/SMS provider. Set
     `WHATSAPP_OTP_MODE=test` only for local/test environments; production
     must set it to `disabled`. Phone OTP routes fail closed until an approved
     provider is implemented. Production email OTP uses Resend.
   - Set Cloudinary media credentials:
     - `CLOUDINARY_CLOUD_NAME`
     - `CLOUDINARY_API_KEY`
     - `CLOUDINARY_API_SECRET`

3. **MongoDB**
   - Run MongoDB locally, or use a cloud URI in `.env`
   - A `*.railway.internal` MongoDB hostname is only reachable inside Railway.
     On your laptop, use Railway's public MongoDB connection URL or a local
     MongoDB URI. Keep database credentials in the ignored `.env` file.

4. **Start**
   ```bash
   npm run dev
   ```
   Server runs at `http://localhost:3000` (or the `PORT` in `.env`).

5. **Health**
   ```bash
   curl http://localhost:3000/health
   ```

## Deploy to Railway

1. **Create project**
   - Go to [railway.app](https://railway.app), sign in, and create a new project.

2. **Add MongoDB**
   - In the project, click **New** → **Database** → **MongoDB**.
   - After it’s created, open it and copy the **Connection URL** (e.g. `MONGODB_URI`).

3. **Deploy from repo**
   - **New** → **GitHub Repo** and connect your repo.
   - Select the repo and (if needed) set **Root Directory** to `mobile/backend` or the folder that contains `package.json` and `src/`.

4. **Variables**
   - In the service → **Variables**, add:
     - `MONGODB_URI` = the MongoDB connection URL from step 2
     - `JWT_SECRET` = a randomly generated value with at least 32 bytes and 12 distinct bytes (see Environment above)
     - `RATE_LIMIT_STORE` = `memory` (explicitly process-local; not shared between replicas)
     - `NODE_ENV` = `production`
    - `ADMIN_EMAIL` = the real administrator email
    - `ADMIN_BOOTSTRAP_PASSWORD` = one-time secret only if this admin does not exist yet (remove after first successful startup)
    - `WHATSAPP_OTP_MODE` = `disabled` (phone OTP is unavailable until a provider is implemented)
    - `RESEND_API_KEY` = a live Resend API key for email OTP
    - `RESEND_FROM_EMAIL` = a verified sender address
     - `CLOUDINARY_CLOUD_NAME` = your Cloudinary cloud name
     - `CLOUDINARY_API_KEY` = your Cloudinary API key
     - `CLOUDINARY_API_SECRET` = your Cloudinary API secret
   - Railway will auto-set `PORT`; your app already uses `process.env.PORT`.

5. **Build and start**
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
   - Railway will run these; ensure `package.json` has:
     - `"build": "tsc"`
     - `"start": "node dist/server.js"`

6. **Domain**
   - In the service, open **Settings** → **Networking** → **Generate Domain** to get a public URL.

7. **Check**
   - Open `https://<your-app>.up.railway.app/health` to confirm the API is up.

## Subscription verification and lifecycle

- Subscription plans expose store-specific identifiers as `storeProductIds.android`
  and `storeProductIds.ios`; verification requires an exact store/product match.
  Android uses `GOOGLE_PLAY_SUBSCRIPTION_MONTHLY_PRODUCT_ID` and
  `GOOGLE_PLAY_SUBSCRIPTION_YEARLY_PRODUCT_ID` (existing plan records retain
  their legacy `productId` mapping). Apple identifiers are intentionally
  unconfigured until confirmed by the owner:
  `APPLE_IAP_SUBSCRIPTION_MONTHLY_PRODUCT_ID` and
  `APPLE_IAP_SUBSCRIPTION_YEARLY_PRODUCT_ID`. Never copy Google IDs into the
  Apple settings without confirming the App Store Connect product IDs.
- Existing transaction-ledger claims remain eligible for same-owner restore
  using their stored store, product ID, and monthly/yearly `planKey`, even when
  a new per-store mapping is absent or changes later. This compatibility path
  does not authorize a new purchase and still requires provider verification.
- Google Play purchase and RTDN lookups use SHA-256 token keys; raw Play tokens
  are never persisted. Existing records created by an older raw-token build
  require an audited migration before they can be restored by the hashed-key
  lookup path.
- The verified Google state is authoritative on every purchase and notification:
  active, grace-period, and canceled-before-expiry retain access until
  `expiryTime`; account hold, pause, pending, expired, refund, and revocation
  do not grant access. This mapping should be rechecked against the current
  Google Play lifecycle policy before production billing certification.
- RTDN updates an existing, owner-bound ledger claim only. It cannot create a
  claim for an arbitrary user or transfer a token between users.

### Legacy token migration (offline procedure)

The repository history available to this checkout uses `transactionKey` from
the first subscription implementation, and current Android keys are SHA-256.
That does not prove what is stored in a deployed MongoDB database. Before any
shared-data migration:

1. Export a read-only snapshot and inventory Android records whose key is not
   a lowercase 64-hex SHA-256 value. Never print the keys.
2. For each candidate, verify the raw token with the official Google Play API,
   including package, product, current owner account binding, and purchase
   state. Unverified or ambiguous 64-hex values stay in manual review.
3. In a disposable clone, plan `sha256(rawToken)` replacements. Preserve the
   existing `userId` and product; same-owner duplicates may be merged only
   after an audit record is written. Any cross-owner/product collision aborts
   the plan.
4. Apply the plan in a transaction or resumable batch with a migration ID,
   before/after key fingerprints, counts, and an ownership audit. Re-running
   the same migration must produce no further changes.
5. Validate unique `(store, transactionKey)` indexes and entitlement restores
   in the clone, retain a rollback snapshot, then obtain explicit approval
   before touching a shared database.

`src/services/legacyPurchaseTokenMigration.ts` is an offline planner only; it
is not called by runtime routes and has not been run against production data.

## API summary

| Method | Path                 | Auth   | Description        |
|--------|----------------------|--------|--------------------|
| POST   | `/auth/signup`       | No     | Register           |
| POST   | `/auth/login`        | No     | Login (returns JWT)|
| GET    | `/auth/me`           | JWT    | Current user       |
| GET    | `/books`             | No     | List live books    |
| GET    | `/books/:id`         | No     | Book by ID         |
| GET    | `/collection`       | JWT    | User's collection  |
| POST   | `/collection/:bookId`| JWT    | Add to collection  |
| DELETE | `/collection/:bookId`| JWT    | Remove from collection |
| GET    | `/admin/users`      | Admin  | All users          |
| POST   | `/admin/books`      | Admin  | Create book        |
| PUT    | `/admin/books/:id`  | Admin  | Update book        |
| DELETE | `/admin/books/:id`  | Admin  | Delete book        |

Protected routes use header: `Authorization: Bearer <token>`.

## Happy Bites access

Happy Bites accept `accessType: "free" | "premium"` on the existing admin
create/update endpoints. New content and older records without this field
remain free. Omitting it from a partial update preserves the current choice.
Premium uses the existing active, unexpired Pro subscription (or admin access);
individual audiobook purchases do not unlock Happy Bites.

`GET /happy-bites` and `GET /happy-bites/:id` accept optional Bearer authentication.
Both return published metadata with `accessType` and `locked`. Locked responses
omit `audioUrl`; allowed responses include it. Responses use `private, no-store`
and vary by Authorization. Missing or draft detail records return 404. Admin
CRUD stays behind the existing authentication and admin authorization.

Deploy this backend before releasing the updated admin and mobile app. No
backfill or subscription migration is required. The app rechecks the detail
endpoint when starting or resuming playback through its controls. Media storage
remains the existing URL-based infrastructure, as for audiobooks; this does not
revoke media URLs that listeners previously received or downloaded.

Verify the access matrix with `npm run build` followed by
`node --test test/happyBites.test.cjs`.

## Account deletion live updates

Confirmed in-app requests use `POST /auth/me/deletion-request`. First submissions
require a current, active user session and a fresh password/PIN verification
proof. Existing workflows allow deletion-only status/retry access after their
normal session is revoked. Request creation and the pending account marker
remain in one MongoDB transaction, requiring a transaction-capable MongoDB
replica set or sharded deployment.

After a committed request, admin review, or worker processing, Socket.IO emits
`account-deletions:changed` on the authenticated `/admin` namespace. The event
contains only a timestamp; the admin fetches records through the protected
`GET /admin/account-deletions` endpoint. The admin also refreshes on reconnect,
window focus, and every 15 seconds to reconcile missed or cross-instance events.
The app checks pending request status every 5 seconds while its screen is mounted.

This implementation uses the existing MongoDB and Socket.IO infrastructure, not
Redis. Deploy the backend before the admin/app updates; the admin continues
periodic HTTP refresh if the live socket is unavailable.


## Saved Happy Bites

Authenticated `POST /collection/happy-bites/:biteId` and `DELETE /collection/happy-bites/:biteId` save/remove a bookmark using the real MongoDB Happy Bite ID. `GET /collection` retains the audiobook `collection` array and adds `happyBites`. References live in `User.happyBiteCollection`, separate from `bookCollection`; missing fields on existing users behave as empty arrays and populate on first save. No migration is needed.

Only published bites can be added or returned; removal works even after content deletion/unpublishing. Duplicate saves use `$addToSet`. Reads preserve existing Happy Bite Pro audio restrictions and use private/no-store caching. Saving does not grant playback access or alter purchase/subscription rules. Existing account-deletion preference cleanup also clears Happy Bite references. Deploy these routes before shipping the matching mobile save UI.


## User Security administration

`GET /admin/user-security` returns seven users per page with latest network metadata and effective moderation status. Search uses name/email. `PATCH /admin/user-security/:id/ban` accepts `action` (`temporary`, `permanent`, `unban`), a reason, and a future ISO `expiresAt` for temporary bans. All operations require existing admin authentication; admin/self targets are rejected. Every change revokes existing sessions and records the actor/reason in the latest 50 moderation entries. The existing dashboard block/unblock routes share these protections.

`DELETE /admin/user-security/:id` requires `confirmation: "DELETE"` and a reason. It queues the existing transactional deletion process, including its retention-policy checkpoints, instead of deleting a user document and orphaning purchases. Access is denied immediately; pending cleanup is not represented as completed deletion. Network records are removed by the cleanup worker.

`POST /auth/me/network` records the latest device-reported connection type, local device IP, carrier and model/OS after authentication. Public IP is derived exclusively from Express `req.ip` and the deployment's trusted proxy configuration. Do not expose the backend through an untrusted path that can forge the trusted proxy headers. Metadata is informational, not proof of a person's identity; bans target accounts, never everyone sharing an IP. Network records expire after 90 days without activity. Existing apps report details only after receiving the client update.

IP geolocation is disabled by default. To enable the approximate mini-map and ISP name, configure `SECURITY_GEOIP_PROVIDER=ipapi.co` and, if required by your plan, `SECURITY_GEOIP_API_KEY`. Obtain a plan appropriate for the application's usage. This sends the observed public IP to ipapi.co; document this processing and retention in the app privacy policy and store disclosures before rollout. Lookups use fixed HTTPS endpoints, a four-second timeout, bounded response fields and a per-user/IP cache. Failures show Unavailable and never block app access. City-level IP coordinates do not establish a street address; VPNs/mobile gateways can place the pin far from a person.

The authenticated `/account` Socket.IO namespace uses only the token's verified user ID to assign a private room. Moderation emits account invalidations. A MongoDB change stream propagates committed changes to other replicas; MongoDB replica-set support is required for change streams and the existing deletion transactions. Mobile clients recheck on socket events, foreground/reconnect and every 15 seconds as an outage fallback. A denied account stops playback and clears its session. Offline devices are enforced when connectivity returns; already delivered media cannot be recalled.

New source files: `src/models/UserNetwork.ts`, `src/services/accountModeration.ts`, `src/services/userNetwork.ts`, `src/controllers/userSecurityController.ts`, `src/routes/userSecurityRoutes.ts`; regression coverage: `test/userSecurity.test.cjs`.

### Direct Happy Bites audio upload

`POST /admin/contents/sign-happy-bite-audio` requires the existing admin authentication and authorization. It accepts MP3 name/type/size metadata and signs a server-generated UUID public ID under `happinotes/happy-bites/audio`, `allowed_formats=mp3`, and `overwrite=false`. It never signs arbitrary client parameters or returns the API secret. Responses are not cached; signing requests are rate limited. Cloudinary validates the asset format. Existing thumbnail and audiobook upload flows remain unchanged.

The new admin sends bounded chunks directly to Cloudinary. Existing clients can continue using `/admin/contents/upload-happy-bite-audio`; its storage timeout is increased per request and provider failures are mapped to safe, actionable messages. There is no Happy Bites audio size or duration cap, but storage-provider limits still apply. See https://cloudinary.com/documentation/upload_images and https://cloudinary.com/documentation/authentication_signatures .
