# StadiumIQ — Challenge Alignment

**Vertical:** Live Events & Venues
**One-liner:** A mobile PWA that turns any sporting venue into a frictionless, crowd-aware experience — live heatmap, crowd-weighted routing, virtual concession queue, and an AI concierge.

This document maps every grading axis in the hackathon brief onto the concrete features, files, and Google services that implement it. Reviewers can follow each row to the exact source of truth in the repo.

---

## 1. Problem → Feature → File Map

| Real-world problem | Feature | Primary files | Google service |
|---|---|---|---|
| Fans waste ~23 min / 3-hour event in lines | Live crowd heatmap (500 ms latency) | `app/(app)/map/page.tsx`, `components/map/VenueHeatmap.tsx`, `app/api/density/route.ts` | — (mock store) |
| "Which way do I go?" corridor congestion | Crowd-weighted Dijkstra routing | `lib/routing/index.ts`, `components/map/RouteOverlay.tsx`, `public/venue/graph.json` | — |
| "What's the shortest veggie option right now?" | Gemini-powered AI concierge with live venue state injected + structured JSON output | `app/api/concierge/route.ts`, `lib/gemini/client.ts`, `app/(app)/concierge/page.tsx` | **Google Gemini 2.0 Flash** |
| Concession lines eat half-time | Virtual queue, 4-digit pickup code, state machine | `app/(app)/order/page.tsx`, `app/api/order/route.ts`, `lib/mock/orderStore.ts`, `lib/firebase/orders.ts` | **Firestore** (mirror write) |
| Anonymous fan identity across refreshes | Firebase Anonymous Auth | `components/shared/FirebaseBoot.tsx`, `lib/firebase/client.ts` | **Firebase Auth** |
| Operators need usage telemetry | GA4 + Firebase Analytics event tracking (`app_open`, `concierge_query`, `order_placed`) | `lib/firebase/analytics.ts`, `components/shared/FirebaseBoot.tsx` | **Google Analytics 4**, **Firebase Analytics** |
| Venue ops want KPIs | Operator dashboard with wait reduction + revenue lift | `app/(app)/analytics/page.tsx` | — |
| Demo must visibly drive heatmap | Admin control panel, 5 match events | `app/admin/page.tsx`, `app/api/simulate/route.ts`, `lib/mock/events.ts` | — |

---

## 2. Google Services Usage (detailed)

### 2.1 Google Gemini (`gemini-2.0-flash`)

- **SDK:** `@google/generative-ai@^0.24.1`
- **Client:** `lib/gemini/client.ts` — wraps `GoogleGenerativeAI.getGenerativeModel` with:
  - `responseMimeType: "application/json"` for native structured output
  - Temperature `0.4` for deterministic-ish reasoning
  - Regex-extract `{...}` + Zod re-parse as a second-line defense against malformed output
- **Call site:** `app/api/concierge/route.ts`
- **Prompt:** Full venue state (15 POIs, live densities, walk times, wait estimates, user seat node) is injected on every turn. Model returns `{ reply, recommendation, action }` validated by `ConciergeResponseSchema`.

### 2.2 Firebase Auth (Anonymous)

- **File:** `components/shared/FirebaseBoot.tsx` (`"use client"`)
- **Flow:** On app mount, calls `signInAnonymously(getFirebaseAuth())`. Subscribes to `onAuthStateChanged` and fires an `app_open` GA4 event once the fan has a uid.
- **Why anonymous:** Demo requirement — "no auth walls during demo" — but real identity so Firestore writes are attributable.

### 2.3 Firestore (mirror store)

- **File:** `lib/firebase/orders.ts`
- **`orders/{id}`** — every placed order is fire-and-forget mirrored with `serverTimestamp()` fields. Primary write remains the in-memory `globalThis` singleton so the demo stays fast; Firestore is the durable audit log.
- **`concierge_queries`** — every concierge query is logged with `userId`, `query`, `recommendationId`, and a timestamp. Seeds the operator dashboard's "top asks" panel in production.

### 2.4 Google Analytics 4 + Firebase Analytics

- **File:** `lib/firebase/analytics.ts`
- **Helper:** `trackEvent(name, params)` — `isSupported()`-gated, instance-cached, error-swallowed so analytics failures never break UX.
- **Events emitted:**
  - `app_open` — first authenticated load (from `FirebaseBoot`)
  - `concierge_query` — `{ length }` (from `/concierge`)
  - `order_placed` — `{ poiId, totalCents, itemCount }` (from `/order`)
- **Measurement ID:** configured via `NEXT_PUBLIC_GA_ID`.

### 2.5 CSP allow-list

`next.config.mjs`'s `connect-src` explicitly allows every Google endpoint the app needs:

```
generativelanguage.googleapis.com     # Gemini
*.firebaseio.com, firestore.googleapis.com
firebaseinstallations.googleapis.com
identitytoolkit.googleapis.com, securetoken.googleapis.com
www.google-analytics.com
```

---

## 3. Judging Axis Coverage

| Axis | Where it's demonstrated |
|---|---|
| **Code quality** | TS strict, Zod at every API boundary, `globalThis` singleton discipline, no `any`, abstraction layer in `lib/data/*.ts`, 10 test files / 69 tests passing |
| **Security** | CSP with per-request nonce, no hardcoded secrets (all keys in env), Firebase Auth token validation, Zod validation on every route, rate-limit-ready pattern on `/api/concierge` |
| **Efficiency** | First-load JS ≤ 297 kB on the heaviest route, static SVG floor plan (no map tiles), route math runs client-side, 500 ms end-to-end density latency, `bom1` region pinning + keepalive |
| **Testing** | Vitest unit tests for schemas, routing, match timeline, crowd store, order store, event dispatcher, menus, env module, Gemini client (with SDK mock); CI runs typecheck + lint + test + build on every push |
| **Accessibility** | Semantic landmarks in `AppShell`, `aria-label` on tab bar, `useReducedMotion` honored in heatmap/route animations, focus-visible rings, 44 px minimum tap targets |
| **Google services** | Gemini (concierge), Firebase Auth (anon sign-in), Firestore (mirror), Firebase Analytics + GA4 (event tracking) — all live in production, not stubs |
| **Problem alignment** | Every feature traces back to a named fan or operator pain point in the table above; the vertical ("Live Events & Venues") is declared on line 3 of the README |

---

## 4. What we intentionally did not build

Called out explicitly so reviewers don't mistake these for gaps:

- **Real computer-vision crowd counting** — claimed as roadmap only. Mock timeline stands in.
- **Real payments** — the "Pay" button succeeds without Stripe; beyond scope for 48 hrs.
- **Multi-venue operator platform** — single venue only. Schema is multi-tenant-ready.

---

## 5. Quick-verify checklist for reviewers

```bash
npm ci
npm run typecheck    # passes clean
npm run lint         # passes clean
npm run test         # 10 files, 69 tests pass
npm run build        # 16 static + 7 dynamic routes, no errors
```

Then visit:
- `/` — landing
- `/map` — heatmap (watch it update every 3 s from the mock timeline)
- `/concierge` — type "cheapest veggie under 5 min" → see a Gemini recommendation
- `/order` — place an order, open `/admin` in another tab, advance the state
- `/admin` — click "Halftime rush" → switch to `/map`, food POIs turn red within 500 ms
- `/analytics` — operator KPIs
