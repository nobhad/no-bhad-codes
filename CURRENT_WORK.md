# Current Work - August 29, 2026

---

## Channel music: surface noise, unbalanced levels

**Status:** OPEN
**Priority:** Low — cosmetic, but it is the first thing you hear on a channel

The crackle over the project channels is **in the recordings**, not in the
sound effects. All three are Library of Congress National Jukebox releases
(`42ed88de`) — acoustic-era 78rpm transfers, so surface noise comes with them.
Measured (RMS, and a high-frequency-energy ratio standing in for hiss):

| file | channel | RMS | HF ratio |
| --- | --- | --- | --- |
| `the-broken-hearted-sparrow.mp3` | 02 nobhad-codes | 0.054 | 0.537 |
| `anvil-chorus.mp3` | 03 the-backend | 0.058 | 0.601 |
| `roses-at-twilight.mp3` | 04 hedgewitch | 0.115 | 0.168 |
| `tv-static.mp3` (for scale) | — | 0.160 | 0.480 |

Two problems in one: the first two carry **as much broadband noise as the TV
static sample itself**, and they sit at **half the level** of the third, so the
hiss reads forward of the melody and the channels do not match each other.

Turning the crackle SFX down does nothing for this — that was chased and
reverted (`13d2dc37`). The SFX gains are back at their original values:
power-on 0.18, channel-change 0.12.

**Do not de-noise them the way it was tried.** `afftdn` plus an 8dB high shelf
flattens the recordings — it takes the air out along with the hiss and they
stop sounding like old records. Reverted in `e9ef3491`; measurements from that
attempt are in the commit if useful.

Worth trying, roughly in order:

- [ ] **Gain-only balance first.** No filtering, no compression, nothing that
      changes tone: `+6.6 dB` on the sparrow and `+5.9 dB` on the anvil brings
      all three to the same RMS. It does not remove hiss, but it stops one
      channel being obviously quieter and noisier than the next, which may be
      the whole of what is wrong.
- [ ] **Look for better transfers of the same performances.** National Jukebox
      has re-transferred parts of its catalogue; a cleaner master solves this
      at the source with no processing at all.
- [ ] **Or pick different public-domain tracks** for channels 02 and 03 with
      transfers closer to `roses-at-twilight`, which is clean enough that it
      needs nothing.
- [ ] If processing is unavoidable, de-noise *gently* and never touch the top
      end: no high shelf, and audition against the original before keeping it.

---

## Open items from the Aug 29 session

**Status:** OPEN
**Priority:** Medium

Carried out of the footer-curtain / lint / Prettier session. Nothing here
blocks anything; they are the loose ends that session left.

- [ ] **E2E suite runs now, and is red.** The launch problem is fixed —
      `playwright.config.ts` uses `channel: 'chrome'`, so no download is needed
      — and two stale assumptions in `navigation.spec.ts` are corrected: it
      waited for `[data-nav]` to be *visible* when the menu starts closed and
      the element is `display:none`, and it asserted pre-router paths
      (`a[href="#about"]`, URL `/#about`) when routes have been `#/about` since
      the scroll-map landed, with five menu links rather than three.
      What is left is not those edits. **The app is fine when driven by hand**
      — menu opens on click, five links, overlay present, verified in a real
      browser — so the remaining failures are test-side. Two signals point at
      the environment rather than the assertions: the same suite ran in 8.5s
      once and 15.9 minutes the next time, and `back/forward` passed in one run
      and failed in the next without being touched. The config's `webServer`
      starts `npm run dev:full` (vite + tsx + tailwind watch) even when a dev
      server is already up, which is the first thing to look at. Give it a
      dedicated pass with nothing else running.
- [ ] **Eleven commits unpushed, and live is behind them.** Includes both TV
      click fixes — the deployed site still opens a new tab when you click the
      title card. Push, then deploy; four older "fixed in code, needs deploy"
      items ride along (projects media, portal `/src/*.ts` 404s, and migrations
      140/141 which need Railway).
- [ ] **The curtain was only ever driven by synthetic and Playwright wheel
      events.** A real trackpad's momentum tail is the one input profile that
      was never exercised. `CURTAIN_SETTLE_MS` (120ms of quiet before the band
      commits to an end) is the constant most likely to need tuning against
      real hardware — momentum arrives as a long decaying burst, and if a gap
      inside that burst exceeds 120ms the band would settle mid-gesture.
- [ ] **`curly` is no longer enforced.** `eslint-config-prettier` switches it
      off, because Prettier decides line breaking and `curly: multi-line` then
      argues with the result. Restore it as `['error', 'all']` if the loss
      matters; that requires adding braces at the handful of sites that
      currently rely on the single-line form.
- [ ] **`npm audit` reports vulnerabilities** in production dependencies. Not
      looked at — a separate job with its own blast radius.

