# Hosting Cost Investigation — Railway, August 2026

**Date:** 2026-08-30
**Trigger:** Repeated pushes were believed to be driving up the Railway bill.
**Outcome:** The deploy frequency was not the cause. Idle runtime CPU was, and the
fix required repairing a server build that had never worked.

---

## 1. The deployment architecture

Worth stating up front, because two of the findings only make sense against it:

| Host | Serves | Config |
| --- | --- | --- |
| **Vercel** | The static site at `nobhad.codes` (`dist/`) | `vercel.json` |
| **Railway** | The Express API and every server-rendered page | `railway.json` |

`vercel.json` rewrites a fixed set of prefixes to Railway: `/api/*`,
`/set-password`, `/forgot-password`, `/reset-password`, `/intake`, `/dashboard`,
`/portal`, `/client/*`. Everything else is served by Vercel.

The two build `dist/` independently, so asset hashes only match if the builds are
byte-identical. `server/utils/vite-assets.ts` works around this by fetching the
authoritative manifest Vercel serves and resolving hashes from it at runtime, with
the local `dist/.vite/manifest.json` as a fallback.

---

## 2. What the bill actually said

From the Railway usage dashboard, Aug 17 – Sep 17 cycle, measured 13 days in:

| Component | Amount | Share |
| --- | --- | --- |
| **CPU** | **$4.3697** | **67%** |
| RAM | $1.7720 | 27% |
| Volume | $0.0108 | ~0% |
| Egress | $0.0007 | ~0% |
| Redis service | $0.0097 | ~0% |
| `evergreen-proxy-server` (separate project) | $0.3232 | 5% |
| **Total current usage** | **$6.49** | (est. bill $11.72, Hobby plan) |

The decisive number is derived, not displayed: **9,438 vCPU-minutes over ~13 days
(18,720 minutes) = 0.50 vCPU sustained, continuously.** An idle API should sit near
0.01–0.05 vCPU. With 0.01 GB of egress across the entire period, essentially no
traffic was being served — so the CPU was being burned while idle.

Also ruled out here: Redis is provisioned but genuinely dormant (0.00 vCPU,
0.00 GB RAM), and there is no stray staging environment.

---

## 3. Findings

### 3.1 Two theories that were wrong

Recorded so they are not re-investigated.

**OpenTelemetry was not the cause.** It looked like a strong suspect:
`server/observability/index.ts` enables `instrumentation-fs` in production only
(`enabled: NODE_ENV === 'production'`), which wraps every filesystem syscall in a
span, and the server runs SQLite on a 122 MB database. Traces are also
`Disabled (no endpoint)`, so those spans are built and discarded, and metrics go to
a Prometheus endpoint nothing scrapes.

Measured over a 90-second idle window:

```
OTel ON    0.270 vCPU
OTel OFF   0.296 vCPU     ← no improvement; inside the noise
```

It does cost roughly 24% more CPU *per request* (0.97 vs 0.78 CPU-seconds over 400
requests), but with this traffic volume that is irrelevant.

**Deploy-time builds were not the cause.** Railway had no watch patterns, so every
push rebuilt the whole frontend — Tailwind, Vite, and obfuscation over 199 chunks —
producing a `dist/` Railway never serves. Real waste, but a rounding error: even 30
deploys at a few vCPU-minutes each is ~2% of 9,438.

### 3.2 The actual cause: TypeScript at runtime

`start:server` was `tsx server/app.ts`, so production transpiled TypeScript on every
boot and kept that machinery resident. A CPU sample of the idle process showed V8's
optimizing compiler (`Reducer::Reduce`, `GraphReducer::ReduceNode`) and
`MessagePort::New` active with no requests in flight.

Measured over a 120-second fully idle window, same code and database:

```
tsx server/app.ts              0.214 vCPU
node dist/server/server/...    0.091 vCPU     ← 57% lower
```

**A trivial control was misleading and nearly caused this to be dismissed:** a
hello-world HTTP server under tsx idles at 0.001 vCPU, versus 0.000 for bare node.
The cost only appears against a real module graph. Always measure the actual
application.

### 3.3 Why the compiled server could not be used

