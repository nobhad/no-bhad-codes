# Current Work - August 29, 2026

---

## Full-site sweep: truth, function, performance, cleanup — 2026-09-05

**Status:** DONE — committed, one open list below
**Priority:** —

Asked for: every claim on the site and in the docs true or made true, every
surface wired and working, the site as fast as it can be, and the code
cleaned up. Baseline before any change: typecheck/lint/unit/integration all
green, one failing Chromium e2e, Lighthouse (mobile) home 78 / projects 64
with CLS 0.29, 54 doc references to files that no longer exist, `uploads/`
with client PII tracked in the public repository.

### Portfolio truth (portfolio.json, checked against each project's repo)

- [x] **Hedgewitch.** hedgewitchhorticulture.com still serves the client's
      Squarespace; the build is on Netlify with `noindex`. Copy no longer
      says the Squarespace was replaced; "64 pages" is "sixty-plus" (62
      today); "the posts that already existed" is gone (`src/content/blog`
      has none on main); "WCAG AA throughout" became what was measured —
      zero axe violations, Lighthouse accessibility 100; duration 6 → 8
      months. Per Noelle's decision the domain stays as the Live link but
      is now inert in all three places it appears (detail links row, detail
      title, TV outro) via one `isLaunched()`; before this the title and
      the outro linked straight to the Squarespace site.
- [x] **The Backend.** "Magic link invitations (no password setup)" was
      false — invites land on set-password; the passwordless
      `/api/auth/magic-link` sign-in that does exist is credited instead.
      "node-cron" scheduler → in-process timers (the package was unused).
      Tailwind removed from the tool list (see cleanup).
- [x] **nobhad-codes.** "Sub-2-second load times" replaced with the
      measured Lighthouse line (mobile, home: 95 / 100 / 100 / 100).
- [x] **linktrees.** One site shipped (daretaylor.com), Next.js on Vercel,
      no GSAP, one client — rewritten from the real repo.
- [x] **recycle-content.** 7 months → 12 (repo runs 2025-09 → 2026-08);
      every feature claim verified.
- [x] Deep links to the two undocumented entries now 404 like any unknown
      slug instead of rendering an empty case study.

### Function

- [x] **Audit log constraint (production bug).** Migration 012 limited
      `audit_logs.action` to 15 values; the app logs ~40. Every such insert
      failed and, because the logger throws by design, invite, set-password
      and client delete answered 500 after doing their work, with no audit
      row. Migration 143 rebuilds the table without the vocabulary CHECKs
      (rows and hash chain preserved; verify endpoint passes). Found by an
      end-to-end portal smoke: admin login → create client → invite → token
      → set-password → client login → inquiry thread → SSE → invoice PDF →
      admin ops endpoints → delete. 28/30 after the fix; the two left are
      below.
- [x] Uploads that failed to record their row returned 201 with a null id;
      now the orphan is removed and it is a 500.
- [x] `.404-section` is not a valid selector: every visit to the branded
      404 threw. Page ids are `CSS.escape`d in the three places that build
      section selectors.
- [x] Business card: static ARIA in the markup so it is a button from first
      paint; handlers still wait for the intro. The failing e2e passes.
- [x] Channel music stops in a hidden tab and on pagehide.
- [x] Service worker registered on the main site (only the portal shell
      had been registering it, at scope `/`).
- [x] One canonical host: `www`, everywhere (canonical, OG, JSON-LD,
      robots, sitemap). Sitemap lists the two real documents.
- [x] Portal sidebar footer reserves the consent banner's height — the
      banner sat over Sign Out on a first visit.
- [x] **Arrow stayed on screen after leaving Contact.** She is portaled to
      `<body>` and fixed, and nothing closed her when the tile changed, so
      after typing in the form she rode along over whichever tile came next.
      `contact-form.ts` now closes her on `page-entering` to any other tile.
- [x] A project with no media opens its case study on its title card (the
      composed image, or the rotation background with the same text layer
      the TV draws) instead of the grey placeholder.
