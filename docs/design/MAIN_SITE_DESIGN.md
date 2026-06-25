# Main Site Design System

**Last Updated:** June 25, 2026

Design standards for the main marketing site (home, about, contact, projects portfolio). For shared design tokens see [CSS Architecture](./CSS_ARCHITECTURE.md). For portal design see [Portal Design](./PORTAL_DESIGN.md).

---

## Table of Contents

1. [Overview](#overview)
2. [Page Architecture](#page-architecture)
3. [CSS Bundle](#css-bundle)
4. [Page Styles](#page-styles)
5. [Component Styles](#component-styles)
6. [Typography](#typography)
7. [Business Card and Intro](#business-card-and-intro)
8. [Projects: TV Channel System](#projects-tv-channel-system)
9. [Contact Form](#contact-form)
10. [Navigation](#navigation)
11. [GSAP Animation Modules](#gsap-animation-modules)
12. [Page Transitions](#page-transitions)
13. [Mobile and Responsive](#mobile-and-responsive)
14. [Theme System](#theme-system)

---

## Overview

The main site is a single-page portfolio/marketing site with:

- **Spatial scroll-map navigation** (desktop) -- the tiles sit on a 2D map; scroll / two-finger swipe / arrow keys pan the camera between them with GSAP slide transitions. Nav-menu and direct hash links use a blur crossfade instead.
- **Discrete one-tile-at-a-time pages** on small mobile (`max-width: 479px`) -- header stays fixed, the hamburger menu swaps the active tile, no camera/scroll-map
- **GSAP-driven animations** throughout (intro, page transitions, scroll effects, SVG morphing)
- **Business card component** with 3D perspective and hover interactions
- **Terminal-inspired design elements** on the intake page
- Entry point: `index.html`
- Default route: `#/` (intro/business card)
- Routes: `#/`, `#/about`, `#/contact`, `#/projects`, `#/projects/[slug]`, `#/admin-login`, `#/portal`

---

## Page Architecture

### Desktop -- Virtual Pages

On desktop (`min-width: 768px`), the site operates as virtual pages:

- `main[data-virtual-pages]` is positioned fixed, filling the viewport between header and footer
- Each section (`<section>`) is positioned absolutely within main
- Only one page is visible at a time
- Page transitions are GSAP blur crossfades (blur out current, blur in next)
- Managed by `PageTransitionModule` in `src/modules/animation/page-transition.ts`

### Mobile -- Discrete Tiles

On small mobile (`max-width: 479px`):

- One map tile fills the viewport at a time; the hamburger menu swaps the active tile via hash routing (no camera/scroll-map, no scroll-snap)
- Header stays fixed at the top; `body` / `main` are `overflow: hidden` and each tile is its own scroll container with `overscroll-behavior: contain`, so the page doesn't rubber-band the header on iOS
- The coyote-paw intro still plays
- Touch-optimized targets (44x44px minimum)

### Page State CSS Classes

| Class | Purpose |
|-------|---------|
| `.page-hidden` | Complete hide (display: none, opacity: 0, visibility: hidden, pointer-events: none) |
| `.page-entering` | Initial invisible state before GSAP animation (opacity: 0, blur) |
| `.page-active` | Active page (display set per section type, visibility via GSAP autoAlpha) |

Defined in `src/styles/components/page-transitions.css`.

---

## CSS Bundle

**Entry point:** `src/styles/bundles/site.css`

Import order:

1. `foundation.css` -- Shared foundation (layer order, reset, tokens, base, forms)
2. Navigation components (base, animations, responsive, portal)
3. Business card + intro components
4. Footer
5. Page-specific styles (about, contact, projects, projects-detail, terminal-intake, client-portal-section)
6. Page transitions and visibility states
7. Mobile overrides
8. Site globals (unlayered -- highest cascade priority)

### Cascade Layers

The site bundle inherits the foundation cascade layers then adds page-specific styles:

1. `reset` -- Browser resets
2. `tokens` -- CSS custom properties
3. `base` -- HTML element defaults, typography
4. `components` -- Navigation, business card, forms
5. `layouts` -- Grid/flex patterns
6. `pages` -- Page-specific styles
7. `states` -- Visibility and interactive states
8. `responsive` -- Media query overrides
9. `utilities` -- Final overrides

Unlayered styles at the bottom of site.css have highest cascade priority.

---

## Page Styles

Located in `src/styles/pages/`:

| File | Page | Key Classes | Layout |
|------|------|-------------|--------|
| `about.css` | About section | `.about-section`, `.about-layout`, `.about-image-column`, `.about-text-column` | Two-column grid (image + text) |
| `contact.css` | Contact form | `.contact-section`, `.portal-login-form` | Centered single column |
| `projects.css` | Portfolio list | `.projects-section`, `.crt-tv`, `.crt-tv__channel-list`, `.crt-tv__guide-top` (info + avatar), `.crt-tv__guide-bottom` (ticker viewport), `.crt-tv__channel-rows`, `.crt-tv__panels` | Centered vintage TV with Prevue-Guide-style channel screen (top: brand info + glowing-eye avatar; bottom: slow auto-scroll ticker of project rows) and tune-in panel sequence |
| `projects-detail.css` | Project detail | `.project-detail-section`, `.worksub-wrapper`, `.worksub-header`, `.worksub-intro` | Scrollable column, max-width 1000px |
| `terminal-intake.css` | AI intake form | `.terminal`, `.terminal-intake` | Terminal style (monospace, green-on-dark) |
| `client-portal-section.css` | Portal login | `.portal-login-form` | Form states (password vs magic-link) |
| `auth-gate.css` | Auth container | `.auth-form`, `.login-error` | Responsive form with padding/height |

---

## Component Styles

Located in `src/styles/components/`:

### Navigation

| File | Purpose |
|------|---------|
| `nav-base.css` | Core nav structure (`.header`, `.nav`, `.menu`, `.menu-link`, `.menu-button`) |
| `nav-animations.css` | Nav animation states (`[data-nav="open"]`, rolling text hover effects) |
| `nav-responsive.css` | Mobile/tablet nav adjustments |
| `nav-portal.css` | Portal-specific nav variations |

### Business Card

| File | Purpose |
|------|---------|
| `business-card.css` | Interactive card (`.business-card-section`, `.business-card-container`, 525x294.19px, 3D perspective) |
| `intro-nav.css` | Links below card (`.intro-nav`, `.intro-nav-link`, 525px width matching card) |
| `intro-morph.css` | Paw morph overlay (`.intro-morph-overlay`, fixed positioning, z-index 50, GSAP MorphSVG ready) |

### Other

| File | Purpose |
|------|---------|
| `page-transitions.css` | Virtual page transition states and positioning |
| `site-map.css` | 5-tile spatial map: per-tile positions and camera transform |
| `footer.css` | Fixed footer (`.footer`, z-index below nav) |
| `form-fields.css` | Form input styling (`.form-container`, `.form-input`, `.form-textarea`) |
| `form-buttons.css` | Button system (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`) |
| `form-validation.css` | Validation error styles |
| `loading.css` | Loading spinners and skeletons |

---

## Typography

Main site typography defined in `src/styles/base/typography.css`:

| Element | Font | Size | Weight |
|---------|------|------|--------|
| h1 | Acme | `clamp(2rem, 5vw, 4rem)` | Bold |
| h2 | Acme | `clamp(1.5rem, 4vw, 3rem)` | Bold |
| h3 | Acme | `clamp(1.25rem, 3vw, 2rem)` | Bold |
| Body text | System fonts | `clamp(1rem, 3vw, 1.125rem)` | Regular |

- **Acme** font for all headings and card titles
- **System fonts** for body text
- Fluid scaling via `clamp()` functions
- Text shadows on headings for depth
- `text-transform: uppercase` on headings

---

## Business Card and Intro

### Animation Flow

1. Page loads with `<html class="intro-loading">`
2. Business card renders centered at fixed 525x294.19px (1.78423:1 ratio)
3. Intro nav links appear below card (matching width)
4. Paw morph overlay animates via GSAP MorphSVG (desktop only)
5. On mobile: the full coyote-paw morph, scaled for mobile (`MobileIntroAnimationModule`) -- not a card flip
6. `.intro-complete` / `.intro-finished` classes applied when done
7. User navigates to other pages via hash links

### Business Card Dimensions

```css
.business-card-container {
  width: 525px;
  height: 294.19px; /* Exact 1.78423:1 ratio */
}
```

Desktop positioning (from page-transitions.css):

```css
/* Centered in viewport */
top: calc(50% - 147.1px);
left: calc(50% - 262.5px);
```

### Key Files

- HTML: `index.html` (`.business-card-section`)
- CSS: `src/styles/components/business-card.css`, `intro-morph.css`, `intro-nav.css`
- JS: `src/modules/animation/intro-animation.ts` (desktop), `intro-animation-mobile.ts` (mobile)

---

## Projects: TV Channel System

The projects page renders a single vintage TV with a Looney-Tunes / Prevue-Guide-styled channel screen. There is no card list. Cycling channels surfs through projects; selecting a channel "tunes in" with a static-burst animation and auto-cycles a case-study panel sequence on the screen, with a click-through to the full project-detail page in the outro.

### Channel Index Model

| Channel | Slot | Behavior |
|---------|------|----------|
| `01` | TV Guide (default) | Brand info + avatar + slow ticker of project rows |
| `02` ... `0N` | One per documented project | Tunes in to that project's panel sequence |

`currentTvIndex` lives on `PageTransitionModule` (not `ProjectsModule`) because vertical input on the projects tile is gated through the same code path that handles tile-to-tile navigation. Conversion: `slug = slugs[currentTvIndex - 1]` for index >= 1, guide for `0`. Total channels = `slugs.length + 1`.

### Channel 01: TV Guide Layout

The guide screen mimics the late-90s Prevue Guide channel:

- **Top half** (`.crt-tv__guide-top`, 45% of screen height) — split into two equal columns:
  - Left: static brand info — `NO BHAD CODES` / *"Portfolio Guide"* / `Channel 01`. Mono font, all white (no Prevue-yellow accent — TV interior is monochrome greyscale by design). Lines are `white-space: nowrap` and grid columns are `minmax(0, 1fr)` so a long line never squeezes the avatar pane.
  - Right: avatar SVG with glowing eye. Inlined into the markup with a local `<filter id="tv-guide-eye-glow">` (Gaussian-blur-merge) so the eye filter resolves without depending on the contact page's `<defs>`. ViewBox cropped to `270 165 250 330` (the actual avatar bounds within the original 514.67×487.98 SVG, which reserved space for an unused speech-bubble) so `xMidYMid meet` centers the head in the pane. Body paths fill `#3a3a3a` (mid-dark grey silhouette against the dark screen); eye stays white and pops via the glow filter.
- **Bottom half** (`.crt-tv__guide-bottom`) — overflow-clipped viewport for `.crt-tv__channel-rows`. Rows are rendered twice in the DOM (the second copy is `aria-hidden="true"` and `tabindex="-1"`), and a GSAP tween translates the inner track up at `~16 px/sec`, snapping back to `0` after each loop for a seamless ticker. Row click / keyboard select still tunes in normally; the ticker keeps running underneath.

### Channels 02+: Tune-In Sequence

```text
Static peak → screen-bg fades to black momentarily →
swap screen-bg to per-project bg image → fade composed title-card on top →
hold ~1.4s → fade composed card out, leaving textless bg →
auto-cycle panels: details → tagline → intro → challenge → approach →
                   key features → results → tools → outro
```

Per-panel hold timing (`TV_PANEL_HOLD_S` map in `projects.ts`):

| Panel | Hold (s) | Treatment |
|-------|----------|-----------|
| `details` | 5.0 | Two-column Role / Year / Duration credits |
| `tagline` | 4.0 | Word-by-word pulse animation |
| `intro` | 9.0 | Scrolling paragraph |
| `challenge` | 9.0 | Heading-flash + word-pulse + body |
| `approach` | 9.0 | Heading-flash + word-pulse + body |
| `features` | 7.0 | List |
| `results` | 7.0 | List |
| `tools` | 5.0 | Tag pills |
| `outro` | sticky | Click-through to `#/projects/[slug]`. Clicking anywhere on a playing screen also jumps to the detail page in the same tab (slides **down**); the explicit "Live: url" link still opens the live site in a new tab |

Mobile prose panels (intro / challenge / approach) auto-scroll bottom-to-top instead of static fade so the full text is reachable on the smaller screen. Hold time is multiplied by `TV_MOBILE_SCROLL_HOLD_MULTIPLIER` (2.2) on mobile so the scroll has time to complete.

### Per-Card Text Color

Each project's `titleCard.color` (hex) drives panel typography via a CSS custom property `--tunein-color`. A `contrastVeil()` helper computes a per-card overlay opacity from luminance so paragraphs read against the bg image without per-card CSS overrides.

### TV Frame and Overlays (image-based positioning)

The TV is composed of stacked transparent images sized to a single canvas (`1426×1093` for newer exports, mostly):

| Layer | Source | Notes |
|-------|--------|-------|
| Frame | `vintage_television.webp` (1426×1093) | The wood case + screen aperture + painted control labels |
| Title-card base (on) | `title-card_base-on.webp` (1426×1093) | Lit base shown when the TV is powered on, between channels, and while the channel-list is visible |
| Title-card base (off) | `title-card_base-off.webp` (1426×1093) | Dark/blank base shown when the TV is powered off (`.crt-tv.is-powered-off`) |
| Per-project bg | `title-card_[slug]_bg.webp` (1426×1093) | Used during a tune-in; stacks at `inset:0; width/height:100%` (full-canvas with transparent surroundings) |
| Composed title card | `title-card_[slug].webp` (1426×1093) | Bg + baked text; fades on top during the tune-in entry beat then fades out |
| LED channel readout | `channel_NN.webp` (1426×1093) | Lit digit baked at the right spot on a transparent canvas — stacks at `inset:0; width/height:100%`, no per-image positioning |

### Buttons

Painted control labels (POWER / CHANNEL ▼▲ / VOLUME ▼▲) sit on the TV frame image. Invisible `<button>` overlays match the painted positions:

| Button | Wired | Action |
|--------|-------|--------|
| POWER | yes | Toggles `.is-powered-off` on `.crt-tv` (swaps `title-card_base-on.webp` ↔ `title-card_base-off.webp`, hides channel-list + LED). Going off → on plays the static SFX. |
| CHANNEL ▲▼ | yes | Cycles channel forward/back, mirrors wheel/arrow keys |
| VOLUME ▲▼ | yes | Steps `tvSfx` master gain through 5 levels (0/0.25/0.5/0.75/1.0); persisted to localStorage. Affects the static SFX only — the click stays at fixed gain. |

On mobile the button hit area is extended by `padding: 1% 0` (about half the gap to the next button) so finger taps don't have to land precisely on the thin painted strip. Every TV button click also fires the mechanical click SFX via a delegated listener scoped to `.crt-tv__btn`.

### Sound Effects

`src/modules/audio/tv-sfx.ts` — singleton with two independent gain stages:

- **`click()`** — recorded button sample at fixed `clickGain: 0.22`. Fires on any `.crt-tv__btn` press (POWER / CHANNEL ▼▲ / VOLUME ▼▲) via a document-level delegated listener. Not affected by VOLUME ▼▲ — tactile feedback stays present even at volume:0.
- **`static()`** — recorded TV-static sample with a configurable `ATTACK → HOLD → optional DROP → SUSTAIN → RELEASE` envelope. Routes through `masterGain` (the volume-controlled stage). Fires at the start of `playTuneInSequence` (channel tune-in) and `transitionToGuide` (back to channel 01) using a step-down shape (sharp attack, brief peak, drop to ~35% sustain, fade), and on POWER off → on using the default attack/hold/release shape (gentle ease, brief hold, long trail).

Samples sourced from soundbible.com:

- `/audio/channel-click.mp3` — "Button" by Mike Koenig (CC BY 3.0)
- `/audio/tv-static.mp3` — "TV Static" by Mike Koenig (CC BY 3.0)

ATTRIBUTION OWED for both: Mike Koenig under CC BY 3.0. Add credit somewhere user-visible (footer / about / credits).

### Vertical Channel-Surf and Arrow-Key Default-Suppress

Vertical input on the projects tile cycles channels with modulo wrap (down-past-last → guide, up-before-guide → last project). It does NOT exit the tile vertically — horizontal `← →` exits to about / contact. `tryNavigateDirection` doesn't set `isTransitioning` for channel-surf since no tile transition runs.

`page-transition.ts:handleKeydown` calls `event.preventDefault()` for arrow keys on managed pages (any map tile + project-detail) **before** the navigation gates run. This keeps the browser from native-scrolling during the brief windows when the gates would otherwise return early — `isTransitioning` mid-transition, `!introComplete` during the coyote-paw, or `canNavigate` returning false at the edge of the spatial graph.

### Key Files

- HTML: `index.html` (`.projects-section .projects-tv-wrap .crt-tv`)
- CSS: `src/styles/pages/projects.css` (TV frame + channel-list + tune-in panels), `src/styles/mobile/layout.css` (mobile sizing + button hit area)
- JS: `src/modules/ui/projects.ts` (channel list render, ticker, button wiring, tune-in sequence, panel cycle), `src/modules/animation/page-transition.ts` (channel index + ↑↓ cycling + arrow-key default-suppress)
- Data: `public/data/portfolio.json` (per-project `titleCard.{composed,bg,color,primary,primaryPt,secondary,secondaryPt}` + optional `tv` namespace for condensed channel-preview copy that overrides `description`/`challenge`/`approach`/etc.)

### Outstanding

- Add Mike Koenig CC BY 3.0 attribution somewhere user-visible (footer / about / credits) for `channel-click.mp3` and `tv-static.mp3`.
- Investigate residual shadow-clipping on the TV frame's `filter: drop-shadow()` — addressed at the layout level by setting `main { overflow-y: visible }` and `.site-map > [data-map-tile] { overflow-y: visible }`, but a deep-dive audit of every potential clipping ancestor is still pending.

---

## Contact Form

The `#contact` tile holds a four-field form (name, company, email, message) over the avatar watermark.

### Field labels are the placeholders

Each field's visible label IS its placeholder -- the real `<label>` elements are `display: none` and the placeholders (`Name *`, `Email *`, …) carry the field names. `--placeholder-opacity` defaults to `1` (in `contact.css`) so they show from first paint. It used to be `0` while an entrance animation faded the placeholders in; that animation was removed, so the default had to flip -- otherwise every field renders as an empty box.

### Submission + CSRF

`ContactService.submitToCustom` POSTs JSON to `/api/contact`. The server's CSRF middleware requires an `x-csrf-token` header that matches the JS-readable `csrf-token` cookie, so the client:

1. **Ensures the cookie exists.** The public contact form is usually the first `/api` call of a session, so on a cold visit the cookie isn't set yet. `ensureCsrfToken()` primes it with a safe `GET /api/health` (the server sets the cookie on any request), then re-reads.
2. **Sends the token.** Reads the cookie via the shared `getCsrfToken()` (`src/utils/api-client.ts`) and sends it as `x-csrf-token`, with `credentials: 'include'`.

Without both steps the POST returns `403 CSRF_TOKEN_INVALID` ("Unable to send message"). On invalid input the client shows a validation arrow pointing at the first bad field.

---

## Navigation

Managed by `src/modules/ui/navigation.ts`:

- Client-side hash routing
- Menu open/close animations via GSAP
- Rolling text hover effects on menu links
- Theme switching support
- Responsive behavior (mobile hamburger, desktop full nav)

### Z-Index Hierarchy

| Layer | Z-Index |
|-------|---------|
| Content | 1 |
| Intro morph overlay | 50 |
| Elevated | 100 |
| Nav | 100 (`--z-index-nav`; sub-layers header/overlay/menu at 110/115/120) |
| Fixed elements | 300 |

---

## GSAP Animation Modules

Located in `src/modules/animation/`:

| File | Purpose | GSAP Features |
|------|---------|---------------|
| `intro-animation.ts` | Coyote paw clutching business card with SVG morphing | `gsap.to()`, `gsap.set()`, `gsap.timeline()`, MorphSVG |
| `intro/svg-builder.ts` | Loads `coyote_paw.svg`, computes alignment to the actual card | — |
| `intro/morph-timeline.ts` | Builds the entry → clutch → release → retraction timeline | `gsap.timeline()` |
| `intro/intro-types.ts` | Shared TypeScript types for the intro module | — |
| `intro-animation-mobile.ts` | Mobile: full coyote-paw morph (MorphSVG), scaled for mobile | `gsap.to()`, `gsap.timeline()`, MorphSVG |
| `about-hero.ts` ⚠️ LEGACY/UNWIRED | Old full-viewport "NO BHAD CODES" hero-text animation. `AboutHeroModule` is never instantiated or registered (not in `modules-config.ts`); the `#hero` tile it targets is an orphan (`page-hidden`, unreachable in the carousel). Superseded by `text-animation.ts`. Safe to delete. | — |
| `page-hero.ts` ⚠️ LEGACY/UNWIRED | Old hero text for virtual pages; `PageHeroModule` never instantiated. Same status as `about-hero.ts`. | — |
| `base-hero-animation.ts` ⚠️ LEGACY/UNWIRED | Shared base class for the two dead hero modules above; only imported by them. | — |
| `page-transition.ts` | Spatial scroll-map navigation (camera pan + bridge slides), blur transitions for direct links, project-detail carousel, projects channel cycling, wheel/keyboard input | `gsap.to()`, `gsap.timeline()`, `ScrollTrigger` |
| `contact-animation.ts` | Contact entrance: heading blur-in, hr + options fade, submit-button pop, avatar star-glow pulse. Form FIELDS are NOT animated (render static); skipped entirely on small mobile and reduced-motion | `gsap.to()`, `gsap.context()` |
| `avatar-intro.ts` | Avatar SVG fade-in for terminal intake | `gsap.to()`, `gsap.fromTo()` |
| `text-animation.ts` | Scroll-driven split-text skew animation | `gsap.timeline()`, `ScrollTrigger` |

### UI Module GSAP Usage

Located in `src/modules/ui/`:

| File | Purpose |
|------|---------|
| `projects.ts` | TV channel guide rendering, channel cycling (wheel/keys/buttons), Looney-Tunes-style title-card tune-in animation, panel cycle (heading flash + body fade), POWER/CHANNEL button wiring, project-detail page rendering |
| `contact-form.ts` | Contact form validation + submission (no field-entrance animation; validation arrow points at the first invalid field) |
| `business-card-interactions.ts` | Business card hover/interaction effects |
| `navigation.ts` | Menu open/close, rolling text, theme transitions |

### GSAP Utilities

`src/utils/gsap-utilities.ts` exports reusable functions:

- `fadeIn()` / `fadeOut()` -- Opacity
- `blurIn()` / `blurOut()` -- Filter blur
- `slideIn()` -- Directional slide (top/bottom/left/right)
- `scaleIn()` / `scaleOut()` -- Scale with opacity
- `spin()` / `pulse()` / `bounce()` / `shake()` / `flip()` -- Effects
- `pulseGlow()` -- Box-shadow pulse
- `setWillChange()` / `clearWillChange()` / `withWillChange()` -- GPU acceleration

### Hero Text Animation Pattern (legacy)

> ⚠️ This pattern lives in the unwired `base-hero-animation.ts` (see the LEGACY rows above) and does not run on the current site. Kept here for reference only.

From `base-hero-animation.ts` -- the shared pattern for about/page hero text:

- Left group: skewY -30 to -15, scaleX 0.6 to 0.85
- Right group: skewY 15 to 30, scaleX 0.85 to 0.6
- Text elements: xPercent -100 to 0, slide in from left
- Wheel-driven on desktop

---

## Page Transitions

Managed by `PageTransitionModule` (`src/modules/animation/page-transition.ts`):

### Desktop Behavior

Pages live on a 2D **spatial scroll-map** (`.site-map`): intro is centre, about is up, projects is right, contact is down, with `project-detail` as an off-map overlay. `PageTransitionModule` pans a GSAP "camera" between tiles. Two transition modes:

- **Slide** (scroll / swipe / arrow-key nav) -- the camera + tiles translate along the gesture axis. Map→map slides use a "bridge" that animates the source and target tiles individually, so adjacent and diagonal hops both read as a clean axis-locked pan.
- **Blur** (nav menu / direct hash link) -- current page blurs out (`opacity: 0`, `filter: blur(12px)`), next blurs in. Duration/easing in `src/config/animation-constants.ts`; `gsap.killTweensOf()` cleans up and `gsap.set()` clears props after.

#### Carousel + input model

Navigation is a **horizontal carousel**: `intro → about → projects → contact → intro …` (forward = right, back = left). Input handled by `handleWheel` / `handleKeydown` in `page-transition.ts`:

| Surface | Vertical scroll / ↑↓ | Horizontal swipe / ←→ | Shift + wheel |
|---------|----------------------|-----------------------|---------------|
| intro / about / contact | navigate the carousel (vertical is remapped to horizontal) | navigate the carousel | navigate (mouse-wheel parity) |
| **projects** | **channel-surf the TV** (down = next channel, up = prev) | navigate to about / contact | navigate (leave the tile) |
| project-detail | native-scroll the case study, then navigate at the boundary | cycle prev / next project | cycle prev / next project |

`Shift + wheel` gives a plain mouse (vertical wheel only) the same carousel access as a trackpad horizontal swipe; it navigates off whichever axis (`deltaX`/`deltaY`) the browser populates.

#### Slide directions

- **projects → project-detail** slides **down** -- the TV scrolls up and out while the detail page pushes up from the bottom (same reveal as the Enter key). Clicking a tuned-in TV screen, the outro CTA, or pressing Enter all use this.
- **project-detail ↔ project-detail** cycles left / right through the project list.
- Leaving project-detail back to a map tile slides left (backward).

`transitionTo` syncs `currentPageId` in its `catch` as well as the success path, so a thrown animation can't leave the page state stale on the source tile (which would otherwise let the wheel keep channel-surfing / cycling on the wrong page).

### Animation Constants

```typescript
PAGE_ANIMATION.DURATION  // Page transition duration
PAGE_ANIMATION.BLUR      // 12px blur amount during transitions
PAGE_ANIMATION.EASE_IN   // Easing for blur out
PAGE_ANIMATION.EASE_OUT  // Easing for blur in
```

### Page-Specific Display Modes

When active, each page uses a specific display mode:

| Page | Display | Notes |
|------|---------|-------|
| `.contact-section` | `grid` | Centered form |
| `.about-section` | `grid` | Two-column layout |
| `.projects-section` | `flex` | Centered vintage TV with on-screen channel guide |
| `.project-detail-section` | `flex` | Scrollable column |
| `.business-card-section` | `flex` | Centered card |

---

## Mobile and Responsive

### Mobile Styles

Located in `src/styles/mobile/`:

| File | Purpose |
|------|---------|
| `layout.css` | Small-mobile discrete-tile layout (one tile fills the viewport, header fixed, tile-level scroll), section positioning |
| `contact.css` | Avatar watermark scaling, textarea height (`clamp(120px, 30vh, 240px)`) |
| `responsive-fixes.css` | Hover guards (`@media (hover: hover)`), touch targets (44x44px min), modal scaling, `100dvh` support |

### Breakpoints

```css
@media (--mobile) { }          /* max-width: 767px */
@media (--tablet) { }          /* min-width: 768px */
@media (--desktop) { }         /* min-width: 992px */
@media (--wide) { }            /* min-width: 1200px */
@media (--ultra-wide) { }      /* min-width: 1400px */
@media (--compact-mobile) { }  /* max-width: 600px */
```

### Key Responsive Behaviors

| Breakpoint | Behavior |
|------------|----------|
| < 768px | Vertical scroll, no scroll-map, hamburger nav, touch targets |
| >= 768px | 2D spatial scroll-map (5 tiles in a plus layout), slide transitions, desktop nav |
| < 1400px | Circular back button hidden on project detail, text link shown instead |
| All | TV channel guide is responsive — same layout on mobile (full-width, smaller typography, button hit area extended); rows and ticker stay active |

### Dynamic Heights

- `100dvh` used for better mobile viewport support
- `calc(100dvh - var(--header-height) - var(--footer-height))` for main content area

---

## Theme System

Light/dark theme switching via `data-theme` attribute on `<html>`:

### Light Theme (Default)

```css
:root, html[data-theme="light"] {
  --color-brand-primary: #dc2626;
  --color-neutral-100: var(--color-gray-100);
  --color-dark: #333333;
  --color-light: #e0e0e0;
}
```

### Dark Theme

```css
html[data-theme="dark"] {
  --color-brand-primary: #dc2626;
  --color-neutral-100: #3a3a3a;
  --color-dark: #e0e0e0;
  --color-light: #333333;
}
```

The main site inverts `--color-dark` and `--color-light` between themes. All components use these variables, so theme switching is automatic.

Theme detection script runs before CSS loads (inline in `index.html`) to prevent flash of wrong theme.

---

## Related Documentation

- [CSS Architecture](./CSS_ARCHITECTURE.md) -- Shared tokens, file organization, cascade layers
- [Animations](./ANIMATIONS.md) -- Animation standards, GSAP guidelines, token reference
- [Portal Design](./PORTAL_DESIGN.md) -- Admin/client portal design system
- [Terminal Design Patterns](./TERMINAL_DESIGN_PATTERNS.md) -- Terminal portfolio analysis
- [Coyote Paw Animation](./COYOTE_PAW_ANIMATION.md) -- Intro animation specification
