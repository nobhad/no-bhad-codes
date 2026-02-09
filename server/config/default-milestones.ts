/**
 * ===============================================
 * DEFAULT MILESTONES CONFIGURATION
 * ===============================================
 * @file server/config/default-milestones.ts
 *
 * Defines default milestone templates per project type.
 * These are auto-generated when a new project is created.
 *
 * Each milestone template includes:
 * - name: Display name for the milestone
 * - description: Brief description of milestone scope
 * - estimatedDays: Days from project start (cumulative)
 * - order: Display order (1-based)
 * - deliverables: Optional list of expected deliverables
 */

/**
 * Milestone template interface
 */
export interface MilestoneTemplate {
  /** Display name for the milestone */
  name: string;
  /** Brief description of milestone scope */
  description: string;
  /** Days from project start to milestone due date */
  estimatedDays: number;
  /** Display order (1-based) */
  order: number;
  /** Optional list of expected deliverables */
  deliverables?: string[];
}

/**
 * Default milestones by project type
 *
 * Project types are normalized to lowercase with hyphens.
 * Falls back to 'other' for unknown project types.
 */
export const DEFAULT_MILESTONES: Record<string, MilestoneTemplate[]> = {
  /**
   * Simple site: Landing pages, single-page sites, personal sites
   * ~14 day timeline
   */
  'simple-site': [
    {
      name: 'Discovery & Planning',
      description: 'Initial consultation, requirements gathering, and project planning',
      estimatedDays: 3,
      order: 1,
      deliverables: ['Project brief', 'Sitemap', 'Content outline']
    },
    {
      name: 'Design & Development',
      description: 'Visual design, development, and content integration',
      estimatedDays: 10,
      order: 2,
      deliverables: ['Design mockups', 'Responsive site build', 'Content integration']
    },
    {
      name: 'Testing & Launch',
      description: 'Quality assurance, client review, and deployment',
      estimatedDays: 14,
      order: 3,
      deliverables: ['Cross-browser testing', 'Mobile testing', 'Live deployment']
    }
  ],

  /**
   * Business site: Multi-page business websites, portfolios
   * ~32 day timeline
   */
  'business-site': [
    {
      name: 'Discovery',
      description: 'Business analysis, competitor research, and requirements definition',
      estimatedDays: 5,
      order: 1,
      deliverables: ['Discovery document', 'Competitor analysis', 'Feature requirements']
    },
    {
      name: 'Design',
      description: 'Brand integration, wireframes, and visual design',
      estimatedDays: 12,
      order: 2,
      deliverables: ['Wireframes', 'Style guide', 'Design mockups']
    },
    {
      name: 'Development',
      description: 'Frontend development, CMS setup, and functionality implementation',
      estimatedDays: 22,
      order: 3,
      deliverables: ['Responsive build', 'CMS configuration', 'Contact forms']
    },
    {
      name: 'Content Integration',
      description: 'Content population, SEO optimization, and media integration',
      estimatedDays: 27,
      order: 4,
      deliverables: ['Page content', 'SEO setup', 'Image optimization']
    },
    {
      name: 'Testing & Launch',
      description: 'Comprehensive testing, training, and production deployment',
      estimatedDays: 32,
      order: 5,
      deliverables: ['QA testing', 'Client training', 'Live deployment']
    }
  ],

  /**
   * E-commerce site: Online stores, shopping platforms
   * ~45 day timeline
   */
  'ecommerce-site': [
    {
      name: 'Discovery & Planning',
      description: 'Business requirements, product catalog analysis, and platform selection',
      estimatedDays: 7,
      order: 1,
      deliverables: ['Requirements document', 'Platform recommendation', 'Product structure']
    },
    {
      name: 'Design',
      description: 'Store design, product page layouts, and checkout flow design',
      estimatedDays: 14,
      order: 2,
      deliverables: ['Store wireframes', 'Product page designs', 'Checkout flow']
    },
    {
      name: 'Development',
      description: 'Platform setup, theme customization, and core functionality',
      estimatedDays: 28,
      order: 3,
      deliverables: ['Store setup', 'Payment integration', 'Shipping configuration']
    },
    {
      name: 'Product Setup',
      description: 'Product import, inventory setup, and categorization',
      estimatedDays: 35,
      order: 4,
      deliverables: ['Product catalog', 'Inventory system', 'Category structure']
    },
    {
      name: 'Testing & Launch',
      description: 'Order testing, payment verification, and production launch',
      estimatedDays: 45,
      order: 5,
      deliverables: ['Order flow testing', 'Payment testing', 'Store launch']
    }
  ],

  /**
   * Web application: Custom web applications, dashboards, SaaS
   * ~60 day timeline
   */
  'web-app': [
    {
      name: 'Discovery & Architecture',
      description: 'Requirements analysis, technical architecture, and project planning',
      estimatedDays: 10,
      order: 1,
      deliverables: ['Technical spec', 'Architecture diagram', 'Project roadmap']
    },
    {
      name: 'UI/UX Design',
      description: 'User research, wireframes, and interface design',
      estimatedDays: 20,
      order: 2,
      deliverables: ['User flows', 'Wireframes', 'UI design system']
    },
    {
      name: 'Core Development',
      description: 'Backend development, API creation, and core functionality',
      estimatedDays: 40,
      order: 3,
      deliverables: ['Backend API', 'Database schema', 'Core features']
    },
    {
      name: 'Frontend Integration',
      description: 'Frontend development and API integration',
      estimatedDays: 50,
      order: 4,
      deliverables: ['Frontend application', 'API integration', 'User authentication']
    },
    {
      name: 'Testing & Deployment',
      description: 'Testing, bug fixes, and production deployment',
      estimatedDays: 60,
      order: 5,
      deliverables: ['Test coverage', 'Bug fixes', 'Production deployment']
    }
  ],

  /**
   * Maintenance/Retainer: Ongoing maintenance contracts
   * Monthly milestones
   */
  'maintenance': [
    {
      name: 'Month 1 - Setup',
      description: 'Initial audit, setup monitoring, and establish maintenance schedule',
      estimatedDays: 30,
      order: 1,
      deliverables: ['Site audit', 'Monitoring setup', 'Maintenance schedule']
    },
    {
      name: 'Month 2 - Optimization',
      description: 'Performance optimization and security updates',
      estimatedDays: 60,
      order: 2,
      deliverables: ['Performance report', 'Security patches', 'Optimization updates']
    },
    {
      name: 'Month 3 - Review',
      description: 'Quarterly review and planning for next period',
      estimatedDays: 90,
      order: 3,
      deliverables: ['Quarterly report', 'Next period plan', 'Recommendations']
    }
  ],

  /**
   * Other/Custom: Fallback for unknown project types
   * Generic 28 day timeline
   */
  'other': [
    {
      name: 'Phase 1 - Planning',
      description: 'Requirements gathering and project planning',
      estimatedDays: 7,
      order: 1,
      deliverables: ['Project plan', 'Requirements document']
    },
    {
      name: 'Phase 2 - Execution',
      description: 'Primary work phase - design and development',
      estimatedDays: 21,
      order: 2,
      deliverables: ['Design deliverables', 'Development work']
    },
    {
      name: 'Phase 3 - Completion',
      description: 'Final review, testing, and project handoff',
      estimatedDays: 28,
      order: 3,
      deliverables: ['Final deliverables', 'Testing', 'Project handoff']
    }
  ]
};

