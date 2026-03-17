# Animations

**Last Updated:** March 16, 2026

Animation standards for the project, separated by portal and main site. For shared design tokens see [CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md).

---

## Table of Contents

1. [Critical Rule: GSAP Over CSS](#critical-rule-gsap-over-css)
2. [Animation Tokens](#animation-tokens)
3. [Portal Animations](#portal-animations)
4. [Main Site Animations](#main-site-animations)
5. [GSAP Usage Guidelines](#gsap-usage-guidelines)
6. [CSS Transitions (Acceptable Use Cases)](#css-transitions-acceptable-use-cases)
7. [Performance Standards](#performance-standards)
8. [Accessibility](#accessibility)

---

## Critical Rule: GSAP Over CSS

**If animations can be done with GSAP, DO NOT use CSS animations.**

### When to Use Each

| Use GSAP | Use CSS Transitions |
|----------|---------------------|
| Page transitions | Hover color changes |
| Modal enter/exit | Focus states |
| Scroll animations | Simple opacity changes |
| Complex sequences | Button hover effects |
| Staggered animations | Link underlines |
| SVG animations | Input focus |
| Carousel/slider | Checkbox/toggle |
| Loading animations | Tooltip show/hide |

---

## Animation Tokens

Defined in `src/design-system/tokens/animations.css`.

### Duration Tokens

```css
--duration-faster: 0.15s;     /* Micro-interactions */
--duration-fast: 0.2s;        /* Quick transitions */
--duration-medium: 0.3s;      /* Standard transitions */
--duration-slow: 0.4s;        /* Emphasis animations */
--duration-slower: 0.5s;      /* Page transitions */
```

### Easing Tokens

```css
/* Standard */
--easing-smooth: cubic-bezier(0.4, 0, 0.2, 1);      /* General purpose */
--easing-sharp: cubic-bezier(0.4, 0, 0.6, 1);       /* Quick start */
--easing-emphasized: cubic-bezier(0.2, 0, 0, 1);    /* Dramatic entrance */
--easing-decelerated: cubic-bezier(0, 0, 0.2, 1);   /* Soft landing */
--easing-accelerated: cubic-bezier(0.4, 0, 1, 1);   /* Quick exit */

/* Spring-like */
--easing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--easing-elastic: cubic-bezier(0.175, 0.885, 0.32, 1.275);
```

### Component-Specific Tokens

```css
/* Buttons */
--animation-button-hover: 150ms var(--easing-smooth);
--animation-button-press: 150ms var(--easing-sharp);

/* Cards */
--animation-card-hover: 250ms var(--easing-smooth);
--animation-card-enter: 400ms var(--easing-decelerated);

/* Modals */
--animation-modal-enter: 400ms var(--easing-decelerated);
--animation-modal-exit: 250ms var(--easing-accelerated);

/* Loading */
--animation-spinner: 1s linear infinite;
--animation-pulse: 2s var(--easing-smooth) infinite alternate;
--animation-fade-in: 400ms var(--easing-decelerated);
```

---

## Portal Animations

### CSS Keyframes (Acceptable -- Infinite Utilities)

These are simple, infinitely-looping utility animations that are acceptable as CSS:

| Animation | File | Purpose | Duration |
|-----------|------|---------|----------|
| `spin` | `components/loading.css:33` | Spinner rotation (360deg) | `var(--animation-spinner)` |
| `skeleton-shimmer` | `components/loading.css:137` | Skeleton loading shimmer | 1.5s infinite |
| `pulse` | `portal/shared/portal-utilities.css:21` | Opacity pulse (health indicators) | 1.5s infinite |
| `pulse-skeleton` | `portal/shared/portal-utilities.css:27` | Skeleton opacity pulse | 2s infinite |
| `typing-bounce` | `portal/shared/portal-utilities.css:39` | Chat typing indicator dots | 1.4s infinite |

### CSS Keyframes (Borderline -- Review for GSAP Migration)

| Animation | File | Purpose | Duration |
|-----------|------|---------|----------|
| `fadeIn` | `portal/shared/portal-tabs.css:27` | Tab content activation | `var(--duration-medium)` |
| `slideDown` | `portal/shared/portal-utilities.css:33` | Dropdown/panel reveal | `var(--duration-fast)` |

### GSAP Animations (React Hooks)

Portal React components use GSAP via hooks in `src/react/hooks/useGsap.ts`:

| Hook | Purpose | Used By |
|------|---------|---------|
| `useFadeIn` | Component fade-in on mount | `PortalViewLayout`, most views |
| `useScaleIn` | Modal/button scale-in | `PortalModal`, `ModalDropdown` |
| `useSlideIn` | Slide-in from direction | Navigation transitions |
| `useStaggerChildren` | Stagger child animations | Card lists, stat grids |
| `useGsapTimeline` | Custom timeline control | `OnboardingWizard` |

### Portal Transitions

135 `transition:` declarations in portal CSS files. 133 (98.5%) use design tokens. 2 use hardcoded values.

All animation durations now use design tokens from `src/design-system/tokens/animations.css`. Zero hardcoded durations remain.

---

## Main Site Animations

### GSAP Animation Modules

Located in `src/modules/animation/`. These handle all complex main site animations:

| File | Purpose | GSAP Features Used |
|------|---------|-------------------|
| `intro-animation.ts` | Coyote paw clutching business card with SVG morphing | `gsap.to()`, `gsap.set()`, `gsap.timeline()` |
| `intro-animation-mobile.ts` | Mobile: Simple card flip (no paw overlay) | `gsap.to()`, `gsap.timeline()` |
| `about-hero.ts` | Full viewport "NO BHAD CODES" text animation | Wheel-driven, SVG transforms |
| `page-hero.ts` | Unified hero text for virtual pages | Wheel-driven SVG |
| `base-hero-animation.ts` | Shared base class for hero animations | `gsap.timeline()`, `gsap.fromTo()` |
| `page-transition.ts` | Virtual page blur in/out transitions | `gsap.to()`, `ScrollTrigger` |
| `contact-animation.ts` | Contact page cascading animations | `gsap.to()`, `gsap.context()` |
| `avatar-intro.ts` | Avatar SVG fade-in for terminal intake | `gsap.to()`, `gsap.fromTo()` |
| `text-animation.ts` | Scroll-driven split-text skew animation | `gsap.timeline()`, `ScrollTrigger` |
| `intro/morph-timeline.ts` | SVG path morphing for intro | `gsap.to()` |

### GSAP UI Modules

Located in `src/modules/ui/`:

| File | Purpose |
|------|---------|
| `projects.ts` | Project card interactions |
| `contact-form.ts` | Contact form field animations |
| `business-card-interactions.ts` | Business card hover/interaction effects |
| `navigation.ts` | Navigation animations and transitions |

### GSAP Utilities

`src/utils/gsap-utilities.ts` exports reusable animation functions:

| Function | Purpose |
|----------|---------|
| `fadeIn()` / `fadeOut()` | Opacity fade |
| `blurIn()` / `blurOut()` | Filter blur effect |
| `slideIn()` | Slide from direction |
| `scaleIn()` / `scaleOut()` | Scale with opacity |
| `spin()` | Continuous 360 rotation |
| `pulse()` | Opacity pulsing |
| `bounce()` | Y-axis bouncing |
| `shake()` | X-axis shake |
| `flip()` | 3D rotation |
| `pulseGlow()` | Box-shadow pulsing |
| `setWillChange()` / `clearWillChange()` / `withWillChange()` | GPU acceleration management |

### Main Site GSAP Animations (Migrated from CSS)

These were migrated from CSS @keyframes to GSAP on March 16, 2026:

| Animation | Migrated To | GSAP Method |
|-----------|-------------|-------------|
| `project-drop-in/out` | `src/modules/ui/projects.ts` | `gsap.to()` with `stagger` |
| `scale-in-left` | `src/modules/ui/projects.ts` | `gsap.to()` scaleX |
| `back-button-slide-in/out` | `src/modules/ui/projects.ts` | `gsap.fromTo()` x + opacity |
| `header-img-fade-in/out` | `src/modules/ui/projects.ts` | `gsap.fromTo()` y + opacity |
| `worksub-fade-in/out` | `src/modules/ui/projects.ts` | `gsap.fromTo()` y + opacity |
| `slide-in-right` | `src/utils/error-utils.ts` | Dynamic `import('gsap')` + `gsap.from()` |

### Acceptable Main Site CSS Keyframes

| Animation | File | Purpose |
|-----------|------|---------|
| `intro-fallback-show` | `base/layout.css:313` | Fallback intro display |
| `skeleton-loading` | `states/interactive.css:66` | Skeleton shimmer (utility) |

---

## GSAP Usage Guidelines

### Basic Import

```typescript
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
```

### Common Patterns

```typescript
// Fade in
gsap.from('.element', { opacity: 0, duration: 0.4, ease: 'power2.out' });

// Stagger
gsap.from('.list-item', { y: 20, opacity: 0, duration: 0.4, stagger: 0.1 });

// Timeline
const tl = gsap.timeline();
tl.to(el1, { ... })
  .to(el2, { ... }, '-=0.2');

// React cleanup
useEffect(() => {
  const ctx = gsap.context(() => { /* animations */ }, containerRef);
  return () => ctx.revert();
}, []);
```

### Best Practices

1. **Use timelines for sequences** -- chain with `.to()` and position offsets
2. **Kill animations on cleanup** -- always `ctx.revert()` in useEffect
3. **Use `gsap.set()` for initial states** -- not CSS
4. **Prefer transforms over layout properties** -- `x`, `y`, `scale` instead of `left`, `top`, `width`
5. **Use `will-change` sparingly** -- set before animation, clear after

---

## CSS Transitions (Acceptable Use Cases)

CSS transitions are acceptable for simple state changes:

```css
/* Button hover */
.btn { transition: background-color 0.2s ease, color 0.2s ease; }

/* Input focus */
.form-input { transition: border-color 0.15s ease, box-shadow 0.15s ease; }

/* Utility classes */
.transition-colors { transition: color 0.25s var(--easing-smooth), background-color 0.25s var(--easing-smooth); }
.transition-opacity { transition: opacity 0.25s var(--easing-smooth); }
.transition-transform { transition: transform 0.25s var(--easing-smooth); }
```

---

## Performance Standards

- **60 FPS** minimum during animations
- **First paint** not blocked by animations
- **Total animation time** < 1s for user-initiated actions
- Only animate `transform` and `opacity` (GPU-accelerated)
- Batch DOM reads/writes

---

## Accessibility

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

```typescript
// GSAP check
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!prefersReducedMotion) {
  gsap.from('.element', { opacity: 0, y: 20 });
} else {
  gsap.set('.element', { opacity: 1, y: 0 });
}
```

### Rules

- No flashing content (seizure risk)
- Provide pause controls for continuous animations
- Don't rely solely on animation for information
- Keep animations brief (< 500ms for micro-interactions)

---

## Related Documentation

- [Portal Design](./PORTAL_DESIGN.md) -- Portal-specific design system
- [CSS Architecture](./CSS_ARCHITECTURE.md) -- Design tokens, file organization
- [Design System](./DESIGN_SYSTEM.md) -- Overview and index
