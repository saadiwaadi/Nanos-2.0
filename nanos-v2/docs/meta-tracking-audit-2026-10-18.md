# nanos.pk — Full Meta Tracking Audit

**Repository:** `nanos-v2` (git root is the parent folder; all paths below are repo-relative, e.g. `nanos-v2/src/...` = `src/...` inside the project)
**Audit date:** 2026-10-18
**Method:** every claim below is backed by a file:line reference, a git commit, a live HTTP response, or a DB query run during this audit. Anything I could not verify is labelled explicitly in Part 8.

**Data sources used**

| Source | Command / artifact |
|---|---|
| Source code | `nanos-v2/src/**`, `nanos-v2/scripts/**`, `nanos-v2/scratch/**`, `nanos-v2/pixel-events-e2e.mjs`, `Nanos/nanos-pk/**` (legacy workspace) |
| Git history | `git log --format="%h %ad %s" --date=iso`, `git show <commit>`, `git log -p -- <path>` |
| Local exports | `nanos-v2/exports/orders-2026-10-17.{json,csv}`, `orders-2026-10-18.{json,csv}` |
| Live DB (read-only) | ad-hoc `tsx` Prisma queries over `Order` for 15–18 Oct (script created and deleted during this audit) |
| Live production | `curl -sI https://nanos.pk/`, `curl -sI https://www.nanos.pk/`, and download+decompile of the deployed `/_next/static/chunks/*.js` |
| Meta specification | `https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/fbp-and-fbc` (fetched this session) |

**What is NOT available locally (affects several verdicts):** no Meta Events Manager export, no CAPI response logs, no server access logs, no `_fbc`/event-id column in the DB. Any question that requires "join local orders to Meta events" therefore **cannot** be answered from this machine — see Part 8 for the exact artifacts required.

---

## Part 1 — System Briefing

### 1.1 Tech stack (from the actual files)

| Item | Value | Evidence |
|---|---|---|
| Framework | **Next.js 16.3.8** (App Router, Turbopack build — chunk names like `chunk_turbopack-...`) | `nanos-v2/package.json:16`; `node -e "require('next/package.json').version"` → `16.3.8`; `nanos-v2/package.json:6` (`"dev": "next dev"`) |
| React | 19.2.8 | `nanos-v2/package.json:18-19` |
| ORM | Prisma 6.19.3 (`@prisma/client`, `prisma`) | `nanos-v2/package.json:11,17` |
| DB | PostgreSQL (`DATABASE_URL` + `DIRECT_URL` present in `.env`; schema uses `@default(cuid())`, `Int` money columns) | `.env` key list (`grep -oE '^[A-Z0-9_]+' .env`); `nanos-v2/prisma/schema.prisma:125-171` |
| Hosting target | **Hostinger Node hosting, self-hosted Next.js — NOT Vercel.** Live headers: `platform: hostinger`, `panel: hpanel`, `Server: hcdn`, `x-powered-by: Next.js` | `curl -sI https://nanos.pk/` |
| Package manager | npm (only `package-lock.json`, no pnpm/yarn lock) | `nanos-v2/package-lock.json` exists; no `pnpm-lock.yaml` in `nanos-v2/` (note: the *legacy* `Nanos/nanos-pk` workspace does use pnpm — `Nanos/nanos-pk/package.json:26`) |
| Tracking-relevant deps | **None.** No Meta/TikTok SDK, no GTM, no segment — all integrations are hand-rolled `fetch` + inline `<script>` | `nanos-v2/package.json:10-24` (no tracking packages listed) |
| Script tooling | `tsx` (dev) for DB/key scripts; `dotenv/config` imported by test scripts | `nanos-v2/package.json:24`; `scripts/test-capi-event.ts:1` |

Ambiguity worth stating: production is **Hostinger**, but `nanos-v2/src/app/api/orders/route.ts:27-29` still allow-lists `*.vercel.app` origins in non-production — dead/legacy allowance, not a Vercel deployment.

### 1.2 Every environment variable touching Meta/TikTok tracking

| Variable | Read at | If unset |
|---|---|---|
| `NEXT_PUBLIC_META_PIXEL_ID` | client: `src/lib/fpixel.ts:2`; server: `src/lib/meta-capi.ts:66` | **Browser pixel still fires on the live pixel ID** — `fpixel.ts:1-2` falls back to the hardcoded literal `"969572164409296"`. Server CAPI logs `[Meta CAPI] Missing NEXT_PUBLIC_META_PIXEL_ID or META_CAPI_ACCESS_TOKEN` and returns early (`meta-capi.ts:69-72`). |
| `META_CAPI_ACCESS_TOKEN` | `src/lib/meta-capi.ts:67` | CAPI is silently skipped (`meta-capi.ts:69-72`). No retry, no queue. |
| `META_TEST_EVENT_CODE` | `src/lib/meta-capi.ts:77` (guard), `:160` (payload `test_event_code`) | In non-production the CAPI is **skipped entirely** (`meta-capi.ts:79-85`). Verified unset in the local `.env` (`grep -cE '^META_TEST_EVENT_CODE=.+' .env` → `0`). |
| `META_GRAPH_VERSION` | `src/lib/meta-capi.ts:163` | Defaults to `v22.0`. Not present in `.env`. |
| `NODE_ENV` | `src/lib/meta-capi.ts:79` | Undefined ⇒ treated as non-production ⇒ CAPI skipped unless a test code is present. |
| `NEXT_PUBLIC_TIKTOK_PIXEL_ID_PK` / `_USA` | `src/lib/tiktok-pixel.ts:3-9`; `src/lib/tiktok-events-api.ts:112-124` | USA has a hardcoded fallback `DB8HK0BC77UB6E0EAN70` (`tiktok-pixel.ts:9`), PK falls back to legacy `NEXT_PUBLIC_TIKTOK_PIXEL_ID` (`:5`). |
| `TIKTOK_EVENTS_API_ACCESS_TOKEN_PK/_USA`, `TIKTOK_EVENTS_API_ACCESS_TOKEN`, `TIKTOK_ACCESS_TOKEN` | `src/lib/tiktok-events-api.ts:114,122-124` | Server TikTok events skip (token empty). |
| `TIKTOK_TEST_EVENT_CODE` | `src/lib/tiktok-events-api.ts:187-188` | No test tagging; **note there is no non-production guard for TikTok at all** (contrast with `meta-capi.ts:79`). |

`.env` also contains `POSTEX_*` and auth secrets — unrelated to tracking (`.env` key list).

### 1.3 Every file that imports/calls Meta Pixel or Meta CAPI (complete, including surprises)

Grep basis: `grep -rn -E "fbq\(|MetaCapiService|sendEvent|META_|fbc|fbp|fbclid"` over `src`, `scripts`, `scratch`, root `*.mjs`, excluding `node_modules`/`.next`, plus a separate grep over the legacy workspace `Nanos/nanos-pk`.

**Production code — Meta browser Pixel**

| File:line | Role |
|---|---|
| `src/lib/fpixel.ts:1-2` | Pixel ID + hardcoded fallback |
| `src/lib/fpixel.ts:8-31` | `shouldSuppressPixel(pathname, searchParams)` — suppresses `/admin`, `/login`, `/account`, any path containing `token` |
| `src/lib/fpixel.ts:38-70` | `trackMeta()` — queues/proxies `fbq("track", …, {eventID})` |
| `src/lib/fpixel.ts:73-75` | `pageview()` / `event()` back-compat wrappers |
| `src/components/MetaPixel.tsx:13-19` | client-side `PageView` on route change |
| `src/components/MetaPixel.tsx:28-40` | **advanced matching** `fbq("init", META_PIXEL_ID, {em, ph})` for logged-in users |
| `src/components/MetaPixel.tsx:42-75` | inline `fbevents.js` loader, `fbq('init')`, `fbq('set','autoConfig',false)`, `<noscript>` img beacon |
| `src/app/layout.tsx:11,41` | mounts `<MetaPixel />` globally |
| `src/components/PdpActions.tsx:112-128` | `ViewContent` (per product id, ref-guarded) |
| `src/lib/cart.ts:190-204` | `AddToCart` (one call per `addItem`, random UUID eventID) |
| `src/app/checkout/page.tsx:44,55-66` | `InitiateCheckout` (UUID eventID, once per mount) |
| `src/app/checkout/page.tsx:242-273` | `_fbc` / `_fbp` cookie capture + **fbclid fallback generation** |
| `src/app/confirmation/[id]/page.tsx:76-121` | `Purchase` (eventID = order id) |

