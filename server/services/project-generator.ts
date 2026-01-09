/**
 * ===============================================
 * PROJECT PLAN GENERATOR SERVICE
 * ===============================================
 * @file server/services/project-generator.ts
 *
 * Generates structured project plans and timelines
 * based on client intake form data.
 */

export interface IntakeData {
  company?: string;
  projectType: string;
  projectDescription: string;
  timeline: string;
  budget: string;
  features?: string | string[];
  addons?: string | string[];
  designLevel?: string;
  contentStatus?: string;
  techComfort?: string;
  hosting?: string;
  pages?: string;
  integrations?: string;
  brandAssets?: string | string[];
  inspiration?: string;
  currentSite?: string;
  challenges?: string;
  additionalInfo?: string;
  wasReferred?: string;
  referralName?: string;
}

interface ProjectTemplate {
  phases: string[];
  estimatedWeeks: number;
  basePrice: number;
  deliverables: string[];
}

interface FeatureAddition {
  price: number;
  deliverables: string[];
}

interface AddonAddition {
  price: number;
  deliverables: string[];
}

interface PhaseDetail {
  name: string;
  duration: string;
  tasks: string[];
  deliverables: string[];
}

interface Milestone {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  isCompleted: boolean;
  deliverables: string[];
}

interface PaymentPhase {
  phase: string;
  percentage: number;
  amount: number;
}

export interface ProjectPlan {
  projectId: number;
  projectType: string;
  summary: {
    title: string;
    description: string;
    estimatedDuration: string;
    estimatedPrice: string;
    startDate: string;
    estimatedDelivery: string;
  };
  phases: PhaseDetail[];
  milestones: Milestone[];
  deliverables: string[];
  technicalRequirements: string[];
  assumptions: string[];
  risks: string[];
  nextSteps: string[];
  paymentSchedule: PaymentPhase[];
  createdAt: string;
  estimatedDelivery: string;
}

/**
 * Generate a comprehensive project plan from intake data
 * @param {IntakeData} intakeData - Client intake form data
 * @param {number} projectId - Project ID
 * @returns {Promise<ProjectPlan>} Generated project plan
 */
