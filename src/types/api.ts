/**
 * ===============================================
 * API TYPE DEFINITIONS
 * ===============================================
 * @file src/types/api.ts
 *
 * Centralized type definitions for API requests and responses.
 * Provides type safety for client-server communication.
 */

// ============================================
// Generic API Response Types
// ============================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  timestamp?: string;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * API error response
 */
export interface ApiError {
  error: string;
  code: string;
  timestamp: string;
  details?: ValidationErrorDetail[];
}

/**
 * Validation error detail
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code?: string;
  value?: unknown;
}

// ============================================
// Authentication API Types
// ============================================

/**
 * Login request payload
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Admin login request payload
 */
export interface AdminLoginRequest {
  password: string;
}

/**
 * Login response data
 */
export interface LoginResponse {
  message: string;
  user: AuthUserResponse;
  expiresIn: string;
}

/**
 * User data returned from authentication
 */
export interface AuthUserResponse {
  id: number;
  email: string;
  companyName: string;
  contactName: string;
  status: string;
  role?: 'admin' | 'client';
}

/**
 * Magic link request payload
 */
export interface MagicLinkRequest {
  email: string;
}

/**
 * Magic link verification payload
 */
export interface MagicLinkVerifyRequest {
  token: string;
}

/**
 * Token refresh response
 */
export interface TokenRefreshResponse {
  success: boolean;
  expiresIn?: string;
}

// ============================================
// Contact Form API Types
// ============================================

/**
 * Contact form submission request
 */
export interface ContactFormRequest {
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  subject?: string;
  inquiryType?: string;
  companyName?: string;
  message: string;
}

/**
 * Contact submission response
 */
export interface ContactSubmissionResponse {
  id: number;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  subject?: string;
  message: string;
  status: ContactStatus;
  created_at: string;
  read_at?: string;
  replied_at?: string;
}

export type ContactStatus = 'new' | 'read' | 'replied' | 'archived';

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

export type BudgetRangeValue =
  | 'under-2k'
  | '2k-5k'
  | '5k-10k'
  | '10k-plus'
  | 'discuss';

export type TimelineValue =
  | 'asap'
  | '1-3-months'
  | '3-6-months'
  | 'flexible';

// ============================================
// Lead API Types
// ============================================

/**
 * Lead status values
 */
export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'converted'
  | 'lost'
  | 'pending'
  | 'active'
  | 'in-progress'
  | 'on-hold'
  | 'completed'
  | 'cancelled';

/**
 * Lead entity response
 */
export interface LeadResponse {
  id: number;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  status: LeadStatus;
  source?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  project_name?: string;
  project_type?: string;
  description?: string;
  budget_range?: string;
  timeline?: string;
  features?: string;
}

/**
 * Lead update request
 */
export interface LeadUpdateRequest {
  status?: LeadStatus;
  notes?: string;
  contact_name?: string;
  phone?: string;
}

/**
 * Leads list response
 */
export interface LeadsListResponse {
  leads: LeadResponse[];
  stats: LeadStats;
}

/**
 * Lead statistics
 */
export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  converted: number;
}

// ============================================
// Project API Types
// ============================================

/**
 * Project status values
 */
export type ProjectStatus =
  | 'planning'
  | 'in-progress'
  | 'review'
  | 'completed'
  | 'on-hold';

/**
 * Project entity response (matches server API response)
 */
export interface ProjectResponse {
  id: number;
  name?: string; // Legacy field
  project_name?: string; // Preferred field
  client_id: number;
  client_name?: string;
  contact_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  status: ProjectStatus | string; // Allow string for flexibility
  project_type?: string;
  budget_range?: string;
  timeline?: string;
  priority?: string;
  start_date?: string;
  end_date?: string;
  estimated_end_date?: string;
  actual_end_date?: string;
  budget?: number;
  description?: string;
  progress?: number;
  created_at: string;
  updated_at?: string;
  // Stats from joins
  file_count?: number;
  message_count?: number;
  unread_count?: number;
  // Optional fields that may be present
  preview_url?: string;
  repository_url?: string;
  production_url?: string;
  deposit_amount?: number;
  contract_signed_at?: string;
  notes?: string;
  features?: string | string[]; // Can be JSON string or parsed array
  password_hash?: string; // Admin only field
  last_login_at?: string;
  price?: number;
}

/**
 * Project update request
 */
export interface ProjectUpdateRequest {
  name?: string;
  status?: ProjectStatus;
  start_date?: string;
  end_date?: string;
  budget?: number;
  description?: string;
  progress?: number;
}

/**
 * Project milestone response (matches server API response)
 */
export interface ProjectMilestoneResponse {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  due_date: string;
  completed_date?: string;
  is_completed: boolean;
  deliverables?: string | string[] | null; // Can be JSON string or parsed array or null
}

/**
 * Project file response
 */
export interface ProjectFileResponse {
  id: number;
  project_id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  uploaded_by: string;
  created_at: string;
}

/**
 * Projects list response
 */
