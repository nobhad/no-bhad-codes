# Portfolio Design Patterns - What Works

**Analysis of:** salcosta.dev + bychristinakosik.com
**Purpose:** Identify common patterns to apply to nobhad.codes
**Date:** December 2025

---

## Summary

Both award-winning portfolios share core design principles that create memorable, professional experiences. This document extracts the patterns worth adopting.

---

## 1. Color Philosophy: Avoid Pure Black & White

### What They Do

|Site|"Black"|"White"|Why|
|------|---------|---------|-----|
|Sal Costa|`#191919`|`#fffbee`|Warm cream adds sophistication|
|Christina Kosik|`#151515`|`#ffffff`|Near-black is softer on eyes|

Neither uses `#000000` or `#ffffff` as their base.

### Why It Works

- Pure black (`#000`) is harsh and unnatural
- Pure white (`#fff`) causes eye strain
- Slight tints add warmth and personality
- Creates subtle depth without obvious shadows

### Recommendation for nobhad.codes

```css
:root {
  /* Instead of #000 */
  --app-color-bg-dark: #151515;    /* or #191919 */

  /* Instead of #fff */
  --app-color-bg-light: #fafafa;   /* or #fffbee for warmth */
}
```

---

## 2. Single Typeface, Multiple Weights

### What They Do

|Site|Font|Weights Used|
|------|------|--------------|
|Sal Costa|Plus Jakarta Sans|600 only|
|Christina Kosik|Uncut Sans|300, 400|

Both use ONE font family for everything.

### Why It Works

- Creates instant visual cohesion
- Simplifies design decisions
- Modern, clean aesthetic
- Faster page loads (one font file)

### Recommendation for nobhad.codes

Pick one modern sans-serif and commit:

- **Plus Jakarta Sans** - Geometric but warm
- **Uncut Sans** - Clean, contemporary grotesque
- **Inter** - Highly legible, versatile
- **Satoshi** - Trendy, geometric

```css
body {
  font-family: 'Your Choice', system-ui, sans-serif;
  font-weight: 400;  /* Use weight for hierarchy, not different fonts */
}

h1, h2, h3 {
  font-weight: 600;
}
```

---

## 3. GSAP Animation Stack

### What They Both Use

```html
<!-- Core -->
<script src="gsap.min.js"></script>
<script src="ScrollTrigger.min.js"></script>

<!-- Christina also uses -->
<script src="Flip.min.js"></script>
<script src="CustomEase.min.js"></script>
```

### Common Animation Patterns

|Pattern|Sal Costa|Christina Kosik|
|---------|-----------|-----------------|
|Scroll-triggered|Yes|Yes|
|Staggered delays|Yes (100ms)|Yes (overlapping)|
|Custom easing|`cubic-bezier(.3,.9,.3,.9)`|SVG path easing|
|Entrance animations|blur-in, drop-in|fade, yPercent|
|Exit animations|blur-out, drop-out|reverse()|

### Why It Works

- Scroll-based animations feel natural
- Staggered animations create rhythm
- Custom easing adds personality
- Consistent motion language

### Recommendation for nobhad.codes

```javascript
// 1. Register plugins
gsap.registerPlugin(ScrollTrigger);

// 2. Define consistent timing
const DURATION = {
  fast: 0.3,
  normal: 0.6,
  slow: 1.0
};

const EASE = {
  smooth: "power2.out",
  bounce: "back.out(1.7)",
  dramatic: "power3.inOut"
};

// 3. Stagger pattern
gsap.from(".card", {
  y: 50,
  opacity: 0,
  duration: DURATION.normal,
  stagger: 0.1,
  ease: EASE.smooth,
  scrollTrigger: {
    trigger: ".cards-section",
    start: "top 80%"
  }
});
```

---

## 4. Massive Hero Typography

### What They Do