Deliberate, recorded so they do not read as oversights:

- `uploads/` is out of the markdownlint run. It holds client documents served
  by the portal (the Hedgewitch proposal among them); reformatting one to
  satisfy a linter edits a deliverable, not a doc.
- `server/templates/email/` is out of the Prettier run — see the note in
  `.prettierignore` for why.

---

## Scroll-reveal black footer curtain (Aug 27, 2026)

**Status:** DONE — verified in the browser on project detail pages
**Priority:** Medium

A black footer band with the avatar that stays hidden until the active page
runs out of scroll, then rises like a curtain.

### Why it needed a module and not just CSS

The site is a virtual-page map: `<main>` is fixed and each tile
(`.site-map > [data-map-tile]`) owns its own overflow, while project-detail
un-fixes the header/footer and scrolls the whole document. There is no single
scroll container to hang a ScrollTrigger off, so `FooterCurtainModule`
(`src/modules/ui/footer-curtain.ts`) listens for `scroll` in the **capture**
phase on `document` — scroll doesn't bubble, but capture listeners on
ancestors still fire — and treats whichever element scrolled as the scroller.

### How the reveal works

- One paused GSAP timeline (`ease: 'none'`, one unit long) holds the whole
  reveal; a `power3.out` tween eases a plain number that is pushed into
  `timeline.progress()` each tick. Scrubbed against the last curtain-height of
  travel, so the panel rises *with* the scroll instead of popping in.
- Retraction eases exactly like the reveal (see Aug 29 below — it used to snap,
  and the reason it had to no longer exists).
- The strip the band lands on is kept blank by each tile's own **static**
  bottom padding. The module writes no layout at all (see Aug 29 below — it
  used to grow the scroller's `padding-bottom` with the reveal, which fed back
  into its own retract test).
- A `MutationObserver` on `main[data-active-page]` plus `hashchange` resets
  progress and strips the padding on every route change. Leaving the padding
  behind would keep the document overflowing at its old length with nothing
  left to scroll, stranding the curtain open.

### Gotchas hit along the way

- `.footer-curtain` must be `position: fixed`, not `absolute`.
  `pages/projects-detail.css` sets `.footer { position: static }` on detail
  pages, which dragged an absolutely-positioned curtain up into the page flow.
- `y: 0` is pinned on both ends of the curtain tween. `footer.css` parks the
  panel with `transform: translateY(100%)` for the pre-JS frame, and GSAP
  otherwise reads that as a ~232px `y` base and stacks `yPercent` on top of it.
- The avatar art is a black silhouette built for light backgrounds, so it's
  `filter: invert(1)` on the black band.
- `avatar.svg` is a 288x356 viewBox wrapping a PNG whose opaque bounds stop 38
  units short of the right edge, so the wordmark sat a full extra gap away from
  the ear. `.footer-curtain__avatar` pulls that dead strip back with a negative
  margin of 38/356 of the rendered height, hoisted into
  `--curtain-avatar-height` so both declarations read from one number. The SVG
  itself is untouched — the portal login logo (`index.html:1208`) shares it.
- The `.footer` shell is now an empty positioning anchor, so it needs
  `pointer-events: none` (with `auto` back on the curtain) or it silently
  blocks clicks across the bottom 40px of every page.
- Detail-page bottom padding has to be declared at the **end** of
  `pages/projects-detail.css`: the responsive blocks above set `padding` as a
  shorthand, which resets any earlier bottom value. Equal specificity, later in
  the file, so it wins the bottom edge and they keep the horizontal padding.

### Follow-up (Aug 27, 2026)

- [x] Dropped the thin always-on `.footer-bar` copyright strip — markup, its
      CSS (including the mobile show-on-contact `:has()` block), and the fade
      tween in the module. The curtain's own `©` line is the only one now.
- [x] Fixed the content/footer overlap when scrolling back up (snapped retract
      + `pointer-events: none` on the empty shell, both above).
- [x] Tightened the avatar-to-wordmark gap in the curtain brand.
- [x] More clearance below detail-page content: `--project-detail-footer-clearance`
      is `--space-12` (96px) desktop / `--space-8` (64px) mobile, up from the
      32px/24px the `padding` shorthands left. The static `.footer` shell adds
      another 40px of flow on detail pages, so the visible gap to the top of
      the curtain is ~136px, up from ~72px.
- [x] **The curtain is only reachable from project-detail pages.** Fixed by
      revealing it on an over-scroll gesture at a tile's edge, hooked into
      `PageTransitionModule.handleWheel` / the touch handlers.

### Follow-up (Aug 29, 2026)

**Status:** DONE — measured in the browser on every tile that has a footer

