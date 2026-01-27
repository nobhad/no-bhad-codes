/**
 * ===============================================
 * PROPOSAL BUILDER - DATA DEFINITIONS
 * ===============================================
 * @file src/features/client/proposal-builder-data.ts
 *
 * Tier configurations, feature catalogs, and maintenance options
 * for the tiered proposal builder module.
 */

import type {
  ProjectType,
  TierId,
  ProposalTier,
  ProposalFeature,
  MaintenanceOption,
  MaintenanceId,
  TierConfiguration
} from './proposal-builder-types';

/**
 * Base features available across all project types
 * These serve as the foundation that tier-specific features build upon
 */
const BASE_FEATURES: ProposalFeature[] = [
  // Design Features
  {
    id: 'responsive-design',
    name: 'Responsive Design',
    description: 'Optimized layout for all devices (mobile, tablet, desktop)',
    price: 0,
    category: 'design',
    tiers: ['good', 'better', 'best'],
    isRequired: true
  },
  {
    id: 'basic-seo',
    name: 'Basic SEO Setup',
    description: 'Meta tags, sitemap, and search engine optimization fundamentals',
    price: 0,
    category: 'marketing',
    tiers: ['good', 'better', 'best'],
    isRequired: true
  },
  {
    id: 'custom-design',
    name: 'Custom Design',
    description: 'Unique visual design tailored to your brand (not a template)',
    price: 800,
    category: 'design',
    tiers: ['better', 'best']
  },
  {
    id: 'brand-package',
    name: 'Brand Package',
    description: 'Logo design, color palette, typography selection, and brand guidelines',
    price: 1500,
    category: 'design',
    tiers: ['best']
  },
  // Development Features
  {
    id: 'contact-form',
    name: 'Contact Form',
    description: 'Professional contact form with email notifications',
    price: 0,
    category: 'development',
    tiers: ['good', 'better', 'best'],
    isRequired: true
  },
  {
    id: 'cms',
    name: 'Content Management System',
    description: 'Easy-to-use admin panel for updating content without coding',
    price: 600,
    category: 'development',
    tiers: ['better', 'best']
  },
  {
    id: 'analytics',
    name: 'Analytics Integration',
    description: 'Google Analytics or similar tracking with custom dashboard',
    price: 300,
    category: 'marketing',
    tiers: ['better', 'best']
  },
  {
    id: 'social-integration',
    name: 'Social Media Integration',
    description: 'Social sharing buttons and feed integration',
    price: 250,
    category: 'development',
    tiers: ['good', 'better', 'best']
  },
  // Support Features
  {
    id: 'priority-support',
    name: 'Priority Support',
    description: '24-hour response time and dedicated support channel',
    price: 500,
    category: 'support',
    tiers: ['best']
  },
  {
    id: 'training-session',
    name: 'Training Session',
    description: '1-hour video call walkthrough of your new site',
    price: 200,
    category: 'support',
    tiers: ['better', 'best']
  }
];

/**
 * Simple Site tier configuration
 */
