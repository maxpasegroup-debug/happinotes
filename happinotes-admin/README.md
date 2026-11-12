This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Install dependencies before starting the app:

```bash
npm install
```

The admin interface uses **HeroUI v2** (`@heroui/react` 2.x), with its
Tailwind v4 plugin in `hero.ts` and its provider scoped to `/admin`.
Keep HeroUI on major version 2. Native file pickers, audio previews, and
the draggable ordering table retain their browser behavior. API calls,
authorization, publishing, and subscription actions keep their existing logic.


Set the API target in `.env.local` (restart Next.js after changing it):

```dotenv
NEXT_PUBLIC_LOCAL_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_RAILWAY_API_BASE_URL=https://happinotes-production-6b44.up.railway.app

# Choose one backend:
NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_RAILWAY_API_BASE_URL
# For local, replace the active line with:
# NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_LOCAL_API_BASE_URL
```

Both URLs stay configured; only change the active `NEXT_PUBLIC_API_BASE_URL`
reference to switch. Next.js expands the referenced variable when it starts.
The local backend must successfully connect to MongoDB
before login is available. A Railway private database hostname is not
reachable from a laptop; use a local database or its public connection URL.

Run the admin on a separate port from the backend:

```bash
npm run dev -- --port 3001
```

Open [http://localhost:3001/admin/login](http://localhost:3001/admin/login).
Enter the configured administrator's email and password.

In development, admin requests and uploads pass through `/api/backend` on
the Next.js server to avoid cross-origin browser failures. The backend still
validates credentials and admin bearer tokens. The proxy is disabled in
production, where the existing direct API connection and CORS rules apply.

## Happy Bites uploads

Open **Content management → Happy Bites** (`/admin/happy-bites`) and choose
**New Happy Bite**. Add a title, description and category, upload a thumbnail
(JPG/PNG/WebP, up to 5 MB) and one MP3 (no application file-size cap), then save as a draft or
publish. Duration is read from upload metadata or the local audio file when
possible and remains editable. The suggested 50–60 seconds is not a limit.

Audio uses `POST /admin/contents/upload-happy-bite-audio`. Deploy the updated
backend alongside the admin panel: this endpoint stages a single MP3 on disk,
checks its format, transfers it to Cloudinary in chunks, and deletes the
temporary file. Thumbnail uploads keep their existing endpoint and 5 MB cap.

Use Listen to preview an item, Edit to change its details or display order,
and Publish/Unpublish to control visibility. Deleting requires confirmation.
Lower display-order values appear first, with newest content breaking ties.

The connected backend must include `/admin/happy-bites` and the Happy Bites
media upload scopes before saving and uploading can work. These controls use
the existing admin authorization; Happy Bites remain free and independent
from audiobook purchases and subscriptions.

## Install the admin panel (PWA)

Use a production build served over HTTPS, or `localhost` for local testing:

```bash
npm run build
npm run start -- --port 3001
```

Open `/admin/login`. On supported Chromium browsers, **Install app** appears
on the login page and in the admin header when the browser offers installation.
It opens the browser's install prompt. On iPhone/iPad, the button explains how
to use Safari → Share → Add to Home Screen. Installed windows hide the button.
The installed app opens `/admin/dashboard` and uses the normal admin login.

The manifest and service worker are scoped to `/admin/`. The worker caches
only the public offline page and icons; admin HTML, API responses, credentials,
uploads, and Next.js navigation data are never stored in its cache. Reopening
the app without a connection shows an offline page with a retry button.
Content management still requires a connection. The worker registers only in
production; `npm run dev` does not install it. If testing development on a port
previously used for production, unregister its worker in browser DevTools first.

The mobile sidebar animates its panel using Framer Motion, while HeroUI retains
focus management, Escape/backdrop dismissal and scroll locking. Reduced-motion
settings skip the slide. Opening a confirmation hides the drawer immediately.

PWA source tree (icons are generated from the existing waveform brand):

```text
components/admin/
└── AdminPwaProvider.tsx
public/admin/
├── manifest.webmanifest
├── offline.html
├── sw.js
└── icons/
    ├── admin-icon.svg
    ├── apple-touch-icon.png
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png
test/
└── admin-pwa.test.mjs
```

Run `node --test test/admin-pwa.test.mjs` for manifest, icon dimensions,
offline navigation, cache isolation and network-only admin request checks.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
