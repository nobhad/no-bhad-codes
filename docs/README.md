# Documentation

Welcome to the no-bhad-codes portfolio and "The Backend" (portal) application documentation. This is a **solo freelance operation** — one admin manages all clients, projects, and business operations. There is no team management or multi-user admin.

## 📚 Documentation Overview

### The Backend (Portal System)

The Backend refers to the complete portal system with two interfaces:

**Client Portal** - Client-facing dashboard:

|Document|Description|
|----------|-------------|
|**[Client Portal](./features/CLIENT_PORTAL.md)**|Main dashboard, project cards, quick stats, activity log|
|**[Messaging](./features/MESSAGING.md)**|Messaging system, emoji picker, keyboard shortcuts|
|**[Files](./features/FILES.md)**|File upload, drag & drop, file management|
|**[Invoices](./features/INVOICES.md)**|Invoice history, status tracking, PDF download|
|**[Settings](./features/SETTINGS.md)**|Account, notifications, billing information|
|**[New Project](./features/NEW_PROJECT.md)**|Project request form, validation|
|**[Terminal Intake](./features/TERMINAL_INTAKE.md)**|Terminal-style project intake form with conversational UI|
|**[Agreements](./features/AGREEMENTS.md)**|Unified project agreement flow (contract + payment in one pass)|
|**[Onboarding Checklist](./features/ONBOARDING_CHECKLIST.md)**|Guided client onboarding steps|
|**[Embedded Payments](./features/EMBEDDED_PAYMENTS.md)**|In-portal Stripe payment and auto-pay|
|**[Payment Schedules](./features/PAYMENT_SCHEDULES.md)**|Milestone-based payment schedules and invoice cascade|
|**[Content Requests](./features/CONTENT_REQUESTS.md)**|Client content collection requests|
|**[Feedback](./features/FEEDBACK.md)**|Satisfaction surveys and testimonial collection|

**Admin Dashboard** - Administrative interface:

|Document|Description|
|----------|-------------|
|**[Admin Dashboard](./features/ADMIN_DASHBOARD.md)**|Leads, projects, clients, messaging, analytics|
|**[Portal Architecture](./features/PORTAL_ARCHITECTURE.md)**|React SPA architecture, routing, auth, Zustand store|

### Main Site Features

|Document|Description|
|----------|-------------|
|**[Portfolio Projects](./features/PORTFOLIO.md)**|Adding projects, JSON schema, case study fields, image requirements|

### Backend API Features

|Document|Description|
|----------|-------------|
|**[Ad Hoc Requests](./features/AD_HOC_REQUESTS.md)**|On-demand service requests, time tracking, billing|
|**[Analytics](./features/ANALYTICS.md)**|Business intelligence, dashboards, KPIs, visitor tracking|
|**[Client Information](./features/CLIENT_INFORMATION.md)**|Client profile data, company details|
|**[Clients](./features/CLIENTS.md)**|CRM contacts, activities, custom fields, tags, health scoring|
|**[Contacts](./features/CONTACTS.md)**|Contact management within clients|
|**[Contracts](./features/CONTRACTS.md)**|Contract generation, signing, management|
|**[Data Quality](./features/DATA_QUALITY.md)**|Data validation, cleanup, integrity checks|
|**[Deliverables](./features/DELIVERABLES.md)**|Deliverable tracking, approval workflows, archiving|
|**[Document Requests](./features/DOCUMENT_REQUESTS.md)**|Document request workflows, templates|
|**[Integrations](./features/INTEGRATIONS.md)**|Third-party integrations (Stripe, etc.)|
|**[Knowledge Base](./features/KNOWLEDGE_BASE.md)**|KB articles, categories, search|
|**[Leads](./features/LEADS.md)**|Lead scoring, pipeline, tasks, notes, duplicate detection|
|**[Milestones](./features/MILESTONES.md)**|Project milestones, tracking, completion|
|**[PDF Generation](./features/PDF_GENERATION.md)**|Invoice, proposal, contract, receipt PDF generation|
|**[Projects](./features/PROJECTS.md)**|Tasks, time tracking, templates, dependencies, project health|
|**[Proposal Builder](./features/PROPOSAL_BUILDER.md)**|Interactive proposal creation tool|
|**[Proposals](./features/PROPOSALS.md)**|Templates, versioning, signatures, comments, activities|
|**[Questionnaires](./features/QUESTIONNAIRES.md)**|Client questionnaires, PDF export|
|**[SEO](./features/SEO.md)**|Meta tags, JSON-LD structured data, robots.txt, sitemap|
|**[Tasks](./features/TASKS.md)**|Task management within projects|
|**[Time Tracking](./features/TIME_TRACKING.md)**|Time entry, reporting|
|**[Workflows](./features/WORKFLOWS.md)**|Automation workflows, triggers, actions|
|**[Custom Automations](./features/CUSTOM_AUTOMATIONS.md)**|Admin-built automation rules (triggers, conditions, actions)|
|**[Email Sequences](./features/EMAIL_SEQUENCES.md)**|Lead nurture drip sequences|
|**[Meeting Requests](./features/MEETING_REQUESTS.md)**|Meeting request and confirmation flow|
|**[Retainers](./features/RETAINERS.md)**|Retainer and recurring project management|
|**[Expenses](./features/EXPENSES.md)**|Expense tracking and project profitability|
|**[Embed Widgets](./features/EMBED_WIDGETS.md)**|Embeddable public widgets|
|**[AI Features](./features/AI_FEATURES.md)**|AI proposal drafting, email drafting, semantic search|
|**[i18n / Localization](./features/i18n-localization.md)**|Translation and locale handling|
|**[Wireframes](./features/WIREFRAMES.md)**|Wireframe reference for portal screens|

