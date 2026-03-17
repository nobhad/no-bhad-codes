/**
 * ===============================================
 * TIER-AWARE MILESTONE CONFIGURATION
 * ===============================================
 * @file server/config/tier-milestones.ts
 *
 * Maps projectType + tier to milestone templates.
 * Each tier builds on the previous: good = base, better = good + extras, best = better + extras.
 * Falls back to DEFAULT_MILESTONES if no tier config exists.
 */

import { MilestoneTemplate, normalizeProjectType } from './default-milestones.js';

/**
 * Tier milestone configuration
 * Structure: projectType → tier → MilestoneTemplate[]
 */
export const TIER_MILESTONES: Record<string, Record<string, MilestoneTemplate[]>> = {
  'simple-site': {
    good: [
      {
        name: 'Discovery & Planning',
        description: 'Initial consultation, requirements gathering, and project planning',
        estimatedDays: 3,
        order: 1,
        deliverables: ['Project brief', 'Sitemap']
      },
      {
        name: 'Design & Development',
        description: 'Visual design, development, and content integration',
        estimatedDays: 10,
        order: 2,
        deliverables: ['Design mockups', 'Responsive site build']
      },
      {
        name: 'Testing & Launch',
        description: 'Quality assurance, client review, and deployment',
        estimatedDays: 14,
        order: 3,
        deliverables: ['Cross-browser testing', 'Live deployment']
      }
    ],
    better: [
      {
        name: 'Discovery & Planning',
        description: 'Consultation, requirements gathering, content strategy, and project planning',
        estimatedDays: 4,
        order: 1,
        deliverables: ['Project brief', 'Sitemap', 'Content outline', 'SEO keyword research']
      },
      {
        name: 'Design & Development',
        description: 'Visual design with revisions, responsive development, and content integration',
        estimatedDays: 12,
        order: 2,
        deliverables: ['Design mockups', 'Design revisions', 'Responsive site build', 'Content integration']
      },
      {
        name: 'SEO & Optimization',
        description: 'Search engine optimization, performance tuning, and analytics setup',
        estimatedDays: 16,
        order: 3,
        deliverables: ['On-page SEO', 'Performance optimization', 'Analytics setup']
      },
      {
        name: 'Testing & Launch',
        description: 'Comprehensive testing, client review, training, and deployment',
        estimatedDays: 18,
        order: 4,
        deliverables: ['Cross-browser testing', 'Mobile testing', 'Client training', 'Live deployment']
      }
    ],
    best: [
      {
        name: 'Discovery & Strategy',
        description:
          'Deep consultation, competitor analysis, content strategy, and detailed project planning',
        estimatedDays: 5,
        order: 1,
        deliverables: [
          'Project brief',
          'Sitemap',
          'Content strategy',
          'SEO keyword research',
          'Competitor analysis'
        ]
      },
      {
        name: 'Design',
        description: 'Custom visual design with multiple revision rounds and brand integration',
        estimatedDays: 12,
        order: 2,
        deliverables: ['Design concepts', 'Design revisions', 'Brand integration', 'Style guide']
      },
      {
        name: 'Development',
        description: 'Full responsive development with advanced features and integrations',
        estimatedDays: 20,
        order: 3,
        deliverables: [
          'Responsive build',
          'Advanced features',
          'Third-party integrations',
          'Content integration'
        ]
      },
      {
        name: 'SEO & Optimization',
        description: 'Comprehensive SEO, performance optimization, and analytics',
        estimatedDays: 24,
        order: 4,
        deliverables: [
          'Technical SEO',
          'On-page SEO',
          'Performance optimization',
          'Analytics & tracking'
        ]
      },
      {
        name: 'Testing & Launch',
        description:
          'Thorough QA, accessibility audit, training, and deployment with post-launch support',
        estimatedDays: 28,
        order: 5,
        deliverables: [
          'QA testing',
          'Accessibility audit',
          'Client training',
          'Live deployment',
          'Post-launch support plan'
        ]
      }
    ]
  },

  'business-site': {
    good: [
      {
        name: 'Discovery',
        description: 'Business analysis and requirements definition',
        estimatedDays: 5,
        order: 1,
        deliverables: ['Discovery document', 'Feature requirements']
      },
      {
        name: 'Design',
        description: 'Wireframes and visual design',
        estimatedDays: 12,
        order: 2,
        deliverables: ['Wireframes', 'Design mockups']
      },
      {
        name: 'Development',
        description: 'Frontend development and CMS setup',
        estimatedDays: 22,
        order: 3,
        deliverables: ['Responsive build', 'CMS configuration', 'Contact forms']
      },
      {
        name: 'Content Integration',
        description: 'Content population and basic SEO',
        estimatedDays: 27,
        order: 4,
        deliverables: ['Page content', 'Basic SEO setup']
      },
      {
        name: 'Testing & Launch',
        description: 'Testing and production deployment',
        estimatedDays: 32,
        order: 5,
        deliverables: ['QA testing', 'Live deployment']
      }
    ],
    better: [
      {
        name: 'Discovery',
        description: 'Business analysis, competitor research, and requirements definition',
        estimatedDays: 7,
        order: 1,
        deliverables: [
          'Discovery document',
          'Competitor analysis',
          'Feature requirements',
          'Content strategy'
        ]
      },
      {
        name: 'Design',
        description: 'Brand integration, wireframes, and visual design with revisions',
        estimatedDays: 15,
        order: 2,
        deliverables: ['Wireframes', 'Style guide', 'Design mockups', 'Design revisions']
      },
      {
        name: 'Development',
        description: 'Frontend development, CMS setup, and advanced functionality',
        estimatedDays: 28,
        order: 3,
        deliverables: [
          'Responsive build',
          'CMS configuration',
          'Contact forms',
          'Blog setup',
          'Newsletter integration'
        ]
      },
      {
        name: 'Content & SEO',
        description: 'Content population, SEO optimization, and analytics setup',
        estimatedDays: 35,
        order: 4,
        deliverables: ['Page content', 'SEO optimization', 'Image optimization', 'Analytics setup']
      },
      {
        name: 'Testing & Launch',
        description: 'Comprehensive testing, training, and production deployment',
        estimatedDays: 40,
        order: 5,
        deliverables: ['QA testing', 'Client training', 'Live deployment', 'Launch checklist']
      }
    ],
    best: [
      {
        name: 'Discovery & Strategy',
        description:
          'Deep business analysis, competitor research, content strategy, and detailed planning',
        estimatedDays: 10,
        order: 1,
        deliverables: [
          'Discovery document',
          'Competitor analysis',
          'Content strategy',
          'SEO strategy',
          'Project roadmap'
        ]
      },
      {
        name: 'Design',
        description:
          'Custom brand integration, wireframes, prototypes, and multiple design rounds',
        estimatedDays: 20,
        order: 2,
        deliverables: [
          'Wireframes',
          'Interactive prototypes',
          'Style guide',
          'Design system',
          'Design revisions'
        ]
      },
      {
        name: 'Development',
        description:
          'Full-featured development with CMS, integrations, and advanced functionality',
        estimatedDays: 35,
        order: 3,
        deliverables: [
          'Responsive build',
          'CMS configuration',
          'Advanced forms',
          'Blog',
          'Newsletter',
          'Third-party integrations'
        ]
      },
      {
        name: 'Content, SEO & Optimization',
        description:
          'Content population, comprehensive SEO, performance optimization, and analytics',
        estimatedDays: 42,
        order: 4,
        deliverables: [
          'Page content',
          'Technical SEO',
          'On-page SEO',
          'Performance optimization',
          'Analytics & tracking'
        ]
      },
      {
        name: 'Testing & Launch',
        description:
          'Thorough QA, accessibility, training, deployment, and post-launch support',
        estimatedDays: 48,
        order: 5,
        deliverables: [
          'QA testing',
          'Accessibility audit',
          'Client training',
          'Live deployment',
          'Post-launch support'
        ]
      },
      {
        name: 'Post-Launch Support',
        description: 'Ongoing support period with monitoring, updates, and optimization',
        estimatedDays: 78,
        order: 6,
        deliverables: ['Monitoring setup', 'Performance reports', 'Content updates', 'Bug fixes']
      }
    ]
  },

  'ecommerce-site': {
    good: [
      {
        name: 'Discovery & Planning',
        description: 'Business requirements and platform selection',
        estimatedDays: 7,
        order: 1,
        deliverables: ['Requirements document', 'Platform recommendation']
      },
      {
        name: 'Design',
        description: 'Store design and product page layouts',
        estimatedDays: 14,
        order: 2,
        deliverables: ['Store wireframes', 'Product page designs']
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
        description: 'Product import and categorization',
        estimatedDays: 35,
        order: 4,
        deliverables: ['Product catalog', 'Category structure']
      },
      {
        name: 'Testing & Launch',
        description: 'Order testing and production launch',
        estimatedDays: 45,
        order: 5,
        deliverables: ['Order flow testing', 'Payment testing', 'Store launch']
      }
    ],
    better: [
      {
        name: 'Discovery & Planning',
        description: 'Business requirements, competitor analysis, and platform selection',
        estimatedDays: 10,
        order: 1,
        deliverables: [
          'Requirements document',
          'Competitor analysis',
          'Platform recommendation',
          'Product structure'
        ]
      },
      {
        name: 'Design',
        description: 'Custom store design with checkout flow optimization',
        estimatedDays: 18,
        order: 2,
        deliverables: [
          'Store wireframes',
          'Product page designs',
          'Checkout flow',
          'Design revisions'
        ]
      },
      {
        name: 'Development',
        description: 'Full store development with advanced payment and shipping',
        estimatedDays: 35,
        order: 3,
        deliverables: [
          'Store setup',
          'Multiple payment gateways',
          'Shipping configuration',
          'Discount system'
        ]
      },
      {
        name: 'Product Setup & SEO',
        description: 'Product import, categorization, and store SEO',
        estimatedDays: 42,
        order: 4,
        deliverables: ['Product catalog', 'Inventory system', 'Category structure', 'Product SEO']
      },
      {
        name: 'Testing & Launch',
        description: 'Comprehensive store testing and launch',
        estimatedDays: 50,
        order: 5,
        deliverables: [
          'Order flow testing',
          'Payment testing',
          'Performance testing',
          'Store launch',
          'Training'
        ]
      }
    ],
    best: [
      {
        name: 'Discovery & Strategy',
        description:
          'Deep business analysis, competitor research, and comprehensive planning',
        estimatedDays: 12,
        order: 1,
        deliverables: [
          'Requirements document',
          'Competitor analysis',
          'Marketing strategy',
          'Platform recommendation',
          'Product structure'
        ]
      },
      {
        name: 'Design',
        description: 'Custom brand-integrated store design with UX optimization',
        estimatedDays: 22,
        order: 2,
        deliverables: [
          'Store wireframes',
          'Product page designs',
          'Checkout optimization',
          'Mobile design',
          'Design system'
        ]
      },
      {
        name: 'Development',
        description:
          'Full-featured store with advanced integrations and marketing tools',
        estimatedDays: 42,
        order: 3,
        deliverables: [
          'Store setup',
          'Multiple payment gateways',
          'Advanced shipping',
          'Discount system',
          'Email marketing integration',
          'Inventory management'
        ]
      },
      {
        name: 'Product Setup & SEO',
        description: 'Complete product catalog, SEO, and marketing setup',
        estimatedDays: 50,
        order: 4,
        deliverables: [
          'Product catalog',
          'Inventory system',
          'Category structure',
          'Product SEO',
          'Schema markup',
          'Social commerce'
        ]
      },
      {
        name: 'Testing & Optimization',
        description:
          'Comprehensive testing, performance optimization, and analytics',
        estimatedDays: 56,
        order: 5,
        deliverables: [
          'Order flow testing',
          'Payment testing',
          'Performance optimization',
          'Analytics setup',
          'Conversion tracking'
        ]
      },
      {
        name: 'Launch & Support',
        description:
          'Production launch, training, and post-launch support period',
        estimatedDays: 65,
        order: 6,
        deliverables: [
          'Store launch',
          'Staff training',
          'Post-launch monitoring',
          'Optimization reports'
        ]
      }
    ]
  },

  'web-app': {
    good: [
      {
        name: 'Discovery & Architecture',
        description: 'Requirements analysis and technical architecture',
        estimatedDays: 10,
        order: 1,
        deliverables: ['Technical spec', 'Architecture diagram']
      },
      {
        name: 'UI/UX Design',
        description: 'Wireframes and interface design',
        estimatedDays: 20,
        order: 2,
        deliverables: ['Wireframes', 'UI mockups']
      },
      {
        name: 'Core Development',
        description: 'Backend development and core functionality',
        estimatedDays: 40,
        order: 3,
        deliverables: ['Backend API', 'Database schema', 'Core features']
      },
      {
        name: 'Frontend Integration',
        description: 'Frontend development and API integration',
        estimatedDays: 50,
        order: 4,
        deliverables: ['Frontend application', 'API integration']
      },
      {
        name: 'Testing & Deployment',
        description: 'Testing and production deployment',
        estimatedDays: 60,
        order: 5,
        deliverables: ['Test coverage', 'Production deployment']
      }
    ],
    better: [
      {
        name: 'Discovery & Architecture',
        description:
          'Detailed requirements, technical architecture, and project planning',
        estimatedDays: 12,
        order: 1,
        deliverables: [
          'Technical spec',
          'Architecture diagram',
          'Project roadmap',
          'Security plan'
        ]
      },
      {
        name: 'UI/UX Design',
        description: 'User research, wireframes, prototypes, and interface design',
        estimatedDays: 24,
        order: 2,
        deliverables: ['User flows', 'Wireframes', 'Interactive prototypes', 'UI design system']
      },
      {
        name: 'Core Development',
        description:
          'Backend development, API creation, and core functionality with auth',
        estimatedDays: 48,
        order: 3,
        deliverables: [
          'Backend API',
          'Database schema',
          'Core features',
          'User authentication',
          'Role-based access'
        ]
      },
      {
        name: 'Frontend Integration',
        description: 'Frontend development, API integration, and state management',
        estimatedDays: 60,
        order: 4,
        deliverables: [
          'Frontend application',
          'API integration',
          'State management',
          'Error handling'
        ]
      },
      {
        name: 'Testing & Deployment',
        description: 'Testing, CI/CD setup, and production deployment',
        estimatedDays: 70,
        order: 5,
        deliverables: ['Test coverage', 'CI/CD pipeline', 'Production deployment', 'Documentation']
      }
    ],
    best: [
      {
        name: 'Discovery & Architecture',
        description:
          'Comprehensive requirements, architecture, security audit, and planning',
        estimatedDays: 15,
        order: 1,
        deliverables: [
          'Technical spec',
          'Architecture diagram',
          'Security audit',
          'Project roadmap',
          'Scalability plan'
        ]
      },
      {
        name: 'UI/UX Design',
        description:
          'Full user research, design system, prototypes, and usability testing',
        estimatedDays: 28,
        order: 2,
        deliverables: [
          'User research',
          'User flows',
          'Design system',
          'Interactive prototypes',
          'Usability testing'
        ]
      },
      {
        name: 'Core Development',
        description: 'Full backend with advanced auth, APIs, and integrations',
        estimatedDays: 50,
        order: 3,
        deliverables: [
          'Backend API',
          'Database schema',
          'Core features',
          'Auth system',
          'Third-party integrations',
          'Real-time features'
        ]
      },
      {
        name: 'Frontend Integration',
        description:
          'Full frontend with advanced state management and real-time features',
        estimatedDays: 65,
        order: 4,
        deliverables: [
          'Frontend application',
          'API integration',
          'Real-time UI',
          'Offline support',
          'Advanced state management'
        ]
      },
      {
        name: 'Testing & QA',
        description:
          'Comprehensive testing including security, performance, and accessibility',
        estimatedDays: 75,
        order: 5,
        deliverables: [
          'Unit tests',
          'Integration tests',
          'Security testing',
          'Performance testing',
          'Accessibility audit'
        ]
      },
      {
        name: 'Deployment & Support',
        description:
          'Production deployment, monitoring, documentation, and support period',
        estimatedDays: 85,
        order: 6,
        deliverables: [
          'CI/CD pipeline',
          'Production deployment',
          'Monitoring setup',
          'Technical documentation',
          'Post-launch support'
        ]
      }
    ]
  },

  maintenance: {
    good: [
      {
        name: 'Month 1 - Setup',
        description: 'Initial audit and monitoring setup',
        estimatedDays: 30,
        order: 1,
        deliverables: ['Site audit', 'Monitoring setup']
      },
      {
        name: 'Month 2 - Optimization',
        description: 'Performance optimization and security updates',
        estimatedDays: 60,
        order: 2,
        deliverables: ['Performance report', 'Security patches']
      },
      {
        name: 'Month 3 - Review',
        description: 'Quarterly review and planning',
        estimatedDays: 90,
        order: 3,
        deliverables: ['Quarterly report', 'Recommendations']
      }
    ],
    better: [
      {
        name: 'Month 1 - Setup & Audit',
        description: 'Comprehensive audit, monitoring, and maintenance schedule',
        estimatedDays: 30,
        order: 1,
        deliverables: [
          'Site audit',
          'Security audit',
          'Monitoring setup',
          'Maintenance schedule'
        ]
      },
      {
        name: 'Month 2 - Optimization',
        description: 'Performance optimization, security updates, and content updates',
        estimatedDays: 60,
        order: 2,
        deliverables: [
          'Performance report',
          'Security patches',
          'Content updates',
          'Optimization updates'
        ]
      },
      {
        name: 'Month 3 - Review & Planning',
        description: 'Quarterly review, analytics report, and next period planning',
        estimatedDays: 90,
        order: 3,
        deliverables: [
          'Quarterly report',
          'Analytics review',
          'Next period plan',
          'Recommendations'
        ]
      }
    ],
    best: [
      {
        name: 'Month 1 - Setup & Audit',
        description:
          'Comprehensive audit, monitoring, analytics, and maintenance schedule',
        estimatedDays: 30,
        order: 1,
        deliverables: [
          'Site audit',
          'Security audit',
          'Performance baseline',
          'Monitoring setup',
          'Maintenance schedule'
        ]
      },
      {
        name: 'Month 2 - Optimization & Updates',
        description:
          'Performance, security, content updates, and feature enhancements',
        estimatedDays: 60,
        order: 2,
        deliverables: [
          'Performance optimization',
          'Security patches',
          'Content updates',
          'Feature enhancements',
          'Backup verification'
        ]
      },
      {
        name: 'Month 3 - Review & Strategy',
        description:
          'Quarterly review, analytics deep-dive, strategy planning, and training',
        estimatedDays: 90,
        order: 3,
        deliverables: [
          'Quarterly report',
          'Analytics deep-dive',
          'Strategy plan',
          'Training session',
          'Recommendations'
        ]
      }
    ]
  },

  other: {
    good: [
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
    ],
    better: [
      {
        name: 'Phase 1 - Planning',
        description: 'Requirements gathering, research, and detailed project planning',
        estimatedDays: 10,
        order: 1,
        deliverables: ['Project plan', 'Requirements document', 'Research findings']
      },
      {
        name: 'Phase 2 - Design',
        description: 'Design phase with client review and revisions',
        estimatedDays: 18,
        order: 2,
        deliverables: ['Design concepts', 'Design revisions', 'Approved designs']
      },
      {
        name: 'Phase 3 - Execution',
        description: 'Development and implementation',
        estimatedDays: 30,
        order: 3,
        deliverables: ['Development work', 'Integration', 'Content']
      },
      {
        name: 'Phase 4 - Completion',
        description: 'Testing, review, and project handoff with documentation',
        estimatedDays: 35,
        order: 4,
        deliverables: ['Testing', 'Documentation', 'Training', 'Project handoff']
      }
    ],
    best: [
      {
        name: 'Phase 1 - Discovery & Planning',
        description: 'Comprehensive requirements, research, strategy, and detailed planning',
        estimatedDays: 12,
        order: 1,
        deliverables: ['Project plan', 'Requirements document', 'Research findings', 'Strategy document']
      },
      {
        name: 'Phase 2 - Design',
        description: 'Full design phase with multiple rounds and client collaboration',
        estimatedDays: 22,
        order: 2,
        deliverables: ['Design concepts', 'Design revisions', 'Style guide', 'Approved designs']
      },
      {
        name: 'Phase 3 - Execution',
        description: 'Full development with advanced features and integrations',
        estimatedDays: 38,
        order: 3,
        deliverables: ['Core development', 'Advanced features', 'Integrations', 'Content']
      },
      {
        name: 'Phase 4 - Quality Assurance',
        description: 'Comprehensive testing, accessibility audit, and performance optimization',
        estimatedDays: 45,
        order: 4,
        deliverables: ['Testing', 'Accessibility audit', 'Performance optimization']
      },
      {
        name: 'Phase 5 - Launch & Support',
        description: 'Deployment, documentation, training, and post-launch support',
        estimatedDays: 52,
        order: 5,
        deliverables: ['Deployment', 'Documentation', 'Training', 'Post-launch support']
      }
    ]
  }
};

/**
 * Get tier-specific milestone templates
 * Falls back to DEFAULT_MILESTONES via getMilestoneTemplates if no tier config exists
 */
export function getTierMilestoneTemplates(
  projectType: string | null | undefined,
  tier: string | null | undefined
): MilestoneTemplate[] {
  const normalizedType = normalizeProjectType(projectType);
  const normalizedTier = (tier || 'good').toLowerCase().trim();

  const projectConfig = TIER_MILESTONES[normalizedType];
  if (projectConfig && projectConfig[normalizedTier]) {
    return projectConfig[normalizedTier];
  }

  // Fallback: try just the project type with 'good' tier
  if (projectConfig && projectConfig['good']) {
    return projectConfig['good'];
  }

  // Final fallback: return empty so caller can use DEFAULT_MILESTONES
  return [];
}
