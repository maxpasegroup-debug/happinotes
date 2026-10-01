# HappiNotes public landing page

## Objective

Replace the current root redirect in `happinotes-admin/app/page.tsx` with a public, production-ready landing page for HappiNotes. Keep the existing admin area unchanged: `/admin/login` remains the administrator sign-in and `/admin/*` remains protected. The public page should explain the product to prospective listeners and provide a path into the book catalogue.

## Audience and content

The audience is adults looking for thoughtful Malayalam, Hindi, and English audio story/lifebook content. The site should feel trustworthy, calm, useful, and audio-first. Use honest copy; do not claim an App Store/Play Store download unless the UI already has a real link.

## Aesthetic direction

Create a distinctive “sunlit editorial listening room” rather than a generic SaaS landing page. Use a warm parchment background (#fbf7ef / #f2eadb), deep ink (#1e232b), coral-orange accents (#f36d52), and a muted sage/teal accent. Pair an expressive serif display style (Georgia or a similarly available system serif) for the hero headline with a clean sans-serif for UI copy. Use rounded cards, subtle paper-like gradients, soft shadows, thin borders, and a small amount of oversized editorial typography. The visual should feel premium but approachable, with strong contrast and restrained motion.

## Memorable element

The hero should feature an “audio shelf” composition: a large quote-like promise on the left and a layered stack of real catalogue cover cards on the right. Use the first few live lifebooks from `getLiveLifebooks()` for these covers when available, with a graceful local fallback if the API is empty/offline. No external image URLs should be introduced; use the existing catalogue thumbnail URLs and `/happinotes-logo.png`.

## Page structure

1. Sticky top navigation: logo/wordmark, anchors for “Why HappiNotes”, “Featured”, “How it works”, and a clear “Admin sign in” link to `/admin/login`.
2. Hero: eyebrow “Stories for real life”, headline about making space to listen, short supporting copy, primary CTA “Explore lifebooks” linking to `/lifebooks`, secondary text link “Admin sign in”, plus the layered audio shelf.
3. Proof strip: three compact benefits such as “Listen at your pace”, “Free and premium lifebooks”, and “Built for quiet moments”.
4. Why section: three editorial benefit cards explaining practical stories, multilingual listening, and progress/resume. Use simple inline icons or CSS shapes; do not add an icon dependency.
5. Featured section: fetch and show up to four live lifebooks with cover, title, language/type badge, short description, and link to `/player/{id}`. Include a polished empty/offline state.
6. How it works: three numbered steps — choose a story, press play, return when ready — with a small audio waveform treatment made in CSS.
7. Closing CTA band with a warm coral gradient and a “Start listening” link to `/lifebooks`.
8. Footer with brand statement, `/admin/login`, and a small privacy/terms placeholder only if existing routes support it; otherwise omit fake links.

## Interaction and responsive behavior

- Use accessible semantic elements, visible focus states, descriptive alt text, and keyboard-friendly links.
- Use lightweight CSS or existing `framer-motion` only for subtle reveal/hover effects. Respect `prefers-reduced-motion`.
- Desktop should have a wide editorial composition; mobile should stack hero content and make featured cards horizontally scrollable or a two-column compact grid without overflow.
- Do not require authentication to view the page or featured cards.
- Keep the existing global admin styles/components intact unless needed for root page isolation. The landing page may use a scoped wrapper and page-local styles/classes.

## Technical constraints

- This is the existing Next.js App Router project in `happinotes-admin`.
- Implement in `happinotes-admin/app/page.tsx` and any small colocated component/style file needed. Do not alter admin routes.
- Reuse `getLiveLifebooks` from `happinotes-admin/lib/content-api.ts`; it already normalizes media URLs and fetches the public catalogue.
- Use `next/image` only if remote image configuration is already sufficient; otherwise standard `<img>` is acceptable with robust fallback handling.
- Keep TypeScript strict enough to compile with the current project.
- Do not introduce new packages.

## Output

Implement the real page in the existing project route at `happinotes-admin/app/page.tsx`, with any supporting files beside it. The route `/` must render the landing page instead of redirecting to `/admin/login`.
