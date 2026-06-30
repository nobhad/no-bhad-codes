# Current Work - April 30, 2026

## Current System Status

**Last Updated**: April 30, 2026

### Server

- **Command**: `npm run dev:full`
- **Local**: `http://localhost:3000`

### Build

- TypeScript: 0 errors
- ESLint: 0 errors, 0 warnings
- Vite build: passing (193 chunks)

### Tests

- Integration harness: `tests/integration/helpers.ts` — temp SQLite per test, schema dump, JWT minting
- 6 integration test files passing (20 new tests, all green)
  - `intake-outbox.test.ts` — transactional commit + dedupe-key (2)
  - `idempotency-key.test.ts` — middleware contract: replay/422/length/skip (4)
  - `stripe-webhook-idempotency.test.ts` — claim/release/restart (3)
  - `circuit-breaker.test.ts` — open/4xx-skip/half-open close (3)
  - `audit-chain.test.ts` — clean/tamper/delete detection (3)
  - `system-health-endpoints.test.ts` — dashboard data sources gate + shape (5)
- Pre-existing failures unchanged: `workflow-automations.test.ts` has 2 mock gaps (not introduced)

---

## Production Portal — `/src/*.ts` 404s (dashboard JS never loaded)

**Status:** FIXED in code (`8c734c32`) — needs deploy to Vercel + Railway from this commit
**Priority:** Critical

### What happened

After login, `www.nobhad.codes/dashboard` loaded the EJS shell but the page
"didn't look right" and the console showed `GET /src/admin.ts 404` and
`GET /src/features/auth/session-expiry-handler.ts 404`. The portal React app
never mounted.

### Root cause

The server-rendered portal/dashboard and auth EJS shells emitted raw
`/src/*.ts` source paths for their entry scripts and inline module imports.
Those paths only resolve while Vite's dev server is running. In production the
frontend is a static Vite build served by Vercel, which has no `/src/*` — and
the Vite build had a single entry (`index.html`), so admin.ts / portal.ts /
the inline-import modules were never emitted as assets. Regression from
`5967a1de` (removed the portal MPA build entries when the portal moved to EJS).

### Fix

- `vite.config.ts`: `manifest: true`, the 11 server-rendered entry modules
  added as Rollup inputs, `preserveEntrySignatures: 'strict'` (keeps named
  exports for modules imported only by runtime inline `<script>` blocks).
- `server/utils/vite-assets.ts`: `viteAsset()` / `viteEntryCss()` resolve a
  source entry to `/src/*` in dev and hashed `/assets/*` (from the manifest)
  in prod. Registered as `app.locals` and used by every portal/auth EJS entry
  script, inline import, cssBundle, and initModule.

### Second bug (same code path): `process is not defined`

Once login worked, the React portal failed to mount with
`ReferenceError: process is not defined` at `isSoloMode` in
`server/config/unified-navigation.ts` (imported by the browser portal store).
It read `process.env.PORTAL_MODE` directly; `process` doesn't exist in the
browser and Vite only auto-replaces `process.env.NODE_ENV`, not custom vars.
Fixed (`87c00ccf`) by guarding with `typeof process !== 'undefined'` and
defaulting to solo. Swept the rest of the client→server import graph — no other
throwing `process.env.*` remain.

### Third bug (surfaced on deploy): non-reproducible builds → hash mismatch

After deploying the asset fix, the portal still 404'd its JS — but now on
`/assets/<entry>-<hash>.js`, not `/src/*`. Cause: the obfuscation plugin used a
random seed, so `npm run build` produced different content-hashed filenames
every run. Railway and Vercel build **independently**, so Railway's manifest
referenced hashes Vercel never built. Proven in prod: `/intake` emitted
`main-site-ke9aY9db.js` / `terminal-intake-B30Cub4c.js` → 404 on Vercel, while
CSS and tiny chunks matched (only the heavily-obfuscated chunks diverged).
Fixed (`f5e94bac`) by pinning the obfuscator `seed`; two clean builds now
produce byte-identical manifests **on the same machine**.

### Fourth bug (surfaced post-deploy): cross-host build drift → portal JS 404