Reported symptom: on a detail page the band came up part-way and stopped, with
the wordmark clipped by the viewport bottom and the copyright below the fold.
Three separate causes, all confirmed by measurement before anything changed.

- [x] **The band held wherever the gesture left it.** `driveCurtain()` banked
      raw wheel px against `CURTAIN_TRAVEL_PX` (260) and parked at whatever
      fraction the gesture reached — a normal trackpad flick banks well under
      that, so a half-open band was the common case, not the edge case.
      Measured: one wheel notch → `main` at **-124.6 of -270**, still there
      900ms later, curtain inner offset +36px at **0.46 opacity** — which is
      exactly the reported screenshot. Fixed with a settle: `CURTAIN_SETTLE_MS`
      (120ms of quiet) commits the band to whichever end the input was heading
      for, with `CURTAIN_COMMIT_PROGRESS` (0.15) as the "barely moved, put it
      back" threshold. Now one notch → **-270**, fully open.
- [x] **Retraction snapped while opening eased.** The snap was there because
      the module grew the scroller's padding underneath the band, so a trailing
      tween could leave the panel over content the scroll had brought back.
      With the padding gone (below) nothing moves but the page, so both
      directions now share one `CURTAIN_SCRUB_DURATION` `power3.out`.
- [x] **Dynamic reveal padding fed back into its own retract test.**
      `applyRevealPadding()` grew the scroller's `padding-bottom` by
      `progress × curtainHeight`, which grows `scrollHeight`, which is exactly
      what `update()` read back as `remaining` to decide whether to retract.
      Measured stalling at **y -248.5 of -270 with padding 356.5px instead of
      108px**. It only fired when a scroll event happened to land mid-tween, so
      it read as an intermittent half-open band. Deleted outright — the tile's
      static 108px bottom padding already does the job.
- [x] **Every page that has a footer now uses one code path.** `project-detail`
      had its own branch in `handleWheel` (scroll to the end, then drive) while
      the flat tiles had another (drive immediately); that is how they drifted.
      `curtainOwnsVertical()` now returns true for every map tile but
      `projects`, and one branch expresses the rule for all of them: the tile's
      own scroll first, the curtain past the end of it. A flat tile is at its
      end from the first notch, so it behaves as it always did.
      `tileScrollRemaining()` gives wheel, touch, compass and keyboard the same
      test against the same element — the compass ↓ now reads a case study to
      the end before it means "footer", and ↑/↓ drive the band from the
      keyboard, which they never did on any page.

Verified at 1440x900 (curtain 270px), on `#/`, `#/about`, `#/contact` and
`#/projects/hedgewitch-horticulture`:

- One notch past the end opens fully (**-270**) on all four; one notch up
  closes fully (**0**) on all four, easing through intermediate positions
  (**-190** mid-tween) rather than snapping.
- Sampled every animation frame in both directions: the last content pixel
  stays **107.8px clear** of `main`'s clipping edge throughout, so nothing is
  ever cut off or hidden by the band.
- Case study still scrolls normally with wheel and arrows; `projects` still
  keeps its vertical axis for the CRT and never raises a band; reduced motion
  snaps cleanly to both ends.
- `tsc --noEmit` clean, `eslint` clean, 4400 tests pass, production build OK.

### Follow-up (Aug 29, 2026) — resize keeps the band, re-fitted

**Status:** DONE — measured across three viewport heights

Resizing while the band was open dropped it to closed. This was first written
up as pre-existing `handleResize` behaviour; that was wrong. `handleResize`
re-fits correctly — a trace caught it setting `translate(0px, -210px)` for the
new 210px curtain — and then the close-guard added earlier the same day fired
and tweened it to 0. Two defects in that guard, both mine:

- [x] **It tested "is there scroll left below" rather than "has the reader
      moved".** Those agree while the viewport holds still and diverge the
      moment it doesn't: shrinking the window leaves the scroller parked where
      it was but gives it a shorter box, so `remaining > 0` read a resize as
      scrolling away. It now compares against the position the band was raised
      at, which ignores reshaping and catches only real movement. `handleResize`
      re-anchors that position, since a viewport that GREW shrinks the maximum
      scroll and lets the browser clamp `scrollTop` down — a clamp that would
      otherwise read as scrolling back.
- [x] **It trusted `this.scroller` to be the tile that owns the curtain.**
      `handleScroll` listens on document in the capture phase, so it hears from
      every scrollable box on the page. A `<label class="sr-only">` measures
      22px in a 1px box and `.menu-button-text` 43 in 20, so both report a
      permanent ~20px of "remaining scroll" from sub-pixel rounding. Adopting
      one as the scroller also scrolled the header away for no reason — the
      header sat at -330 while the page was at -270. `ownsCurtain()` now gates
      it to a map tile or the document scroller, which fixes the guard and the
      60px header desync at once.
