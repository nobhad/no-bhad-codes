/**
 * ===============================================
 * AD HOC REQUESTS — SHARED
 * ===============================================
 * Validation schemas, constants, and helper functions
 * used by both client and admin route modules.
 */

import type { ValidationSchema } from '../../middleware/validation.js';
import type { AdHocRequest } from '../../services/ad-hoc-request-service.js';
import type { InvoiceLineItem } from '../../services/invoice-service.js';
import { invoiceService } from '../../services/invoice-service.js';
import { projectService } from '../../services/project-service.js';

// =====================================================
// CONSTANTS
// =====================================================

const AD_HOC_TITLE_MAX_LENGTH = 200;
const AD_HOC_DESCRIPTION_MAX_LENGTH = 10000;
const MAX_ESTIMATED_HOURS = 10000;
const MAX_RATE = 10000;
const MAX_QUOTED_PRICE = 1000000;
const TIME_ENTRY_USERNAME_MAX_LENGTH = 100;
const TIME_ENTRY_DESCRIPTION_MAX_LENGTH = 5000;

export const AD_HOC_TYPE_VALUES = [
  'bug-fix', 'feature', 'content-update', 'design-change',
  'performance', 'security', 'maintenance', 'other'
];
export const AD_HOC_STATUS_VALUES = [
  'submitted', 'reviewing', 'quoted', 'approved', 'declined',
  'in-progress', 'completed', 'cancelled'
];
export const AD_HOC_PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'];
export const AD_HOC_URGENCY_VALUES = ['low', 'normal', 'high', 'critical'];

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

export const AdHocValidationSchemas = {
  clientSubmit: {
    projectId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    title: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: AD_HOC_TITLE_MAX_LENGTH }
    ],
    description: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: AD_HOC_DESCRIPTION_MAX_LENGTH }
    ],
    requestType: [
      { type: 'required' as const },
      { type: 'string' as const, allowedValues: AD_HOC_TYPE_VALUES }
    ],
    priority: { type: 'string' as const, allowedValues: AD_HOC_PRIORITY_VALUES },
    urgency: { type: 'string' as const, allowedValues: AD_HOC_URGENCY_VALUES },
    attachmentFileId: { type: 'number' as const, min: 1 }
  } as ValidationSchema,

  adminCreate: {
    projectId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    clientId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    title: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: AD_HOC_TITLE_MAX_LENGTH }
    ],
    description: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: AD_HOC_DESCRIPTION_MAX_LENGTH }
    ],
    requestType: [
      { type: 'required' as const },
      { type: 'string' as const, allowedValues: AD_HOC_TYPE_VALUES }
    ],
    status: { type: 'string' as const, allowedValues: AD_HOC_STATUS_VALUES },
    priority: { type: 'string' as const, allowedValues: AD_HOC_PRIORITY_VALUES },
    urgency: { type: 'string' as const, allowedValues: AD_HOC_URGENCY_VALUES },
    estimatedHours: { type: 'number' as const, min: 0, max: MAX_ESTIMATED_HOURS },
    flatRate: { type: 'number' as const, min: 0, max: MAX_QUOTED_PRICE },
    hourlyRate: { type: 'number' as const, min: 0, max: MAX_RATE },
    quotedPrice: { type: 'number' as const, min: 0, max: MAX_QUOTED_PRICE },
    attachmentFileId: { type: 'number' as const, min: 1 }
  } as ValidationSchema,

  adminUpdate: {
    status: { type: 'string' as const, allowedValues: AD_HOC_STATUS_VALUES },
    requestType: { type: 'string' as const, allowedValues: AD_HOC_TYPE_VALUES },
    priority: { type: 'string' as const, allowedValues: AD_HOC_PRIORITY_VALUES },
    urgency: { type: 'string' as const, allowedValues: AD_HOC_URGENCY_VALUES },
    title: { type: 'string' as const, maxLength: AD_HOC_TITLE_MAX_LENGTH },
    description: { type: 'string' as const, maxLength: AD_HOC_DESCRIPTION_MAX_LENGTH },
    estimatedHours: { type: 'number' as const, min: 0, max: MAX_ESTIMATED_HOURS },
    flatRate: { type: 'number' as const, min: 0, max: MAX_QUOTED_PRICE },
    hourlyRate: { type: 'number' as const, min: 0, max: MAX_RATE },
    quotedPrice: { type: 'number' as const, min: 0, max: MAX_QUOTED_PRICE },
    autoCreateInvoice: { type: 'boolean' as const }
  } as ValidationSchema,

  logTime: {
    userName: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: TIME_ENTRY_USERNAME_MAX_LENGTH }
    ],
    hours: [
      { type: 'required' as const },
      { type: 'number' as const, min: 0.01, max: MAX_ESTIMATED_HOURS }
    ],
    date: [
      { type: 'required' as const },
      { type: 'string' as const, maxLength: 20 }
    ],
    description: { type: 'string' as const, maxLength: TIME_ENTRY_DESCRIPTION_MAX_LENGTH },
    billable: { type: 'boolean' as const },
    hourlyRate: { type: 'number' as const, min: 0, max: MAX_RATE }
  } as ValidationSchema
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export function getInvoiceService() {
  return invoiceService;
}