Seed-pinning made builds reproducible on one machine, but Railway and Vercel
build on **different Node versions** (no pin; `engines` was `>=20.x`). The large
obfuscated chunks (`admin`, `portal`, `main-site`) came out byte-different across
hosts → different hashes; small chunks happened to match. Proven in prod: after
the `railway up` redeploy, `/intake` still 404'd `main-site` on Vercel, and
admin/portal (the authenticated dashboard's JS) diverged too — exactly the "I can
log in but it doesn't look right" symptom, since post-login the dashboard is the
Railway-rendered EJS shell loading `admin.ts`/`portal.ts`.

Root design flaw: correctness depended on **two independent builds being
byte-identical** — fragile (broke on obfuscator seed, then Node version).

**Fix (defense in depth):**

1. **Authoritative remote manifest** — `server/utils/vite-assets.ts` now resolves
   hashes in prod from the manifest Vercel actually serves
   (`${PUBLIC_ASSET_ORIGIN}/.vite/manifest.json`, default `https://www.nobhad.codes`),
   fetched at boot (`initViteAssets()` in `server/app.ts`), cached, refreshed
   every 5 min, with the local `dist` manifest as fallback. Railway now emits
   exactly the hashes Vercel serves regardless of build drift. Verified at runtime
   against live Vercel: `admin`/`portal`/`main-site` resolve to Vercel's served
   hashes (`Dpjdcnfk` / `sY8-j2SG` / `CIqsMJfl`, all 200).
2. **Node pin** — `.nvmrc` + `.node-version` = `22`, `engines.node` = `22.x`, so
   Railway (Nixpacks) and Vercel build on the same Node major → reproducible by
   construction. The remote manifest is the safety net for residual patch drift.

### Deploy

Push, then redeploy **both** Vercel and Railway. Prod-blocking fixes that must
ship together: `8c734c32` (assets), `87c00ccf` (process), `f5e94bac` (seed),
plus this commit (remote manifest + Node pin). With the remote-manifest fix the
two hosts no longer need byte-identical builds, but still deploy both from the
same commit. Verify after:
`curl -s https://www.nobhad.codes/intake` asset URLs all return 200, then log in
and confirm the dashboard renders (admin/portal JS loads).

### Fifth bug (surfaced once dashboard rendered): obfuscator breaks optional calls

After the asset fixes, the admin dashboard rendered but every data panel
(Contracts, Document Requests, Questionnaires, Invoices) showed
`TypeError: e is not a function` and an error-boundary "Try Again". Reproduced
only on the live site, never in local dev.

Root cause (proven by reading the deployed bytes + controlled rebuilds): the
`javascript-obfuscator` `controlFlowFlattening` transform — enabled at the
`standard` level — **miscompiles optional-call expressions**. It rewrites
`fn?.(args)` into an unconditional wrapped call `wrapper(fn, args)`, dropping the
`?.` nullish guard. `useDataFetch` calls `onSuccess?.(result)` after a successful
fetch; `useListFetch` passes no `onSuccess`, so the obfuscated build called
`undefined(result)` → `TypeError`, caught and surfaced as the panel error. Dev
isn't obfuscated, so `?.` survived there — hence prod-only. This silently broke
**every** optional call app-wide (`showNotification?.`, `onError?.`, etc.).

How it was isolated:

- Executed the real obfuscated `api-client` chunk in Node — `apiFetch` /
  `unwrapApiData` worked, ruling them out.
- Read the deployed `createSection-*.js` at the throw offset: found
  `i=function(e,n){return e(n)}` call-wrappers and `i(g,o)` where the source was
  `onSuccess?.(result)` — guard gone.
- Rebuilt with obfuscation off → `c?.(a)` intact. Rebuilt with only
  `controlFlowFlattening:false` → `c?.(a)` intact. Confirmed CFF is the culprit.

**Fix:** `src/utils/obfuscation-plugin.ts` — `controlFlowFlattening: false` at
all levels (it was the only transform `standard` added that touches control
flow). Identifier renaming, string splitting, `numbersToExpressions`, and
`compact` stay on, so obfuscation is still meaningful. Regression guard:
`tests/unit/utils/obfuscation-plugin.test.ts` fails if CFF is re-enabled.
Verified in the rebuilt bundle: 0 app chunks contain the call-wrapper pattern
(only 2 vendor libs have a benign native helper), 479 optional calls preserved.

Needs the same push + redeploy-both as the fourth bug (prod still runs the
CFF-on build).

---

## Production 502 — Schema-Drift Boot Crash

**Status:** RECOVERED — prod boots clean with drift guard re-armed; code fix committed (`4c114a3c`)
**Priority:** Critical

### What happened

`www.nobhad.codes/api/*` returned 502 ("Application failed to respond"). The
Vercel frontend proxies `/api/*` to the Railway service `no-bhad-codes-production`,
and that service was hard-down — `/health/live`, `/api/*`, and `/` all 502'd.
Railway build succeeded but the healthcheck never passed, so the container was
killed and retried until it gave up.

### Root cause

Boot sequence runs migrations, then schema-drift detection that throws in
production on any mismatch with the recorded baseline (`server/app.ts`).
Migration 139 (`drop projects.intake_id`) legitimately changed the `projects`
table, but the drift baseline still held the pre-139 schema. The guard flagged
the migration's own change as drift and threw **before** reaching
`recordSchemaBaseline` — so the baseline never updated and every boot
re-crashed. A permanent crash loop. Confirmed in the Railway runtime log:
`Failed to start server: Error: Schema drift detected (... modified=1) at startServer (server/app.ts:560)`.

This was a latent landmine: every schema-changing migration would brick prod the
same way.

### Fix (in code)

- [x] `server/app.ts`: track whether THIS boot applied migrations; if so,
  rebaseline to the post-migration schema instead of throwing. Out-of-band drift
  (schema changed with no migration to explain it) still fails loud. Commit
  `4c114a3c`.

### Prod recovery (Noelle, Railway CLI) — DONE 2026-06-25

The committed fix prevents recurrence but did NOT clear the existing stale
baseline (a normal boot has no pending migrations, so the old baseline still
trips the guard). Cleared it once with the escape hatch:

- [x] `railway variables --set "ACCEPT_SCHEMA_DRIFT=true"`
- [x] `railway up` (shipped the fix from the working dir) — boot accepted drift + rebaselined (19:51 UTC log: `DRIFT ACCEPTED (ACCEPT_SCHEMA_DRIFT) — rebaselining`)
- [x] Confirmed 200 on `/health/live`
- [x] `railway variables --set "ACCEPT_SCHEMA_DRIFT=false"`
- [x] `railway redeploy --yes` — booted clean (19:54 UTC log: migrations → scheduler with NO drift line), drift protection restored

### Loose ends

- [ ] `git push` — local `main` is ahead with `4c114a3c` (drift fix) and
  `8cf6a037` (contact arrow). `railway up` deploys the working dir directly,
  bypassing git, so the repo must be pushed to match what's live.

---

## Portal Streamline + Hedgewitch Invite-Prep

**Status:** SHIPPED, awaiting spot-check + one-time Drive setup

### Done in code (2026-05-01)

- [x] Nav streamline: `hideInSolo` flag + `PORTAL_MODE` env in `unified-navigation.ts`. Tagged `requests-hub` (client), `analytics`, `support` (admin), and subtabs `leads`, `contacts`, `ad-hoc-requests`, `document-requests`, `questionnaires`. Default mode is `solo` — items reappear when `PORTAL_MODE=multi`.
- [x] Migration 138: replaced 10 stale generic checklist steps on Hedgewitch's checklist (id=1) with the curated 12 pre-launch deliverables. Backup at `data/backups/pre-migration/client_portal_pre-migrate_*.db` and `data/client_portal.db.bak.before138`.
- [x] Pre-migration backup hook in `scripts/migrate.ts` — every `npm run migrate` snapshots to `data/backups/pre-migration/` first.
- [x] Off-server backup service at `server/services/drive-backup-service.ts` + CLI `npm run backup:drive`. Wired into nightly scheduler in `scheduler-service.ts` — no-op when env vars unset.
- [x] OPS_RUNBOOK updated with pre-migration backup + Google Drive offsite setup steps.
- [x] Memory file updated: Hedgewitch portal IDs (client_id=6, project_id=7, checklist_id=1), bios-done state, and "no public street address on the site" preference.

### Spot-check (Noelle, local)

- [ ] `npm run dev:full`
- [ ] Admin login — sidebar lost `Analytics` and `Knowledge`; CRM/Work/Documents subtabs trimmed
- [ ] Client view (impersonate Hedgewitch or temp account) — sidebar lost `Requests`; dashboard onboarding card shows the new 12 items; pending invoice surfaces in `ActionItems` with red alert variant
- [ ] If anything looks wrong: `cp data/client_portal.db.bak.before138 data/client_portal.db` to restore

### Google Drive offsite-backup setup (one-time, ~5 min)

- [ ] Google Cloud Console → enable **Google Drive API** in a project
- [ ] IAM → Service Accounts → create + download JSON key
- [ ] Drive → create a backup folder → share Editor permission with the service account's `client_email`
- [ ] Set Railway env vars:
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL` = JSON `client_email`
  - `GOOGLE_SERVICE_ACCOUNT_KEY` = JSON `private_key`
  - `GOOGLE_DRIVE_FOLDER_ID` = ID from the folder's share URL
- [ ] Local sanity test: `npm run db:backup && npm run backup:drive` — file lands in Drive
- [ ] Confirm production: tail Railway logs for `DB backup uploaded to Drive` after 03:30 UTC

### Then send the actual invite

- [ ] Send invite email to `offerings@hedgewitchhorticulture.com` (Emily & Abby) from admin → Clients → Hedgewitch
- [ ] Confirm invite arrives + magic link opens the portal
- [ ] Walk the portal cold as them once before they get to it; fix anything jarring

### Deferred / nice-to-have (not blocking)

- [ ] Category headers on the OnboardingCard (Approvals / Team / Imagery / Business). Currently the 12 items render as a flat ordered list. Requires a `category` column migration + small `OnboardingCard.tsx` change.
- [ ] Pre-filtered deep links from each upload row to the right Files folder (e.g., `?folder=headshots`). Today they land on Files generically.
- [ ] Verify the `data/backups/weekly/` directory is empty by design or the Sunday-weekly path in `scripts/backup-database.ts` isn't firing — pick a behavior.
- [ ] Drop the `LocalBusiness` schema street-address field on the Hedgewitch Astro site (locality-only Fitchburg, MA).

---

## State of the Art Roadmap

**Status:** COMPLETE — Phase 0-6 DONE, Phase 1.5 DONE, Phase 7 deferred
**Full plan:** [docs/STATE_OF_THE_ART_ROADMAP.md](./docs/STATE_OF_THE_ART_ROADMAP.md)

Gap analysis + codebase audit. 8 phases, 14 migrations (118-130). All phases complete.

### Phase 0: Foundation Fixes (MUST DO FIRST) — COMPLETE

All items verified against actual code. ~~0A~~, ~~0H~~, ~~0I~~ removed (proved false on re-audit).

**Critical (blocks Phase 1):**

- [x] 0B. Client proposal detail view + acceptance UI
- [x] 0C. Maintenance tier activation
- [x] 0D. Portal contract signing
- [x] 0G. Installment to invoice cascade

**High (broken integrations):**

- [x] 0E. Webhook dispatch
- [x] 0F. Email templates
- [x] 0K. Admin invoices
- [x] 0L. Create backends

**Medium (UI completeness):**

- [x] 0J. Export/CSV
- [x] ~~0M. LeadDetailPanel~~ — already wired
- [x] 0P. Prefill + admin invoices in frontend constants

**Low (docs + security):**

- [x] ~~0N. Design docs~~ — already exist
- [x] 0O. Security hardening

### Phase 1: Unified Client Experience — COMPLETE (core)

- [x] 1-Pre. Idempotency guards (milestone generation check in workflow-automations.ts)
- [x] 1A. In-Portal Contract Signing (verified — ContractSignModal, POST /sign, PortalContracts all working)
- [x] 1B. Embedded Stripe Payments (migration 119, StripePaymentService, PaymentElement, processing fee breakdown)
- [x] 1C. Unified Project Agreement Flow (migration 120, AgreementService, AgreementFlow vertical card stack with GSAP)
- [x] 1D. Guided Client Onboarding Checklist (migration 121, OnboardingChecklistService, OnboardingCard dashboard widget)

### Phase 1.5: Deferred Enhancements — COMPLETE

- [x] Auto-pay (migration 130, autoPayService, saved methods CRUD, auto-charge cron at 6AM, retry queue hourly, 3 retries with 24/48/72h delays, client portal AutoPaySettings UI)
- [x] Agreement admin drag-to-reorder builder (AgreementBuilder admin UI with step reorder via up/down arrows, create/send/cancel/set-expiration actions)
- [x] Onboarding admin template CRUD UI (OnboardingTemplatesManager with create/edit/delete templates, step editor with reorder)
- [x] Upload mode for signature (SignatureCanvas now supports draw/type/upload, accepts PNG/JPEG/WebP up to 5MB)
- [x] Agreement expiration cron (30-day default expiry, 7d and 3d email reminders, auto-expire, scheduler at 9:30AM daily)

### Phase 2: Lead Nurture — COMPLETE

- [x] 2A. Email Drip Sequences (migration 122, sequenceService with processQueue, scheduler cron, workflow auto-enrollment, admin UI)
- [x] 2B. Meeting Request System (migration 123, meetingRequestService with ICS generation, reminders cron, portal + admin UI)

### Phase 3: Admin Self-Service — COMPLETE

- [x] 3A. Automation Engine (migration 124, 11 action types, condition evaluation, wait-step scheduling, dry-run)
- [x] 3B. Automation Builder (AutomationsTable, AutomationBuilder with action config forms, AutomationDetailPanel with run history)

### Phase 4: Revenue Intelligence — COMPLETE

- [x] 4A. Expense Tracking + Project Profitability (migration 125, expenseService, profitability calc, CSV export, admin table)
- [x] 4B. Retainer / Recurring Project Management (migration 126, retainerService, period lifecycle, rollover, auto-invoicing + usage alert crons, admin + portal UI)

### Phase 5: Post-Project — COMPLETE

- [x] 5A. Feedback Surveys + Testimonial Collection (migration 127, feedbackService 16 methods, 9 admin + 1 portal + 4 public endpoints, 4 React components, 2 scheduler crons)
- [x] 5B. Embeddable Widgets (migration 128, embedService, 7 admin + 4 public endpoints, widget JS generation for contact/testimonials/status, admin UI)

### Phase 6: AI-Powered — COMPLETE

- [x] 6A. AI Proposal Drafting (migration 129, aiService with budget/rate/cache, Anthropic SDK, admin draft endpoint)
- [x] 6B. AI Email Response Drafting (draftEmail with thread/project context, admin endpoint)
- [x] 6C. Semantic Search (enhanced search-service 9 entity types, relevance scoring, SearchModal Cmd+K)

### Phase 7: International — DEFERRED

- [ ] ~~7A. Multi-Currency Support~~ — Not needed currently
- [ ] ~~7B. Tax Jurisdiction Handling~~ — Not needed currently

---

## Main Site Navigation Direction

**Status:** IN PROGRESS

- [x] **Horizontal scroll-map nav model — SHIPPED.** Pages on a 2D map (intro centre, about up, projects right, contact down); scroll / two-finger swipe / arrow keys pan the camera with slide transitions, nav-menu + direct hash links use the blur crossfade, paw stays sovereign for intro entry. Carousel order: intro ↔ about ↔ projects ↔ contact. **Final input model (2026-06-25):** vertical OR horizontal scroll navigates on intro/about/contact; projects vertical = channel-surf (leave via horizontal swipe or Shift+wheel); Shift+wheel = mouse-wheel parity; project-detail vertical native-scrolls then navigates at the edge, left/right cycles projects; projects→detail slides DOWN. Full matrix in `docs/design/MAIN_SITE_DESIGN.md` › Page Transitions.
- [x] **Reincorporate tech-stack content** — direction locked: chunked GSAP "title-card runway" animation that fires during horizontal scroll-map transitions. Data shipped 2026-04-30: `Profile.techStack` is now a `TechStackChunk[]` (4 chunks of 8) in `public/data/portfolio.json:434-499`, type at `src/services/data-service.ts:42-58`. Chunks keyed to actual horizontal edges of the scroll-map: `intro-about` (Languages & Frameworks), `about-projects` (Styling, UI & Motion), `projects-contact` (Backend & Data), `contact-intro` (Tooling, Testing & Ship). Original 43-item marquee list reconciled against 2026-04-30 deps audit: 10 stale items dropped (PHP, Vue, jQuery, Bootstrap, Vuetify, Handlebars, MongoDB, MySQL, Mongoose, Jotai); 12 added (Astro, Three.js, OpenType.js, Lucide, Radix UI, Chart.js, Multer, Vercel, Netlify, Anthropic SDK, Stripe, Zod). Final count: 32 items.
- [ ] **Implement tech-stack runway animation** — GSAP timeline on horizontal map→map transitions. Single integration point: `src/modules/animation/page-transition.ts:1985` inside the bridge-slide block (every horizontal map slide flows through there). Touch list:
  - Create `src/modules/animation/tech-stack-runway.ts` (singleton, exposes `play(opts)` returning timeline promise; owns reverse/interrupt logic via `currentTimeline.reverse()` for inverse direction, `kill()` otherwise).
  - Create `src/styles/components/tech-stack-runway.css` (overlay scaffolding only — `position: fixed; inset: 0; pointer-events: none`; structural sizing, will-change, mobile hide via `@media (max-width: 767px)`; all motion is GSAP).
  - Modify `src/modules/animation/page-transition.ts` — single `await TechStackRunway.play({ fromId, toId, direction, sourceEl, targetEl })` between line 1985 and 2011, guarded by `isHorizontal && fromIsMap && toIsMap && !this.reducedMotion`.
  - Modify `src/styles/bundles/site.css` — one `@import "../components/tech-stack-runway.css" layer(states);` between lines 70–71.
  - Inject overlay markup via JS on first `play()` (vanilla TS, not React): `<div class="tech-runway"><div class="tech-runway__heading"><span class="tech-runway__heading-text"></span></div><ul class="tech-runway__items"><li>×8</li></ul></div>` appended to `#main-content`.
  - **Timeline envelope: ~1.0s** total (`PAGE_ANIMATION.SLIDE_DURATION` is 0.55s, so first 0.55s races camera, trailing 0.45s settles+clears on destination):
    - 0.00s — heading enters from leading edge oversized (`clamp(8rem, 16vw, 20rem)`, Acme, 900 weight, condensed), `xPercent: dir*-120 → 0`, `scaleX: 0.7 → 1`, blur 8 → 0, duration 0.18s, `power3.out`.
    - 0.26s — heading explodes/fades: `xPercent: dir*30`, `scaleX: 1.4`, opacity → 0, blur → 12, duration 0.16s, `power2.in`.
    - 0.16s — items fly in (slight overlap with heading-out), `xPercent: dir*-160 → 0`, `stagger: { each: 0.035, from: dir > 0 ? 'start' : 'end' }`, duration 0.42s.
    - ~0.60s — items decelerate to thin ticker on destination's leading margin: `scale: 0.55, y: '38vh'`, duration 0.18s, `power2.out`.
    - ~0.83s — fade overlay `opacity: 0`, duration 0.20s.
  - Data wiring: `dataService.getProfile().techStack`, lookup chunk by sorted tile-pair key (`[fromId, toId].sort().join('|')`).
  - Open risks: (1) z-index — runway must sit at `--z-index-overlay` *below* `#intro-morph-overlay` so the paw isn't covered (verify in `intro-morph.css`); (2) Acme font preload check in `templates/partials/head.ejs` to avoid FOUT on the oversized heading; (3) reverse during heading-explode window (~0.26s–0.42s) looks weird in v1 — accept as known trade-off, future polish via timeline labels.
  - v1 scope: horizontal only. Vertical (`intro↔hero`, `intro↔contact` with `hero` as a separate up-arm) deferred — same pattern with axis swap.
- [x] **Pike portfolio entry — WON'T DO** (decided 2026-06-12). Not adding Pike Powder Coating to the portfolio. The project still lives at `/Users/noellebhaduri/Projects/Development/Active/pike` (5,607 LOC, designed + built, client opted not to launch) with its design docs, but it's not going on the No Bhad Codes site.

---

## TV Channel System (Projects Page)

**Status:** SHIPPED v1 — outstanding polish + features below

The projects page renders a vintage TV with a channel-guide screen. Channel 01 is the guide itself; channels 02+ are individual project tune-ins. Selecting (Enter / click / wheel-cycle to a project channel) plays a static burst, fades the composed title card in, fades to the bg-only image, then auto-cycles through case-study panels (Details → Tagline → Intro → Challenge → Approach → Key Features → Results → Tools → Outro). Outro panel sticks with a click-through link to the existing project-detail page.

### Open Mobile Bugs (paused at end of day, pick up next session)

- [x] **Business card hovers over every section after navigating left/right through all pages the first time.** Root cause: `restoreIntroCardState()` in `page-transition.ts:431` was setting inline `visibility: visible` on `#svg-business-card` — an SVG that lives inside the body-level fixed `#intro-morph-overlay`. CSS spec: a child's `visibility: visible` overrides a parent's `visibility: hidden`, so even though `hideMorphOverlay()` kept hiding the overlay container, the card child painted through it on every subsequent tile. Bug was dormant until the user navigated *back* to intro at least once (which is when `restoreIntroCardState` runs), then *away* again — matching the "after first scroll through" repro. Three secondary leaks fixed alongside: (a) mobile `completeMorphAnimation` now clears the inline `display: flex`/`opacity: 1` it set at intro start (was leaving the hide resting on a single inline `visibility: hidden`); (b) desktop `playEntryAnimation` now re-adds `intro-complete`/`intro-finished` at completion (was stripping them at start, never restoring — so the `.intro-complete .intro-morph-overlay` hide rule stopped applying after a back-to-intro paw entry); (c) the mobile media query in `intro-morph.css` now scopes its `display:flex; opacity:1; visibility:visible` re-assertion to `html.intro-loading` (was unconditional, would override any post-completion hide). Files: `page-transition.ts`, `intro-animation.ts`, `intro-animation-mobile.ts`, `components/intro-morph.css`.
- [x] **TV not horizontally centered on mobile.** Root cause: `.crt-tv` width was `min(1240px, …, 98vw)`. On mobile `98vw` evaluated wider than the wrap's content box (`.projects-tv-wrap` had horizontal padding), so the TV overflowed under flex centering and read as right-shifted. Fix: dropped the `98vw` cap from the base rule (now relies on `max-width: 100%` to fit the wrap's content box) and zeroed the wrap's horizontal padding on mobile. Removed all `!important` overrides.
- [x] **Channel rows still showing on mobile** — obsoleted by redesign. Mobile guide now intentionally shows the rows (with smaller typography) alongside the new `.crt-tv__guide-top` brand pane; the old hide rule was removed.
- [x] **Contact page bg + avatar missing on mobile.** Two root causes fixed: (1) `.contact-section` mobile rule had `background-color: var(--color-neutral-300)` which painted over `body::before` (the parchment overlay) — removed it. (2) The `--laptop-wide` (max-width: 1100px) rule on `.contact-bg-avatar` set `opacity: 0.06`, which also matched on mobile and multiplied with the inner SVG part opacities (`#MAIN/#NOSE/#EAR` at 0.12, `#EYE` at 0.5) down to ~0.007 effective — invisible. Mobile rule now explicitly resets `opacity: 1` so the inner-path opacities control the watermark fade as designed.

