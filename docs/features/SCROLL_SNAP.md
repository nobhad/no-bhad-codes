# Scroll Snap Module

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Configuration](#configuration)
4. [Viewport Calculations](#viewport-calculations)
5. [API Reference](#api-reference)
6. [Integration with Other Modules](#integration-with-other-modules)
7. [File Locations](#file-locations)

---

## Overview

The Scroll Snap module provides GSAP-powered section snapping for the main site. When users stop scrolling, the viewport smoothly animates to center the closest section. This creates a presentation-style experience where each section gets full focus.

**Key Features:**

- GSAP-powered smooth snapping (not CSS scroll-snap)
- Desktop only (disabled on mobile for free scrolling)
- Accounts for header/footer in viewport calculations
- Configurable snap delay, duration, and easing
- Works with both container and window scroll
- Respects reduced motion preferences

**File:** `src/modules/scroll-snap.ts`

**Last Updated:** December 20, 2025

---

## How It Works

### Snap Detection

1. User scrolls the page
2. Module clears any existing snap timeout
3. When scrolling stops, a configurable delay (default: 150ms) triggers
4. Module calculates which section is closest to viewport center
5. GSAP animates scroll to center that section

### Why GSAP Over CSS?

Per project guidelines (CLAUDE.md), GSAP is preferred over CSS for complex animations:

- **Better control**: Pause, reverse, speed control
- **Cross-browser consistency**: No vendor prefix issues
- **Easing options**: More curves than CSS transitions
- **Integration**: Works with ScrollTrigger for coordinated animations

---

## Configuration

### Constructor Options

```typescript
interface ScrollSnapOptions {
  /** Selector for the scroll container (default: 'main') */
  containerSelector?: string;
  /** Selector for sections to snap to */
  sectionSelector?: string;
  /** Duration of snap animation in seconds (default: 0.6) */
  snapDuration?: number;
  /** Easing function for snap animation (default: 'power2.inOut') */
  snapEase?: string;
  /** Delay before snapping after scroll stops in ms (default: 150) */
  snapDelay?: number;
}
```

### Default Section Selector

```typescript
sectionSelector: '.business-card-section, .about-section, .contact-section'
```

### Example Usage

```typescript
import { ScrollSnapModule } from './modules/animation/scroll-snap';

const scrollSnap = new ScrollSnapModule({
  containerSelector: 'main',
  sectionSelector: '.business-card-section, .about-section, .contact-section',
  snapDuration: 0.6,
  snapEase: 'power2.inOut',
  snapDelay: 150
});

await scrollSnap.init();
```

---

## Viewport Calculations

The module calculates the effective viewport area accounting for fixed header and footer.

### Layout Dimensions

Values are read from CSS variables:

```typescript
const rootStyles = window.getComputedStyle(document.documentElement);
this.headerHeight = parseInt(rootStyles.getPropertyValue('--header-height'), 10) || 60;
this.footerHeight = parseInt(rootStyles.getPropertyValue('--footer-height'), 10) || 40;
```

### Scroll Mode Detection

The module automatically detects whether to use container or window scroll:

| Condition | Scroll Target |
|-----------|---------------|
| Desktop (main is `position: fixed` with `overflow-y: auto`) | Container scroll |
| Mobile (main is `position: static`) | Window scroll |

```typescript
// Desktop = container scroll, Mobile = window scroll
this.useWindowScroll = !(isContainerFixed && hasOverflowScroll);
```

### Effective Viewport Height

```typescript
private getEffectiveViewportHeight(): number {
  if (this.useWindowScroll) {
    // Window scroll: subtract header only (footer scrolls with content)
    return window.innerHeight - this.headerHeight;
  }
  // Container scroll: use container height (already positioned between header/footer)
  return this.container.getBoundingClientRect().height;
}
```

### Viewport Center Y

```typescript
private getViewportCenterY(): number {
  const effectiveHeight = this.getEffectiveViewportHeight();
  if (this.useWindowScroll) {
    // Center relative to area below header
    return this.headerHeight + effectiveHeight / 2;
  }
  // Center of container
  return effectiveHeight / 2;
}
```

---

## API Reference

### Methods

| Method | Description |
|--------|-------------|
| `init()` | Initialize the module |
| `scrollToSection(index)` | Programmatically scroll to a section by index |
| `getCurrentSectionIndex()` | Get the index of the currently centered section |
| `destroy()` | Clean up and remove event listeners |
| `getStatus()` | Get current module status |

### scrollToSection(index)

Animate scroll to center a specific section:

```typescript
// Scroll to the first section (business card)
scrollSnap.scrollToSection(0);

// Scroll to the second section (about)
scrollSnap.scrollToSection(1);

// Scroll to the third section (contact)
scrollSnap.scrollToSection(2);
```

### getCurrentSectionIndex()

Get which section is currently closest to viewport center:

```typescript
const currentIndex = scrollSnap.getCurrentSectionIndex();
console.log(`Currently viewing section ${currentIndex}`);
```

### Status Object

```typescript
{
  name: 'ScrollSnapModule',
  initialized: boolean,
  sectionCount: number,
  currentSection: number,
  isSnapping: boolean
}
```

---

## Integration with Other Modules

### With Infinite Scroll

Both modules work together:

1. **Infinite Scroll** handles looping at boundaries
2. **Scroll Snap** handles centering sections during normal scroll
3. Both call `ScrollTrigger.refresh()` after layout changes

### With Text Animation

The module waits for intro animation to complete before calculating positions:

```typescript
private waitForIntroComplete(): void {
  // Observer watches for intro-complete class
  const observer = new MutationObserver((mutations) => {
    if (html.classList.contains('intro-complete')) {
      observer.disconnect();
      setTimeout(() => ScrollTrigger.refresh(), 200);
    }
  });
  observer.observe(html, { attributes: true });
}
```

### ScrollTrigger Integration

The module creates ScrollTrigger instances for each section to track enter/leave:

```typescript
this.sections.forEach((section, index) => {
  const trigger = ScrollTrigger.create({
    trigger: section,
    scroller: this.useWindowScroll ? undefined : this.container,
    start: 'top center',
    end: 'bottom center',
    onEnter: () => this.log(`Entered section ${index}`),
    onLeave: () => this.log(`Left section ${index}`)
  });
  this.scrollTriggers.push(trigger);
});
```

---

## File Locations

| File | Purpose |
|------|---------|
| `src/modules/scroll-snap.ts` | Module implementation |
| `src/core/app.ts` | Module registration in `mainSiteModules` |
| `src/styles/variables.css` | CSS variables for header/footer heights |

---

## Behavior by Device

| Device | Behavior |
|--------|----------|
| Desktop (>767px) | Snap enabled, uses container scroll |
| Mobile (≤767px) | Disabled - free scrolling |
| Reduced motion | Disabled |

---

## GSAP Dependencies

The module requires these GSAP plugins:

```typescript
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
```

---

## Debugging

The module logs state changes when `debug: true`:

```typescript
const scrollSnap = new ScrollSnapModule({ debug: true });
```

**Console output:**

```
[ScrollSnapModule] Layout dimensions: header=60px, footer=40px
[ScrollSnapModule] Found 3 sections for scroll snap
[ScrollSnapModule] Using container scroll (container position: fixed, overflow: auto)
[ScrollSnapModule] Entered section 1
[ScrollSnapModule] Snapping to section at scroll position 850
[ScrollSnapModule] Snap complete
```

---

## Related Documentation

- [Infinite Scroll](./INFINITE_SCROLL.md) - Boundary looping behavior
- [CSS Architecture](../design/CSS_ARCHITECTURE.md) - Layout variables
- [Animations](../design/ANIMATIONS.md) - GSAP usage guidelines
