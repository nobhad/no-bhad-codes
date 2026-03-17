/**
 * ===============================================
 * RETAINER TYPES
 * ===============================================
 * @file server/services/retainer-types.ts
 *
 * Type definitions for the retainer and recurring
 * project management system.
 */

// ============================================
// Constants
// ============================================

/** Threshold at which a usage alert is sent (80% utilization) */
export const USAGE_ALERT_THRESHOLD = 0.8;

/** Default maximum rollover hours when no cap is configured */
export const ROLLOVER_CAP_DEFAULT = 10;

// ============================================
// Status Types
// ============================================

export type RetainerType = 'hourly' | 'fixed_scope';

export type RetainerStatus = 'active' | 'paused' | 'cancelled' | 'expired';

export type PeriodStatus = 'active' | 'closed' | 'invoiced';

// ============================================
// DB Row Types
// ============================================

export interface RetainerRow {
  id: number;
  client_id: number;
  project_id: number;
  retainer_type: string;
  status: string;
  monthly_hours: number | null;
  monthly_amount: number;
  rollover_enabled: number;
  max_rollover_hours: number | null;
  start_date: string;
  end_date: string | null;
  billing_day: number;
  auto_invoice: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RetainerPeriodRow {
  id: number;
  retainer_id: number;
  period_start: string;
  period_end: string;
  allocated_hours: number | null;
  used_hours: number;
  rollover_hours: number;
  total_available: number | null;
  invoice_id: number | null;
  status: string;
  created_at: string;
}

// ============================================
// Enriched Types
// ============================================

export interface RetainerWithDetails extends RetainerRow {
  clientName: string;
  projectName: string;
  currentPeriod?: RetainerPeriodRow;
}

// ============================================
// API / Params Types
// ============================================

export interface CreateRetainerParams {
  clientId: number;
  projectId: number;
  retainerType: RetainerType;
  monthlyHours?: number;
  monthlyAmount: number;
  rolloverEnabled?: boolean;
  maxRolloverHours?: number;
  startDate: string;
  endDate?: string;
  billingDay?: number;
  autoInvoice?: boolean;
  notes?: string;
}

export interface UpdateRetainerParams {
  retainerType?: RetainerType;
  monthlyHours?: number;
  monthlyAmount?: number;
  rolloverEnabled?: boolean;
  maxRolloverHours?: number;
  endDate?: string | null;
  billingDay?: number;
  autoInvoice?: boolean;
  notes?: string;
}

// ============================================
// Summary / Reporting Types
// ============================================

export interface RetainerSummary {
  totalActive: number;
  totalMonthlyRevenue: number;
  avgUtilization: number;
  retainersNearCap: number;
}

export interface BillingResult {
  invoiced: number;
  skipped: number;
  errors: string[];
}

export interface UsageAlertResult {
  sent: number;
}