### Outstanding TODOs

- [x] **Wire up the TV's physical buttons** — POWER toggles screen on/off; CHANNEL ▲▼ cycles channels mirroring wheel/arrow keys; VOLUME ▲▼ wired to tv-sfx (5-step volume, persisted to localStorage).
- [x] **Re-export TV assets at 1426×1093** — all per-project bgs, composed title cards, channel digit overlays, and title-card base now exported at full TV-frame canvas with hyphenated filenames. Stacks at `inset:0; width/height:100%`, no centering math. Old underscored set deleted.
- [ ] **Re-align the base screen artwork** — base bbox `(100, 95, 1137, 864)` is ~6px wider on each side than the per-project cards `(106, 95, 1131, 864)`. Causes a small visible jump when cycling between channel 01 and 02+. Re-export from the same artboard origin as the project cards so artwork lands at x:106-1131. NOTE: the old `title-card_base.webp` no longer exists — the base screen now lives as `public/images/tv/base-on.webp` / `base-off.webp` (introduced 2026-04-30, `76f66a37`); re-export targets those two files.
- [x] **Update "No Bhad Codes" case study copy** — keyFeature `"CRT TV hover preview"` replaced, scroll-map + TV channel guide added, approach paragraph rewritten to mention signature features.
- [x] **Verify Hedgewitch and The Backend case studies** — Backend feature claims verified against actual code (`013_magic_link.sql`, `message-service.ts`, Chart.js, node-cron, etc.). Hedgewitch is a separate project — copy reads accurately.
- [x] **TV channel copy condensed** — added `tv` namespace per project. TV reads from `tv.X ?? X`. All three documented projects have curated TV copy.
- [x] **Trace root cause of arrow-key native page scroll** — `page-transition.ts:handleKeydown` only called `preventDefault` after navigation gates (`isTransitioning`, `!introComplete`, `canNavigate`); during those windows the browser native-scrolled. Fix: moved `preventDefault` before the gates so any arrow key on a managed page is unconditionally swallowed (form inputs still opt out). Backup window-listener in `projects.ts` and the `isOnProjectsPage()` helper that supported it have been removed.
- [x] **Channel-change static crackle + channel-up beep** — implemented as `src/modules/audio/tv-sfx.ts` (procedural WebAudio synthesis, no asset files). Static = filtered white-noise burst, beep = 880Hz sine. Master gain via 5-step volume tied to VOLUME ▲▼ buttons.
- [x] **Mobile TV** — TV is fully responsive at all widths; channel-rows visible with smaller typography, button hit area extended, full-width on phones. No mobile fallback needed.
- [x] **Channel 01 redesigned as Prevue Guide layout** — top split (brand info + glowing-eye avatar with inlined eye-glow filter); bottom slow ticker of project rows (rendered twice, GSAP translates the inner ul up at ~16 px/sec for a seamless loop).
- [x] **Documentation: refreshed `MAIN_SITE_DESIGN.md`** (2026-06-25) — rewrote Page Transitions (scroll-map + input matrix + slide directions), added a Contact Form section (placeholders-as-labels + CSRF), updated the Page Architecture mobile section and the contact-animation module descriptions (here + `ANIMATIONS.md`).