`npm run build:server` existed but produced output that would not boot. Two
independent causes:

1. **Extensionless imports.** Five relative imports inside `shared/validation/`
   omitted the file extension. Vite and tsx resolve those; plain Node ESM does not.
   The compiled server died with `ERR_MODULE_NOT_FOUND` for
   `dist/server/shared/validation/patterns`.

2. **`tsc` emits only `.js`.** Everything else the server reads at runtime was
   absent from `dist/`: 16 EJS views, 140 `.sql` migrations, 16 email templates.

Cause 2 failed *quietly*, which is the part worth remembering. A missing view makes
`res.render` fail, and the 404 route falls through to its JSON fallback — so the
HTML 404 returned a correct `404` status with a JSON body. Checking the status code
alone showed a pass. Only checking the response body revealed it.

### 3.4 The 404 page had no site shell

Separately reported, and it turned out to be load-bearing for the cost work. The
HTML 404 was served as a static `dist/404.html`, so it arrived with no header, nav
or footer, and it pinned asset hashes from Railway's own build. Because Vercel and
Railway deploy independently, those hashes go stale as soon as the frontend
redeploys without the server following — leaving the 404 linking a stylesheet the
static host no longer has.

This mattered beyond appearance: it was the last thing tying the Railway container
to `dist/`, and therefore the blocker on skipping frontend rebuilds.

### 3.5 Sentry noise

Of 11 events in the issue list, 10 were self-inflicted:

| Events | Source | Verdict |
| --- | --- | --- |
| 5 × `Server started on port …` | `server/app.ts:773` sends an **info** event on every boot | Normal deploy cadence, not a crash loop |
| 5 × 404 probes (`/api/.git/config`, `/api/.env`, `/admin/.env`) | `server/app.ts:478` sends **every** 404 as a warning | Internet scanners, all correctly 404'd |
| 1 × `Schema drift detected: added=4 modified=3` | Drift guard | See below |

The schema drift was benign: migration `137_payment_columns_alignment.sql` adds
exactly those Stripe columns and indexes, and the stored fingerprint baseline was
pre-137. The database was correct; the baseline was stale. It has not recurred
across the three boots since.

One event reported `port 4001` — the local dev default, not Railway's 8080. Sentry
initialised whenever `SENTRY_DSN` was set, and that variable lives in `.env` too, so
local runs were reporting into the production project.

---

## 4. What was implemented

| Commit | Change |
| --- | --- |
| `85087874` | 404 renders through the EJS site shell |
| `51bf61fd` | Railway watch patterns |
| `8ebc8646` | `build:server` produces runnable output |
| `fe53b001` | Production runs compiled JS instead of tsx |
| `d71e8f80` | Sentry gated to real deployments |

**404 through the shell** (`server/views/pages/404.ejs`, `server/app.ts`) — renders
via `layouts/auth`, the same shell the portal and auth pages use, resolving CSS
through the authoritative manifest so it tracks whatever Vercel currently serves.
`dist/404.html` remains a fallback if the render fails; API clients still get JSON.

> The entry is `/src/main-site.ts`, **not** `/src/static-page.ts`. The latter is an
> internal chunk of the `404.html` HTML entry rather than a manifest entry, so it
> resolves to no stylesheet at all. `main-site.ts` is what pulls in
> `styles/bundles/site.css`, which includes `pages/not-found.css`.

**Watch patterns** (`railway.json`) — deploys now only trigger on `server/**`,
`shared/**`, the lockfiles and config. Measured against the 13 commits pending at
the time: **2 of 129 changed files would trigger a deploy**, both from a dependency
bump. `shared/**` is included because it compiles into the server bundle.

**Runnable server build** (`shared/validation/*.ts`,
`scripts/copy-server-assets.mjs`) — added `.js` specifiers to the five imports, and
a script that copies views, migrations, templates and config into the compiled
output, excluding databases (runtime state on the mounted volume).

**Compiled runtime** (`package.json`, `railway.json`) — `start` and `start:server`
run `node dist/server/server/app.js`; `start:tsx` keeps the old path for a local
production-mode run; `dev:server` (tsx watch) is untouched. Railway's build command
is `npm run build && npm run build:server`.