- [x] **`handleResize` never re-drove the header.** It rebuilt the timeline
      around the new curtain height but left the header on the old one.

Anchoring happens when the band is raised, not lazily on the first scroll —
lazily meant the first scroll after opening was spent recording the anchor
instead of being judged against it, so the one gesture the guard exists to
catch (a scrollbar drag back into the page) was the one it always missed.

Verified on the case study at 1440x900 / 1200x700 / 1600x1100: the band holds
through both a shrink and a grow, landing at -270 / -210 / -320 against curtain
heights of 270 / 210 / 320, with `main`'s bottom edge exactly on the band's top
each time and the header tracking it to the pixel. A genuine scroll-back still
closes it — before and after resizing — and the earlier checks all still hold:
one notch opens and closes on all four pages, nothing is ever clipped
(107.8px of clearance on every frame, both directions), `projects` never raises
a band, reduced motion snaps, and the arrow keys read to the end before the
band answers.

### Files

- `index.html` — footer markup: `.footer-curtain`
- `src/styles/components/footer.css` — curtain styles + `--footer-curtain-*`
- `src/styles/pages/projects-detail.css` — footer clearance below content
- `src/modules/ui/footer-curtain.ts` — new
- `src/modules/animation/page-transition.ts` — gesture ownership + settle
- `src/core/modules-config.ts` — registration (home page only)

---

## Projects page slow on live + stale/wrong portfolio media (Aug 27, 2026)

**Status:** FIXED in code — needs deploy (live is 8 commits behind)
**Priority:** High

### Slow load — module-graph waterfall

`Application.initializeServices()` / `initializeModules()` walked their name
lists with a sequential `for … await`. Each iteration ran `container.resolve()`,
which fires a dynamic `import()` — so the lazy chunks downloaded one
round-trip at a time. Measured on the built site: **17 sequential waves**,
last JS finishing ~4.0s after navigation *with a warm cache* on the live host.
`/data/portfolio.json` didn't even start until ~1.95s because it sat behind
eight of those hops.

Fix: `warmModuleGraph()` in `src/core/app.ts` kicks off every service +
module resolution at once before the ordered init loops run. The container
already caches singletons and de-dupes concurrent resolutions, so init order
is unchanged — the loops just stop waiting on the network.
Measured after: **17 waves → 3**.

### 13 broken screenshots on the project detail page

The deployed `/sw.js` lists `.json` in `STATIC_EXTENSIONS` and has no
`/data/` exemption, so `portfolio.json` was served **cache-first** and pinned
forever. Browsers that had ever hit the portal (`server/views/partials/head.ejs`
registers the SW at scope `/`) kept replaying an ancient copy whose
`screenshots` array pointed at files that no longer exist → 13 broken images
plus 13 failed requests. `501ec523` already made data JSON network-first but
was never pushed; bumped `CACHE_VERSION` to `v2` so `activate()` actually
evicts the stranded `nbc-static-v1` entries.

### Media fixes

- Screenshots now honour the `{theme}` token like hero + video already did
  (`data-themed-src` + `resolveThemedPath`), so they show the opposite theme
  and re-point on toggle.
- Squared every corner on detail-page media (hero, screenshots, video).
- Hero no longer cover-cropped: dropped the forced `aspect-ratio` and switched
  to `object-fit: contain`, so full browser-window captures show whole.
- Screenshots take full content width; only `.phone-screen` stays narrow.
- `repoUrl` for nobhad-codes pointed at the GitHub *profile*
  (`github.com/nobhad`), not the repo — now `github.com/nobhad/no-bhad-codes`.
  Added the same repo for the-backend.
- The Backend's hero was a screenshot of the **404 page**: `capture-portfolio.ts`
  captured `/portal/login`, which is not a route. Real login lives at `/#/portal`
  (`/portal` just redirects there). Route fixed and re-captured.
- Added the terminal-style intake form (`/intake`) to the capture list and
  surfaced it as The Backend's screenshot.
- Durations corrected against each repo's real commit history: hedgewitch
  2 months → 8, recycle-content "In Development" → 7 months, linktrees
  2 weeks → 3 months and year 2024 → 2025.
- About photo alt text: "Coyote the dog" → "Noelle & Arrow".

### Showcase additions

- Terminal intake form now records as a **video**, not a still:
  `recordTerminalIntakeVideos()` in `capture-portfolio.ts` drives the real
  form (types answers, clicks option chips, SEND) and captures the boot
  sequence + progress bar. It clears `localStorage` first — the flow
  persists answers, so a second run resumed mid-form and the scripted
  answers landed on the wrong questions. Shown on **both** nobhad-codes
  (front end) and the-backend.
- PDF designs showcased on the-backend: SOW, contract, receipt rendered to
  `public/portfolio/the-backend/pdfs/`. New `.doc-page` class caps portrait
  document pages at 460px instead of stretching them to the content column.

