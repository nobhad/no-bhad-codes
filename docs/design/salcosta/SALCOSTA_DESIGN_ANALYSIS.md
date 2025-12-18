# Sal Costa Portfolio - Complete Design Analysis

**URL:** https://salcosta.dev
**Role:** Frontend Developer & UX Designer
**Analysis Date:** December 2025

---

## Table of Contents

1. [Design Philosophy & Overall Aesthetic](#1-design-philosophy--overall-aesthetic)
2. [Color System - Complete Breakdown](#2-color-system---complete-breakdown)
3. [Typography System](#3-typography-system)
4. [CSS Custom Properties (Variables)](#4-css-custom-properties-variables)
5. [Animation System - Every Keyframe](#5-animation-system---every-keyframe)
6. [The Lava Lamp System - Deep Dive](#6-the-lava-lamp-system---deep-dive)
7. [Component Catalog - Every UI Element](#7-component-catalog---every-ui-element)
8. [Spacing & Layout System](#8-spacing--layout-system)
9. [Responsive Breakpoints - All Behaviors](#9-responsive-breakpoints---all-behaviors)
10. [Micro-Interactions Catalog](#10-micro-interactions-catalog)
11. [Shadow System](#11-shadow-system)
12. [Glassmorphism Implementation](#12-glassmorphism-implementation)
13. [Focus States & Accessibility](#13-focus-states--accessibility)
14. [Page-by-Page Design Analysis](#14-page-by-page-design-analysis)
15. [Border Radius Philosophy](#15-border-radius-philosophy)
16. [Technical Implementation Notes](#16-technical-implementation-notes)
17. [Design Patterns to Steal](#17-design-patterns-to-steal)

---

## 1. Design Philosophy & Overall Aesthetic

### Core Principles Observed

1. **Warm Minimalism** - Not cold/sterile white, but inviting cream tones
2. **Playful Sophistication** - Serious enough for clients, fun enough to be memorable
3. **Motion as Personality** - Every element has considered enter/exit/hover states
4. **Duality** - Light/dark themes aren't just inverted, they're complementary opposites
5. **Asymmetry with Purpose** - Intentional off-balance corners create visual interest
6. **Content-First** - Animations enhance, never distract from content

### Visual Identity

- **No traditional navigation bar** - Uses full-screen overlay menu
- **Signature element** - Morphing lava lamp blobs in background
- **Custom cursor** - Follows mouse, changes size on interactive elements
- **Single typeface** - Plus Jakarta Sans at weight 600 throughout
- **Monochromatic with single accent** - Text color + one highlight color per theme

---

## 2. Color System - Complete Breakdown

### Light Mode Palette

```css
--bg: #fffbee           /* Background - Warm cream/off-white */
--bg-rgb: 255, 251, 238  /* RGB for alpha operations */
--text: #191919          /* Primary text - Near black (not pure black) */
--text-rgb: 25, 25, 25   /* RGB for alpha operations */
--color: #ff6663         /* Accent - Coral/salmon red */
--color-rgb: 255, 102, 99 /* RGB for alpha operations */
--glass-text: rgba(25, 25, 25, .2) /* Glassmorphism overlay */
```

### Dark Mode Palette

```css
--bg: #191919            /* Background - Deep charcoal */
--bg-rgb: 25, 25, 25
--text: #fffbee          /* Primary text - Warm cream */
--text-rgb: 255, 251, 238
--color: #8c82ff         /* Accent - Soft purple/lavender */
--color-rgb: 140, 130, 255
--glass-text: rgba(255, 251, 238, .3)
```

### Color Philosophy Analysis

| Aspect | Light Mode | Dark Mode | Notes |
|--------|-----------|-----------|-------|
| Background | Warm cream `#fffbee` | Charcoal `#191919` | NOT pure white/black |
| Text | Near-black `#191919` | Cream `#fffbee` | Perfect inversion |
| Accent | Warm coral `#ff6663` | Cool purple `#8c82ff` | Complementary temperatures |
| Contrast ratio | ~15:1 | ~15:1 | Excellent accessibility |

### Why These Colors Work

1. **`#fffbee` vs `#ffffff`** - The cream has warmth (RGB 255, 251, 238 - slight yellow tint). Pure white is cold and clinical. This cream feels like quality paper.

2. **`#191919` vs `#000000`** - Pure black is harsh. This near-black is softer on eyes while maintaining excellent contrast.

3. **Accent Color Strategy** - Light mode uses warm coral (energetic, approachable). Dark mode uses cool purple (sophisticated, calm). They're temperature opposites that both work with their respective backgrounds.

### Lava Lamp Colors

**Light Mode Lava:**

```css
background: radial-gradient(
  circle at 42% 42%,    /* Off-center highlight for 3D effect */
  #ff706a,              /* Core - bright coral */
  #ff9182 40%,          /* Middle - lighter coral/peach */
  #ffa38a 70%           /* Edge - peachy/salmon */
);
box-shadow: 0 0 20px rgba(255, 112, 106, 0.8); /* Glow effect */
```

**Dark Mode Lava:**

```css
background: radial-gradient(
  circle at 42% 42%,
  #4a4583,              /* Core - deep purple */
  #5952a7 40%,          /* Middle - medium purple */
  #665eb6 70%           /* Edge - lighter purple/violet */
);
box-shadow: 0 0 20px rgba(74, 69, 131, 0.8);
```

### Selection Color

```css
::selection {
  background-color: var(--color);  /* Accent color background */
  color: #fffbee;                  /* Always cream text, even in dark mode */
}
```

### Scrollbar Styling

```css
scrollbar-color: rgba(var(--text-rgb), .7) transparent;

::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(var(--text-rgb), .7);  /* 70% opacity text color */
}
```

---

## 3. Typography System

### Font Stack

```css
font-family: 'Plus Jakarta Sans', system-ui, Helvetica, Arial, sans-serif;
```

**Plus Jakarta Sans** - A geometric sans-serif designed by Gumpita Rahayu. Key characteristics:

- Open apertures for excellent legibility
- Geometric but warm (not cold like Futura)
- Variable font with weights 200-800
- Slightly rounded terminals add friendliness
- Modern without being trendy

### Font Rendering Optimization

```css
font-synthesis: none;              /* Prevent fake bold/italic */
text-rendering: optimizeLegibility; /* Better kerning/ligatures */
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

### Complete Type Scale

| Element | Size | Weight | Additional Styles |
|---------|------|--------|-------------------|
| h1 | `2.5rem` (40px) | 600 | `margin: .5rem 0` |
| h1.error-number | `14rem` (224px) | 600 | 404 page only |
| h1.top-heading | `2.5rem` | 600 | Animated entry |
| h2 | `1.5rem` (24px) | 600 | `white-space: nowrap`, `margin: .5rem 0` |
| .text-large | `1.5rem` (24px) | 600 | - |
| .text-medium / p | `1.2rem` (19.2px) | 600 | `margin: 0` |
| .text-small | `1rem` (16px) | 600 | Labels, captions |
| .navlink-text | `3.5rem` (56px) | 600 | Navigation menu |

### Responsive Typography

```css
/* At 800px breakpoint */
@media screen and (max-width: 800px) {
  .text-medium, p { font-size: 1.1rem; }  /* 17.6px */
  .text-large { font-size: 1.2rem; }      /* 19.2px */
}

/* At 480px breakpoint */
@media screen and (max-width: 480px) {
  .navlink-text { font-size: 2.5rem; }    /* 40px - down from 56px */
}
```

### Weight Philosophy

**Everything is weight 600 (Semi-Bold)**. No light text, no extra bold. This creates:

- Visual consistency
- Strong presence without heaviness
- Excellent legibility at all sizes
- Simplified design system

---

## 4. CSS Custom Properties (Variables)

### Timing Variables

```css
--transition-theme: .4s;    /* Theme color transitions */
--transition-mouse: .2s;    /* Hover/interaction feedback */
--transition-length: .5s;   /* Standard animations */
--transition-long: .8s;     /* Dramatic entrance animations */
```

### Lava Filter Variables

```css
--default-lava-filter: opacity(100%) saturate(1);
--group-1-filter: var(--default-lava-filter);
--group-2-filter: var(--default-lava-filter);
--lava-droplet-filter: var(--default-lava-filter);
--lava-filter-transition: filter .3s cubic-bezier(.6, 0, 0, 1.8);
```

### Shadow Variables

```css
/* Light Mode */
--shadow-small: 0 2px 8px rgba(0, 0, 0, .2);
--shadow-large: 0 0 30px rgba(0, 0, 0, .2);

/* Dark Mode */
--shadow-small: 0 2px 8px rgba(0, 0, 0, .7);
--shadow-large: 0 0 30px rgba(0, 0, 0, .7);
```

---

## 5. Animation System - Every Keyframe

### Core Animation Library

#### 1. blur-in / blur-out

```css
@keyframes blur-in {
  0% {
    opacity: 0;
    filter: blur(8px);
  }
  100% {
    opacity: 1;
    filter: blur(0px);
  }
}

@keyframes blur-out {
  0% {
    opacity: 1;
    filter: blur(0px);
  }
  100% {
    opacity: 0;
    filter: blur(8px);
  }
}
```

**Usage:** Page transitions, photo reveals, scroll text, email box, thanks wrapper
**Philosophy:** Elements don't just fade - they come into focus like a camera lens

#### 2. drop-in / drop-out

```css
@keyframes drop-in {
  0% { transform: translateY(-105%); }
  100% { transform: translateY(0); }
}

@keyframes drop-out {
  0% { transform: translateY(0); }
  100% { transform: translateY(105%); }
}
```

**Usage:** Headings, nav links, cards, form inputs, home links
**Philosophy:** Elements "fall" into place from above, exit by falling further

#### 3. scale-in-left / scale-out-left

```css
@keyframes scale-in-left {
  0% { transform: scale(0); }
  100% { transform: scale(1); }
}

@keyframes scale-out-left {
  0% { transform: scale(1); }
  100% { transform: scale(0); }
}
```

**Usage:** Heading dividers
**Applied with:** `transform-origin: bottom left`

#### 4. blob-breathe

```css
@keyframes blob-breathe {
  0%, 100% { transform: translate(-10px, -10px); }
  50% { transform: translate(10px, 10px); }
}
```

**Usage:** Main lava blob continuous animation
**Duration:** 8s infinite ease-in-out

#### 5. explode / explode-breathe / collapse (Lava Droplets)

```css
@keyframes explode {
  0% { transform: translate(0) rotate(0); }
  100% {
    transform: translate(var(--droplet-move-x), var(--droplet-move-y))
               rotate(var(--droplet-angle));
  }
}

@keyframes explode-breathe {
  0% {
    transform: translate(var(--droplet-move-x), var(--droplet-move-y))
               rotate(var(--droplet-angle));
  }
  35% {
    transform: translate(var(--droplet-flow-x), var(--droplet-flow-y))
               rotate(var(--droplet-angle));
  }
  100% {
    transform: translate(var(--droplet-move-x), var(--droplet-move-y))
               rotate(var(--droplet-angle));
  }
}

@keyframes collapse {
  0% {
    transform: translate(var(--droplet-midpoint-x), var(--droplet-midpoint-y))
               rotate(var(--droplet-angle));
    opacity: 1;
  }
  80% { opacity: 1; }
  100% {
    transform: translate(0) rotate(0);
    opacity: 0;
  }
}
```

**Usage:** Lava lamp droplet animations
**Philosophy:** Droplets explode outward, breathe/float, then collapse back

#### 6. x-scroll (Marquee)

```css
@keyframes x-scroll {
  0% { transform: translate(0); }
  100% { transform: translate(var(--scroll-text-x, 456px)); }
}
```

**Usage:** Scrolling roles text at bottom of home page
**Duration:** 14s linear infinite

#### 7. tooltip-fade-in

```css
@keyframes tooltip-fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
```

**Duration:** 0.1s (very fast)

#### 8. submit-button-slide-in / slide-out

```css
@keyframes submit-button-slide-in {
  0% { opacity: 0; transform: translate(800px); }
  100% { opacity: 1; transform: translate(0); }
}

@keyframes submit-button-slide-out {
  0% { opacity: 1; transform: translate(0); }
  100% { opacity: 0; transform: translate(800px); }
}
```

**Usage:** Contact page submit button
**Delay:** 0.8s on entrance

#### 9. back-button-slide-in / slide-out

```css
@keyframes back-button-slide-in {
  0% { opacity: 0; transform: translate(-170%, -50%); }
  100% { opacity: 1; transform: translateY(-50%); }
}

@keyframes back-button-slide-out {
  0% { opacity: 1; transform: translateY(-50%); }
  100% { opacity: 0; transform: translate(-170%, -50%); }
}
```

**Usage:** Work detail page back button
**Delay:** 1.2s on entrance

#### 10. header-img-fade-in / fade-out

```css
@keyframes header-img-fade-in {
  0% { opacity: 0; transform: translateY(-30%); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes header-img-fade-out {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-60%); }
}
```

**Usage:** Work detail hero images
**Delay:** 0.4s

#### 11. worksub-fade-in / fade-out

```css
@keyframes worksub-fade-in {
  0% { opacity: 0; transform: translateY(100px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes worksub-fade-out {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(100px); }
}
```

**Usage:** Work detail content sections

### Easing Functions Used

| Easing | Value | Usage |
|--------|-------|-------|
| Standard smooth | `cubic-bezier(.3, .9, .3, .9)` | Most animations - smooth with subtle settle |
| Spring/overshoot | `cubic-bezier(.25, .1, .25, 3.5)` | Button hover icons - bouncy feel |
| Dramatic | `cubic-bezier(.6, 0, 0, 1.8)` | Lava filter transitions |
| Hero entrance | `cubic-bezier(1, .2, .8, 0)` | Block letter name animation |
| Smooth decel | `cubic-bezier(.4, .1, .3, .9)` | Lava tail movements |
| ease-in-out | Default | Lava breathing |
| ease-in | Default | Quick exits |
| linear | Default | Marquee scroll |

### Animation Delay Patterns

**Staggered Card Entrance:**

```css
.card-container.index-0 { animation-delay: .5s; }
.card-container.index-1 { animation-delay: .6s; }
.card-container.index-2 { animation-delay: .7s; }
.card-container.index-3 { animation-delay: .8s; }
.card-container.index-4 { animation-delay: .9s; }
```

**Staggered Card Exit (Faster):**

```css
.card-container.leaving.index-0 { animation-delay: .1s; }
.card-container.leaving.index-1 { animation-delay: .15s; }
.card-container.leaving.index-2 { animation-delay: .2s; }
.card-container.leaving.index-3 { animation-delay: .25s; }
.card-container.leaving.index-4 { animation-delay: .3s; }
```

**Navigation Link Stagger:**

```css
/* Entering */
.navlink.visible.link-0 { animation-delay: .2s; }
.navlink.visible.link-1 { animation-delay: .3s; }
.navlink.visible.link-2 { animation-delay: .4s; }
.navlink.visible.link-3 { animation-delay: .5s; }

/* Exiting (faster) */
.navlink.link-0 { animation-delay: .1s; }
.navlink.link-1 { animation-delay: .15s; }
.navlink.link-2 { animation-delay: .2s; }
.navlink.link-3 { animation-delay: .25s; }
```

**Hero Name Letters:**

```css
#a1 { animation-delay: 0ms; }
#s1, #l1 { animation-delay: 75ms; }
#s2 { animation-delay: .1s; }
#o1, #t1 { animation-delay: .15s; }
#c1, #a2 { animation-delay: .2s; }
```

---

## 6. The Lava Lamp System - Deep Dive

### Core Structure

```
.lava-blur-wrapper (fixed, full viewport)
  └── .lava-wrapper (fixed, filtered)
        ├── .lava.blob (main blob)
        ├── .lava.tail (smaller following blob)
        └── .lava.droplet (multiple small blobs)
```

### SVG Filter (The Magic)

The melting/metaball effect comes from an SVG filter:

```css
.lava-wrapper {
  filter: url(#lava-meld);
}
```

This filter (defined in HTML) creates the liquid-merging effect when blobs overlap.

### Blur Wrapper

```css
.lava-blur-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  filter: blur(1px);  /* Subtle overall softness */
}
```

### Main Wrapper

```css
.lava-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  filter: url(#lava-meld);
  position: fixed;
  transform-origin: center;
  top: 0; left: 0; right: 0; bottom: 0;
  opacity: .9;
  transform: translate(0);
  transition: opacity var(--transition-length),
              transform .8s ease-in-out;
}
```

### Page-Specific Positioning

| Page | Transform | Effect |
|------|-----------|--------|
| Home | `translate(0)` | Centered |
| Work | `translate(25%, 10%)` | Right and slightly down |
| Work Detail | `translate(48%, -20%)` | Far right, up |
| About | `translateY(50%)` | Bottom half |
| Contact | `translate(-35%, 30%)` | Left and down |
| 404 | `translateY(50%)` | Bottom half |

### Main Blob

```css
.lava.blob {
  width: 260px;
  height: 260px;
  border-radius: 50%;
  z-index: 1;
  animation: blob-breathe 8s infinite ease-in-out;
  filter: var(--lava-droplet-filter);
  transition: opacity var(--transition-length),
              width var(--transition-length),
              height var(--transition-length),
              var(--lava-filter-transition);
  will-change: transform, opacity;
}
```

**Size by Page:**

| Page | Blob Size |
|------|-----------|
| Home | 260px |
| Work | 180px |
| Work Detail | 160px |
| Contact | 120px |

### Blob Gradient

```css
/* Light mode */
.lava {
  background: radial-gradient(
    circle at 42% 42%,     /* Off-center for 3D depth */
    #ff706a,               /* Bright core */
    #ff9182 40%,           /* Mid gradient */
    #ffa38a 70%            /* Soft edge */
  );
  box-shadow: 0 0 20px rgba(255, 112, 106, 0.8);  /* Glow */
}
```

The `42% 42%` position (not 50% 50%) creates an off-center highlight that simulates 3D lighting.

### Tail Element

```css
.lava.tail {
  position: absolute;
  z-index: 0;
  width: var(--tail-size, 182px);
  height: var(--tail-size, 182px);
  transform: translate(var(--tail-x), var(--tail-y));
  transition: width var(--transition-length) cubic-bezier(.4,.1,.3,.9),
              height var(--transition-length) cubic-bezier(.4,.1,.3,.9),
              transform var(--transition-length) cubic-bezier(.4,.1,.3,.9);
}
```

Uses CSS custom properties for dynamic positioning via JavaScript.

### Droplets

```css
.lava.droplet {
  position: absolute;
  opacity: 0;
  z-index: 0;
  filter: var(--lava-droplet-filter);
  transform: translate(0) rotate(0);
  transition: var(--lava-filter-transition);
}
```

**Hover States:**

```css
.lava.droplet.lava-hover {
  filter: opacity(40%) saturate(1.34);
}

.lava.droplet.lava-hover-contact {
  filter: opacity(50%) saturate(1.34);
}
```

### Apple/Safari Fallback

Safari has issues with certain SVG filters, so there's a fallback:

```css
.lava-blur-wrapper.apple {
  filter: blur(6px);  /* More blur to hide filter absence */
}

.lava-blur-wrapper.apple .lava-wrapper {
  filter: none;  /* Remove SVG filter */
}

.lava-blur-wrapper.apple .lava {
  /* Adjusted colors for softer look without filter */
  background: radial-gradient(
    circle at 42% 42%,
    #ff7a6a,
    #ff9182 40%,
    #ff9984 70%
  );
  box-shadow: 0 0 20px rgba(255, 112, 106, 0.4);  /* Less glow */
}
```

---

## 7. Component Catalog - Every UI Element

### 7.1 Theme Toggle Switch

```css
.switch-wrapper {
  position: relative;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  height: 34px;
  width: 64px;
  padding: 0 2px;
  border-radius: 20px;
  background-color: var(--glass-text);
  backdrop-filter: blur(2px);
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  cursor: pointer;
  transition: background-color var(--transition-theme);
}

.switch-wrapper svg {
  width: 20px;
  height: 20px;
  fill: var(--text);
}

.switch-handle {
  position: absolute;
  right: 3px;
  top: 3px;
  bottom: 3px;
  height: 28px;
  width: 28px;
  border-radius: 20px;
  background-color: var(--text);
  box-shadow: 0 0 12px 4px rgba(0, 0, 0, 0.3);
  transform: translate(0) scale(1);
  transition: background-color var(--transition-theme),
              transform var(--transition-mouse);
}

/* Hover - scale down */
.switch-wrapper:hover .switch-handle {
  transform: scale(.9);
}

/* Dark mode position */
[data-theme=dark] .switch-handle {
  transform: translate(-34px) scale(1);
}

[data-theme=dark] .switch-wrapper:hover .switch-handle {
  transform: translate(-34px) scale(.9);
}
```

**Key Details:**

- 64x34px pill shape
- Icons (sun/moon) visible behind handle
- Handle slides left/right based on theme
- Glassmorphism background
- Inner shadow for depth
- Scale shrinks handle on hover

### 7.2 Custom Cursor Follower

```css
.cursor-follower {
  width: 25px;
  height: 25px;
  border-radius: 50%;
  z-index: 20;
  position: fixed;
  pointer-events: none;
  background: var(--glass-text);
  transition: background-color .2s, width .1s, height .1s;
}

.cursor-follower.pointer {
  width: 50px;
  height: 50px;
  background: rgba(var(--text-rgb), .1);
}

.cursor-follower.clicked {
  width: 5px;
  height: 5px;
}

.cursor-follower.tooltip-visible {
  width: 0px;
  height: 0px;
  background-color: rgba(var(--text-rgb), 0);
}
```

**States:**

| State | Size | Background |
|-------|------|------------|
| Default | 25px | glass-text (20% opacity) |
| Pointer (hovering link) | 50px | 10% opacity (more subtle) |
| Clicked | 5px | Same |
| Tooltip visible | 0px | Transparent |

### 7.3 Link Underline Animation

```css
.a-wrapper {
  overflow: hidden;
  display: flex;
  align-items: center;
  position: relative;
  left: -4px;
}

a {
  color: var(--color);
  text-decoration: none;
  position: relative;
  padding: 0 4px;
  white-space: nowrap;
  cursor: pointer;
}

a:before {
  content: "";
  position: absolute;
  width: 100%;
  height: 33%;           /* Not full height - just underline */
  border-radius: 4px 0 4px 4px;  /* Asymmetric! */
  background-color: rgba(var(--color-rgb), .3);  /* 30% opacity accent */
  bottom: 10%;
  left: 0;
  transform-origin: right;
  transform: scaleX(0);
  transition: transform var(--transition-length);
}

a:hover:before,
a:focus:before {
  transform-origin: left;
  transform: scaleX(1);
}
```

**Animation Sequence:**

1. Default: scaleX(0), origin right
2. Hover: origin changes to left, scaleX(1) - slides in from left
3. Leave: origin stays left, scaleX(0) - slides out to right

### 7.4 Icon Links

```css
a.icon-link {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 38px;
  width: 38px;
  box-sizing: border-box;
}

a.icon-link:before {
  display: none;  /* No underline animation */
}

a.icon-link svg {
  fill: var(--text);
  height: 34px;
  width: 34px;
  transition: fill var(--transition-theme),
              transform var(--transition-mouse);
}

a.icon-link:hover svg {
  transform: scale(.9);  /* Shrink on hover */
}
```

### 7.5 Tooltips

```css
.tooltip {
  position: absolute;
  z-index: 20;
  top: 50%;
  left: 50%;
  opacity: 0;
  transform: translate(16px, 16px) scale(0);
  background-color: var(--text);
  padding: 6px 12px;
  border-radius: 20px;
  transform-origin: top left;
  box-shadow: var(--shadow-small);
  transition: opacity var(--transition-mouse),
              transform var(--transition-mouse),
              background-color var(--transition-theme),
              box-shadow var(--transition-theme);
}

.tooltip .text-medium {
  color: var(--bg);  /* Inverted text color */
}

.tooltip.active {
  opacity: 1;
  transform: translate(16px, 16px) scale(1);
}

/* Image tooltips (project previews) */
.tooltip.image {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 6px;
}

.tooltip.image img {
  width: 300px;
  border-radius: 16px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
}

.tooltip.image span {
  min-width: 180px;
}

/* Resume tooltip - smaller */
.tooltip.image.resume {
  padding: 0;
  background-color: transparent;
  border-radius: 4px;
}

.tooltip.image.resume img {
  width: 60px;
  border-radius: 4px;
  box-shadow: none;
}
```

### 7.6 Loading Screen

```css
.loading-screen {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: var(--bg);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  z-index: 21;  /* Above everything */
}

.load-logo-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .2rem;
}

svg.load-logo {
  width: 32px;
  fill: var(--text);
}

.progress-bar {
  width: 200px;
  height: 6px;
  border-radius: 2px 0 2px 2px;  /* Asymmetric */
  background-color: var(--glass-text);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--color);
  transition: width .5s;
}
```

### 7.7 Hamburger Menu Icon

Four circles that animate on hover and when open:

```css
.menusvg-container {
  width: 48px;
  height: 48px;
  display: inline-block;
  overflow: hidden;
  cursor: pointer;
}

.circle {
  fill: var(--text);
  transition: fill var(--transition-theme),
              transform var(--transition-length) cubic-bezier(.3,.9,.3,.9);
}

.menusvg-container .top-left,
.menusvg-container .top-right,
.menusvg-container .bottom-right,
.menusvg-container .bottom-left {
  transform-origin: center;
  transform: translate(0);
}

/* Staggered delays */
.menusvg-container .bottom-left { transition-delay: 0ms; }
.menusvg-container .top-left { transition-delay: 25ms; }
.menusvg-container .top-right { transition-delay: 50ms; }
.menusvg-container .bottom-right { transition-delay: 75ms; }

/* Hover - circles move toward center */
.menusvg-container:hover .top-left { transform: translate(42%, 42%); }
.menusvg-container:hover .top-right { transform: translate(-42%, 42%); }
.menusvg-container:hover .bottom-right { transform: translate(-42%, -42%); }
.menusvg-container:hover .bottom-left { transform: translate(42%, -42%); }

/* Open state - tighter and smaller */
.menusvg-container.open .top-left { transform: translate(36%, 36%) scale(.6); }
.menusvg-container.open .top-right { transform: translate(-36%, 36%) scale(.6); }
.menusvg-container.open .bottom-right { transform: translate(-36%, -36%) scale(.6); }
.menusvg-container.open .bottom-left { transform: translate(36%, -36%) scale(.6); }
```

### 7.8 Work Cards

```css
.card-container {
  height: 90px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  pointer-events: auto;
  border-bottom: 2px solid var(--text);
  transform: translateY(-105%);
  animation: drop-in var(--transition-length) cubic-bezier(.3,.9,.3,.9) forwards;
  transition: border-color var(--transition-theme);
}

.project-card-title {
  display: flex;
  align-items: center;
  gap: .5rem;
  transform: translate(-30px);  /* Hidden arrow */
  margin-right: -30px;
  transition: transform var(--transition-mouse);
}

/* Hover - reveal arrow */
.card-container:hover .project-card-title {
  transform: translate(0);
}

.project-card-title svg {
  height: 60px;
  fill: var(--text);
}

/* Title scales up on hover */
.card-container .project-card-title h2 {
  transform-origin: left;
  transition: transform var(--transition-length);
}

.card-container:hover .project-card-title h2 {
  transform: scale(1.3);
}

/* Right text shifts left */
.card-container span.text-medium {
  white-space: nowrap;
  transform-origin: right;
  transition: transform var(--transition-mouse);
}

.card-container:hover span.text-medium {
  transform: translate(-10px);
}
```

### 7.9 Form Inputs

```css
.input-wrapper {
  overflow: hidden;
  position: relative;
  padding: 2px 17px 2px 2px;
}

.input-item {
  display: flex;
  flex-direction: column;
  transform: translateY(-105%);
  animation: drop-in var(--transition-length) cubic-bezier(.3,.9,.3,.9) forwards;
}

label.text-small {
  margin: .25rem 0 0 .5rem;
  position: absolute;
  z-index: 3;
  transform: translate(0);
  color: rgba(var(--bg-rgb), .5);
  transition: color var(--transition-theme),
              transform var(--transition-mouse) cubic-bezier(.3,.9,.3,.9);
}

.input-item input,
.input-item textarea {
  border: none;
  background-color: var(--text);  /* Inverted colors */
  caret-color: var(--bg);
  color: var(--bg);
  transition: background-color var(--transition-theme),
              transform var(--transition-mouse) cubic-bezier(.3,.9,.3,.9);
}

.input-item input {
  width: 70%;
  height: 42px;
  border-radius: 0 22px 22px;  /* Flat top-left corner */
  padding: 1rem 1rem 0;
}

.input-item textarea {
  width: 100%;
  min-width: 300px;
  min-height: 130px;
  border-radius: 0 22px;  /* Different asymmetry */
  padding: 1.5rem 1rem .5rem;
  resize: none;
  overflow: hidden;
}

/* Hover/focus - shift right */
input:hover,
input:focus,
textarea:hover,
textarea:focus,
input:hover + label,
input:focus + label,
textarea:hover + label,
textarea:focus + label {
  transform: translate(15px);
}

/* Focus outline */
input:focus,
textarea:focus {
  outline: 2px solid var(--color);
  box-shadow: none !important;
}

/* Autofill handling */
input:-webkit-autofill {
  color: var(--bg) !important;
  -webkit-text-fill-color: var(--bg) !important;
  box-shadow: 0 0 0 100px var(--text) inset !important;
}
```

### 7.10 Submit Button

```css
.submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  z-index: 17;
  width: 120px;
  height: 120px;
  border-radius: 64px;
  border: none;
  box-shadow: var(--shadow-small);
  background-color: var(--text);
  cursor: pointer;
  opacity: 0;
  transform: translate(800px);
  animation: submit-button-slide-in var(--transition-long) .8s forwards;
  transition: background-color var(--transition-theme),
              box-shadow var(--transition-theme);
}

.submit-button svg {
  width: 64px;
  height: 64px;
  transform: rotate(171deg);  /* Almost pointing right */
  fill: var(--bg);
  transition: transform var(--transition-mouse) cubic-bezier(.25, .1, .25, 3.5);
}

/* Hover - snap to exactly right */
.submit-button:hover svg {
  transform: rotate(180deg);
}
```

The arrow rotates from 171° to 180° with overshoot easing - it "snaps" into position.

### 7.11 Back Button

```css
.back-button {
  position: fixed;
  left: 5%;
  top: 50%;
  width: 120px;
  height: 120px;
  border-radius: 64px;
  background-color: var(--text);
  box-shadow: var(--shadow-small);
  cursor: pointer;
  transform: translate(-170%, -50%);
  opacity: 0;
  animation: back-button-slide-in var(--transition-long) 1.2s forwards;
}

.back-button svg {
  width: 64px;
  height: 64px;
  transform: rotate(9deg);  /* Almost pointing left */
  fill: var(--bg);
  transition: transform var(--transition-mouse) cubic-bezier(.25, .1, .25, 3.5);
}

.back-button:hover svg {
  transform: rotate(0);  /* Snaps to exact left */
}
```

### 7.12 Round Labels (Tags)

```css
.round-label {
  background-color: var(--text);
  padding: 6px 12px;
  border-radius: 20px;
  box-shadow: var(--shadow-small);
  color: var(--bg);
  flex-shrink: 0;
  min-width: 60px;
  align-self: flex-start;
  text-align: center;
  transition: background-color var(--transition-theme),
              color var(--transition-theme),
              box-shadow var(--transition-theme);
}
```

### 7.13 Awwwards Badge

```css
#awwwards {
  position: fixed;
  z-index: 19;
  top: 50%;
  transform: translateY(-50%);
  right: 0;
  transition: transform var(--transition-length) cubic-bezier(.3,.9,.3,.9) 1.2s;
}

#awwwards.leaving {
  transform: translate(60px, -50%);
  transition-delay: 0ms;
}

#awwwards a {
  padding: 0;
  display: flex;
  height: 171px;
  width: 53px;
  background-color: var(--text);
}

#awwwards a:before {
  content: "";
  display: none;  /* No underline effect */
}

.awwwards-text {
  fill: var(--bg);
}
```

---

## 8. Spacing & Layout System

### Global Container

```css
.app-wrapper {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 100vh;
  min-height: 100dvh;  /* Dynamic viewport height for mobile */
}

.page-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-grow: 1;
  position: relative;
  width: 100%;
  padding: 60px 10%;
  box-sizing: border-box;
  max-width: 2200px;
  margin: 0 auto;
}
```

### Page-Specific Wrappers

```css
.page-wrapper.home {
  align-items: center;
  z-index: 3;
  padding: 0;
  max-width: 100%;
}

.page-wrapper.worksub {
  padding: 60px 20%;  /* More padding for detail pages */
}
```

### Navbar Layout

```css
#navbar-wrapper {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 80px;
  padding: 0 5%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 19;
  max-width: 2200px;
  margin: 0 auto;
}

.navbar-side {
  display: flex;
  align-items: center;
  gap: .5rem;
}
```

### Gap Patterns

| Context | Gap Value |
|---------|-----------|
| Navbar items | 0.5rem |
| Content sections | 1rem |
| Work info sections | 2rem |
| Social icons | 2rem (1.5rem mobile) |
| Form inputs | 1rem |
| Name letters | 1rem (0.4rem mobile) |

---

## 9. Responsive Breakpoints - All Behaviors

### Breakpoint: 1400px

```css
@media screen and (max-width: 1400px) {
  /* Layout */
  .page-wrapper,
  .page-wrapper.worksub {
    padding: 120px 10% 80px;  /* More top padding for fixed navbar */
  }

  /* Navbar gets glassmorphism */
  #navbar-wrapper {
    backdrop-filter: blur(8px);
    background-color: rgba(var(--bg-rgb), .5);
  }

  /* Lava */
  .lava-wrapper { opacity: .8; }
  .lava-wrapper.work { transform: translate(30%, 10%); }

  /* About */
  .about-photo-wrapper { width: 30%; min-width: 300px; }
  .about-info .p-wrapper { width: 100%; }

  /* Work */
  .work-half-wrapper { width: 70%; }

  /* Contact */
  .contact-left { width: 60%; }

  /* Back button hidden */
  .back-button { display: none; }

  /* Awwwards */
  #awwwards { top: 30%; }
}
```

### Breakpoint: 1100px

```css
@media screen and (max-width: 1100px) {
  .contact-left { width: 70%; }

  /* Submit button becomes pill with text */
  .submit-button {
    gap: .5rem;
    padding: 1rem;
    width: auto;
    height: 60px;
    border-radius: 30px;
  }
  .submit-button span { display: inline-block; }
  .submit-button svg { width: 32px; height: 32px; }
}
```

### Breakpoint: 800px

```css
@media screen and (max-width: 800px) {
  /* Shadows */
  :root { --shadow-large: 0 0 20px rgba(0, 0, 0, .2); }
  [data-theme=dark] { --shadow-large: 0 0 20px rgba(0, 0, 0, .7); }

  /* Typography */
  .text-medium, p { font-size: 1.1rem; }
  .text-large { font-size: 1.2rem; }
  .card-container span.text-medium { font-size: 1rem; }
  h1.error-number { font-size: 8rem; }

  /* Layout */
  .page-wrapper.worksub { padding: 120px 5% 80px; }
  .work-half-wrapper { width: 100%; }

  /* Navigation */
  .navmenu { width: 70%; }
  .social-icons-wrapper { gap: 1.5rem; }

  /* Home */
  svg.block-letter { width: 100px; }
  .name-wrapper { gap: .6rem; }

  /* Lava */
  .lava.blob { width: 200px; height: 200px; }
  .lava-wrapper.work { transform: translate(35%, 20%); }
  .lava-wrapper.work .lava.blob { width: 120px; height: 120px; }
  .lava-wrapper.worksub { transform: translate(55%, -25%); opacity: .7; }
  .lava-wrapper.worksub .lava.blob { width: 100px; height: 100px; }
  .lava.blob.clone { width: 60px; height: 60px; top: 110%; left: -65%; }
  .lava.droplet.clone { top: 112%; left: -62%; }
  .lava-wrapper.contact { transform: translate(35%); }
  .lava-wrapper.about { transform: translateY(56%); }

  /* About */
  .about-content { flex-direction: column; }
  .about-photo-wrapper { width: 280px; }

  /* Contact */
  .contact-wrapper { flex-direction: column; gap: 1rem; align-items: flex-start; }
  .contact-left { width: 100%; }
  .contact-right, .email-box { flex-direction: row; align-items: center; }

  /* No shift on input focus */
  input:hover, input:focus, textarea:hover, textarea:focus,
  input:hover + label, input:focus + label,
  textarea:hover + label, textarea:focus + label {
    transform: translate(0);
  }

  /* Work detail */
  .worksub-info { margin: 1.5rem 0; gap: 1.5rem; }
  .worksub-info section { gap: 1.5rem; }
  .worksub-info figure { gap: 1.5rem; }
  .intro-content { gap: 1.5rem; flex-direction: column-reverse; align-items: flex-start; }
  .intro-left { gap: .5rem; }
  .intro-left-list { padding-top: 6px; }
  .double-img-wrapper { gap: 1rem; }

  /* Awwwards */
  #awwwards, #awwwards.leaving {
    top: 50%;
    pointer-events: none;
    transform: translate(60px, -50%);
  }
  #awwwards.visible {
    pointer-events: auto;
    transform: translateY(-50%);
    transition-delay: 1.2s;
  }
}
```

### Breakpoint: 600px

```css
@media screen and (max-width: 600px) {
  svg.block-letter { width: 80px; }
}
```

### Breakpoint: 480px

```css
@media screen and (max-width: 480px) {
  /* Shadows collapse */
  :root { --shadow-large: var(--shadow-small); }

  /* Layout */
  .page-wrapper, .page-wrapper.worksub { padding: 120px 1rem 80px; }
  html, body { height: 100%; overflow: hidden; }
  #root { height: 100%; }

  /* Navigation */
  .navmenu { width: 80%; gap: 1.5rem; }
  .nav-footer { right: 0; left: 0; flex-direction: column; align-items: center; }
  .navlink-text { font-size: 2.5rem; }
  .navlink svg { height: 2.2rem; top: 2px; }

  /* Home */
  svg.block-letter { width: 64px; }
  .name-wrapper { gap: .4rem; }

  /* Work cards */
  .project-card-title svg { height: 50px; }
  .card-container:hover .project-card-title h2 { transform: scale(1.1); }  /* Less scale */
  .card-container:hover span.text-medium { transform: none; }  /* No shift */

  /* Work detail */
  .worksub-info figure { gap: 1rem; }
  .section-heading-wrapper svg { margin: 2px .5rem 0; }
  figure img.app-icon { max-width: 160px; }
}
```

---

## 10. Micro-Interactions Catalog

### 1. Link Hover - Sliding Underline

- Underline slides in from left on hover
- Slides out to right on leave
- 30% opacity accent color
- Asymmetric border-radius (4px 0 4px 4px)

### 2. Icon Shrink

- All icon buttons scale to 0.9 on hover
- Fast transition (0.2s)

### 3. Theme Toggle Handle

- Slides left/right based on theme
- Scales to 0.9 on hover

### 4. Hamburger Menu Circles

- Four circles move toward center on hover (42% translation)
- When open: tighter (36%) and smaller (scale 0.6)
- Staggered delays: 0ms, 25ms, 50ms, 75ms

### 5. Work Card Hover

- Arrow icon reveals (shifts from -30px to 0)
- Title scales up 1.3x
- Right text shifts 10px left
- All with different timings for depth

### 6. Form Input Focus

- Input + label shift 15px right together
- Shows they're connected

### 7. Submit Button Arrow

- Rotates from 171° to 180° on hover
- Spring easing with overshoot

### 8. Back Button Arrow

- Rotates from 9° to 0° on hover
- Same spring easing

### 9. Navigation Links

- Current page is blurred (2px) and 50% opacity
- Hovering current page blurs more (4px)
- Has underline animation like regular links

### 10. Logo Hover

- Scales to 0.9

### 11. Cursor States

- Default: 25px circle
- Interactive: 50px, more transparent
- Clicked: 5px (shrinks on click)
- Tooltip: 0px (disappears)

### 12. About Photo

- Has a hidden clickable area over the "hello" gesture
- Position: top 41%, left 61%, right 27%, bottom 18%

### 13. Dark Mode Photo Filter

```css
[data-theme=dark] .about-photo-wrapper img {
  filter: drop-shadow(var(--shadow-large))
          hue-rotate(-125deg)
          brightness(.8);
}
```

The photo color-shifts in dark mode to match the theme!

---

## 11. Shadow System

### Light Mode

```css
--shadow-small: 0 2px 8px rgba(0, 0, 0, .2);
--shadow-large: 0 0 30px rgba(0, 0, 0, .2);
```

### Dark Mode

```css
--shadow-small: 0 2px 8px rgba(0, 0, 0, .7);
--shadow-large: 0 0 30px rgba(0, 0, 0, .7);
```

### Shadow Usage

| Element | Shadow |
|---------|--------|
| Theme toggle handle | `0 0 12px 4px rgba(0,0,0,.3)` |
| Theme toggle (inset) | `inset 0 0 5px rgba(0,0,0,.3)` |
| Tooltips | `--shadow-small` |
| Round labels | `--shadow-small` |
| Submit/back buttons | `--shadow-small` |
| Hero images | `--shadow-large` |
| About photo | `drop-shadow(--shadow-large)` |
| Tooltip images | `0 0 10px rgba(0,0,0,.2)` |

### Responsive Shadow Changes

```css
/* 800px */
--shadow-large: 0 0 20px rgba(0, 0, 0, .2);  /* Smaller spread */

/* 480px */
--shadow-large: var(--shadow-small);  /* Collapse to small */
```

---

## 12. Glassmorphism Implementation

### Theme Toggle

```css
.switch-wrapper {
  background-color: var(--glass-text);  /* 20-30% opacity */
  backdrop-filter: blur(2px);
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
}
```

### Navigation Overlay

```css
#navmenu-wrapper {
  background-color: rgba(var(--bg-rgb), .7);
  backdrop-filter: blur(0px);  /* Default */
  opacity: 0;
  pointer-events: none;
}

#navmenu-wrapper.visible {
  opacity: 1;
  pointer-events: auto;
  backdrop-filter: blur(8px);  /* When open */
}
```

### Navbar (Responsive)

```css
@media screen and (max-width: 1400px) {
  #navbar-wrapper {
    backdrop-filter: blur(8px);
    background-color: rgba(var(--bg-rgb), .5);
  }
}
```

---

## 13. Focus States & Accessibility

### Global Focus Style

```css
*:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px inset var(--color) !important;
}
```

Uses `inset` box-shadow with accent color - visible on all elements without disrupting layout.

### Input Focus

```css
input:focus,
textarea:focus,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--color);
  box-shadow: none !important;
}
```

### Keyboard Navigation Support

- All interactive elements have `:focus-visible` states
- Navigation links, buttons, inputs all keyboard accessible
- Theme toggle responds to focus

### Color-Scheme Support

```css
:root {
  color-scheme: light dark;
}
```

Tells browser both schemes are supported.

---

## 14. Page-by-Page Design Analysis

### Home Page

**Layout:** Centered content, full viewport

**Elements:**

- Name as SVG block letters (staggered animation)
- Navigation links below name
- Scrolling roles marquee at bottom
- Full lava lamp visibility

**Unique CSS:**

```css
.page-wrapper.home {
  align-items: center;
  z-index: 3;
  padding: 0;
  max-width: 100%;
}

.name-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  overflow: hidden;
}