- [x] `admin-flow` / `portal-flow` e2e rewritten for the React portal (they
      targeted the vanilla portal's ids); they sign in through the portal
      page, which is the only path that seeds the session the app restores.

### Performance (Lighthouse mobile, vite preview)

| page | before | after |
|---|---|---|
| home | perf 78, LCP 4.9s, CLS 0 | **perf 95**, FCP 2.3s, LCP 2.4s, CLS 0 |
| projects | perf 64, LCP 4.7s, **CLS 0.29** | perf 80, FCP 2.0s, LCP 5.0s, **CLS 0.001** |

- [x] 21 `-mobile.webp` TV layers downsized 2481→1200px (861 KB → 316 KB);
      width/height on every cabinet layer; frame `fetchpriority=high`.
- [x] The projects CLS was the consent banner lifting the footer curtain by
      365px behind `main`; the curtain is hidden until the reveal starts.
- [x] `portfolio.json` fetched once, not two or three times.
- [x] Projects deep links preload the data and the right cabinet file (from
      a script placed after the viewport meta — before it, the media query
      reads a 980px layout viewport).

### Cleanup

- [x] Tailwind removed (zero utilities ever used), three dead shadcn files,
      nine unused packages, lint-staged config nothing ran.
- [x] `npm run lint` and Prettier now cover `.tsx` — 130 portal files had
      never been linted or formatted (525 curly fixes, four dead bindings).
- [x] `uploads/` (client PII), `dist/`, `screenshots/`, `_to_delete/`,
      mockups and stale root files untracked; history left as-is by decision.
- [x] Docs regenerated from the code: README, CONFIGURATION (27 declared
      but unconsumed variables labelled as such), `.env.example`,
      DEPLOYMENT (Vercel + Railway, not nginx), hooks README, PORTFOLIO,
      Tailwind references, dead paths; roadmap and HANDOFF archived.
      `docs:validate` and `lint:md` run in CI.

### Open

- [ ] **Projects deep-link LCP stays ~5s in Lighthouse's simulation.** The
      TV is built by JS after the module graph loads; it paints at ~260ms
      unthrottled. Painting it at FCP means shipping the cabinet shell in
      `index.html` — a separate change.
- [ ] **`/api/uploads/single` cannot succeed** — it inserts with
      `project_id: null` into a NOT NULL column. Nothing in the UI calls it
      (the Files manager uses `/multiple`, which resolves the client's
      project); either make `files.project_id` nullable (11 tables reference
      `files`) or remove the endpoint.
- [ ] `about-photo` GIF (105 KB) would be half the size as a video; needs
      reduced-motion handling, left alone.
- [ ] 27 config keys `environment.ts` validates and nothing reads — remove
      them together with their `.env.example` entries when convenient.
- [ ] `server/routes/two-factor.ts` exists but is not mounted.
- [ ] `puppeteer` advisories need a major bump (capture script only).
- [ ] Hedgewitch launch: flipping `status` to `live` is what makes the
      domain clickable again — nothing else to change.
- [x] **Title cards for recycle-content and linktrees** — no longer gated
      on artwork. Text title cards are now the default: a card's lines are
      set in HTML over a background from the ordered `titleCardBackgrounds`
      list in portfolio.json (add a line to add a background). Both are
      channels 05 and 06 with music; composed images remain the exception.

---

## SQLITE_BUSY in the integration job — 2026-09-05

**Status:** DONE — committed
**Priority:** —

### The failure was real but stale

- [x] **CI is green and has been since 2026-08-28.** The integration job passed
      on both card commits and on every run since. The belief that it was
      "currently failing" was wrong; the last red integration run was
      `fix(pages): masthead meets the header` on 2026-08-27, where 6 of 10 files
      failed with `SQLITE_BUSY: database is locked` and three uncaught
      exceptions carrying `{ errno: 5, code: 'SQLITE_BUSY' }`.
- [x] **It was never going to stay fixed on its own.** Nothing had addressed the
      cause — the suite passes locally and on a warm runner by luck of timing.

### Root cause

- [x] **The pool never set `PRAGMA busy_timeout`, so it inherited
      node-sqlite3's 1000ms default.** Measured directly: a fresh connection
      reports `{ timeout: 1000 }`, and a write against a lock held longer than
      that throws `SQLITE_BUSY` at 1037ms instead of waiting.
- [x] **Five connections against one file makes that contention routine.**
      `initializeDatabase()` opens up to `DB_MAX_CONNECTIONS` (default 5)
      against the same SQLite file. WAL lets readers run alongside a writer but
      still permits only one writer, so pool slots queue behind each other by
      design. Waiting is the correct response; failing outright is not.
- [x] **Why only CI.** A loaded two-core runner holds the write lock past a
      second — with `synchronous = NORMAL` and WAL checkpointing in the mix —
      where a fast local machine serializes the same writes well inside it.
      Every failing test in that run died at ~10s, the `testTimeout`, because
      the rejection surfaced as an uncaught exception rather than a query error.

### The fix

- [x] **`PRAGMA busy_timeout` is now the first pragma on every pooled
      connection.** First deliberately: the pragmas below it can themselves need
      the write lock — `journal_mode = WAL` above all — and they should wait for
      it too.
- [x] **Default 5000ms, overridable with `DB_BUSY_TIMEOUT_MS`.** Named constant
      `DEFAULT_BUSY_TIMEOUT_MS`, not an inline number. Kept under the 10s
      connection-acquire ceiling in `getConnection()` so a genuine deadlock
      still surfaces as a timeout rather than stalling in the busy handler.
- [x] **Regression test that fails for the right reason.**
      `tests/integration/db-pool-concurrency.test.ts` holds a transaction on one
      pool connection and writes from another. Against the unfixed pool it
      reproduces the CI error exactly — `SQLITE_BUSY: database is locked`,
      `{ errno: 5, code: 'SQLITE_BUSY' }`. The hold is 2500ms on purpose: an
      earlier 500ms version passed against the unfixed pool, because under
      node-sqlite3's 1000ms default every writer already waits and succeeds.
- [x] **Verified.** Integration 63/63 across 11 files, unit 4362 passed, lint
      and typecheck clean.

### Related, not touched

- [ ] **`hookTimeout` was raised to 30s on 2026-09-04** (`dfd9438f`) for a
      different symptom — a cold-runner `setupTestDb()` overrunning 10s and
      reporting itself as twenty `Cannot read properties of undefined (reading
      'cleanup')` failures. That change stands on its own; it did not and could
      not fix the lock contention.

---

## Business card back, and the card during the intro — 2026-09-05

**Status:** DONE — pushed
**Priority:** —

### Card back

- [x] **Re-imported the card back from the latest Illustrator export.**
      `npm run card:back`. The export now carries all three type layers again
      (`Creative_Web_Development`, `By_Noelle_Bhaduri`, `By_Noelle_Bhaduri-2`),
      so the card ships as exported and `refit-card-back.mjs` is unchanged.
- [x] **Backed out an interim change that drew the type from the font.** An
      earlier export contained only the outline and the dog, so the lettering
      was traced from `Acme-Regular.ttf` and fitted to measured ink boxes. That
      is no longer needed and the scripts are deleted. Worth knowing if it ever
      comes back: `<text font-family="Acme">` does NOT work here, because the
      back is loaded as `<img src="...svg">` — an isolated document that the
      page's `@font-face` never reaches. The card FRONT is outlined paths for
      exactly that reason.

### The card was clickable during the intro

- [x] **Interactions no longer go live until the intro is over.**
      `business-card-interactions.ts` bound its listeners at module init, about
      a second in, so clicking mid-intro flipped the card during the fade. The
      idle timer had the same reach: it could start a wiggle or auto-flip over
      the top of the intro.
- [x] **Keyed to `intro-finished` alone, deliberately.** Waiting for
      `intro-loading` to clear looks equivalent and is not: that class comes off
      when the paw hands the card over, while `intro-finished` only lands once
      the overlay has faded. The gap between the two IS the window being clicked
      in. Every route that skips the intro sets `intro-finished` up front, so it
      is sufficient on its own.
- [x] **Watches rather than waits once.** Both replay paths in
      `intro-animation.ts` remove `intro-finished` and start over; a one-shot
      wait would leave the card live for the whole second run.
- [x] **Verified in Chrome.** 38 clicks across the 3.98s intro produce zero
      rotation, and a click afterwards still flips. The same test against the
      pre-fix code reports a deviation of 2 — a full flip — so it fails for the
      right reason rather than passing vacuously.

### Open

- [ ] **Music reportedly keeps playing on other pages — not reproduced.**
      Got the music going and left Projects by hash change, the menu overlay,
      arrow-key nav and into a case study: all four stop it correctly. Wheel
      scrolling and the footer curtain never actually navigated or opened under
      automation, so those two are untested rather than clean. Browser
      back/forward is the route never exercised and the likeliest to bypass the
      `page-entering` handler in `projects.ts` that does the stopping. Needs the
      destination page and how it was reached.
- [ ] **Nothing in the audio path listens for `visibilitychange`,** so the
      channel music also keeps playing in a hidden tab. Separate from the report
      above, and untouched.

---

## Accessibility sweep, contact form, cookie banner — 2026-09-04

**Status:** DONE — on main, unpushed
**Priority:** —

Started as "is the accessibility claim on the About page true?" The answer was
no — `axe-core` was not a dependency and the only matches for "axe" in the repo
were inside "rel**axe**d" and "m**axRe**quests". It is true now, and enforced.

### The harness

- [x] **`@axe-core/playwright`, 22 surfaces, both themes, two viewports.**
      `tests/e2e/accessibility.spec.ts`. WCAG 2.1 A + AA tags only — not axe's
      default set, which also carries `best-practice` opinions no criterion
      asks for.
- [x] **CI runs it on every push,** and `build` waits on it, so a contrast
      regression cannot reach a deploy. Front end only (`PLAYWRIGHT_WEB_SERVER`
      overrides the webServer command) — these tests read pages and never post.
- [x] **Waiting helpers in `tests/e2e/support/site.ts`.** Scanning an animating
      page measures the tween, not the palette: an about scan landed mid-fade
      and reported `#979797` text, a colour in no stylesheet.

### What it found (all fixed)

- [x] **The accent red failed as text in BOTH themes.** `#dc2626` is 3.66:1 on
      the page ground and 3.71:1 on near-black. Light takes `#b91c1c`, dark
      takes `#f87171` (`--color-brand-accent-dark`). `--color-brand-primary`
      keeps `#dc2626` for the logo and brand fills, which owe only 3:1.
- [x] **Status pills at 1.92:1** — off-white on the success green, on three of
      five case studies. Now `--color-text-on-vivid`, a fixed dark ink, because
      the pill backgrounds do not follow the theme and their ink must not
      either.
- [x] **`--color-text-tertiary`** gray-500 -> gray-600 (3.59:1 -> 5.92:1).
- [x] **The overlay was claiming to be a menu button** — `[data-menu-toggle]`
      matches it and `navigation.ts` gave it `aria-expanded`, `aria-controls`
      and `aria-label`, all invalid on a div with no role.
- [x] **`aria-controls` pointed at nothing** — the fallback wrote the literal
      string `main-nav` and no element carried that id.
- [x] **The wordmark was 1.56:1 with the menu open,** under the overlay.
      Fixed above `--tablet` only; below it the menu covers the overlay.
- [x] **The login dropdown flashed on every page load** — its markup ships in
      the shell but the stylesheet that hides it arrives with the module
      bundle. Visible at opacity 1 for ~250ms; now hidden from first paint.
- [x] **Three scroll containers with nothing focusable in them** — the about
      tile, nine design-system token tables, and the intake transcript.

### Cookie banner

- [x] **It was sitting on the page's controls.** `position: fixed`, so the page
      had no idea it was there. On a 390x844 phone it covered 428px — 51% — and
      everything under it was untappable, because the banner is what the tap
      lands on: the TV's power/channel/volume, the contact form's email,
      message and send, every link on a case study.
- [x] **`--consent-banner-height`**, published by `consent-banner.ts` and
      zeroed on dismiss, the way `footer-curtain.ts` publishes its lift.
      Everything it would cover adds it to its own bottom inset.
- [x] **Buttons in a row rather than stacked** — 428px down to 365px, and
      Decline / Accept All read as the pair of equals they are.
- [x] `touch-action: none` so a drag over it cannot scroll the page behind it.

### Contact form and Arrow

- [x] **Invalid fields now look invalid.** `.error` was set by JS all along and
      styled nowhere, so Arrow named the problem while every box looked the
      same — while her own copy promises "the red fields say WHERE".
- [x] **Arrow watches from the edge before she speaks.** Up on the first
      keystroke with her bubble closed, eyes over the bottom edge; to the
      shoulders once a second field has text. `summon()` is new on the vendored
      component — the third state its own `render()` already described.
- [x] **Her note auto-closes without taking her with it.** The timer used to
      call `closeEntry`, which clears `forced`, so on mobile she delivered a
      line and vanished.
- [x] **A blank form is not "almost there".**
- [x] **Buttons:** even border (the 6px bottom slab is gone), all caps,
      positive tracking, and the contact button reads SEND.

### Compass

- [x] **Idle fade.** The cues teach the map gesture and then get out of the way
      after four seconds; any input brings them back, and `:focus-within` pins
      them for the keyboard.
- [x] **Sideways cues sit below the card on mobile,** and do not move when the
      banner appears — measured 0px at 375x667, 390x844 and 412x924.
- [x] Per-direction visibility was already built (`data-can`), contrary to what
      I first said.

### Not done

- [x] **The banner overlapping content on mobile is accepted as-is.**
      Everything is reachable by scrolling and the space is reserved; confirmed
      fine rather than left unfinished.
- [x] **Two lazy images in `projects.ts` now carry width/height.**
      `scripts/build-media-dimensions.mjs` reads the intrinsic size of all 14
      images `portfolio.json` points at and writes
      `src/generated/media-dimensions.ts`; the renderer looks each one up.
      Dependency-free header parsing for PNG/GIF/WebP/JPEG rather than adding
      sharp for fourteen files — cross-checked against PIL. Run
      `npm run media:dimensions` when the portfolio media changes.
- [ ] **Two title cards still to be made.** `recycle-content` and
      `linktrees` carry a string `titleCard` naming the file they are waiting
      for (`/projects/*-title.png`). That is deliberate, not stale data: the
      runtime only plays the object form, so those two have no TV channel and
      nothing requests the path — there are no 404s. When the artwork exists,
      swap the string for the `composed`/`bg`/type object and run
      `npm run media:dimensions`. The Project type and the generator both say
      so now, so neither reads as a broken reference.
- [ ] **`--consent-banner-height` shows up in the css-bundle-contract
      snapshot** as a var living on its fallback. That is correct — it is set
      at runtime by JS — but the test cannot tell the two cases apart.

---

## TV texture, business card, intake — 2026-09-01

**Status:** DONE — on main, unpushed
**Priority:** —

- [x] **TV re-cut with texture** (aa63673d). Twenty webp files from the new
      Illustrator exports at 2x the artboard, matching the shipped sizes so
      nothing needed re-registering. Quality split by content — grain hides
      compression, so screens and title cards are q62 and the chassis/glass q80;
      at a flat q82 the set was 1696KB, this is 894KB with no visible difference
      at 1:1. Total `public/images/tv` 1453KB -> 1801KB.
      Composed cards and their `_bg` pairs were cut together on purpose: a
      textured card fading to an untextured background would show the texture
      change mid-transition.
- [x] **Card back rebuilt from `intro_paw.ai`'s `card_back` layer.** Both faces
      now live in the paw's coordinate space, which is what made this tractable.
      The dog was a placed raster (438x558 PNG) rather than a vector carrying an
      effect — which is why deleting effects never shrank the file. Now vector:
      214KB -> 14KB.
- [x] **Card front reverted to the original** (830b3b53). It was always aligned
      to the paw; the mismatch only appeared when the redrawn artboards came in
      with the frame resized but the art inside not rescaled. Several rounds
      were spent chasing that instead of stepping back.
- [x] **Intro hand-off** — `.intro-morph-overlay` had a CSS transition on the
      same opacity GSAP tweens, so the fade never landed (reached 0.68 of a
      600ms fade, then reversed). Removed; it now runs 1 -> 0 cleanly.

### Not done

- [ ] **`control-panel.webp` and the `led/NN.webp` digits are untextured.** They
      were not part of the TV export. They render fine, but the texture stops at
      them if you look closely.
- [ ] **`wip/card-swap`** still parked — swapping the paw's card for the newer
      1352.31x772.75 geometry. Unfinished on purpose: it needs `SVG_CARD` in
      `intro-animation-config.ts`, the fixed sizes and nav offsets in
      `business-card.css` and `mobile/layout.css`, and the `<img>` dimensions.

---

## Intake terminal, business card, footer curtain

**Status:** DONE — merged to main
**Priority:** — (one shipped data-loss-adjacent bug, now fixed)

### Done

- [x] **The review screen could not edit anything, and one path submitted the
      form.** It says "scroll back up to the questions and click on the answer
      you would like to change"; none of it worked. Three causes, all only
      reachable once the summary is up: `isProcessing` stayed true for the whole
      review (processAnswer awaits askCurrentQuestion, which blocks on the
      prompt), so `goBackToQuestion` and `handleOptionClick` both bailed; the
      prompt's click listener is bound on the whole chat container in the
      CAPTURE phase and matched any `.chat-option`, mapping it positionally, so
      re-answering a question by picking its FIRST option ran the review's
      option 1 — "Yes, submit my request"; and both input handlers refused
      everything while a prompt was open. Guarded by a matrix that edits each
      answer from the review screen and re-checks every field: 8/8, was 0/6.
- [x] **Business card replaced** with the redrawn artboards, front and back,
      both at `viewBox 0 0 1069.5 599.3` — the card slot inside `coyote_paw.svg`
      (`_Card_Outline_`, 1060.5 x 590.3 + 9px centred stroke). Because the
      viewBox matches the paw exactly, no CSS or intro-config change was needed.
      Originals kept as the un-suffixed files.
- [x] **Fonts in the card SVG.** The first export carried the wordmark as live
      `<text>` in Acme. An SVG loaded through `<img>` is an isolated document
      with no access to the page's `@font-face`, so it fell back to a serif for
      anyone without Acme installed — invisible when testing on a machine that
      has it. Re-exported with type outlined: zero `<text>`, no font-family.
      **Any future card export must use Font -> Convert To Outlines.**
- [x] **og:image / twitter:image** were still serving the previous card.
      Rendered from the shipped SVG so the preview cannot drift from the site.
- [x] **Footer curtain lifted behind the intake modal.** The modal is a centred
      92vh box over a translucent backdrop, but the page behind is still a live
      scroller and PageTransitionModule still reads wheel gestures over the
      backdrop. The curtain now treats "an overlay covers the page" as its own
      state and holds the band down.
- [x] **Scope and brand-assets questions**, wired through the server schema, the
      route's `IntakeFormData` and the archived intake document — not client
      only, or the server would have dropped them. Scope also selects the budget
      bands: design-and-build starts at 2k-5k, build-only keeps the old list.

### Notes for next time

- **The media viewer is NOT affected by the curtain bug** — checked, don't
  re-investigate. Its primary path is the native Fullscreen API, and its
  fallback (`has-expanded-media`) is `position: fixed; inset: 0` with an opaque
  background, so nothing shows around it. The intake modal is the only overlay
  that leaves the page visible at its edges.
- `required` on `IntakeQuestion` is dead metadata — nothing reads it, and
  `/skip` refuses every question unconditionally. Making a question "optional"
  would need a skip path built first.
- The design-and-build budget floor (2k-5k) is a placeholder, not a priced
  decision. Plain data in `terminal-intake-data.ts`.

---

## CSS audit — cascade layers, dead rules, undefined tokens

**Status:** DONE — all four; layers merged in 10409d1a
**Priority:** — verification on real iOS hardware is the only thing left

Audit of the stylesheet set turned up four problems. Three are fixed and
committed; the fourth is the big one and is deliberately last, because it is the
only one that can move things on desktop.

### Done

- [x] **iPhone safe area cleared twice.** `--header-height` already carries
      `env(safe-area-inset-top)`, and `mobile/layout.css` plus `intro-morph.css`
      added it again on top. On a Dynamic Island phone the tiles sat ~59px lower
      than the header actually ends. Measured in Chrome at 393px by substituting
      a literal 59px for the `env()`: `--map-header-inset` 163px -> 104px.
      Invisible off-device — `env(safe-area-inset-top)` is 0 in desktop Chrome,
      in DevTools device emulation and in every `scripts/capture` run, which is
      how it survived.
- [x] **Pre-TV projects page styles deleted.** 58 rules / 433 lines in
      `pages/projects.css`: hero, filter bar, `.projects-grid`, the whole
      `.project-card` family. 29 class names with no reference in any HTML/TS/TSX.
- [x] **Every custom property now resolves.** 15 were read with no definition
      and no fallback, so the browser dropped those declarations silently. Four
      went with the dead code; the rest are defined or retargeted.

### Open

- [ ] **Verify the safe-area fix on real hardware.** Cannot be reproduced in any
      desktop browser. Check a map tile and the intro morph on an iPhone.
- [ ] **Three rules that were inert and now are not.** Checked in Chrome
      (headed Playwright, dev server) on 2026-09-02. Two are settled; one is
      still a design call.

      - `.portal-button:focus-visible` — **verified correct.** Reached by real
        keyboard Tab (programmatic `.focus()` does not match `:focus-visible`),
        measured after a 600ms settle because `.portal-button` transitions
        `background-color` over 0.2s and sampling early reads the tween, not the
        end state — 0.004 alpha mid-flight instead of 0.1. Settled it is
        `background-color: rgba(220, 38, 38, 0.1)` and `color: rgb(220, 38, 38)`
        in both themes. Worth noting the rule also sets `outline: none` and
        `box-shadow: none`, so the colour change IS the entire focus indicator —
        it clears WCAG 2.4.7 but nothing more.
      - Mobile scrollbar track — **the question dissolved: that rule is in a
        dead stylesheet, and the live scrollbar was broken for a different
        reason.** Two corrections to earlier notes in this file.

        First, the mobile override lives at `styles/main.css:190`, and
        `main.css` ships to nobody. It is imported only by `src/main.ts`, which
        is not a Vite `rollupOptions.input`, is referenced by no HTML, and is
        imported by no module — the only mentions left are its own file header,
        two hardcoded example strings in `services/bundle-analyzer.ts`, and a
        stale `templates/data.json` that nothing reads. Resolving the `@import`
        graph of all three real bundles confirms `::-webkit-scrollbar-track` is
        defined for the site in `base/site-globals.css` and for the portal in
        `portal-layout.css` / `portal-tabs.css` / `portal-dropdown.css` — never
        from `main.css`. So neither of the "two options" was ever rendering.

        Second, and the reason nobody noticed: **on modern Chrome none of the
        `::-webkit-scrollbar-*` rules render either.** `base/reset.css:38` sets
        the standards property `scrollbar-color` on `html`, it inherits to every
        scroller, and when `scrollbar-color` is not `auto` Chrome ignores the
        `::-webkit-scrollbar` pseudo-elements entirely. Measured in Chrome 152 at
        393px: `.about-section` reports `offsetWidth - clientWidth == 0`, i.e. no
        classic 8px gutter at all, so `::-webkit-scrollbar { width: 8px }` is
        not taking effect. The webkit block is worth keeping as a fallback for
        older WebKit, but it should be understood as a fallback, and it should
        read from the same tokens so the two systems cannot drift.

      - [x] **The live scrollbar was invisible in dark mode — fixed.** That
        inherited `scrollbar-color` is
        `rgba(var(--text-rgb, 25, 25, 25), 0.7) transparent`, and `--text-rgb`
        occurred **exactly once in the whole repository: at that use site.** It
        was never defined, so the declaration silently fell back to a hardcoded
        near-black thumb in BOTH themes — the "Theme-aware scrollbar" comment
        above it was simply false. A fallback is why the earlier "every custom
        property now resolves" sweep missed it: an undefined property with a
        fallback does not drop the declaration, it just quietly uses the wrong
        value.

        Composited against the real page colour, thumb vs page:

        | theme | before | after |
        | --- | --- | --- |
        | light (`#e0e0e0`) | 5.65:1 | 5.83:1 |
        | dark mobile (`#404040`) | **1.48:1** | **5.82:1** |

        Dark mode's scrollbar was effectively invisible. Fixed by defining
        `--text-rgb` alongside `--color-text-primary` in both theme scopes in
        `design-system/tokens/colors.css` (light `23, 23, 23` = gray-900; dark
        `250, 250, 250` = gray-50), so it tracks the text colour it is supposed
        to mirror. Verified in Chrome 152: `scrollbar-color` now computes to
        `rgba(23, 23, 23, 0.7)` in light and `rgba(250, 250, 250, 0.7)` in dark.
        The design-system token snapshot test caught the two new tokens, as
        designed; snapshot updated deliberately. Full suite green — 112 files,
        4419 passed, 1 skipped.

      - `.mt-lg` — **the audit was wrong about this one: it never went live,
        because it is dead at all four call sites.** Resolved 2026-09-02 by
        walking the `@import` graph of each bundle. `.mt-lg` is defined only in
        `base/utilities.css`, and `base/utilities.css` is reachable only from
        `bundles/site.css` — the public site. All four call sites
        (`PortalProposalDetail.tsx` x3, `RateLimitingTab.tsx` x1) are portal and
        admin React components, which load `bundles/client.css` /
        `bundles/admin.css`; neither bundle imports `base/utilities.css` at any
        depth. `portal-layout.css` has no `.mt-lg`, and Tailwind (which IS loaded
        there, via `react/portal-entry.tsx` and `admin.ts`) has no such class —
        its spacing scale is numeric. So those four elements have always rendered
        0px, and fixing the custom properties changed nothing for anyone.

        **Renaming it to `.mt-4` would have been a bug.** `.mt-4` already exists
        in `portal/shared/portal-layout.css` — the bundle these call sites
        actually load — as `--space-2` = **16px**. The two files use
        incompatible conventions: `base/utilities.css` is 8px-per-step
        (`.mt-3` -> `--space-3`, 24px), `portal-layout.css` is Tailwind-style
        4px-per-step (`.mt-4` -> `--space-2`, 16px; `.mt-6` -> `--space-3`, 24px).
        Renaming would have moved those four spots from 0px to 16px and cemented
        a class name meaning two different things in two bundles.

        **Done:** deleted the dead `.mt-lg` rule from `base/utilities.css` and
        stripped the no-op class from all four `className` strings. Rendering is
        byte-identical; typecheck and lint clean. If those four spots actually
        want separation, that is a new decision — the portal scale tops out at
        `.mt-6` (24px), so 32px would need a real `.mt-8` added to
        `portal-layout.css` rather than borrowed from the site's scale.

      - **Latent hazard found on the way.** `.mt-1`, `.mt-2`, `.mt-3` and `.mb-4`
        are each defined in BOTH `base/utilities.css` and `portal-layout.css`
        with DIFFERENT values (8px-step vs 4px-step). They do not collide today
        only because the two bundles are disjoint — `site.css` has utilities and
        not portal-layout, the portal bundles the reverse. Anything that ever
        pulls both into one page silently changes every one of those margins.
        Worth a naming convention before that happens.
- [ ] **Login form min-height is a design decision.**
      `pages/client-portal-section.css` asked for `min-height:
      var(--portal-form-height)` so the section would not resize when switching
      between the password and magic-link forms. That token never existed, so
      both forms have always been `auto`. The dead declaration is removed; set a
      real height there if the section should stop resizing.
- [x] **Cascade layers — the finding was overstated; the real part is fixed.**
      The original audit said six sheets in `bundles/site.css` were unlayered.
      Three of those six declare their own layer *inside the file*
      (`states/visibility.css` and `states/interactive.css` wrap themselves in
      `@layer states`, `responsive/breakpoints.css` in `@layer responsive`), so
      they were correctly layered all along and their headers were right, not
      wrong. Adding `layer()` to those imports actively broke them: the file's
      own `@layer` nests inside the import's, producing a `states.states` /
      `responsive.responsive` SUB-layer, and a sub-layer sorts before its
      parent's direct content — so the sheet gets demoted while the import line
      looks like a promotion. Caught by the screenshot diff, reverted, and
      written up in `core/layer-order.css` so the next person does not repeat it.

      Genuinely unlayered and now fixed: `layouts/index.css` -> `layer(layouts)`
      and `base/utilities.css` -> `layer(utilities)`. Left unlayered on purpose,
      now documented as the four escape hatches: `pages/projects-detail.css`,
      `base/site-globals.css`, `design-system/tokens/portal-theme.css` and
      `portal/shared/portal-gutter.css`.

      Verified with a screenshot harness — 48 shots (6 routes x 3 viewports x 2
      themes) plus 60 more (8 routes x 3 more viewports x 2 themes), each run
      twice on identical code first to establish a noise floor. Every remaining
      difference is the About page's rotating photo or the TV's flicker. The 404
      route showed a false positive worth remembering: walking seven routes in
      sequence captures it mid-intro, and the card's opacity is set inline by the
      intro JS, so it races. Direct-loading `#/no-such-page` at 393/600/760/1280
      gives a 0-pixel diff.

- [x] **The 13 `!important`s in `mobile/layout.css` — examined; 3 of 13 do
      work.** Measured 2026-09-02 by stripping every `!important` from the
      `@media (--small-mobile)` block (lines 409-540), reloading at 393x852 and
      diffing computed styles against the unmodified baseline. Exactly three
      properties moved:

      | rule | with | without | verdict |
      | --- | --- | --- | --- |
      | `.contact-section` `padding-bottom` | 56px | 0px | **load-bearing** — this is the footer + safe-area clearance; without it the sliding footer covers contact content |
      | `.projects-section` `padding` | 0px | 77px 0 0 | **load-bearing** — 77px of top padding pushes the TV off the centre the absolute positioning just established |
      | `.about-section` `overflow-y` | auto | scroll | marginal — `scroll` forces a permanent gutter on platforms that reserve one; `auto` is the nicer value but nothing breaks either way |

      The other ten changed nothing measurable: `.business-card-section`'s
      transparent background is already transparent without it, and the
      `.about-`/`.contact-`/`.projects-section` height, max-height, overflow-x,
      position and display declarations all already win on source order. Two
      caveats — the `will-change` and `backdrop-filter` overrides on `.nav-portal`
      / `.nav-base` could not be measured because neither element is in the DOM
      at 393px until the menu opens, so they are untested rather than proven
      dead.

      **The cause is specificity, and it is self-inflicted within this one file.**
      The outer `@media (--mobile)` block deliberately ID-weights its about-tile
      rule (`#about.about-section, section#about` — 1,1,0) and its own comment
      says so: it escalated "to win display/overflow fights". The
      `@media (--small-mobile)` block later in the same file then cannot beat
      (1,1,0) with `.about-section, section.about-section` (0,1,1), so it reaches
      for `!important`. Nothing to do with layers or the unlayered escape
      hatches — mobile has always been in `layer(responsive)`. Dropping the ID
      selectors would let source order settle it and retire most of these, but
      that is a real refactor of the about tile's positioning, not a cleanup.

- [ ] **`.header` has two position models — measured; the scary half was
      wrong.** Probed in Chrome at 390/430/480/600/700/767/768/900/1280 on
      2026-09-02.

      **The 480-767px hazard band does not exist.** The earlier note claimed
      `main` is only `position: fixed` below 480px, leaving a band where the
      header is static while `main` is in flow. It is not: `main { position:
      fixed }` is declared unconditionally in `base/layout.css` (~line 109) and
      again in both mobile blocks, and it measures `fixed` at every width from
      390 to 1280. `body` is `overflow: hidden` and the document is not
      scrollable — the map tiles are the scrollers. So nothing is ever in
      document flow, nothing reserves space for the header, and the static header
      below 768px does not travel with content. `translateY(-100%)` still hides
      it correctly. `navigation.ts` not calling `headerTravelsInFlow()` is
      therefore not a live bug; `footer-curtain.ts`'s guard is still right to
      exist, because it also checks which element is scrolling.

      **The z-index half is real but currently inert.** Computed `z-index` is
      130 at every width — `components/nav-base.css`'s `--z-index-nav-header`
      wins and `base/layout.css`'s `z-index: var(--z-index-fixed, 300)` never
      applies. So that declaration is dead and its comment ("Fixed header uses
      standard fixed layer") is false. A DOM sweep for positioned elements with
      `z-index` between 130 and 300 returned **zero** matches, so nothing
      currently covers the header — the risk is latent, not active.

      Remaining work is honesty, not behaviour: delete the dead `z-index` line
      and its comment from `base/layout.css`, or point it at
      `--z-index-nav-header` so the two files agree. `position: static` under
      `@media (--mobile)` should keep a comment saying it is cosmetic — the
      header does not move because nothing around it scrolls.

- [ ] **NEW: `src/main.ts` + `src/styles/main.css` are a dead parallel
      bundle — recommend deleting them.** Chased down from what looked like a
      fifth unlayered escape hatch: `main.css:43` imports `layouts/index.css`
      with no `layer()` clause, and nothing under `layouts/` declares a layer of
      its own, so on any page that bundle served, the whole layouts layer would
      outrank every real layer. It turns out no page is served by it.

      `src/main.ts` is absent from `vite.config.ts` `rollupOptions.input` (the
      inputs are `index.html`, `404.html`, `design-system.html`, `admin`,
      `portal`, `main-site` and the inline-module entries), no HTML references
      it — `index.html` loads `/src/main-site.ts`, which uses `bundles/site.css`
      — and no module imports it. `main.css` is imported only by `main.ts`. The
      `templates/data.json` entries naming `/src/main.ts` as `scriptSrc` for
      four pages are stale: nothing in `scripts/`, `server/`, `vite.config.ts`
      or `package.json` reads that file.

      So the escape hatch is real in the file but has zero live blast radius,
      and adding `layer(layouts)` to a stylesheet nobody loads would be
      theatre. **The honest fix is deletion** — `src/main.ts`,
      `src/styles/main.css`, and the stale `templates/data.json` script
      references. Deleting is destructive and `main.css` is 200+ lines that may
      contain rules worth rescuing into `site.css` first (its mobile
      `::-webkit-scrollbar-track` override is one such orphan), so this needs a
      deliberate pass rather than an `rm`. Left for sign-off.

---

## CSS bundle contract test (new)

**Status:** DONE — `tests/unit/design-system/css-bundle-contract.test.ts`
**Priority:** — the 49 issues it recorded are the follow-up, not the test

Built because the same failure mode got through twice: a `var()` that no bundle
defines. `tokens.test.ts` could not catch either, for two reasons — it only
reads `src/design-system/tokens`, and it deliberately skips any `var()` carrying
a fallback ("a var() with a fallback still renders"). It does render, with the
wrong value, forever. That is how `--text-rgb` survived: one occurrence in the
entire repository, at its own use site, quietly serving a hardcoded near-black
scrollbar to both themes.

The new test walks the `@import` graph of each of the three served bundles and
checks every `var()` against what that bundle actually ships. Properties written
from TypeScript are discovered automatically by scanning for `setProperty(`
rather than kept in a hand-maintained allowlist; `--radix-*` is prefix-excluded
because Radix writes those at runtime.

Three findings, each recorded as a snapshot so the lists can only shrink — a new
gap fails the build, and so does fixing one without recording it:

| check | was | now | meaning |
| --- | --- | --- | --- |
| declaration DROPPED | 11 | **0** | no fallback, no definition — the browser discards the declaration outright |
| living on a FALLBACK | 28 | 28 | the fallback is the value, and cannot respond to theme, breakpoint or surface |
| ambiguous class | 10 | 10 | one class name, two meanings, in bundles that never meet |

**DROPPED is now asserted empty (`toEqual([])`), not snapshotted.** It is a hard
gate: a new one fails the build with no snapshot to update around it. The other
two remain ratchets.

Proven to work by deleting the `--text-rgb` definitions again: the test fails and
names the property in all three bundles.

**All 11 DROPPED are fixed.** The rule applied throughout: a token read by a
file that ships in more than one bundle has to live in the shared token layer;
a stylesheet has no business in a bundle that cannot feed it. Concretely:

- **Toast widths** (`--toast-min-width`, `--toast-max-width`) moved from
  `portal-theme.css` to `dimensions.css`. `bundles/foundation.css` imports
  `portal-toast-notifications.css` for the site too, and `src/main-site.ts` does
  reach `showToast()` — through `code-protection-service` — so the public site
  really does render toasts, and they had no width bounds at all.
- **Select carets** (`--select-caret`, `--select-caret-light`) moved to
  `dimensions.css` beside the existing dropdown caret sizing.
  `components/form-fields.css` sets `appearance: none` on
  `.form-container select` for every surface, so the site was removing the
  native arrow and drawing nothing in its place.
- **Pagination touch target** (`--table-pagination-btn-size-touch`) moved to
  `dimensions.css`. 44px is WCAG 2.5.5, not a portal opinion.
- **`--color-text-muted`** got a shared DEFAULT in `colors.css`
  (`var(--color-text-tertiary)`) rather than being moved, because the portal's
  value is a deliberate override — portal-theme.css flattens it to
  `--color-text-primary` and, being unlayered, still wins. The site needed a
  value for `.error-dismiss` in `components/loading.css`.
- **`portal-field-label-spacing.css` dropped from `bundles/foundation.css`**
  (kept in `foundation-portal.css`). Nothing in the site bundle renders
  `.field-label`, `.meta-label`, `.stat-label`, `.meta-value` or `.meta-item` —
  checked against index/404/design-system and the DOM at runtime. The three
  server-rendered auth pages that DO use those classes run
  `entryScript: '/src/portal.ts'`, so they are served by client.css and are
  unaffected.
- **`--portal-alpha-black-20` -> `--color-shadow`** in
  `components/nav-responsive.css`. A site component was reaching for a
  portal-named token; `--color-shadow` is the site's own, is theme-aware
  (`rgba(0,0,0,0.2)` light, `rgba(0,0,0,1)` dark), and is already what
  `nav-portal.css` uses for the identical `text-shadow: 0 2px 4px`.

**Verified by screenshot diff**, since the last item changes real pixels — a
`text-shadow` that had been silently dropped now draws. Captured before and
after at 393 and 1280 across home/about/projects/contact, each state captured
twice to establish its own noise floor. Result: a diff of exactly **2043 px
confined to y=0-100** on every 393px route, which is the nav logo and menu
button gaining their shadow — the intended fix, and identical on all four
routes. Every 1280px route showed **no differing band at all**. Residuals of 268
and 117 px sit in the About photo and TV regions, which are the known animators.

The method, and the two ways it nearly produced false alarms, are written up in
`scripts/capture/README.md` under "Comparing two states (visual regression)" —
kept there rather than here because this file gets pruned as items close and
that one is where the next person looks for capture technique.

The 10 ambiguous classes are the `.mt-4` problem generalised: `.mt-2`, `.mb-4`,
`.grid-cols-1`, `.grid-cols-3`, `.text-accent`, `.text-secondary`,
`.error-message`, `.header-toggle-button`, `.project-name`, `.overview-grid`.
`base/utilities.css` counts spacing in 8px steps, `portal-layout.css` in
Tailwind's 4px steps, and both spell the result the same way. Worth one naming
convention before anything ever loads both.

---

## TV title-card text runs to the edge of the screen

**Status:** DONE (2026-09-01) — fixed by the textured re-export (aa63673d).
Measured on the new cards: the-backend 84.1% of card width, hedgewitch 90.4%,
no-bhad-codes 48.4% (it wraps to two lines). Was ~96%; the target below was ~85%.
**Priority:** Low — cosmetic

The channel title text ("HEDGEWITCH HORTICULTURE" / "BUSINESS WEBSITE") nearly
touches the left and right edges of the lit screen. This is baked into the
artwork, not a layout bug — measured on `public/images/tv/title-cards/`:

| measure | value |
| --- | --- |
| card canvas | 2850 x 2186 |
| card artwork box | 2049 x 1537 at +211+191 (71.9% of canvas) |
| bright text inside the card | spans x 39..2010 of 2049 |
| margin inside the card | 39px each side — **1.9%** |

For reference the base screen aperture is 72.7% of the canvas, so the card sits
*inside* the aperture correctly; there is simply almost no margin drawn around
the type.

Ruled out, with evidence:

- **Not the 2850 -> 1600 image resize** (`d373b726`). That touched only
  `base-off/base-on/buttons/chassis`, and it was uniform: the base content box
  `2072x1537+183+191` scales to exactly `1165x864+102+107` at 1600px.
- **Not a change to the cards.** `hedgewitch.webp` is byte-identical to the
  version added in `ff38e4fd`.

**Fix:** re-export the title cards with the type at roughly 85% of the card
width instead of ~96%. Do NOT try to scale the composed card in CSS — the card
carries its own background, so shrinking it exposes the `_bg` artwork behind it
at a different scale and the concentric-ring pattern seams visibly.

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

**Tried again 2026-09-01 and reverted again (4352ad8e).** A 7kHz low-pass plus
loudnorm — a top-end filter, i.e. the thing this section says not to do. It
landed at 1,122,379 bytes against the 1,087,219 of the attempt already reverted
in `e9ef3491`, so it was effectively the same processing. The measurements from
it are worth keeping: ch3 sits at 7.8dB HF-below-overall against ch4's 20.9dB,
and it was overshooting full scale at +0.7 dBFS (ch2 is worse, at +1.2). **The
clipping is a separate, real problem from the hiss and can be fixed by gain
alone** — that part does not need a filter and is the untried first step above.

---

## Open items from the Aug 29 session

**Status:** OPEN
**Priority:** Medium

Carried out of the footer-curtain / lint / Prettier session. Nothing here
blocks anything; they are the loose ends that session left.

- [ ] **E2E: 4 of 6 navigation tests pass** (was 0 — the suite could not even
      launch). Fixing it turned up three real bugs, all now fixed and committed:
      menu hrefs came from stale `navigation.main` data and overwrote the
      router's own routes (`ba352652`), a hash arriving during the intro was
      dropped so the URL and the camera disagreed for the rest of the session
      (`74b2a8cc`), and `detectCurrentPage` compared hrefs against
      `location.pathname` — always `/` on a hash-routed SPA — so no menu item
      was ever marked current (`fd1c178d`).
      The two that remain, `back/forward` and `keyboard accessible`, both hang
      waiting for the app to report a settled page after a document-level
      `goto`. Neither reproduces by hand: the same sequence driven manually
      reaches `about` with the section at 0,0 in about three seconds. Suspect
      the test-side wait rather than the app. Run with
      `npx playwright test tests/e2e/navigation.spec.ts --project=chromium --workers=1`
      and nothing else competing — a parallel capture run once stretched the
      same suite from 8.5s to 15.9 minutes.
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