### ⚠ PII found and scrubbed in `scripts/generate-sample-pdfs.ts`

The sample-PDF generator had a **real client's** details hardcoded
throughout the contract and intake samples (name, both contacts, email,
street address, phone) and the invoice sample selected `ORDER BY id DESC`,
which picked that client's live invoice. These render into public portfolio
assets. All of it now uses the seeded `@demo.nobhad.codes` client, and the
invoice query is constrained to demo clients. Verified with a `pdftotext`
grep over every generated PDF before publishing.

**Not published** (render poorly, worth a separate look):

- `SAMPLE-project-report.pdf` — shows `BUDGET: $NaN` and `START/DEADLINE: Not set`.
- `SAMPLE-invoice.pdf` — demo invoices have zero line items, so the table is empty.

## Current System Status

**Last Updated**: August 29, 2026

### Server

- **Command**: `npm run dev:full`
- **Local**: `http://localhost:4000` (frontend), `http://localhost:4001` (API)

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

**Status:** FIXED in code (`a9149996`) — needs deploy to Vercel + Railway from this commit
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
`95e654fd` (removed the portal MPA build entries when the portal moved to EJS).

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
Fixed (`88aac3aa`) by guarding with `typeof process !== 'undefined'` and
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
Fixed (`a788c5da`) by pinning the obfuscator `seed`; two clean builds now
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
ship together: `a9149996` (assets), `88aac3aa` (process), `a788c5da` (seed),
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

**Status:** RECOVERED — prod boots clean with drift guard re-armed; code fix committed (`2803c65b`)
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
  `2803c65b`.

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

- [ ] `git push` — local `main` is ahead with `2803c65b` (drift fix) and
  `814ba7d2` (contact arrow). `railway up` deploys the working dir directly,
  bypassing git, so the repo must be pushed to match what's live.

---

## Hedgewitch Portal Status Refresh — Migration 140

**Status:** APPLIED locally (`npm run migrate`, 2026-08-26) — needs deploy to Railway
**Backup:** `data/backups/pre-migration/client_portal_pre-migrate_2026-08-26T05-04-18.db`

The portal was still showing the April picture four months after the fact.
`140_hedgewitch_status_refresh.sql` brings client_id=6 / project_id=7 in line
with the 2026-08-25 hand-off.

### Done

- [x] Project 7: `in-review`, 95%, est. end 2026-09-30, staging URL
      `hedgewitch.netlify.app`, hourly rate $150, maintenance Essential/active
      through 2027-07-24 (12 months), health notes describing the launch blockers.
- [x] Milestones: Design + Content Integration closed at hand-off; Testing &
      Launch moved to 2026-09-30 and `in_progress`; the three stale March/April
      due dates re-dated.
- [x] Checklist: headshots ×2, group shot, 9 heroes, gallery photos and the
      Resources URLs marked complete against what actually shipped. The two PP
      Cirka font steps and the blog "Coming Soon" step deleted — the type
      direction moved to Otto Attack / Della Respira / Spectral / Manrope and
      the home blog preview has no dated cards. Three bios still pending, plus a
      new step for the two placeholder partner orgs on Resources.
- [x] Payment schedule: installments 2–4 were `overdue` while their invoices
      read `paid` — that mismatch is what auto-generated the six duplicate
      drafts and what keeps the client scored `at_risk`. Synced to paid and
      backfilled the missing `invoice_payments` rows.
- [x] Deleted the six duplicate `$1,125` drafts (INV-202603-40029262 …
      INV-202607-80027291) and their line items.
- [x] Draft invoice `INV-202608-HH005` — hero plate redesign, 2 h @ $150 = $300,
      billed as design work per the hand-off call. Left in draft to go out with
      the follow-up email.
- [x] Two client-visible project updates (hand-off, launch prep) — the timeline
      had nothing since "Project Created" in January.
- [x] Guides added to Files (2026-08-26, **local DB only**) — User Guide, Brand
      Guide, hand-off checklist, email migration, plus the combined ALL_GUIDES,
      in a new `Guides` folder on project 7, all flagged `shared_with_client`.
      Bytes copied to `uploads/projects/`. A third project update announces them.

### Open

- [ ] Deploy to Railway so production runs migration 140.
- [ ] The five guide PDFs exist only in the local DB and local `uploads/` — they
      are not in migration 140 (SQL cannot carry the bytes). Re-upload them
      through admin → Files → project 7 once production is deployed.
- [ ] **Uploads are not on a persistent volume in production.** `railway.json`
      mounts only `/app/data`, while `UPLOAD_DIR=./uploads` — anything uploaded
      through the portal is lost on the next redeploy. Mount `/app/uploads` (or
      move file storage onto the `/app/data` volume) before asking the client to
      upload bios and photos.
