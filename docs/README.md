# Documentation

Welcome to the no-bhad-codes portfolio application documentation. This directory contains comprehensive guides for the application's architecture, features, and development practices.

## 📚 Documentation Overview

### Client Portal Features

| Document | Description |
|----------|-------------|
| **[Client Portal](./features/CLIENT_PORTAL.md)** | Main dashboard, project cards, quick stats, activity log |
| **[Messages](./features/MESSAGES.md)** | Messaging system, emoji picker, keyboard shortcuts |
| **[Files](./features/FILES.md)** | File upload, drag & drop, file management |
| **[Invoices](./features/INVOICES.md)** | Invoice history, status tracking, PDF download |
| **[Settings](./features/SETTINGS.md)** | Account, notifications, billing information |
| **[New Project](./features/NEW_PROJECT.md)** | Project request form, validation |

### Animation Modules

| Document | Description |
|----------|-------------|
| **[Intro Animation](./features/INTRO_ANIMATION.md)** | Coyote paw intro animation (desktop/mobile) |
| **[Scroll Snap](./features/SCROLL_SNAP.md)** | GSAP-powered section snapping (mobile) |

### Design System

| Document | Description |
|----------|-------------|
| **[CSS Architecture](./design/CSS_ARCHITECTURE.md)** | Variables, themes, naming conventions |
| **[UX Guidelines](./design/UX_GUIDELINES.md)** | Typography, icons, buttons, forms |
| **[Animations](./design/ANIMATIONS.md)** | GSAP usage, animation tokens, performance |

### Architecture & Development

- **[Configuration Guide](./CONFIGURATION.md)** - Environment variables, frontend config files, TypeScript and Vite configuration
- **[Performance & Bundle Optimization](./OPTIMIZATION.md)** - Bundle optimization strategies, performance monitoring, Core Web Vitals tracking, and development best practices
- **[Visitor Tracking System](./VISITOR-TRACKING.md)** - Privacy-compliant analytics, consent management, and engagement metrics
- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference with request/response examples

### Quick Links