**Production code — Meta CAPI (server)**

| File:line | Role |
|---|---|
| `src/lib/meta-capi.ts:57-181` | `MetaCapiService.sendEvent` — hashing, guard, payload, Graph call |
| `src/app/api/orders/route.ts:6` | import |
| `src/app/api/orders/route.ts:349-378` | the **only** production CAPI calls: `InitiateCheckout` (line 359-368, gated on `eventId`) and `Purchase` (line 369-378) |

**Unexpected / non-production files that mention Meta tracking**

| File:line | Why it matters |
|---|---|
| `scripts/test-capi-event.ts` (whole file) | **Untracked in git** (`git status --short` → `?? scripts/test-capi-event.ts`). Sends a live-attempt `Purchase` with `testEventCode = "TEST39025"` (`:17,58-66`) and `value: 100` (`:39-48`). |
| `scripts/get-todays-orders.ts:119-120,142-143,162,173-174` | Prints/exports `fbc`, `fbp`, `ttclid`, `ttp` from `Order` — **but those columns do not exist** (see §1.4). Every export row is `null`/empty; this is why the 17/18 Oct exports show no click IDs. |
| `pixel-events-e2e.mjs:1-78` | Node script that *mocks* `window.fbq` and asserts payload schema. **Sends nothing to Meta** (no network call; `global.window.fbq` is a local function). |
| `scratch/test-fbc-checkout.ts:10,15,53-90` | Creates an order via `POST http://localhost:3005/api/orders` with a **fabricated** `fbclid=TestClick123AbC` and fabricated `fbp`, then deletes the order. Dev-only, but see §3.1. |
| `scratch/test_pixel.ts:2-5` | Prints the configured pixel ID. Dev-only. |
| `Nanos/nanos-pk/apps/api/src/orders/orders.service.ts:187-225` | **A second, independent server-side Purchase sender in the legacy workspace**: `https://graph.facebook.com/v19.0/{pixelId}/events`, `event_name: "Purchase"`, `event_id: order.id`, `value: order.total`, **no `event_source_url`**, fired only when a recipient email exists (`:170-181`). |
| `Nanos/nanos-pk/apps/web/src/app/layout.tsx:78-99` + `apps/web/src/lib/pixel.ts:8-19` | Legacy browser Pixel (`fbq('init')` + PageView + `<noscript>` beacon). |
| `Nanos/nanos-pk/apps/api/dist/orders/orders.service.js:151-160` | Compiled copy of the legacy CAPI sender (proves a legacy build existed). |

**Not found anywhere** (checked, no matches): `Lead` events, any Meta call from `src/app/api/admin/**`, `src/lib/postex*.ts`, any webhook route, any queue/cron/job that calls `MetaCapiService`, `graph.facebook.com` outside `meta-capi.ts` (and the legacy file).

### 1.4 Data-model gap that blocks every "join on event_id" question

`Order` has **no** `fbc`, `fbp`, `ttclid`, `ttp` or `eventId` columns (`nanos-v2/prisma/schema.prisma:125-171` — full model listed; the tracking fields simply are not there). `POST /api/orders` destructures them from the body (`src/app/api/orders/route.ts:67-71`) and passes them straight into the CAPI `userData` (`:295-303`) but **never persists them** (`tx.order.create` at `:224-266` has no such fields).

Consequences:
1. It is currently impossible to audit, from the DB, *which* `fbc` value was sent for any order.
2. `scripts/get-todays-orders.ts` reports `fbc: null` for every order (confirmed in `exports/orders-2026-10-17.json:…` and `orders-2026-10-18.json:…` — all four tracking fields are `null`), which can be mistaken for "fbclid was never captured".

---

## Part 2 — System Architecture

### 2.1 Event lifecycle

```mermaid
flowchart TD
  subgraph Browser
    A1[PDP mount<br/>PdpActions.tsx:112] -->|trackMeta ViewContent<br/>eventID=randomUUID| FP[fpixel.ts trackMeta<br/>fpixel.ts:38-70]
    A2[cart.addItem<br/>cart.ts:190] -->|trackMeta AddToCart<br/>eventID=randomUUID| FP
    A3[/checkout mount<br/>checkout/page.tsx:44-66] -->|trackMeta InitiateCheckout<br/>eventID=initiateCheckoutEventId| FP
    A4[/confirmation/id<br/>confirmation:76-121] -->|trackMeta Purchase<br/>eventID=order.id| FP
    FP -->|fbq track| META_B[connect.facebook.net/fbevents.js<br/>→ facebook.com/tr]
  end

  A3 -->|POST /api/orders<br/>checkout/page.tsx:284-288| API[api/orders/route.ts POST]
  API --> ORIGIN[origin allow-list :21-40]
  ORIGIN --> DB[(Prisma tx: order.create :224<br/>+ stock reserve)]
  DB --> AF[after callback :353]
  AF -->|MetaCapiService.sendEvent InitiateCheckout<br/>event_id = client eventId :357-368| CAPI[graph.facebook.com/v22.0/PIXEL/events<br/>meta-capi.ts:163-172]
  AF -->|MetaCapiService.sendEvent Purchase<br/>event_id = orderId :369-378| CAPI
  AF -->|TikTokEventsApiService<br/>InitiateCheckout/PlaceAnOrder/CompletePayment :380-413| TT[graph.tiktokapis.com]
  CAPI --> META_S[Meta server events]
  A4 -.->|GET /api/orders/id<br/>confirmation:56-70| APIID[api/orders/[id]/route.ts<br/>createdAt from DB :50,105]
  APIID -.-> A4
```

### 2.2 Per-event matrix

| Event | Browser Pixel | Server CAPI | Exact trigger | Dedup |
|---|---|---|---|---|
| **PageView** | ✅ | ❌ | `MetaPixel.tsx:13-19` on every route change (suppressed on `/admin`, `/login`, `/account`, `*token*`) | none |
| **ViewContent** | ✅ | ❌ | `PdpActions.tsx:112-128`, ref-guarded per product id (`:110-111`) | in-memory ref only |
| **AddToCart** | ✅ | ❌ | `cart.ts:190-204`, **once per `addItem()` call** — a "Buy 2" bundle calls `addItem` twice (`PdpActions.tsx:398-425`, `:468-497`) ⇒ 2 AddToCart events (correct per Meta semantics; the user has already ruled the bundle out as a *duplicate* cause) | none |
| **InitiateCheckout** | ✅ | ✅ | Browser: `checkout/page.tsx:44-66` on mount. Server: `api/orders/route.ts:357-368` at order creation, only if `eventId` present | **shared `event_id`** = `initiateCheckoutEventId` (`checkout/page.tsx:24,280` → `route.ts:71,361`). Note the two are minutes apart in time and carry *different* `value` (client `cart.total` vs server-computed `total`). |
| **Purchase** | ✅ | ✅ | Browser: `confirmation/[id]/page.tsx:96-121`. Server: `api/orders/route.ts:369-378` | **shared `event_id` = `order.id`** on both sides (browser `:121`, server `:371-378` with `orderId` from `route.ts:207`). No client tz/URL value involved. |
| **Lead** | ❌ | ❌ | does not exist anywhere (grep for `"Lead"` in `src` → 0 hits) | — |

Dedup guards, exactly as implemented:

