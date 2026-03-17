/**
 * ===============================================
 * EMAIL SEQUENCE TYPES
 * ===============================================
 * @file server/services/sequence-types.ts
 *
 * Type definitions for the email drip sequence system.
 * Covers database row types, API params, and analytics.
 */

// ============================================
// DB Row Types
// ============================================

export interface EmailSequenceRow {
  id: number;
  name: string;
  description: string | null;
  trigger_event: string;
  trigger_conditions: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface SequenceStepRow {
  id: number;
  sequence_id: number;
  step_order: number;
  delay_hours: number;
  email_template_id: number | null;
  subject_override: string | null;
  body_override: string | null;
  stop_conditions: string;
  created_at: string;
}

export interface SequenceEnrollmentRow {
  id: number;
  sequence_id: number;
  entity_type: string;
  entity_id: number;
  entity_email: string;
  entity_name: string | null;
  current_step_order: number;
  status: EnrollmentStatus;
  next_send_at: string | null;
  enrolled_at: string;
  completed_at: string | null;
  stopped_at: string | null;
  stopped_reason: string | null;
}

export interface SequenceSendLogRow {
  id: number;
  enrollment_id: number;
  step_id: number;
  sent_at: string;
  email_status: SendLogStatus;
  error_message: string | null;
}

// ============================================
// Status Types
// ============================================

export type EnrollmentStatus = 'active' | 'completed' | 'stopped' | 'paused';
export type SendLogStatus = 'sent' | 'failed' | 'bounced' | 'opened' | 'clicked';

// ============================================
// API Param Types
// ============================================

export interface CreateSequenceParams {
  name: string;
  description?: string;
  triggerEvent: string;
  triggerConditions?: Record<string, unknown>;
  steps: CreateStepParams[];
}

export interface CreateStepParams {
  delayHours: number;
  emailTemplateId?: number;
  subjectOverride?: string;
  bodyOverride?: string;
  stopConditions?: Record<string, unknown>;
}

export interface EnrollEntityParams {
  sequenceId: number;
  entityType: string;
  entityId: number;
  entityEmail: string;
  entityName?: string;
}

// ============================================
// Enriched / Composite Types
// ============================================

export interface SequenceWithSteps extends EmailSequenceRow {
  steps: SequenceStepRow[];
  enrollmentCount: number;
  completionRate: number;
}

// ============================================
// Analytics Types
// ============================================

export interface StepMetric {
  stepId: number;
  stepOrder: number;
  totalSent: number;
  totalFailed: number;
  totalBounced: number;
  totalOpened: number;
  totalClicked: number;
}

export interface SequenceAnalytics {
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  stoppedEnrollments: number;
  stepMetrics: StepMetric[];
}

// ============================================
// Processing Types
// ============================================

export interface ProcessQueueResult {
  sent: number;
  failed: number;
  stopped: number;
  completed: number;
}
