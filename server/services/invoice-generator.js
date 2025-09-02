/**
 * ===============================================
 * INVOICE GENERATOR SERVICE
 * ===============================================
 * @file server/services/invoice-generator.js
 * 
 * Generates invoices based on project requirements
 * and intake form data.
 */

/**
 * Generate an invoice based on intake data
 * @param {Object} intakeData - Client intake form data
 * @param {number} projectId - Project ID
 * @param {number} clientId - Client ID
 * @returns {Promise<Object>} Generated invoice
 */
export async function generateInvoice(intakeData, projectId, clientId) {
  const projectType = intakeData.projectType;
  const features = Array.isArray(intakeData.features) ? intakeData.features : [intakeData.features].filter(Boolean);
  const addons = Array.isArray(intakeData.addons) ? intakeData.addons : [intakeData.addons].filter(Boolean);

  // Base pricing structure
  const basePricing = {
    'simple-site': { price: 1500, description: 'Simple Website Development' },
    'business-site': { price: 4000, description: 'Business Website Development' },
    'portfolio': { price: 2500, description: 'Portfolio Website Development' },
    'ecommerce': { price: 8000, description: 'E-commerce Store Development' },
    'web-app': { price: 15000, description: 'Web Application Development' },
    'browser-extension': { price: 6000, description: 'Browser Extension Development' },
    'other': { price: 3000, description: 'Custom Web Project Development' }
  };

  const baseItem = basePricing[projectType] || basePricing['other'];

  // Generate line items
  const lineItems = [
    {
      id: 1,
      description: baseItem.description,
      type: 'base',
      quantity: 1,
      unitPrice: baseItem.price,
      totalPrice: baseItem.price
    }
  ];

  let itemId = 2;

  // Add feature line items
  const featureItems = generateFeatureLineItems(features, projectType);
  featureItems.forEach(item => {
    lineItems.push({ ...item, id: itemId++ });
  });

  // Add addon line items
  const addonItems = generateAddonLineItems(addons);
  addonItems.forEach(item => {
    lineItems.push({ ...item, id: itemId++ });
  });

  // Add complexity adjustments
  const complexityAdjustments = calculateComplexityAdjustments(intakeData);
  if (complexityAdjustments.length > 0) {
    complexityAdjustments.forEach(adjustment => {
      lineItems.push({ ...adjustment, id: itemId++ });
    });
  }

  // Calculate totals
  const subtotal = lineItems.reduce((total, item) => total + item.totalPrice, 0);
  const taxRate = 0; // Adjust based on jurisdiction
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // Generate payment terms
  const paymentTerms = generatePaymentTerms(total, intakeData.timeline);

  // Create invoice object
  const invoice = {
    projectId,
    clientId,
    invoiceNumber: generateInvoiceNumber(),
    status: 'draft',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: calculateDueDate(paymentTerms[0]?.dueInDays || 7),
    lineItems,
    subtotal,
    taxRate,
    taxAmount,
    total,
    paymentTerms,
    notes: generateInvoiceNotes(intakeData),
    termsAndConditions: getTermsAndConditions(),
    createdAt: new Date().toISOString()
  };

  return invoice;
}

