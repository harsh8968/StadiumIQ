# StadiumIQ — Pre-Submission Audit Report

**Date:** 2026-04-18
**Auditor mode:** Read-only · evidence-based · no scope creep
**Benchmark:** Friend's AI-judge result — 92.81% overall (Code 86.25, Security 97.5, Efficiency 80, Testing 96.25, A11y 96.25, Google 100, Problem 95)

Build status (verified this run):

| Gate | Result |
|------|--------|
| `npm run typecheck` | ✅ clean, zero errors |
| `npm run lint` | ✅ "No ESLint warnings or errors" |
| `npm run build` | ✅ 16 pages compiled, 7 API routes |
| `npx vitest run` | ✅ 42 / 42 tests passing in ~570 ms |
| `npx vitest run --coverage` | ⚠ 41.48 % lines overall |
| `npm audit` | ⚠ 18 findings (4 high / 6 mod / 8 low) — all in `vitest → vite` **devDependencies** |

---

## 1. Code Quality — Verdict: **PASS**

### Evidence (positive)

- **No `any` in code paths.** `grep '\bany\b' {lib,app,components,hooks}/**/*.{ts,tsx}` returned only English-prose matches in `lib/claude/conciergePrompt.ts:47,65`, `components/marketing/HowItWorks.tsx:5`, `components/marketing/TwoSidedSection.tsx:7`. No type-level `any`.
- **No `@ts-ignore` / `@ts-expect-error`** anywhere.
- **`eslint-disable` usage is minimal and legitimate:**
  - `lib/mock/store.ts:59`, `lib/mock/orderStore.ts:75`, `lib/mock/generator.ts:11` — `no-var` disable for the `globalThis` singleton pattern that CLAUDE.md explicitly mandates for HMR + cold-start survival.
  - `hooks/useRoute.ts:71` — one `react-hooks/exhaustive-deps` disable.
- **No `TODO`, `FIXME`, `XXX`, `HACK`** in `lib/` / `app/` / `components/` / `hooks/`.
- **No relative `../../../` imports.** All imports use the `@/` alias (CLAUDE.md convention).
- **Strict TS mode** via `tsconfig.json` + `next.config.mjs` with `poweredByHeader: false, reactStrictMode: true, compress: true`.
- **Absolute imports** and co-located feature folders as per CLAUDE.md.

### Evidence (gaps)

- **No `.prettierrc`** (checked root — absent). Formatting is consistent in practice but not enforced by a config file.
- **No CI pipeline** — `.github/workflows/` does **not exist**. Judges routinely cite this for code-quality scores. Build/test/lint are only run locally.
- `console.error` in `app/(public)/error.tsx:14` and `app/(app)/error.tsx:14` — acceptable (error boundaries), but raw `error` object is logged; consider structured logging if going beyond demo.

---

## 2. Security — Verdict: **PASS (with one concrete gap)**

### Evidence (positive)

