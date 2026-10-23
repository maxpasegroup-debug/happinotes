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
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

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
   - Set `MONGODB_URI` (e.g. local MongoDB or MongoDB Atlas)
   - Set `JWT_SECRET` (strong secret for production)
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
     - `JWT_SECRET` = a long random secret (e.g. from `openssl rand -base64 32`)
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