- [Getting Started](#getting-started)
- [Project Structure](#project-structure) 
- [Development Commands](#development-commands)
- [Architecture Overview](#architecture-overview)
- [Component System](#component-system)
- [Performance Features](#performance-features)
- [Privacy & Analytics](#privacy--analytics)

## Getting Started

### Prerequisites

- Node.js 20.x
- npm 8+
- Modern browser (Chrome 90+, Firefox 88+, Safari 14+)

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Initialize database
npm run db:setup

# Start development servers (frontend + backend)
npm run dev:full

# Open http://localhost:4000
```

### Development Commands

```bash
npm run dev              # Start development server
npm run build            # Production build
npm run preview          # Preview production build
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run typecheck        # TypeScript type checking
npm run test             # Run tests
npm run build:analyze    # Build and analyze bundles
npm run optimize         # Full optimization pipeline
```

## Project Structure

```
src/
├── core/                # Core application systems
│   ├── app.ts          # Main application controller
│   ├── container.ts    # Dependency injection
│   └── state.ts        # State management
├── components/         # Reusable UI components
│   ├── base-component.ts
│   ├── button-component.ts
│   ├── modal-component.ts
│   ├── consent-banner.ts
│   ├── performance-dashboard.ts
│   └── analytics-dashboard.ts
├── modules/           # Feature modules
│   ├── base.ts       # Base module class
│   ├── theme.ts      # Theme switching (defaults to light)
│   ├── navigation.ts # Navigation with submenu support  
│   ├── submenu.ts    # Dropdown submenu functionality
│   └── ...
├── services/         # Service layer
│   ├── performance-service.ts
│   ├── visitor-tracking.ts
│   └── bundle-analyzer.ts
└── types/           # TypeScript definitions
    └── modules.ts
```

## Architecture Overview

### Modern TypeScript Architecture

The application uses a sophisticated architecture built on modern TypeScript patterns:

- **Dependency Injection**: Service registration and resolution with circular dependency detection
- **Module System**: Feature-based modules extending BaseModule for consistent lifecycle
- **Component Architecture**: Reusable components with props, state, and lifecycle hooks
- **State Management**: Reactive state with actions, reducers, middleware, and time travel debugging

### Key Design Patterns

- **Service-Oriented Architecture**: Clear separation between services, modules, and components
- **Lazy Loading**: Dynamic imports and code splitting for optimal performance
- **Event-Driven**: Custom event system for inter-module communication
- **Observer Pattern**: State subscriptions and computed properties

## Component System

### BaseComponent Architecture

All UI components extend the `BaseComponent` class providing:

```typescript
// Component with props and state
class MyComponent extends BaseComponent<Props, State> {
  async mounted() { /* lifecycle hook */ }
  watchProp('someProp', (newVal, oldVal) => { /* reactive updates */ })
  trackGlobalState(state => { /* global state changes */ })
}
```

### Built-in Components

- **Button**: Accessible button with variants, states, and interactions
- **Modal**: Accessible modal with focus management and animations  
- **ConsentBanner**: GDPR/CCPA compliant privacy consent UI
- **PerformanceDashboard**: Real-time Core Web Vitals monitoring
- **AnalyticsDashboard**: Visitor analytics and engagement metrics

### Navigation System

**Current Navigation Structure (Updated December 2025):**

- **Home** (00) - Main landing page with business card
- **About** (01) - About section with hero animation
- **Contact** (02) - Contact form with cascade animations
- **Projects** (03) - Projects showcase (WIP page)

**Client Portal** (accessible via `/client/portal`):

- Secure login with JWT authentication
- Project dashboard and tracking
- Messaging system
- File management
- Invoices

**Navigation Features:**

- Hash-based routing (`#/`, `#/about`, `#/contact`, `#/projects`)
- Virtual page transitions with blur-in/blur-out animations
- GSAP-powered animations (nav links fade in on intro)
- Mobile hamburger menu
- Theme system compatibility (crimson red light mode, matrix green dark mode)
- Accessibility features (keyboard navigation, ARIA)

### Component Registration

```typescript
// Automatic component initialization
<div data-component="Button" 
     data-prop-variant="primary"
     data-prop-children="Click me!">
</div>

// Programmatic creation
const button = await createButton({
  variant: 'primary',
  onClick: () => console.log('clicked!')
}, '#container');
```

## Performance Features

### Core Web Vitals Monitoring

Real-time tracking of:
- **LCP (Largest Contentful Paint)**: < 2.5s target
- **FID (First Input Delay)**: < 100ms target
- **CLS (Cumulative Layout Shift)**: < 0.1 target

### Bundle Optimization

- **Intelligent Code Splitting**: Feature-based chunk strategy
- **Tree Shaking**: Unused code elimination
- **Modern Targets**: ES2020 for smaller bundles
- **Performance Budgets**: Automated size limit enforcement

### Development Tools

```javascript
// Available in browser console
NBW_DEBUG.getPerformanceReport()  // Core Web Vitals data
NBW_DEBUG.getBundleAnalysis()     // Bundle size analysis
NBW_DEBUG.getComponentStats()     // Component metrics
NBW_DEBUG.getStatus()             // Overall app status
```

## Privacy & Analytics

### Privacy-First Approach

- **Explicit Consent**: Clear opt-in consent required
- **Data Transparency**: Detailed information about tracking
- **Local Storage Only**: No external data transmission
- **Right to Withdraw**: Easy consent withdrawal
- **Do Not Track**: Respects browser DNT settings

### Analytics Features

- **Session Tracking**: Duration, page views, bounce rate
- **Interaction Analytics**: Clicks, scrolls, form usage
- **Engagement Metrics**: Content engagement, user journeys
- **Real-time Dashboard**: Live visitor data for development

### Tracked Interactions

- Page views and time spent
- Scroll depth milestones (25%, 50%, 75%, 100%)
- Business card interactions and animations
- Navigation usage patterns
- Form interactions and completion
- File downloads and external links

## Development Workflow

### Debug Interface

The application provides comprehensive debugging tools accessible via `NBW_DEBUG`:

```javascript
// Performance monitoring
await NBW_DEBUG.getPerformanceReport()

// Visitor analytics  
await NBW_DEBUG.getVisitorData()

// Component system stats
NBW_DEBUG.getComponentStats()

// Bundle analysis
await NBW_DEBUG.getBundleAnalysis()

// Hot reload for development
NBW_DEBUG.hotReload()
```

### Visual Dashboards

Development mode includes visual dashboards:

- **Performance Dashboard** (top-right): Core Web Vitals and performance metrics
- **Analytics Dashboard** (bottom-left): Real-time visitor data and engagement

### Testing & Quality

```bash
npm run test           # Unit tests with Vitest
npm run test:ui        # Interactive test UI
npm run test:coverage  # Coverage reports
npm run lint           # Code quality checks
npm run typecheck      # TypeScript validation
```

## Best Practices

### Code Quality

- **TypeScript First**: Full type safety throughout
- **ESLint + Prettier**: Automated code formatting and quality
- **Modular Architecture**: Clear separation of concerns
- **Error Handling**: Comprehensive error boundaries and logging

### Performance

- **Bundle Optimization**: Code splitting and tree shaking
- **Lazy Loading**: Dynamic imports for non-critical code  
- **Performance Monitoring**: Real-time Core Web Vitals tracking
- **Caching Strategy**: Intelligent chunk splitting for optimal caching

### Privacy & Security

- **Consent Management**: GDPR/CCPA compliant privacy controls
- **Data Minimization**: Only collect necessary data
- **Local Storage**: Keep user data in browser
- **Transparent Practices**: Clear communication about data usage

## Contributing

### Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`  
3. Start development server: `npm run dev`
4. Make changes and test thoroughly
5. Run quality checks: `npm run optimize`
6. Submit pull request with detailed description

### Code Standards

- Follow TypeScript best practices
- Use the existing component architecture
- Add tests for new functionality
- Update documentation as needed
- Ensure accessibility compliance

### Performance Requirements

- Bundle sizes within performance budgets
- Core Web Vitals targets met
- No blocking JavaScript on main thread
- Graceful degradation for all features

This documentation provides a comprehensive guide to understanding and working with the no-bhad-codes application. For specific implementation details, refer to the individual documentation files in this directory.