svg.block-letter {
  width: 140px;
  fill: var(--text);
  will-change: transform;
  transform: translateY(-105%);
  animation: drop-in .8s cubic-bezier(1, .2, .8, 0) forwards;
}

.scroll-roles {
  position: absolute;
  bottom: 5%;
  left: 0; right: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
  opacity: 0;
  animation: blur-in var(--transition-length) 1.5s forwards;
}

.scroll-text {
  display: flex;
  align-items: center;
  white-space: nowrap;
  animation: x-scroll 14s linear infinite;
}

.bullet {
  width: 10px;
  height: 6px;
  border-radius: 3px 0 3px 3px;  /* Asymmetric */
  background-color: var(--text);
  margin: 2px .8rem 0;
}
```

### Work Page

**Layout:** 50% width card list (70% at 1400px, 100% at 800px)

**Elements:**

- Page heading with animated divider
- Project cards with hover tooltips showing previews
- Lava shifted right

**Card Animation Sequence:**

1. Cards drop in sequentially (100ms apart)
2. Hover reveals arrow + scales title
3. Image tooltip appears at cursor

### Work Detail Page

**Layout:** 60% centered content (wider header image)

**Structure:**

```
.worksub-header
  └── figure (aspect-ratio: 12/7)
        └── img (border-radius: 40px 40px 4px 4px)

