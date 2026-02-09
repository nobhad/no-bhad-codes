/**
 * ===============================================
 * DEFAULT TASKS CONFIGURATION
 * ===============================================
 * @file server/config/default-tasks.ts
 *
 * Defines default task templates per milestone type.
 * These are auto-generated when milestones are created for a project.
 *
 * Each task template includes:
 * - title: Display name for the task
 * - description: Brief description of task scope
 * - order: Display order within milestone (1-based)
 * - estimatedHours: Optional estimated hours to complete
 */

/**
 * Task template interface
 */
export interface TaskTemplate {
  /** Display name for the task */
  title: string;
  /** Brief description of task scope (optional) */
  description?: string;
  /** Display order within milestone (1-based) */
  order: number;
  /** Optional estimated hours to complete */
  estimatedHours?: number;
}

/**
 * Milestone title normalizer for matching
 *
 * Converts milestone titles to lowercase and removes special characters
 * to enable fuzzy matching with task templates.
 *
 * @param milestoneTitle - Original milestone title
 * @returns Normalized title for matching
 */
export function normalizeMilestoneTitle(milestoneTitle: string): string {
  return milestoneTitle
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Default tasks organized by project type and milestone title
 *
 * Structure: { 'project-type': { 'normalized-milestone-title': TaskTemplate[] } }
 */
export const DEFAULT_TASKS: Record<string, Record<string, TaskTemplate[]>> = {
  /**
   * ============================================================
   * SIMPLE SITE TASKS
   * ============================================================
   * Timeline: ~14 days
   * Milestones: Discovery & Planning, Design & Development, Testing & Launch
   */
  'simple-site': {
    'discovery planning': [
      { title: 'Schedule kickoff meeting', description: 'Initial client consultation to understand goals and requirements', order: 1, estimatedHours: 1 },
      { title: 'Gather brand assets', description: 'Collect logos, colors, fonts, existing brand guidelines', order: 2, estimatedHours: 1 },
      { title: 'Define target audience', description: 'Identify primary user demographics and user needs', order: 3, estimatedHours: 1 },
      { title: 'Create sitemap', description: 'Map out site structure and page hierarchy', order: 4, estimatedHours: 2 },
      { title: 'Draft content outline', description: 'Outline key messages and content for each page', order: 5, estimatedHours: 2 },
      { title: 'Review project brief with client', description: 'Present and approve project scope, timeline, deliverables', order: 6, estimatedHours: 1 }
    ],
    'design development': [
      { title: 'Create design mockups', description: 'Design homepage and key template pages', order: 1, estimatedHours: 6 },
      { title: 'Client review of designs', description: 'Present designs and gather feedback', order: 2, estimatedHours: 1 },
      { title: 'Revise designs based on feedback', description: 'Implement requested design changes', order: 3, estimatedHours: 3 },
      { title: 'Set up development environment', description: 'Initialize project repository and local development', order: 4, estimatedHours: 1 },
      { title: 'Build responsive HTML/CSS', description: 'Convert designs to responsive code', order: 5, estimatedHours: 8 },
      { title: 'Implement navigation and interactions', description: 'Add menus, buttons, hover states, animations', order: 6, estimatedHours: 3 },
      { title: 'Integrate content', description: 'Add final text, images, and media to pages', order: 7, estimatedHours: 4 },
      { title: 'Optimize images and assets', description: 'Compress and optimize all media files', order: 8, estimatedHours: 2 }
    ],
    'testing launch': [
      { title: 'Cross-browser testing', description: 'Test on Chrome, Firefox, Safari, Edge', order: 1, estimatedHours: 2 },
      { title: 'Mobile device testing', description: 'Test responsive behavior on various screen sizes', order: 2, estimatedHours: 2 },
      { title: 'Form validation testing', description: 'Verify all forms work correctly', order: 3, estimatedHours: 1 },
      { title: 'Performance optimization', description: 'Optimize load times and Core Web Vitals', order: 4, estimatedHours: 2 },
      { title: 'Client final review', description: 'Walk through completed site with client', order: 5, estimatedHours: 1 },
      { title: 'Set up hosting and domain', description: 'Configure production server and DNS', order: 6, estimatedHours: 1 },
      { title: 'Deploy to production', description: 'Launch site to live server', order: 7, estimatedHours: 1 }
    ]
  },

  /**
   * ============================================================
   * BUSINESS SITE TASKS
   * ============================================================
   * Timeline: ~32 days
   * Milestones: Discovery, Design, Development, Content Integration, Testing & Launch
   */
  'business-site': {
    'discovery': [
      { title: 'Conduct business analysis workshop', description: 'Deep dive into business goals, KPIs, success metrics', order: 1, estimatedHours: 3 },
      { title: 'Research competitors', description: 'Analyze competitor websites and positioning', order: 2, estimatedHours: 4 },
      { title: 'Define user personas', description: 'Create detailed user personas and user journeys', order: 3, estimatedHours: 3 },
      { title: 'Document feature requirements', description: 'List all required features and functionality', order: 4, estimatedHours: 3 },
      { title: 'Define content strategy', description: 'Plan content types, tone, and messaging framework', order: 5, estimatedHours: 2 },
      { title: 'Create discovery document', description: 'Compile all research and requirements into formal document', order: 6, estimatedHours: 3 },
      { title: 'Client approval of discovery phase', description: 'Review and approve discovery deliverables', order: 7, estimatedHours: 1 }
    ],
    'design': [
      { title: 'Create wireframes for all page templates', description: 'Low-fidelity layouts for homepage, about, services, contact, etc.', order: 1, estimatedHours: 6 },
      { title: 'Develop style guide', description: 'Define typography, colors, spacing, UI components', order: 2, estimatedHours: 4 },
      { title: 'Design homepage mockup', description: 'High-fidelity design for homepage', order: 3, estimatedHours: 6 },
      { title: 'Design interior page templates', description: 'High-fidelity designs for key page types', order: 4, estimatedHours: 8 },
      { title: 'Client design review round 1', description: 'Present initial designs and gather feedback', order: 5, estimatedHours: 1 },
      { title: 'Design revisions', description: 'Implement feedback from client review', order: 6, estimatedHours: 4 },
      { title: 'Client design review round 2', description: 'Final design approval', order: 7, estimatedHours: 1 },
      { title: 'Prepare design assets for development', description: 'Export icons, images, style specifications', order: 8, estimatedHours: 2 }
    ],
    'development': [
      { title: 'Set up project repository', description: 'Initialize Git repo, configure build tools', order: 1, estimatedHours: 1 },
      { title: 'Configure CMS (if applicable)', description: 'Set up WordPress, Webflow, or headless CMS', order: 2, estimatedHours: 3 },
      { title: 'Build responsive framework', description: 'Create base HTML/CSS structure with responsive grid', order: 3, estimatedHours: 6 },
      { title: 'Develop homepage', description: 'Build homepage with all sections and interactions', order: 4, estimatedHours: 8 },
      { title: 'Develop interior page templates', description: 'Build reusable templates for content pages', order: 5, estimatedHours: 10 },
      { title: 'Implement contact forms', description: 'Build and connect contact/inquiry forms', order: 6, estimatedHours: 3 },
      { title: 'Add animations and micro-interactions', description: 'Implement scroll animations, hover effects', order: 7, estimatedHours: 4 },
      { title: 'Integrate analytics tracking', description: 'Set up Google Analytics or alternative', order: 8, estimatedHours: 1 },
      { title: 'Development QA', description: 'Test all functionality in development environment', order: 9, estimatedHours: 3 }
    ],
    'content integration': [
      { title: 'Receive final content from client', description: 'Collect all text, images, videos from client', order: 1, estimatedHours: 1 },
      { title: 'Populate homepage content', description: 'Add all content to homepage', order: 2, estimatedHours: 3 },
      { title: 'Populate interior pages', description: 'Add content to all interior pages', order: 3, estimatedHours: 6 },
      { title: 'Optimize images for web', description: 'Compress and properly size all images', order: 4, estimatedHours: 2 },
      { title: 'Set up SEO meta tags', description: 'Add page titles, descriptions, Open Graph tags', order: 5, estimatedHours: 2 },
      { title: 'Create XML sitemap', description: 'Generate sitemap for search engines', order: 6, estimatedHours: 1 },
      { title: 'Content review with client', description: 'Walk through all content for approval', order: 7, estimatedHours: 1 }
    ],
    'testing launch': [
      { title: 'Browser compatibility testing', description: 'Test on all major browsers and versions', order: 1, estimatedHours: 3 },
      { title: 'Mobile and tablet testing', description: 'Test responsive behavior across devices', order: 2, estimatedHours: 3 },
      { title: 'Form submission testing', description: 'Verify all forms send correctly', order: 3, estimatedHours: 1 },
      { title: 'Accessibility audit', description: 'Check WCAG compliance and screen reader compatibility', order: 4, estimatedHours: 2 },
      { title: 'Performance optimization', description: 'Optimize load times, lazy loading, caching', order: 5, estimatedHours: 3 },
      { title: 'Security hardening', description: 'SSL setup, security headers, CMS security', order: 6, estimatedHours: 2 },
      { title: 'Create client training materials', description: 'Document how to update content, manage site', order: 7, estimatedHours: 3 },
      { title: 'Conduct client training session', description: 'Train client on CMS and site management', order: 8, estimatedHours: 2 },
      { title: 'Set up production hosting', description: 'Configure production server and DNS', order: 9, estimatedHours: 2 },
      { title: 'Deploy to production', description: 'Launch site to live server', order: 10, estimatedHours: 2 },
      { title: 'Post-launch monitoring', description: 'Monitor site for issues in first 48 hours', order: 11, estimatedHours: 2 }
    ]
  },

  /**
   * ============================================================
   * E-COMMERCE SITE TASKS
   * ============================================================
   * Timeline: ~45 days
   * Milestones: Discovery & Planning, Design, Development, Product Setup, Testing & Launch
   */
  'ecommerce-site': {
    'discovery planning': [
      { title: 'Define business requirements', description: 'Identify store goals, target market, business model', order: 1, estimatedHours: 3 },
      { title: 'Analyze product catalog', description: 'Review product list, categories, variants, pricing structure', order: 2, estimatedHours: 3 },
      { title: 'Research e-commerce platforms', description: 'Evaluate Shopify, WooCommerce, custom solutions', order: 3, estimatedHours: 4 },
      { title: 'Platform recommendation', description: 'Present platform recommendation with pros/cons', order: 4, estimatedHours: 2 },
      { title: 'Define product structure', description: 'Plan product attributes, categories, filters, search', order: 5, estimatedHours: 3 },
      { title: 'Plan payment and shipping', description: 'Define payment gateways, shipping methods, tax rules', order: 6, estimatedHours: 3 },
      { title: 'Create requirements document', description: 'Document all requirements and technical specifications', order: 7, estimatedHours: 4 }
    ],
    'design': [
      { title: 'Create store wireframes', description: 'Low-fidelity layouts for homepage, category, product, cart, checkout', order: 1, estimatedHours: 8 },
      { title: 'Design product page layouts', description: 'High-fidelity product detail page designs', order: 2, estimatedHours: 6 },
      { title: 'Design checkout flow', description: 'Multi-step checkout process design', order: 3, estimatedHours: 5 },
      { title: 'Design homepage and category pages', description: 'High-fidelity designs for main store pages', order: 4, estimatedHours: 8 },
      { title: 'Design mobile shopping experience', description: 'Mobile-optimized designs for all key pages', order: 5, estimatedHours: 6 },
      { title: 'Client design review', description: 'Present designs and gather feedback', order: 6, estimatedHours: 1 },
      { title: 'Design revisions', description: 'Implement client feedback', order: 7, estimatedHours: 4 },
      { title: 'Finalize style guide', description: 'Complete UI component library for store', order: 8, estimatedHours: 3 }
    ],
    'development': [
      { title: 'Set up e-commerce platform', description: 'Install and configure chosen platform', order: 1, estimatedHours: 3 },
      { title: 'Configure store settings', description: 'Set up store name, currency, locale, time zone', order: 2, estimatedHours: 1 },
      { title: 'Develop custom theme', description: 'Build custom theme matching designs', order: 3, estimatedHours: 16 },
      { title: 'Integrate payment gateway', description: 'Set up Stripe, PayPal, or other payment processor', order: 4, estimatedHours: 4 },
      { title: 'Configure shipping methods', description: 'Set up shipping zones, rates, fulfillment options', order: 5, estimatedHours: 3 },
      { title: 'Set up tax calculations', description: 'Configure tax rules by location', order: 6, estimatedHours: 2 },
      { title: 'Implement product filtering and search', description: 'Add advanced product filtering and search functionality', order: 7, estimatedHours: 6 },
      { title: 'Build cart and checkout flow', description: 'Customize cart and multi-step checkout', order: 8, estimatedHours: 8 },
      { title: 'Set up customer accounts', description: 'Configure registration, login, order history', order: 9, estimatedHours: 4 },
      { title: 'Configure email notifications', description: 'Set up order confirmation, shipping, abandoned cart emails', order: 10, estimatedHours: 3 },
      { title: 'Add analytics and conversion tracking', description: 'Set up Google Analytics e-commerce tracking', order: 11, estimatedHours: 2 }
    ],
    'product setup': [
      { title: 'Create product categories', description: 'Build category hierarchy and navigation', order: 1, estimatedHours: 2 },
      { title: 'Import product catalog', description: 'Bulk import products with all attributes', order: 2, estimatedHours: 6 },
      { title: 'Add product images', description: 'Upload and optimize product photos', order: 3, estimatedHours: 8 },
      { title: 'Configure product variants', description: 'Set up size, color, and other variants', order: 4, estimatedHours: 4 },
      { title: 'Set up inventory management', description: 'Configure stock tracking and low stock alerts', order: 5, estimatedHours: 3 },
      { title: 'Create product collections', description: 'Build featured, new arrivals, sale collections', order: 6, estimatedHours: 2 },
      { title: 'Product content review', description: 'Review all product listings for accuracy', order: 7, estimatedHours: 3 }
    ],
    'testing launch': [
      { title: 'Test product browsing', description: 'Verify filtering, search, category navigation', order: 1, estimatedHours: 2 },
      { title: 'Test checkout process', description: 'Complete test orders with various scenarios', order: 2, estimatedHours: 3 },
      { title: 'Test payment processing', description: 'Verify all payment methods work correctly', order: 3, estimatedHours: 2 },
      { title: 'Test shipping calculations', description: 'Verify shipping rates calculate correctly', order: 4, estimatedHours: 2 },
      { title: 'Test email notifications', description: 'Verify all customer and admin emails send correctly', order: 5, estimatedHours: 1 },
      { title: 'Mobile shopping testing', description: 'Test full shopping flow on mobile devices', order: 6, estimatedHours: 3 },
      { title: 'Security audit', description: 'Verify PCI compliance, SSL, secure checkout', order: 7, estimatedHours: 2 },
      { title: 'Performance optimization', description: 'Optimize store load times and image delivery', order: 8, estimatedHours: 3 },
      { title: 'Train client on store management', description: 'Walk through product management, orders, settings', order: 9, estimatedHours: 3 },
      { title: 'Set up production environment', description: 'Configure production hosting and domain', order: 10, estimatedHours: 2 },
      { title: 'Launch store', description: 'Deploy store to production', order: 11, estimatedHours: 2 },
      { title: 'Post-launch order monitoring', description: 'Monitor first orders for issues', order: 12, estimatedHours: 3 }
    ]
  },

  /**
   * ============================================================
   * WEB APPLICATION TASKS
   * ============================================================
   * Timeline: ~60 days
   * Milestones: Discovery & Architecture, UI/UX Design, Core Development, Frontend Integration, Testing & Deployment
   */
  'web-app': {
    'discovery architecture': [
      { title: 'Conduct stakeholder interviews', description: 'Interview all stakeholders to understand requirements', order: 1, estimatedHours: 4 },
      { title: 'Define user stories and use cases', description: 'Document all user flows and application scenarios', order: 2, estimatedHours: 6 },
      { title: 'Create functional requirements spec', description: 'Detailed specification of all features and functionality', order: 3, estimatedHours: 8 },
      { title: 'Design technical architecture', description: 'Choose tech stack, define system architecture', order: 4, estimatedHours: 8 },
      { title: 'Create database schema', description: 'Design data models and relationships', order: 5, estimatedHours: 6 },
      { title: 'Define API structure', description: 'Plan RESTful or GraphQL API endpoints', order: 6, estimatedHours: 4 },
      { title: 'Create architecture diagrams', description: 'Visual diagrams of system architecture and data flow', order: 7, estimatedHours: 4 },
      { title: 'Plan development sprints', description: 'Break work into sprints with milestones', order: 8, estimatedHours: 3 },
      { title: 'Technical spec review with client', description: 'Present and approve technical approach', order: 9, estimatedHours: 2 }
    ],
    'uiux design': [
      { title: 'Conduct user research', description: 'User interviews, surveys, competitive analysis', order: 1, estimatedHours: 8 },
      { title: 'Create user personas', description: 'Detailed personas representing target users', order: 2, estimatedHours: 4 },
      { title: 'Map user flows', description: 'Diagram all user journeys through the application', order: 3, estimatedHours: 6 },
      { title: 'Create wireframes for all screens', description: 'Low-fidelity layouts for all application screens', order: 4, estimatedHours: 12 },
      { title: 'Build interactive prototype', description: 'Clickable prototype for user testing', order: 5, estimatedHours: 8 },
      { title: 'Conduct usability testing', description: 'Test prototype with real users', order: 6, estimatedHours: 6 },
      { title: 'Create UI design system', description: 'Design system with components, patterns, guidelines', order: 7, estimatedHours: 10 },
      { title: 'Design high-fidelity mockups', description: 'Pixel-perfect designs for all key screens', order: 8, estimatedHours: 16 },
      { title: 'Client design review', description: 'Present designs for approval', order: 9, estimatedHours: 2 },
      { title: 'Design revisions', description: 'Implement client feedback', order: 10, estimatedHours: 6 }
    ],
    'core development': [
      { title: 'Set up development environment', description: 'Configure local dev environment, Docker, CI/CD', order: 1, estimatedHours: 4 },
      { title: 'Initialize project repository', description: 'Set up Git repo with branching strategy', order: 2, estimatedHours: 1 },
      { title: 'Set up database', description: 'Configure database server and create schema', order: 3, estimatedHours: 3 },
      { title: 'Build authentication system', description: 'Implement user registration, login, sessions', order: 4, estimatedHours: 12 },
      { title: 'Develop core API endpoints', description: 'Build RESTful API for all core features', order: 5, estimatedHours: 24 },
      { title: 'Implement business logic', description: 'Core application logic and algorithms', order: 6, estimatedHours: 20 },
      { title: 'Set up background jobs', description: 'Configure task queue for async processing', order: 7, estimatedHours: 6 },
      { title: 'Implement file upload handling', description: 'Build file upload, storage, and retrieval', order: 8, estimatedHours: 6 },
      { title: 'Add email notification system', description: 'Set up transactional email service', order: 9, estimatedHours: 4 },
      { title: 'Implement logging and monitoring', description: 'Add application logging and error tracking', order: 10, estimatedHours: 4 },
      { title: 'Write API documentation', description: 'Document all API endpoints with examples', order: 11, estimatedHours: 6 },
      { title: 'Backend unit testing', description: 'Write tests for core business logic', order: 12, estimatedHours: 12 }
    ],
    'frontend integration': [
      { title: 'Set up frontend framework', description: 'Initialize React, Vue, or chosen framework', order: 1, estimatedHours: 3 },
      { title: 'Configure build tools', description: 'Set up Webpack, Vite, or build system', order: 2, estimatedHours: 2 },
      { title: 'Build component library', description: 'Create reusable UI components from design system', order: 3, estimatedHours: 16 },
      { title: 'Implement routing and navigation', description: 'Set up client-side routing', order: 4, estimatedHours: 4 },
      { title: 'Build authentication UI', description: 'Create login, registration, password reset screens', order: 5, estimatedHours: 8 },
      { title: 'Integrate API client', description: 'Set up API communication layer with error handling', order: 6, estimatedHours: 6 },
      { title: 'Build main application screens', description: 'Develop all primary application views', order: 7, estimatedHours: 24 },
      { title: 'Implement state management', description: 'Set up Redux, Zustand, or state solution', order: 8, estimatedHours: 6 },
      { title: 'Add form validation', description: 'Implement client-side validation for all forms', order: 9, estimatedHours: 6 },
      { title: 'Implement real-time features', description: 'Add WebSocket connections for live updates', order: 10, estimatedHours: 8 },
      { title: 'Build responsive layouts', description: 'Ensure all screens work on mobile and tablet', order: 11, estimatedHours: 10 },
      { title: 'Frontend unit testing', description: 'Write tests for components and logic', order: 12, estimatedHours: 12 }
    ],
    'testing deployment': [
      { title: 'Integration testing', description: 'Test all features end-to-end', order: 1, estimatedHours: 12 },
      { title: 'Browser compatibility testing', description: 'Test on all major browsers', order: 2, estimatedHours: 4 },
      { title: 'Mobile device testing', description: 'Test on various mobile devices', order: 3, estimatedHours: 4 },
      { title: 'Performance testing', description: 'Load testing, optimize bottlenecks', order: 4, estimatedHours: 6 },
      { title: 'Security testing', description: 'Penetration testing, vulnerability scan', order: 5, estimatedHours: 6 },
      { title: 'Accessibility audit', description: 'WCAG compliance testing', order: 6, estimatedHours: 4 },
      { title: 'Bug fixes', description: 'Fix all critical and high-priority bugs', order: 7, estimatedHours: 16 },
      { title: 'User acceptance testing', description: 'Client testing and feedback', order: 8, estimatedHours: 8 },
      { title: 'Production environment setup', description: 'Configure production servers, database, CDN', order: 9, estimatedHours: 6 },
      { title: 'Set up monitoring and alerts', description: 'Configure uptime monitoring, error alerts', order: 10, estimatedHours: 3 },
      { title: 'Deploy to production', description: 'Production deployment and smoke testing', order: 11, estimatedHours: 4 },
      { title: 'Create user documentation', description: 'Write user guides and help content', order: 12, estimatedHours: 8 },
      { title: 'Post-launch monitoring', description: 'Monitor application for 72 hours post-launch', order: 13, estimatedHours: 6 }
    ]
  },

  /**
   * ============================================================
   * MAINTENANCE TASKS
   * ============================================================
   * Timeline: Monthly milestones
   * Milestones: Month 1 - Setup, Month 2 - Optimization, Month 3 - Review
   */
  'maintenance': {
    'month 1 setup': [
      { title: 'Conduct comprehensive site audit', description: 'Audit performance, security, SEO, accessibility', order: 1, estimatedHours: 4 },
      { title: 'Set up uptime monitoring', description: 'Configure monitoring service for site availability', order: 2, estimatedHours: 1 },
      { title: 'Configure error tracking', description: 'Set up error monitoring and alerts', order: 3, estimatedHours: 1 },
      { title: 'Set up automated backups', description: 'Configure daily automated backups', order: 4, estimatedHours: 2 },
      { title: 'Review and update plugins/dependencies', description: 'Update all outdated software', order: 5, estimatedHours: 2 },
      { title: 'Create maintenance schedule', description: 'Document regular maintenance tasks and schedule', order: 6, estimatedHours: 2 },
      { title: 'Set up monthly reporting', description: 'Configure analytics and reporting dashboard', order: 7, estimatedHours: 2 },
      { title: 'Client onboarding call', description: 'Review maintenance process and communication', order: 8, estimatedHours: 1 },
      { title: 'Create site documentation', description: 'Document site architecture and key configurations', order: 9, estimatedHours: 3 }
    ],
    'month 2 optimization': [
      { title: 'Performance audit', description: 'Analyze site speed and Core Web Vitals', order: 1, estimatedHours: 2 },
      { title: 'Optimize images', description: 'Compress and properly size images', order: 2, estimatedHours: 3 },
      { title: 'Optimize database', description: 'Clean up database, optimize queries', order: 3, estimatedHours: 2 },
      { title: 'Implement caching improvements', description: 'Optimize caching strategy', order: 4, estimatedHours: 3 },
      { title: 'Security updates', description: 'Apply all security patches', order: 5, estimatedHours: 2 },
      { title: 'SSL certificate check', description: 'Verify SSL is valid and configured correctly', order: 6, estimatedHours: 0.5 },
      { title: 'Review security logs', description: 'Check for suspicious activity', order: 7, estimatedHours: 1 },
      { title: 'Content updates', description: 'Make requested content changes', order: 8, estimatedHours: 4 },
      { title: 'Generate performance report', description: 'Create monthly report with metrics and improvements', order: 9, estimatedHours: 2 }
    ],
    'month 3 review': [
      { title: 'Quarterly analytics review', description: 'Analyze traffic, conversions, user behavior', order: 1, estimatedHours: 3 },
      { title: 'SEO audit', description: 'Review SEO performance and opportunities', order: 2, estimatedHours: 3 },
      { title: 'Accessibility check', description: 'Verify WCAG compliance', order: 3, estimatedHours: 2 },
      { title: 'Mobile experience review', description: 'Test mobile usability and performance', order: 4, estimatedHours: 2 },
      { title: 'Update plugins and dependencies', description: 'Apply all updates and test compatibility', order: 5, estimatedHours: 2 },
      { title: 'Backup verification', description: 'Test backup restoration process', order: 6, estimatedHours: 1 },
      { title: 'Create quarterly report', description: 'Comprehensive report on site health and performance', order: 7, estimatedHours: 4 },
      { title: 'Plan next quarter priorities', description: 'Identify improvements and priorities for next period', order: 8, estimatedHours: 2 },
      { title: 'Quarterly client review call', description: 'Present report and discuss next quarter plan', order: 9, estimatedHours: 1 }
    ]
  },

  /**
   * ============================================================
   * OTHER/CUSTOM TASKS
   * ============================================================
   * Timeline: ~28 days
   * Milestones: Phase 1 - Planning, Phase 2 - Execution, Phase 3 - Completion
   */
  'other': {
    'phase 1 planning': [
      { title: 'Initial client consultation', description: 'Understand project goals and requirements', order: 1, estimatedHours: 2 },
      { title: 'Define project scope', description: 'Document detailed project scope and boundaries', order: 2, estimatedHours: 3 },
      { title: 'Create project timeline', description: 'Develop detailed project schedule', order: 3, estimatedHours: 2 },
      { title: 'Gather requirements', description: 'Collect all requirements and specifications', order: 4, estimatedHours: 4 },
      { title: 'Create project plan', description: 'Comprehensive project plan document', order: 5, estimatedHours: 4 },
      { title: 'Client approval of plan', description: 'Review and approve project plan', order: 6, estimatedHours: 1 }
    ],
    'phase 2 execution': [
      { title: 'Set up project environment', description: 'Configure development environment and tools', order: 1, estimatedHours: 2 },
      { title: 'Design phase', description: 'Create designs and mockups', order: 2, estimatedHours: 12 },
      { title: 'Client design review', description: 'Present designs for approval', order: 3, estimatedHours: 1 },
      { title: 'Development phase', description: 'Build and develop project deliverables', order: 4, estimatedHours: 24 },
      { title: 'Integrate content', description: 'Add content and media', order: 5, estimatedHours: 6 },
      { title: 'Client progress review', description: 'Mid-project check-in with client', order: 6, estimatedHours: 1 }
    ],
    'phase 3 completion': [
      { title: 'Testing and QA', description: 'Comprehensive testing of all deliverables', order: 1, estimatedHours: 6 },
      { title: 'Client review and feedback', description: 'Client testing and feedback collection', order: 2, estimatedHours: 2 },
      { title: 'Implement revisions', description: 'Make requested changes based on feedback', order: 3, estimatedHours: 6 },
      { title: 'Final client approval', description: 'Final sign-off on project', order: 4, estimatedHours: 1 },
      { title: 'Project delivery', description: 'Deliver final project files and documentation', order: 5, estimatedHours: 2 },
      { title: 'Project handoff and training', description: 'Train client and hand off project', order: 6, estimatedHours: 2 }
    ]
  }
};

/**
 * Get task templates for a specific milestone
 *
 * @param milestoneTitle - Title of the milestone (will be normalized)
 * @param projectType - Type of project (will be normalized)
 * @returns Array of task templates, or empty array if no match
 */
export function getTaskTemplatesForMilestone(
  milestoneTitle: string,
  projectType: string
): TaskTemplate[] {
  // Normalize project type (use same normalization as milestone-generator)
  const normalizedProjectType = projectType
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  // Get tasks for this project type, fallback to 'other'
  const projectTasks = DEFAULT_TASKS[normalizedProjectType] || DEFAULT_TASKS['other'];

  // Normalize milestone title for matching
  const normalizedTitle = normalizeMilestoneTitle(milestoneTitle);

  // Look up tasks by normalized milestone title
  return projectTasks[normalizedTitle] || [];
}
