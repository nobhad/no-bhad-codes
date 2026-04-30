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
- [ ] **Reincorporate tech-stack content somewhere on the site** — the tech-marquee transition bumper was removed during the scroll-map pivot; the 43-item tech list should land somewhere meaningful (dedicated "kit" page, project-detail sidebar, footer panel, or new home for it). Content list preserved in git history at `index.html` lines 876–920 of commit prior to marquee removal.

---

## TV Channel System (Projects Page)

**Status:** SHIPPED v1 — outstanding polish + features below

The projects page renders a vintage TV with a channel-guide screen. Channel 01 is the guide itself; channels 02+ are individual project tune-ins. Selecting (Enter / click / wheel-cycle to a project channel) plays a static burst, fades the composed title card in, fades to the bg-only image, then auto-cycles through case-study panels (Details → Tagline → Intro → Challenge → Approach → Key Features → Results → Tools → Outro). Outro panel sticks with a click-through link to the existing project-detail page.

### Open Mobile Bugs (paused at end of day, pick up next session)

- [ ] **Business card hovers over every section after navigating left/right through all pages the first time.** STILL REPRODUCING. Earlier code-path read suggested the post-init `.page-active` add-sites (`intro-animation.ts:1408`, `intro-animation-mobile.ts:728`) shouldn't be reachable, but the bug still presents — ruling out the static-analysis hypothesis. **Next:** live DOM inspection of `.business-card-section` z-index / classList / transform during a reproduction to confirm what's actually being applied after one nav cycle. Suspect a `.site-map` camera transform that doesn't translate the intro tile off-screen on re-entry, OR a child transform creating a stacking context that overrides the parent translate.
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