export async function generateProjectPlan(
  intakeData: IntakeData,
  projectId: number
): Promise<ProjectPlan> {
  const projectType = intakeData.projectType;
  const features = Array.isArray(intakeData.features)
    ? intakeData.features
    : intakeData.features
      ? [intakeData.features]
      : [];
  const addons = Array.isArray(intakeData.addons)
    ? intakeData.addons
    : intakeData.addons
      ? [intakeData.addons]
      : [];

  // Base project structure based on type
  const baseTemplates: Record<string, ProjectTemplate> = {
    'simple-site': {
      phases: ['Planning & Design', 'Development', 'Testing & Launch'],
      estimatedWeeks: 2,
      basePrice: 1500,
      deliverables: ['Responsive Website', 'Mobile Optimization', 'Basic SEO Setup'],
    },
    'business-site': {
      phases: ['Discovery', 'Design', 'Development', 'Content Integration', 'Testing & Launch'],
      estimatedWeeks: 4,
      basePrice: 4000,
      deliverables: [
        'Professional Website',
        'CMS Integration',
        'SEO Setup',
        'Analytics',
        'Mobile Responsive',
      ],
    },
    portfolio: {
      phases: ['Planning', 'Design', 'Development', 'Content Integration', 'Launch'],
      estimatedWeeks: 3,
      basePrice: 2500,
      deliverables: [
        'Portfolio Website',
        'Project Galleries',
        'Contact Integration',
        'Mobile Responsive',
      ],
    },
    ecommerce: {
      phases: [
        'Planning',
        'Design',
        'E-commerce Setup',
        'Payment Integration',
        'Testing',
        'Launch',
      ],
      estimatedWeeks: 8,
      basePrice: 8000,
      deliverables: [
        'E-commerce Website',
        'Payment Processing',
        'Inventory Management',
        'Admin Dashboard',
      ],
    },
    'web-app': {
      phases: [
        'Discovery',
        'Architecture',
        'Backend Development',
        'Frontend Development',
        'Integration',
        'Testing',
        'Deployment',
      ],
      estimatedWeeks: 12,
      basePrice: 15000,
      deliverables: [
        'Web Application',
        'User Authentication',
        'Database Integration',
        'Admin Panel',
      ],
    },
    'browser-extension': {
      phases: ['Planning', 'Architecture', 'Development', 'Testing', 'Store Submission'],
      estimatedWeeks: 6,
      basePrice: 6000,
      deliverables: ['Browser Extension', 'Cross-browser Support', 'Store Listing'],
    },
  };

  const template = baseTemplates[projectType] || baseTemplates['business-site'];

  // Calculate additional features impact
  const featureAdditions = calculateFeatureAdditions(features, projectType);
  const addonAdditions = calculateAddonAdditions(addons);

  // Adjust timeline based on complexity
  const timelineMultiplier = getTimelineMultiplier(intakeData.timeline);
  const complexityMultiplier = getComplexityMultiplier(intakeData);

  const estimatedWeeks = Math.ceil(
    template.estimatedWeeks * complexityMultiplier * timelineMultiplier
  );
  const estimatedPrice = template.basePrice + featureAdditions.price + addonAdditions.price;

  // Generate phases with details
  const detailedPhases = generateDetailedPhases(template.phases, intakeData, features, addons);

  // Calculate delivery date
  const startDate = new Date();
  const estimatedDelivery = new Date(startDate);
  estimatedDelivery.setDate(startDate.getDate() + estimatedWeeks * 7);

  // Generate milestones
  const milestones = generateMilestones(detailedPhases, startDate, estimatedWeeks);

  const projectPlan: ProjectPlan = {
    projectId,
    projectType,
    summary: {
      title: `${intakeData.company} - ${getProjectTypeDisplayName(projectType)}`,
      description: intakeData.projectDescription,
      estimatedDuration: `${estimatedWeeks} weeks`,
      estimatedPrice: `$${estimatedPrice.toLocaleString()}`,
      startDate: startDate.toISOString().split('T')[0],
      estimatedDelivery: estimatedDelivery.toISOString().split('T')[0],
    },
    phases: detailedPhases,
    milestones,
    deliverables: [
      ...template.deliverables,
      ...featureAdditions.deliverables,
      ...addonAdditions.deliverables,
    ],
    technicalRequirements: generateTechnicalRequirements(intakeData),
    assumptions: generateAssumptions(intakeData),
    risks: generateRisks(intakeData),
    nextSteps: [
      'Review project plan and provide feedback',
      'Schedule discovery call to discuss details',
      'Sign project agreement and make initial payment',
      'Begin project development',
    ],
    paymentSchedule: generatePaymentSchedule(estimatedPrice, estimatedWeeks),
    createdAt: new Date().toISOString(),
    estimatedDelivery: estimatedDelivery.toISOString().split('T')[0],
  };

  return projectPlan;
}

function calculateFeatureAdditions(features: string[], projectType: string): FeatureAddition {
  const featurePricing: Record<string, { price: number; deliverable: string }> = {
    'contact-form': { price: 200, deliverable: 'Contact Form Integration' },
    blog: { price: 800, deliverable: 'Blog/CMS System' },
    gallery: { price: 500, deliverable: 'Photo Gallery' },
    testimonials: { price: 300, deliverable: 'Testimonials Section' },
    booking: { price: 1200, deliverable: 'Appointment Booking System' },
    cms: { price: 1000, deliverable: 'Content Management System' },
    'seo-pages': { price: 600, deliverable: 'SEO Optimization' },
    'user-authentication': { price: 1500, deliverable: 'User Authentication System' },
    'database-integration': { price: 2000, deliverable: 'Database Integration' },
    'api-integration': { price: 1000, deliverable: 'Third-party API Integration' },
    'real-time-features': { price: 2500, deliverable: 'Real-time Features' },
    'admin-panel': { price: 1800, deliverable: 'Admin Panel' },
    'shopping-cart': { price: 1500, deliverable: 'Shopping Cart System' },
    'payment-processing': { price: 1200, deliverable: 'Payment Processing' },
    'inventory-management': { price: 1800, deliverable: 'Inventory Management' },
  };

  let totalPrice = 0;
  const deliverables: string[] = [];

  features.forEach((feature) => {
    if (featurePricing[feature]) {
      totalPrice += featurePricing[feature].price;
      deliverables.push(featurePricing[feature].deliverable);
    }
  });

  return { price: totalPrice, deliverables };
}