export function mapTaskPriority(priority?: string | null): 'low' | 'medium' | 'high' | 'urgent' {
  switch (priority) {
  case 'low':
    return 'low';
  case 'medium':
    return 'medium';
  case 'high':
    return 'high';
  case 'urgent':
    return 'urgent';
  default:
    return 'medium';
  }
}

export function buildTaskDescription(request: AdHocRequest): string {
  const summaryParts = [
    `Ad hoc request #${request.id}`,
    `Type: ${request.requestType}`,
    `Priority: ${request.priority}`,
    `Urgency: ${request.urgency}`
  ];

  const quoteParts: string[] = [];
  if (request.estimatedHours !== null) {quoteParts.push(`Estimated hours: ${request.estimatedHours}`);}
  if (request.hourlyRate !== null) {quoteParts.push(`Hourly rate: $${request.hourlyRate.toFixed(2)}`);}
  if (request.flatRate !== null) quoteParts.push(`Flat rate: $${request.flatRate.toFixed(2)}`);
  if (request.quotedPrice !== null) {quoteParts.push(`Quoted total: $${request.quotedPrice.toFixed(2)}`);}

  return [
    request.description,
    '',
    summaryParts.join(' | '),
    quoteParts.length ? `Quote: ${quoteParts.join(' | ')}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildAdHocLineItem(
  request: AdHocRequest,
  data: {
    useTimeEntries: boolean;
    totalHours?: number | null;
    totalAmount?: number | null;
  }
): InvoiceLineItem {
  if (
    data.useTimeEntries &&
    data.totalHours &&
    data.totalAmount !== null &&
    data.totalAmount !== undefined
  ) {
    const rate = data.totalHours > 0 ? data.totalAmount / data.totalHours : 0;
    return {
      description: `Ad hoc request #${request.id}: ${request.title}`,
      quantity: Number(data.totalHours.toFixed(2)),
      rate: Number(rate.toFixed(2)),
      amount: Number(data.totalAmount.toFixed(2))
    };
  }

  if (request.quotedPrice !== null) {
    return {
      description: `Ad hoc request #${request.id}: ${request.title}`,
      quantity: 1,
      rate: Number(request.quotedPrice.toFixed(2)),
      amount: Number(request.quotedPrice.toFixed(2))
    };
  }

  if (request.flatRate !== null) {
    return {
      description: `Ad hoc request #${request.id}: ${request.title}`,
      quantity: 1,
      rate: Number(request.flatRate.toFixed(2)),
      amount: Number(request.flatRate.toFixed(2))
    };
  }

  if (request.estimatedHours !== null && request.hourlyRate !== null) {
    const amount = request.estimatedHours * request.hourlyRate;
    return {
      description: `Ad hoc request #${request.id}: ${request.title}`,
      quantity: Number(request.estimatedHours.toFixed(2)),
      rate: Number(request.hourlyRate.toFixed(2)),
      amount: Number(amount.toFixed(2))
    };
  }

  throw new Error('No pricing data available to create invoice line item');
}

export async function getAdHocTimeSummary(
  request: AdHocRequest
): Promise<{ totalHours: number; totalAmount: number }> {
  if (!request.taskId) {
    return { totalHours: 0, totalAmount: 0 };
  }

  const entries = await projectService.getTimeEntries(request.projectId, {
    taskId: request.taskId
  });
  const billableEntries = entries.filter((entry) => entry.billable);

  const totalHours = billableEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const totalAmount = billableEntries.reduce((sum, entry) => {
    if (entry.hourlyRate) {
      return sum + entry.hours * entry.hourlyRate;
    }
    if (request.hourlyRate) {
      return sum + entry.hours * request.hourlyRate;
    }
    return sum;
  }, 0);

  return { totalHours, totalAmount };
}