1. **Purchase (browser)** — two layers (`confirmation/[id]/page.tsx:81-99`):
   - *recency window*: `MAX_PURCHASE_WINDOW_MS = 20 * 60 * 1000` (`:83`), measured against `data.createdAt` from `GET /api/orders/:id` (`:81`), with a ±drift allowance `orderAgeMs >= -5 * 60 * 1000` (`:88`).
   - *sessionStorage* key `meta_purchase_fired_${data.id}` (`:92-94`), plus an in-memory `purchaseFiredRef` (`:54,96`). Storage is written **before** the pixel call (`:97-99`).
2. **Server Purchase** — none. One `after()` callback per successful request, no idempotency key, no retry, no queue (`route.ts:353-414`).
3. **Meta-side** — dedup by `event_name`+`event_id`; both sides emit `Purchase` with the same `order.id` string.

### 2.3 Every path that creates or mutates an order, and whether tracking fires

| Path | File:line | Meta tracking |
|---|---|---|
| Normal checkout | `api/orders/route.ts:224` (`tx.order.create`) | ✅ Purchase + InitiateCheckout via `after()` (`:353-378`) |
| Admin manual order | `api/admin/orders/route.ts:308` (`tx.order.create`) | ❌ **no** Meta import in the file at all; admin-created orders never produce a Purchase event |
| Order status/lifecycle changes | `api/admin/orders/[id]/**`, `lib/order-state`, `lib/postex.ts:276-517`, `lib/postex-booking.ts:199-406` | ❌ no tracking (verified by global grep for `MetaCapiService`) |
| Couriers / payment webhooks | none exist: only `api/admin/postex/{health,shipper-advice}`; no webhook route in `src/app/api/**` | ❌ |
| Retry/queue mechanism | none for tracking. `after()` is the only async dispatch; `Promise.allSettled` (`route.ts:413`) swallows failures with no requeue | ❌ |
| Dead fallback store | `export const memoryOrders` (`route.ts:17`) is only ever read (`route.ts:490`, `admin/orders/route.ts:113`, `[id]/route.ts:29`) and never written — dead code | n/a |
| Scratch/QA order creation | `scratch/test-fbc-checkout.ts:59-90` (posts to localhost, then deletes the order) | would be skipped by the `NODE_ENV` guard (`meta-capi.ts:79`) unless run with `NODE_ENV=production` |

---

## Part 3 — Active diagnostics (as of 18 Oct 2026)

### 3.1 "Server sending modified fbclid value in fbc parameter" (detected 17 Oct, ~4% of Purchase events)

**Where `fbc` is constructed**

| Location | Code | Notes |
|---|---|---|
| Client cookie path | `checkout/page.tsx:242`, `:272-273` → `fbcCookie = getCookie("_fbc")` | Written by Meta's own pixel (`_fbc`), passed verbatim |
| Client fallback path | `checkout/page.tsx:243-249`: `fb.1.${Date.now()}.${fbclidFromUrl}` where `fbclidFromUrl = new URLSearchParams(window.location.search).get("fbclid")` | Introduced 17 Oct 23:43 in commit `3db113a` (the commit is titled "Remove temporary fbc verification log" but its diff also **adds** this fallback — `git show 3db113a`) |
| Server | `api/orders/route.ts:68` (destructure) → `:301` (`userData.fbc`) → `meta-capi.ts:9,125` (`fbc: userData.fbc`) | **No server-side construction, no mutation, no persistence** |
| Legacy workspace | `Nanos/nanos-pk/.../orders.service.ts` | legacy CAPI sends no `fbc` at all (only `em`) |

**subdomainIndex** — Meta's spec (fetched live): `version.subdomainIndex.creationTime.<fbclid>`, where `'com' = 0`, `'example.com' = 1`, `'www.example.com' = 2`, and "If you're generating this field on a server, and not saving an `_fbc` cookie, use the value 1."

- Production domain check (measured this session): `curl -sI https://nanos.pk/` → **200**; `curl -sI https://www.nanos.pk/` → **200 with no redirect**; both return the identical Next.js app (`<title>nanos.pk — Keep it simple. Wear it your way.</title>`, same CSS chunk). So **the site serves on both apex and `www`, and does not canonicalise `www` → apex.**
- Therefore `fb.1.` is **correct on apex** and **incorrect on `www`** (should be `fb.2.`). This is a real, small defect (`checkout/page.tsx:249`), but it only affects the fallback path (no `_fbc` cookie) — and only for sessions on `www`.
- Nothing anywhere hardcodes `subdomainIndex` server-side (grep for `fbc` in `src` → only the locations above).

**creationTime units** — `Date.now()` in `checkout/page.tsx:249` is **milliseconds since epoch**, which matches the spec. Two caveats, both *semantic* rather than unit errors:
1. The spec says creationTime is "when the `_fbc` cookie was saved" or, absent a cookie, "when you first observed or received this `fbclid`". The fallback uses the **moment the user submits the order**, not the moment the `fbclid` was first observed — a potentially large skew (hours).
2. Because the fallback reads `fbclid` from `window.location.search` **of the checkout page**, it will normally find nothing at all (the user reached checkout via internal navigation, which drops the query string). Meta's pixel sets `_fbc` on the landing page instead. So in practice the fallback fires rarely — which is consistent with a ~4% diagnostic rate but does not prove it.

**Is `fbclid` mutated anywhere?** Audited the whole pipeline:
- `new URLSearchParams(...).get("fbclid")` (`checkout/page.tsx:245`) performs one percent-decode, and would convert `+` → space. `fbclid` values are URL-safe (`IwAR…`), so this normally changes nothing, and I found no historic evidence of a `+`-bearing fbclid.
- `getCookie()` now uses `decodeURIComponent(match[1])` (`checkout/page.tsx:15-18`, changed in `ff0dde6`) — a second decode of an already plain cookie value; harmless for `_fbc` (`fb.1.<ms>.<fbclid>` contains no `%`), but it is a literal second decode of a value that Meta marks case-sensitive "do not apply any modifications".
- **No lowercasing, trimming, slicing, substringing, or truncation of `fbclid`/`fbc` exists anywhere** (`grep -rn -i "fbc" src | grep -i "lower\|trim\|slice\|substring"` → **0 hits**).
- The server passes the string through untouched (`route.ts:301` → `meta-capi.ts:125`).
- The previous `getCookie()` implementation (`git show ff0dde6`, old lines) used `value.split('; ${name}=')` + `parts.pop().split(";").shift()` — it could return `undefined` but did not truncate; it was replaced on 17 Oct 23:56.

**Verdict for 3.1: UNRESOLVED / INSUFFICIENT EVIDENCE for the specific 4% (with two confirmed sub-defects).**
- The `www` subdomain-offset defect is CONFIRMED BUG (minor).
- The "creationTime = submit time, not click time" behaviour is CONFIRMED (by code), and is the most plausible thing a Meta validator would characterise as a *modified* fbclid, but I cannot confirm that mapping without the flagged events.
- 4% of ~26–38 purchases ≈ 1 event. A single flagged event is more consistent with **manual/QA activity** (e.g. `scratch/test-fbc-checkout.ts:10` literally fabricates `fbclid=TestClick123AbC`) than with a systematic client-path bug. This is a hypothesis, not a conclusion: the script posts to `localhost:3005`, and the CAPI guard (`meta-capi.ts:79`) blocks that **unless it was run with `NODE_ENV=production` and no test code**.
- **To resolve:** Events Manager → Diagnostics → the flagged event list (date, `event_id`, `event_source` browser/server, the exact `fbc` string) + server access logs for the same `event_id`. Without the raw `fbc` string that Meta flagged, no local artifact can distinguish "truncated", "wrong creationTime", "wrong subdomainIndex", or "fabricated test value".

### 3.2 "Send value parameters for your purchase events" (detected 18 Oct, <1%)

**Every real Purchase sender and its value source**

