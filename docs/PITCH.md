# StadiumIQ — Business Case & Pitch

> Written for an investor or hackathon judge reading in 5 minutes.

---

## 1. The problem in one paragraph

Live sporting events generate $75B+/yr globally in ticket revenue, but the in-venue experience is broken. The average fan at a 3-hour event spends **23 minutes standing in lines** — food, restrooms, merch, gates. Venues lose per-cap revenue to abandoned orders. Fans miss the game they paid to see. Today's "solutions" — static signage, PA announcements, venue apps with last-year's seat map — don't solve it because they're not real-time.

---

## 2. The insight

**Every venue already has the data.** Existing IP camera infrastructure (deployed for security) sees every corridor, every queue, every gate. The missing layer is the *intelligence* on top: a platform that turns those camera feeds into live density, feeds that into routing + ordering + concierge, and delivers the answer to the fan's phone in under a second.

StadiumIQ is that intelligence layer.

---

## 3. The product (two-sided)

### For fans: free mobile PWA

- Live heatmap of every POI in the venue
- AI concierge that answers natural-language questions over live data
- Skip-the-line concession ordering with pickup codes
- Crowd-avoiding routes from your seat to anywhere
- Group coordination (shared pins, meetup suggestions)

### For venues: B2B SaaS dashboard

- Real-time bottleneck detection (which POI is driving wait-time complaints *right now*)
- Revenue-lift analytics (avg ticket size, per-cap concession spend, trend vs. baseline)
- Operator controls (trigger push notifications during unexpected events)
- Fan NPS proxy (sentiment + return-session rate)
- Per-season export for strategic planning

---

## 4. Why now

| Trend | Effect |
|---|---|
| Sub-$0.001-per-call LLM inference (Groq, Cerebras, Bedrock) | Per-fan concierge cost <$0.01 per game |
| PWA adoption post-iOS 16.4 | No App Store friction; 2x faster deployment |
| Post-pandemic venue ops investment | Venues actively looking for operational efficiency tooling |
| Stadium CV already exists | Zero new hardware required — pure software layer |
| Sports betting legalization (US, India) | Venues incentivized to maximize fan in-seat time |

---

## 5. Market size

### TAM (global, large-capacity venues)

| Segment | Venues | Notes |
|---|---|---|
| Top-tier football/soccer stadiums | 300+ | EPL, La Liga, Bundesliga, ISL, J-League |
| MLB / NFL / NBA / NHL arenas | 150 | US-only |
| Cricket stadiums | 100+ | India, Australia, UK, SA, NZ, WI |
| Arenas / e-sports venues | 500+ | Global |
| Convention centres | 800+ | Global |
| Theme parks / festival grounds | 200+ | High-seasonality, high ARPU |
| **Total addressable venues** | **~2,050** | |

### Revenue model

**SaaS per venue per season:**
- Tier 1 (stadiums >40k capacity): **$120,000 / season**
- Tier 2 (arenas 10–40k capacity): **$45,000 / season**
- Tier 3 (convention / small): **$18,000 / season**

**Blended ARPU** at 30% market penetration: ~$47,000 / venue / year.
**TAM at steady state:** 2,050 venues × $47k = **$96M ARR.**

### Bottoms-up SAM (first 3 years)

- Year 1: 5 pilot venues in South Asia (India + SEA), $100k ARR.
- Year 2: 40 venues across SA + ME + SEA, $1.5M ARR.
- Year 3: 150 venues globally, $7M ARR.

---

## 6. Competitive landscape

| Player | What they do | Why we win |
|---|---|---|
| **Venue's own app** | Static seat map, ticket barcode | No real-time, no AI concierge, no crowd routing |
| **Mobile ordering** (Aramark, Appetize) | Concession ordering only | Single feature, no platform, no B2B analytics surface |
| **Seat upgrades** (StubHub, Seat Geek) | Post-ticket upsell | Pre-event only, no in-venue loop |
| **Smart stadium** platforms (Cisco, IBM) | Infrastructure-level analytics | Not fan-facing, no AI, enterprise sales cycle |
| **Google Maps / Apple Maps** | Outdoor routing | Has no idea there's a line at gate 4 |

**Our moat:**
1. Two-sided network. Fans bring engagement data; venues bring deployment. Flywheel compounds.
2. CV roadmap — real camera integration → 12-month lead on anyone without CV.
3. AI-native architecture — retrofitting AI into existing venue apps is expensive; our stack is built around it.

---

## 7. Traction plan (90 days post-hackathon)

| Week | Milestone |
|---|---|
| 1–2 | Pilot outreach: 10 tier-1 Indian stadiums (DY Patil, Wankhede, Eden Gardens, Chinnaswamy) |
| 3–4 | Signed LOI with 1 pilot; venue walk-through; CV integration plan |
| 5–8 | Real CV pipeline (YOLOv8 crowd counting), seat-aware routing (ticket API) |
| 9–10 | First live match deployment (friendly match, limited audience) |
| 11–12 | Post-mortem + case study + tier-1 outreach with real data |
| 13 | Second pilot signed |

---

## 8. Team fit

- Full-stack engineer with shipping experience (this hackathon submission is the proof).
- Pragmatic stack choices — boring tech in the core, new tech only where it earns its keep.
- Speed-to-demo discipline — this entire app was built and deployed in 48 hours.

---

## 9. What we're asking for

**From a hackathon judge:**
- Recognition that this is a real, deployed, two-sided product — not a prototype video.
- Feedback on the go-to-market assumption (pilot stadium vs. convention centre first).

**From an early investor:**
- $250k angel / pre-seed to fund 3 pilots + first CV engineer hire.
- 18-month runway to 10 paying venues + Series A metrics.

---

## 10. Roadmap preview (2–3 year horizon)

| Horizon | Build |
|---|---|
| 0–3 mo | Real CV crowd counting, first pilot, sponsor surfaces |
| 3–6 mo | Ticketmaster / SeatGeek integrations, seat-aware nav |
| 6–12 mo | Accessibility routing (wheelchair, low-sensory), dynamic pricing |
| 12–18 mo | Multi-venue operator platform, multi-event itineraries |
| 18–36 mo | White-label offering for regional sports leagues, international expansion |

---

## 11. The one-line pitch

**StadiumIQ is the AI copilot for every seat in the house — turning existing venue infrastructure into real-time fan intelligence that pays for itself in per-cap revenue lift.**
