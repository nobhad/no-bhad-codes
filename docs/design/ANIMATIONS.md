# Animations

## Table of Contents

1. [Overview](#overview)
2. [Critical Rule: GSAP Over CSS](#critical-rule-gsap-over-css)
3. [Animation Tokens](#animation-tokens)
4. [GSAP Usage Guidelines](#gsap-usage-guidelines)
5. [CSS Transitions (Acceptable Use Cases)](#css-transitions-acceptable-use-cases)
6. [Keyframe Animations](#keyframe-animations)
7. [Animation Catalog](#animation-catalog)
8. [Performance Standards](#performance-standards)
9. [Accessibility](#accessibility)

---

## Overview

This document defines animation standards for the project. All animations must follow these guidelines to ensure consistency, performance, and accessibility.

**Token Source:** `/src/design-system/tokens/animations.css`

**Last Updated:** January 13, 2026

---

## Critical Rule: GSAP Over CSS

**If animations can be done with GSAP, DO NOT use CSS animations.**

### Why GSAP?

1. **Better Performance** - Hardware-accelerated, optimized rendering
2. **More Control** - Pause, reverse, seek, speed control
3. **Cross-browser Consistency** - No vendor prefix issues
4. **Easier Sequencing** - Timelines for complex animations
5. **Better Easing** - More easing options than CSS
6. **Debugging** - Easier to debug and test

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

### Duration Tokens

```css
--duration-instant: 0ms;      /* No animation */
--duration-fast: 150ms;       /* Micro-interactions */
--duration-normal: 250ms;     /* Standard transitions */
--duration-slow: 400ms;       /* Emphasis animations */
--duration-slower: 600ms;     /* Page transitions */
--duration-slowest: 800ms;    /* Complex sequences */
```

### Easing Tokens

#### Standard Easing

```css
--easing-linear: linear;
--easing-ease: ease;
--easing-ease-in: ease-in;
--easing-ease-out: ease-out;
--easing-ease-in-out: ease-in-out;
```

#### Custom Cubic-Bezier Curves

```css
--easing-smooth: cubic-bezier(0.4, 0, 0.2, 1);      /* General purpose */
--easing-sharp: cubic-bezier(0.4, 0, 0.6, 1);       /* Quick start */
--easing-emphasized: cubic-bezier(0.2, 0, 0, 1);    /* Dramatic entrance */
--easing-decelerated: cubic-bezier(0, 0, 0.2, 1);   /* Soft landing */
--easing-accelerated: cubic-bezier(0.4, 0, 1, 1);   /* Quick exit */
--easing-standard: cubic-bezier(0.2, 0, 0, 1);      /* Material standard */
```

#### Spring-Like Easing

```css
--easing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);  /* Playful bounce */
--easing-elastic: cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Elastic snap */
```

### Component-Specific Animation Tokens

```css
/* Buttons */
--animation-button-hover: 150ms var(--easing-smooth);
--animation-button-press: 150ms var(--easing-sharp);

/* Cards */
--animation-card-hover: 250ms var(--easing-smooth);
--animation-card-enter: 400ms var(--easing-decelerated);
--animation-card-exit: 250ms var(--easing-accelerated);

/* Modals */
--animation-modal-enter: 400ms var(--easing-decelerated);
--animation-modal-exit: 250ms var(--easing-accelerated);
--animation-modal-backdrop: 250ms var(--easing-smooth);

/* Navigation */
--animation-nav-slide: 400ms var(--easing-emphasized);
--animation-nav-fade: 250ms var(--easing-smooth);

/* Forms */
--animation-input-focus: 150ms var(--easing-smooth);
--animation-input-error: 250ms var(--easing-bounce);

/* Loading */
--animation-spinner: 1s linear infinite;
--animation-pulse: 2s var(--easing-smooth) infinite alternate;
--animation-fade-in: 400ms var(--easing-decelerated);
--animation-fade-out: 250ms var(--easing-accelerated);

/* Business Card */
--animation-card-flip: 0.8s var(--easing-smooth);
--animation-card-scale: 250ms var(--easing-bounce);
```

---

## GSAP Usage Guidelines

### Installation

```bash
npm install gsap
```

### Basic Import

```typescript
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
```

### Common Animation Patterns

#### Fade In

```typescript
gsap.from('.element', {
  opacity: 0,
  duration: 0.4,
  ease: 'power2.out'
});
```

#### Slide In

```typescript
gsap.from('.element', {
  x: -100,
  opacity: 0,
  duration: 0.6,
  ease: 'power3.out'
});
```

#### Scale In

```typescript
gsap.from('.element', {
  scale: 0.9,
  opacity: 0,
  duration: 0.3,
  ease: 'back.out(1.7)'
});
```

#### Staggered Animation

```typescript
gsap.from('.list-item', {
  y: 20,
  opacity: 0,
  duration: 0.4,
  stagger: 0.1,
  ease: 'power2.out'
});
```

#### Modal Animation

```typescript
// Enter
const tl = gsap.timeline();
tl.to('.modal-backdrop', {
  opacity: 1,
  duration: 0.25,
  ease: 'power2.out'
})
.from('.modal-content', {
  scale: 0.95,
  opacity: 0,
  duration: 0.3,
  ease: 'power3.out'
}, '-=0.1');

// Exit
gsap.to('.modal', {
  opacity: 0,
  scale: 0.95,
  duration: 0.25,
  ease: 'power2.in',
  onComplete: () => modal.remove()
});
```

#### Scroll Animation

```typescript
gsap.from('.section', {
  scrollTrigger: {
    trigger: '.section',
    start: 'top 80%',
    toggleActions: 'play none none reverse'
  },
  y: 50,
  opacity: 0,
  duration: 0.8,
  ease: 'power3.out'
});
```

### GSAP Best Practices

1. **Use timelines for sequences**

   ```typescript
   const tl = gsap.timeline();
   tl.to(el1, { ... })
     .to(el2, { ... }, '-=0.2')
     .to(el3, { ... });
   ```

2. **Kill animations on cleanup**

   ```typescript
   useEffect(() => {
     const ctx = gsap.context(() => {
       // animations here
     }, containerRef);

     return () => ctx.revert();
   }, []);
   ```

3. **Use `gsap.set()` for initial states**

   ```typescript
   gsap.set('.element', { opacity: 0, y: 20 });
   gsap.to('.element', { opacity: 1, y: 0, delay: 0.5 });
   ```

4. **Prefer transforms over layout properties**

   ```typescript
   // Good - GPU accelerated
   gsap.to(el, { x: 100, y: 50, scale: 1.1 });

   // Avoid - causes reflow
   gsap.to(el, { left: 100, top: 50, width: 200 });
   ```

---

## CSS Transitions (Acceptable Use Cases)

CSS transitions are acceptable for simple state changes:

### Button Hover

```css
.btn {
  transition: background-color 0.2s ease,
              color 0.2s ease;
}

.btn:hover {
  background-color: var(--color-primary);
}
```

### Input Focus

```css
.form-input {
  transition: border-color 0.15s ease,
              box-shadow 0.15s ease;
}

.form-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.2);
}
```

### Link Underline

```css
.link {
  text-decoration: none;
  background-image: linear-gradient(currentColor, currentColor);
  background-size: 0% 2px;
  background-position: 0 100%;
  background-repeat: no-repeat;
  transition: background-size 0.3s ease;
}

.link:hover {
  background-size: 100% 2px;
}
```

### Utility Classes

```css
.transition-colors {
  transition: color 0.25s var(--easing-smooth),
              background-color 0.25s var(--easing-smooth),
              border-color 0.25s var(--easing-smooth);
}

.transition-opacity {
  transition: opacity 0.25s var(--easing-smooth);
}

.transition-transform {
  transition: transform 0.25s var(--easing-smooth);
}
```

---

## Keyframe Animations

Available keyframe animations in `/src/design-system/tokens/animations.css`:

### Fade

```css
@keyframes fadeIn { /* 0 -> 100 opacity */ }
@keyframes fadeOut { /* 100 -> 0 opacity */ }
```

### Slide

```css
@keyframes slideInFromTop { /* -100% -> 0 translateY */ }
@keyframes slideInFromBottom { /* 100% -> 0 translateY */ }
@keyframes slideInFromLeft { /* -100% -> 0 translateX */ }
@keyframes slideInFromRight { /* 100% -> 0 translateX */ }
```

### Scale

```css
@keyframes scaleIn { /* 0 -> 1 scale */ }
@keyframes scaleOut { /* 1 -> 0 scale */ }
```

### Effects

```css
@keyframes spin { /* 0 -> 360deg rotation */ }
@keyframes pulse { /* 1 -> 0.5 opacity */ }
@keyframes bounce { /* Multi-step Y translation */ }
@keyframes shake { /* Horizontal shake */ }
@keyframes flip { /* 0 -> 180deg rotateY */ }
```

### Animation Utility Classes

```css
.animate-fade-in
.animate-fade-out
.animate-slide-in-top
.animate-slide-in-bottom
.animate-slide-in-left
.animate-slide-in-right
.animate-scale-in
.animate-scale-out
.animate-spin
.animate-pulse
.animate-bounce
.animate-shake
.animate-flip
```

---

## Animation Catalog

### Page Transitions

**Implementation:** GSAP

```typescript
// Page enter
gsap.from('.page-content', {
  opacity: 0,
  y: 20,
  duration: 0.6,
  ease: 'power3.out'
});
```

### Modal Animations

**Implementation:** GSAP

- **Enter**: Scale from 0.95, fade in backdrop
- **Exit**: Scale to 0.95, fade out backdrop
- **Duration**: 250-400ms

### Card Hover

**Implementation:** CSS Transition

- **Effect**: Subtle lift and shadow enhancement
- **Duration**: 250ms
- **Easing**: smooth

### Navigation Menu

**Implementation:** GSAP

- **Mobile slide**: 400ms emphasized easing
- **Desktop fade**: 250ms smooth easing

### Form Validation

**Implementation:** CSS + GSAP

- **Focus ring**: CSS transition
- **Error shake**: GSAP shake animation
- **Success check**: GSAP scale + fade

### Loading States

**Implementation:** CSS Keyframes

- **Spinner**: 1s linear infinite rotation
- **Pulse**: 2s smooth infinite alternate opacity
- **Skeleton**: Shimmer effect

### Scroll Animations

**Implementation:** GSAP ScrollTrigger

- **Fade up**: Elements fade and slide up on scroll
- **Stagger**: List items animate sequentially
- **Parallax**: Background elements move at different speeds

---

## Performance Standards

### Target Metrics

- **60 FPS** minimum during animations
- **First paint** not blocked by animations
- **Total animation time** < 1s for user-initiated actions

### Optimization Rules

1. **Only animate transform and opacity**

   ```typescript
   // Good
   gsap.to(el, { x: 100, opacity: 0.5 });

   // Bad - causes reflow
   gsap.to(el, { width: 200, marginLeft: 50 });
   ```

2. **Use `will-change` sparingly**

   ```css
   .animated-element {
     will-change: transform, opacity;
   }
   ```

3. **Remove `will-change` after animation**

   ```typescript
   gsap.to(el, {
     x: 100,
     onComplete: () => el.style.willChange = 'auto'
   });
   ```

4. **Batch DOM reads/writes**

5. **Use RAF for custom animations**

   ```typescript
   gsap.ticker.add(myFunction);
   ```

---

## Accessibility

### Respect Reduced Motion

```typescript
// Check preference
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

// Conditional animation
if (!prefersReducedMotion) {
  gsap.from('.element', { opacity: 0, y: 20 });
} else {
  gsap.set('.element', { opacity: 1, y: 0 });
}
```

### CSS Implementation

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Animation Considerations

1. **No flashing content** (seizure risk)
2. **Provide pause controls** for continuous animations
3. **Don't rely solely on animation** for information
4. **Keep animations brief** (< 500ms for micro-interactions)

---

## Related Documentation

- [CSS Architecture](./CSS_ARCHITECTURE.md) - CSS variables and tokens
- [UX Guidelines](./UX_GUIDELINES.md) - General UX standards