| Sender | Line | `value` | `currency` |
|---|---|---|---|
| Server CAPI | `api/orders/route.ts:322-329` builds `customData = { value: total, currency: "PKR", … }`; `total = afterDiscount + shipping` (`:181-182`); sent at `:369-378` | ✅ `total` (integer from server-side price resolution, `:129-176`) | ✅ `"PKR"` |
| Browser pixel | `confirmation/[id]/page.tsx:111-121` | ✅ `value: data.total` (from `GET /api/orders/:id`, `api/orders/[id]/route.ts:105`) | ✅ `"PKR"` |
| Payload assembly | `src/lib/meta-capi.ts:143-148` | coerces `numericValue`; **falls back to `0`** for Purchase when absent | ✅ defaults `"PKR"` (`:149`) |

So: **yes — every real production path populates `value` and `currency` from real, server-authoritative order data.** There is no production code path that can send a Purchase with a missing value *unless* `total` itself is 0 (only possible with a 100%-discount/free order, none in the 17–18 Oct data — see §4).

**What changed today and could have produced this diagnostic**

| Commit | Time (PKT) | Effect |
|---|---|---|
| `2f4be7e` | 18 Oct 00:43 | Adds a `console.warn` only when `value`/`currency` missing. **No behaviour change.** |
| `48a1870` | 18 Oct 01:20 | Replaces `value: customData?.value` with a coerced numeric and, for Purchase, **`numericValue !== undefined ? numericValue : 0`** (`meta-capi.ts:143-148`), and warns when `numericValue === 0` (`:99-110`). |

Before `48a1870`, `customData?.value === undefined` would be dropped by `JSON.stringify` and the event would ship **without** a `value` key — exactly the shape this diagnostic flags. After `48a1870`, the same case ships **`value: 0`**, which Meta also treats as an invalid purchase value. **Net: the fix changes the failure mode (missing → zero) but does not make a zero-value purchase valid.** If the diagnostic was caused by a code path sending no value, it may persist as a *different* message; if it was caused by a zero value, nothing changed.

**Is it production traffic or test/manual activity?** Evidence points to **test/manual tooling or Meta's own diagnostics re-evaluation, not a real production bug**:
- `scripts/test-capi-event.ts` is untracked and was created today (`git status`; mtime 18 Oct). It always sends `value: 100` with `currency: "PKR"` (`:39-48`) and **hardcodes `testEventCode = "TEST39025"`** which it also exports into the env (`:15-17,58-66`) — test-tagged events are shown separately in Events Manager and are not part of production diagnostics.
- No admin/webhook/queue path sends Purchase (Part 2.3).
- All 26 orders on 17 Oct and all 12 on 18 Oct have `total = 1700`, `2940` or `4104` — **no zero-value order exists** (DB query, this session).

**Verdict: RULED OUT as a production code bug** (every real path supplies a non-zero value from DB-derived totals). **The exact originating event remains UNRESOLVED** — with <1% of events it is most likely one test/manual event or a diagnostic window that still contains pre-`48a1870` data; the specific event cannot be identified locally. Required: the diagnostics drill-down for 18 Oct (event name, `event_id`, `event_source`, `value` as received).

### 3.3 "Set up manual advanced matching" (detected 11 Oct)

**The prior conclusion is outdated: advanced matching IS implemented and IS live.**

- Code: `src/components/MetaPixel.tsx:28-40` — `useEffect` on `[user, scriptLoaded]` calling `w.fbq("init", META_PIXEL_ID, { em: user.email, ph: (user as any).phone || undefined })`.
- Git: commit `e4c0b56` "Add manual advanced matching for logged-in users via Meta Pixel", 18 Oct 00:06 +0500.
- Live bundle: the deployed chunk contains the exact minified call `fbq("init",i.META_PIXEL_ID,{em:c.email,ph:c.phone||void 0})` (downloaded this session from `https://nanos.pk/_next/static/chunks/18dws9hbrlboz.js`).

Grep for `fbq('init', …, {em, ph})` returns this location only; the loader's own `fbq('init', META_PIXEL_ID)` (`MetaPixel.tsx:61`) is un-parameterised and comes first.

Caveats worth noting (not blockers): the advanced-matching `init` only runs for **logged-in** users (`:30`) and only after `fbcq` is already defined (`:33`), so guests are never advanced-matched; and it re-inits on every `user`/`scriptLoaded` change. Also `MetaPixelNavigation` (`:13-19`) fires PageView on route change, and `shouldSuppressPixel` (`fpixel.ts:8-31`) suppresses `/admin`, `/login`, `/account`, `*token*` — so **Meta's diagnostic may still be showing "not set up" for a window that predates the 18 Oct deploy**, or because guest traffic never matches.

**Verdict: CONFIRMED FIXED for logged-in users (commit `e4c0b56`, verified in the live bundle); not applicable to guests.** Follow-up (lower priority, as the brief says): consider hashing email/phone client-side or advanced-matching guests, and consider re-initing after `user` changes without a full page reload.

### 3.4 "Confirm domain that belong to you — fb.com" (detected 18 Oct)

**Server-side `event_source_url`**

- Current code: `api/orders/route.ts:292` — `const eventSourceUrl = "https://nanos.pk/checkout";` This is a **hardcoded constant**, used for every server event (Meta `InitiateCheckout` `:362`, Meta `Purchase` `:373`, TikTok `:385,397,408`). It is **not** derived from the URL; it is always the apex domain even for a session on `www`.
- History: commit `bc554dd` (18 Oct 00:25) replaced `request.headers.get("referer") || "https://nanos.pk/checkout"` with the constant. The old expression is the single strongest explanation of a `fb.com` / `l.facebook.com` domain diagnostic: for ad traffic arriving through Meta's in-app browser, the `Referer` sent with the checkout `POST` is a `l.facebook.com`-class URL, and that value went straight into `event_source_url`. **That commit is present in the deployed build** (the live client bundle contains `684e584`'s 20-minute logic, which is 1h51m *newer*, so the deployed build must include `bc554dd`; see Part 5).
- The legacy CAPI sender sends **no** `event_source_url` at all (`Nanos/nanos-pk/.../orders.service.ts:196-218`).

**Browser-side Pixel events: is there equivalent protection?** No explicit protection exists — and, importantly, the brief's hypothesis about `document.referrer` is **not supported by Meta's parameter semantics**: a browser Pixel event has no `event_source_url` field the developer sets; Meta derives the source from the `dl` ("document location") parameter that `fbevents.js` attaches, i.e. the **current page URL**, not the referrer (referrer is reported separately as `rl`). Our code never calls `fbq('set','autoConfig'…)` or any custom-parameter API that would change `dl`.

Refutation evidence in-repo: the only browser-side `fbq` calls are `trackMeta` (`fpixel.ts:38-70`) → `fbq("track", name, params, {eventID})`, and the loader (`MetaPixel.tsx:53-63`), none of which set or override a source URL. Therefore the browser Pixel cannot report `fb.com` as its *event source* unless the page itself is served from a `facebook.com` origin — which the live `curl` disproves for `nanos.pk` / `www.nanos.pk`.

**Correlation with today's manual testing:** the diagnostic appeared the same day a fabricated-click ID test existed (`scratch/test-fbc-checkout.ts`, mtime 18 Oct 00:20) and that same night the `referer`-based server code was live until 00:25. Today's DB also contains one clearly non-organic order (`ord_9lyersesg`, `saad@gmail.com`, cancelled 11:51 PKT) alongside 12 orders total. I can quantify DB-side activity but **not** correlate it with fb.com-sourced events, because no Meta event export exists locally (see Part 8).

**Verdict: FIX PRESENT BUT UNVERIFIED LIVE (server CAPI).** Root cause identified with high confidence (referer header, pre-`bc554dd`), fix present in code and included in the deployed build by inference, but **not confirmed against production event data**. The hypothesised browser-side gap: **RULED OUT** as a code-level defect (no code path sets a browser event source URL), with the residual possibility that in-app-browser traffic produces an `rl` value Meta chooses to flag — not verifiable locally.

