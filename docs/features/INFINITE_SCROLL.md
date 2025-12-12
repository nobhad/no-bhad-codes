# Infinite Scroll Module

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Configuration](#configuration)
4. [HTML Structure](#html-structure)
5. [CSS Requirements](#css-requirements)
6. [Integration with ScrollTrigger](#integration-with-scrolltrigger)
7. [API Reference](#api-reference)
8. [File Locations](#file-locations)

---

## Overview

The Infinite Scroll module creates a seamless looping scroll experience on the main site. When users scroll to the bottom, they transition back to the top with content appearing from below. When users scroll to the top (with spacer active), they transition back to the bottom.

**Key Features:**

- Bidirectional infinite loop (top ↔ bottom)
- Desktop only (disabled on mobile for better UX)
- Works with GSAP ScrollTrigger animations
- Uses spacer elements for seamless transitions
- Respects reduced motion preferences

**File:** `src/modules/infinite-scroll.ts`

**Last Updated:** December 2024

---

## How It Works

### Forward Loop (Bottom → Top)

1. User scrolls to the bottom of the page (within 50px of end)
2. Module activates the **top spacer** (adds 100vh before business card)
3. Scroll position jumps to top
4. User sees empty spacer, business card is 100vh below viewport
5. User scrolls down naturally, business card rises into view

### Reverse Loop (Top → Bottom)

1. User scrolls to the top while top spacer is active (within 50px)
2. Module deactivates top spacer, activates **bottom spacer**
3. Scroll position jumps to bottom
4. User sees empty spacer, contact section is 100vh above viewport
5. User scrolls up naturally, contact section descends into view

### Why Spacers?

Without spacers, jumping instantly from bottom to top would be jarring - the content would "snap" into place. Spacers create a buffer zone that makes the transition feel like continuous scrolling.

---

## Configuration

### Constructor Options

```typescript
interface InfiniteScrollOptions {
  /** Selector for the scroll container (default: 'main') */
  containerSelector?: string;
  /** Selector for the last section (default: '.contact-section') */
  lastSectionSelector?: string;
  /** Enable/disable infinite scroll (default: true) */
  enabled?: boolean;
}
```

### Example Usage

```typescript
import { InfiniteScrollModule } from './modules/infinite-scroll';

const infiniteScroll = new InfiniteScrollModule({
  containerSelector: 'main',
  lastSectionSelector: '.contact-section',
  enabled: true
});

await infiniteScroll.init();
```

---

## HTML Structure

The module requires specific HTML elements to function:

```html
<main>
  <!-- Top spacer - activated when looping from bottom to top -->
  <div id="loop-spacer" class="loop-spacer"></div>

  <!-- Main content sections -->
  <section class="business-card-section">...</section>
  <section class="about-section">...</section>
  <section class="contact-section">...</section>

  <!-- Bottom spacer - activated when looping from top to bottom -->
  <div id="loop-spacer-bottom" class="loop-spacer"></div>
</main>
```

### Required Elements

| Element ID | Purpose |
|------------|---------|
| `loop-spacer` | Top spacer, activated after forward loop |
| `loop-spacer-bottom` | Bottom spacer, activated after reverse loop |

---

## CSS Requirements

### Spacer Styles

```css
/* Loop spacer - invisible buffer for infinite scroll */
.loop-spacer {
  height: 0;
  overflow: hidden;
  transition: height 0s; /* Instant height change */
}

/* When activated, spacer takes full viewport height */
.loop-spacer.active {
  height: 100vh;
}
```

**Location:** `src/styles/base/layout.css`

---

## Integration with ScrollTrigger

The Infinite Scroll module is designed to work alongside GSAP ScrollTrigger animations (like TextAnimationModule). Key considerations:

### Refresh After Loop

After each loop transition, the module calls `ScrollTrigger.refresh()` to recalculate animation positions:

```typescript
setTimeout(() => {
  ScrollTrigger.refresh();
  this.isTransitioning = false;
}, 100);
```

### Avoiding Conflicts

1. **Debounced Triggers**: Module tracks `hasTriggeredLoop` to prevent multiple triggers
2. **Transition Lock**: `isTransitioning` flag prevents scroll handling during transitions
3. **Distance Threshold**: Loop only triggers within 50px of edge, resets at 200px

---

## API Reference

### Methods

| Method | Description |
|--------|-------------|
| `init()` | Initialize the module |
| `enable()` | Enable infinite scroll |
| `disable()` | Disable infinite scroll |
| `destroy()` | Clean up and remove event listeners |
| `getStatus()` | Get current module status |

### Status Object

```typescript
{
  name: 'InfiniteScrollModule',
  initialized: boolean,
  enabled: boolean,
  isTransitioning: boolean
}
```

### Events

The module uses scroll event listeners attached to the container element:

```typescript
this.container.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
```

---

## File Locations

| File | Purpose |
|------|---------|
| `src/modules/infinite-scroll.ts` | Module implementation |
| `src/core/app.ts` | Module registration in `mainSiteModules` |
| `src/styles/base/layout.css` | Spacer CSS styles |
| `index.html` | Spacer elements in DOM |

---

## Behavior by Device

| Device | Behavior |
|--------|----------|
| Desktop (>767px) | Full infinite scroll enabled |
| Mobile (≤767px) | Disabled - standard scroll |
| Reduced motion | Disabled |

---

## Debugging

The module logs scroll events and state changes when `debug: true`:

```typescript
const infiniteScroll = new InfiniteScrollModule({ debug: true });
```

**Console output:**

```
[InfiniteScrollModule] Scroll: distFromTop=500, distFromBottom=100, spacerActive=false
[InfiniteScrollModule] TRIGGERING LOOP: At bottom! distFromBottom=45
[InfiniteScrollModule] Top spacer activated
[InfiniteScrollModule] ScrollTrigger refreshed
```

---

## Related Documentation

- [Scroll Snap](./SCROLL_SNAP.md) - Section snapping behavior
- [CSS Architecture](../design/CSS_ARCHITECTURE.md) - Layout system
- [Animations](../design/ANIMATIONS.md) - GSAP integration patterns
