# HappiNotes backend

The backend is the private service used by the Expo app and the separate admin
website. It uses Node.js, Express, TypeScript, and MongoDB.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` to a local or development MongoDB database.
3. Set a random `JWT_SECRET` for stable local sessions. Production rejects weak
   or placeholder secrets.
4. Set `RESEND_API_KEY` and `RESEND_FROM` to send password reset codes. The
   sender address must be verified in Resend. Keep the API key on the backend;
   never add it to the mobile app.
5. Install and run:

   ```powershell
   npm install
   npm run dev
   ```

The server listens on port `3000` by default. `GET /health` reports whether the
HTTP service is running.

## Authentication API

All authentication routes are under `/api/auth`:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/signup` | Create an account using name, email, and password |
| `POST` | `/login` | Sign in using email and password |
| `POST` | `/forgot-password` | Request a reset code; response does not reveal whether the account exists |
| `POST` | `/reset-password` | Set a new password using email, reset code, and new password |
| `POST` | `/change-password` | Change password for the signed-in account |
| `GET` | `/me` | Get the signed-in account |
| `PUT` | `/me` | Update allowed account preferences |

## Store subscriptions

The native purchase endpoints are under `/api/subscriptions`:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/account-token` | Get a stable store-to-HappiNotes account binding |
| `POST` | `/verify` | Verify one Apple signed transaction or Google purchase token |
| `POST` | `/restore` | Verify restored transactions before syncing Premium access |

The app never sets Premium access directly. Apple transaction signatures and
bundle/product/account identifiers are validated with Apple's App Store Server
Library; Google tokens are checked using the Android Publisher API. Google Play
service-account credentials and Apple root certificates/App Store ID must be
configured in Railway before store test purchases can succeed. Missing
verification configuration causes the purchase endpoint to fail closed. The
full store product map and local lifecycle rules are in
[`../STORE_PRODUCTS.md`](../STORE_PRODUCTS.md).

Passwords are stored as bcrypt hashes. Reset codes are random six-digit values,
stored as keyed hashes, expire after ten minutes, allow at most five guesses, and
can be used once. Reset requests are limited by IP and by account address.

## Admin account setup

Signing up with a particular email no longer grants admin access. To provision
the first admin, create the account through the app, then use an authorized
MongoDB administrator session to promote that exact lower-case email:

```javascript
db.users.updateOne(
  { email: "staff@example.com" },
  { $set: { role: "admin" } }
)
```

Replace the example address with the account you created. Keep database access
restricted to trusted operators.

## Existing accounts

Accounts created through the retired phone/PIN flow cannot sign in until they
have a real email address and a usable password. Before switching an existing
production database, make a controlled account migration plan; do not assign
synthetic phone-based email addresses or expose phone login as a fallback.

## Build and deploy

```powershell
npm run build
npm start
```

For Railway configuration and production variables, see
[`RAILWAY.md`](RAILWAY.md). The repository-wide release guide is
[`../DEPLOYMENT.md`](../DEPLOYMENT.md).