---

## Part 4 — Core unresolved discrepancies (highest priority)

### 4.0 Every code path that can emit `event_name: "Purchase"` — exhaustive enumeration

| # | Path | Fires? | `event_id` | `value` |
|---|---|---|---|---|
| 1 | `api/orders/route.ts:369-378` (inside a single `after()` at `:353`) | once per successful POST | `orderId` (`:207`) | `total` |
| 2 | `confirmation/[id]/page.tsx:111-121` | once per confirmation view (subject to the two guards) | `data.id` (== order id) | `data.total` |
| 3 | `scripts/test-capi-event.ts:58-66` (untracked, manual) | only when a human runs it | `manual_test_<ts>` | 100 |
| 4 | `Nanos/nanos-pk/apps/api/src/orders/orders.service.ts:187-225` (legacy workspace, different DB/host) | only if that legacy API is still deployed and receiving orders | `order.id` | `order.total` |
| 5 | `pixel-events-e2e.mjs:60-66` | **never** — mocked `window.fbq`, no network | n/a | 3950 |
| — | retries, queues, jobs, webhooks, courier callbacks, admin UI | **none exist** (`grep -rn "MetaCapiService" src` → only `route.ts` + import; no queue/cron in `src`) | — | — |

There is **no** Meta `Purchase` emission from admin order creation (`api/admin/orders/route.ts:308`) or from any PostEx/courier status change.

### 4.1 Historical: 38 server Purchase events vs 26 real DB orders (17 Oct)

**First-principles re-derivation:**