- [ ] Confirm 2026-09-30 is the launch date you want the client to see — it is a
      placeholder chosen to cover the DNS repoint, noindex removal and form tests.
- [x] Invoices 5–7 — **not a problem** (confirmed 2026-08-29). Everything was
      paid within about a week of when it was due; only the most recent invoice
      is outstanding, and it is not late. The missing check numbers on the
      backfilled payment rows are a record-keeping detail, worth filling in if
      the numbers are to hand but nothing is owed or chased.
- [ ] Client 6 is still `status = pending` / `health_status = at_risk` and has
      never been invited — see the invite steps below.
- [ ] Not billed yet, deliberately: gallery reordering ($1,800, awaiting
      go-ahead) and the extra revision round ($1,500 or $150/hr, still unsettled).
- [ ] Project code left unset — assigning one now would collide with the test
      project holding `NBC-2026-001-test-subject`.

---

## Hedgewitch Add-Ons — Requests Tab + Specs and Estimates

**Status:** Portal side APPLIED locally (migration 141 + code fixes) — needs deploy
**Rate:** $150/hr, now recorded on project 7

### Client-facing (migration 141)

Three suggestions seeded as ad-hoc requests on project 7, status `reviewing`,
**no prices attached** — export site data, blog comments, newsletter. The
already-quoted work (folder upload, cover-variant add-on) is deliberately NOT
in the portal yet, so the client does not meet a price here before the
follow-up email.

- [x] Requests tab unhidden in solo mode — `hideInSolo` dropped from the client
      `requests-hub` and the admin Work → Requests subtab.
- [ ] Add folder upload ($1,500) and the cover-variant add-on as live quotes
      once the follow-up email has gone out.

### Ad-hoc requests was broken client-side — fixed

The feature had never worked from the client's side of the portal:

- [x] The card read `request.quote`, `request.created_at`, `request.project_name`
      and `request.attachments`. The API returns the camelCase entity from
      `toAdHocRequest` and there is no quotes table — the quote is the flat
      `estimatedHours` / `hourlyRate` / `flatRate` / `quotedPrice` columns. So
      dates rendered blank, the quote panel never appeared, and **Approve /
      Decline could never show**, because `canRespond` needs `request.quote`.
- [x] The submit form posted `project_id` and no `requestType`; the server
      requires `projectId` **and** `requestType` and 400s without them. It also
      posted raw files as `multipart/form-data` to a JSON-only route with no
      multer — so any submission with an attachment failed too. Attachments now
      upload to the project first and travel as `attachmentFileId`, which is
      what the column actually stores (one file per request).
- [x] Status lists were `pending` / `cancelled`, neither of which the DB allows;
      `submitted` and `reviewing` were missing, so seeded rows showed a raw
      slug. Types, status config and filter options now match the CHECK
      constraint.
- [x] **Security, found on the way:** `POST /api/uploads/project/:projectId`
      checked authentication but not ownership — any authenticated client could
      upload into any project id. Guarded with `uploadService.clientOwnsProject`
      (admins unaffected). This route is now on the client attachment path,
      which is how it surfaced.

### Billable — quoted or agreed

| Item | Hours | Price | Status |
| ---- | ----- | ----- | ------ |
| Hero plate → deep rose | 2 h billed (ran over, absorbed) | $300 | Built, preview only, not pushed. Draft invoice `INV-202608-HH005` |
| Folder upload | 8–11 h | $1,500 flat | Quoted in the draft email |
| ↳ cover-variant generation add-on | +6–13 h | ~$1,200 suggested | Offered, unpriced to client |

### Billable — scoped, not offered

| Item | Hours | Notes |
| ---- | ----- | ----- |
| Move up / Move down buttons | 12 h min | $1,500 flat. Dropped from the email — folder naming makes it unnecessary |
| Folder upload and buttons | 20–32 h | Covers the whole of their original complaint |
| True drag-and-drop | 42–59 h | Steered away from; more than the site cost |

### Not billable — absorb

| Item | Hours | Why |
| ---- | ----- | --- |
| Consent banner (GA4) | 6–10 h | The cookie arrived with the Cloudflare → GA4 swap |
| Cover-variant generator script | 1–1.5 h | `gallery-cover-widths.json` has no generator; do it regardless |
| ↳ client-side 1440px upload cap | +3–4 h | Makes the admin resilient to oversized uploads |
| SPF record | minutes | At launch, in the Squarespace DNS panel |
| Missing pond-lily mobile cutout | minutes | recovery commit `5382a1d` no longer exists in history; re-cut the asset from source |

### New suggestions — drafted estimates, NOT yet sent

Drafted against the Hedgewitch codebase (Astro 7, six Netlify functions, admin
content committed as git, forms and resumes held by Netlify Forms). Your call
before any of it goes to the client.

