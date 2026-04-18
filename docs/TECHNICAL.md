# StadiumIQ — Technical Deep-Dive

> The "why this is hard" document. Every section is a problem we hit and the specific decision we shipped.

---

## 1. Crowd-weighted routing, not straight-line routing

**The naive approach:** ship Leaflet/Mapbox, use Google Directions, call it a day.

**Why it fails for venues:** Google doesn't know there are 500 people queued at the north gate. It will route you straight through the congestion. That's worse than no route at all — it tells the fan *"yes, go stand in that line."*

**What we shipped:** a 40-node graph (`public/venue/graph.json`) with Dijkstra running in the browser, where edge weights are a function of live density:

```ts
// lib/routing/index.ts
function edgeWeight(from: NodeId, to: NodeId, densityMap: DensityMap): number {
  const baseDistance = euclidean(graph.nodes[from], graph.nodes[to]);
  const maxDensity = Math.max(densityMap[from] ?? 0, densityMap[to] ?? 0);
  return baseDistance * (1 + CROWD_PENALTY_MAX * maxDensity);
}
```

With `CROWD_PENALTY_MAX = 2.0`:
- An empty corridor costs `baseDistance × 1.0`
- A half-full corridor costs `baseDistance × 2.0`
- A fully congested corridor costs `baseDistance × 3.0`

The result: when a POI's local corridor turns red, Dijkstra finds the second-best approach — often looping around the inner ring — and the animated route physically curves away from the red blob on the map. That visual **is** the product.

### Why the graph is 40 nodes and not 200

More nodes = more "realistic" routes but also more ways to break. 40 gives us:
- 12 outer corridor ring nodes (`c-o-0`…`c-o-11`)
- 12 inner corridor ring nodes (`c-i-0`…`c-i-11`)
- 1 fixed user seat node (`n-seat` at 560, 215)
- 15 POI nodes

Dijkstra runs in sub-millisecond time on this graph in the browser. Recomputing on every density tick is free.

### Why routing is client-side

Two reasons:
1. **Latency.** Server round-trip = 50–200ms. Client Dijkstra = 0.3ms. The route needs to feel instant.
2. **Bandwidth.** The graph is ~3KB gzipped. Shipping it once and running forever is cheaper than streaming recomputed paths.

---

## 2. LLM structured output reliability

**The problem:** Groq Llama 3.3 70B is fast and cheap, but doesn't support OpenAI-style `response_format: { type: "json_schema" }`. And even models that do support it still occasionally return prose wrapped around JSON, markdown code fences, or truncated blobs.

**What we shipped:** a two-layer extraction + validation pipeline in `/lib/claude/client.ts`:

```ts
const text = response.choices[0]?.message?.content ?? "";
const jsonMatch = text.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  throw new Error("No JSON object found in Groq response");
}
const parsed: unknown = JSON.parse(jsonMatch[0]);
return schema.parse(parsed); // Zod throws on shape mismatch
```

The regex is deliberately greedy (`[\s\S]*`, not `[\s\S]*?`) because the model sometimes nests JSON inside prose on both sides. We want the outermost `{…}` block. Zod then enforces the exact shape we want.

**The UI layer catches the throw** and shows a friendly fallback message. The user never sees a raw error, and never sees raw LLM text leak into the chat.

### System prompt construction

The system prompt is rebuilt every request with live state:

```ts
function buildSystemPrompt(densities: DensityMap, userLocation: UserLocation): string {
  const poiLines = pois.map(p => {
    const d = densities[p.id] ?? 0;
    const wait = estimateWaitSec(d, p.type);
    return `- ${p.id} (${p.name}, ${p.type}): density=${d.toFixed(2)}, wait=${wait}s`;
  }).join("\n");

  return `You are a stadium concierge. User is at node ${userLocation.nodeId}.
Current venue state:
${poiLines}

Respond ONLY with JSON matching: { reply, recommendation, action }
...`;
}
```

This means **the model is reasoning over live data** on every call. It's not keyword matching or template-filling. Ask "shortest beer line right now" and the model sees actual density + wait estimates for every beer-serving POI, then picks the best one with natural-language reasoning.

### Context management

Assistant messages in the history array are stored as **serialized JSON** (the full `ConciergeResponse` object stringified), not just the `.reply` text. This way the model sees its own prior structured recommendations in context, so follow-up questions like "what about the one near the west gate?" can resolve `poiId`s from prior turns.

---

## 3. Serverless cold starts + in-memory state