|Site|Hero Size|Technique|
|------|-----------|-----------|
|Sal Costa|Block SVG letters|Animated drop-in|
|Christina Kosik|`15.9vw`|Parallax split on scroll|

### Why It Works

- Immediately establishes identity
- Creates visual impact
- Demonstrates design confidence
- Memorable first impression

### Recommendation for nobhad.codes

```css
.hero-name {
  font-size: clamp(3rem, 12vw, 10rem);  /* Responsive with limits */
  letter-spacing: -0.03em;               /* Tight tracking at large sizes */
  line-height: 0.9;                      /* Tight leading */
  font-weight: 600;
}
```

Or use SVG text for more control:

```jsx
<svg viewBox="0 0 1000 200">
  <text x="0" y="150" className="hero-svg-text">NOELLE</text>
</svg>
```

---

## 5. Smooth Scroll Implementation

### What They Do

|Site|Method|
|------|--------|
|Sal Costa|Custom (likely native + JS)|
|Christina Kosik|Lenis library|

### Christina's Lenis Config

```javascript
const lenis = new Lenis({
  smooth: true,
  infinite: true,  // Optional: loops content
  wrapper: document.body
});

// Sync with GSAP
lenis.on('scroll', ScrollTrigger.update);

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
```

### Why It Works

- Adds polish and premium feel
- Enables momentum scrolling
- Allows scroll-locked animations
- Creates cohesive motion

### Recommendation for nobhad.codes

```javascript
// Option 1: Lenis (recommended)
import Lenis from '@studio-freight/lenis';

const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smooth: true
});

// Option 2: CSS only (simpler)
html {
  scroll-behavior: smooth;
}
```

---

## 6. Page Loader with Personality

### What They Do

|Site|Duration|Feature|
|------|----------|---------|
|Sal Costa|Fixed|Progress bar + logo|
|Christina Kosik|8s first / 2s return|Session-aware, giant counter|

### Session-Aware Pattern (Christina)

```javascript
let duration = 8;  // First visit

if (sessionStorage.getItem("visited")) {
  duration = 2;  // Returning visitor
}

sessionStorage.setItem("visited", "true");
```

### Why It Works

- Builds anticipation
- Hides asset loading
- Creates premium feel
- Session-aware respects returning users

### Recommendation for nobhad.codes

```javascript
// Respect returning visitors
const isReturning = sessionStorage.getItem("visited");
const loaderDuration = isReturning ? 1.5 : 4;

sessionStorage.setItem("visited", "true");

// Animate loader
gsap.timeline({
  onComplete: () => {
    document.querySelector('.loader').style.display = 'none';
    initPageAnimations();
  }
})
.to('.loader-progress', {
  width: '100%',
  duration: loaderDuration,
  ease: "power2.inOut"
});
```

---

## 7. Minimal Color Palette with Accents

### What They Do

|Site|Colors|Accent Strategy|
|------|--------|-----------------|
|Sal Costa|3 (bg, text, accent)|Warm coral light / Cool purple dark|
|Christina Kosik|2 (bg, text)|Opacity variations only|

### Sal Costa's Dual Accent

```css
/* Light mode: warm */
--color: #ff6663;

/* Dark mode: cool */
--color: #8c82ff;
```

### Christina's Opacity System

```css
a {
  opacity: 0.4;  /* Default */
}
a:hover {
  opacity: 1;    /* Active */
}
```

### Why It Works

- Fewer colors = stronger identity
- Constraints breed creativity
- Easier to maintain consistency
- Faster design decisions

### Recommendation for nobhad.codes

```css
:root {
  --app-color-bg: #151515;
  --app-color-text: #ffffff;
  --app-color-accent: #your-brand-color;

  /* Derived from opacity */
  --app-color-text-muted: rgba(255, 255, 255, 0.4);
  --app-color-text-subtle: rgba(255, 255, 255, 0.2);
}
```

---

## 8. Project Card Interactions

### What They Do

