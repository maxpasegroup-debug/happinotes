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


## User Security menu

The Management sidebar opens `/admin/user-security` (`app/admin/(secure)/user-security/page.tsx`). It shows seven compact user cards per page with search, public IP, connection type and moderation status. Selecting a card opens a scrollable details dialog with IP fields, device information, a Leaflet/OpenStreetMap view and the existing moderation controls. Device-reported values are labeled; unknown values are not guessed.

Temporary/permanent ban, unban and account deletion use confirmation dialogs with required reasons. Temporary bans require a future local expiry; deletion requires typing DELETE and queues the existing deletion workflow. The page receives admin socket invalidations and refreshes every 15 seconds. Do not confuse a queued deletion with completed cleanup or subscription cancellation. Deploy the backend endpoints before this admin page.

### Happy Bites uploader and full-width library

The Happy Bites library uses the available content width without an outer rounded card. `components/admin/HappyBiteUpload.tsx` combines file selection, drag/drop, local preview, upload progress and retry for each media item. The selected file remains available after failure; discard or upload it before saving. Existing attached URLs change only on successful upload and remain unsaved until the form is saved.

Deploy the backend's authenticated `/admin/contents/sign-happy-bite-audio` endpoint with this UI. `lib/happy-bite-upload.ts` sends 6 MiB MP3 chunks directly to Cloudinary using server-signed parameters. This avoids sending a large file through the Next.js proxy and a long-lived backend request. Transient chunk failures retry twice; **Retry upload** starts a fresh authorized upload using the selected file. Navigation aborts the direct audio upload. Thumbnail uploads keep their existing 5 MB validation and endpoint.

Cloudinary account limits still apply to the complete asset regardless of chunking. Size, quota, authorization, timeout and network failures have actionable messages. No provider account settings or quotas are changed by this code. The existing multipart endpoint remains available for current mobile/admin clients.

Validation: `npm run lint`, `npx tsc --noEmit`, `npm run test:auth`, `npm run build -- --webpack`. Upload transport regression tests are in `test/happy-bite-upload.test.mjs` and `test/upload-progress.test.mjs`.


### User network details and Leaflet map

This update lives directly in the admin application. The Next.js lookup uses the existing authenticated listing plus the new backend device-reference cache endpoints: `GET /api/admin/user-network` first calls the existing protected backend `GET /admin/user-security` with the administrator's token. The lookup requests the selected account and device by ID. Older backends can still resolve the account from the supplied list page. The backend record supplies the public IP and model. Every request, including cache hits, rechecks backend admin authorization. Tokens are sent only to the configured backend, never to lookup providers. Responses use `private, no-store`; the route limits each token to 30 requests/minute per process and bounds provider concurrency/cache sizes.

Opening a user dialog performs a server-side lookup of the stored public IP through **ipapi.co**, with **ipwho.is** as a fallback for quota, authorization, network or invalid-response failures. The UI identifies the source that actually supplied the coordinates. Public-IP city/region/country, country ISO, postal code, latitude/longitude, timezone, ASN and organization are shown when returned. The admin route can work even when the Express backend's `SECURITY_GEOIP_PROVIDER` is unset. It does not change the backend's configuration or saved network record. It reuses successful IP lookups for 24 hours and failures for one minute. Provider-wide cooldowns honor `Retry-After`; without a header, quota responses pause ipapi.co for 15 minutes and ipwho.is for 24 hours. Other provider failures pause that source for one minute. **Refresh lookup** respects these windows. During an outage, a same-IP success less than seven days old can remain visible with a cached label and its original lookup time; otherwise a valid saved backend location is labeled as a fallback. API-key changes invalidate old ipapi.co failure/cache state. Private/local IPs are not sent to the provider. When both providers are unavailable and there is no saved approximate location, the admin server looks up the public IP in the bundled DB-IP Lite city database. The map credits DB-IP and shows the database edition date. This fallback covers IPv4 and IPv6 and requires no network request or API key. Update the packaged dataset to refresh its edition.