**Sentry gate** (`server/instrument.ts`) — reporting requires
`NODE_ENV=production`, with `SENTRY_ENABLE_LOCAL=true` to opt a local run back in.

---

## 5. Verification

| Check | Result |
| --- | --- |
| Unit + integration suite | **4,400 passed**, 1 skipped, 111 files |
| Typecheck | Clean |
| Frontend build | Clean (Vite resolves the new `.js` specifiers) |
| Railway build + start simulation | Healthcheck 200, shell 404, `/portal` 302, `/intake` 200, clean boot |
| **Route registration diff** (tsx vs compiled) | **454 paths / 561 operations — identical** |
| **Every GET route probed on both** | **251 routes, 0 differences** |
| HTML route behaviour diff | 11 routes, 0 differences |
| Idle CPU | 0.214 → 0.091 vCPU (−57%) |

The route diff is the load-bearing check: the OpenAPI spec was fetched from both
servers and compared, then every documented GET route was probed against both and
status codes compared.

---

## 6. Open items

- **The remaining idle CPU is unexplained.** The compiled server still idles at
  ~0.09 vCPU where bare node measures 0.000. The tsx switch removed the larger
  share, but something in the application still runs continuously. No timer found so
  far explains it — the fastest are 30-second sweeps (SSE heartbeat, DB pool
  cleanup) and a 5-minute manifest refresh.
- **Watch patterns are unverified until a real deploy.** They were derived from
  Railway's config schema and could not be tested locally. Watch the next
  frontend-only push: if Railway still builds, they need adjusting.
- **Savings are projected, not confirmed.** All CPU figures are local. Production
  measured 0.50 vCPU against 0.214 locally for tsx, so treat 57% as the shape rather
  than a guarantee, and check the CPU line next cycle.
- **Sentry noise remains at the source.** The boot-message and 404 `captureMessage`
  calls are unchanged; only the local/production separation was fixed.
- **Set a usage limit.** No limit is configured on the Railway workspace. This caps
  spend directly rather than relying on discipline.
- **`build:server` output is not covered by CI.** Nothing catches a regression that
  makes the compiled server unbootable, which is how it broke unnoticed. A smoke
  test that boots `dist/server` and asserts a rendered HTML body (not just a status
  code) would close that gap.
- **Pre-existing lint.** 10 `curly` errors in `server/app.ts:377–406` and 1 in
  `shared/validation/schemas.ts:553`. Unrelated to this work; `npm run lint` only
  globs `src/**`, so server files are not covered.

---

## 7. Telling a deploying push from a non-deploying one

`watchPatterns` does not produce a smaller build — it decides whether Railway
deploys **at all**. The outcome is binary:

- any changed file matches a pattern → full deploy (`npm run build && npm run
  build:server`, then restart)
- no changed file matches → no deployment is created; the container keeps running
  its current image

So "frontend-only" means Railway does nothing, and Vercel alone rebuilds. That is
only safe because the server no longer reads anything out of `dist/` at runtime —
see the 404 change in section 4.

To check before pushing:

```sh
npm run railway:will-deploy              # vs origin/main
node scripts/will-railway-deploy.mjs abc123~1..abc123   # a single commit
```

It prints which changed files matched and which pattern each matched. Verified
against real history: the mobile CSS/TS commit alone does not deploy, a docs commit
alone does not deploy, and the server build fix does.

To confirm afterwards, check Railway's deploy list — a skipped push creates no new
deployment entry.

---

## 7. How to re-measure

Idle CPU is the metric that matters. Boot the server, find the process holding the
listening socket (**not** the `npx` wrapper — that was an early false zero), sample
cumulative CPU time across a fixed idle window with no requests:

```sh
pid=$(lsof -ti tcp:$PORT -sTCP:LISTEN | head -1)
# read `ps -o cputime= -p $pid`, sleep 120, read again, divide the delta by 120
```

Two traps this investigation hit:

- Measuring the `npx` wrapper instead of the node process reports 0.00.
- A trivial control script does not exercise the real module graph and will
  understate tsx's cost by two orders of magnitude.

RSS is not a usable signal here — repeated attempts varied by ±40 MB between
identical runs, swamped by SQLite paging.