|Site|Hover Effect|Click Action|
|------|--------------|--------------|
|Sal Costa|Image tooltip at cursor|Navigate to detail page|
|Christina Kosik|None|FLIP animation to overlay|

### Sal Costa's Tooltip

```css
.tooltip {
  position: fixed;
  transform: translate(16px, 16px);  /* Offset from cursor */
  pointer-events: none;
}

.tooltip img {
  width: 300px;
  border-radius: 16px;
}
```

### Christina's FLIP

```javascript
// 1. Capture state
const state = Flip.getState(gridImage);

// 2. Move to overlay
overlay.appendChild(gridImage);

// 3. Animate from old position
Flip.from(state, {
  duration: 1,
  ease: "power1.inOut"
});
```

### Why It Works

- Previews content before commitment
- Creates spatial relationships
- Feels responsive and alive
- Rewards exploration

### Recommendation for nobhad.codes

```javascript
// Simple but effective: scale + shadow on hover
.project-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.project-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}
```

Or implement image preview tooltip:

```javascript
document.querySelectorAll('.project-card').forEach(card => {
  card.addEventListener('mouseenter', (e) => {
    tooltip.style.display = 'block';
    tooltip.querySelector('img').src = card.dataset.preview;
  });

  card.addEventListener('mousemove', (e) => {
    tooltip.style.left = e.clientX + 16 + 'px';
    tooltip.style.top = e.clientY + 16 + 'px';
  });

  card.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });
});
```

---

## 9. Asymmetrical Design Elements

### What They Do

|Site|Element|Pattern|
|------|---------|---------|
|Sal Costa|Border radius|`4px 0 4px 4px` (flat top-right)|
|Christina Kosik|Grid columns|2-3-3-2 (varying spans)|

### Sal Costa's Border Radius

```css
/* Signature pattern: one flat corner */
.element {
  border-radius: 4px 0 4px 4px;
}

/* Inputs: different flat corner */
input {
  border-radius: 0 22px 22px;  /* Flat top-left */
}
```

### Christina's Grid

```css
.item:nth-child(1) { grid-column: span 2; }
.item:nth-child(2) { grid-column: span 3; }
.item:nth-child(3) { grid-column: span 3; }
.item:nth-child(4) { grid-column: span 2; }
/* Repeats... */
```

### Why It Works

- Breaks monotony without chaos
- Creates visual rhythm
- Adds personality/signature
- Demonstrates attention to detail

### Recommendation for nobhad.codes

Pick ONE asymmetry pattern and use consistently:

```css
/* Option A: Sal Costa style - flat corner */
.card, .button, .input {
  border-radius: 8px 0 8px 8px;
}

/* Option B: Christina style - varied grid */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
}

.project:nth-child(4n+1) { grid-column: span 2; }
.project:nth-child(4n+2) { grid-column: span 3; }
.project:nth-child(4n+3) { grid-column: span 3; }
.project:nth-child(4n+4) { grid-column: span 2; }
```

---

## 10. Fixed Hero with Scroll Content Over

### What They Do

Both use a **fixed hero** with content scrolling over it:

```css
/* Hero stays in place */
.hero-section {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  z-index: 0;
}

/* Content scrolls over */
.main-content {
  position: relative;
  z-index: 1;
  margin-top: 100vh;  /* Start after hero */
  background: var(--bg);
}
```

### Why It Works

- Hero feels immersive
- Creates depth/layering
- Natural reveal animation
- Keeps hero visible during transition

### Recommendation for nobhad.codes

```css
.hero {
  position: fixed;
  inset: 0;
  z-index: 0;
}

.content {
  position: relative;
  z-index: 1;
  margin-top: 100vh;
  background: var(--app-color-bg);
}

/* Spacer to allow scrolling before content */
.hero-spacer {
  height: 50vh;  /* Adjust to taste */
  pointer-events: none;
}
```

---

## 11. Animation Timing System

### What They Do

Both define **consistent timing variables**:

