/**
 * ===============================================
 * VALIDATION — SCHEMAS
 * ===============================================
 * Common validation schemas for API endpoints.
 * Uses shared patterns from /shared/validation/patterns.ts
 */

import { VALIDATION_PATTERNS } from '../../../shared/validation/patterns.js';

export const ValidationSchemas = {
  // User registration/login
  user: {
    name: { type: 'string' as const, minLength: 2, maxLength: 100 },
    email: { type: 'email' as const },
    password: {
      type: 'string' as const,
      minLength: 12,
      maxLength: 128,
      pattern: VALIDATION_PATTERNS.PASSWORD_STRONG,
      description:
        'Password must be 12+ characters with at least one uppercase, lowercase, number, and special character'
    }
  },

  // Contact form - accepts both name OR firstName/lastName
  contact: {
    name: { type: 'string' as const, minLength: 2, maxLength: 100 },
    firstName: { type: 'string' as const, minLength: 1, maxLength: 50 },
    lastName: { type: 'string' as const, minLength: 1, maxLength: 50 },
    email: [{ type: 'required' as const }, { type: 'email' as const }],
    subject: { type: 'string' as const, maxLength: 200 },
    inquiryType: { type: 'string' as const, maxLength: 200 },
    companyName: { type: 'string' as const, maxLength: 200 },
    message: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        minLength: 10,
        maxLength: 5000,
        customValidator: (value: unknown) => {
          const str = String(value);
          // Check for spam patterns using shared pattern
          if (VALIDATION_PATTERNS.SPAM_PATTERNS.test(str)) {
            return 'Message appears to contain spam';
          }
          // Also check for URLs in message
          if (VALIDATION_PATTERNS.URL_HTTP.test(str)) {
            return 'Message appears to contain spam';
          }
          return true;
        }
      }
    ]
  },

  // Client intake
  clientIntake: {
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 2, maxLength: 100 }
    ],
    email: [{ type: 'required' as const }, { type: 'email' as const }],
    companyName: { type: 'string' as const, maxLength: 200 },
    projectType: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        allowedValues: [
          'simple-site',
          'business-site',
          'portfolio',
          'e-commerce',
          'web-app',
          'browser-extension',
          'other'
        ]
      }
    ],
    budgetRange: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        allowedValues: ['under-2k', '2k-5k', '5k-10k', '10k-plus', 'discuss']
      }
    ],
    timeline: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        allowedValues: ['asap', '1-3-months', '3-6-months', 'flexible']
      }
    ],
    description: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 20, maxLength: 2000 }
    ],
    features: {
      type: 'array' as const,
      maxLength: 20,
      customValidator: (features: unknown) => {
        if (!Array.isArray(features)) return 'Features must be an array';
        const validFeatures = [
          'contact-form',
          'user-auth',
          'payment',
          'cms',
          'analytics',
          'api-integration',
          'e-commerce',
          'blog',
          'gallery',
          'booking'
        ];
        return (
          features.every((feature: unknown) => typeof feature === 'string' && validFeatures.includes(feature)) || 'Invalid feature selected'
        );
      }
    }
  },

  // File upload
  fileUpload: {
    filename: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        pattern: VALIDATION_PATTERNS.FILENAME_SAFE,
        maxLength: 255
      }
    ],
    fileType: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        allowedValues: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
          'text/plain'
        ]
      }
    ],
    fileSize: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1, max: 10 * 1024 * 1024 } // 10MB max
    ]
  },

  // API pagination
  pagination: {
    page: { type: 'number' as const, min: 1, max: 1000 },
    limit: { type: 'number' as const, min: 1, max: 100 },
    sortBy: { type: 'string' as const, maxLength: 50 },
    sortOrder: { type: 'string' as const, allowedValues: ['asc', 'desc'] },
    search: { type: 'string' as const, maxLength: 200 }
  },

  // Intake form submission - matches actual form field names
  intakeSubmission: {
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 2, maxLength: 100 }
    ],
    email: [{ type: 'required' as const }, { type: 'email' as const }],
    phone: { type: 'string' as const, maxLength: 50 },
    projectFor: {
      type: 'string' as const,
      allowedValues: ['personal', 'business']
    },
    companyName: { type: 'string' as const, maxLength: 200 },
    projectType: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        allowedValues: [
          'simple-site',
          'business-site',
          'portfolio',
          'e-commerce',
          'ecommerce',
          'web-app',
          'browser-extension',
          'other'
        ]
      }
    ],
    projectDescription: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 10, maxLength: 5000 }
    ],
    timeline: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        allowedValues: ['asap', '1-month', '1-3-months', '3-6-months', 'flexible']
      }
    ],
    budget: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        allowedValues: [
          'under-1k',
          'under-2k',
          '1k-3k',
          '2k-5k',
          '3k-5k',
          '5k-10k',
          '10k-plus',
          '10k+',
          'discuss'
        ]
      }
    ],
    techComfort: {
      type: 'string' as const,
      allowedValues: ['beginner', 'comfortable', 'technical']
    },
    domainHosting: {
      type: 'string' as const,
      allowedValues: ['need-both', 'have-domain', 'have-both', 'not-sure']
    },
    features: { type: 'array' as const, maxLength: 20 },
    designLevel: {
      type: 'string' as const,
      allowedValues: ['basic', 'professional', 'premium', 'custom']
    },
    additionalInfo: { type: 'string' as const, maxLength: 5000 },
    proposalSelection: { type: 'object' as const }
  },

  // Project request (client submission)
  projectRequest: {
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 2, maxLength: 200 }
    ],
    projectType: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        allowedValues: [
          'simple-site',
          'business-site',
          'portfolio',
          'e-commerce',
          'ecommerce',
          'web-app',
          'browser-extension',
          'other'
        ]
      }
    ],
    description: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 10, maxLength: 5000 }
    ],
    budget: { type: 'string' as const, maxLength: 50 },
    timeline: { type: 'string' as const, maxLength: 50 }
  },

  // Project creation (admin)
  projectCreate: {
    client_id: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 2, maxLength: 200 }
    ],
    description: { type: 'string' as const, maxLength: 10000 },
    priority: {
      type: 'string' as const,
      allowedValues: ['low', 'medium', 'high', 'urgent']
    },
    status: {
      type: 'string' as const,
      allowedValues: ['pending', 'active', 'in-progress', 'in-review', 'completed', 'on-hold', 'cancelled']
    },
    project_type: { type: 'string' as const, maxLength: 50 },
    budget_range: { type: 'string' as const, maxLength: 50 },
    budget_min: { type: 'number' as const, min: 0 },
    budget_max: { type: 'number' as const, min: 0 },
    start_date: { type: 'string' as const, maxLength: 20 },
    due_date: { type: 'string' as const, maxLength: 20 }
  },

  // Project update
  projectUpdate: {
    name: { type: 'string' as const, minLength: 2, maxLength: 200 },
    description: { type: 'string' as const, maxLength: 10000 },
    priority: {
      type: 'string' as const,
      allowedValues: ['low', 'medium', 'high', 'urgent']
    },
    status: {
      type: 'string' as const,
      allowedValues: ['pending', 'active', 'in-progress', 'in-review', 'completed', 'on-hold', 'cancelled']
    },
    progress: { type: 'number' as const, min: 0, max: 100 }
  },

  // Message thread creation
  messageThread: {
    subject: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: 200 }
    ],
    thread_type: {
      type: 'string' as const,
      allowedValues: ['general', 'support', 'project', 'billing', 'feedback']
    },
    priority: {
      type: 'string' as const,
      allowedValues: ['low', 'normal', 'high', 'urgent']
    },
    project_id: { type: 'number' as const, min: 1 },
    client_id: { type: 'number' as const, min: 1 }
  },

  // Message send
  message: {
    message: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: 10000 }
    ],
    priority: {
      type: 'string' as const,
      allowedValues: ['low', 'normal', 'high', 'urgent']
    },
    reply_to: { type: 'number' as const, min: 1 }
  },

  // Bulk delete operations
  bulkDelete: {
    ids: [
      { type: 'required' as const },
      { type: 'array' as const, minLength: 1, maxLength: 100 }
    ]
  },

  // Task creation/update (title required on create, optional on partial update)
  task: {
    title: { type: 'string' as const, minLength: 1, maxLength: 200 },
    description: { type: 'string' as const, maxLength: 5000 },
    status: {
      type: 'string' as const,
      allowedValues: ['pending', 'in_progress', 'completed', 'blocked', 'cancelled']
    },
    priority: {
      type: 'string' as const,
      allowedValues: ['low', 'medium', 'high', 'urgent']
    },
    due_date: { type: 'string' as const, maxLength: 20 },
    assigned_to: { type: 'number' as const, min: 1 },
    project_id: { type: 'number' as const, min: 1 },
    milestone_id: { type: 'number' as const, min: 1 }
  }
};