.worksub-intro
  └── .intro-content
        ├── .intro-left (metadata with round labels)
        └── p (description, 60% width)

.worksub-divider

.worksub-info
  └── section (multiple)
        ├── .section-heading-wrapper (icon + h2)
        └── figure (images)
```

**Image Types:**

```css
figure img.phone-screen { max-width: 300px; }
figure img.mobile-page { max-width: 300px; border-radius: 4px; }
figure img.app-icon { max-width: 220px; margin: 0 auto; }
figure img.medium-image { max-width: 640px; margin: 0 auto; }
```

### About Page

**Layout:** Two-column (text left, photo right)

**Unique Features:**

- Photo has asymmetric border-radius (60px 0 60px 60px)
- Hidden clickable "hello" area on photo
- Photo color-shifts in dark mode with hue-rotate

```css
.about-photo-wrapper img {
  border-radius: 60px 0 60px 60px;
  filter: drop-shadow(var(--shadow-large));
}

.about-photo-hello {
  border-radius: 20px;
  cursor: pointer;
  position: absolute;
  top: 41%; left: 61%; right: 27%; bottom: 18%;
  z-index: 4;
}

[data-theme=dark] .about-photo-wrapper img {
  filter: drop-shadow(var(--shadow-large))
          hue-rotate(-125deg)
          brightness(.8);
}
```

### Contact Page

**Layout:** Split - form left (50%), CTA right

**Form Features:**

- Inverted color inputs (dark bg, light text)
- Asymmetric border-radius on inputs
- Input + label shift together on focus
- Large circular submit button slides in from right

**Thank You State:**

```css
.thanks-wrapper {
  position: absolute;
  max-width: 520px;
  padding: 1rem;
  text-align: center;
  margin: 0 auto;
  opacity: 1;
  filter: blur(0);
}