const SIMPLE_SITE_TIERS: ProposalTier[] = [
  {
    id: 'good',
    name: 'Foundation',
    tagline: 'Essential online presence',
    priceRange: { min: 800, max: 1500 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form', 'social-integration'],
    description: 'Perfect for landing pages and simple 1-2 page sites'
  },
  {
    id: 'better',
    name: 'Professional',
    tagline: 'Recommended for most projects',
    priceRange: { min: 1500, max: 2500 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form', 'social-integration', 'custom-design', 'analytics', 'training-session'],
    highlighted: true,
    description: 'Custom design with professional features'
  },
  {
    id: 'best',
    name: 'Premium',
    tagline: 'Full-service solution',
    priceRange: { min: 2500, max: 3500 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form', 'social-integration', 'custom-design', 'analytics', 'training-session', 'cms', 'priority-support'],
    description: 'Everything you need plus ongoing support'
  }
];

const SIMPLE_SITE_FEATURES: ProposalFeature[] = [
  ...BASE_FEATURES,
  {
    id: 'age-verification',
    name: 'Age Verification',
    description: 'Age gate for restricted content',
    price: 150,
    category: 'development',
    tiers: []
  },
  {
    id: 'newsletter-signup',
    name: 'Newsletter Signup',
    description: 'Email collection with Mailchimp/ConvertKit integration',
    price: 200,
    category: 'marketing',
    tiers: ['better', 'best']
  }
];

/**
 * Business Site tier configuration
 */
const BUSINESS_SITE_TIERS: ProposalTier[] = [
  {
    id: 'good',
    name: 'Foundation',
    tagline: 'Professional business presence',
    priceRange: { min: 2000, max: 3500 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form', 'social-integration'],
    description: 'Core pages and professional design'
  },
  {
    id: 'better',
    name: 'Professional',
    tagline: 'Recommended for growing businesses',
    priceRange: { min: 4000, max: 6000 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form', 'social-integration', 'custom-design', 'cms', 'analytics', 'training-session', 'blog'],
    highlighted: true,
    description: 'Full-featured site with content management'
  },
  {
    id: 'best',
    name: 'Enterprise',
    tagline: 'Complete business solution',
    priceRange: { min: 5500, max: 8000 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form', 'social-integration', 'custom-design', 'cms', 'analytics', 'training-session', 'blog', 'brand-package', 'priority-support', 'advanced-seo'],
    description: 'Everything plus branding and priority support'
  }
];

const BUSINESS_SITE_FEATURES: ProposalFeature[] = [
  ...BASE_FEATURES,
  {
    id: 'blog',
    name: 'Blog/News Section',
    description: 'Full-featured blog with categories, tags, and search',
    price: 500,
    category: 'development',
    tiers: ['better', 'best']
  },
  {
    id: 'gallery',
    name: 'Photo Gallery',
    description: 'Image gallery with lightbox and categories',
    price: 350,
    category: 'development',
    tiers: []
  },
  {
    id: 'testimonials',
    name: 'Testimonials Section',
    description: 'Customer reviews with ratings and management',
    price: 300,
    category: 'development',
    tiers: ['better', 'best']
  },
  {
    id: 'booking',
    name: 'Appointment Booking',
    description: 'Online scheduling with calendar integration',
    price: 800,
    category: 'development',
    tiers: []
  },
  {
    id: 'advanced-seo',
    name: 'Advanced SEO',
    description: 'Keyword research, content optimization, and local SEO',
    price: 600,
    category: 'marketing',
    tiers: ['best']
  },
  {
    id: 'age-verification',
    name: 'Age Verification',
    description: 'Age gate for restricted content',
    price: 150,
    category: 'development',
    tiers: []
  }
];

/**
 * Portfolio tier configuration
 */
const PORTFOLIO_TIERS: ProposalTier[] = [
  {
    id: 'good',
    name: 'Starter',
    tagline: 'Showcase your work',
    priceRange: { min: 1500, max: 3000 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form', 'portfolio-gallery'],
    description: 'Clean portfolio presentation'
  },
  {
    id: 'better',
    name: 'Professional',
    tagline: 'Recommended for creatives',
    priceRange: { min: 3000, max: 5000 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form', 'portfolio-gallery', 'custom-design', 'cms', 'analytics', 'case-studies', 'training-session'],
    highlighted: true,
    description: 'Custom design with case study features'
  },
  {
    id: 'best',
    name: 'Premium',
    tagline: 'Stand out from the crowd',
    priceRange: { min: 5000, max: 8000 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form', 'portfolio-gallery', 'custom-design', 'cms', 'analytics', 'case-studies', 'training-session', 'brand-package', 'blog', 'priority-support'],
    description: 'Full creative package with branding'
  }
];

const PORTFOLIO_FEATURES: ProposalFeature[] = [
  ...BASE_FEATURES,
  {
    id: 'portfolio-gallery',
    name: 'Portfolio Gallery',
    description: 'Filterable project showcase with categories',
    price: 400,
    category: 'development',
    tiers: ['good', 'better', 'best']
  },
  {
    id: 'case-studies',
    name: 'Case Study Pages',
    description: 'In-depth project breakdowns with process documentation',
    price: 500,
    category: 'development',
    tiers: ['better', 'best']
  },
  {
    id: 'resume-download',
    name: 'Resume/CV Download',
    description: 'Downloadable PDF resume with tracking',
    price: 150,
    category: 'development',
    tiers: ['good', 'better', 'best']
  },
  {
    id: 'blog',
    name: 'Blog/Articles',
    description: 'Personal blog for thought leadership',
    price: 500,
    category: 'development',
    tiers: ['best']
  }
];

/**
 * E-commerce tier configuration
 */
const ECOMMERCE_TIERS: ProposalTier[] = [
  {
    id: 'good',
    name: 'Starter Store',
    tagline: 'Start selling online',
    priceRange: { min: 5000, max: 10000 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form', 'shopping-cart', 'payment-processing', 'product-management'],
    description: 'Essential e-commerce features'
  },
  {
    id: 'better',
    name: 'Professional Store',
    tagline: 'Recommended for growing businesses',
    priceRange: { min: 10000, max: 20000 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form', 'shopping-cart', 'payment-processing', 'product-management', 'custom-design', 'inventory-management', 'user-accounts', 'analytics', 'training-session'],
    highlighted: true,
    description: 'Full-featured store with inventory'
  },
  {
    id: 'best',
    name: 'Enterprise Store',
    tagline: 'Complete commerce solution',
    priceRange: { min: 20000, max: 35000 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form', 'shopping-cart', 'payment-processing', 'product-management', 'custom-design', 'inventory-management', 'user-accounts', 'analytics', 'training-session', 'brand-package', 'admin-dashboard', 'advanced-seo', 'priority-support'],
    description: 'Everything for serious e-commerce'
  }
];

const ECOMMERCE_FEATURES: ProposalFeature[] = [
  ...BASE_FEATURES,
  {
    id: 'shopping-cart',
    name: 'Shopping Cart',
    description: 'Full cart functionality with saved items',
    price: 0,
    category: 'development',
    tiers: ['good', 'better', 'best'],
    isRequired: true
  },
  {
    id: 'payment-processing',
    name: 'Payment Processing',
    description: 'Stripe/PayPal integration with secure checkout',
    price: 0,
    category: 'development',
    tiers: ['good', 'better', 'best'],
    isRequired: true
  },
  {
    id: 'product-management',
    name: 'Product Management',
    description: 'Add, edit, and organize products with variants',
    price: 0,
    category: 'development',
    tiers: ['good', 'better', 'best'],
    isRequired: true
  },
  {
    id: 'inventory-management',
    name: 'Inventory Tracking',
    description: 'Stock levels, low-stock alerts, and reorder notifications',
    price: 800,
    category: 'development',
    tiers: ['better', 'best']
  },
  {
    id: 'user-accounts',
    name: 'Customer Accounts',
    description: 'User registration, order history, and saved addresses',
    price: 600,
    category: 'development',
    tiers: ['better', 'best']
  },
  {
    id: 'admin-dashboard',
    name: 'Admin Dashboard',
    description: 'Sales reports, customer management, and order processing',
    price: 1200,
    category: 'development',
    tiers: ['best']
  },
  {
    id: 'age-verification',
    name: 'Age Verification',
    description: 'Age gate for restricted products',
    price: 200,
    category: 'development',
    tiers: []
  },
  {
    id: 'discount-codes',
    name: 'Discount Codes',
    description: 'Coupon codes and promotional pricing',
    price: 400,
    category: 'development',
    tiers: ['better', 'best']
  },
  {
    id: 'shipping-integration',
    name: 'Shipping Integration',
    description: 'Real-time shipping rates and label printing',
    price: 500,
    category: 'development',
    tiers: []
  },
  {
    id: 'advanced-seo',
    name: 'Advanced SEO',
    description: 'Product SEO, schema markup, and optimization',
    price: 600,
    category: 'marketing',
    tiers: ['best']
  }
];

/**
 * Web App tier configuration
 */
const WEB_APP_TIERS: ProposalTier[] = [
  {
    id: 'good',
    name: 'MVP',
    tagline: 'Launch your idea',
    priceRange: { min: 10000, max: 25000 },
    baseFeatures: ['responsive-design', 'user-authentication', 'database-integration', 'basic-dashboard'],
    description: 'Minimum viable product to validate your idea'
  },
  {
    id: 'better',
    name: 'Full Application',
    tagline: 'Recommended for most apps',
    priceRange: { min: 25000, max: 50000 },
    baseFeatures: ['responsive-design', 'user-authentication', 'database-integration', 'basic-dashboard', 'custom-design', 'api-integration', 'user-dashboard', 'analytics', 'training-session'],
    highlighted: true,
    description: 'Production-ready application'
  },
  {
    id: 'best',
    name: 'Enterprise Application',
    tagline: 'Complete platform solution',
    priceRange: { min: 50000, max: 100000 },
    baseFeatures: ['responsive-design', 'user-authentication', 'database-integration', 'basic-dashboard', 'custom-design', 'api-integration', 'user-dashboard', 'analytics', 'training-session', 'admin-panel', 'priority-support', 'advanced-security'],
    description: 'Full-scale application with admin tools'
  }
];

const WEB_APP_FEATURES: ProposalFeature[] = [
  ...BASE_FEATURES,
  {
    id: 'user-authentication',
    name: 'User Authentication',
    description: 'Secure login, registration, and password recovery',
    price: 0,
    category: 'development',
    tiers: ['good', 'better', 'best'],
    isRequired: true
  },
  {
    id: 'database-integration',
    name: 'Database Integration',
    description: 'Secure data storage and management',
    price: 0,
    category: 'development',
    tiers: ['good', 'better', 'best'],
    isRequired: true
  },
  {
    id: 'basic-dashboard',
    name: 'Basic Dashboard',
    description: 'Core user interface for main functionality',
    price: 0,
    category: 'development',
    tiers: ['good', 'better', 'best'],
    isRequired: true
  },
  {
    id: 'api-integration',
    name: 'Third-party API Integration',
    description: 'Connect with external services and APIs',
    price: 1500,
    category: 'development',
    tiers: ['better', 'best']
  },
  {
    id: 'user-dashboard',
    name: 'Advanced User Dashboard',
    description: 'Rich user interface with data visualization',
    price: 2000,
    category: 'development',
    tiers: ['better', 'best']
  },
  {
    id: 'admin-panel',
    name: 'Admin Panel',
    description: 'Complete admin interface for managing users and data',
    price: 3000,
    category: 'development',
    tiers: ['best']
  },
  {
    id: 'advanced-security',
    name: 'Advanced Security',
    description: 'Two-factor auth, encryption, and security audit',
    price: 2500,
    category: 'development',
    tiers: ['best']
  },
  {
    id: 'email-notifications',
    name: 'Email Notifications',
    description: 'Automated email system with templates',
    price: 600,
    category: 'development',
    tiers: ['better', 'best']
  },
  {
    id: 'file-uploads',
    name: 'File Upload System',
    description: 'Secure file storage and management',
    price: 800,
    category: 'development',
    tiers: []
  },
  {
    id: 'age-verification',
    name: 'Age Verification',
    description: 'Age gate for restricted content',
    price: 200,
    category: 'development',
    tiers: []
  }
];

/**
 * Browser Extension tier configuration
 */
const BROWSER_EXTENSION_TIERS: ProposalTier[] = [
  {
    id: 'good',
    name: 'Basic Extension',
    tagline: 'Simple browser tool',
    priceRange: { min: 3000, max: 6000 },
    baseFeatures: ['popup-interface', 'data-storage', 'basic-functionality'],
    description: 'Single-purpose extension'
  },
  {
    id: 'better',
    name: 'Advanced Extension',
    tagline: 'Recommended for most extensions',
    priceRange: { min: 6000, max: 12000 },
    baseFeatures: ['popup-interface', 'data-storage', 'basic-functionality', 'content-modification', 'background-processing', 'custom-design', 'training-session'],
    highlighted: true,
    description: 'Full-featured browser extension'
  },
  {
    id: 'best',
    name: 'Premium Extension',
    tagline: 'Enterprise-grade solution',
    priceRange: { min: 12000, max: 20000 },
    baseFeatures: ['popup-interface', 'data-storage', 'basic-functionality', 'content-modification', 'background-processing', 'custom-design', 'training-session', 'cross-browser', 'sync-storage', 'priority-support'],
    description: 'Cross-browser with sync capabilities'
  }
];

const BROWSER_EXTENSION_FEATURES: ProposalFeature[] = [
  ...BASE_FEATURES.filter(f => ['priority-support', 'training-session', 'custom-design'].includes(f.id)),
  {
    id: 'popup-interface',
    name: 'Popup Interface',
    description: 'Clean popup UI for quick access',
    price: 0,
    category: 'development',
    tiers: ['good', 'better', 'best'],
    isRequired: true
  },
  {
    id: 'data-storage',
    name: 'Local Data Storage',
    description: 'Store preferences and data locally',
    price: 0,
    category: 'development',
    tiers: ['good', 'better', 'best'],
    isRequired: true
  },
  {
    id: 'basic-functionality',
    name: 'Core Functionality',
    description: 'Main extension features and logic',
    price: 0,
    category: 'development',
    tiers: ['good', 'better', 'best'],
    isRequired: true
  },
  {
    id: 'content-modification',
    name: 'Page Content Modification',
    description: 'Inject content or modify web pages',
    price: 800,
    category: 'development',
    tiers: ['better', 'best']
  },
  {
    id: 'background-processing',
    name: 'Background Processing',
    description: 'Run tasks in the background',
    price: 600,
    category: 'development',
    tiers: ['better', 'best']
  },
  {
    id: 'cross-browser',
    name: 'Cross-browser Compatibility',
    description: 'Works on Chrome, Firefox, Edge, and Safari',
    price: 2000,
    category: 'development',
    tiers: ['best']
  },
  {
    id: 'sync-storage',
    name: 'Sync Storage',
    description: 'Sync data across devices via browser account',
    price: 500,
    category: 'development',
    tiers: ['best']
  },
  {
    id: 'api-integration',
    name: 'API Integration',
    description: 'Connect with external services',
    price: 1000,
    category: 'development',
    tiers: []
  }
];

/**
 * Other/Custom project tier configuration
 */
const OTHER_TIERS: ProposalTier[] = [
  {
    id: 'good',
    name: 'Basic',
    tagline: 'Essential features',
    priceRange: { min: 3000, max: 8000 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form'],
    description: 'Core functionality for your custom project'
  },
  {
    id: 'better',
    name: 'Standard',
    tagline: 'Recommended approach',
    priceRange: { min: 8000, max: 20000 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form', 'custom-design', 'analytics', 'training-session'],
    highlighted: true,
    description: 'Full-featured custom solution'
  },
  {
    id: 'best',
    name: 'Premium',
    tagline: 'Complete solution',
    priceRange: { min: 20000, max: 50000 },
    baseFeatures: ['responsive-design', 'basic-seo', 'contact-form', 'custom-design', 'analytics', 'training-session', 'priority-support'],
    description: 'Enterprise-grade custom development'
  }
];

const OTHER_FEATURES: ProposalFeature[] = [
  ...BASE_FEATURES,
  {
    id: 'user-authentication',
    name: 'User Authentication',
    description: 'Secure login and user management',
    price: 1500,
    category: 'development',
    tiers: []
  },
  {
    id: 'database-integration',
    name: 'Database Integration',
    description: 'Custom data storage and management',
    price: 2000,
    category: 'development',
    tiers: []
  },
  {
    id: 'api-integration',
    name: 'API Integration',
    description: 'Third-party service connections',
    price: 1500,
    category: 'development',
    tiers: []
  },
  {
    id: 'admin-panel',
    name: 'Admin Panel',
    description: 'Administrative interface for management',
    price: 3000,
    category: 'development',
    tiers: []
  },
  {
    id: 'age-verification',
    name: 'Age Verification',
    description: 'Age gate for restricted content',
    price: 200,
    category: 'development',
    tiers: []
  }
];

/**
 * Maintenance options available for all project types
 */
export const MAINTENANCE_OPTIONS: MaintenanceOption[] = [
  {
    id: 'diy',
    name: 'DIY',
    price: 0,
    billingCycle: 'monthly',
    features: [
      'Documentation provided',
      'Email support for questions',
      'Self-managed hosting'
    ],
    description: 'Handle updates yourself with our documentation'
  },
  {
    id: 'essential',
    name: 'Essential Care',
    price: 99,
    billingCycle: 'monthly',
    features: [
      'Monthly security updates',
      'Weekly backups',
      'Email support (48hr response)',
      'Uptime monitoring'
    ],
    description: 'Basic maintenance and security'
  },
  {
    id: 'standard',
    name: 'Standard Care',
    price: 249,
    billingCycle: 'monthly',
    features: [
      'Weekly security updates',
      'Daily backups',
      'Email support (24hr response)',
      'Uptime monitoring',
      '2 hours content updates/month',
      'Performance monitoring'
    ],
    highlighted: true,
    description: 'Recommended for most businesses'
  },
  {
    id: 'premium',
    name: 'Premium Care',
    price: 499,
    billingCycle: 'monthly',
    features: [
      'Continuous security monitoring',
      'Hourly backups',
      'Priority support (4hr response)',
      'Uptime monitoring with alerts',
      '5 hours updates/month',
      'Performance optimization',
      'Monthly analytics reports',
      'Dedicated account manager'
    ],
    description: 'White-glove service for critical sites'
  }
];

/**
 * Map of project types to their configurations
 */
const TIER_CONFIGURATIONS: Record<ProjectType, { tiers: ProposalTier[]; features: ProposalFeature[] }> = {
  'simple-site': { tiers: SIMPLE_SITE_TIERS, features: SIMPLE_SITE_FEATURES },
  'business-site': { tiers: BUSINESS_SITE_TIERS, features: BUSINESS_SITE_FEATURES },
  'portfolio': { tiers: PORTFOLIO_TIERS, features: PORTFOLIO_FEATURES },
  'ecommerce': { tiers: ECOMMERCE_TIERS, features: ECOMMERCE_FEATURES },
  'web-app': { tiers: WEB_APP_TIERS, features: WEB_APP_FEATURES },
  'browser-extension': { tiers: BROWSER_EXTENSION_TIERS, features: BROWSER_EXTENSION_FEATURES },
  'other': { tiers: OTHER_TIERS, features: OTHER_FEATURES }
};

/**
 * Get tier configuration for a specific project type
 */
export function getTierConfiguration(projectType: ProjectType): TierConfiguration {
  const config = TIER_CONFIGURATIONS[projectType] || TIER_CONFIGURATIONS['other'];
  return {
    projectType,
    tiers: config.tiers,
    features: config.features,
    maintenanceOptions: MAINTENANCE_OPTIONS
  };
}

/**
 * Get a specific tier by ID for a project type
 */
export function getTierById(projectType: ProjectType, tierId: TierId): ProposalTier | undefined {
  const config = getTierConfiguration(projectType);
  return config.tiers.find(t => t.id === tierId);
}

/**
 * Get features included in a specific tier
 */
export function getFeaturesForTier(projectType: ProjectType, tierId: TierId): ProposalFeature[] {
  const config = getTierConfiguration(projectType);
  const tier = config.tiers.find(t => t.id === tierId);
  if (!tier) return [];

  return config.features.filter(f => tier.baseFeatures.includes(f.id));
}

/**
 * Get available add-on features (not included in selected tier)
 */
export function getAvailableAddons(projectType: ProjectType, tierId: TierId): ProposalFeature[] {
  const config = getTierConfiguration(projectType);
  const tier = config.tiers.find(t => t.id === tierId);
  if (!tier) return [];

  return config.features.filter(
    f => !tier.baseFeatures.includes(f.id) && !f.isRequired && f.price > 0
  );
}

/**
 * Calculate total price based on selection
 */
export function calculatePrice(
  projectType: ProjectType,
  tierId: TierId,
  addedFeatureIds: string[],
  maintenanceId: MaintenanceId | null
): number {
  const config = getTierConfiguration(projectType);
  const tier = config.tiers.find(t => t.id === tierId);
  if (!tier) return 0;

  // Use midpoint of tier price range as base
  const basePrice = Math.round((tier.priceRange.min + tier.priceRange.max) / 2);

  // Add feature prices
  const featureTotal = addedFeatureIds.reduce((total, featureId) => {
    const feature = config.features.find(f => f.id === featureId);
    return total + (feature?.price || 0);
  }, 0);

  // Maintenance is recurring, not added to one-time price
  // But we can show it separately in the UI

  return basePrice + featureTotal;
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

/**
 * Format price range for display
 */
export function formatPriceRange(min: number, max: number): string {
  return `${formatPrice(min)} - ${formatPrice(max)}`;
}