function generateFeatureLineItems(features, projectType) {
  const featurePricing = {
    // Universal features
    'contact-form': { price: 200, description: 'Contact Form Integration' },
    'analytics': { price: 150, description: 'Analytics & Tracking Setup' },
    'mobile-optimized': { price: 300, description: 'Mobile Optimization' },
    'social-links': { price: 100, description: 'Social Media Integration' },
    
    // Business site features
    'blog': { price: 800, description: 'Blog/CMS System Development' },
    'gallery': { price: 500, description: 'Photo Gallery Implementation' },
    'testimonials': { price: 300, description: 'Testimonials Section' },
    'booking': { price: 1200, description: 'Appointment Booking System' },
    'cms': { price: 1000, description: 'Content Management System' },
    'seo-pages': { price: 600, description: 'SEO Optimization Setup' },
    
    // Portfolio features
    'portfolio-gallery': { price: 600, description: 'Project Portfolio Gallery' },
    'case-studies': { price: 800, description: 'Case Studies Implementation' },
    'resume-download': { price: 200, description: 'Resume/CV Download Feature' },
    
    // E-commerce features
    'shopping-cart': { price: 1500, description: 'Shopping Cart System' },
    'payment-processing': { price: 1200, description: 'Payment Gateway Integration' },
    'inventory-management': { price: 1800, description: 'Inventory Management System' },
    'user-accounts': { price: 1000, description: 'User Account System' },
    'admin-dashboard': { price: 1800, description: 'Admin Dashboard' },
    'shipping-calculator': { price: 600, description: 'Shipping Calculator' },
    
    // Web app features
    'user-authentication': { price: 1500, description: 'User Authentication System' },
    'database-integration': { price: 2000, description: 'Database Design & Integration' },
    'api-integration': { price: 1000, description: 'Third-party API Integration' },
    'user-dashboard': { price: 1500, description: 'User Dashboard Interface' },
    'real-time-features': { price: 2500, description: 'Real-time Features Implementation' },
    'admin-panel': { price: 1800, description: 'Administrative Panel' },
    
    // Browser extension features
    'popup-interface': { price: 800, description: 'Extension Popup Interface' },
    'content-modification': { price: 1200, description: 'Page Content Modification' },
    'background-processing': { price: 1000, description: 'Background Processing Logic' },
    'data-storage': { price: 600, description: 'Extension Data Storage' },
    'external-api': { price: 800, description: 'External API Integration' },
    'cross-browser': { price: 1200, description: 'Cross-browser Compatibility' },
    
    // Simple site features
    'age-verification': { price: 400, description: 'Age Verification System' },
    'basic-only': { price: 0, description: 'Basic Static Pages (included)' }
  };

  const lineItems = [];

  features.forEach(feature => {
    if (featurePricing[feature]) {
      const item = featurePricing[feature];
      if (item.price > 0) { // Only add if there's a cost
        lineItems.push({
          description: item.description,
          type: 'feature',
          quantity: 1,
          unitPrice: item.price,
          totalPrice: item.price
        });
      }
    }
  });

  return lineItems;
}

function generateAddonLineItems(addons) {
  const addonPricing = {
    'maintenance-guide': { price: 500, description: 'Maintenance Guide & Training Session' },
    'seo-setup': { price: 800, description: 'Comprehensive SEO Setup' },
    'analytics': { price: 300, description: 'Advanced Analytics Configuration' },
    'backup-system': { price: 400, description: 'Automated Backup System Setup' },
    'ongoing-support': { price: 0, description: 'Ongoing Support Plan (Monthly billing)' },
    'copywriting': { price: 1000, description: 'Professional Copywriting Services' }
  };

  const lineItems = [];

  addons.forEach(addon => {
    if (addonPricing[addon]) {
      const item = addonPricing[addon];
      if (item.price > 0) { // Only add if there's a one-time cost
        lineItems.push({
          description: item.description,
          type: 'addon',
          quantity: 1,
          unitPrice: item.price,
          totalPrice: item.price
        });
      }
    }
  });

  return lineItems;
}

function calculateComplexityAdjustments(intakeData) {
  const adjustments = [];

  // Design complexity adjustment
  if (intakeData.designLevel === 'full-design') {
    adjustments.push({
      description: 'Custom Design Development',
      type: 'adjustment',
      quantity: 1,
      unitPrice: 1500,
      totalPrice: 1500
    });
  } else if (intakeData.designLevel === 'partial-design') {
    adjustments.push({
      description: 'Design Consultation & Guidance',
      type: 'adjustment',
      quantity: 1,
      unitPrice: 500,
      totalPrice: 500
    });
  }

  // Content creation adjustment
  if (intakeData.contentStatus === 'need-help') {
    adjustments.push({
      description: 'Content Creation Services',
      type: 'adjustment',
      quantity: 1,
      unitPrice: 1200,
      totalPrice: 1200
    });
  } else if (intakeData.contentStatus === 'partial') {
    adjustments.push({
      description: 'Content Optimization & Completion',
      type: 'adjustment',
      quantity: 1,
      unitPrice: 600,
      totalPrice: 600
    });
  }

  // Complex integrations adjustment
  if (intakeData.integrations && intakeData.integrations.toLowerCase() !== 'none' && intakeData.integrations.trim() !== '') {
    const integrationCount = intakeData.integrations.split(',').length;
    const complexityMultiplier = Math.min(integrationCount, 5); // Cap at 5
    adjustments.push({
      description: 'Third-party Integrations Setup',
      type: 'adjustment',
      quantity: complexityMultiplier,
      unitPrice: 400,
      totalPrice: complexityMultiplier * 400
    });
  }

  // Page count adjustment for large sites
  const pageAdjustments = {
    '11-20': { price: 800, description: 'Additional Pages Development (11-20 pages)' },
    '20-plus': { price: 1500, description: 'Large Site Development (20+ pages)' },
    'dynamic': { price: 1200, description: 'Dynamic Content Management' }
  };

  if (pageAdjustments[intakeData.pages]) {
    const adjustment = pageAdjustments[intakeData.pages];
    adjustments.push({
      description: adjustment.description,
      type: 'adjustment',
      quantity: 1,
      unitPrice: adjustment.price,
      totalPrice: adjustment.price
    });
  }

  // Rush job adjustment
  if (intakeData.timeline === 'asap') {
    adjustments.push({
      description: 'Rush Delivery Fee (50% surcharge)',
      type: 'adjustment',
      quantity: 1,
      unitPrice: 0, // Will be calculated as percentage
      totalPrice: 0, // Will be calculated later
      isPercentage: true,
      percentage: 0.5
    });
  }

  return adjustments;
}

