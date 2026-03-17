/**
 * ===============================================
 * FEEDBACK & TESTIMONIAL TYPES
 * ===============================================
 * @file server/services/feedback-types.ts
 *
 * Type definitions for the feedback survey and
 * testimonial collection system.
 */

// ============================================
// Constants
// ============================================

/** Number of days before a survey expires */
export const SURVEY_EXPIRY_DAYS = 30;

/** Number of days after send before sending a reminder */
export const REMINDER_DELAY_DAYS = 5;

/** Minimum responses needed for statistically meaningful NPS */
export const MIN_NPS_SAMPLE_SIZE = 30;

// ============================================
// Status Types
// ============================================

export type SurveyType = 'project_completion' | 'milestone_check_in' | 'nps_quarterly';

export type SurveyStatus = 'pending' | 'sent' | 'completed' | 'expired';

export type TestimonialStatus = 'pending_review' | 'approved' | 'published' | 'rejected';

// ============================================
// DB Row Types
// ============================================

export interface FeedbackSurveyRow {
  id: number;
  project_id: number | null;
  client_id: number;
  survey_type: string;
  status: string;
  token: string;
  sent_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  reminder_sent: number;
  created_at: string;
}

export interface FeedbackResponseRow {
  id: number;
  survey_id: number;
  overall_rating: number | null;
  nps_score: number | null;
  communication_rating: number | null;
  quality_rating: number | null;
  timeliness_rating: number | null;
  highlights: string | null;
  improvements: string | null;
  testimonial_text: string | null;
  testimonial_approved: number;
  allow_name_use: number;
  submitted_at: string;
}

export interface TestimonialRow {
  id: number;
  feedback_response_id: number | null;
  client_id: number;
  project_id: number | null;
  text: string;
  client_name: string;
  company_name: string | null;
  rating: number | null;
  status: string;
  featured: number;
  published_at: string | null;
  created_at: string;
}

// ============================================
// Enriched Types
// ============================================

export interface FeedbackSurveyWithDetails extends FeedbackSurveyRow {
  clientName: string;
  clientEmail: string;
  projectName: string | null;
  response?: FeedbackResponseRow;
}

export interface TestimonialWithDetails extends TestimonialRow {
  projectName: string | null;
}

// ============================================
// API / Params Types
// ============================================

export interface SendSurveyParams {
  clientId: number;
  projectId?: number;
  surveyType: SurveyType;
  expiryDays?: number;
}

export interface SubmitSurveyParams {
  overallRating?: number;
  npsScore?: number;
  communicationRating?: number;
  qualityRating?: number;
  timelinessRating?: number;
  highlights?: string;
  improvements?: string;
  testimonialText?: string;
  testimonialApproved?: boolean;
  allowNameUse?: boolean;
}

export interface CreateTestimonialParams {
  clientId: number;
  projectId?: number;
  text: string;
  clientName: string;
  companyName?: string;
  rating?: number;
}

export interface UpdateTestimonialParams {
  text?: string;
  clientName?: string;
  companyName?: string;
  rating?: number;
  status?: TestimonialStatus;
}

// ============================================
// Analytics Types
// ============================================

export interface NpsBreakdown {
  promoters: number;
  passives: number;
  detractors: number;
  total: number;
  score: number;
}

export interface FeedbackAnalytics {
  nps: NpsBreakdown;
  averageRatings: {
    overall: number;
    communication: number;
    quality: number;
    timeliness: number;
  };
  totalSurveysSent: number;
  totalCompleted: number;
  completionRate: number;
  sampleSizeWarning: boolean;
}

// ============================================
// Scheduler Result Types
// ============================================

export interface ReminderResult {
  sent: number;
}

export interface ExpirationResult {
  expired: number;
}