### Recent shipped (this session)

- Vintage TV frame with transparent screen aperture (replaces previous CRT)
- Per-project background images and structured `titleCard` data in portfolio.json
- Title card composed → bg crossfade animation
- Per-panel fade cycle with heading-flash treatment for "The Challenge" / "The Approach"
- LED channel display overlay (channel_01.webp ... channel_10.webp) syncs with active channel
- Channel-list in 4-column grid with category subtitles, "01 PROJECTS" highlighted by default
- Per-card text colors (true black or true white) drive panel typography
- Theme-independent TV interior (hardcoded #fff / #1a1a1a, no light/dark flipping)
- Per-panel hold timing map (paragraphs 9s, lists 7s, tagline 4s, etc.)
- Esc cancels active tune-in; click-through link in outro panel preserves detail-page navigation
- First-person voice in approach sections; "magic links" parenthetical stripped from TV render only

---

## Session 2026-06-12 — Mobile / Contact / Intro / Audio fixes

**Status:** SHIPPED (committed; two items await on-device confirmation)

### Shipped

- **Contact form placeholders visible** (`89364621`) — labels are `display:none` by design (the placeholders ARE the field names), but `--placeholder-opacity` defaulted to `0` from a removed fade-in animation, so desktop rendered empty field boxes. Defaulted to `1` in `src/styles/pages/contact.css` (mobile was already patched).
- **Intro paw-morph NaN guard** (`89364621`) — `calculateSvgAlignment` divided `0/0` when the card/overlay measured 0 (deep-load to a non-intro page, or the collapsed small-mobile layout), writing `transform="translate(NaN, NaN)"` and throwing on navigation. Both morph builders in `intro-animation.ts` now skip the morph when alignment isn't finite. Verified 0 console errors, desktop + mobile.
- **TV ticker on mobile + centering** (`5030e1b1`) — lifted the `<=479px` ticker guard and restart it from a `ResizeObserver` on the guide viewport (fires once the TV lays out from 0 height). Chevrons moved to a SIBLING of the TV wrap so the `translate(-50%,-50%)` centering no longer drags them off-screen.
- **Small-mobile pivot + iOS overscroll + TV audio isolation** (`7a2b23ff`) — landed the discrete-tile small-mobile architecture; `overscroll-behavior: contain` on the tile scroller + `none` on `html`/`body` to stop iOS rubber-banding the fixed header; and `transitionTo` now syncs `currentPageId` in its `catch` so a thrown animation can't leave it stale on the source page.

### Awaiting on-device confirmation

- [ ] **Off-page channel cycling / audio bleed** — root cause: stale `currentPageId` from a thrown transition animation let the wheel cycle TV channels (and restart channel music) on other pages. Fixed in `7a2b23ff`. Confirm on device: trackpad on contact should NOT change channels or start music. If it recurs, check console for `[PageTransitionModule] Transition failed:` — present means the fix is firing, absent means a second desync path remains.
- [ ] **iOS overscroll** — confirm the fixed header no longer rubber-bands on a real iPhone.

---

## Session 2026-06-25 — Scroll/nav model + contact form

### Shipped

- **Contact form submits again** (`c2c95cfc`) — was failing with `403 CSRF_TOKEN_INVALID`. `ContactService.submitToCustom` never sent the `x-csrf-token` header, and on a cold visit the `csrf-token` cookie isn't set yet. Now sends the header (shared `getCsrfToken`) with `credentials:'include'` and primes the cookie via `GET /api/health` first. Verified end-to-end without sending a real email.
- **Scroll/nav model finalised** (`0366358b`, `13b295e9`, `21c53175`) — vertical OR horizontal scroll navigates the carousel on intro/about/contact; projects vertical = channel-surf; `Shift+wheel` = mouse-wheel parity (reads whichever axis the browser populates); project-detail vertical scrolls then navigates at the edge, left/right cycles projects. (Went back and forth on this — current state is "any scroll navigates except projects = channel".)
- **projects → project-detail slides DOWN** (`13b295e9`) — TV scrolls up and out, detail pushes up from the bottom (was sliding in from the right). Detail↔detail left/right carousel unchanged.
- **Click a playing TV screen → project detail** (`16476f9b`) — same tab, instead of the live link opening a new tab. The explicit "Live: url" link still opens the live site.
- **Main-site doc sweep** (`d19ec5f4`, `f2cc340c`) — audited 12 main-site docs vs code (4 parallel agents); corrected mobile-intro-is-a-morph-not-a-flip, the localStorage replay gate, typography clamps, nav z-index, TV chassis dims + hitbox table, mobile ticker, projects→detail down, contact placeholders/CSRF, `@custom-media` location, `--font-family-body`, EMBED service method names.
- **Removed the entire dead hero stack.** First the 4 dead JS modules (`about-hero.ts`, `page-hero.ts`, `base-hero-animation.ts`, `avatar-intro.ts` — none instantiated/registered/imported by live code). Then the dormant hero-text feature too: `text-animation.ts` only animated the `#hero` `.text-animation-svg`, but `#hero` is `page-hidden` and unreachable (not in `pageConfigs`, no carousel neighbor, no route), so the effect never showed. Deleted `text-animation.ts` + its `modules-config` registration, the `#hero` `<section>` in `index.html`, the phantom `hero`/`left` entries in `MAP_TILES`/`CAMERA_POSITIONS`/`TILE_CSS_POSITIONS`/`NEIGHBORS`, and all the dead `.hero-section` / `.text-animation-svg` / `.*-hero-desktop` CSS across 6 files. ~1,200 LOC removed. Verified: tsc + eslint + `npm run build` clean, site loads, carousel nav works, 0 console errors. (`--color-svg-text-*` tokens kept — still used by `intro-morph.css`.)

### Portal doc sweep (2026-06-25) — uncommitted

- **Audited the full portal doc set vs code** — 57 docs across `docs/features/`, `docs/design/`, `docs/architecture/`, `docs/API_DOCUMENTATION.md` (9 parallel read-only audit agents, then 7 parallel fix agents on disjoint file sets, verify-then-edit). **35 docs corrected, markdown lint-clean, zero code touched.** No commit yet.
- **Big cross-cutting correction:** the portal DB is **SQLite** (`data/client_portal.db`), not Postgres/Supabase — confirmed against `server/database/init.ts`. Docs that said SQLite were correct and left alone. (Saved to auto-memory.)
- **High-drift docs rewritten to match source:** `DELIVERABLES.md` (whole schema/API was fictional — fixed to mig 073 + real routes), `CONTACTS.md` (nearly all endpoints/schema wrong — `/api/admin/contacts*`, statuses `new/read/replied/archived`, no convert-to-lead), `AD_HOC_REQUESTS.md` (nonexistent `ad_hoc_request_attachments`/`pricing_strategy`, `:id`→`:requestId`), `CLIENT_INFORMATION.md` (`onboarding_sessions`→`client_onboarding`, `/api/onboarding/*`→`/api/client-info/*`), `DOCUMENT_REQUESTS.md`, `TIME_TRACKING.md` (wrong columns, nonexistent chart), `KNOWLEDGE_BASE.md`, `STATUS_SYSTEM.md` (retired `planning`/`review`→real 7-value project enum; added `--status-new`/`--status-on-hold` tokens).
- **"Planned" features that were actually already built** corrected to implemented: file-sharing (`FILES.md`), questionnaire PDF export (`QUESTIONNAIRES.md`), webhooks (`API_DOCUMENTATION.md`).
- **Stale counts/paths/signatures** fixed across `AI_FEATURES.md` (8 not 9 search entities), `ANALYTICS.md` (method signatures), `DATA_QUALITY.md`, `CUSTOM_AUTOMATIONS.md`, `PROPOSALS.md`/`PROPOSAL_BUILDER.md` (5 project types, mig 047), `UX_GUIDELINES.md` (breakpoints, `--font-size-lg/xl`), `DATABASE_SCHEMA.md` (135→139 migrations), `MODULE_DEPENDENCIES.md` (purged the deleted hero/text-animation modules), `PORTAL_ARCHITECTURE.md` (auth validates via `/api/auth/validate`).
- **Added** a `markdown-to-pdf.ts` contract-generator section to `PDF_GENERATION.md` (was entirely absent).
- **Archived two wholesale-stale design docs** — `WIREFRAME_AND_COMPONENTS.md` (pre-React vanilla audit) and `ANALYTICS_UI.md` (a since-built proposal) moved to `docs/archive/design/` via `git mv`; the `DESIGN_SYSTEM.md` index rows and the two `WIREFRAMES.md` cross-links were repointed and marked **Archived**. No dangling links remain.

### Awaiting on-device confirmation (real mouse)

- [ ] **Shift+wheel direction feel** — uses the app's natural-scroll sign convention; if Shift+wheel-up goes the "wrong way" on a physical mouse, it's a one-line sign flip.

---

## PDF Deep Dive

**Status:** PARTIALLY COMPLETE

- [x] Label bolding — parseInlineBold() + drawInlineBoldText() in markdown-to-pdf.ts
- [x] SOW header — removed unused `sowLogoHeight: 50` constant, all generators use standard 100pt
- [x] Margin alignment — markdown-to-pdf.ts margins updated from 45pt to 54pt (matches all other generators)
- [ ] Full formatting review (spacing, table layouts, typography consistency across all 6 PDF types)

---

## Portfolio Capture Script

**Status:** MOSTLY WORKING — one fix awaiting verification

`scripts/capture-portfolio.ts` (renamed from `take-screenshots.ts`) captures public + authenticated screenshots and video walkthroughs of the site. Reads creds from `.env` (`ADMIN_EMAIL`/`ADMIN_PASSWORD` for admin, `PORTAL_EMAIL`/`PORTAL_PASSWORD` for client). Modes: `--screenshots`, `--video`, `--all` (default).

### Done

- [x] Renamed `take-screenshots.ts` → `capture-portfolio.ts`
- [x] CLI mode flags (`--screenshots` / `--video` / `--all`)
- [x] Unified login flow via `/#/portal` dropdown (`POST /api/auth/portal-login`); single helper `loginAs(email, password)` works for both roles
- [x] Auth page paths corrected to `/dashboard#/<tab>` for both roles
- [x] Login-once-per-role refactor: one login per role per run, browser context reused across all viewport+theme captures (was 8/role → caused rate-limit 429s and broke mobile login because `#portal-trigger` is hidden behind hamburger on mobile)
- [x] Login always runs at desktop viewport before resizing — mobile auth now works
- [x] `PORTAL_EMAIL` / `PORTAL_PASSWORD` placeholder keys added to `.env.example`; real values in local `.env` (gitignored)

### Open

- [ ] **Verify `setTheme` localStorage try/catch fix** — client video walkthroughs were dropping pages mid-sequence with `SecurityError: Failed to read the 'localStorage' property from 'Window'` during transitional/sandboxed states. Wrapped `localStorage.setItem` in try/catch (`scripts/capture-portfolio.ts:104`); `data-theme` attribute alone drives theming. Re-run `npx tsx scripts/capture-portfolio.ts --video` and confirm no SecurityErrors in client walkthroughs.
- [ ] **Rotate the two account passwords that were pasted in chat on 2026-04-30** — admin `nobhaduri@gmail.com` and client `nmbhaduri@gmail.com`. After rotating, update `ADMIN_PASSWORD` and `PORTAL_PASSWORD` in local `.env`. Reminder routine `trig_014SxD3PRfVZcZUGwfA7Kz8y` fires 2026-05-01 at 9 PM EDT.

### Notes

- Auth API rate limit (`createRateLimiter` in `server/middleware/rate-limiter.ts`) is in-memory; restarting `npm run dev:full` clears any 429 block.
- `/dashboard#/invoices` redirects to `/dashboard#/documents` on the client side — captured filename still says `portal-invoices`.

---

## Archived Work

Previous work moved to: [ARCHIVED_WORK_2026-03.md](./docs/archive/work-logs/ARCHIVED_WORK_2026-03.md)