export interface ProjectsListResponse {
  projects: ProjectResponse[];
  stats: ProjectStats;
}

/**
 * Project statistics
 */
export interface ProjectStats {
  total: number;
  active: number;
  completed: number;
  on_hold: number;
}

// ============================================
// Client API Types
// ============================================

/**
 * Client status values
 */
export type ClientStatus = 'active' | 'inactive' | 'pending';

/**
 * Client entity response (matches server API response)
 */
export interface ClientResponse {
  id: number;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  status: ClientStatus | string; // Allow string for flexibility
  created_at: string;
  updated_at?: string;
  project_count?: number;
  total_revenue?: number;
}

/**
 * Project update response (matches server API response)
 */
export interface ProjectUpdateResponse {
  id: number;
  project_id: number;
  title: string;
  description: string;
  update_type?: string;
  author?: string; // May be present in some responses
  created_at: string;
  updated_at?: string;
}

/**
 * Project detail response (includes messages and updates)
 */
export interface ProjectDetailResponse extends ProjectResponse {
  files?: ProjectFileResponse[];
  messages?: MessageResponse[];
  updates?: ProjectUpdateResponse[];
  milestones?: ProjectMilestoneResponse[];
}

/**
 * Clients list response
 */
export interface ClientsListResponse {
  clients: ClientResponse[];
  stats: ClientStats;
}

/**
 * Client statistics
 */
export interface ClientStats {
  total: number;
  active: number;
  inactive: number;
}

// ============================================
// Messaging API Types
// ============================================

/**
 * Message thread response (matches server API response)
 */
export interface MessageThreadResponse {
  id: number;
  subject: string;
  client_id: number;
  project_id?: number; // May be present if thread is associated with a project
  client_name?: string;
  status: ThreadStatus | string; // Allow string for flexibility
  last_message_at: string;
  unread_count: number;
}

export type ThreadStatus = 'active' | 'closed' | 'archived';

/**
 * Message response (matches server API response)
 */
export interface MessageResponse {
  id: number;
  thread_id?: number;
  project_id?: number;
  sender_type?: SenderType;
  sender_role?: string;
  sender_name: string;
  message: string;
  is_read: boolean | number; // Can be 0/1 or boolean
  created_at: string;
  attachments?: string | unknown[]; // Can be JSON string or parsed array
}

export type SenderType = 'client' | 'admin' | 'system';

/**
 * Send message request
 */
export interface SendMessageRequest {
  message: string;
  attachments?: string[];
}

/**
 * Create thread request
 */
export interface CreateThreadRequest {
  client_id: number;
  subject: string;
  message: string;
}

// ============================================
// Invoice API Types
// ============================================

/**
 * Invoice status values
 */
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

/**
 * Invoice response (matches server API response)
 */
export interface InvoiceResponse {
  id: number;
  project_id: number;
  client_id?: number;
  invoice_number: string;
  amount_total: number | string; // Can be number or string from API
  amount_paid?: number | string; // Can be number or string from API
  status: InvoiceStatus | string; // Allow string for flexibility
  due_date: string;
  paid_date?: string;
  created_at: string;
  updated_at?: string;
}

// ============================================
// Admin Dashboard API Types
// ============================================

/**
 * Sidebar counts response
 */
export interface SidebarCountsResponse {
  success: boolean;
  leads: number;
  messages: number;
}

/**
 * System health response
 */
export interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ServiceHealth>;
  uptime: number;
  version: string;
}

/**
 * Individual service health
 */
export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  message?: string;
  lastCheck?: string;
}

// ============================================
// Analytics API Types
// ============================================

/**
 * Analytics data response
 */
export interface AnalyticsResponse {
  visitors: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
  topPages: PageAnalytics[];
  deviceBreakdown: DeviceAnalytics[];
  geoDistribution: GeoAnalytics[];
}

/**
 * Page analytics
 */
export interface PageAnalytics {
  url: string;
  views: number;
  avgTime: number;
}

/**
 * Device analytics
 */
export interface DeviceAnalytics {
  device: string;
  count: number;
  percentage: number;
}

/**
 * Geographic analytics
 */
export interface GeoAnalytics {
  country: string;
  count: number;
  percentage: number;
}

// ============================================
// File Upload API Types
// ============================================

/**
 * File upload request
 */
export interface FileUploadRequest {
  filename: string;
  fileType: AllowedMimeType;
  fileSize: number;
}

export type AllowedMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'application/pdf'
  | 'text/plain';

/**
 * File upload response
 */
export interface FileUploadResponse {
  id: number;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

// ============================================
// Query Parameter Types
// ============================================

/**
 * Standard pagination query params
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

/**
 * Filter params for leads
 */
export interface LeadFilterParams extends PaginationParams {
  status?: LeadStatus;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Filter params for projects
 */
export interface ProjectFilterParams extends PaginationParams {
  status?: ProjectStatus;
  clientId?: number;
  dateFrom?: string;
  dateTo?: string;
}
