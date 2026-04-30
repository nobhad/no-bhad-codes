# Main Site Design System

**Last Updated:** April 30, 2026

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
8. [Navigation](#navigation)
9. [GSAP Animation Modules](#gsap-animation-modules)
10. [Page Transitions](#page-transitions)
11. [Mobile and Responsive](#mobile-and-responsive)
12. [Theme System](#theme-system)

---

## Overview

The main site is a single-page portfolio/marketing site with:

- **Virtual page architecture** -- hash-based routing with blur crossfade transitions (desktop)
- **Vertical scroll mode** on mobile
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

### Mobile -- Vertical Scroll

On mobile (`max-width: 767px`):

- Pages stack vertically in normal document flow
- Standard scroll behavior
- No scroll-map (single-column scrolling instead of spatial tiles)
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
| `projects.css` | Portfolio list | `.projects-section`, `.crt-tv`, `.crt-tv__channel-list`, `.crt-tv__panels` | Centered vintage TV with channel-guide screen + tune-in animation |
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
| `page-transitions.css` | Virtual page transition states and positioning (392 lines) |
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
| h1 | Acme | `clamp(2rem, 6vw, 3rem)` | Bold |
| h2 | Acme | `clamp(1.5rem, 5vw, 2rem)` | Bold |
| h3 | Acme | `clamp(1.25rem, 4vw, 1.5rem)` | Bold |
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
5. On mobile: simple card flip animation instead
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
| Nav | 125 |
| Fixed elements | 300 |

---

## GSAP Animation Modules

Located in `src/modules/animation/`:

| File | Purpose | GSAP Features |
|------|---------|---------------|
| `intro-animation.ts` | Coyote paw clutching business card with SVG morphing | `gsap.to()`, `gsap.set()`, `gsap.timeline()`, MorphSVG |
| `intro-animation-mobile.ts` | Mobile: simple card flip | `gsap.to()`, `gsap.timeline()` |
| `about-hero.ts` | Full viewport "NO BHAD CODES" text animation | Wheel-driven, SVG transforms |
| `page-hero.ts` | Unified hero text for virtual pages | Wheel-driven SVG |
| `base-hero-animation.ts` | Shared base class for hero text animations | `gsap.timeline()`, `gsap.fromTo()` |
| `page-transition.ts` | Virtual page blur in/out transitions | `gsap.to()`, `ScrollTrigger` |
| `contact-animation.ts` | Contact page cascading form animations | `gsap.to()`, `gsap.context()` |
| `avatar-intro.ts` | Avatar SVG fade-in for terminal intake | `gsap.to()`, `gsap.fromTo()` |
| `text-animation.ts` | Scroll-driven split-text skew animation | `gsap.timeline()`, `ScrollTrigger` |

### UI Module GSAP Usage

Located in `src/modules/ui/`:

| File | Purpose |
|------|---------|
| `projects.ts` | TV channel guide rendering, channel cycling (wheel/keys/buttons), Looney-Tunes-style title-card tune-in animation, panel cycle (heading flash + body fade), POWER/CHANNEL button wiring, project-detail page rendering |
| `contact-form.ts` | Contact form field cascade animations |
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

### Hero Text Animation Pattern

From `base-hero-animation.ts` -- the shared pattern for about/page hero text:

- Left group: skewY -30 to -15, scaleX 0.6 to 0.85
- Right group: skewY 15 to 30, scaleX 0.85 to 0.6
- Text elements: xPercent -100 to 0, slide in from left
- Wheel-driven on desktop

---

## Page Transitions

Managed by `PageTransitionModule` (`src/modules/animation/page-transition.ts`):

### Desktop Behavior

- Pages stored in `Map<string, PageConfig>`
- Current page blurs out (`opacity: 0`, `filter: blur(12px)`)
- Next page blurs in (`opacity: 1`, `filter: blur(0px)`)
- Duration and easing defined in `src/config/animation-constants.ts`
- `gsap.killTweensOf()` used for cleanup
- `gsap.set()` clears properties after animation

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
| `layout.css` | Vertical scroll mode, section positioning |
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
| < 1100px | TV channel guide hidden on projects page (mobile fallback TBD) |

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