.thanks-wrapper.leaving {
  opacity: 0;
  filter: blur(8px);
}

.hidden {
  opacity: 0;
  pointer-events: none;
  filter: blur(8px);
}
```

### 404 Page

**Layout:** Centered with giant number

**Elements:**

- Huge "404" text (14rem, 8rem mobile)
- Error message below
- Lava at bottom (same as About)

```css
h1.error-number {
  font-size: 14rem;
}

.not-found-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 600px;
}

.lava-wrapper.error404 {
  transform: translateY(50%);
}
```

---

## 15. Border Radius Philosophy

The site uses **asymmetric border-radius** throughout as a signature design element:

### The Pattern: `Xpx 0 Xpx Xpx`

Flat top-right corner, rounded everywhere else.

| Element | Border Radius |
|---------|---------------|
| Link underlines | `4px 0 4px 4px` |
| Navigation underlines | `6px 0 6px 6px` |
| Progress bar | `2px 0 2px 2px` |
| Heading divider | `2px 0 4px 2px` |
| Bullets (marquee) | `3px 0 3px 3px` |
| Text inputs | `0 22px 22px` (flat top-left) |
| Textarea | `0 22px` |
| Header images | `40px 40px 4px 4px` |
| About photo | `60px 0 60px 60px` |
| Tooltip images | `16px` (symmetric for images) |
| Round labels | `20px` (fully round) |
| Buttons | `64px` (fully round) |

### Why This Works

- Creates visual consistency without monotony
- The flat corner implies direction/flow
- Feels crafted, not generic
- Works at any size

---

## 16. Technical Implementation Notes

### Framework

- **React** - Renders to `#root` div
- **Vite** - Build tool (based on asset naming: `index-qQJ1z4wq.js`)