For a provider plan requiring credentials, configure `SECURITY_GEOIP_API_KEY` **on the Next.js admin server** (never with a `NEXT_PUBLIC_` prefix). Set `ADMIN_IP_LOOKUP_ENABLED=false` there to disable all admin IP lookups, or `ADMIN_IP_LOOKUP_FALLBACK=false` to disable only ipwho.is. Both sources have independent quotas; the fallback is not unlimited. ipwho.is documents a free commercial-use endpoint with 1,000 requests/day per client IP and no SLA; use an appropriate provider plan for production traffic. No key or paid account is provisioned by this code. The app must report a public IP while basic security reporting is enabled; this UI cannot discover an unreported device.

Leaflet 1.9.4 JS/CSS load client-side from pinned `unpkg.com` URLs with official integrity hashes. OpenStreetMap tiles retain attribution and normal browser caching. A world map without a marker is shown when coordinates are missing. Map failures have a retry control, and instances/resize observers are removed when dialogs close. Browser access is required to `unpkg.com`, `tile.openstreetmap.org` and Wikimedia image hosts. Map tiles are not downloaded for closed cards. Public OSM tiles are best-effort; review their usage policy for deployment volume.

When `SERPER_API_KEY` is configured on the **Next.js server**, device photos are searched first through Serper's `POST https://google.serper.dev/images`. Store the key in ignored `.env.local` locally and the hosting environment in production; never use a `NEXT_PUBLIC_` variable. Restart the admin server after changing it. Only the validated device model or its Google Play catalog name is sent, with autocorrection disabled. Results must have a matching product heading or complete hardware-code token. Manufacturer/device-catalog sources are preferred, followed by other public HTTPS source pages. Images use approved image hosts or Google thumbnails. The result title appears in the UI; Serper source URLs remain in the server result but are not shown as links. Required Wikimedia attribution remains visible. Variant mismatches, accessories, comparisons and unsafe URLs are rejected. These results are labeled **Model search reference**, with the result title; search results do not establish image licensing or prove the user's physical hardware. Image rights remain with the source. A Google thumbnail is tried if the original fails. Requests time out after five seconds; quota responses honor Retry-After (15-minute default), other provider failures pause for one minute. Failed or unmatched searches fall back to the existing Wikimedia lookup. Cache keys change when the Serper key changes. Browser access is also needed to the selected source image host and `*.gstatic.com`.

The admin server searches Wikidata/Commons using only the reported **device model**, not the user's name, IP, email or a personal device name. A matched, freely licensed reference photo includes source, creator and license attribution. For Android hardware codes, the admin first downloads Google Play’s public supported-device CSV (cached for 24 hours, bounded to 16 MB, with a five-second timeout) and resolves the exact Model column to a unique manufacturer/product name. It never sends a user IP or model in that public catalog request. Ambiguous catalog rows now search the raw model code through Serper and show a labeled search reference when a relevant result is found. They remain ambiguous for the exact Wikimedia fallback. For example, Google Play lists STK-L21 as Huawei Y9 Prime 2019, Y9s and P smart Pro; the UI explicitly says its search reference cannot establish which one the user owns. For the Wikimedia fallback, only a unique Wikidata entity whose model label matches that resolved name exactly, or explicitly lists the complete hardware code as an alias, can supply an image. Variant suffixes (including Plus/Pro/Ultra/5G) are preserved; family/series entries and ambiguous matches are rejected. The image comes from that entity’s non-deprecated P18 claim and must carry valid attribution. Generic illustrations and snippet-based guesses are not used. Missing or failed images show the reported code and **Exact image unavailable**; Retry device image can re-run a cached lookup after a one-minute cooldown. Valid original image URLs are accepted when Commons has no thumbnail, and known Creative Commons license links are upgraded to HTTPS. Missing model, unsupported model, missing exact catalog record, missing photo, missing metadata, catalog outage and browser image failures have distinct messages. A **Model match** link makes the catalog identity inspectable. This still depends on catalog coverage and correct device reporting; it cannot establish a device’s physical color or condition. Photo results are reused for seven days; no match for one hour; failures for one minute. A reference photo is not an image of the user's physical device.

IP2Location, DB-IP, IPinfo and Criminal IP are **not integrated**. VPN, proxy, Tor, hosting/cloud/mobile classification, crawler/scanner/Snort, AS name and threat/inbound/outbound scores remain **Not provided**. Missing data never appears as a negative check or a safety judgment. ipapi.co's organization field is not represented as a verified SIM carrier. ipwho.is's `connection.isp` appears separately as the ISP supplied by the location provider. Existing account ban/delete confirmations and backend workflows are unchanged.