1. **DB truth verified this session (read-only Prisma query, 15–18 Oct):** PKT-day counts `15th=25, 16th=23, 17th=26, 18th=12`. 17 Oct = **26 orders**, matching `exports/orders-2026-10-17.json` (26 rows, first `2026-10-16T19:06Z`, last `2026-10-17T16:23Z`). **No order row has `isTest = true`** on any of those days; no `fbc`/`fbp` columns exist (§1.4).
2. **The code emits exactly one server Purchase per successful POST** (`route.ts:369-378`, one `push` into `events`, `Promise.allSettled` at `:413`). There is no loop, no retry, no second sender in `nanos-v2`.
3. **`after()` has no retry semantics.** Next 16.3.8 docs shipped in-repo (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`) state the callback runs after the response is finished and "will be executed even if the response didn't complete successfully" — i.e. *at most once per route execution*, never twice. Hosting is **self-hosted Hostinger** (`platform: hostinger`), not Vercel, so there is no platform-level function retry feature in play.
4. **Duplicate-order hypothesis tested and refuted for these days.** There is no idempotency key on `POST /api/orders` (request body destructuring `:60-72`; no nonce, no unique constraint on `Order` — `schema.prisma:125-171`), so a double-submit *could* create two orders. But the DB contains **no** near-duplicate pairs on 17 or 18 Oct; the only same-phone/same-total pair in the 15–18 Oct window is `ord_43y16f8q6` + `ord_8lqfhdzy8` (15 Oct, 3m33s apart, **different sizes 7/41 and 8/42** → two genuine orders, `shippingInfo` identical otherwise). So on 17 Oct, 26 POSTs ⇒ 26 server Purchases, not 38.
5. **Striking arithmetic, offered strictly as a hypothesis to test:** 17 Oct DB orders (26) + 18 Oct DB orders as of this audit (12) = **38**. If the prior "38 server events" figure was pulled with a filter that spanned both days (e.g. "Last 2 days" or a date range typed as 17→18 Oct), the entire discrepancy is a **reporting-window mismatch**, not duplicate events. This is *consistent* but unproven — the 18 Oct figure was 9 at the 12:55 export and 12 now, so the exact pull time matters. **Verify by pulling the Meta export with an `event_time` column and counting Purchase rows per calendar date in the ad account timezone.**
6. **Bucket (c) — events with an `event_id` matching no order — cannot be computed here.** There is no local Meta export, and the DB does not store the event id sent by the server (it *is* the order id, but nothing records which events Meta received). Therefore the classification (a) matches+once / (b) matches+2+ / (c) no match is **UNRESOLVED / INSUFFICIENT EVIDENCE**.
   *What would resolve it:* Events Manager → Data Sources → pixel `969572164409296` → "Events received" export for 17–18 Oct, including `event_name`, `event_id`, `event_source` (browser/server), `event_time`, and dedup status. Join `event_id` against `Order.id` (all `ord_*` ids are in the DB and, at 17 Oct, unique).
7. One residual, non-provable candidate: **12 deleted orders**. `scratch/test-fbc-checkout.ts:81-89` creates an order and then deletes it (cascade deletes `OrderItem`/`OrderEvent`), which would leave orphan Purchase events at Meta while the DB shows nothing. No evidence exists that it ran 12+ times on 17 Oct (the file's mtime is 18 Oct 00:20), and it targets `localhost` where the CAPI guard (`meta-capi.ts:79`) blocks sending — unless run with `NODE_ENV=production`.

**Verdict 4.1: UNRESOLVED / INSUFFICIENT EVIDENCE** for the 38-vs-26 gap. The single-sender code path is CONFIRMED (one Purchase per order), duplicate orders on 17–18 Oct are RULED OUT from DB evidence, and the 26+12=38 reporting-window artefact is the leading testable hypothesis. The `after()`-retry explanation is **RULED OUT** (Next semantics + self-hosted platform).

### 4.2 Campaign-level: 17 Meta-reported purchases vs 9 real DB orders (18 Oct)

Verified DB state: at the 12:55 export, 18 Oct had **9** orders (`exports/orders-2026-10-18.json`); as of this audit (≈16:25 PKT) it is **12** (`ord_ky9sh7jm9` 13:24 PKT, `ord_wgpmz5qs5` 15:03 PKT, `ord_mnxw3t3sb` 16:22 PKT). One is the cancelled `ord_9lyersesg` (`saad@gmail.com`).

What explains 17 vs 9 can only be *enumerated*, not decided, from this repo:

1. **Different denominators.** Ads-Manager "Purchases" are *attributed* conversions after dedup within the chosen attribution window, bucketed by the ad account's timezone; the DB count is *raw orders created in PKT*. A late-17-Oct order that Meta buckets into the 18th (or an 18th-PKT order bucketed into the 19th) shifts both ways.
2. **Dedup failure is not supported by the code**: both channels send `Purchase` with the identical `event_id` (browser `confirmation:121` vs server `route.ts:371`), which is what Meta dedups on. If dedup were failing, the ratio would be ≈2.0 exactly; 17/9 ≈ 1.89 is close but the sample is 9 orders — too small to distinguish from window/timezone effects.
3. **The extra events could come from a second integration outside this repo** — the legacy Nest API (`Nanos/nanos-pk/.../orders.service.ts:187-225`) sends its own Purchase events with `event_id = order.id` (its own DB, its own ids) and **no** `event_source_url`. I found **no** evidence that it is still deployed: production serves the nanos-v2 app (`<title>` matches `src/app/layout.tsx:29`), and the legacy repo's last commit is `a34c551` (2026-09-16). That is suggestive, not conclusive — deployment state is outside this repo.
4. **Test-tagged events** (`TEST39025` from `scripts/test-capi-event.ts`) are excluded from production reporting, so they are NOT the cause of a campaign-level number.

**Verdict 4.2: UNRESOLVED / INSUFFICIENT EVIDENCE.** Local DB truth is 12 orders on 18 Oct (9 at export time). Required to resolve: (a) the Ads Manager column definition (attribution setting + ad-account timezone), (b) an Events Manager Purchase export for 18 Oct with `event_id` + `event_source` + `event_time`, (c) confirmation of whether any legacy/third-party integration still posts to pixel `969572164409296`.

### 4.3 Server:browser Purchase ratio ≈2–2.9× (8–17 Oct) vs ≈1.0–1.1× on "healthy" days

Code-level facts that bound the explanation:

- Browser Purchase requires **all** of: JS execution, the pixel script loading (`MetaPixel.tsx:53-63`, `strategy="afterInteractive"`), the user actually reaching `/confirmation/:id` (`checkout/page.tsx:306-310` does `router.push`), a successful authorised `GET /api/orders/:id` (guest access requires `?email=` — `api/orders/[id]/route.ts:84-90`), passing the 20-min window and the two dedup guards (`confirmation:81-99`). Any one of these failing ⇒ **no browser event, while the server event has already fired**. Ad-blockers, in-app browsers, tab closure and ad-blocked `connect.facebook.net` all hit the browser side only.
- The server path has no such dependencies: it runs inside `after()` after the DB commit (`route.ts:353`), with a 4s timeout (`meta-capi.ts:172`).
- Therefore a **server:browser ratio > 1 is the expected signature of browser-side loss and is not by itself a duplicate-Purchase bug** — provided the counts being compared are *raw per-channel events*. If the compared figure is *campaign/attributed purchases*, then dedup should already have collapsed the pair, and a >1 ratio would instead indicate that the comparison is mixing channels against orders, not against deduplicated conversions.
- Nothing in this repo can *raise* the server count: one sender, one call, no retry (§4.0/4.1).
- Historical note that invalidates part of the stated window: the browser Purchase eventID has been `data.id` since commit `29e469b` (21 Sep 2026); before that (`6570136`, 18 Sep) it fired **without any eventID**, so **no cross-channel dedup existed 18–21 Sep**. For 8–17 Oct, dedup was in place.

**Verdict 4.3: UNRESOLVED / INSUFFICIENT EVIDENCE on the numeric claim; the *mechanism* is explained.** The direction of the discrepancy is fully accounted for by browser-side loss (EXPECTED, not a bug); whether the residual is pure loss or partly dedup failure cannot be decided without per-channel, post-dedup event counts. Required: Events Manager export for 8–17 Oct with `event_source` and dedup status, plus the definition of the "healthy day" baseline.

---

## Part 5 — The confirmation-page revisit fix (`684e584`)

### 5.1 Current code (verbatim)

`nanos-v2/src/app/confirmation/[id]/page.tsx:76-100`

```tsx
// Fire Purchase Meta & TikTok Pixel Events (only for freshly created orders)
try {
  const orderCreatedAt = data.createdAt ? new Date(data.createdAt).getTime() : 0;
  const orderAgeMs = Date.now() - orderCreatedAt;
  const MAX_PURCHASE_WINDOW_MS = 20 * 60 * 1000; // 20 minutes

  // Only fire if order was created within the last 20 minutes (with 5-minute clock drift margin)
  const isFreshOrder =
    orderCreatedAt > 0 &&
    !isNaN(orderCreatedAt) &&
    orderAgeMs >= -5 * 60 * 1000 &&
    orderAgeMs <= MAX_PURCHASE_WINDOW_MS;

  const storageKey = `meta_purchase_fired_${data.id}`;
  const isSessionFired =
    typeof window !== "undefined" && Boolean(sessionStorage.getItem(storageKey));

  if (isFreshOrder && !purchaseFiredRef.current && !isSessionFired) {
    purchaseFiredRef.current = true;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(storageKey, "true");
    }
```

(followed by `trackMeta("Purchase", {…}, data.id)` at `:111-121`.)

Commit: `684e58474b8417bc8543161828e192811dda60d9`, 2026-10-18 02:16:17 +0500 — `git show --stat 684e584` → 1 file changed, 13 insertions, 2 deletions.

### 5.2 Exact window value

**20 minutes**, `MAX_PURCHASE_WINDOW_MS = 20 * 60 * 1000` (`:83`). The prior claim of "20 min, not 15–30" is **CONFIRMED**. There is additionally a **−5 minute tolerance** (`:88`) so that a small clock skew between the server-issued `createdAt` and the browser clock does not suppress the event.

### 5.3 What timestamp is the window measured against?

`data.createdAt` (`:81`), where `data` is the body of `GET /api/orders/:id` (`:67-69`), whose value is `dbOrder.createdAt.toISOString()` read from the database (`src/app/api/orders/[id]/route.ts:33-50`, returned at `:105`). It is **not** taken from the URL, not from `localStorage`, not from the client clock, and not from the `POST` response body (which returns a separate `createdAt: now` from `api/orders/route.ts:208,426` — a cosmetic field on a different response that never reaches this check).

The only client-side value in play is `purchaseFiredRef`/`sessionStorage`, which can only *suppress* a fire, never force one. **No client-tamperable value can trigger a Purchase here. Verdict: correct design.**

### 5.4 Interaction between the two guards

Order of evaluation is a single short-circuit expression (`:96`): `isFreshOrder && !purchaseFiredRef.current && !isSessionFired`.
- `isFreshOrder` (DB timestamp) **wins** — if false, nothing fires regardless of storage.
- `purchaseFiredRef` (per component instance, `:54`) suppresses a second run of the same effect in the same mount (`fetchOrder` re-runs on `[id, emailParam, auth.token]` changes).
- `sessionStorage` (per tab, keyed by order id, `:92-94`) suppresses a re-mount/navigation within the same tab. It is written **before** the pixel call (`:97-99`), so even a throwing pixel path leaves it set (`trackMeta` swallows errors internally, `fpixel.ts:66-69`).

### 5.5 Is the fix sufficient?

**CONFIRMED FIXED for its stated purpose (deployed and live), but NOT a complete solution, and — critically — it cannot explain the server-side discrepancy.**

- Live proof it is deployed: the production confirmation chunk (`/_next/static/chunks/346ghh5bey7sw.js`, fetched from `https://nanos.pk`) contains the exact minified logic `i=e>0&&!isNaN(e)&&t>=-3e5&&t<=12e5,r=\`meta_purchase_fired_${n.id}\`,o=!!sessionStorage.getItem(r);if(i&&!g.current&&!o)` — i.e. −300000 ≤ age ≤ 1200000 ms. So `684e584` is **FIX PRESENT AND DEPLOYED (verified in the live bundle)**.
- **Residual edge cases (all still possible):**
  1. **Revisit inside 20 minutes** re-fires the browser event. Meta dedups it (same `event_id`), so *reported* conversions are unaffected, but **raw browser events received are inflated** — relevant only if someone compares raw Events Manager counts.
  2. **New tab / new browser / new device** within 20 minutes: `sessionStorage` is per-tab, so the pixel fires again; again dedup-safe.
  3. **Within 20 minutes but with a *different* `data.id`?** Not possible — the key is the order id.
  4. **Server-side Purchase is unaffected by this fix entirely.** It fires once per order inside `after()`; the confirmation page cannot cause it. **Therefore this fix cannot explain 38-vs-26, and neither could the pre-fix behaviour** (a stale revisit replays the *original* `event_id`). This is a first-principles refutation of the "confirmation revisit explains the server over-count" theory: the revisit path is *browser*-side and carries the same event id.
- Also note the countervailing effect the fix introduces: a genuine first-visit at **>20 minutes** after order creation (e.g. user pays by COD, closes the tab, then opens the confirmation link from SMS/email later) now **never** fires a browser Purchase. That is the intended trade-off, worth stating because it further widens the server:browser ratio.

---

## Part 6 — Localhost / non-production leakage

### 6.1 Does the CAPI guard protect localhost?

Yes, **server-side is guarded**, with two independent conditions in `src/lib/meta-capi.ts`:

```ts
// meta-capi.ts:69-72
if (!pixelId || !accessToken) { console.warn("[Meta CAPI] Missing …"); return; }

// meta-capi.ts:74-89
const effectiveTestEventCode = testEventCode || (customData as any)?.test_event_code || process.env.META_TEST_EVENT_CODE;
if (process.env.NODE_ENV !== "production") {
  if (!effectiveTestEventCode) { console.log(`[Meta CAPI] Skipping ${eventName} in non-production mode …`); return; }
  console.log(`[Meta CAPI] Non-production mode: sending ${eventName} tagged with test_event_code: ${effectiveTestEventCode}`);
}
```

So a dev run (`NODE_ENV=development`, `META_TEST_EVENT_CODE` unset — **verified unset in `.env`**: `grep -cE '^META_TEST_EVENT_CODE=.+' .env` → `0`) skips all CAPI sends. Introduced by commit `b89072d` (18 Oct 00:27). **Verdict: CONFIRMED — server-side leakage from localhost is prevented (as long as `NODE_ENV` is not `production`).**

Two residual server-side caveats:
- The guard is `NODE_ENV`-based, not host-based. Running `next start` locally (`NODE_ENV=production` by default) **bypasses the guard entirely** and will post live CAPI events with `event_source_url: https://nanos.pk/checkout` (`route.ts:292`). That is a plausible channel for "localhost / synthetic" events landing in the live dataset.
- The **TikTok** server path has **no equivalent guard at all** (`tiktok-events-api.ts:93-188` — only `TIKTOK_TEST_EVENT_CODE` tagging, `:187-188`).

### 6.2 The browser-side gap (this explains the 172 localhost events)

`src/components/MetaPixel.tsx` has **no dev/production guard whatsoever**:

- The only suppression is path-based: `if (!META_PIXEL_ID || shouldSuppressPixel(pathname, searchParams)) return null;` (`MetaPixel.tsx:41`), and `shouldSuppressPixel` only rejects `/admin`, `/login`, `/account`, and paths/params containing `token` (`fpixel.ts:8-31`).
- Grep for environment/host gating: `grep -n "NODE_ENV|window.location|hostname" src/components/MetaPixel.tsx` → **0 hits**. Independently verified against the deployed client code: all 8 confirmation-page chunks plus every checkout chunk downloaded from `https://nanos.pk` contain **zero** occurrences of `location.hostname` (`grep -l "location.hostname" chunk_*.js co_*.js` → no files) and **zero** `process.env.NODE_ENV` references. So there is no host-based or env-based gate in production either.
- Worse: the pixel ID is **hardcoded** as a fallback (`fpixel.ts:1-2`), so even with `NEXT_PUBLIC_META_PIXEL_ID` absent the Pixel still initialises against the **live** pixel dataset.
- And the Pixel is mounted in the root layout for every route (`layout.tsx:11,41`), so any localhost browsing of `http://localhost:3000/**` loads `fbevents.js`, fires PageView (`MetaPixel.tsx:13-19`), and fires ViewContent/AddToCart/InitiateCheckout/Purchase from normal UI interactions (including any local test order).

**Verdict: CONFIRMED BUG — real, currently unfixed.** This fully accounts for the 172 localhost events attributed to the live pixel dataset over 28 days, and is consistent with the same mechanism in every dev session since the Pixel was integrated (`6570136`, 18 Sep).

**Proposed guard (not implemented — per the brief, proposal only):**

```tsx
// src/lib/fpixel.ts — add alongside shouldSuppressPixel()
export function isTrackingEnvironment(): boolean {
  if (process.env.NEXT_PUBLIC_META_TRACKING_ENABLED === "true") return true;   // explicit opt-in for staging
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "nanos.pk" || h === "www.nanos.pk";
}
```
and gate both the loader (`MetaPixel.tsx:41`) and the navigation effect (`MetaPixel.tsx:14`) on it, plus `trackMeta` itself (`fpixel.ts:43`) as defence in depth. Equivalent treatment is advisable for `TikTokPixel.tsx:18,30`. Note the deliberate use of an explicit allow-list rather than `NODE_ENV === "production"`, because production here is `next start` on Hostinger and a locally-run production build would otherwise still leak.

---

## Part 7 — Double-submit / duplicate-order check

The "Buy 2 (Pair)" bundle is **not** re-investigated (user has already ruled it out via UI inspection).

**Client-side protections present**

`nanos-v2/src/app/checkout/page.tsx`

```tsx
// :38-40
const submittingRef = useRef(false);
const isOrderPlacedRef = useRef(false);
const [isSubmitting, setIsSubmitting] = useState(false);

// :146-166
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setErrorMsg(null);

  // Double-submission guard (Ref + State)
  if (submittingRef.current || isSubmitting) {
    return;
  }

  if (!isFormValid) { … return; }

  submittingRef.current = true;
  setIsSubmitting(true);
```
and the submit control:

```tsx
// :582-590
<button
  type="submit"
  form="checkout-form"
  disabled={!isFormValid || isSubmitting}
  className="btn btn-primary btn-block"
  style={{ marginTop: 18 }}
>
  {isSubmitting ? "Placing your order..." : `Place Order — ${fmtPrice(cart.total)}`}
</button>
```
with `<form id="checkout-form" onSubmit={handleSubmit}>` at `:357`.

**Assessment**

- A true double-click **within the same tick** is blocked: the synchronous `submittingRef.current = true` (`:160`) is set before the first `await`, and the second click's handler sees the ref already `true` (`:151`). The `disabled` attribute is a second, slower layer (state must flush first) — the ref is the effective guard.
- The ref is correctly reset on *every* failure path (`:172,179,193,294,315`) but is **not** reset on success (intentional: `isOrderPlacedRef.current = true` at `:302` then `router.push` at `:310`).
- **Gap 1 (server-side, real):** `POST /api/orders` has **no idempotency mechanism** — no nonce, no client-generated order key, no unique constraint on `Order` (`prisma/schema.prisma:125-171`; body destructuring `route.ts:60-72`; `orderId` randomly generated server-side at `:207`). A genuine network retry (CDN/proxy re-invoking the request after a timeout, or the user clicking again in a new tab where `submittingRef` is fresh) creates **two distinct orders, each with its own legitimate Purchase event**. Per the brief's framing, that would be *two real orders*, not a tracking-layer duplicate — and it is distinguishable precisely because both order ids would appear in the DB.
- **Gap 2 (browser Back then resubmit):** after a successful order the component's refs are not persisted; navigating back to `/checkout` re-mounts the page (empty cart ⇒ `:335-337` returns `null` and the effect redirects home, `:46-51`), so a resubmit of the *same* cart is not straightforward. Not a duplication path in practice.
- **No service worker** exists in the repo: `grep -rn "serviceWorker|sw.js" src public` → **0 hits**, so there is no SW-mediated retry path.

**Verdict: CONFIRMED BUG (server-side idempotency missing) — but NOT currently evidenced as active.** The DB shows no duplicate orders on 17–18 Oct (the only same-customer pair is 15 Oct with different sizes, 3m33s apart). So double-submit is **RULED OUT as the cause of the 17/18 Oct event counts**, while remaining a latent production risk worth fixing (`POST`-key idempotency or a unique constraint on a client-supplied checkout token).

---

## Part 8 — Conclusion and confidence levels

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 1 | Server CAPI sends exactly **one** Purchase per successful order, `event_id = orderId`; no retry/queue/second sender | **CONFIRMED** (design fact, not a bug) | `route.ts:207,353,369-378,413`; exhaustive sender list §4.0 |
| 2 | Browser Purchase uses the **same** `event_id` (`order.id`) ⇒ Meta-side dedup is wired correctly | **CONFIRMED** | `confirmation:111-121`, `route.ts:371`, `29e469b` (eventID added 21 Sep) |
| 3 | `after()` cannot double-execute per request | **RULED OUT** as an over-count cause | Next 16.3.8 `after.md`: runs after the response, incl. on error, once per execution; self-hosted Hostinger (`platform: hostinger`), not Vercel |
| 4 | Double-submit creating two real orders on 17–18 Oct | **RULED OUT** (latent risk remains) | Read-only DB query 15–18 Oct: no duplicate pairs; the single near-dup is 15 Oct with different sizes |
| 5 | `POST /api/orders` idempotency | **CONFIRMED BUG (latent, not currently active)** | no nonce/unique constraint: `route.ts:60-72,207`; `schema.prisma:125-171` |
| 6 | Server 38 vs DB 26 (17 Oct) | **UNRESOLVED / INSUFFICIENT EVIDENCE**; leading testable hypothesis = 26 (17th) + 12 (18th) = 38 from a multi-day export filter; alternative = ~12 orders created-but-deleted by QA scripts (`scratch/test-fbc-checkout.ts:81-89`) | DB counts by PKT day (25/23/26/12); exports count 26 on 17 Oct; needs Meta export with `event_time` |
| 7 | Campaign 17 vs DB 9 (18 Oct) | **UNRESOLVED / INSUFFICIENT EVIDENCE** | DB has 9 at export time, 12 now; needs Ads-Manager column definition + Events Manager export + confirmation that no legacy integration posts to the pixel |
| 8 | Server:browser ratio 2–2.9× is a duplicate bug | **RULED OUT as duplication; ratio explained as browser-side loss** (raw per-channel counts aren't comparable). Whether residual is partly dedup failure: **UNRESOLVED** | `route.ts:353-378` vs `confirmation:81-121` + prerequisites list in §4.3 |
| 9 | "Modified fbclid in fbc" (4%) | **UNRESOLVED** for the specific events. Two code-level defects **CONFIRMED**: (a) hardcoded `fb.1.` is wrong for `www` (site serves `www` with **no redirect**); (b) fallback `creationTime` = submit time, not first-observed click time | `checkout/page.tsx:243-249`; live `curl -sI` on apex+www; Meta spec (subdomainIndex 0/1/2, ms epoch) |
| 10 | fbclid lowercased / truncated in pipeline | **RULED OUT** | `grep -rn -i "fbc" src \| grep -i "lower\|trim\|slice\|substring"` → 0 hits; server passes it through (`route.ts:301` → `meta-capi.ts:125`) |
| 11 | "Send value parameters for your purchase events" | **RULED OUT as a production bug** — every real path sends a non-zero DB-derived `value` + `currency`; source is test/manual tooling or a lagged diagnostic window. Exact event: **UNRESOLVED** | `route.ts:322-329`, `confirmation:111-120`, `meta-capi.ts:143-149`; DB: no zero-value orders; `scripts/test-capi-event.ts:15-17,39-48` (test-tagged) |
| 12 | `meta-capi.ts:145` falls back to `value: 0` for Purchase | **CONFIRMED BUG (masking, introduced `48a1870`)** — converts "missing value" into "invalid zero value" instead of preventing the send | `meta-capi.ts:99-110,143-148`; diff of `48a1870` |
| 13 | Advanced matching not implemented | **OUTDATED / RULED OUT** — implemented in `e4c0b56`, verified in the live bundle; applies to logged-in users only | `MetaPixel.tsx:28-40`; live chunk `19dws9hbrlboz.js` contains `fbq("init",i.META_PIXEL_ID,{em:c.email,…})` |
| 14 | Server `event_source_url` = referer (root cause of fb.com domain diagnostic) | **CONFIRMED root cause**; fix present (`bc554dd`) and included in the deployed build — **FIX PRESENT BUT UNVERIFIED LIVE** | old code `request.headers.get("referer")` (diff of `bc554dd`); new constant `route.ts:292`; deploy inference from live `684e584` client code |
| 15 | Browser-side Pixel leaks `fb.com` as event source | **RULED OUT** at code level (no code sets a browser source URL; `fbq` derives `dl` from `document.location`) | `fpixel.ts:38-70`, `MetaPixel.tsx:42-75`; live `curl` proves the page is served from `nanos.pk`. Residual `rl`-based flagging: not verifiable locally |
| 16 | Confirmation-page 20-minute window fix | **CONFIRMED FIXED and DEPLOYED** — 20 min (`12e5` ms) vs DB `createdAt`, −5 min drift tolerance, sessionStorage secondary, storage written before firing | code `confirmation:81-99`; commit `684e584`; **live minified bundle** `t>=-3e5&&t<=12e5` + `meta_purchase_fired_${n.id}` |
| 17 | Fix is sufficient to stop **all** stale-revisit duplicates | **Partially — by design it is not total**: revisits within 20 min, and any revisit in a new tab/session/device, still fire (dedup-safe by `event_id`). It also **cannot** affect server-side counts | §5.5 |
| 18 | Server-side dev/localhost CAPI leakage | **CONFIRMED FIXED** (`NODE_ENV` guard, `b89072d`), with two caveats: a local `next start` (`NODE_ENV=production`) defeats it, and TikTok has no guard at all | `meta-capi.ts:74-89`; `.env` has no `META_TEST_EVENT_CODE`; `tiktok-events-api.ts:93-188` |
| 19 | Browser Pixel fires live events from any environment (the 172 localhost events) | **CONFIRMED BUG, not fixed** — no host/env guard anywhere; hardcoded pixel-ID fallback; mounted in root layout | `MetaPixel.tsx:13-19,41-75`; `fpixel.ts:1-2,8-31`; `layout.tsx:11,41`; grep for `NODE_ENV`/`hostname` guards → 0 |
| 20 | `fbc`/`fbp` are never persisted to the DB, so click-ID auditing is impossible | **CONFIRMED BUG (observability)** | `prisma/schema.prisma:125-171`; `route.ts:67-71,300-301`; every value in `exports/orders-2026-10-1{7,8}.json` is `null` |
| 21 | `scripts/get-todays-orders.ts` reports non-existent tracking columns as "none" | **CONFIRMED BUG (misleading tooling)** | `get-todays-orders.ts:119-120,142-143,162,173-174` vs schema |
| 22 | A second, independent Purchase sender exists in the workspace | **CONFIRMED (legacy, deployment status UNKNOWN)** | `Nanos/nanos-pk/apps/api/src/orders/orders.service.ts:187-225`; last legacy commit `a34c551` 2026-09-16; production serves the nanos-v2 app |
| 23 | Admin-created orders / courier webhooks emit Meta events | **RULED OUT** | `api/admin/orders/route.ts` has no Meta import (`:308` creates the order); `lib/postex*.ts` only update order rows; no webhook routes exist |
| 24 | Bucket (c) — Purchase events whose `event_id` matches no order | **UNRESOLVED / INSUFFICIENT EVIDENCE — cannot be computed from this repository** | no Meta export present (`find` for event/export/capi exports found only local order exports under `nanos-v2/exports/`) |

### Exact data required to close the open items

1. **Events Manager export** for pixel `969572164409296`, 15–18 Oct, columns: `event_name`, `event_id`, `event_source` (browser/server), `event_time`, `event_source_url`, `fbc`, `value`, dedup status. → closes items 6, 7, 8, 9, 24.
2. **Ads Manager column definitions** (attribution setting + ad-account timezone) for the "17 purchases" figure. → closes 7.
3. **Server access logs** from Hostinger for `POST /api/orders` on 17 Oct (count of 201 responses). → closes 6 definitively.
4. **Deployment history** for the Hostinger app (which commit was live when), plus confirmation that no legacy `nanos-pk` API process is still running. → closes 14 (fully) and 22.
5. **Meta diagnostics drill-down** for the 18 Oct "value parameters" flag and the 17 Oct "modified fbclid" flag (per-event rows). → closes 9 and 11.

### Audit hygiene

Temporary read-only scripts created for the DB queries were removed (`rm scripts/_audit_tmp.ts scripts/_audit_tmp2.ts`); `git status --short` afterwards shows only the pre-existing working-tree state (`M src/lib/meta-capi.ts` — uncommitted test-plumbing/logging diff — plus the pre-existing untracked `exports/`, `scripts/get-todays-orders.ts`, `scripts/test-capi-event.ts`). **Note for the fix ledger:** part of the CAPI work (`testEventCode` parameter plumbing and response logging in `src/lib/meta-capi.ts`) is **uncommitted**, so it is not "shipped" in any auditable sense.