#### 1. Export all site data — recommend A

- Scope A: content JSON (`src/data/pages/*.json`, `gallery-items.json`,
  `testimonials.json`, `jobs.json`, `site-settings.json`), blog markdown from
  `src/content/blog`, contact + careers submissions as CSV, resume files pulled
  from their Netlify submission URLs, all zipped and downloaded from `/admin`.
  **8–10 h → $1,400 flat.**
- The catch that shapes it: a Netlify function response is capped at 6 MB and a
  synchronous one times out at 10 s, so the **64 MB in `public/images` cannot go
  through a normal function**. Scope A excludes the image library and documents
  where to get it instead.
- Scope B adds images: a background function zipping to Netlify Blobs, a signed
  download link and progress UI. **+8–12 h → ~$3,000 total.** Only worth it if
  they specifically want the photos in the same file.
- `admin-netlify-data.ts` already pulls submissions but caps at 50 — pagination
  is part of the estimate.

#### 2. Comments on blog posts — recommend only if they will moderate

- Custom and moderated: comments stored in Netlify Blobs, a POST function with
  honeypot and rate limiting, a moderation queue in `/admin` reusing
  `_admin-auth`, approved comments rendered client-side, email on each new one.
  **14–18 h → $2,400 flat.**
- A third-party embed (giscus, Disqus) is 2–3 h / **$400**, but it means reader
  accounts, someone else's styling and, on the free tiers, ads. Off-brand for
  this site.
- Say plainly that comments are ongoing work for them: spam finds any open form,
  and moderation is theirs. Also note it is the first place the site would hold
  content written by the public.

#### 3. Email newsletter — recommend A

- Scope A: sign-up on the site posting through a function that holds the
  provider API key, with double opt-in, unsubscribe and compliance handled by
  the provider (Buttondown ~$9/mo, Mailchimp free at their list size). They
  write and send from the provider's own composer. **5–7 h → $900 flat**, plus
  their subscription.
- Scope B: compose and send from `/admin`, including a "send this post as an
  email" button on a blog post. **12–16 h → $2,100** — and it moves
  deliverability, bounce handling and unsubscribe compliance onto us. Not worth
  it at their volume.

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
- [ ] **Implement tech-stack runway animation — ON HOLD, premise gone (2026-08-29).**
  The tech stack is already on the site: the About tile carries a full-bleed CSS
  marquee (`index.html:440`, styles at `about.css:129`) — 13 hardcoded items,
  repeated for the seamless loop, no JS and no data behind it. So the
  "reincorporate tech-stack content" goal that motivated the runway is met.
  Loose end either way: `Profile.techStack` (the 4 chunks of 8, added
  2026-04-30 to `portfolio.json` and typed at `data-service.ts:42`) has **no
  consumer anywhere in `src/`** — it exists only for this unbuilt animation.
  Decide: drop the data, or point the marquee at it so the toolkit has one
  source of truth (the marquee's 13 and the chunks' 32 currently disagree).
  Build the runway only if it's wanted as a *transition effect* in its own
  right, not as a way to surface the stack. Original spec kept below.
- [ ] **(spec, if the runway is ever built)** — GSAP timeline on horizontal map→map transitions. Single integration point: `src/modules/animation/page-transition.ts:1985` inside the bridge-slide block (every horizontal map slide flows through there). Touch list:
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
- [ ] **Re-align the base screen artwork** — base bbox `(100, 95, 1137, 864)` is ~6px wider on each side than the per-project cards `(106, 95, 1131, 864)`. Causes a small visible jump when cycling between channel 01 and 02+. Re-export from the same artboard origin as the project cards so artwork lands at x:106-1131. NOTE: the old `title-card_base.webp` no longer exists — the base screen now lives as `public/images/tv/base-on.webp` / `base-off.webp` (introduced 2026-04-30, `4e9d3a0e`); re-export targets those two files.
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

- **Contact form placeholders visible** (`7bcc7e46`) — labels are `display:none` by design (the placeholders ARE the field names), but `--placeholder-opacity` defaulted to `0` from a removed fade-in animation, so desktop rendered empty field boxes. Defaulted to `1` in `src/styles/pages/contact.css` (mobile was already patched).
- **Intro paw-morph NaN guard** (`7bcc7e46`) — `calculateSvgAlignment` divided `0/0` when the card/overlay measured 0 (deep-load to a non-intro page, or the collapsed small-mobile layout), writing `transform="translate(NaN, NaN)"` and throwing on navigation. Both morph builders in `intro-animation.ts` now skip the morph when alignment isn't finite. Verified 0 console errors, desktop + mobile.
- **TV ticker on mobile + centering** (`a3554622`) — lifted the `<=479px` ticker guard and restart it from a `ResizeObserver` on the guide viewport (fires once the TV lays out from 0 height). Chevrons moved to a SIBLING of the TV wrap so the `translate(-50%,-50%)` centering no longer drags them off-screen.
- **Small-mobile pivot + iOS overscroll + TV audio isolation** (`0fb72927`) — landed the discrete-tile small-mobile architecture; `overscroll-behavior: contain` on the tile scroller + `none` on `html`/`body` to stop iOS rubber-banding the fixed header; and `transitionTo` now syncs `currentPageId` in its `catch` so a thrown animation can't leave it stale on the source page.