function calculateAddonAdditions(addons: string[]): AddonAddition {
  const addonPricing: Record<string, { price: number; deliverable: string }> = {
    'maintenance-guide': { price: 500, deliverable: 'Maintenance Guide & Training' },
    'seo-setup': { price: 800, deliverable: 'SEO Setup & Optimization' },
    analytics: { price: 300, deliverable: 'Analytics Setup' },
    'backup-system': { price: 400, deliverable: 'Backup System Setup' },
    'ongoing-support': { price: 200, deliverable: 'Ongoing Support Plan' },
    copywriting: { price: 1000, deliverable: 'Professional Copywriting' },
  };

  let totalPrice = 0;
  const deliverables: string[] = [];

  addons.forEach((addon) => {
    if (addonPricing[addon]) {
      totalPrice += addonPricing[addon].price;
      deliverables.push(addonPricing[addon].deliverable);
    }
  });

  return { price: totalPrice, deliverables };
}

function getTimelineMultiplier(timeline: string): number {
  const multipliers: Record<string, number> = {
    asap: 1.5, // Rush job increases complexity
    '1-month': 1.2,
    '1-3-months': 1.0,
    '3-6-months': 0.9,
    flexible: 0.8,
  };
  return multipliers[timeline] || 1.0;
}

function getComplexityMultiplier(intakeData: IntakeData): number {
  let multiplier = 1.0;

  // Design complexity
  if (intakeData.designLevel === 'full-design') multiplier += 0.3;
  if (intakeData.designLevel === 'partial-design') multiplier += 0.1;

  // Content complexity
  if (intakeData.contentStatus === 'need-help') multiplier += 0.2;
  if (intakeData.contentStatus === 'partial') multiplier += 0.1;

  // Integration complexity
  if (intakeData.integrations && intakeData.integrations.toLowerCase() !== 'none') {
    multiplier += 0.2;
  }

  // Page count complexity
  const pageMultipliers: Record<string, number> = {
    '1-2': 0.8,
    '3-5': 1.0,
    '6-10': 1.2,
    '11-20': 1.5,
    '20-plus': 2.0,
    dynamic: 1.8,
  };
  multiplier *= pageMultipliers[intakeData.pages || ''] || 1.0;

  return Math.max(multiplier, 0.8); // Minimum multiplier
}

function generateDetailedPhases(
  phases: string[],
  intakeData: IntakeData,
  features: string[],
  addons: string[]
): PhaseDetail[] {
  const phaseDetails: Record<string, Omit<PhaseDetail, 'name'>> = {
    'Planning & Design': {
      duration: '3-5 days',
      tasks: ['Requirements analysis', 'Wireframes', 'Design mockups', 'Content planning'],
      deliverables: ['Project plan', 'Wireframes', 'Design concepts'],
    },
    Discovery: {
      duration: '5-7 days',
      tasks: [
        'Stakeholder interviews',
        'Competitive analysis',
        'Technical architecture',
        'Content audit',
      ],
      deliverables: ['Discovery document', 'Technical specifications', 'Content strategy'],
    },
    Design: {
      duration: '1-2 weeks',
      tasks: ['Visual design', 'User interface design', 'Responsive layouts', 'Brand integration'],
      deliverables: ['Design mockups', 'Style guide', 'Asset library'],
    },
    Development: {
      duration: '1-3 weeks',
      tasks: ['Frontend development', 'Backend development', 'Database setup', 'Integration work'],
      deliverables: ['Functional website', 'Database structure', 'Core features'],
    },
    'Content Integration': {
      duration: '3-5 days',
      tasks: ['Content input', 'Image optimization', 'SEO setup', 'Quality assurance'],
      deliverables: ['Complete content', 'Optimized images', 'SEO implementation'],
    },
    'Testing & Launch': {
      duration: '3-5 days',
      tasks: [
        'Cross-browser testing',
        'Mobile testing',
        'Performance optimization',
        'Launch preparation',
      ],
      deliverables: ['Tested website', 'Performance report', 'Launch checklist'],
    },
  };

  return phases.map((phase) => ({
    name: phase,
    ...(phaseDetails[phase] || {
      duration: '1 week',
      tasks: ['Phase-specific tasks'],
      deliverables: ['Phase deliverables'],
    }),
  }));
}

