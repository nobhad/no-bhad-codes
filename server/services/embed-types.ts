/**
 * ===============================================
 * EMBED WIDGET TYPES
 * ===============================================
 * @file server/services/embed-types.ts
 *
 * Type definitions for the embeddable widget system.
 */

// ============================================
// Widget Types
// ============================================

export type WidgetType = 'contact_form' | 'testimonials' | 'status_badge';

// ============================================
// DB Row Types
// ============================================

export interface EmbedConfigRow {
  id: number;
  widget_type: string;
  name: string;
  token: string;
  config: string;
  allowed_domains: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectStatusTokenRow {
  id: number;
  project_id: number;
  token: string;
  is_active: number;
  created_at: string;
}

// ============================================
// Parsed / API Types
// ============================================

export interface EmbedConfiguration {
  id: number;
  widgetType: WidgetType;
  name: string;
  token: string;
  config: Record<string, unknown>;
  allowedDomains: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStatusInfo {
  projectName: string;
  status: string;
  completionPercent: number;
  milestonesSummary: string;
}

// ============================================
// Widget Config Interfaces
// ============================================

export interface ContactFormWidgetConfig {
  brandColor?: string;
  maxMessageLength?: number;
  successMessage?: string;
  showCompanyField?: boolean;
  showSubjectField?: boolean;
}

export interface TestimonialWidgetConfig {
  maxItems?: number;
  layout?: 'carousel' | 'grid' | 'list';
  showRating?: boolean;
  showProjectName?: boolean;
  autoRotateSeconds?: number;
}

export interface StatusBadgeWidgetConfig {
  showPercentage?: boolean;
  showMilestones?: boolean;
  theme?: 'light' | 'dark';
}

// ============================================
// API / Params Types
// ============================================

export interface CreateEmbedParams {
  widgetType: WidgetType;
  name: string;
  config?: Record<string, unknown>;
  allowedDomains?: string;
}

export interface UpdateEmbedParams {
  name?: string;
  config?: Record<string, unknown>;
  allowedDomains?: string;
  isActive?: boolean;
}