### Awaiting on-device confirmation

- [ ] **Off-page channel cycling / audio bleed** — root cause: stale `currentPageId` from a thrown transition animation let the wheel cycle TV channels (and restart channel music) on other pages. Fixed in `0fb72927`. Confirm on device: trackpad on contact should NOT change channels or start music. If it recurs, check console for `[PageTransitionModule] Transition failed:` — present means the fix is firing, absent means a second desync path remains.
- [ ] **iOS overscroll** — confirm the fixed header no longer rubber-bands on a real iPhone.

---

## Session 2026-06-25 — Scroll/nav model + contact form

### Shipped

- **Contact form submits again** (`bcc18897`) — was failing with `403 CSRF_TOKEN_INVALID`. `ContactService.submitToCustom` never sent the `x-csrf-token` header, and on a cold visit the `csrf-token` cookie isn't set yet. Now sends the header (shared `getCsrfToken`) with `credentials:'include'` and primes the cookie via `GET /api/health` first. Verified end-to-end without sending a real email.
- **Scroll/nav model finalised** (`843682aa`, `bb624760`, `e8626804`) — vertical OR horizontal scroll navigates the carousel on intro/about/contact; projects vertical = channel-surf; `Shift+wheel` = mouse-wheel parity (reads whichever axis the browser populates); project-detail vertical scrolls then navigates at the edge, left/right cycles projects. (Went back and forth on this — current state is "any scroll navigates except projects = channel".)
- **projects → project-detail slides DOWN** (`bb624760`) — TV scrolls up and out, detail pushes up from the bottom (was sliding in from the right). Detail↔detail left/right carousel unchanged.
- **Click a playing TV screen → project detail** (`fe9dd474`) — same tab, instead of the live link opening a new tab. The explicit "Live: url" link still opens the live site.
- **Main-site doc sweep** (`81a862d7`, `a19ef829`) — audited 12 main-site docs vs code (4 parallel agents); corrected mobile-intro-is-a-morph-not-a-flip, the localStorage replay gate, typography clamps, nav z-index, TV chassis dims + hitbox table, mobile ticker, projects→detail down, contact placeholders/CSRF, `@custom-media` location, `--font-family-body`, EMBED service method names.
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

## Branded 404 Page

**Status:** DONE (2026-07-13)

- [x] Standalone `public/404.html` using existing `wile_404_sign.svg` + coyote voice ("Wrong turn, genius.")
- [x] In-SPA `#/404` / `#/not-found` off-map section matching the standalone composition
- [x] Unknown hashes + missing project slugs route to the 404 section
- [x] Express HTML Accept → branded 404.html (JSON preserved for API clients)
- [ ] Visual check: `/404.html`, `#/404`, `#/this-is-fake`, hard refresh theme toggle

---

## Case Study Media + Hedgewitch Launch Prep

**Status:** IN PROGRESS (2026-07-13)

- [x] Copied curated Backend admin/portal screenshots + walkthrough videos into `public/portfolio/the-backend/`
- [x] Wired `screenshots` + `videos` on The Backend entry in `portfolio.json`; hero uses admin dashboard
- [x] The Backend case study status set to `completed` (live)
- [x] No Bhad Codes case study status set to `completed` (live)
- [x] Replaced cookie-bannered admin captures with clean light-desktop shots; dropped portal-login 404 image + duplicate portal-projects shot
- [x] Re-captured No Bhad Codes public screenshots (cookie consent set pre-nav) into `public/portfolio/nobhad-codes/`; added light walkthrough videos
- [x] Fixed `capture-portfolio.ts` screenshot path to pre-set `tracking_consent` like the video path already did
- [x] Video walkthroughs now scroll every page to the bottom (shared `scrollPageToBottom` helper finds the real scroll root)
- [x] Re-enabled project-detail media rendering (images + `<video controls>`)
- [x] Hedgewitch case study: `testUrl` → https://hedgewitch.netlify.app/, `launchDate` → 2026-07-17
- [ ] Visual check on `#/projects/the-backend` and `#/projects/hedgewitch-horticulture` (desktop + mobile)
- [ ] Hedgewitch case study still needs site screenshots/recordings when ready

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