The production IP lookup runs on the Next.js server. To point it at a custom backend, set `AUTH_BACKEND_ORIGIN` to its absolute API URL on the admin web host. When the browser uses a relative proxy path, the lookup uses this server setting or the configured Railway backend, defaulting to the HappiNotes production API.

Files: `app/api/admin/user-network/route.ts`, `lib/user-security.ts`, `lib/user-security-lookup.ts`, `components/admin/SecurityLocationMap.tsx`, `components/admin/UserNetworkDetails.tsx`, `app/admin/(secure)/user-security/page.tsx`; tests: `test/user-security.test.mjs`.

References: [Leaflet setup](https://leafletjs.com/examples-v1/quick-start/), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/), [ipapi.co fields](https://ipapi.co/api/), [ipapi.co plans](https://ipapi.co/pricing/), [ipwho.is fields, limits and usage](https://ipwhois.io/documentation), [Wikimedia image metadata](https://www.mediawiki.org/wiki/API:Imageinfo), [Google Play supported devices](https://support.google.com/googleplay/answer/1727131).

The website privacy notice and mobile disclosure name both IP lookup providers, the random account-scoped installation ID and device-reference image providers. Store submission declarations remain a release task.

### Device details modal and cache status

**View device details** opens a dedicated modal with the already-loaded photo, model, OS/version, connection type, carrier, device/public IP, last report and available catalog/search details. Opening this modal does not issue a new lookup. General IP lookup refreshes reuse the device cache; only **Retry device image** requests its explicit refresh (subject to the existing one-minute cooldown).

Device references are persisted in the backend MongoDB `devicereferencecaches` collection, shared by normalized model name. Successful results expire after seven days, misses after one hour and failures after one minute. Each authorized lookup first reuses the in-process cache, then checks MongoDB before contacting providers. Database hits survive Next.js restarts. During backend rollout/outages, the UI remains usable with memory caching and the device modal labels that fallback; later views retry persistence. The device modal shows the image fetch time and storage state. Deploy the backend before the admin so the protected GET/PUT `/admin/user-security/:id/device-reference?deviceId=...` routes are available. `SERPER_API_KEY` stays on the Next.js server, never in the database or mobile app.

Moto G-series image matching treats `moto g45 5G`, `Motorola G45 5G` and `Motorola Moto G45 5G` as equivalent headings and accepts recognized retail color/RAM/storage suffixes. Model numbers, 4G/5G and Plus/Pro variants remain distinct. `motorola.in` is an approved manufacturer source. Build fingerprints are not used as product names in image searches.

The device selector lists **all registered installations under one existing account**; the newest customer login replaces earlier sessions. Updated app builds save a random ID per account in existing secure storage before reporting. The backend upserts `UserDevice` by user ID plus installation ID and retains each latest report for 90 days of inactivity. First-seen/last-seen and selected-device IP/map/model details are available in the modal. Older builds that sign in again use a server-issued login-session fallback when they cannot supply an installation ID. The last pre-rollout `UserNetwork` snapshot remains selectable alongside modern records. Legacy snapshots cannot reconstruct past devices. Clearing app storage/reinstalling may create a new installation record; this is not a permanent hardware identity or proof of fraud. Existing account deletion removes all device records.


Device location appears as a separate section/map in each selected device’s details, independently of the IP lookup. It displays the latest consented coordinates, reported accuracy, captured/received times and mock-location flag if provided. Missing location never substitutes an IP pin. The mobile switch defaults OFF and requires foreground OS permission; basic IP/device reporting defaults ON only without an existing preference. Saved OFF choices remain OFF. No location-provider quota is used for device coordinates; OpenStreetMap still supplies map tiles. Publish the revised privacy text and update store declarations before release.


**Login & device history** in each user dialog retains the latest 50 successful sign-ins, including entries that have not yet supplied optional device metadata. Status labels distinguish the current authorized session from replaced, signed-out, expired and revoked sessions. Current is not an online-presence assertion. Each reported login links to its device details; earlier devices remain selectable. Backend atomic session rotation makes only the latest customer login valid. Restart/deploy the backend and admin and update the app to enable the complete flow. Earlier overwritten legacy snapshots cannot be reconstructed.


The User Security page checks backend capability flags and displays a deployment warning if location storage or newest-login session enforcement is not confirmed. GPS collection failures no longer erase a last-known location; its original capture/receipt timestamps remain visible. This map cannot fetch GPS directly from a phone: the installed app must opt in, have OS location permission and upload a valid fix to the updated backend.


### Current session, location status and VPN review

Login history pins the current authorized session above a keyboard-scrollable previous-login list. With no current session, it pins the newest record and shows “No active session.” Selecting a login selects that device's report. The separate device-location section shows the app's last collection status and check time, distinguishing OFF, denied permission, disabled services, missing native support and timeouts. Existing coordinates keep their capture time after transient failures.

User Security displays a red VPN detection count and an alert when a loaded account's count increases. Five separate detections revoke access and ban the account plus recorded app installations; VPN detection is Android client-reported and is not proof of fraud. IP blocking requires the administrator's separate review/reason/confirmation, and can affect unrelated customers sharing that IP. Unbanning the account resets strikes and releases installation/email restrictions; use the separate IP action to lift an IP restriction. Backend capability checks include VPN support. These features require the updated backend and rebuilt mobile app; editing this repository does not deploy them.

### User Security chart view

User Security opens on **Details**. **Charts** presents ten interactive charts across Access & Activity, Patterns & Policy, and Device Reporting: login activity, account access, connection mix, session outcomes, device platforms, weekday/hour login heatmap, VPN detection distribution, devices per account, location coverage and report freshness. The 7/30-day activity window applies to the timeline and UTC heatmap; the other charts show the current fetched snapshot. Responsive SVG sizing, semantic colors, hover tooltips and aligned chart cards keep the dashboard readable across screen sizes. Summary cards show accounts, device reports, authorized sessions and recorded VPN detections. Select a bar, legend, heatmap cell or daily total to inspect matching accounts and open their existing security dialog. Search and pagination are shared between views; charts explicitly cover the fetched page (up to seven users), not all matching accounts. Retained login history is capped at 50 per account, and authorized sessions are not an online-presence indicator. Missing reports are not invented.

The existing Framer Motion dependency supplies the moving tab indicator, panel transitions, staggered card reveals and animated SVG/bar drawing; loading uses chart-shaped skeletons. Reduced-motion preferences disable entrance/drawing motion. Existing live invalidations and refreshes supply both tabs; no additional API endpoint or moderation workflow is introduced.

Files: `components/admin/UserSecurityCharts.tsx`, `lib/user-security-charts.ts`, `test/user-security-charts.test.mjs`, and the existing `app/admin/(secure)/user-security/page.tsx`.

User Security IP and device maps now support zoom levels 0–19 (the configured OpenStreetMap tile range), mouse-wheel/pinch zoom, double-click, keyboard controls and Shift-drag area zoom. The toolbar shows the current zoom, resets the view and expands the map using browser fullscreen where available, with a taller in-panel fallback. Resize handling keeps the existing map/marker and zoom intact. Open full map opens Google Maps at the coordinates of the selected IP or device pin. Increasing zoom does not increase the accuracy of a saved IP or device coordinate.

### Application analytics and management navigation

`/admin/dashboard` is now a dedicated chart dashboard. Story Books (`/admin/story-books`) and Users (`/admin/users`) are separate sidebar menus using `components/admin/ContentManagement.tsx`; existing book creation/editing, upload and publication confirmations, user blocking and seven-user pagination are retained. Book editor return links and the older content/upload routes lead to Story Books.

Dashboard reads the complete existing `/admin/contents`, `/admin/happy-bites`, `/admin/users` and `/admin/stats` responses. Ten charts show community growth, current Pro coverage, library growth/composition, publication states, content access, book languages, bite categories/durations and account blocking. The 6/12-month control applies to creation-date trends in UTC; the other charts show current snapshots. Account totals include all roles, and blocked flags are not online activity. No revenue or listening metrics are inferred. Data refreshes every minute while visible, on focus and after local catalogue changes. Failed sources show unavailable panels instead of zero counts, with manual retry. Framer Motion honors reduced-motion preferences; charts support keyboard values and mobile layouts.

New paths: `app/admin/(secure)/story-books/page.tsx`, `components/admin/ContentManagement.tsx`. Existing dashboard chart components/helpers and tests contain the new analytics; no backend endpoint, dependency or subscription workflow was changed.


### Audiobook language selection

Story Books → Create a book / Edit book now uses a searchable language dropdown.
The shared picker also covers the older content editor. Its local catalog contains
8,046 choices: all 7,867 entries in the bundled ISO 639-3 snapshot plus additional
Indian Census names, covering all 121 Census language groups and every published
named mother-tongue row. Search accepts names, common Indian aliases, native names
for all 22 scheduled languages, and ISO codes. The list is virtualized with no
result cap. Custom language/dialect names remain supported, and old language
strings are retained unchanged unless the administrator selects a replacement.

This is audiobook metadata, not translation of the app or narration. The catalog
includes historical/ancient languages and language groups as well as living
languages; it does not claim to enumerate 19,569 distinct languages or match a
fixed 7,170 living-language count. See [sources, scope and update instructions](lib/data/LANGUAGE_SOURCES.md).
Save, publication, pricing and upload workflows keep the existing backend string
field; no backend migration, new dependency or external search call is needed.

Added files:

```text
components/admin/LanguagePicker.tsx
lib/content-languages.ts
lib/data/india-census-languages.json
lib/data/iso-languages.json
lib/data/iso-languages.LICENSE
lib/data/LANGUAGE_SOURCES.md
test/content-languages.test.mjs
```


### Happy Bites language selection

Happy Bites → Create/Edit now reuses the audiobook language picker and its full
8,046-entry catalog, native-name/ISO search, and custom dialect entry. New drafts
start with English; older items without language metadata open with a blank
selection so the administrator can choose the correct language. Saving the editor
requires a language. The list displays it and includes it in text search.

The backend HappyBite model and create/update controller now store the optional
`language` string (trimmed, at most 160 characters) and return it in existing admin
and public responses. Restart/deploy **both backend and admin** for persistence;
no database backfill is needed. Status-only updates preserve existing language,
and older API clients can omit it. Existing upload, access and publish workflows
are unchanged. No new files or dependencies were introduced for this extension.

### Happy Bites large-audio allowance check

The audio uploader first displays **Checking storage allowance…**. The backend
reads the Cloudinary audio/video per-file allowance and rejects an oversized MP3
before transfer, reporting both the file size and allowance. The selected file
and its preview remain available. After increasing the allowance in Cloudinary,
press **Retry upload**; a previously exceeded allowance is fetched again immediately.
The browser also checks `maxFileSizeBytes` on new upload tickets; tickets from
older backends still work. Deploy both backend and admin changes. No Cloudinary
plan or account setting is changed automatically, and no new app size cap is added.

## System Status

The header uses the supplied hosting animation, bundled as
`public/admin/system-status.lottie` and rendered by
`components/admin/SystemStatusAnimation.tsx`. Source:
https://lottie.host/7b1887b6-769c-4a16-bb8a-fa9cc86570fd/ouG86ZbyBT.lottie .
It has a transparent canvas, a static reduced-motion frame, an icon fallback,
and offscreen freezing. The decorative animation does not indicate server health.

The sidebar order is Dashboard, Story Books, Happy Bites, Featured, Users, User
Security, Settings, System Status, Deletion requests. The monitoring page uses
HeroUI v2 cards, keyboard-accessible tabs, selects, progress bars, switches,
inputs, alerts and skeletons, with reduced-motion support.

Open **Management → System Status** at `/admin/system-status`.

- **Server overview:** six interactive time-series charts, live health cards and
  5/15/60-minute ranges. Hover or use arrow keys to inspect samples; unavailable
  data is not replaced with zeroes.
- **Database:** dedicated MongoDB storage, indexes, documents, collections,
  connection capacity, uptime and resident memory, plus three performance charts.
  Small sizes use bytes/KiB instead of rounding down to zero MiB. Storage bars
  compare measured sizes and do not imply a known disk limit.
- **Builds & live logs:** latest 12 Railway deployments, automatic following of new
  builds, actual build stage, build/runtime log selection, search and auto-scroll.
  Only actual stage states are shown; there is no invented completion percentage.
- **Railway metrics:** CPU, memory, persistent disk and network usage over one hour.

Health/logs poll every 5 seconds, deployment discovery every 10 seconds, and
infrastructure every 30 seconds. Polls never overlap within a channel, cancel on
navigation, pause in hidden tabs and refresh on focus. Pause/Resume and manual
Refresh are provided. Motion respects reduced-motion preferences, and initial
metric loading uses skeletons. Failed connections mark snapshots as stale.

Deploy the backend monitoring routes with this UI. Configure `RAILWAY_TOKEN` only
on the backend, along with the three `SYSTEM_STATUS_RAILWAY_*_ID` variables from
its README. No Railway token is included in the browser. Application monitoring
works without the Railway integration, and the page explains missing setup.
Current-process history resets on restart; it is not a durable uptime monitor.

New files:

```text
app/admin/(secure)/system-status/page.tsx
components/admin/SystemMetricChart.tsx
lib/system-status.ts
test/system-status.test.mjs
```

## Public Firebase sign-in page

`app/auth/google/browser/[action]/route.ts` and `lib/google-auth-proxy.ts` serve the Expo Go Firebase handoff at `https://happinotes.online/auth/google/browser/page`. They proxy only GET `page` and POST `complete` to the existing backend. The server-only `AUTH_BACKEND_ORIGIN` can override the production backend address. An HTTPS backend is required. This proxy intentionally does not read `NEXT_PUBLIC_API_BASE_URL`, which can be a relative browser proxy path.

The proxy validates session IDs, caps completion payloads, requires the exact public origin for POST, forwards only the session-bound Google cookie, disables caching and redirects, preserves CSP/security headers, and replaces backend diagnostics with safe messages. It never sends website/admin credentials upstream. Tests are in `test/google-auth-proxy.test.mjs`.

Deploy this website route before setting backend `GOOGLE_SIGN_IN_BROWSER_ORIGIN=https://happinotes.online`. Add `happinotes.online` to Firebase Authentication authorized domains. Keep this origin in backend `CORS_ORIGINS` for older backend builds. The mobile browser destination allowlist must match. Actual Google authentication still uses Google's own visible domain.

### Admin sleep screen

The header’s Sleep button opens `components/admin/AdminSleepScreen.tsx`: a full-screen local clock, orange/red ambient animation, 12/24-hour clock toggle, and Wake up button. Escape also wakes the workspace. The current page stays mounted, so unsaved form values are retained. This is a visual screen cover, not a logout or authentication lock; existing uploads and background work continue. Reduced-motion preferences are respected, and the clock timer is cleared on wake.

## Google Play Console

Open **Management → Play Console** at `/admin/google-play`. The page is a
responsive workspace with Overview, Applications, Releases, Reviews, Analytics
and Integration tabs. It reads actual data from protected backend routes;
configured packages with unavailable API data are shown explicitly instead of
being replaced with sample statuses. Review search/rating filters, release-track
inspection, connection metadata, cache/sync controls and loading/error/empty
states are included.

The browser receives no Play credentials. Configure
`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` and `GOOGLE_PLAY_PACKAGE_NAMES` on the
backend only, grant the service account matching app permissions in Play
Console, enable Android Publisher API, and enable Play Developer Reporting if
analytics are required. The backend keeps a short in-memory cache and **Sync
now** invalidates it. No frontend dependency was added; the existing HeroUI and
API client are reused.

### Story Book lesson access

Each lesson’s Free/Paid switch changes only that lesson. New lessons always start Free. The compact access section has a global Free/Paid toggle that applies to all current lessons, plus a publication-status badge. The Free/Paid labels also apply that choice directly when the book has mixed access. Individual lesson switches remain independent and can override the global choice afterward. Click **Save changes** to persist the settings. Mixed books use independent lesson access and display Free + Premium in the app; only a book whose lessons are all paid is marked entirely Premium. Existing Pro membership and book purchases still unlock paid sessions. Regression coverage: `test/book-editor-access.test.mjs`.

Lessons are listed in a compact scrollable table with part number, thumbnail/name, an individual access toggle, audio status, and a Details button. Existing rows start collapsed; expanding one opens the complete lesson editor inline and closes the previous one. New lessons and the first invalid lesson expand automatically. Unsaved edits remain in the parent form when details collapse. Search accepts names or exact part numbers (for example, `Part 2`); access filters support Free, Paid or both. Sorting changes the view only, never the saved playback order. New lessons store `createdAt` for newest/oldest sorting; legacy lessons without dates fall back to part order. The global access toggle and Save changes still apply to the entire book, including hidden results. Adding a lesson clears filters and reveals it first.
