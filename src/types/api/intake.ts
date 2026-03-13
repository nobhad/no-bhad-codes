/**
 * ===============================================
 * API TYPES — INTAKE
 * ===============================================
 */

// ============================================
// Client Intake API Types
// ============================================

/**
 * Client intake form submission request
 */
export interface ClientIntakeRequest {
  name: string;
  email: string;
  companyName?: string;
  projectType: ProjectTypeValue;
  budgetRange: BudgetRangeValue;
  timeline: TimelineValue;
  description: string;
  features?: string[];
  phone?: string;
}

export type ProjectTypeValue =
  | 'simple-site'
  | 'business-site'
  | 'portfolio'
  | 'e-commerce'
  | 'web-app'
  | 'browser-extension'
  | 'other';

export type BudgetRangeValue = 'under-2k' | '2k-5k' | '5k-10k' | '10k-plus' | 'discuss';

export type TimelineValue = 'asap' | '1-3-months' | '3-6-months' | 'flexible';
