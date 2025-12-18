# Christina Kosik Portfolio - Complete Design Analysis

**URL:** https://www.bychristinakosik.com/
**Role:** Designer & Webflow Developer
**Location:** Vancouver, Canada
**Analysis Date:** December 2025
**Last Published:** Mon Jan 27 2025

---

## Table of Contents

1. [Design Philosophy & Overall Aesthetic](#1-design-philosophy--overall-aesthetic)
2. [Color System - Every Value](#2-color-system---every-value)
3. [Typography System - Complete](#3-typography-system---complete)
4. [Layout Architecture - Grid Systems](#4-layout-architecture---grid-systems)
5. [Spacing System](#5-spacing-system)
6. [Animation System - Complete GSAP Code](#6-animation-system---complete-gsap-code)
7. [The Infinite Scroll System](#7-the-infinite-scroll-system)
8. [FLIP Popup Animation System](#8-flip-popup-animation-system)
9. [Page Loader - Complete Implementation](#9-page-loader---complete-implementation)
10. [Lenis Smooth Scroll Configuration](#10-lenis-smooth-scroll-configuration)
11. [WebGL Displacement Hover Effect](#11-webgl-displacement-hover-effect)
12. [Component Catalog - Every CSS Class](#12-component-catalog---every-css-class)
13. [Responsive Breakpoints - All Values](#13-responsive-breakpoints---all-values)
14. [Z-Index Layering](#14-z-index-layering)
15. [Focus States & Accessibility](#15-focus-states--accessibility)
16. [Technical Implementation](#16-technical-implementation)
17. [Design Patterns to Steal](#17-design-patterns-to-steal)

---

## 1. Design Philosophy & Overall Aesthetic

### Core Principles

1. **Dark Minimalism** - Pure dark background with white text, no grays
2. **One-Page Experience** - Everything on a single infinite-scrolling page
3. **Motion as Navigation** - Scroll triggers all visual changes
4. **Immersive Overlays** - Full-screen popups instead of page transitions
5. **Big Typography** - Name as hero, massive loader numbers
6. **Asymmetrical Grid** - Project cards span different column counts

### Visual Identity

- **Single color palette:** Black (`#151515`) + White (`#fff`)
- **Single typeface:** Uncut Sans (with Helvetica fallback)
- **No borders, no shadows** - Pure flat design
- **Vimeo video integration** - Project showcases include video
- **Time display** - Live clock adds "always-on" feel

---

## 2. Color System - Every Value

### CSS Custom Properties

```css
:root {
  --black: #151515;
}
```

### Complete Color Usage

| Element | Color | Notes |
|---------|-------|-------|
| Background | `#151515` | Near-black, not pure `#000` |
| Body text | `#fff` | Pure white |
| Links default | `opacity: 0.4` on white | 40% opacity |
| Links hover | `opacity: 1` | Full white |
| Border bottom (links) | `1px solid #fff` | Underline style |
| Focus outline | `#4d65ff` | Vibrant blue |
| Loader progress | `#fff` | White bar |
| Loader track | `rgba(255,255,255,0.2)` implied | 20% white |

### Why #151515 Instead of #000000

`#151515` (RGB: 21, 21, 21) provides:

- Slightly softer than pure black
- Better for extended viewing
- Allows for "blacker" elements if needed
- Professional, not harsh

### Opacity-Based Color System

Instead of multiple grays, the site uses opacity on white:

```css
a {
  opacity: .4;  /* Default state */
}
a:hover {
  opacity: 1;   /* Hover state */
}
```

---

## 3. Typography System - Complete

### Font Families

```css
/* Primary - Uncut Sans */
@font-face {
  font-family: 'Uncut Sans';
  src: url('...Uncut-Sans-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

/* Fallback - Helvetica */
@font-face {
  font-family: 'Helvetica';
  src: url('...helvetica-light-587ebe5a59211.woff2') format('woff2');
  font-weight: 300;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Helvetica';
  src: url('...Helvetica.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

### Font Stack

```css
body {
  font-family: Uncut Sans, sans-serif;
}

/* Fallback areas use */
font-family: Helvetica, Arial, sans-serif;
```

### Fluid Typography System

**The key innovation** - viewport-based font sizing:

```css
/* Base - all screens */
html {
  font-size: calc(0.5rem + 0.41666666666666663vw);
}

/* Large desktop (max 1920px) */
@media screen and (max-width: 1920px) {
  html {
    font-size: calc(0.49999999999999994rem + 0.41666666666666674vw);
  }
}

/* Desktop (max 1440px) */
@media screen and (max-width: 1440px) {
  html {
    font-size: calc(0.6876951092611863rem + 0.20811654526534862vw);
  }
}

/* Mobile (max 479px) */
@media screen and (max-width: 479px) {
  html {
    font-size: calc(0.7497384937238494rem + 0.41841004184100417vw);
  }
}
```

### Type Scale (in em/rem)

| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| h1 | `5em` | `4.9em` | `8em` |
| h2 | `5.42em` | - | `8.7em` |
| h3 | `1.04em` | `1.25em` | `2.8em` |
| p | `1.04em` | `1.25em` | `3.2em` |
| a | `1.04em` | `1.25em` | `2.8em` |
| .text | `1.04em` | `1.25em` | `2.8em` |
| .new-p | `1rem` | - | - |
| .loader_number | `35vw` | - | `40vw` |
| .home-hero_name | `15.9vw` | `16.6vw` | `24vw` |

### Typography Styles

```css
h1 {
  text-align: justify;
  letter-spacing: -.01em;
  text-transform: uppercase;
  margin-top: 0;
  margin-bottom: 0;
  font-size: 5em;
  font-weight: 400;
  line-height: 1;
}

h2 {
  text-align: justify;
  letter-spacing: -.01em;
  text-transform: uppercase;
  margin-top: 0;
  margin-bottom: 0;
  font-size: 5.42em;
  font-weight: 400;
  line-height: 1;
}

p {
  text-align: justify;
  margin-bottom: 0;
  font-size: 1.04em;
  font-weight: 300;
}

a {
  opacity: .4;
  text-transform: uppercase;
  cursor: pointer;
  font-size: 1.04em;
  text-decoration: none;
  transition: opacity .3s cubic-bezier(.445, .05, .55, .95);
}
```

### Hero Name Styling

```css
.home-hero_name {
  text-align: left;
  letter-spacing: -.6vw;      /* Tight negative tracking */
  text-transform: none;        /* NOT uppercase */
  margin-left: -.7vw;          /* Optical alignment adjustment */
  font-size: 15.9vw;           /* Massive viewport-based size */
  line-height: .75;            /* Very tight leading */
}
```

### Loader Number Styling

```css
.loader_number {
  letter-spacing: -1rem;       /* Extremely tight */
  font-size: 35vw;             /* Fills viewport */
  font-weight: 400;
  line-height: .75;
}
```

### Font Rendering

```css
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
```

### Text Truncation Utilities

```css
.text-style-3lines {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.text-style-2lines {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
```

---

## 4. Layout Architecture - Grid Systems

### Main Page Structure

```
.page-wrapper_new
├── .page-loader (fixed, full viewport)
├── .home-hero_section (fixed, full viewport)
│   └── .global-padding
│       └── .home-hero_content
│           ├── .home-hero_content-grid (5-column grid)
│           └── .home-hero_name-wrapper
├── .main-wrapper (z-index: 1)
│   ├── .home-hero_spacer (150vh)
│   ├── .home-projects_section
│   │   └── .projects_list (5-column grid, asymmetrical)
│   └── .home-end_spacer (50vh)
└── .popup (fixed, z-index: 99)
    └── .popup_item (per project)
```

### Hero Content Grid (5-Column)

```css
.home-hero_content-grid {
  grid-column-gap: 1rem;
  grid-row-gap: 1rem;
  opacity: 1;
  grid-template-rows: auto;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  grid-auto-columns: 1fr;
  width: 100%;
  display: grid;
  transform: translate(0);
}
```

### Projects Grid (5-Column Asymmetrical)

```css
.projects_list {
  grid-column-gap: 1rem;
  grid-row-gap: 12.75rem;  /* Large vertical gap between rows */
  grid-template-rows: auto auto auto;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  grid-auto-columns: 1fr;
  display: grid;
}
```

### Asymmetrical Grid Item Placement

**Desktop (768px+):**

```css
.projects_item:nth-child(1) { grid-column: 1 / span 2 !important; }  /* 2 cols */
.projects_item:nth-child(2) { grid-column: 3 / span 3 !important; }  /* 3 cols */
.projects_item:nth-child(3) { grid-column: 1 / span 3 !important; }  /* 3 cols */
.projects_item:nth-child(4) { grid-column: 4 / span 2 !important; }  /* 2 cols */
.projects_item:nth-child(5) { grid-column: 1 / span 2 !important; }  /* 2 cols */
.projects_item:nth-child(6) { grid-column: 3 / span 3 !important; }  /* 3 cols */
.projects_item:nth-child(7) { grid-column: 1 / span 3 !important; }  /* 3 cols */
.projects_item:nth-child(8) { grid-column: 4 / span 2 !important; }  /* 2 cols */
```

**Pattern:** 2-3-3-2 repeating

**Mobile (< 768px):**

```css
.projects_item:nth-child(n) { grid-column: 1 / span 5 !important; }  /* Full width */
```

### Popup Grid

```css
.popup_grid {
  grid-column-gap: 1rem;
  grid-row-gap: 12.75rem;
  grid-template-rows: auto auto auto;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  grid-auto-columns: 1fr;
  padding: 12.75rem 1rem 1rem;
  display: grid;
}
```

### Popup Content Grid

```css
.home-popup_content {
  grid-column-gap: 1rem;
  grid-row-gap: 1rem;
  grid-template-rows: 1.25rem auto auto;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  grid-auto-columns: 1fr;
  width: 100%;
  height: auto;
  padding: 1rem;
  display: grid;
}
```

---

## 5. Spacing System

### Base Unit

Everything is based on `1rem` (which scales with the fluid typography system).

### Global Padding

```css
.global-padding {
  width: 100%;
  height: 100%;
  padding-left: 1rem;
  padding-right: 1rem;
}
```

### Section Spacing

```css
.section {
  margin-left: 1.25em;
  margin-right: 1.25em;
  padding-top: 1.25em;
  padding-bottom: 1.25em;
}
```

### Grid Gaps

| Grid | Column Gap | Row Gap |
|------|------------|---------|
| Hero content | `1rem` | `1rem` |
| Projects list | `1rem` | `12.75rem` |
| Popup grid | `1rem` | `12.75rem` |
| Popup content | `1rem` | `1rem` |

### Spacer Elements

```css
.home-hero_spacer {
  width: 100%;
  height: 150vh;  /* 1.5x viewport height */
}

.home-end_spacer {
  width: 100%;
  height: 50vh;   /* 0.5x viewport height */
}
```

### Project Info Padding

```css
.home-projects_info {
  padding-top: .5rem;
}
```

### Service Wrapper Gap

```css
.home-hero_service-wrapper {
  grid-row-gap: 2.5rem;
}
```

---

## 6. Animation System - Complete GSAP Code

### Libraries Loaded

```html
<script src="https://cdn.jsdelivr.net/gh/studio-freight/lenis@1.0.19/bundled/lenis.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.11.4/Flip.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.10.4/CustomEase.min.js"></script>
```

### Plugin Registration

```javascript
gsap.registerPlugin(ScrollTrigger, Flip);
```

### Hero Scroll Animation (First Pass)

When scrolling INTO the projects section:

```javascript
let tlFirst = gsap.timeline({
  scrollTrigger: {
    trigger: ".home-projects_section",
    start: "top bottom",      // When top of section hits bottom of viewport
    end: "top center",        // When top of section hits center of viewport
    scrub: true,              // Tied to scroll position
    toggleActions: "none none reverse none"
  },
  defaults: {
    ease: "none"
  }
})
  .fromTo(".home-hero_content", { autoAlpha: 1 }, { autoAlpha: 0 })
  .fromTo(".home-hero_content-grid", { yPercent: 0 }, { yPercent: -50 }, 0)
  .fromTo(".home-hero_name-wrapper", { yPercent: 0 }, { yPercent: 50 }, 0);
```

**Effect:** Hero fades out, content moves up, name moves down (parallax split)

### Hero Scroll Animation (Second Pass)

When scrolling PAST the projects section (looping back):

```javascript
let tlSecond = gsap.timeline({
  scrollTrigger: {
    trigger: ".home-projects_section",
    start: "bottom center",   // When bottom of section hits center
    end: "bottom top",        // When bottom hits top of viewport
    scrub: true,
    toggleActions: "none none reverse none"
  },
  defaults: {
    ease: "none"
  }
})
  .from(".home-hero_content", { autoAlpha: 0 })
  .from(".home-hero_content-grid", { yPercent: -50 }, 0)
  .from(".home-hero_name-wrapper", { yPercent: 50 }, 0);
```

**Effect:** Hero fades back in as you approach the loop point

### CSS Performance Hints

```css
.home-hero_content-grid {
  will-change: transform, opacity;
}

.home-hero_name-wrapper {
  will-change: transform, opacity;
}
```

### Link Transition

```css
a {
  transition: opacity .3s cubic-bezier(.445, .05, .55, .95);
}
```

**Easing:** Sine.easeInOut equivalent - smooth, symmetrical

---

## 7. The Infinite Scroll System

### Lenis Configuration

```javascript
const lenis = new Lenis({
  smooth: true,
  infinite: true,    // KEY: Enables infinite looping
  wrapper: document.body
});
```

### Scroll-GSAP Sync

```javascript
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.lagSmoothing(0);

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}

requestAnimationFrame(raf);
```

### Content Cloning for Seamless Loop

```javascript
const repeatItems = (parentEl, total = 0) => {
  const items = [...parentEl.children];
  for (let i = 0; i <= total - 1; ++i) {
    var cln = items[i].cloneNode(true);
    parentEl.appendChild(cln);
  }
};

repeatItems(document.querySelector('.main-wrapper'), 1);
```

**What this does:**

1. Gets all children of `.main-wrapper`
2. Clones them
3. Appends clones to create seamless loop

### Mobile Fallback

```javascript
const mediaQuery = window.matchMedia('(max-width: 768px)');

if (mediaQuery.matches) {
  console.log("media-matched");
  lenis.destroy();  // Disables smooth/infinite scroll on mobile
  gsap.ticker.lagSmoothing(0);
}
```

### Lenis CSS Requirements

```css
html.lenis {
  height: auto;
}

.lenis.lenis-smooth {
  scroll-behavior: auto;
}

.lenis.lenis-smooth [data-lenis-prevent] {
  overscroll-behavior: contain;
}

.lenis.lenis-stopped {
  overflow: hidden;
}

.lenis.lenis-scrolling iframe {
  pointer-events: none;
}
```

---

## 8. FLIP Popup Animation System

### Setup - Data Attributes

```javascript
$(".projects_link").each(function (index) {
  let relatedPopupItem = $(".popup_item").eq(index);
  let projectImg = $(this).find(".projects_img");
  let popupImg = relatedPopupItem.find(".projects_img");

  // Assign matching data-flip-id for FLIP tracking
  projectImg.attr("data-flip-id", index);
  popupImg.attr("data-flip-id", index);
});
```

### Open Popup Timeline

```javascript
let openPopup = gsap
  .timeline({
    paused: true,
    defaults: {
      duration: 0.7,
      ease: "power1.inOut"
    }
  })
  .fromTo($(this).find(".home-projects_info"),
    { opacity: 1 },
    { opacity: 0 }
  )
  .to($(this).parent().siblings(),
    { opacity: 0, duration: 0.5 },
    "<"  // Start at same time
  )
  .from(relatedPopupItem.find('.popup_project-name'),
    { opacity: 0, yPercent: 100 },
    "=-0.3"  // 0.3s before previous ends
  )
  .from(relatedPopupItem.find('.popup_project-info'),
    { opacity: 0, yPercent: 100 },
    "=-0.3"
  )
  .from(relatedPopupItem.find('.popup_service-wrapper'),
    { opacity: 0, yPercent: 100 },
    "=-0.3"
  )
  .from(relatedPopupItem.find('.popup_project-link-wrap'),
    { opacity: 0, yPercent: 100 },
    "=-0.3"
  );
```

### State Toggle Function

```javascript
function toggleOpenClasses() {
  $(".body-new").toggleClass("popup-open");
  relatedPopupItem.toggleClass("current");
  projectImg.toggleClass("current");
}
```

### Open Popup Handler

```javascript
$(this).on("click", function () {
  // 1. Record initial state (image position in grid)
  const state = Flip.getState(projectImg, { props: "backgroundPosition" });

  // 2. Toggle classes (moves image to popup)
  toggleOpenClasses();

  // 3. Animate from old position to new
  Flip.from(state, {
    targets: popupImg,
    duration: 1,
    absolute: true,
    toggleClass: "flipping",
    ease: "power1.inOut"
  });

  // 4. Play content animations
  openPopup.restart();
});
```

### Close Popup Handler

```javascript
relatedPopupItem.find(".popup_back").on("click", function () {
  // 1. Record popup state
  const state = Flip.getState(popupImg, { props: "backgroundPosition" });

  // 2. Toggle classes (moves image back to grid)
  toggleOpenClasses();

  // 3. Animate back
  Flip.from(state, {
    targets: projectImg,
    duration: 1,
    absolute: true,
    toggleClass: "flipping",
    ease: "power1.inOut"
  });

  // 4. Reverse content animations
  openPopup.reverse();
});
```

### Popup State CSS

```css
/* When popup is open */
.body-new.popup-open .popup_container {
  overflow-y: auto;
  scroll-behavior: auto;
}

.body-new.popup-open {
  overflow: hidden;  /* Lock body scroll */
}

.body-new.popup-open .popup {
  display: block;
}

.body-new.popup-open .popup_item.current {
  display: block;
}

.body-new.popup-open .projects_img.current {
  display: none;  /* Hide grid image when in popup */
}

.body-new.popup-open .main-wrapper {
  pointer-events: none;  /* Disable grid interaction */
}
```

---

## 9. Page Loader - Complete Implementation

### Custom Ease Curve

```javascript
let customEase =
  "M0,0,C0,0,0.13,0.34,0.238,0.442,0.305,0.506,0.322,0.514,0.396,0.54,0.478,0.568,0.468,0.56,0.522,0.584,0.572,0.606,0.61,0.719,0.714,0.826,0.798,0.912,1,1,1,1";
```

This creates a custom easing curve that:

- Starts slow
- Accelerates in middle
- Slows dramatically at end (builds anticipation)

### Session-Aware Duration

```javascript
let counter = { value: 0 };
let loaderDuration = 8;  // First visit: 8 seconds

// If not first visit in this tab
if (sessionStorage.getItem("visited") !== null) {
  loaderDuration = 2;     // Return visit: 2 seconds
  counter = { value: 75 }; // Start at 75%
}

sessionStorage.setItem("visited", "true");
```

### Counter Update Function

```javascript
function updateLoaderText() {
  let progress = Math.round(counter.value);
  $(".loader_number").text(progress);
}
```

### End Loader Function

```javascript
function endLoaderAnimation() {
  $(".trigger").click();  // Trigger Webflow interaction
  lenis.start(true);       // Enable smooth scroll
  gsap.set(".home-hero_content", { autoAlpha: 1 });
  gsap.set(".home-hero_content-grid", { yPercent: 0 });
  gsap.set(".home-hero_name-wrapper", { yPercent: 0 });
}
```

### Loader Timeline

```javascript
let tlLoad = gsap.timeline({
  onComplete: endLoaderAnimation,
  onStart: () => {
    lenis.stop(true);  // Disable scroll during load
  }
});

// Animate counter from 0 (or 75) to 100
tlLoad.to(counter, {
  value: 100,
  onUpdate: updateLoaderText,
  duration: loaderDuration,
  ease: CustomEase.create("custom", customEase)
});

// Animate progress bar width
tlLoad.to(".loader_progress", {
  width: "100%",
  duration: loaderDuration,
  ease: CustomEase.create("custom", customEase)
}, 0);  // Start at same time
```

### Loader CSS

```css
.page-loader {
  z-index: 5;
  background-color: var(--black);
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  height: 100svh;
  display: none;  /* Hidden by default, shown via .page-loader { display: flex } override */
  position: fixed;
  inset: 0%;
  overflow: hidden;
}

.loader_progress-wrapper {
  width: 100%;
  height: .5rem;
  position: relative;
}

.loader_progress {
  z-index: 1;
  background-color: #fff;
  width: 0%;
  height: 100%;
  position: absolute;
  inset: 0% auto 0% 0%;
}

.loader_numbers-wrapper {
  justify-content: flex-end;
  padding-bottom: 1rem;
  padding-right: 1rem;
  display: flex;
}

.loader_number {
  letter-spacing: -1rem;
  font-size: 35vw;
  font-weight: 400;
  line-height: .75;
}
```

### Inline Style Override

```css
.page-loader {
  display: flex;  /* Shown during load */
}
```

---

## 10. Lenis Smooth Scroll Configuration

### Initialization

```javascript
const lenis = new Lenis({
  smooth: true,
  infinite: true,
  wrapper: document.body
});
```

### Parameters Explained

| Parameter | Value | Effect |
|-----------|-------|--------|
| `smooth` | `true` | Enables smooth scrolling |
| `infinite` | `true` | Content loops infinitely |
| `wrapper` | `document.body` | Scroll container |

### Integration with GSAP

```javascript
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.lagSmoothing(0);
```

### Animation Loop

```javascript
function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}

requestAnimationFrame(raf);
```

### Preventing Scroll in Popups

```html
<div data-lenis-prevent="" class="popup_container">
```

The `data-lenis-prevent` attribute tells Lenis to not apply smooth scrolling to this element.

---

## 11. WebGL Displacement Hover Effect

### Three.js Implementation (hover.js)

The site uses a WebGL shader for image hover effects (currently commented out in production).

### Core Setup

```javascript
var hoverEffect = function(opts) {
  var parent = opts.parent;
  var dispImage = opts.displacementImage;
  var image1 = opts.image1;
  var image2 = opts.image2;
  var intensity = opts.intensity || 1;
  var speedIn = opts.speedIn || 1.6;
  var speedOut = opts.speedOut || 1.2;
  var easing = opts.easing || Expo.easeOut;
```

### Vertex Shader

```glsl
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

### Fragment Shader (Displacement Effect)

```glsl
varying vec2 vUv;

uniform sampler2D texture;
uniform sampler2D texture2;
uniform sampler2D disp;
uniform float dispFactor;
uniform float effectFactor;

void main() {
  vec2 uv = vUv;
  vec4 disp = texture2D(disp, uv);

  vec2 distortedPosition = vec2(
    uv.x + dispFactor * (disp.r * effectFactor),
    uv.y
  );
  vec2 distortedPosition2 = vec2(
    uv.x - (1.0 - dispFactor) * (disp.r * effectFactor),
    uv.y
  );

  vec4 _texture = texture2D(texture, distortedPosition);
  vec4 _texture2 = texture2D(texture2, distortedPosition2);

  vec4 finalTexture = mix(_texture, _texture2, dispFactor);

  gl_FragColor = finalTexture;
}
```

### How It Works

1. Two textures (before/after images)
2. Displacement map controls distortion
3. `dispFactor` interpolates between states (0-1)
4. On hover: `dispFactor` animates to 1
5. On leave: `dispFactor` animates to 0

### Hover Events

```javascript
parent.addEventListener("mouseenter", function(e) {
  TweenMax.to(mat.uniforms.dispFactor, speedIn, {
    value: 1,
    ease: easing
  });
});

parent.addEventListener("mouseleave", function(e) {
  TweenMax.to(mat.uniforms.dispFactor, speedOut, {
    value: 0,
    ease: easing
  });
});
```

### Displacement Texture URL

```javascript
displacementImage: 'https://cdn.prod.website-files.com/62b93934fb5c4c2d1245bff2/64d986573dbdc60d86b3e360_texture3.jpg'
```

---

## 12. Component Catalog - Every CSS Class

### Body

```css
.body-new {
  color: #fff;
  background-color: #151515;
  font-family: Uncut Sans, sans-serif;
  font-size: 1rem;
  font-weight: 400;
}
```

### Page Wrapper

```css
.page-wrapper_new {
  width: 100%;
  font-size: 1rem;
  position: relative;
  overflow: hidden;
}
```

### Hero Section

```css
.home-hero_section {
  width: 100%;
  height: 100dvh;
  position: fixed;
  inset: 0%;
}
```

### Hero Content

```css
.home-hero_content {
  opacity: 1;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding-top: 1rem;
  padding-bottom: 1rem;
  display: flex;
}
```

### Hero Name Wrapper

```css
.home-hero_name-wrapper {
  width: 100%;
  overflow: hidden;
  transform: translate(0);
}
```

### Time Display

```css
.hero-home_time-wrapper {
  grid-column-gap: .5rem;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  display: flex;
}

.home-hero_time-icon {
  width: 1rem;
}
```

### Service Items

```css
.home-hero_service-wrapper {
  grid-row-gap: 2.5rem;
  flex-direction: column;
  display: flex;
}

.home-hero_service {
  justify-content: space-between;
  align-items: flex-start;
  display: flex;
}

.home-hero_service-items {
  flex-direction: column;
  align-items: flex-end;
  display: flex;
}
```

### Text Link

```css
.new_text-link {
  text-transform: none;
  border-bottom: 1px solid #fff;
}
```

### Projects List Item

```css
.projects_item {
  width: 100%;
}
```

### Projects Link

```css
.projects_link {
  opacity: 1;
  text-transform: none;
  width: 100%;
  font-size: 1rem;
  transition-property: none;
}
```

### Projects Image Wrapper

```css
.projects_img-wrapper {
  width: 100%;
  padding-top: 60%;  /* 5:3 aspect ratio */
  position: relative;
  overflow: visible;
}
```

### Projects Image

```css
.projects_img {
  background-image: url(...);
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: cover;
  background-attachment: scroll;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  display: flex;
  position: absolute;
  inset: 0%;
  overflow: hidden;
}
```

### Popup Container

```css
.popup_container {
  width: 100%;
  font-style: normal;
  position: fixed;
  inset: 0%;
  overflow: scroll;
}
```

### Popup Image Wrapper

```css
.popup_img-wrapper {
  width: 100%;
  padding-top: 75vh;  /* 75% of viewport height */
  position: relative;
}
```

### Popup Back Link

```css
.popup_back {
  text-transform: none;
  border-bottom: 1px solid #fff;
}
```

### Popup Project Info

```css
.popup_project-info {
  text-align: left;
  max-width: 25rem;
  font-size: 1rem;
  font-weight: 400;
}
```

### Popup Project Link

```css
.popup_project-link {
  opacity: .4;
  text-transform: none;
  border-bottom: 1px solid #fff;
}
```

### Video Container

```css
.popup_bg-video {
  z-index: 1;
  object-fit: cover;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  display: block;
  position: absolute;
  inset: 0%;
}

.video-first_square {
  width: 100%;
  height: 100%;
  padding-top: 100%;  /* 1:1 aspect ratio */
  position: relative;
}
```

### No Scroll Background

```css
.no-scroll-bg {
  background-color: var(--black);
  width: 100%;
  height: 100%;
  position: fixed;
  inset: 0%;
}
```

---

## 13. Responsive Breakpoints - All Values

### Breakpoint: 991px (Tablet)

```css
@media screen and (max-width: 991px) {
  body { font-size: 1.2vw; }
  h1 { font-size: 4.9em; }
  h3, a { font-size: 1.25em; }
  p { font-size: 1.25em; line-height: 1.3; }
  .text { font-size: 1.25em; }

  .home-hero_content-grid {
    grid-template-rows: auto auto;  /* 2 rows instead of 1 */
  }

  .home-hero_service-wrapper {
    padding-top: 10rem;
  }

  .home-hero_name {
    letter-spacing: -1vw;
    font-size: 16.6vw;
    line-height: .9;
  }
}
```

### Breakpoint: 767px (Mobile Landscape)

```css
@media screen and (max-width: 767px) {
  body { font-size: 1.2vw; }
  h2 { font-size: 4.8em; }
  h3 { font-size: 1.4em; }
  p, a { font-size: 1.61em; }
  .text { font-size: 1.61em; }

  .home-hero_service-wrapper {
    padding-top: 0;
  }

  .home-projects_section {
    padding-bottom: 0;
  }

  .home-hero_spacer {
    height: 100vh;  /* Down from 150vh */
  }

  .projects_list {
    grid-row-gap: 3rem;  /* Down from 12.75rem */
    width: 100%;
  }

  .home-end_spacer {
    height: 100vh;  /* Up from 50vh */
  }

  .home-hero_name {
    letter-spacing: -.8vw;
    font-size: 16vw;
  }

  .popup_img-wrapper {
    padding-top: 50%;  /* Down from 75vh */
  }

  .popup_grid {
    grid-row-gap: 1rem;  /* Down from 12.75rem */
    padding-top: 6rem;
  }
}
```

### Breakpoint: 479px (Mobile Portrait)

```css
@media screen and (max-width: 479px) {
  body { font-size: 1.2vw; }
  h1 { font-size: 8em; line-height: 1.1; }
  h2 { font-size: 8.7em; line-height: 1.05; }
  h3 { font-size: 2.8em; }
  p { font-size: 3.2em; }
  a { font-size: 2.8em; }
  .text { font-size: 2.8em; }

  .home-hero_section {
    height: 100dvh;
  }

  .home-hero_content-grid {
    grid-column-gap: 1rem;
    grid-row-gap: 1.5rem;
    grid-template-columns: 1fr 1fr 1fr;  /* 3 columns instead of 5 */
  }

  .hero-home_time-wrapper {
    justify-content: space-between;
  }

  .home-hero_service-wrapper {
    grid-row-gap: 2rem;
    padding-top: 2rem;
  }

  .home-projects_section {
    background-color: var(--black);
    position: relative;
  }

  .home-hero_name {
    font-size: 24vw;  /* Even bigger on mobile */
  }

  .loader_number {
    letter-spacing: 0;  /* Normal spacing */
    font-size: 40vw;
  }

  .home-popup_content {
    grid-template-columns: 1fr 1fr 1fr;  /* 3 columns */
  }

  .popup_service-wrapper {
    margin-top: 5rem;
  }

  .popup_img-wrapper {
    padding-top: 70%;
  }

  .popup_grid {
    width: 100%;
    padding-top: 0;
  }

  .popup_content-footer {
    grid-template-columns: 1fr 1fr 1fr;
    width: 100%;
    padding-bottom: 1rem;
  }
}
```

---

## 14. Z-Index Layering

| Z-Index | Element | Purpose |
|---------|---------|---------|
| 99 | `.popup` | Project overlay |
| 50 | `.popup_item` | Individual popup |
| 5 | `.page-loader` | Loading screen |
| 2 | `.nav` | Navigation (old site) |
| 1 | `.main-wrapper` | Main content |
| 1 | `.projects_img` | Project images |
| 1 | `.popup_bg-video` | Video backgrounds |
| 1 | `.loader_progress` | Progress bar |

### Popup Edit State

```css
.popup.edit {
  z-index: 1000;  /* Higher for Webflow editor */
  display: block;
}
```

---

## 15. Focus States & Accessibility

### Focus Visible Outline

```css
*[tabindex]:focus-visible,
input[type="file"]:focus-visible {
  outline: 0.125rem solid #4d65ff;
  outline-offset: 0.125rem;
}
```

**Color:** `#4d65ff` - Vibrant blue for clear visibility on dark background

### Pointer Events Control

```css
.pointer-events-off {
  pointer-events: none;
}

.pointer-events-on {
  pointer-events: auto;
}

.home-hero_spacer {
  pointer-events: none;
}

.home-end_spacer {
  pointer-events: none;
}
```

### Link Inheritance

```css
a,
.w-input,
.w-select,
.w-tab-link,
.w-nav-link,
.w-dropdown-btn,
.w-dropdown-toggle,
.w-dropdown-link {
  color: inherit;
  text-decoration: inherit;
  font-size: inherit;
}
```

---

## 16. Technical Implementation

### Platform

**Webflow** with custom code embeds

### Build Info

```html
<!-- Last Published: Mon Jan 27 2025 11:54:07 GMT+0000 -->
<html
  data-wf-domain="www.bychristinakosik.com"
  data-wf-page="64c3a23e8e3559214f1aeb4d"
  data-wf-site="62b93934fb5c4c2d1245bff2"
>
```

### Scripts Loaded

| Script | Version | Purpose |
|--------|---------|---------|
| jQuery | 3.5.1 | DOM manipulation |
| GSAP | 3.12.2 | Core animation |
| ScrollTrigger | 3.12.2 | Scroll-based triggers |
| Flip | 3.11.4 | FLIP animations |
| CustomEase | 3.10.4 | Custom easing curves |
| Lenis | 1.0.19 | Smooth scrolling |
| Three.js | 108 | WebGL (for hover effect) |
| hover.js | Custom | Displacement effect |

### Analytics

```javascript
gtag('config', 'G-791GL4FX7G');
```

### Dynamic Content

Uses Webflow CMS (`w-dyn-list`, `w-dyn-items`, `w-dyn-item`) for projects.

### Image Hosting

CDN: `cdn.prod.website-files.com`

### Video Hosting

Vimeo embeds with `?background=1` for autoplay/loop without controls.

---

## 17. Design Patterns to Steal

### 1. Massive Typography

```css
.home-hero_name {
  font-size: 15.9vw;    /* Takes over viewport */
  letter-spacing: -.6vw; /* Tight tracking */
  line-height: .75;      /* Extremely tight leading */
}
```

### 2. Fluid Typography Formula

```css
font-size: calc(0.5rem + 0.41666666666666663vw);
```

Creates smooth scaling without breakpoint jumps.

### 3. Session-Aware Loading

```javascript
if (sessionStorage.getItem("visited") !== null) {
  loaderDuration = 2;  // Faster for returning users
  counter = { value: 75 };
}
```

### 4. Custom Loader Easing

```javascript
let customEase = "M0,0,C0,0,0.13,0.34,0.238,0.442,0.305,0.506...";
```

Slow start, accelerate, slow end - builds anticipation.

### 5. Asymmetrical Grid Pattern

```css
.item:nth-child(1) { grid-column: span 2; }
.item:nth-child(2) { grid-column: span 3; }
```

2-3-3-2 pattern creates visual rhythm.

### 6. FLIP Animation for Modals

```javascript
const state = Flip.getState(element, { props: "backgroundPosition" });
toggleClasses();
Flip.from(state, { duration: 1, ease: "power1.inOut" });
```

### 7. Lenis Infinite Scroll

```javascript
const lenis = new Lenis({
  smooth: true,
  infinite: true
});
```

### 8. Parallax Split on Scroll

```javascript
.fromTo(".content-grid", { yPercent: 0 }, { yPercent: -50 }, 0)
.fromTo(".name-wrapper", { yPercent: 0 }, { yPercent: 50 }, 0)
```

Content moves opposite directions.

### 9. Opacity-Based Color System

```css
a { opacity: .4; }
a:hover { opacity: 1; }
```

Instead of multiple color values, use opacity.

### 10. Live Time Display

```javascript
function showTime() {
  let time = new Date();
  displayTime.innerText = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
  setTimeout(showTime, 1000);
}
```

---

## File Reference

| File | Size | Contents |
|------|------|----------|
| `bychristinakosik` | 57KB | Complete HTML |
| `by-christinakosik.e636c482e.min.css` | 49KB | Full stylesheet |
| `hover.js` | 7KB | WebGL displacement effect |
| `jquery-3.5.1.min.dc5e7f18c8.js` | 89KB | jQuery |
| `lenis.min.js` | 12KB | Smooth scroll library |
