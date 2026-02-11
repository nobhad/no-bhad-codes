/**
 * ===============================================
 * ADMIN DASHBOARD TYPES
 * ===============================================
 * @file src/features/admin/admin-types.ts
 *
 * Type definitions for admin dashboard modules.
 */

import type { PerformanceMetrics, PerformanceAlert } from '../../services/performance-service';

// Performance types
export interface PerformanceReport {
  score: number;
  metrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  recommendations: string[];
}

export interface PerformanceMetricDisplay {
  value: string;
  status: string;
}

export interface PerformanceMetricsDisplay {
  lcp: PerformanceMetricDisplay;
  fid: PerformanceMetricDisplay;
  cls: PerformanceMetricDisplay;
  ttfb: PerformanceMetricDisplay;
  score: number;
  grade: string;
  bundleSize?: {
    total: string;
    main: string;
    vendor: string;
  };
  alerts?: string[];
}

// Analytics types
export interface AnalyticsDataItem {
  label: string;
  value: string | number;
}

export interface AnalyticsData {
  popularPages?: AnalyticsDataItem[];
  deviceBreakdown?: AnalyticsDataItem[];
  geoDistribution?: AnalyticsDataItem[];
  engagementEvents?: AnalyticsDataItem[];
}

export interface PageView {
  url: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface Session {
  id: string;
  startTime: number;
  lastActivity?: number;
  pageViews?: number;
  totalTimeOnSite?: number;
  bounced?: boolean;
  referrer?: string;
  userAgent?: string;
  screenResolution?: string;
  language?: string;
  timezone?: string;
  [key: string]: unknown;
}

export interface Interaction {
  type: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface RawVisitorData {
  sessions?: Session[];
  pageViews?: PageView[];
  interactions?: Interaction[];
  [key: string]: unknown;
}

// System status types
export interface StatusItem {
  status?: string;
  loaded?: boolean;
  message?: string;
  responseTime?: number;
  [key: string]: unknown;
}

export interface ApplicationStatus {
  modules: Record<string, StatusItem>;
  services: Record<string, StatusItem>;
}

// Visitor types
export interface VisitorInfo {
  id: string;
  firstVisit: string;
  lastVisit: string;
  sessions: number;
  pageViews: number;
  location: string;
  device: string;
}

// Lead types (intake submissions)
// Simplified pipeline stages: new → contacted → qualified → in-progress → converted/lost
export interface Lead {
  id: number;
  client_id?: number;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  status: 'new' | 'contacted' | 'qualified' | 'in-progress' | 'converted' | 'lost' | 'on-hold' | 'cancelled';
  source?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  // Intake submission fields
  project_name?: string;
  project_type?: string;
  description?: string;
  budget_range?: string;
  timeline?: string;
  features?: string;
}

// Contact submission types
export interface ContactSubmission {
  id: number;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  subject?: string;
  message: string;
  status: 'new' | 'read' | 'responded' | 'replied' | 'archived';
  read_at?: string;
  replied_at?: string;
  created_at: string;
  // Conversion tracking
  client_id?: number;
  converted_at?: string;
}

// Project types
export interface Project {
  id: number;
  name: string;
  client_id: number;
  client_name?: string;
  status: 'pending' | 'active' | 'in-progress' | 'in-review' | 'completed' | 'on-hold' | 'cancelled';
  start_date?: string;
  end_date?: string;
  budget?: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMilestone {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  due_date: string;
  is_completed: boolean;
  completed_at?: string;
}

export interface ProjectFile {
  id: number;
  project_id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  file_size?: number; // Also available for compatibility
  file_path?: string;
  uploaded_by: string;
  created_at: string;
}

export interface ProjectInvoice {
  id: number;
  project_id: number;
  invoice_number: string;
  amount_total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  due_date: string;
  created_at: string;
}

// Message types
export interface MessageThread {
  id: number;
  subject: string;
  client_id: number;
  client_name?: string;
  status: 'active' | 'closed' | 'archived';
  last_message_at: string;
  unread_count: number;
}

export interface Message {
  id: number;
  thread_id: number;
  sender_type: 'client' | 'admin' | 'system';
  sender_name: string;
  message: string;
  content?: string;  // Alias for message in some contexts
  read_at: string | null; // Datetime when message was read, null if unread
  created_at: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Dashboard context passed to modules
export interface AdminDashboardContext {
  getAuthToken: () => string | null;
  showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  refreshData: () => Promise<void>;
  switchTab: (tab: string) => void;
}

// Analytics event type for analytics tracking
export interface AnalyticsEvent {
  type: string;
  timestamp: number;
  sessionId?: string;
  title?: string;
  url?: string;
  timeOnPage?: number;
  data?: Record<string, unknown>;
}

// Contact stats returned from API
export interface ContactStats {
  total: number;
  new: number;
  read: number;
  responded: number;
  archived: number;
}
