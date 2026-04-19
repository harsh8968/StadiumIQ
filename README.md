# StadiumIQ

> **Challenge vertical: Live Events & Venues.**
> A mobile PWA that makes a 60,000-seat stadium feel navigable — live crowd intelligence, crowd-weighted routing, virtual concession queues, and a Gemini-powered AI concierge. Built so the average fan stops losing 23 minutes of a 3-hour match to queues.

**Live demo:** [stadium-iq-phi.vercel.app](https://stadium-iq-phi.vercel.app)
**Stack:** Next.js 14 · TypeScript (strict) · Tailwind · Framer Motion · **Google Gemini 2.0 Flash** · **Firebase (Auth + Firestore + Analytics)** · **Google Analytics 4** · Zod · Vercel
**Status:** Hackathon build — production-deployed, mock-driven for demo, wired to real Google services (Gemini for concierge, Firebase anon-auth + Firestore order mirror, GA4 event tracking).

---

## The problem

The average fan spends **23 minutes of a 3-hour event** standing in lines. Food queues, restroom bottlenecks, congested corridors — all while the game plays on without them. Venues lose per-cap revenue; fans lose the experience they paid for.

## The product

StadiumIQ is a mobile PWA with two sides:

| Surface | Who it's for | What it does |
|---|---|---|
| **Fan app** (`/map`, `/concierge`, `/order`) | 42,000 attendees | Live heatmap, AI concierge, skip-the-line ordering, crowd-avoiding routes |
| **Operator dashboard** (`/analytics`) | Venue ops | Real-time KPIs, bottleneck detection, revenue-lift tracking |
| **Admin simulator** (`/admin`) | Demo / control plane | One-click match events (halftime rush, goal celebration) to drive the heatmap live |

---

## Key features

### 1. Live crowd heatmap (`/map`)

Hand-traced SVG floor plan with 15 POIs — gates, food stands, restrooms, merch, first aid. Each POI is colored by live density (green → yellow → orange → red) with a **Framer Motion fill animation** so updates feel tactile, not janky. Polling is 500ms end-to-end from admin event to every client — well under the 2-second demo requirement.

### 2. Crowd-weighted routing

Not straight-line Dijkstra. Real routing that **avoids the congestion it just warned you about.**

```ts
// lib/routing/index.ts — edge weight formula
weight = baseDistance × (1 + CROWD_PENALTY_MAX × max(density[from], density[to]))
```

`CROWD_PENALTY_MAX = 2.0` means a fully-red corridor costs **3× its base distance**. The algorithm re-runs every time densities change, so the route animated onto your map is always current. 40-node graph (12 outer corridor + 12 inner + user seat + 15 POI nodes), ETA rounded to 5-second increments at `WALKING_SPEED_SVG_PER_SEC = 12`.

### 3. AI concierge (`/concierge`)

Chat UI wired to **Google Gemini 2.0 Flash** (`@google/generative-ai`) with `responseMimeType: "application/json"` for structured output. Every request injects **the current live venue state** (all POI densities + user location + estimated wait times) into the system prompt, then forces a structured response via Zod schema:

```ts
const ConciergeResponseSchema = z.object({
  reply: z.string(),
  recommendation: ConciergeRecommendationSchema.nullable(),
  action: z.enum(["navigate", "order", "info"]),
});
```

If the model returns invalid JSON, we extract the first `{...}` block with a tolerant regex and re-parse. If *that* fails, we surface a friendly fallback — **never raw LLM text to the UI.** Assistant messages are stored as serialized JSON so the model sees its own prior structured responses in context. Every query is mirrored to Firestore (`concierge_queries` collection) and logged as a GA4 `concierge_query` event.

Tap **"Take me there"** on any recommendation → deep-links to `/map?nav=<poiId>` with the route pre-drawn.

### 4. Virtual concession queue (`/order`)

Pick items → place order → get a 4-digit pickup code. Order state machine: `placed → preparing → ready → collected`. Admin (= kitchen staff in production) advances states; fan gets an in-app toast when ready. Server-side singleton via `globalThis` so state survives Next.js HMR and serverless cold starts.

### 5. Operator analytics (`/analytics`)

Live KPIs: avg wait reduction, revenue lift, Fan NPS proxy, active fans. Recharts-powered wait-time series, bottleneck ranking, concession mix breakdown. Refreshes every 3s. This is the B2B half of the story — **fans use it free, venues pay the platform.**

### 6. Admin control panel (`/admin`)

The demo money shot. One click on "Halftime rush" mutates density across all food POIs → every open client sees the heatmap turn red in **≤500ms**. Not visible to fans. Not linked from anywhere.

---

## Architecture at a glance

```
┌──────────────┐    HEAD /api/density (60s keepalive)   ┌──────────────┐
│   PWA Fan    │ ────────────────────────────────────── │   Vercel     │
│   (Next 14)  │                                         │   (bom1)     │
│              │ ◄── 500ms poll /api/density ────────── │              │
│  /map        │ ◄── SSE-equivalent fetch loop ──────── │  API routes  │
│  /concierge  │ ──── POST /api/concierge ───────────── │              │
│  /order      │                                         │   globalThis │
└──────────────┘                                         │   singletons │
                                                         │   (crowd,    │
┌──────────────┐                                         │    orders)   │
│   Operator   │ ──── POST /api/simulate ─────────────► │              │
│   /admin     │                                         └──────┬───────┘
└──────────────┘                                                │
                                                                ▼
                                                      ┌──────────────────┐
                                                      │ Google Gemini    │
                                                      │ 1.5 Flash        │
                                                      │ (concierge only) │
                                                      └──────────────────┘
                                                                │
                                                                ▼
                                                      ┌──────────────────┐
                                                      │ Firebase Auth    │
                                                      │ Firestore mirror │
                                                      │ GA4 events       │
                                                      └──────────────────┘
```

Full diagrams and data-flow in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Why this is hard (and what's non-obvious)

Most crowd/routing demos cheat by treating the map as static. StadiumIQ's hard problems — and how we solved them — are in [`docs/TECHNICAL.md`](docs/TECHNICAL.md). Highlights:

- **Serverless cold starts lose in-memory state.** Fixed with `bom1` region pinning + 60s keepalive ping + lazy baseline hydration on every read.
- **Route recomputes must happen client-side** to feel instant, so the whole 40-node graph ships as static JSON and Dijkstra runs in the browser.
- **LLM structured output is unreliable.** We wrap Gemini with `responseMimeType: "application/json"` **plus** a regex-extract-then-Zod-parse fallback, so a single malformed response never breaks the UX.
- **HMR wipes server state.** `globalThis.__stadiumiq_crowd_store` / `__stadiumiq_order_store` survive hot reloads.

---

## The business case

- **TAM:** 2,000+ large venues globally (stadiums, arenas, convention centres, theme parks).
- **Revenue model:** SaaS per venue per season. Operators pay. Fans use it free.
- **Revenue lift for venues:** Shorter queues = more transactions. Mock dashboard shows **38% avg wait reduction** translating into measurable per-cap revenue increases.
- **Moat:** Two-sided network — fans bring data, venues bring deployment scale. CV-camera integration roadmap creates a 12-month lead over any competitor.

Full market analysis and pitch in [`docs/PITCH.md`](docs/PITCH.md).

---

## Tech stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 App Router + TS strict | Server components = tiny bundles, route handlers = zero-config API |
| Styling | Tailwind + shadcn/ui + Framer Motion | Design-token discipline, production-grade micro-interactions |
| LLM | Google Gemini `gemini-2.0-flash` | Native JSON mode, generous free tier, 1M-token context |
| Auth | Firebase Auth (anonymous) | Zero-friction fan onboarding, identity survives refresh |
| Mirror store | Firestore (`orders`, `concierge_queries`) | Fire-and-forget secondary writes for analytics + recovery |
| Analytics | Google Analytics 4 + Firebase Analytics | Real product telemetry (`app_open`, `concierge_query`, `order_placed`) |
| Validation | Zod at every boundary | Single source of truth for schemas + inferred TS types |
| Deployment | Vercel (`bom1`) | Edge-adjacent, zero-config, free |
| Maps | Hand-traced SVG | No map-tile deps, infinite zoom, brand-native |
| Realtime | `globalThis` singleton + 500ms poll | Works on Vercel serverless without Durable Objects / Firestore |

Full conventions in [`CLAUDE.md`](CLAUDE.md).

---

## Google Cloud services used

StadiumIQ is deliberately built on the Google stack end-to-end. Every box in the diagram below is a live, wired dependency — not a roadmap claim.

| Google service | SKU | What it does in StadiumIQ | Where it lives |
|---|---|---|---|
| **Gemini API** | `gemini-2.0-flash` (Generative Language API) | Powers the AI concierge with structured JSON output (`responseMimeType: "application/json"`) | `lib/gemini/client.ts`, `app/api/concierge/route.ts` |
| **Firebase Authentication** | Anonymous sign-in | Stable `uid` per device without any friction; survives refresh and drives Firestore ownership rules | `lib/firebase/client.ts`, `hooks/useAuthUid.ts` |
| **Cloud Firestore** | Native mode | Mirrors every placed order and concierge query for analytics + recovery; `firestore.rules` pins reads/writes to `request.auth.uid` | `lib/firebase/orders.ts`, `lib/firebase/concierge.ts`, `firestore.rules` |
| **Firebase Analytics + GA4** | Standard | Emits `app_open`, `concierge_query`, `order_placed`, `route_drawn` events for real product telemetry | `lib/firebase/analytics.ts` |
| **Firebase Installations** | Standard | Backs FCM registration + analytics client IDs | implicit via `firebase` SDK |
| **Identity Toolkit** | Standard | Backing API for anonymous auth tokens | implicit via `firebase/auth` |
| **Secure Token Service** | Standard | Rotates short-lived ID tokens used by Firestore rules | implicit via `firebase/auth` |

**Why Google-native, not just a convenience choice:**
- **Latency:** Gemini 2.0 Flash is sub-second for our typical prompts (≤1.5 KB context), and Firestore listeners beat any round-trip-to-Postgres architecture for the 500 ms heatmap update budget.
- **Security posture:** `firestore.rules` enforces per-user ownership server-side — we never trust the client to scope queries. See [`firestore.rules`](firestore.rules) for the full policy.
- **Observability:** GA4 + Firebase Analytics give the operator dashboard real numbers (not Postgres counters we had to hand-roll). Events land in BigQuery if the venue wants deeper analysis.
- **CSP discipline:** `next.config.mjs` allowlists exactly the Google origins we call (`generativelanguage.googleapis.com`, `firestore.googleapis.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firebaseinstallations.googleapis.com`, `google-analytics.com`) — nothing more.

Full mapping of challenge requirements → features → Google services in [`docs/ALIGNMENT.md`](docs/ALIGNMENT.md).

---

## Local setup

```bash
git clone https://github.com/harsh8968/StadiumIQ.git
cd StadiumIQ
npm install
cp .env.local.example .env.local
# Then edit .env.local with your Google service keys (see below)
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). The app runs in mock mode for crowd density, but the concierge and telemetry layers call real Google services.

- Get a free **Gemini** API key at [aistudio.google.com](https://aistudio.google.com/apikey)
- Create a **Firebase** project at [console.firebase.google.com](https://console.firebase.google.com) and enable Anonymous Auth + Firestore
- Create a **GA4** property at [analytics.google.com](https://analytics.google.com) and copy the Measurement ID

## Environment variables

```env
NEXT_PUBLIC_MOCK_MODE=true                          # Required for demo
GEMINI_API_KEY=AIza...                              # Required for /concierge
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...                # Firebase web config
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<proj>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<proj>
NEXT_PUBLIC_FIREBASE_APP_ID=1:...:web:...
NEXT_PUBLIC_GA_ID=G-XXXXXXXX                        # Google Analytics 4
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Commands

```bash
npm run dev          # Dev server :3000
npm run build        # Production build
npm run typecheck    # tsc --noEmit (must pass clean)
npm run lint         # ESLint
```

---

## Project structure

```
app/
  (public)/page.tsx              Landing
  (app)/map/                     Heatmap + routing
  (app)/concierge/               AI chat
  (app)/order/                   Virtual queue
  (app)/analytics/               Operator dashboard
  admin/                         Demo control panel
  api/
    concierge/route.ts           Gemini proxy + Zod
    simulate/route.ts            Match-event trigger
    order/route.ts               Order CRUD
    density/route.ts             Live crowd state
components/
  map/                           SVG + POI + route overlay
  shared/                        KeepaliveBoot, MockSimulationBoot, FirebaseBoot
  ui/                            shadcn primitives
lib/
  routing/                       Dijkstra + graph parser
  mock/                          Timeline, menus, store
  data/                          Abstraction layer (mock ↔ Firestore)
  schemas/                       Zod schemas
  gemini/                        Google Gemini client wrapper
  firebase/                      Client, Auth, Firestore mirror, Analytics
public/venue/
  floor-plan.svg                 Hand-traced venue
  pois.json                      15 POIs
  graph.json                     40-node routing graph
docs/
  ARCHITECTURE.md                System diagrams + data flow
  TECHNICAL.md                   Deep-dive on the hard parts
  PITCH.md                       Business case
  DEMO_SCRIPT.md                 3-minute timed run-through
  DEMO_CHECKLIST.md              Pre-demo smoke tests
```

---

## Roadmap (verbal-in-demo, not built)

- **Real CV crowd counting** from venue IP cameras via YOLOv8 + DeepSORT.
- **Ticketing integrations** (Ticketmaster, SeatGeek) for seat-aware routing.
- **Accessibility modes** — wheelchair routing, low-sensory routing.
- **Dynamic concession pricing** during low-demand windows.
- **Sponsorship surfaces** — "Nike popup, 2 minutes away."
- **Multi-venue operator platform.**

---

## License

MIT — see [LICENSE](LICENSE).

---

Built in 48 hours. Built to win.
