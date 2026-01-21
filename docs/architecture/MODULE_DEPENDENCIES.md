# Module Dependencies

Last Updated: January 20, 2026

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
│   ├── page-transition.ts   # Virtual page transitions
│   ├── section-transitions.ts # Section reveal animations
│   └── text-animation.ts    # ScrollTrigger text effects
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
    ├── page-transition.ts
    ├── section-transitions.ts
    ├── text-animation.ts
    └── navigation.ts

GSAP ScrollTrigger
    ├── contact-animation.ts
    ├── section-transitions.ts
    └── text-animation.ts

GSAP MorphSVGPlugin (premium)
    ├── intro-animation.ts
    └── intro-animation-mobile.ts
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
| `page-transition.ts` | Virtual page transitions | BaseModule, GSAP |
| `section-transitions.ts` | Section reveal animations | BaseModule, GSAP, ScrollTrigger |
| `text-animation.ts` | Scroll-triggered text effects | BaseModule, GSAP, ScrollTrigger |

### Utility Modules

| Module | Purpose | Dependencies |
|--------|---------|--------------|
| `theme.ts` | Dark/light theme switching | BaseModule, appState |

## Admin Feature Services

The admin dashboard uses extracted services and renderers (January 2026 refactor).

### Admin Services

| Service | Purpose | Dependencies |
|---------|---------|--------------|
| `admin-data.service.ts` | Data fetching and caching with TTL | Fetch API, types |
| `admin-chart.service.ts` | Chart.js integration and rendering | Chart.js, admin-data.service |
| `admin-export.service.ts` | CSV/data export functionality | admin-data.service |

### Admin Renderers

| Renderer | Purpose | Dependencies |
|----------|---------|--------------|
| `admin-contacts.renderer.ts` | Contact table and modal rendering | SanitizationUtils, admin-data.service, logging |
| `admin-messaging.renderer.ts` | Messaging UI and thread rendering | SanitizationUtils, admin-data.service, logging |

### Admin Service Dependencies

```text
admin-dashboard.ts (coordinator)
    ├── admin-data.service.ts (data layer)
    │   └── Types from src/types/
    ├── admin-chart.service.ts
    │   ├── Chart.js (dynamic import)
    │   └── admin-data.service.ts
    ├── admin-export.service.ts
    │   └── admin-data.service.ts
    ├── admin-contacts.renderer.ts
    │   ├── SanitizationUtils
    │   ├── admin-data.service.ts
    │   └── logging (client logger)
    └── admin-messaging.renderer.ts
        ├── SanitizationUtils
        ├── admin-data.service.ts
        └── logging (client logger)
```

## Platform-Specific Modules

Some modules have platform-specific behavior:

| Module | Desktop | Mobile |
|--------|---------|--------|
| `intro-animation.ts` | Full morph animation | Skipped (uses mobile version) |
| `intro-animation-mobile.ts` | Skipped | Card flip animation |
| `page-transition.ts` | Virtual page transitions | Disabled |
| `contact-animation.ts` | Active | Skipped |

## Indirect Dependencies

Modules that affect each other indirectly:

1. **intro-animation.ts → intro-animation-mobile.ts**: Desktop determines when to use mobile fallback
2. **contact-animation.ts ↔ business-card-interactions.ts**: Both manage business cards in different sections
3. **page-transition.ts → section-transitions.ts**: Page transitions trigger section reveals

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
