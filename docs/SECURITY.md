# Security

This is not a production security posture yet — it's a 48-hour hackathon build. But the threat model below is honest, and every mitigation listed has code behind it, not just intent.

---

## Threat model

StadiumIQ is a public-facing PWA. The attackers we care about during a live venue deployment:

1. **Script kiddie / curious attendee** — opens DevTools, pokes at `/api/*`, tries to break the heatmap for everyone.
2. **Competitor scraper** — hammers `/api/density` or `/api/concierge` to harvest venue telemetry or drain LLM quota.
3. **Concession fraud** — forges or replays order requests to get free food, or exhausts pickup codes.
4. **Prompt injector** — crafts a concierge question to leak the system prompt, exfiltrate other users' data, or get the LLM to produce offensive output.
5. **Prompt-injection-from-data** — content that the LLM *reads* (POI names, density labels, other users' chat context) tries to override its instructions.

Out of scope for demo: nation-state adversaries, physical venue security, payment fraud (payments are mocked), social engineering of venue staff.

---

## Mitigations in code

### 1. Input validation at every boundary

Every `/api/*` route validates its body with a Zod schema declared in `/lib/schemas/`. Examples:

- `PlaceOrderRequestSchema` caps `items.length ≤ 20`, per-line `qty ≤ 20`, and `poiId.length ≤ 64`. An oversize cart returns 400 before the handler runs.
- `ConciergeRequestSchema` caps message count + per-message length so a single request can't blow up the prompt budget.
- `SimulateRequestSchema` whitelists event names — unknown events return 400 with Zod's flatten output.

Zod failures never leak server internals; the API returns a generic `{ error: "Invalid request body" }`.

### 2. Rate limiting

`/lib/security/rateLimit.ts` is a sliding-window limiter keyed by `x-forwarded-for` (Vercel sets this). It runs out of a `globalThis` singleton so it survives HMR + warm Lambdas. Per-route budgets:

| Route | Max | Window | Rationale |
|---|---|---|---|
| `/api/concierge` | 20 / IP | 60 s | LLM quota + cost protection |
| `/api/order` | 10 / (IP + userId) | 60 s | Concession fraud / pickup code exhaustion |
| `/api/simulate` | 30 / IP | 60 s | Demo-mode button spam |

Exceeding the budget returns `429` with `Retry-After` and `X-RateLimit-Remaining` headers. Not a replacement for Upstash/Redis at fleet scale — documented as a Tier A production follow-up.

### 3. Error sanitization

`/lib/security/errorSanitizer.ts` wraps every caught exception with a generic client message and server-side `console.error` log. We never return `error.message`, `error.stack`, or internal request paths to the browser — those leak library internals and sometimes echoed secrets.

All three write endpoints (`/api/order`, `/api/simulate`, `/api/concierge`) are wrapped in try/catch feeding into `sanitizedErrorResponse`.

### 4. X-User-Id header convention

`/api/order` requires a client-generated UUID in an `X-User-Id` header (never in the body). The header is created once per device via `getOrCreateUserId()` in `localStorage`. This is not authentication — it's a client identity hint that lets the server scope orders and rate limits per-device even when anonymous.

The production Firestore rules file (`firestore.rules`) enforces the actual ownership check via `request.auth.uid` — the header is just the mock-mode equivalent.

### 5. Firestore security rules

`firestore.rules` (shipped in the repo, applied via `firebase deploy --only firestore:rules` in production) scopes access by collection:

- `/crowd_density/{doc}` — read-all, write-server-only (service account).
- `/orders/{doc}` — owner-only read/write via `request.auth.uid == resource.data.userId`, plus a 20-item whitelist and state-machine enforcement.
- `/group_sessions/{doc}` — signed-in only.
- `/analytics_events` — write-only (no client reads).
- Catch-all: deny.

### 6. LLM safety

Concierge prompts:

- The **system prompt** explicitly constrains the model to answering about stadium navigation only and to output JSON matching a fixed schema.
- The **response is Zod-validated** (`ConciergeResponseSchema`) before it ever reaches the client. Malformed JSON, unknown `poiId`, or wrong-shape `action` all fall through to the deterministic heuristic reply.
- The heuristic fallback (`lib/concierge/heuristic.ts`) is called on *any* LLM failure — quota, network, malformed JSON, prompt-injection artifacts. Users never see raw model output.
- Chat history sent back into the LLM contains only the assistant's previously-serialized `ConciergeResponse` JSON blobs — not free-form text — so a prior injection can't bootstrap further state.
- **PoI names are treated as data**, not instructions. We never template them into instruction-bearing positions in the prompt; they appear only in a JSON-shaped venue snapshot the LLM reads.

### 7. Secrets management

- `ANTHROPIC_API_KEY` (and Gemini/Firebase secrets) live in Vercel's Production scope. Never checked into Git.
- `.env.local` is gitignored; `.env.local.example` contains only placeholder strings.
- No key is ever echoed back in API responses — the error sanitizer covers this path too.

### 8. Content Security Policy + security headers

Configured in `next.config.ts`:

- `Content-Security-Policy` with `script-src 'self'` + necessary Firebase origins.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (no embedding StadiumIQ inside third-party frames)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — explicit deny for sensors we don't need.

### 9. No PII in analytics

GA4/Firebase Analytics events emit only IDs and density values — never names, locations outside the venue SVG coordinate system, or raw query text. `concierge_query` records `length` and `had_recommendation`, not the content.

---

## What we explicitly did NOT harden

Honest list — each is a "post-demo, pre-GA" item, not a demo-blocker:

- **Per-region edge rate limiter.** In-memory limiter is per-Lambda-instance; a burst distributed across many warm instances could bypass it. Upstash Redis or Vercel KV is the production answer.
- **Web Application Firewall.** No Cloudflare/Vercel WAF rules for common OWASP patterns. Zod catches most, but not all.
- **Audit logs.** Server-side `console.error` breadcrumbs are sufficient for a 48-hour build but don't ship off-box. Production would pipe to a SIEM.
- **Concierge prompt-injection red team.** We rely on the schema + fallback. A real pen-test of the concierge against a jailbreak corpus is on the list.
- **CAPTCHA on `/api/concierge`.** We chose rate limiting over CAPTCHA friction for the demo. A production launch would add Turnstile for abusive IPs.

---

## Reporting

If you find a security issue in this hackathon build, open a private issue with the label `security` or email the team directly. Please don't post exploits publicly.