**API Reference:** See [API Documentation](./API_DOCUMENTATION.md) for complete endpoint reference.

### Animation Modules

|Document|Description|
|----------|-------------|
|**[Intro Animation](./features/INTRO_ANIMATION.md)**|Coyote paw intro animation (desktop/mobile)|

### Design System

|Document|Description|
|----------|-------------|
|**[Design System](./design/DESIGN_SYSTEM.md)**|Variables, themes, typography, icons, components|
|**[Animations](./design/ANIMATIONS.md)**|GSAP usage, animation tokens, performance|
|**[CSS Architecture](./design/CSS_ARCHITECTURE.md)**|Layer strategy, bundles, naming|
|**[Component Library](./design/COMPONENT_LIBRARY.md)**|Shared component catalogue|
|**[Factory System](./design/FACTORY_SYSTEM.md)**|Component/button/icon factories|
|**[Status System](./design/STATUS_SYSTEM.md)**|Status badges and state vocabulary|
|**[Portal Design](./design/PORTAL_DESIGN.md)**|Portal visual language|
|**[Admin Portal Linear Redesign](./design/ADMIN_PORTAL_LINEAR_REDESIGN.md)**|Linear-inspired admin redesign|
|**[Project Detail Layout](./design/PROJECT_DETAIL_LAYOUT.md)**|Project detail page structure|
|**[Main Site Design](./design/MAIN_SITE_DESIGN.md)**|Marketing site design language|
|**[Terminal Design Patterns](./design/TERMINAL_DESIGN_PATTERNS.md)**|Terminal UI conventions|
|**[UX Guidelines](./design/UX_GUIDELINES.md)**|Interaction and accessibility guidance|
|**[Golden Ratio Typography](./design/typography/GOLDEN_RATIO.md)**|Type scale derivation|
|**[Coyote Paw Animation](./design/COYOTE_PAW_ANIMATION.md)**|Paw animation implementation notes|

### Architecture & Development

- **[System Architecture](./ARCHITECTURE.md)** - Core architecture, module system, service layer, and component system
- **[Developer Guide](./DEVELOPER_GUIDE.md)** - Development practices, module patterns, service layer, and component system
- **[Configuration Guide](./CONFIGURATION.md)** - Environment variables, frontend config files, TypeScript and Vite configuration
- **[Performance & Bundle Optimization](./OPTIMIZATION.md)** - Bundle optimization strategies, performance monitoring, Core Web Vitals tracking, and development best practices
- **[Visitor Tracking System](./features/VISITOR-TRACKING.md)** - Privacy-compliant analytics, consent management, and engagement metrics
- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference with request/response examples
- **[Code Protection Guide](./CODE_PROTECTION_GUIDE.md)** - Code obfuscation, source map protection, and security practices
- **[Backend Patterns](./architecture/BACKEND_PATTERNS.md)** - Route, service, and middleware conventions
- **[Database Schema](./architecture/DATABASE_SCHEMA.md)** - Tables, relationships, and migration history
- **[Module Dependencies](./architecture/MODULE_DEPENDENCIES.md)** - Module and service dependency graph
- **[API Reference Index](./api/README.md)** - Endpoint index by domain
- **[Ops Runbook](./OPS_RUNBOOK.md)** - Operational procedures, backups, incident response
- **[Hosting Cost Investigation](./HOSTING_COST_INVESTIGATION.md)** - Why the Railway bill was CPU-bound, what was ruled out, and the tsx-to-compiled switch
- **[State of the Art Roadmap](./archive/STATE_OF_THE_ART_ROADMAP.md)** - Archived: the phased roadmap as it was planned; every phase shipped and the paths it names have since moved

