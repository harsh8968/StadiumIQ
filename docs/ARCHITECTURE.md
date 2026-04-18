# StadiumIQ — Architecture

> System-level diagrams, data flow, and component responsibilities.
> Read [`TECHNICAL.md`](TECHNICAL.md) for deep-dives on the hard problems.

---

## High-level system

```mermaid
flowchart LR
  subgraph Client["Client (PWA, Next 14)"]
    Map["/map (heatmap + route)"]
    Concierge["/concierge (AI chat)"]
    Order["/order (virtual queue)"]
    Analytics["/analytics (ops KPIs)"]
    Admin["/admin (demo sim)"]
    KB["KeepaliveBoot (60s)"]
    MSB["MockSimulationBoot (3s tick)"]
  end

  subgraph Edge["Vercel Edge (bom1)"]
    APIDensity["/api/density"]
    APIConcierge["/api/concierge"]
    APIOrder["/api/order"]
    APISimulate["/api/simulate"]
    APIAnalytics["/api/analytics"]
    APIClock["/api/clock"]
  end

  subgraph Memory["Server memory (globalThis)"]
    CrowdStore["__stadiumiq_crowd_store"]
    OrderStore["__stadiumiq_order_store"]
  end

  subgraph External["External"]
    Groq["Groq Llama 3.3 70B"]
  end

  Map -- "poll 500ms" --> APIDensity
  Concierge -- "POST" --> APIConcierge
  Order -- "POST / poll 500ms" --> APIOrder
  Admin -- "POST" --> APISimulate
  Analytics -- "poll 3s" --> APIAnalytics
  KB -- "HEAD 60s keepalive" --> APIDensity

  APIDensity --> CrowdStore
  APIOrder --> OrderStore
  APIAnalytics --> CrowdStore
  APISimulate --> CrowdStore
  APIConcierge --> CrowdStore
  APIConcierge --> Groq
```

---

## Request flow: admin event → every client sees heatmap change

```mermaid
sequenceDiagram
  participant Admin as /admin (operator tab)
  participant API as /api/simulate
  participant Store as globalThis.crowd_store
  participant Client as /map (fan tab)

  Admin->>API: POST { event: "halftime_rush" }
  API->>Store: mutateAll(densityFor(matchTime, poiType))
  API-->>Admin: 200 OK

  Client->>API: GET /api/density (poll, 500ms interval)
  API->>Store: getAll()
  Store-->>API: { "food-beer": 0.92, ... }
  API-->>Client: 200 { densities }
  Client->>Client: motion.circle animate fill (easeOut, 400ms)
```

**Total time from admin click to color change on every open client: ≤500ms poll interval + ~50ms API latency + 400ms animation = ≤1s worst case.** The spec requires 2s. We comfortably beat it.

---

## Routing pipeline

```mermaid
flowchart TD
  Start["User taps POI → 'Navigate here'"] --> Load["Load graph.json (memoized)"]
  Load --> Weights["Compute edge weights<br/>w = base × (1 + 2.0 × max(density))"]
  Weights --> Dijkstra["Dijkstra from n-seat to POI node"]
  Dijkstra --> Path["Path: [n-seat, c-i-3, c-o-2, n-food-burger]"]
  Path --> Render["RouteOverlay: motion.polyline pathLength 0→1"]
  Render --> ETA["ETA = round(totalWeight / 12 / 5) × 5"]
  ETA --> Sheet["Bottom sheet shows ETA + 'Clear route'"]

  subgraph "re-runs on every density tick"
    Weights
    Dijkstra
  end
```

All routing runs **client-side** — the full 40-node graph ships as static JSON (`public/venue/graph.json`, ~3KB gzipped). No server round-trip per recompute.

---

## AI concierge pipeline

```mermaid
sequenceDiagram
  participant UI as /concierge
  participant API as /api/concierge
  participant Builder as systemPromptBuilder
  participant Groq as Groq Llama 3.3 70B
  participant Zod as ConciergeResponseSchema

  UI->>API: POST { messages, userLocation }
  API->>API: Validate request w/ Zod
  API->>Builder: Build system prompt w/ live state
  Note over Builder: Injects: all POIs, current densities, wait estimates, user nodeId
  API->>Groq: chat.completions.create({ model, messages })
  Groq-->>API: Raw text response

  API->>API: Extract first /\{[\s\S]*\}/ match
  API->>Zod: parse(JSON.parse(match))
  alt parse success
    Zod-->>API: ConciergeResponse
    API-->>UI: 200 { reply, recommendation, action }
  else parse failure
    API->>API: Log error
    API-->>UI: 200 { reply: fallback, recommendation: null, action: "info" }
  end
  UI->>UI: Append assistant msg (serialized JSON) to history
```

**Why two layers of defense (regex + Zod):** models occasionally wrap JSON in markdown fences (`\`\`\`json`), trailing prose, or leading explanations. The regex strips the wrapper. Zod enforces the contract. If either fails, the UI still gets a friendly message — never a 500.

