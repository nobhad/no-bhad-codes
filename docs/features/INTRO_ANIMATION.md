# Intro Animation - Coyote Paw

**Status:** Complete
**Last Updated:** December 19, 2025

## Overview

The intro animation displays a coyote paw holding a business card when users first visit the site. The animation uses GSAP MorphSVG to morph between different paw poses while the business card remains stationary and aligned.

## Table of Contents

1. [Design Concept](#design-concept)
2. [SVG Asset Structure](#svg-asset-structure)
3. [Technical Implementation](#technical-implementation)
4. [Animation Sequence](#animation-sequence)
5. [Files and Dependencies](#files-and-dependencies)
6. [Configuration](#configuration)
7. [Responsive Behavior](#responsive-behavior)
8. [Accessibility](#accessibility)
9. [Troubleshooting](#troubleshooting)

---

## Design Concept

### Visual Design

- A stylized coyote paw/arm holds a business card
- The paw morphs between different poses (fingers moving)
- The business card displays:
  - "HAVE BRAIN"
  - "WILL TRAVEL"
  - "Noelle Bhaduri"
  - "GENIUS"
- After the animation, the card flips to reveal the actual interactive business card

### User Experience

- **First Visit:** Full animation plays (approximately 5 seconds)
- **Return Visit (same session):** Animation skipped, card shown immediately
- **Skip Option:** Press `Enter` key to skip at any time
- **Reduced Motion:** Animation disabled for users who prefer reduced motion

---

## SVG Asset Structure

### File Location

```text
public/images/coyote_paw.svg
```

### SVG Specifications

| Property | Value |
|----------|-------|
| viewBox | `0 0 2316.99 1801.19` |
| Width | 2316.99 |
| Height | 1801.19 |

### CSS Classes

| Class | Fill | Stroke | Stroke Width | Usage |
|-------|------|--------|--------------|-------|
| `.cls-1` | `#fff` (white) | `#231f20` (dark) | 9px | Card outline |
| `.cls-2` | none | `#000` (black) | 5px | Paw paths, morph targets |
| `.cls-3` | `#231f20` (dark) | none | - | Card text |

### Layer Structure

```text
coyote_paw.svg
|
|-- _Arm_-_Align_Perfectly_with_Card_ (cls-2)
|   Base coyote arm shape
|
|-- Business_Card (group)
|   |-- _Card_Outline_ (cls-1)
|   |   White rectangle with dark stroke
|   |   Position: x=1250.15, y=1029.85
|   |   Size: 1062.34 x 591.3
|   |
|   |-- _Black_Filled_Text_ (cls-3)
|       |-- "WILL TRAVEL" text paths
|       |-- "HAVE BRAIN" text paths
|       |-- "Noelle Bhaduri" text paths
|       |-- "GENIUS" text paths
|
|-- _1_Morph_Above_Card_-_Fingers_ (cls-2)
|   Morph target 1 - finger positions above card
|
|-- _2_Morph_Above_Card_-_Fingers_ (cls-2)
|   Morph target 2 - finger positions above card
|
|-- _2_Morph_Behind_Card_-_Thumb_Filler_ (cls-2)
|   Thumb filler shape (renders behind card)
|
|-- _3_Morph_Behind_Card_-_Thumb_Palm_ (cls-2)
|   Thumb and palm shape (renders behind card)
|
|-- _3_Morph_Above_Card_-_Fingers_ (cls-2)
    Morph target 3 - finger positions above card
```

### Card Position Constants

```typescript
const SVG_CARD_X = 1250.15;      // Card X position
const SVG_CARD_Y = 1029.85;      // Card Y position
const SVG_CARD_WIDTH = 1062.34;  // Card width
const SVG_CARD_HEIGHT = 591.3;   // Card height
const SVG_VIEWBOX_WIDTH = 2316.99;
const SVG_VIEWBOX_HEIGHT = 1801.19;
```

---

## Technical Implementation

### Module Architecture

```text
src/modules/animation/intro-animation.ts
|
|-- IntroAnimationModule (extends BaseModule)
    |
    |-- Properties
    |   |-- timeline: gsap.core.Timeline
    |   |-- isComplete: boolean
    |   |-- skipHandler: KeyboardEvent handler
    |   |-- morphOverlay: HTMLElement
    |   |-- pawPaths: string[]
    |   |-- whiteFillPaths: string[]
    |   |-- svgColors: SvgStyleColors
    |
    |-- Methods
    |   |-- init(): Initialize and start animation
    |   |-- skipIntroImmediately(): Skip for returning visitors
    |   |-- handleKeyPress(): Handle Enter key skip
    |   |-- handleSkip(): Skip to end
    |   |-- runCardFlip(): Mobile card flip animation
    |   |-- runMorphAnimation(): Desktop morph animation
    |   |-- completeIntro(): Cleanup and finish
    |   |-- destroy(): Cleanup resources
```

### GSAP Plugins Required

```typescript
import { gsap } from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';

gsap.registerPlugin(MorphSVGPlugin);
```

### HTML Structure

```html
<!-- Intro Morph Animation Overlay -->
<div id="intro-morph-overlay" class="intro-morph-overlay">
  <svg id="intro-morph-svg" class="intro-morph-svg"
       viewBox="0 0 2316.99 1801.19"
       preserveAspectRatio="xMidYMid meet">
    <!-- Card group - content loaded dynamically from coyote_paw.svg -->
    <g id="morph-card-group" class="morph-card-group"></g>
    <!-- Paw path for morphing - path data loaded dynamically -->
    <path id="morph-paw" class="morph-paw" />
  </svg>
</div>
```

### CSS Styling

```css
/* File: src/styles/components/intro-morph.css */

.intro-morph-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background-color: var(--color-neutral-300);
}

.morph-paw {
  fill: #000;
  stroke: none;
  transform-origin: center center;
}
```

---

## Animation Sequence

### Desktop Animation (Morph)

```text
Timeline:
|
|-- 0.0s: Overlay visible, SVG loaded
|-- 0.5s: Paw fades in at position 1
|-- 1.5s: Morph to position 2 (fingers move)
|-- 2.5s: Morph to position 3 (fingers move)
|-- 3.5s: Hold final position
|-- 4.0s: Overlay fades out
|-- 4.5s: Header fades in
|-- 5.0s: Animation complete
```

### Mobile Animation (Card Flip)

```text
Timeline:
|
|-- 0.0s: Card showing back (rotated 180deg)
|-- 3.0s: Hold back of card visible
|-- 3.0s-5.0s: Card flips to front (rotateY 180deg -> 0deg)
|-- 5.0s: Header content fades in
|-- 5.5s: Animation complete
```

### Morph Animation Code

```typescript
// Create morph timeline
this.timeline = gsap.timeline({
  onComplete: () => this.completeIntro()
});

this.timeline
  .to({}, { duration: 0.5 }) // Initial pause
  .to('#morph-paw', {
    morphSVG: pawPath2,
    duration: 1.0,
    ease: 'power2.inOut'
  })
  .to('#morph-paw', {
    morphSVG: pawPath3,
    duration: 1.0,
    ease: 'power2.inOut'
  })
  .to('.intro-morph-overlay', {
    opacity: 0,
    duration: 0.5,
    ease: 'power2.out'
  });
```

---

## Files and Dependencies

### Source Files

| File | Purpose |
|------|---------|
| `src/modules/animation/intro-animation.ts` | Main animation module (refactored Dec 19, 2025) |
| `src/styles/components/intro-morph.css` | Overlay and morph styles |
| `public/images/coyote_paw.svg` | SVG asset with all paw variations |
| `index.html` | HTML structure for overlay |

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `gsap` | ^3.x | Animation engine |
| `gsap/MorphSVGPlugin` | ^3.x | SVG path morphing (Club GreenSock) |

### Import Chain

```typescript
// intro-animation.ts imports
import { BaseModule } from './base';
import { gsap } from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import type { ModuleOptions } from '../types/modules';
```

---

## Configuration

### Session Storage

```typescript
// Check if intro has been shown
const introShown = sessionStorage.getItem('introShown');

// Mark intro as shown
sessionStorage.setItem('introShown', 'true');
```

### CSS Classes on Document

| Class | When Applied | Purpose |
|-------|--------------|---------|
| `intro-loading` | Animation starting | Hide content, show overlay |
| `intro-complete` | Animation finished | Show content, hide overlay |
| `intro-finished` | After transition | Prevent future transitions |

### App State Integration

```typescript
// Update global state when intro completes
if (window.NBW_STATE) {
  window.NBW_STATE.setState({ introAnimating: false });
}
```

---

## Responsive Behavior

### Breakpoints

| Breakpoint | Animation Type | Overlay |
|------------|----------------|---------|
| Desktop (>767px) | Morph animation | Visible |
| Mobile (<=767px) | Card flip only | Hidden |
| Reduced Motion | Skip animation | Hidden |

### Mobile CSS

```css
@media screen and (max-width: 767px) {
  .intro-morph-overlay {
    display: none;
    opacity: 0;
    visibility: hidden;
  }
}
```

### Mobile JavaScript

```typescript
const isMobile = window.matchMedia('(max-width: 767px)').matches;
if (isMobile) {
  // Skip morph, use simple card flip
  this.runCardFlip();
} else {
  // Run full morph animation
  this.runMorphAnimation();
}
```

---

## Accessibility

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  .intro-morph-overlay {
    display: none;
    opacity: 0;
    visibility: hidden;
  }
}
```

```typescript
// JavaScript check
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

if (prefersReducedMotion) {
  this.skipIntroImmediately();
  return;
}
```

### Skip Functionality

- **Enter Key:** Skips animation instantly
- **Session Storage:** Skips on return visits within same session

```typescript
private handleKeyPress(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !this.isComplete) {
    this.handleSkip();
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. Animation Not Playing

**Symptoms:** Overlay shows but no animation

**Causes:**

- MorphSVGPlugin not registered
- SVG paths not loaded
- JavaScript error in timeline

**Solutions:**

```typescript
// Ensure plugin is registered
gsap.registerPlugin(MorphSVGPlugin);

// Check SVG loaded
console.log('Paw paths loaded:', this.pawPaths.length);
```

#### 2. Card Misaligned

**Symptoms:** Business card not aligned with paw

**Causes:**

- Wrong card position constants
- viewBox mismatch

**Solutions:**

```typescript
// Verify constants match SVG
// In coyote_paw.svg, find:
// <rect id="_Card_Outline_" x="1250.15" y="1029.85" ...

// Update constants if needed:
const SVG_CARD_X = 1250.15;
const SVG_CARD_Y = 1029.85;
```

#### 3. Morph Looks Wrong

**Symptoms:** Paths morph incorrectly or distort

**Causes:**

- Path point count mismatch
- Incompatible path structures

**Solutions:**

```typescript
// Use shapeIndex for better matching
gsap.to('#morph-paw', {
  morphSVG: {
    shape: targetPath,
    shapeIndex: 'auto'
  },
  duration: 1.0
});
```

#### 4. Animation Skipped Unexpectedly

**Symptoms:** Animation never plays

**Causes:**

- sessionStorage has `introShown: true`
- Reduced motion preference set

**Solutions:**

```typescript
// Clear session storage for testing
sessionStorage.removeItem('introShown');

// Check reduced motion
console.log('Prefers reduced motion:',
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
);
```

### Debug Mode

```typescript
// Enable debug logging in module
constructor(options: ModuleOptions = {}) {
  super('IntroAnimationModule', { debug: true, ...options });
}
```

---

## Related Documentation

- [Animations Guide](../design/ANIMATIONS.md) - General animation standards
- [CSS Architecture](../design/CSS_ARCHITECTURE.md) - CSS variables and structure
- [Business Card](./BUSINESS_CARD.md) - Business card component (if exists)

---

## Change Log

### December 19, 2025

- **Status: COMPLETE** - Animation feature fully implemented
- **Drop shadow added** - SVG `<feDropShadow>` filter applied to paw and card elements
  - Shadow scales dynamically with SVG transform for consistent sizing
  - Matches business card shadow style (`box-shadow: 0 10px 30px var(--color-shadow)`)
- **Module relocated** - Moved from `src/modules/intro-animation.ts` to `src/modules/animation/intro-animation.ts`
- **SVG paths externalized** - Hardcoded SVG paths extracted to `coyotePawConfig` object
- **Replay timing** - Animation replays after 20 minutes since last view (localStorage timestamp)
- **Header integration** - Header fades in after animation completes

### December 18, 2025

- **Mobile card flip** - Card flip fallback for mobile (no paw overlay)
- **Enter key skip** - Press Enter to skip animation at any time

### December 2024

- Switched from `intro_paw.svg` to `coyote_paw.svg`
- Updated card position constants for new SVG
- Updated viewBox dimensions: `2316.99 x 1801.19`
- Card position: `x=1250.15, y=1029.85, w=1062.34, h=591.3`