function generatePaymentTerms(total, timeline) {
  const terms = [];

  if (total < 3000) {
    // Small projects: 50/50 split
    terms.push(
      { phase: 'Project Start', amount: total * 0.5, percentage: 50, dueInDays: 0 },
      { phase: 'Project Completion', amount: total * 0.5, percentage: 50, dueInDays: getProjectDurationDays(timeline) }
    );
  } else if (total < 10000) {
    // Medium projects: 40/40/20 split
    terms.push(
      { phase: 'Project Start', amount: total * 0.4, percentage: 40, dueInDays: 0 },
      { phase: 'Midpoint Review', amount: total * 0.4, percentage: 40, dueInDays: Math.floor(getProjectDurationDays(timeline) * 0.5) },
      { phase: 'Project Completion', amount: total * 0.2, percentage: 20, dueInDays: getProjectDurationDays(timeline) }
    );
  } else {
    // Large projects: 25/25/25/25 split
    const duration = getProjectDurationDays(timeline);
    terms.push(
      { phase: 'Project Start', amount: total * 0.25, percentage: 25, dueInDays: 0 },
      { phase: 'Design Approval', amount: total * 0.25, percentage: 25, dueInDays: Math.floor(duration * 0.25) },
      { phase: 'Development Milestone', amount: total * 0.25, percentage: 25, dueInDays: Math.floor(duration * 0.75) },
      { phase: 'Project Completion', amount: total * 0.25, percentage: 25, dueInDays: duration }
    );
  }

  return terms;
}

function getProjectDurationDays(timeline) {
  const durations = {
    'asap': 14,
    '1-month': 30,
    '1-3-months': 60,
    '3-6-months': 120,
    'flexible': 90
  };
  return durations[timeline] || 60;
}

function calculateDueDate(daysFromNow) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + daysFromNow);
  return dueDate.toISOString().split('T')[0];
}

function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `INV-${year}${month}${day}-${random}`;
}

function generateInvoiceNotes(intakeData) {
  const notes = [
    `Project: ${intakeData.company} - ${getProjectTypeDisplayName(intakeData.projectType)}`,
    `Timeline: ${intakeData.timeline}`,
    `This quote is valid for 30 days from the issue date.`
  ];

  if (intakeData.timeline === 'asap') {
    notes.push('Rush delivery timeline requires immediate project start upon approval.');
  }

  if (intakeData.contentStatus === 'need-help') {
    notes.push('Content creation services include up to 2 rounds of revisions.');
  }

  return notes;
}

function getTermsAndConditions() {
  return [
    'Payment is due within 7 days of invoice date unless otherwise specified.',
    'Work will begin upon receipt of signed agreement and initial payment.',
    'Additional work outside of agreed scope will be billed separately.',
    'Client is responsible for providing content and assets in timely manner.',
    'Final payment is due before project files are delivered.',
    'Hosting and domain costs are separate and billed directly by providers.',
    'Maintenance and support services are available under separate agreement.'
  ];
}

function getProjectTypeDisplayName(projectType) {
  const displayNames = {
    'simple-site': 'Simple Website',
    'business-site': 'Business Website',
    'portfolio': 'Portfolio Website',
    'ecommerce': 'E-commerce Store',
    'web-app': 'Web Application',
    'browser-extension': 'Browser Extension',
    'other': 'Custom Project'
  };
  return displayNames[projectType] || 'Web Project';
}