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
   - `ADMIN_EMAIL=arundasmd@gmail.com` is already in `.env.example`

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
     - `ADMIN_EMAIL` = `arundasmd@gmail.com` (optional if same as default)
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