### Development & Maintenance

- **[Current Work](../CURRENT_WORK.md)** - Active development tracking and TODO list
- **[Development Guide](./guides/DEVELOPMENT.md)** - Development workflow, npm scripts, test coverage
- **[Installation Guide](./guides/INSTALLATION.md)** - Local setup from scratch
- **[Deployment Guide](./guides/DEPLOYMENT.md)** - Build and deploy steps
- **[Features Index](./features/README.md)** - Full A-Z list of feature docs

### Audits & Post-Mortems

- **[Full Portal Audit](./audits/FULL_PORTAL_AUDIT.md)** - Portal architecture audit, grade A validation findings
- **[Supplementary Audit](./audits/SUPPLEMENTARY_AUDIT.md)** - Additional audit notes and findings
- **[Backend Audit Report](./audits/BACKEND_AUDIT_REPORT.md)** - Backend architecture audit
- **[Claude Mistakes](./audits/CLAUDE_MISTAKES.md)** - Documented errors and lessons learned
- **[Backend Splitting Plan](./audits/BACKEND_SPLITTING_PLAN.md)** - Route/service decomposition plan
- **[Database Normalization Plan](./audits/DATABASE_NORMALIZATION_PLAN.md)** - Schema normalization remediation
- **[Portal Unification Deep Dive](./audits/PORTAL_UNIFICATION_DEEP_DIVE.md)** - Admin/client portal unification analysis

### Archive

- **[Archived Work 2025-12](./archive/work-logs/ARCHIVED_WORK_2025-12.md)** - Completed work from December 2025
- **[Archived Work 2026-01](./archive/work-logs/ARCHIVED_WORK_2026-01.md)** - Completed work from January 2026
- **[Archived Work 2026-02](./archive/work-logs/ARCHIVED_WORK_2026-02.md)** - Completed work from February 2026
- **[Archived Work 2026-02 (mid-month)](./archive/work-logs/ARCHIVED_WORK_2026-02-12.md)** - Completed work mid-February 2026
- **[Archived Work 2026-03](./archive/work-logs/ARCHIVED_WORK_2026-03.md)** - Completed work from March 2026

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

- Node.js 22.x
- npm 8+
- Modern browser (Chrome 90+, Firefox 88+, Safari 14+)

### Installation

```bash
# Install dependencies
npm install

# Create environment configuration (copy from .env if exists, or create new)
# Required variables: DATABASE_PATH, JWT_SECRET, PORT

# Initialize database
npm run db:setup

# Start development servers (frontend + backend)
npm run dev:full

# Open http://<frontend-host>:4000
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
npm run build:analyze    # Build and run bundle analyzer (vite-bundle-analyzer)
npm run optimize         # Full optimization pipeline
```

## Project Structure

```text
src/
├── core/                    # Core application systems
│   ├── app.ts              # Main application controller
│   ├── container.ts        # Dependency injection
│   ├── state/              # State management (split into modules)
│   ├── services-config.ts  # Service registrations
│   └── modules-config.ts   # Module definitions
├── features/               # Feature modules (domain-driven)
│   ├── auth/               # Auth gate / login flows
│   ├── client/             # Terminal intake
│   ├── main-site/          # Main site features
│   └── shared/             # Cross-feature helpers
├── react/                  # React portal SPA
│   ├── app/                # Root components (PortalApp, PortalRoutes, PortalLayout)
│   ├── stores/             # Zustand stores (portal-store.ts, admin.ts)
│   ├── hooks/              # Auth hooks (usePortalAuth.ts)
│   ├── features/
│   │   ├── admin/          # Admin-only feature modules (50+)
│   │   └── portal/         # Client-only feature modules (29+)
│   └── components/         # Shared React components
├── auth/                   # Client-side auth store and constants
├── modules/                # Reusable UI modules
│   ├── core/base.ts        # Base module class
│   ├── utilities/theme.ts  # Theme switching
│   ├── ui/navigation.ts    # Navigation
│   └── animation/          # Animation modules
├── services/              # Service layer
│   ├── performance-service.ts
│   ├── visitor-tracking.ts
│   └── data-service.ts
├── components/            # Reusable UI components
├── design-system/         # Design tokens
├── styles/                # CSS (base, portal, bundles, pages)
├── utils/                 # Utility functions
└── types/                 # TypeScript definitions
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

#### Current Navigation Structure (Updated January 2026):

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

#### Navigation Features:

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
import { createLogger } from '../utils/logger';
const logger = createLogger('MyComponent');

const button = await createButton({
  variant: 'primary',
  onClick: () => logger.log('clicked!') // Debug logs only in development
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
3. Start development server: `npm run dev:full` (runs both frontend and backend)
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