**Sal Costa:**

```css
--transition-theme: .4s;
--transition-mouse: .2s;
--transition-length: .5s;
--transition-long: .8s;
```

**Christina:**

```javascript
defaults: {
  duration: 0.7,
  ease: "power1.inOut"
}
```

### Why It Works

- Consistent rhythm
- Predictable interactions
- Easier to maintain
- Professional feel

### Recommendation for nobhad.codes

```css
:root {
  /* Timing */
  --transition-instant: 0.1s;
  --transition-fast: 0.2s;
  --transition-normal: 0.4s;
  --transition-slow: 0.6s;
  --transition-dramatic: 1s;

  /* Easing */
  --ease-out: cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-in-out: cubic-bezier(0.42, 0, 0.58, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Usage */
.button {
  transition: transform var(--transition-fast) var(--ease-out),
              background-color var(--transition-normal);
}
```

---

## 12. Link Hover Underlines

### What They Do

**Sal Costa:** Animated underline that slides in/out

```css
a:before {
  content: "";
  position: absolute;
  width: 100%;
  height: 33%;
  bottom: 10%;
  background: rgba(var(--color-rgb), 0.3);
  transform-origin: right;
  transform: scaleX(0);
  transition: transform 0.5s;
}

a:hover:before {
  transform-origin: left;
  transform: scaleX(1);
}
```

**Christina:** Simple border-bottom

```css
a {
  border-bottom: 1px solid #fff;
  opacity: 0.4;
}

a:hover {
  opacity: 1;
}
```

### Recommendation for nobhad.codes

```css
/* Animated underline (Sal Costa style) */
.text-link {
  position: relative;
}

.text-link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--app-color-accent);
  transform: scaleX(0);
  transform-origin: right;
  transition: transform var(--transition-normal) var(--ease-out);
}

.text-link:hover::after {
  transform: scaleX(1);
  transform-origin: left;
}
```

---

## Quick Reference: What to Implement

### High Impact, Low Effort

|Pattern|Effort|Impact|
|---------|--------|--------|
|Near-black instead of #000|5 min|Medium|
|Single typeface|10 min|High|
|Timing CSS variables|15 min|Medium|
|Link hover underlines|20 min|Medium|
|Project card hover (scale + shadow)|15 min|Medium|

### Medium Effort, High Impact

|Pattern|Effort|Impact|
|---------|--------|--------|
|Fixed hero with scroll-over|1 hour|High|
|GSAP scroll animations|2 hours|High|
|Page loader|1 hour|Medium|
|Smooth scroll (Lenis)|30 min|Medium|

### High Effort, Signature Impact

|Pattern|Effort|Impact|
|---------|--------|--------|
|Asymmetric grid layout|3 hours|High|
|FLIP animations for modals|4 hours|High|
|Custom cursor|2 hours|Medium|
|Image tooltip on hover|2 hours|High|

---

## Recommended Implementation Order

1. **Foundation (Day 1)**
   - Update color palette (near-black, cream)
   - Choose and implement single typeface
   - Set up timing variables

1. **Motion Base (Day 2)**
   - Install GSAP + ScrollTrigger
   - Add basic scroll-triggered fades
   - Implement smooth scroll

1. **Hero Section (Day 3)**
   - Large typography treatment
   - Fixed position with scroll-over content
   - Entrance animation

1. **Project Cards (Day 4)**
   - Hover effects (scale, shadow)
   - Staggered entrance animations
   - Optional: image preview tooltip

1. **Polish (Day 5)**
   - Page loader
   - Link hover underlines
   - Consistent border-radius pattern
   - Asymmetric grid (if time)

---

## Files Reference

|Analysis|Location|
|----------|----------|
|Sal Costa Deep Dive|`docs/design/salcosta/SALCOSTA_DESIGN_ANALYSIS.md`|
|This Document|`docs/design/PORTFOLIO_DESIGN_PATTERNS.md`|