**The problem:** Vercel serverless functions cold-start often. In-memory state (like a `Map` of POI densities) dies between invocations. Traditional fix: a database. But Firestore is:
- Slow for 500ms polling (read cost × 500ms × 15 POIs × N clients = expensive fast)
- Overkill for a demo that's 100% mock-driven
- Another live dependency that can fail on stage

**What we shipped:** three defenses, layered:

### Defense 1: Region pinning

`vercel.json`:
```json
{ "regions": ["bom1"] }
```

All clients in India → same Mumbai region → fewer lambda instances spawned → higher chance that a warm lambda has the in-memory state from the last invocation.

### Defense 2: KeepaliveBoot

```tsx
// components/shared/KeepaliveBoot.tsx
useEffect(() => {
  if (process.env.NODE_ENV !== "production") return;
  const ping = () => {
    if (document.visibilityState !== "visible") return;
    fetch("/api/density", { method: "HEAD" }).catch(() => {});
  };
  ping();
  const id = setInterval(ping, 60_000);
  return () => clearInterval(id);
}, []);
```

Every fan tab HEAD-pings `/api/density` every 60s. During the demo window, at least one client is always active, so the lambda never cools down below its 5-minute idle threshold.

### Defense 3: Lazy baseline hydration

Even with the above, *some* cold start will happen (e.g., first page load after idle overnight). When it does:

```ts
// lib/mock/store.ts
function seedBaseline(data: DensityMap) {
  for (const poi of rawPois) {
    if (!(poi.id in data)) {
      data[poi.id] = densityFor(0, poi.type);
    }
  }
}

export function getAll(): DensityMap {
  const data = getGlobalStore().data;
  if (Object.keys(data).length === 0) {
    seedBaseline(data);
  }
  return data;
}
```

`densityFor(0, type)` returns the pre-game baseline (e.g., food 0.15, restrooms 0.10, gates 0.05). The first read after a cold start never returns an empty map — it returns a realistic pre-game venue.

**Net result:** the demo never sees a blank heatmap or a "no data" flash, even if Vercel recycles the lambda 10 seconds before the judges arrive.

---

## 4. Mock store + HMR

Next.js hot module replacement wipes all module-level state on every save. A `Map` declared at top-level would lose every admin-triggered density change on the next file save — catastrophic for iterating on the demo.

Fix: `globalThis` singleton.

```ts
// lib/mock/store.ts
declare global {
  // eslint-disable-next-line no-var
  var __stadiumiq_crowd_store: CrowdStore | undefined;
}

function getGlobalStore(): CrowdStore {
  if (!globalThis.__stadiumiq_crowd_store) {
    globalThis.__stadiumiq_crowd_store = {
      data: {},
      listeners: new Set(),
    };
  }
  return globalThis.__stadiumiq_crowd_store;
}
```

`globalThis` survives HMR because it's not in the module graph. Same pattern for `__stadiumiq_order_store`.

---

## 5. Why SVG instead of Leaflet / Mapbox / Google Maps

**The problem with tile maps for stadium interiors:**
- No tile data exists for the inside of most venues.
- Custom tile generation is a week of work for one venue.
- The visual is generic — looks like every Mapbox demo ever.

**What we shipped:** a hand-traced 1000×600 SVG of a generic venue with POI coordinates in `pois.json`. Consequences:

- **Infinite zoom, no tile boundaries.** Pinch-zoom works natively via CSS transform.
- **POI colors animate via `motion.circle`** — Framer Motion interpolates fill hex values. A tile library would force us to ship our own marker layer.
- **Routes are raw `<polyline>`** with `pathLength` 0→1 animation. No geocoding round-trips.
- **Bundle savings:** Leaflet is 40KB+ gzipped. Our SVG is 2KB inline.
- **Brand-native.** The venue can be re-skinned in Figma in 20 minutes.

Trade-off: no GPS location. Acceptable because StadiumIQ's use case is *inside* a venue where GPS is unreliable anyway. Real deployment would use beacon triangulation + seat-assignment from ticket data.

---

## 6. Order state machine + optimistic UX

Order state: `placed → preparing → ready → collected`. One-way transitions.

**The UX challenge:** the fan places an order, the pickup code shows up instantly, and the state needs to visibly progress over time *without* the fan having to refresh. At the same time, the admin panel must be able to advance state.

**What we shipped:** poll-based state sync with a server-side singleton:

```ts
// /lib/data/orders.ts
export function subscribeToOrder(orderId: string, cb: (order: Order) => void): () => void {
  const poll = async () => {
    const res = await fetch(`/api/order?id=${orderId}`);
    const order = await res.json();
    cb(order);
  };
  poll();
  const id = setInterval(poll, 500);
  return () => clearInterval(id);
}
```

