# Module Dependencies

Last Updated: December 19, 2025

## Overview

The application uses a modular architecture where all modules extend `BaseModule` for consistent lifecycle management. Modules are organized by concern into subdirectories.

## Directory Structure

```text
src/modules/
├── core/
│   └── base.ts              # Foundation class for all modules
├── ui/
│   ├── navigation.ts        # Main navigation with submenu
│   ├── submenu.ts           # Dropdown submenu handler
│   ├── footer.ts            # Footer module
│   ├── contact-form.ts      # Contact form handling
│   ├── business-card-renderer.ts    # Card rendering
│   └── business-card-interactions.ts # Card flip/hover
├── animation/
│   ├── intro-animation.ts   # Desktop intro (GSAP MorphSVG)
│   ├── intro-animation-mobile.ts # Mobile intro fallback
│   ├── contact-animation.ts # Contact section animations
│   ├── text-animation.ts    # ScrollTrigger text effects
│   ├── infinite-scroll.ts   # Infinite scroll loop
│   └── scroll-snap.ts       # Section snap scrolling
└── utilities/
    └── theme.ts             # Dark/light theme toggle
```

## Dependency Graph

### Base Layer

All modules extend `BaseModule` from `core/base.ts`:

```text
BaseModule (core/base.ts)
    └── Extended by all 13 other modules
```

### External Service Dependencies

```text
appState (core/state.ts)
    ├── navigation.ts (subscribes to navOpen)
    └── theme.ts (subscribes to theme)

GSAP Library
    ├── intro-animation.ts
    ├── intro-animation-mobile.ts
    ├── business-card-interactions.ts
    ├── contact-animation.ts
    ├── text-animation.ts
    ├── infinite-scroll.ts
    ├── scroll-snap.ts
    └── navigation.ts

GSAP ScrollTrigger
    ├── contact-animation.ts
    ├── text-animation.ts
    ├── infinite-scroll.ts
    └── scroll-snap.ts

GSAP MorphSVGPlugin (premium)
    ├── intro-animation.ts
    └── intro-animation-mobile.ts

GSAP ScrollToPlugin
    └── scroll-snap.ts
```

### Service Injections

```text
RouterService
    └── navigation.ts

DataService
    └── navigation.ts

ContactService
    └── contact-form.ts
```

### Module Composition

```text
navigation.ts
    └── creates → submenu.ts (internal composition)

business-card-interactions.ts
    └── receives → BusinessCardRenderer instance (via constructor)
```

## Module Details

### Core

| Module | Purpose | Dependencies |
|--------|---------|--------------|
| `base.ts` | Abstract base class with lifecycle methods | types/modules |

### UI Modules

| Module | Purpose | Dependencies |
|--------|---------|--------------|
| `navigation.ts` | Header nav, mobile menu, portal dropdown | BaseModule, GSAP, appState, RouterService, DataService, SubmenuModule |
| `submenu.ts` | Dropdown submenu handler | BaseModule |
| `footer.ts` | Footer visibility/animations | BaseModule |
| `contact-form.ts` | Form validation & submission | BaseModule, ContactService, SanitizationUtils |
| `business-card-renderer.ts` | SVG card rendering | BaseModule |
| `business-card-interactions.ts` | Card flip/tilt effects | BaseModule, GSAP, BusinessCardRenderer |

### Animation Modules

| Module | Purpose | Dependencies |
|--------|---------|--------------|
| `intro-animation.ts` | Desktop paw morph intro | BaseModule, GSAP, MorphSVGPlugin, intro-animation-config |
| `intro-animation-mobile.ts` | Mobile card flip intro | BaseModule, GSAP, MorphSVGPlugin |
| `contact-animation.ts` | Contact section animations | BaseModule, GSAP, ScrollTrigger |
| `text-animation.ts` | Scroll-triggered text effects | BaseModule, GSAP, ScrollTrigger |
| `infinite-scroll.ts` | Loop scroll at bottom | BaseModule, ScrollTrigger |
| `scroll-snap.ts` | Section snap scrolling | BaseModule, GSAP, ScrollTrigger, ScrollToPlugin |

### Utility Modules

| Module | Purpose | Dependencies |
|--------|---------|--------------|
| `theme.ts` | Dark/light theme switching | BaseModule, appState |

## Platform-Specific Modules

Some modules have platform-specific behavior:

| Module | Desktop | Mobile |
|--------|---------|--------|
| `intro-animation.ts` | Full morph animation | Skipped (uses mobile version) |
| `intro-animation-mobile.ts` | Skipped | Card flip animation |
| `scroll-snap.ts` | Active | Disabled |
| `infinite-scroll.ts` | Active | Disabled |
| `contact-animation.ts` | Active | Skipped |

## Indirect Dependencies

Modules that affect each other indirectly:

1. **scroll-snap.ts ↔ infinite-scroll.ts**: Scroll snap checks for loop-trigger-zone to skip snapping
2. **text-animation.ts → scroll-snap.ts**: Text animations affect scroll events
3. **intro-animation.ts → intro-animation-mobile.ts**: Desktop determines when to use mobile fallback
4. **contact-animation.ts ↔ business-card-interactions.ts**: Both manage business cards in different sections

## Import Path Convention

After reorganization, import paths follow this pattern:

```typescript
// From a module in ui/ importing base
import { BaseModule } from '../core/base';

// From a module importing types
import type { ModuleOptions } from '../../types/modules';

// From a module importing services
import { SomeService } from '../../services/some-service';
```

## Adding New Modules

1. Determine the appropriate subdirectory (core, ui, animation, utilities)
2. Extend `BaseModule` from `../core/base`
3. Import types from `../../types/modules`
4. Register in `src/core/app.ts` with dynamic import
5. Update this documentation