function generateMilestones(
  phases: PhaseDetail[],
  startDate: Date,
  totalWeeks: number
): Milestone[] {
  const milestones: Milestone[] = [];
  let currentDate = new Date(startDate);
  const daysPerPhase = Math.floor((totalWeeks * 7) / phases.length);

  phases.forEach((phase, index) => {
    const milestoneDate = new Date(currentDate);
    milestoneDate.setDate(currentDate.getDate() + daysPerPhase);

    milestones.push({
      id: index + 1,
      title: `${phase.name} Complete`,
      description: phase.deliverables.join(', '),
      dueDate: milestoneDate.toISOString().split('T')[0],
      isCompleted: false,
      deliverables: phase.deliverables,
    });

    currentDate = milestoneDate;
  });

  return milestones;
}

function generateTechnicalRequirements(intakeData: IntakeData): string[] {
  const requirements: string[] = [];

  // Hosting requirements
  if (intakeData.hosting === 'need-hosting') {
    requirements.push('Professional hosting setup and configuration');
  }

  // CMS requirements
  if (intakeData.features?.includes('cms')) {
    requirements.push('Content Management System implementation');
  }

  // Database requirements
  if (intakeData.features?.includes('database-integration')) {
    requirements.push('Database design and implementation');
  }

  // Mobile requirements
  requirements.push('Mobile-responsive design and development');

  // Browser compatibility
  requirements.push('Cross-browser compatibility (Chrome, Firefox, Safari, Edge)');

  // Performance requirements
  requirements.push('Page load speed optimization (< 3 seconds)');

  return requirements;
}

function generateAssumptions(intakeData: IntakeData): string[] {
  const assumptions = [
    'Client will provide feedback within 2 business days for each phase',
    'All content and assets will be provided in digital format',
    'Project scope will remain as defined in initial requirements',
  ];

  if (intakeData.contentStatus === 'ready') {
    assumptions.push('All content is final and ready for implementation');
  }

  if (intakeData.brandAssets?.includes('logo')) {
    assumptions.push('Brand assets are provided in high-resolution formats');
  }

  return assumptions;
}

function generateRisks(intakeData: IntakeData): string[] {
  const risks = [
    'Delays in content delivery may impact project timeline',
    'Third-party service integration may require additional testing time',
  ];

  if (intakeData.timeline === 'asap') {
    risks.push('Rushed timeline may limit revision opportunities');
  }

  if (intakeData.integrations && intakeData.integrations.toLowerCase() !== 'none') {
    risks.push('Third-party API changes or limitations may affect functionality');
  }

  return risks;
}

function generatePaymentSchedule(totalPrice: number, estimatedWeeks: number): PaymentPhase[] {
  if (totalPrice < 3000) {
    return [
      { phase: 'Project Start', percentage: 50, amount: totalPrice * 0.5 },
      { phase: 'Project Completion', percentage: 50, amount: totalPrice * 0.5 },
    ];
  } else if (totalPrice < 10000) {
    return [
      { phase: 'Project Start', percentage: 40, amount: totalPrice * 0.4 },
      { phase: 'Midpoint Review', percentage: 40, amount: totalPrice * 0.4 },
      { phase: 'Project Completion', percentage: 20, amount: totalPrice * 0.2 },
    ];
  }
  return [
    { phase: 'Project Start', percentage: 25, amount: totalPrice * 0.25 },
    { phase: 'Design Approval', percentage: 25, amount: totalPrice * 0.25 },
    { phase: 'Development Milestone', percentage: 25, amount: totalPrice * 0.25 },
    { phase: 'Project Completion', percentage: 25, amount: totalPrice * 0.25 },
  ];
}

function getProjectTypeDisplayName(projectType: string): string {
  const displayNames: Record<string, string> = {
    'simple-site': 'Simple Website',
    'business-site': 'Business Website',
    portfolio: 'Portfolio Website',
    ecommerce: 'E-commerce Store',
    'web-app': 'Web Application',
    'browser-extension': 'Browser Extension',
    other: 'Custom Project',
  };
  return displayNames[projectType] || 'Web Project';
}