- **Full security-header stack** in `next.config.mjs`:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(self), interest-cohort=()`
  - Full CSP with nonce-less but scoped `script-src`, `connect-src` limited to `api.groq.com`, Firebase, GA4.
  - Static assets get `Cache-Control: public, max-age=31536000, immutable`.
- **Central env validation** in `lib/env.ts` with Zod — throws at module load with field-specific error.
- **`.env.local` is git-ignored** (`.gitignore` line `.env.local` and `.env*.local`). `git log -- .env.local` returns no history — never committed.
- **No secret references in client code.** `grep ANTHROPIC_API_KEY|GROQ_API_KEY {app,components,hooks}/**` returned **no matches**. Only server code (`lib/claude/client.ts`) reads the key.
- **No stack-trace leakage from API routes.**
  - `app/api/concierge/route.ts:73-75` catches everything, returns a canned `FALLBACK` response.
  - `grep 'error\.(message|stack)'` across `app/api/` — **no matches**.
- **All 7 API routes use Zod** (grepped `Schema.(parse|safeParse)|z\.object` in `app/api/`):
  - `/api/concierge` → `ConciergeRequestSchema.safeParse`
  - `/api/order` → `PlaceOrderRequestSchema.safeParse`
  - `/api/density` PATCH → inline `z.union([…])`
  - `/api/simulate` → `SimulateRequestSchema.safeParse`
- **No CORS `*` headers** in any route or `next.config`.
- **Clickjacking protection** via `frame-ancestors 'none'` + `X-Frame-Options: DENY`.

### Evidence (gaps)

- **No rate limiting on `/api/concierge`.** `grep 'rateLimit|rate_limit|rate-limit|upstash|ratelimit' app/api/` → **no matches**. An attacker can burn the Groq quota by hammering this endpoint. **P1 fix.**
- `npm audit` shows 18 findings (4 high), but all chain through `vitest@2 → vite@5 → esbuild/vite-node`. These are **devDependencies only**, not production. Fix is the vitest 4.x semver-major upgrade.

---

## 3. Efficiency — Verdict: **PASS**

### Evidence (positive — from the just-run `next build` output)

- Route sizes (First Load JS, gzipped):
  - `/` — **862 B / 97.1 kB** (landing, within budget)
  - `/group` — 143 B / 87.6 kB
  - `/profile` — 2.07 kB / 89.6 kB
  - `/admin` — 3.54 kB / 138 kB
  - `/concierge` — 8.59 kB / 134 kB
  - `/order` — 9.3 kB / 185 kB
  - `/map` — 26.4 kB / 193 kB
  - `/analytics` — **109 kB / 197 kB** ← heaviest, carries recharts.
- Shared baseline chunk: 87.5 kB. Within the 150 kB landing budget from `rules/web/performance.md`.
- **No `<img>` tags.** `grep '<img\s' {app,components}/**/*.{ts,tsx}` → no matches. All images go through `next/image` or are inline SVGs.
- **Fonts preload sanely.** `app/layout.tsx`: `GeistVF.woff` preloaded, `GeistMono` lazy — `display: "swap"` on both.
- **500 ms polling interval** per CLAUDE.md spec — intentional, not a waterfall.
- **Memoized graph load.** `/lib/routing/index.ts` caches the parsed `graph.json`.
- **SVG-based map** — no Leaflet/Mapbox/Google Maps runtime cost.
- Framer Motion animates compositor-friendly `fill` + `pathLength` only.

### Evidence (gaps / minor)

- **`components/map/VenueHeatmap.tsx` has no `React.memo` / `useMemo`.** `grep 'React.memo|useMemo|useCallback' components/map/` → no matches. In practice pois.map iterates 17 items at ≤2 Hz — negligible — but memoization would silence a judge looking for it.
- Analytics bundle (`recharts`) is 100 kB+. Acceptable for a dashboard page, but code-split is the canonical fix if it becomes a complaint.

---

## 4. Testing — Verdict: **PARTIAL**

### Evidence (positive)

- **42 tests, 5 files, all passing:**
  - `tests/waitTime.test.ts` — 6 tests
  - `tests/store.test.ts` — 8 tests
  - `tests/routing.test.ts` — 8 tests (includes crowd-penalty math check)
  - `tests/matchTimeline.test.ts` — 7 tests
  - `tests/schemas.test.ts` — 13 tests (validates `pois.json` + `graph.json` load-time shape)
- **No `.skip`, `xit`, `xdescribe`** in test files.
- **100% line coverage on the files that have tests:** `constants.ts`, `matchTimeline.ts`, `store.ts`, `waitTime.ts`, `dijkstra.ts`, `concierge.ts`, `graph.ts`, `order.ts`, `poi.ts`.

### Evidence (gaps)

- **Overall line coverage: 41.48 %.** Well below the 80 % minimum in `rules/common/testing.md`.
- **Zero-coverage files** (per v8 report):
  - `lib/env.ts`
  - `lib/mock/analytics.ts`
  - `lib/mock/events.ts`
  - `lib/mock/generator.ts`
  - `lib/mock/menus.ts`
  - `lib/mock/orderStore.ts`
  - `lib/schemas/crowd.ts`, `session.ts`, `simulate.ts`
  - `lib/routing/index.ts` (the `getGraph()` wrapper)
  - All `/app/api/*/route.ts` — zero tests
  - All `/components/**` — zero tests
  - All `/hooks/**` — zero tests
- **No E2E tests.** No Playwright config, no `e2e/` folder. `rules/common/testing.md` requires E2E for critical user flows.
- **No CI** to run tests on push. `.github/workflows/` absent.

---

## 5. Accessibility — Verdict: **PASS**

### Evidence (positive)

- `app/layout.tsx:71` — `<html lang="en" suppressHydrationWarning>` ✅
- `app/layout.tsx:75` — `<SkipLink />` renders before `ThemeProvider`, targets `#main-content`. `components/shared/SkipLink.tsx` uses `sr-only focus:not-sr-only`.
- `app/layout.tsx:57-63` — `maximumScale: 5` viewport (was 1 — fixed in previous session; this unblocks pinch-to-zoom, a common WCAG 1.4.4 fail).
- **ARIA in navigation** — 6 `aria-label` / `aria-labelledby` occurrences across the app shell and map:
  - `components/shared/AppShell.tsx:4` — `aria-label="Primary navigation"`, `role="banner"`, `aria-current` on active link, `id="main-content" tabIndex={-1}` on `<main>`.
  - `components/map/VenueHeatmap.tsx:2` — `role="img"`, `<title>Stadium venue map</title>`, `<desc>` paragraph, per-POI `aria-label`, `role="button"`, `tabIndex={0}`, keyboard handler for Enter/Space (lines 115-128).
- `hooks/useReducedMotion.ts` exists and reads the `prefers-reduced-motion: reduce` media query.
- `focus-visible:ring-sky-500` utility used for keyboard focus indication.

### Evidence (gaps — small)

- `useReducedMotion` hook exists but is **not imported anywhere** — `grep useReducedMotion` returns only the file itself. Motion plays the same for reduced-motion users.
- Contrast of the density palette (`#22c55e / #eab308 / #f97316 / #ef4444`) on the `#1e293b` venue shell is not explicitly attested — visually strong, but not checked with a contrast tool.
- Minor: no `<label>` pattern audited on the concierge `<input>` — using `aria-label` is fine but has not been grepped individually.

---

## 6. Google Services — Verdict: **PARTIAL**

This is the single weakest criterion given the friend's 100 % benchmark.

### Evidence of actual production use

- **Google Analytics 4** — `components/shared/GoogleAnalytics.tsx` loads `gtag.js` via `next/script strategy="afterInteractive"`, `anonymize_ip: true`, gated on `NEXT_PUBLIC_GA_ID`. Wired from `app/layout.tsx:85`.
- **Google Fonts (Geist)** — via `next/font/local` (`app/layout.tsx:10-24`).
- **Vercel deploy region `bom1`** (Google-adjacent only — not a Google service).

### Evidence of _claimed_ but **unused** Google services

- `lib/firebase/client.ts` and `lib/firebase/admin.ts` exist, are strictly typed, lazy-initialised, and env-gated. **But**: `grep 'firebase|firestore|getDb\(|getAdminDb|getFirebaseAuth|getMessaging' {app,components,hooks,lib/data}/**/*.{ts,tsx}` returns **zero matches**. No component, hook, API route, or data-layer file actually imports Firebase.
- `grep 'signInWithPopup|GoogleAuthProvider|signIn' **/*.ts,tsx` → **no matches**. Google sign-in is not wired.
- FCM is defined in `lib/firebase/client.ts` (`getMessagingInstance`) but never called.
- `NEXT_PUBLIC_MOCK_MODE=true` in production (per deployment notes), which means the Firestore branch of `/lib/data/*` always throws "not implemented" and the mock branch is taken instead.

### Why this matters

A judging AI that inspects `package.json` (which lists `firebase` + `firebase-admin`) and then traces imports will notice the disconnect and may score this lower than a project that actually writes to Firestore or performs a Google sign-in. Friend's 100 % almost certainly came from real Firebase writes or a working Google sign-in flow.

---

## 7. Problem-Statement Alignment — Verdict: **PASS**

### Evidence (positive)

- **Every CLAUDE.md feature has a matching route:**
  - Heatmap + routing → `app/(app)/map/page.tsx`
  - Virtual queue → `app/(app)/order/page.tsx`
  - AI concierge → `app/(app)/concierge/page.tsx` + `app/api/concierge/route.ts`
  - Group coordination → `app/(app)/group/page.tsx`
  - Admin control → `app/admin/page.tsx` + `app/api/simulate/route.ts`
  - Operator analytics → `app/(app)/analytics/page.tsx` + `app/api/analytics/route.ts`
- **Problem-statement language is consistent.** `grep -i '\bconcert\b|\bconference\b|\bfestival\b'` returned exactly **one** match, in `docs/PITCH.md:64` as a TAM-expansion line ("theme parks / festival grounds"). No stray concert/conference refs in product copy.
- `docs/ARCHITECTURE.md`, `docs/TECHNICAL.md`, `docs/PITCH.md`, `docs/DEMO_SCRIPT.md`, `docs/DEMO_CHECKLIST.md` all exist.
- README opens with the problem framing: mobile-first PWA for large sporting venues.

### Evidence (gaps)

- **No `docs/ALIGNMENT.md`** explicitly mapping challenge → features → files. The pre-audit spec flagged this; a one-page mapping doc would make this criterion ironclad.

---

## Summary Table

| # | Criterion | Verdict | Biggest gap |
|---|-----------|---------|-------------|
| 1 | Code Quality | PASS | No CI workflow; no `.prettierrc` |
| 2 | Security | PASS | No rate limit on `/api/concierge` |
| 3 | Efficiency | PASS | Minor: no `React.memo` on `VenueHeatmap` POI group |
| 4 | Testing | **PARTIAL** | 41 % coverage, no API / hook / component tests, no E2E, no CI |
| 5 | Accessibility | PASS | `useReducedMotion` hook defined but never used |
| 6 | Google Services | **PARTIAL** | Firebase declared but not imported in any prod code path |
| 7 | Problem Alignment | PASS | Missing explicit `docs/ALIGNMENT.md` mapping doc |

See `PRIORITY_FIXES.md` for the prioritised, time-estimated fix list.