---

## Data-layer abstraction

Components/hooks never import `/lib/mock/*` or `/lib/firebase/*` directly. They go through `/lib/data/*`:

```mermaid
flowchart LR
  Component["useCrowdDensity hook"] --> Data["/lib/data/crowd.ts"]
  Data -->|NEXT_PUBLIC_MOCK_MODE=true| Mock["/lib/mock/store.ts"]
  Data -->|NEXT_PUBLIC_MOCK_MODE=false| FB["/lib/firebase/crowd.ts<br/>(throws 'not implemented')"]
  Mock --> Store["globalThis.__stadiumiq_crowd_store"]
```

This lets us ship the demo 100% on mock data, and later swap in Firestore without touching a single component. Every data function has the same signature in both branches — the branch is chosen at call-time by the env flag.

---

## State persistence across cold starts

Serverless functions on Vercel cold-start frequently. In-memory state dies between invocations. Three defenses:

```mermaid
flowchart TD
  Cold["Cold-start on /api/density"] --> Check{"globalThis.crowd_store exists?"}
  Check -->|No| Init["Initialize empty Map"]
  Check -->|Yes| Use["Reuse existing"]
  Init --> Seed["seedBaseline(): for each POI, density = densityFor(0, type)"]
  Use --> Read["Read latest densities"]
  Seed --> Read
  Read --> Return["Return to client"]

  Keepalive["KeepaliveBoot on every client"] -.->|HEAD /api/density every 60s| Cold
  Region["vercel.json regions: bom1"] -.->|pin to Mumbai| Cold
```

1. **Region pin** (`vercel.json`): Every client in India hits the `bom1` region, so we never warm two lambdas in parallel.
2. **KeepaliveBoot**: Production-only `useEffect` that HEAD-pings `/api/density` every 60s. Keeps the lambda warm during the demo window.
3. **Lazy baseline hydration**: First read after cold start seeds every POI to its pre-game baseline density via `densityFor(matchTime=0, poiType)`. No empty-map flash.

---

## Key invariants

| Invariant | Where enforced |
|---|---|
| All POI coords in `1000 × 600` SVG viewBox | `public/venue/pois.json` + `VenueHeatmap` viewBox |
| All routes start at `n-seat` (user seat) | `/lib/routing/index.ts` dijkstra entry point |
| Edge weight penalty cap = 2.0 | `CROWD_PENALTY_MAX` in `/lib/constants.ts` |
| ETA rounded to 5-sec increments | `ROUTING_ETA_ROUND_TO_SEC` in `/lib/constants.ts` |
| Every API input validated via Zod | `/lib/schemas/*.ts` inferred in every route handler |
| Concierge never returns raw LLM text to UI | `structuredChat()` re-raises on parse fail → route catches → friendly fallback |
| Order state machine one-way | `placed → preparing → ready → collected`, `advance()` is a no-op if `collected` |
| Mock store survives HMR | `globalThis._stadiumiq_mock_store` |

---

## Directory responsibilities

| Directory | Owns |
|---|---|
| `/app/(public)` | Landing page — no auth, hero + CTAs |
| `/app/(app)` | Main fan PWA — shares `AppShell` layout |
| `/app/admin` | Demo control plane — intentionally unlinked |
| `/app/api` | Route handlers — all Zod-validated |
| `/components/map` | SVG venue, POI circles, route overlay, bottom sheet |
| `/components/shared` | KeepaliveBoot, MockSimulationBoot, nav, toasts |
| `/components/ui` | shadcn primitives — no business logic |
| `/lib/routing` | Dijkstra + graph parser (memoized) |
| `/lib/mock` | Match timeline, menus, store, wait-time estimator |
| `/lib/data` | Abstraction layer — components go through here |
| `/lib/schemas` | Zod schemas — single source of truth |
| `/lib/claude` | Groq client wrapper + structured output |
| `/lib/constants.ts` | All magic numbers — thresholds, speeds, penalties |
| `/public/venue` | Static SVG + POI + graph JSON |
| `/docs` | Architecture, technical, pitch, demo |

---

## Deployment topology

```mermaid
flowchart LR
  subgraph "GitHub"
    Repo["harsh8968/StadiumIQ"]
  end

  subgraph "Vercel"
    Prod["Production (bom1)"]
    Preview["Preview deploys per PR"]
  end

  subgraph "Env"
    EnvProd["Production env:<br/>GROQ_API_KEY<br/>NEXT_PUBLIC_MOCK_MODE=true<br/>NEXT_PUBLIC_BASE_URL"]
  end

  Repo -->|push master| Prod
  Repo -->|push PR| Preview
  EnvProd --> Prod
```

Function config from `vercel.json`:

- `regions: ["bom1"]` — Mumbai edge.
- All 7 API routes have `maxDuration: 30s` — concierge needs it for first-token latency on cold start.

---

For **why** each of these choices was made (alternatives considered, trade-offs, cost model), see [`TECHNICAL.md`](TECHNICAL.md).