500ms polling is "good enough realtime" for the demo — and cheaper than websockets on Vercel. Order `Map` lives in `globalThis.__stadiumiq_order_store`. When admin clicks "Advance", the server mutates the map and the next poll from the fan's order page picks up the new state → toast fires on `ready`.

---

## 7. User identity without auth

**The problem:** orders need to be attributable to a specific fan so the admin can route state changes correctly. But we have no auth.

**What we shipped:** UUID in localStorage, passed as header.

```ts
// /lib/user/identity.ts
export function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("stadiumiq:userId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("stadiumiq:userId", id);
  }
  return id;
}
```

Every `/api/order` fetch sends `X-User-Id: <uuid>`. Never in the request body (keeps body schema clean). The server reads it via `request.headers.get("X-User-Id")`.

This lets the concierge know "which orders are mine?" without auth. For real deployment, swap this for Firebase Auth anon → Google sign-in upgrade path.

---

## 8. Deep-links between concierge and map

When the concierge recommends "Beer Garden" and the user taps "Take me there":

```ts
router.push(`/map?nav=${recommendation.poiId}`);
```

The `/map` page reads `useSearchParams()` on mount:

```ts
const navTarget = useSearchParams().get("nav");
useEffect(() => {
  if (navTarget) {
    setNavTarget(navTarget); // triggers route computation + overlay
  }
}, [navTarget]);
```

"Clear route" calls `router.replace("/map")` to drop the param. The URL is the state — reload-safe, shareable, back-button-safe.

---

## 9. Density polling: why 500ms and not WebSockets

WebSockets on Vercel require either Edge runtime (limited feature set) or an external Durable Object / Pusher / Ably. All add cost + dependency.

500ms polling:
- 2 requests/second × 15 bytes/POI × 15 POIs = ~450 bytes/second
- Vercel free tier handles this for thousands of concurrent clients
- Latency = ≤500ms worst case — well within the 2-second demo spec
- No extra dep, no auth handshake, no fallback complexity

Trade-off: doesn't scale to millions of clients. For that scale we'd switch to a pub/sub fanout (Pusher / Ably / Firestore real-time listeners). Explicit roadmap item.

---

## 10. The admin panel as a first-class product surface

**Most hackathon demos hide their control plane.** They hard-code the demo state, so the judge's question "what if I click X?" breaks the whole thing.

StadiumIQ's `/admin` is the opposite: it's the real-time simulator. Every crowd event is a real code path — not a hard-coded animation. Judges can click "Halftime rush" at any time, in any sequence, and the system responds. This makes the demo **unbreakable** under adversarial inspection.

The admin is also how the product will actually work at scale: operator staff use this dashboard to manually trigger messaging during unexpected events (medical emergencies, weather, VIP arrivals). We'll layer CV automation on top, but the manual control always stays.

---

## 11. Bundle discipline

We ship only what we use. Key numbers (from Vercel build log):

- **First Load JS for `/map`:** 95KB gzipped
- **First Load JS for `/concierge`:** 88KB gzipped
- **Lighthouse Performance (mobile, throttled 4G):** 85+

Enforced by:
- Server components by default — `"use client"` only where strictly needed.
- `lucide-react` tree-shakes per icon; no barrel imports.
- `framer-motion` lazy-loads on routes that use it.
- No moment.js, no lodash, no jQuery.

---

## 12. Error boundaries on every layout

`app/(app)/error.tsx` and `app/(public)/error.tsx` are on-brand fallback UIs. If any child crashes, the fan sees a branded "something went wrong" card with a retry button — never a raw Next.js error page.

---

## Summary of trade-offs

| Decision | Cost | Benefit |
|---|---|---|
| Hand-traced SVG instead of Mapbox | No built-in GPS | Infinite zoom, 2KB, brand-native, no tile deps |
| 500ms polling instead of WebSockets | Doesn't scale to millions | No external dep, free tier, <500ms latency |
| Groq instead of Claude API | No OpenAI-style json_schema | Free tier, sub-second inference, no credit card |
| Client-side Dijkstra | 3KB graph shipped to every client | 0.3ms recomputes, no server round-trip |
| Mock mode as primary demo mode | Firestore branch throws | Zero external deps during pitch |
| globalThis singleton | Breaks if Vercel ever changes runtime | Survives HMR + warm lambda reuse |

Every one of these is reversible for production. Every one is the right call for a 48-hour hackathon demo that has to work on stage with judges in the room.