/**
 * Normalize project type to match milestone config keys
 *
 * Converts project types from various formats to lowercase-hyphenated format.
 * Falls back to 'other' if no matching config exists.
 *
 * @param projectType - Raw project type from database or form
 * @returns Normalized type key for DEFAULT_MILESTONES lookup
 */
export function normalizeProjectType(projectType: string | null | undefined): string {
  if (!projectType) {
    return 'other';
  }

  // Normalize: lowercase, replace underscores/spaces with hyphens
  const normalized = projectType
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  // Check for exact match
  if (DEFAULT_MILESTONES[normalized]) {
    return normalized;
  }

  // Check for partial matches
  const typeMap: Record<string, string> = {
    'simple': 'simple-site',
    'landing': 'simple-site',
    'personal': 'simple-site',
    'business': 'business-site',
    'corporate': 'business-site',
    'portfolio': 'business-site',
    'ecommerce': 'ecommerce-site',
    'e-commerce': 'ecommerce-site',
    'shop': 'ecommerce-site',
    'store': 'ecommerce-site',
    'webapp': 'web-app',
    'application': 'web-app',
    'dashboard': 'web-app',
    'saas': 'web-app',
    'retainer': 'maintenance',
    'support': 'maintenance',
    'custom': 'other'
  };

  // Check if normalized type contains any of the keywords
  for (const [keyword, mappedType] of Object.entries(typeMap)) {
    if (normalized.includes(keyword)) {
      return mappedType;
    }
  }

  return 'other';
}

/**
 * Get milestone templates for a project type
 *
 * @param projectType - Project type (will be normalized)
 * @returns Array of milestone templates
 */
export function getMilestoneTemplates(projectType: string | null | undefined): MilestoneTemplate[] {
  const normalizedType = normalizeProjectType(projectType);
  return DEFAULT_MILESTONES[normalizedType] || DEFAULT_MILESTONES['other'];
}