### Font Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200..800&display=swap" rel="stylesheet">
```

### Performance Optimizations

```css
will-change: transform, opacity;  /* On animated elements */
```

```html
<link rel="dns-prefetch" href="https://www.google-analytics.com">
<link rel="dns-prefetch" href="https://www.googletagmanager.com">
```

### Theme Implementation

Uses `data-theme` attribute on root:

```css
[data-theme=dark] { /* dark mode styles */ }
```

### Viewport Units

```css
min-height: 100vh;
min-height: 100dvh;  /* Dynamic viewport height for mobile */
```

### Security Headers

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://www.google-analytics.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' https://www.googletagmanager.com 'unsafe-inline';">
```

---

## 17. Design Patterns to Steal

### 1. Warm Neutrals Instead of Pure Black/White

- `#fffbee` instead of `#ffffff`
- `#191919` instead of `#000000`
- Creates sophisticated, inviting feel

### 2. Complementary Theme Accents

- Light mode: warm coral `#ff6663`
- Dark mode: cool purple `#8c82ff`
- Not just inverted - thoughtfully different

### 3. Asymmetric Border Radius

- `4px 0 4px 4px` pattern
- Creates signature look
- Apply consistently

### 4. Link Underline Animation

- Scale from right, expand to left on hover
- Change origin to left, collapse to right on leave
- 30% opacity, accent color

### 5. Staggered Animation Delays

- Entrance: 100ms apart, start at 500ms
- Exit: 50ms apart, start at 100ms (faster)
- Creates cascade effect

### 6. Spring Easing on Hover

- `cubic-bezier(.25, .1, .25, 3.5)` for overshoot
- Makes interactions feel alive

### 7. Blur Transitions

- Don't just fade - blur in/out
- 8px blur amount
- Creates depth and focus effect

### 8. Inverted Form Inputs

- Dark input on light background
- Surprising but very readable
- Sets forms apart from content

### 9. Custom Cursor with States

- Size changes indicate interactivity
- Shrinks on click for feedback
- Disappears when tooltip appears

### 10. Position-Aware Background Elements

- Lava lamp moves based on current page
- Content feels grounded in space
- Creates sense of navigation through a space

---

## File References

| File | Size | Contents |
|------|------|----------|
| `salcosta` | 5.8KB | HTML structure |
| `salcosta.css` | 35KB | Complete stylesheet |
| `salcosta.js` | 275KB | Bundled React app |
