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

- [ ] Horizontal scroll-map nav model — pages arranged as a 2D scroll map around the intro center; replaces the current blur-based transition for nav menu / intro-nav / all non-paw transitions. Paw stays sovereign for intro ↔ any.
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
- [ ] **Pike portfolio entry** — Pike Powder Coating site (5,607 LOC, designed + built, client opted not to launch — personal preference, not work-related). Decide whether to: (a) finish polish + add as case study with `liveUrl` omitted, or (b) defer until other portfolio gaps are closed. Notes: project lives at `/Users/noellebhaduri/Projects/Development/Active/pike`, has design docs (ANIMATION_INTERACTION_PLAN.md, CONTENT_EDITING_GUIDE.md).

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
- [ ] **Re-align `title-card_base.webp` artwork** — base bbox `(100, 95, 1137, 864)` is ~6px wider on each side than the per-project cards `(106, 95, 1131, 864)`. Causes a small visible jump when cycling between channel 01 and 02+. Re-export from same artboard origin as the project cards so artwork lands at x:106-1131.
- [x] **Update "No Bhad Codes" case study copy** — keyFeature `"CRT TV hover preview"` replaced, scroll-map + TV channel guide added, approach paragraph rewritten to mention signature features.
- [x] **Verify Hedgewitch and The Backend case studies** — Backend feature claims verified against actual code (`013_magic_link.sql`, `message-service.ts`, Chart.js, node-cron, etc.). Hedgewitch is a separate project — copy reads accurately.
- [x] **TV channel copy condensed** — added `tv` namespace per project. TV reads from `tv.X ?? X`. All three documented projects have curated TV copy.
- [x] **Trace root cause of arrow-key native page scroll** — `page-transition.ts:handleKeydown` only called `preventDefault` after navigation gates (`isTransitioning`, `!introComplete`, `canNavigate`); during those windows the browser native-scrolled. Fix: moved `preventDefault` before the gates so any arrow key on a managed page is unconditionally swallowed (form inputs still opt out). Backup window-listener in `projects.ts` and the `isOnProjectsPage()` helper that supported it have been removed.
- [x] **Channel-change static crackle + channel-up beep** — implemented as `src/modules/audio/tv-sfx.ts` (procedural WebAudio synthesis, no asset files). Static = filtered white-noise burst, beep = 880Hz sine. Master gain via 5-step volume tied to VOLUME ▲▼ buttons.
- [x] **Mobile TV** — TV is fully responsive at all widths; channel-rows visible with smaller typography, button hit area extended, full-width on phones. No mobile fallback needed.
- [x] **Channel 01 redesigned as Prevue Guide layout** — top split (brand info + glowing-eye avatar with inlined eye-glow filter); bottom slow ticker of project rows (rendered twice, GSAP translates the inner ul up at ~16 px/sec for a seamless loop).
- [ ] **Documentation: refresh `MAIN_SITE_DESIGN.md` projects section** to reflect the new TV channel architecture in more depth (panel cycle, button wiring, channel index model). Currently only the table rows were updated.

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

## PDF Deep Dive

**Status:** PARTIALLY COMPLETE

- [x] Label bolding — parseInlineBold() + drawInlineBoldText() in markdown-to-pdf.ts
- [x] SOW header — removed unused `sowLogoHeight: 50` constant, all generators use standard 100pt
- [x] Margin alignment — markdown-to-pdf.ts margins updated from 45pt to 54pt (matches all other generators)
- [ ] Full formatting review (spacing, table layouts, typography consistency across all 6 PDF types)

---

## Archived Work

Previous work moved to: [ARCHIVED_WORK_2026-03.md](./docs/archive/work-logs/ARCHIVED_WORK_2026-03.md)
