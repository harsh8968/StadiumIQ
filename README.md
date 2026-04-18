# StadiumIQ

> **The AI copilot for every seat in the house.**
> Live crowd intelligence, crowd-weighted routing, virtual concession queues, and an AI concierge — a mobile PWA that turns any sporting venue into a frictionless experience.

**Live demo:** [stadium-iq-phi.vercel.app](https://stadium-iq-phi.vercel.app)
**Stack:** Next.js 14 · TypeScript (strict) · Tailwind · Framer Motion · Groq Llama 3.3 70B · Zod · Vercel
**Status:** Hackathon build — production-deployed, mock-driven for demo, ready to swap in real Firestore + CV signals.

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

Chat UI wired to a Groq `llama-3.3-70b-versatile` backend. Every request injects **the current live venue state** (all POI densities + user location + estimated wait times) into the system prompt, then forces a structured response via Zod schema:

```ts
const ConciergeResponseSchema = z.object({
  reply: z.string(),
  recommendation: ConciergeRecommendationSchema.nullable(),
  action: z.enum(["navigate", "order", "info"]),
});
```

If the model returns invalid JSON, we extract the first `{...}` block with a tolerant regex and re-parse. If *that* fails, we surface a friendly fallback — **never raw LLM text to the UI.** Assistant messages are stored as serialized JSON so the model sees its own prior structured responses in context.

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
                                                      │ Groq Llama 3.3   │
                                                      │ 70B Versatile    │
                                                      │ (concierge only) │
                                                      └──────────────────┘
```

Full diagrams and data-flow in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Why this is hard (and what's non-obvious)

Most crowd/routing demos cheat by treating the map as static. StadiumIQ's hard problems — and how we solved them — are in [`docs/TECHNICAL.md`](docs/TECHNICAL.md). Highlights:

- **Serverless cold starts lose in-memory state.** Fixed with `bom1` region pinning + 60s keepalive ping + lazy baseline hydration on every read.
- **Route recomputes must happen client-side** to feel instant, so the whole 40-node graph ships as static JSON and Dijkstra runs in the browser.
- **LLM structured output is unreliable.** We wrap Groq with a regex-extract-then-Zod-parse pipeline so a single malformed response never breaks the UX.
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
| LLM | Groq `llama-3.3-70b-versatile` | Sub-second inference, free tier, no credit card needed |
| Validation | Zod at every boundary | Single source of truth for schemas + inferred TS types |
| Deployment | Vercel (`bom1`) | Edge-adjacent, zero-config, free |
| Maps | Hand-traced SVG | No map-tile deps, infinite zoom, brand-native |
| Realtime | `globalThis` singleton + 500ms poll | Works on Vercel serverless without Durable Objects / Firestore |

Full conventions in [`CLAUDE.md`](CLAUDE.md).

---

## Local setup

```bash
git clone https://github.com/harsh8968/StadiumIQ.git
cd StadiumIQ
npm install
cp .env.production.example .env.local
# Then edit .env.local and paste your Groq key
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). The app runs entirely in mock mode — no Firebase, no external deps except the concierge's Groq key.

Get a free Groq API key at [console.groq.com](https://console.groq.com) (no credit card required).

## Environment variables

```env
NEXT_PUBLIC_MOCK_MODE=true              # Required for demo
GROQ_API_KEY=gsk_...                    # Required for /concierge
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
    concierge/route.ts           Groq proxy + Zod
    simulate/route.ts            Match-event trigger
    order/route.ts               Order CRUD
    density/route.ts             Live crowd state
components/
  map/                           SVG + POI + route overlay
  shared/                        KeepaliveBoot, MockSimulationBoot
  ui/                            shadcn primitives
lib/
  routing/                       Dijkstra + graph parser
  mock/                          Timeline, menus, store
  data/                          Abstraction layer (mock ↔ Firestore)
  schemas/                       Zod schemas
  claude/                        Groq client wrapper
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
