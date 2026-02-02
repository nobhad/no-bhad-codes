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
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'partial' | 'viewed';

/**
 * Invoice type values
 */
export type InvoiceType = 'standard' | 'deposit';

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
  // Deposit invoice fields
  invoice_type?: InvoiceType | string;
  deposit_for_project_id?: number;
  deposit_percentage?: number;
  // Line items
  line_items?: InvoiceLineItem[];
  notes?: string;
  terms?: string;
}

/**
 * Invoice line item
 */
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

/**
 * Invoice credit response
 */
export interface InvoiceCreditResponse {
  id: number;
  invoice_id: number;
  deposit_invoice_id: number;
  deposit_invoice_number?: string;
  amount: number;
  applied_at: string;
  applied_by?: string;
}

/**
 * Deposit summary response
 */
export interface DepositSummaryResponse {
  invoice_id: number;
  invoice_number: string;
  total_amount: number;
  amount_applied: number;
  available_amount: number;
  paid_date?: string;
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

// ============================================
// Payment Plan API Types
// ============================================

/**
 * Payment plan trigger types
 */
export type PaymentTrigger = 'upfront' | 'midpoint' | 'completion' | 'milestone' | 'date';

/**
 * Individual payment within a plan
 */
export interface PaymentPlanPayment {
  percentage: number;
  trigger: PaymentTrigger;
  label?: string;
  milestoneId?: number;
  milestoneIndex?: number;
  daysAfterStart?: number;
}

/**
 * Payment plan template
 */
export interface PaymentPlanTemplate {
  id: number;
  name: string;
  description?: string;
  payments: PaymentPlanPayment[];
  isDefault: boolean;
  createdAt: string;
}

/**
 * Payment plan template response (snake_case for API)
 */
export interface PaymentPlanTemplateResponse {
  id: number;
  name: string;
  description?: string;
  payments: PaymentPlanPayment[];
  is_default: boolean;
  created_at: string;
}

// ============================================
// Scheduled Invoice API Types
// ============================================

/**
 * Scheduled invoice trigger types
 */
export type ScheduledInvoiceTrigger = 'date' | 'milestone_complete';

/**
 * Scheduled invoice status
 */
export type ScheduledInvoiceStatus = 'pending' | 'generated' | 'cancelled';

/**
 * Scheduled invoice
 */
export interface ScheduledInvoice {
  id: number;
  projectId: number;
  clientId: number;
  scheduledDate: string;
  triggerType: ScheduledInvoiceTrigger;
  triggerMilestoneId?: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  terms?: string;
  status: ScheduledInvoiceStatus;
  generatedInvoiceId?: number;
  createdAt: string;
}

/**
 * Scheduled invoice response (snake_case for API)
 */
export interface ScheduledInvoiceResponse {
  id: number;
  project_id: number;
  client_id: number;
  scheduled_date: string;
  trigger_type: ScheduledInvoiceTrigger;
  trigger_milestone_id?: number;
  line_items: InvoiceLineItem[];
  notes?: string;
  terms?: string;
  status: ScheduledInvoiceStatus;
  generated_invoice_id?: number;
  created_at: string;
}

// ============================================
// Recurring Invoice API Types
// ============================================

/**
 * Recurring invoice frequency
 */
export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly';

/**
 * Recurring invoice
 */
export interface RecurringInvoice {
  id: number;
  projectId: number;
  clientId: number;
  frequency: RecurringFrequency;
  dayOfMonth?: number;
  dayOfWeek?: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  terms?: string;
  startDate: string;
  endDate?: string;
  nextGenerationDate: string;
  lastGeneratedAt?: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Recurring invoice response (snake_case for API)
 */
export interface RecurringInvoiceResponse {
  id: number;
  project_id: number;
  client_id: number;
  frequency: RecurringFrequency;
  day_of_month?: number;
  day_of_week?: number;
  line_items: InvoiceLineItem[];
  notes?: string;
  terms?: string;
  start_date: string;
  end_date?: string;
  next_generation_date: string;
  last_generated_at?: string;
  is_active: boolean;
  created_at: string;
}

// ============================================
// Invoice Reminder API Types
// ============================================

/**
 * Invoice reminder types
 */
export type ReminderType = 'upcoming' | 'due' | 'overdue_3' | 'overdue_7' | 'overdue_14' | 'overdue_30';

/**
 * Invoice reminder status
 */
export type ReminderStatus = 'pending' | 'sent' | 'skipped' | 'failed';

/**
 * Invoice reminder
 */
export interface InvoiceReminder {
  id: number;
  invoiceId: number;
  reminderType: ReminderType;
  scheduledDate: string;
  sentAt?: string;
  status: ReminderStatus;
  createdAt: string;
}

/**
 * Invoice reminder response (snake_case for API)
 */
export interface InvoiceReminderResponse {
  id: number;
  invoice_id: number;
  reminder_type: ReminderType;
  scheduled_date: string;
  sent_at?: string;
  status: ReminderStatus;
  created_at: string;
}

// ============================================
// Client CRM API Types
// ============================================

/**
 * Client contact role types
 */
export type ContactRole = 'primary' | 'billing' | 'technical' | 'decision_maker' | 'general';

/**
 * Client contact
 */
export interface ClientContact {
  id: number;
  clientId: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  role: ContactRole;
  isPrimary: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Client contact response (snake_case for API)
 */
export interface ClientContactResponse {
  id: number;
  client_id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  role: ContactRole;
  is_primary: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Client activity types
 */
export type ClientActivityType =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'status_change'
  | 'invoice_sent'
  | 'payment_received'
  | 'project_created'
  | 'proposal_sent'
  | 'contact_added'
  | 'contact_removed'
  | 'tag_added'
  | 'tag_removed';

/**
 * Client activity
 */
export interface ClientActivity {
  id: number;
  clientId: number;
  activityType: ClientActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
}

/**
 * Client activity response (snake_case for API)
 */
export interface ClientActivityResponse {
  id: number;
  client_id: number;
  activity_type: ClientActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
}

/**
 * Custom field types
 */
export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'url' | 'email' | 'phone';

/**
 * Custom field definition
 */
export interface CustomField {
  id: number;
  fieldName: string;
  fieldLabel: string;
  fieldType: CustomFieldType;
  options?: string[];
  isRequired: boolean;
  placeholder?: string;
  defaultValue?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Custom field response (snake_case for API)
 */
export interface CustomFieldResponse {
  id: number;
  field_name: string;
  field_label: string;
  field_type: CustomFieldType;
  options?: string[];
  is_required: boolean;
  placeholder?: string;
  default_value?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Custom field value for a client
 */
export interface CustomFieldValue {
  id: number;
  clientId: number;
  fieldId: number;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  fieldValue?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Tag definition
 */
export interface Tag {
  id: number;
  name: string;
  color: string;
  description?: string;
  tagType: string;
  createdAt: string;
}

/**
 * Tag response (snake_case for API)
 */
export interface TagResponse {
  id: number;
  name: string;
  color: string;
  description?: string;
  tag_type: string;
  created_at: string;
}

/**
 * Client health status types
 */
export type HealthStatus = 'healthy' | 'at_risk' | 'critical';

/**
 * Client health score
 */
export interface ClientHealthScore {
  score: number;
  status: HealthStatus;
  factors: {
    paymentHistory: number;
    engagement: number;
    projectSuccess: number;
    communicationScore: number;
  };
  lastCalculated: string;
}

/**
 * Client comprehensive stats (individual client detail)
 */
export interface ClientDetailStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  averagePaymentDays: number;
  lifetimeValue: number;
  messageCount: number;
  lastActivityDate?: string;
}

/**
 * Company size types
 */
export type CompanySize = 'solo' | 'small' | 'medium' | 'enterprise';

/**
 * Preferred contact method types
 */
export type PreferredContactMethod = 'email' | 'phone' | 'text' | 'slack';

/**
 * Extended client with CRM fields
 */
export interface ClientWithCRM {
  id: number;
  email: string;
  companyName?: string;
  contactName?: string;
  phone?: string;
  status: string;
  clientType?: string;
  healthScore?: number;
  healthStatus?: HealthStatus;
  lifetimeValue?: number;
  acquisitionSource?: string;
  industry?: string;
  companySize?: CompanySize;
  website?: string;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  notes?: string;
  preferredContactMethod?: PreferredContactMethod;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Lead Management API Types
// ============================================

/**
 * Scoring rule operators
 */
export type ScoringOperator = 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_empty';

/**
 * Lead scoring rule
 */
export interface ScoringRule {
  id: number;
  name: string;
  description?: string;
  fieldName: string;
  operator: ScoringOperator;
  thresholdValue: string;
  points: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pipeline stage
 */
export interface PipelineStage {
  id: number;
  name: string;
  description?: string;
  color: string;
  sortOrder: number;
  winProbability: number;
  isWon: boolean;
  isLost: boolean;
  autoConvertToProject: boolean;
  createdAt: string;
}

/**
 * Lead summary for pipeline view
 */
export interface LeadSummary {
  id: number;
  projectName: string;
  clientName?: string;
  companyName?: string;
  budgetRange?: string;
  leadScore: number;
  expectedValue?: number;
  expectedCloseDate?: string;
  assignedTo?: string;
  createdAt: string;
}

/**
 * Pipeline view data
 */
export interface PipelineView {
  stages: (PipelineStage & { leads: LeadSummary[] })[];
  totalValue: number;
  weightedValue: number;
}

/**
 * Lead task types
 */
export type LeadTaskType = 'follow_up' | 'call' | 'email' | 'meeting' | 'proposal' | 'demo' | 'other';

/**
 * Lead task status
 */
export type LeadTaskStatus = 'pending' | 'completed' | 'cancelled' | 'snoozed';

/**
 * Lead task
 */
export interface LeadTask {
  id: number;
  projectId: number;
  title: string;
  description?: string;
  taskType: LeadTaskType;
  dueDate?: string;
  dueTime?: string;
  status: LeadTaskStatus;
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reminderAt?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lead note
 */
export interface LeadNote {
  id: number;
  projectId: number;
  author: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lead source
 */
export interface LeadSource {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Duplicate result status
 */
export type DuplicateStatus = 'pending' | 'merged' | 'not_duplicate' | 'dismissed';

/**
 * Duplicate detection result
 */
export interface DuplicateResult {
  id: number;
  leadId1: number;
  leadId2: number;
  similarityScore: number;
  matchFields: string[];
  status: DuplicateStatus;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  lead1?: LeadSummary;
  lead2?: LeadSummary;
}

/**
 * Lead score result
 */
export interface LeadScoreResult {
  score: number;
  breakdown: { ruleName: string; points: number; matched: boolean }[];
}

/**
 * Pipeline statistics
 */
export interface PipelineStats {
  totalLeads: number;
  totalValue: number;
  weightedValue: number;
  avgDaysInPipeline: number;
  conversionRate: number;
  stageBreakdown: { stageId: number; stageName: string; count: number; value: number }[];
}

/**
 * Lead analytics
 */
export interface LeadAnalytics {
  totalLeads: number;
  newLeadsThisMonth: number;
  conversionRate: number;
  avgLeadScore: number;
  avgDaysToClose: number;
  topSources: {
    sourceId: number;
    sourceName: string;
    leadCount: number;
    totalValue: number;
    wonCount: number;
    conversionRate: number;
  }[];
  scoreDistribution: { range: string; count: number }[];
}

/**
 * Conversion funnel data
 */
export interface FunnelData {
  stages: { name: string; count: number; value: number; conversionRate: number }[];
  overallConversionRate: number;
}

/**
 * Source performance stats
 */
export interface SourceStats {
  sourceId: number;
  sourceName: string;
  leadCount: number;
  totalValue: number;
  wonCount: number;
  conversionRate: number;
}

// ============================================
// Project Management API Types
// ============================================

/**
 * Project task status values
 */
export type ProjectTaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

/**
 * Project task priority values
 */
export type ProjectTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Project task
 */
export interface ProjectTask {
  id: number;
  projectId: number;
  milestoneId?: number;
  title: string;
  description?: string;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  assignedTo?: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  sortOrder: number;
  parentTaskId?: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  subtasks?: ProjectTask[];
  dependencies?: TaskDependency[];
  checklistItems?: ChecklistItem[];
}

/**
 * Project task response (snake_case for API)
 */
export interface ProjectTaskResponse {
  id: number;
  project_id: number;
  milestone_id?: number;
  title: string;
  description?: string;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  assigned_to?: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  sort_order: number;
  parent_task_id?: number;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Task create/update data
 */
export interface TaskCreateData {
  milestoneId?: number;
  title: string;
  description?: string;
  status?: ProjectTaskStatus;
  priority?: ProjectTaskPriority;
  assignedTo?: string;
  dueDate?: string;
  estimatedHours?: number;
  sortOrder?: number;
  parentTaskId?: number;
}

/**
 * Task dependency types
 */
export type TaskDependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';

/**
 * Task dependency
 */
export interface TaskDependency {
  id: number;
  taskId: number;
  dependsOnTaskId: number;
  dependencyType: TaskDependencyType;
  createdAt: string;
}

/**
 * Task dependency response (snake_case for API)
 */
export interface TaskDependencyResponse {
  id: number;
  task_id: number;
  depends_on_task_id: number;
  dependency_type: TaskDependencyType;
  created_at: string;
}

/**
 * Task comment
 */
export interface TaskComment {
  id: number;
  taskId: number;
  author: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Task comment response (snake_case for API)
 */
export interface TaskCommentResponse {
  id: number;
  task_id: number;
  author: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/**
 * Checklist item
 */
export interface ChecklistItem {
  id: number;
  taskId: number;
  content: string;
  isCompleted: boolean;
  completedAt?: string;
  sortOrder: number;
  createdAt: string;
}

/**
 * Checklist item response (snake_case for API)
 */
export interface ChecklistItemResponse {
  id: number;
  task_id: number;
  content: string;
  is_completed: boolean;
  completed_at?: string;
  sort_order: number;
  created_at: string;
}

/**
 * Time entry
 */
export interface TimeEntry {
  id: number;
  projectId: number;
  taskId?: number;
  userName: string;
  description?: string;
  hours: number;
  date: string;
  billable: boolean;
  hourlyRate?: number;
  createdAt: string;
  updatedAt: string;
  // Computed
  amount?: number;
  taskTitle?: string;
}

/**
 * Time entry response (snake_case for API)
 */
export interface TimeEntryResponse {
  id: number;
  project_id: number;
  task_id?: number;
  user_name: string;
  description?: string;
  hours: number;
  date: string;
  billable: boolean;
  hourly_rate?: number;
  created_at: string;
  updated_at: string;
  task_title?: string;
}

/**
 * Time entry create data
 */
export interface TimeEntryData {
  taskId?: number;
  userName: string;
  description?: string;
  hours: number;
  date: string;
  billable?: boolean;
  hourlyRate?: number;
}

/**
 * Project time statistics
 */
export interface ProjectTimeStats {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  totalAmount: number;
  byUser: { userName: string; hours: number; amount: number }[];
  byTask: { taskId: number; taskTitle: string; hours: number }[];
  byWeek: { weekStart: string; hours: number }[];
}

/**
 * Team time report
 */
export interface TeamTimeReport {
  startDate: string;
  endDate: string;
  totalHours: number;
  totalAmount: number;
  byUser: {
    userName: string;
    totalHours: number;
    billableHours: number;
    totalAmount: number;
    projects: { projectId: number; projectName: string; hours: number }[];
  }[];
}

/**
 * Template milestone
 */
export interface TemplateMilestone {
  name: string;
  description?: string;
  deliverables?: string;
  order: number;
  estimatedDays?: number;
}

/**
 * Template task
 */
export interface TemplateTask {
  title: string;
  description?: string;
  milestoneIndex: number;
  priority?: string;
  estimatedHours?: number;
}

/**
 * Project template
 */
export interface ProjectTemplate {
  id: number;
  name: string;
  description?: string;
  projectType?: string;
  defaultMilestones: TemplateMilestone[];
  defaultTasks: TemplateTask[];
  estimatedDurationDays?: number;
  defaultHourlyRate?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Project template response (snake_case for API)
 */
export interface ProjectTemplateResponse {
  id: number;
  name: string;
  description?: string;
  project_type?: string;
  default_milestones: TemplateMilestone[];
  default_tasks: TemplateTask[];
  estimated_duration_days?: number;
  default_hourly_rate?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Template create data
 */
export interface TemplateCreateData {
  name: string;
  description?: string;
  projectType?: string;
  defaultMilestones?: TemplateMilestone[];
  defaultTasks?: TemplateTask[];
  estimatedDurationDays?: number;
  defaultHourlyRate?: number;
}

/**
 * Project health status values
 */
export type ProjectHealthStatus = 'on_track' | 'at_risk' | 'off_track';

/**
 * Project health data
 */
export interface ProjectHealth {
  status: ProjectHealthStatus;
  score: number;
  factors: {
    scheduleHealth: number;
    budgetHealth: number;
    taskCompletion: number;
    milestoneProgress: number;
  };
  issues: string[];
  lastCalculated: string;
}

/**
 * Project burndown chart data
 */
export interface BurndownData {
  dates: string[];
  plannedHours: number[];
  actualHours: number[];
  remainingHours: number[];
}

/**
 * Project velocity data
 */
export interface VelocityData {
  weeks: string[];
  hoursCompleted: number[];
  tasksCompleted: number[];
  averageVelocity: number;
}

// ============================================
// Proposal Enhancement API Types
// ============================================

/**
 * Proposal template
 */
export interface ProposalTemplate {
  id: number;
  name: string;
  description?: string;
  projectType?: string;
  tierStructure?: object;
  defaultLineItems?: object[];
  termsAndConditions?: string;
  validityDays: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Proposal template response (snake_case for API)
 */
export interface ProposalTemplateResponse {
  id: number;
  name: string;
  description?: string;
  project_type?: string;
  tier_structure?: object;
  default_line_items?: object[];
  terms_and_conditions?: string;
  validity_days: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Proposal version
 */
export interface ProposalVersion {
  id: number;
  proposalId: number;
  versionNumber: number;
  tierData?: object;
  featuresData?: object[];
  pricingData?: object;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

/**
 * Proposal version response (snake_case for API)
 */
export interface ProposalVersionResponse {
  id: number;
  proposal_id: number;
  version_number: number;
  tier_data?: object;
  features_data?: object[];
  pricing_data?: object;
  notes?: string;
  created_by?: string;
  created_at: string;
}

/**
 * Signature method types
 */
export type SignatureMethod = 'drawn' | 'typed' | 'uploaded';

/**
 * Proposal signature
 */
export interface ProposalSignature {
  id: number;
  proposalId: number;
  signerName: string;
  signerEmail: string;
  signerTitle?: string;
  signerCompany?: string;
  signatureMethod: SignatureMethod;
  signatureData?: string;
  ipAddress?: string;
  userAgent?: string;
  signedAt: string;
}

/**
 * Proposal signature response (snake_case for API)
 */
export interface ProposalSignatureResponse {
  id: number;
  proposal_id: number;
  signer_name: string;
  signer_email: string;
  signer_title?: string;
  signer_company?: string;
  signature_method: SignatureMethod;
  signature_data?: string;
  ip_address?: string;
  user_agent?: string;
  signed_at: string;
}

/**
 * Signature request status
 */
export type SignatureRequestStatus = 'pending' | 'viewed' | 'signed' | 'declined' | 'expired';

/**
 * Signature request
 */
export interface SignatureRequest {
  id: number;
  proposalId: number;
  signerEmail: string;
  signerName?: string;
  requestToken: string;
  status: SignatureRequestStatus;
  sentAt?: string;
  viewedAt?: string;
  signedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  expiresAt?: string;
  reminderCount: number;
  lastReminderAt?: string;
  createdAt: string;
}

/**
 * Proposal comment author type
 */
export type ProposalCommentAuthorType = 'admin' | 'client';

/**
 * Proposal comment
 */
export interface ProposalComment {
  id: number;
  proposalId: number;
  authorType: ProposalCommentAuthorType;
  authorName: string;
  authorEmail?: string;
  content: string;
  isInternal: boolean;
  parentCommentId?: number;
  createdAt: string;
  updatedAt: string;
  replies?: ProposalComment[];
}

/**
 * Proposal comment response (snake_case for API)
 */
export interface ProposalCommentResponse {
  id: number;
  proposal_id: number;
  author_type: ProposalCommentAuthorType;
  author_name: string;
  author_email?: string;
  content: string;
  is_internal: boolean;
  parent_comment_id?: number;
  created_at: string;
  updated_at: string;
  replies?: ProposalCommentResponse[];
}

/**
 * Proposal activity types
 */
export type ProposalActivityType =
  | 'viewed'
  | 'downloaded'
  | 'commented'
  | 'signed'
  | 'status_changed'
  | 'version_created'
  | 'version_restored'
  | 'sent'
  | 'reminder_sent'
  | 'signature_requested'
  | 'signature_declined'
  | 'discount_applied'
  | 'discount_removed';

/**
 * Proposal activity
 */
export interface ProposalActivity {
  id: number;
  proposalId: number;
  activityType: ProposalActivityType;
  actor?: string;
  actorType?: string;
  metadata?: object;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

/**
 * Proposal activity response (snake_case for API)
 */
export interface ProposalActivityResponse {
  id: number;
  proposal_id: number;
  activity_type: ProposalActivityType;
  actor?: string;
  actor_type?: string;
  metadata?: object;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

/**
 * Custom item types
 */
export type ProposalCustomItemType = 'service' | 'product' | 'discount' | 'fee' | 'hourly';

/**
 * Proposal custom item
 */
export interface ProposalCustomItem {
  id: number;
  proposalId: number;
  itemType: ProposalCustomItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  unitLabel?: string;
  category?: string;
  isTaxable: boolean;
  isOptional: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Proposal custom item response (snake_case for API)
 */
export interface ProposalCustomItemResponse {
  id: number;
  proposal_id: number;
  item_type: ProposalCustomItemType;
  description: string;
  quantity: number;
  unit_price: number;
  unit_label?: string;
  category?: string;
  is_taxable: boolean;
  is_optional: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Signature status
 */
export interface ProposalSignatureStatus {
  requiresSignature: boolean;
  isSigned: boolean;
  signatures: ProposalSignature[];
  pendingRequests: SignatureRequest[];
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  version1: ProposalVersion;
  version2: ProposalVersion;
  differences: Record<string, { v1: unknown; v2: unknown }>;
}

// ============================================
// Messaging Enhancement API Types
// ============================================

/**
 * Message mention type
 */
export type MentionType = 'user' | 'team' | 'all';

/**
 * Message mention
 */
export interface MessageMention {
  id: number;
  messageId: number;
  mentionedType: MentionType;
  mentionedId: string | null;
  notified: boolean;
  notifiedAt: string | null;
  createdAt: string;
}

/**
 * Message mention response (snake_case for API)
 */
export interface MessageMentionResponse {
  id: number;
  message_id: number;
  mentioned_type: MentionType;
  mentioned_id: string | null;
  notified: boolean;
  notified_at: string | null;
  created_at: string;
}

/**
 * Message reaction
 */
export interface MessageReaction {
  id: number;
  messageId: number;
  userEmail: string;
  userType: 'admin' | 'client';
  reaction: string;
  createdAt: string;
}

/**
 * Message reaction response (snake_case for API)
 */
export interface MessageReactionResponse {
  id: number;
  message_id: number;
  user_email: string;
  user_type: 'admin' | 'client';
  reaction: string;
  created_at: string;
}

/**
 * Grouped reactions summary
 */
export interface ReactionSummary {
  reaction: string;
  count: number;
  users: string[];
  hasUserReacted: boolean;
}

/**
 * Message subscription preferences
 */
export interface MessageSubscription {
  id: number;
  projectId: number;
  userEmail: string;
  userType: 'admin' | 'client';
  notifyAll: boolean;
  notifyMentions: boolean;
  notifyReplies: boolean;
  mutedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Message subscription response (snake_case for API)
 */
export interface MessageSubscriptionResponse {
  id: number;
  project_id: number;
  user_email: string;
  user_type: 'admin' | 'client';
  notify_all: boolean;
  notify_mentions: boolean;
  notify_replies: boolean;
  muted_until: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Message read receipt
 */
export interface MessageReadReceipt {
  id: number;
  messageId: number;
  userEmail: string;
  userType: 'admin' | 'client';
  readAt: string;
}

/**
 * Message read receipt response (snake_case for API)
 */
export interface MessageReadReceiptResponse {
  id: number;
  message_id: number;
  user_email: string;
  user_type: 'admin' | 'client';
  read_at: string;
}

/**
 * Pinned message
 */
export interface PinnedMessage {
  id: number;
  threadId: number;
  messageId: number;
  pinnedBy: string;
  pinnedAt: string;
  message?: EnhancedMessageResponse;
}

/**
 * Pinned message response (snake_case for API)
 */
export interface PinnedMessageResponse {
  id: number;
  thread_id: number;
  message_id: number;
  pinned_by: string;
  pinned_at: string;
  message?: EnhancedMessageResponse;
}

/**
 * Enhanced message with new fields
 */
export interface EnhancedMessage extends MessageResponse {
  parentMessageId: number | null;
  isInternal: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  reactionCount: number;
  replyCount: number;
  mentionCount: number;
  reactions?: ReactionSummary[];
  mentions?: MessageMention[];
  replies?: EnhancedMessage[];
}

/**
 * Enhanced message response (snake_case for API)
 */
export interface EnhancedMessageResponse {
  id: number;
  client_id: number;
  thread_id: number;
  sender_type: 'admin' | 'client';
  sender_name: string;
  subject: string;
  message: string;
  priority: 'normal' | 'urgent' | 'low';
  reply_to: number | null;
  attachments: MessageAttachment[] | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
  parent_message_id: number | null;
  is_internal: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  reaction_count: number;
  reply_count: number;
  mention_count: number;
  reactions?: ReactionSummary[];
  mentions?: MessageMentionResponse[];
  replies?: EnhancedMessageResponse[];
}

/**
 * Message attachment
 */
export interface MessageAttachment {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimeType: string;
}

/**
 * Enhanced thread with new fields
 */
export interface EnhancedThread extends MessageThreadResponse {
  pinnedCount: number;
  participantCount: number;
  archivedAt: string | null;
  archivedBy: string | null;
}

/**
 * Enhanced thread response (snake_case for API)
 */
export interface EnhancedThreadResponse {
  id: number;
  client_id: number;
  project_id: number | null;
  subject: string;
  thread_type: string;
  status: string;
  priority: string;
  last_message_at: string;
  last_message_by: string | null;
  created_at: string;
  updated_at: string;
  pinned_count: number;
  participant_count: number;
  archived_at: string | null;
  archived_by: string | null;
}

/**
 * Message search options
 */
export interface MessageSearchOptions {
  projectId?: number;
  threadId?: number;
  limit?: number;
  userEmail?: string;
  includeInternal?: boolean;
}

/**
 * Message search result
 */
export interface MessageSearchResult {
  id: number;
  threadId: number;
  threadSubject: string;
  senderName: string;
  senderType: 'admin' | 'client';
  message: string;
  createdAt: string;
  highlight?: string;
}

/**
 * Message search result response (snake_case for API)
 */
export interface MessageSearchResultResponse {
  id: number;
  thread_id: number;
  thread_subject: string;
  sender_name: string;
  sender_type: 'admin' | 'client';
  message: string;
  created_at: string;
  highlight?: string;
}

/**
 * Subscription update request
 */
export interface UpdateSubscriptionRequest {
  notify_all?: boolean;
  notify_mentions?: boolean;
  notify_replies?: boolean;
}

/**
 * Add reaction request
 */
export interface AddReactionRequest {
  reaction: string;
}

/**
 * Mute project request
 */
export interface MuteProjectRequest {
  until?: string;
}

/**
 * Pin message request
 */
export interface PinMessageRequest {
  thread_id: number;
}

/**
 * Edit message request
 */
export interface EditMessageRequest {
  message: string;
}

/**
 * Send internal message request
 */
export interface SendInternalMessageRequest {
  message: string;
}

/**
 * Bulk read request
 */
export interface BulkReadRequest {
  message_ids: number[];
}

// ============================================
// File Management Enhancement API Types
// ============================================

/**
 * File category types
 */
export type FileCategory = 'general' | 'deliverable' | 'source' | 'asset' | 'document' | 'contract' | 'invoice';

/**
 * File version
 */
export interface FileVersion {
  id: number;
  fileId: number;
  versionNumber: number;
  filename: string;
  originalFilename: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedBy: string | null;
  comment: string | null;
  isCurrent: boolean;
  createdAt: string;
}

/**
 * File version response (snake_case for API)
 */
export interface FileVersionResponse {
  id: number;
  file_id: number;
  version_number: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  comment: string | null;
  is_current: boolean;
  created_at: string;
}

/**
 * File folder
 */
export interface FileFolder {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  parentFolderId: number | null;
  color: string;
  icon: string;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  fileCount?: number;
  subfolderCount?: number;
}

/**
 * File folder response (snake_case for API)
 */
export interface FileFolderResponse {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  parent_folder_id: number | null;
  color: string;
  icon: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  file_count?: number;
  subfolder_count?: number;
}

/**
 * File comment
 */
export interface FileComment {
  id: number;
  fileId: number;
  authorEmail: string;
  authorType: 'admin' | 'client';
  authorName: string | null;
  content: string;
  isInternal: boolean;
  parentCommentId: number | null;
  createdAt: string;
  updatedAt: string;
  replies?: FileComment[];
}

/**
 * File comment response (snake_case for API)
 */
export interface FileCommentResponse {
  id: number;
  file_id: number;
  author_email: string;
  author_type: 'admin' | 'client';
  author_name: string | null;
  content: string;
  is_internal: boolean;
  parent_comment_id: number | null;
  created_at: string;
  updated_at: string;
  replies?: FileCommentResponse[];
}

/**
 * File access log entry
 */
export interface FileAccessLog {
  id: number;
  fileId: number;
  userEmail: string;
  userType: 'admin' | 'client';
  accessType: 'view' | 'download' | 'preview';
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/**
 * File access log response (snake_case for API)
 */
export interface FileAccessLogResponse {
  id: number;
  file_id: number;
  user_email: string;
  user_type: 'admin' | 'client';
  access_type: 'view' | 'download' | 'preview';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/**
 * File access statistics
 */
export interface FileAccessStats {
  totalViews: number;
  totalDownloads: number;
  uniqueViewers: number;
  lastAccessed: string | null;
}

/**
 * File access stats response (snake_case for API)
 */
export interface FileAccessStatsResponse {
  total_views: number;
  total_downloads: number;
  unique_viewers: number;
  last_accessed: string | null;
}

/**
 * File statistics for a project
 */
export interface FileStats {
  totalFiles: number;
  totalSize: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  recentUploads: number;
  archivedCount: number;
  expiringSoon: number;
}

/**
 * File stats response (snake_case for API)
 */
export interface FileStatsResponse {
  total_files: number;
  total_size: number;
  by_category: Record<string, number>;
  by_type: Record<string, number>;
  recent_uploads: number;
  archived_count: number;
  expiring_soon: number;
}

/**
 * Enhanced file with new management fields
 */
export interface EnhancedFile {
  id: number;
  projectId: number;
  folderId: number | null;
  filename: string;
  originalFilename: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  fileType: string;
  description: string | null;
  uploadedBy: string | null;
  version: number;
  isArchived: boolean;
  archivedAt: string | null;
  archivedBy: string | null;
  expiresAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  downloadCount: number;
  checksum: string | null;
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: string | null;
  category: FileCategory;
  createdAt: string;
}

/**
 * Enhanced file response (snake_case for API)
 */
export interface EnhancedFileResponse {
  id: number;
  project_id: number;
  folder_id: number | null;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  file_type: string;
  description: string | null;
  uploaded_by: string | null;
  version: number;
  is_archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
  expires_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  download_count: number;
  checksum: string | null;
  is_locked: boolean;
  locked_by: string | null;
  locked_at: string | null;
  category: FileCategory;
  created_at: string;
}

/**
 * Create folder request
 */
export interface CreateFolderRequest {
  name: string;
  description?: string;
  parent_folder_id?: number;
  color?: string;
  icon?: string;
}

/**
 * Update folder request
 */
export interface UpdateFolderRequest {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}

/**
 * Move file request
 */
export interface MoveFileRequest {
  folder_id: number | null;
}

/**
 * Move folder request
 */
export interface MoveFolderRequest {
  parent_folder_id: number | null;
}

/**
 * Set file expiration request
 */
export interface SetFileExpirationRequest {
  expires_at: string | null;
}

/**
 * Set file category request
 */
export interface SetFileCategoryRequest {
  category: FileCategory;
}

/**
 * Add file comment request
 */
export interface AddFileCommentRequest {
  content: string;
  is_internal?: boolean;
  parent_comment_id?: number;
  author_name?: string;
}

/**
 * Log file access request
 */
export interface LogFileAccessRequest {
  access_type: 'view' | 'download' | 'preview';
}

/**
 * File search options
 */
export interface FileSearchOptions {
  folder_id?: number;
  category?: FileCategory;
  include_archived?: boolean;
  limit?: number;
}

/**
 * Upload file version request
 */
export interface UploadFileVersionRequest {
  comment?: string;
}

// ============================================
// Analytics & Reporting Enhancement API Types
// ============================================

/**
 * Report types
 */
export type ReportType = 'revenue' | 'pipeline' | 'project' | 'client' | 'team' | 'lead' | 'invoice';

/**
 * Chart types
 */
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'table' | 'funnel' | 'gauge';

/**
 * Saved report
 */
export interface SavedReport {
  id: number;
  name: string;
  description: string | null;
  reportType: ReportType;
  filters: Record<string, unknown> | null;
  columns: string[] | null;
  sortBy: string | null;
  sortOrder: 'ASC' | 'DESC';
  chartType: ChartType | null;
  isFavorite: boolean;
  isShared: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Saved report response (snake_case for API)
 */
export interface SavedReportResponse {
  id: number;
  name: string;
  description: string | null;
  report_type: ReportType;
  filters: Record<string, unknown> | null;
  columns: string[] | null;
  sort_by: string | null;
  sort_order: 'ASC' | 'DESC';
  chart_type: ChartType | null;
  is_favorite: boolean;
  is_shared: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Report schedule frequency
 */
export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

/**
 * Report format
 */
export type ReportFormat = 'pdf' | 'csv' | 'excel' | 'json';

/**
 * Report schedule
 */
export interface ReportSchedule {
  id: number;
  reportId: number;
  name: string | null;
  frequency: ScheduleFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  timezone: string;
  recipients: { email: string; name?: string }[];
  format: ReportFormat;
  includeCharts: boolean;
  lastSentAt: string | null;
  nextSendAt: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

/**
 * Report schedule response (snake_case for API)
 */
export interface ReportScheduleResponse {
  id: number;
  report_id: number;
  name: string | null;
  frequency: ScheduleFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  timezone: string;
  recipients: { email: string; name?: string }[];
  format: ReportFormat;
  include_charts: boolean;
  last_sent_at: string | null;
  next_send_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

/**
 * Widget types
 */
export type WidgetType = 'metric' | 'chart' | 'list' | 'table' | 'progress' | 'calendar' | 'funnel';

/**
 * Widget data sources
 */
export type WidgetDataSource = 'revenue' | 'projects' | 'clients' | 'leads' | 'invoices' | 'tasks' | 'milestones' | 'time';

/**
 * Dashboard widget
 */
export interface DashboardWidget {
  id: number;
  userEmail: string;
  widgetType: WidgetType;
  title: string | null;
  dataSource: WidgetDataSource;
  config: Record<string, unknown> | null;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  refreshInterval: number | null;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dashboard widget response (snake_case for API)
 */
export interface DashboardWidgetResponse {
  id: number;
  user_email: string;
  widget_type: WidgetType;
  title: string | null;
  data_source: WidgetDataSource;
  config: Record<string, unknown> | null;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  refresh_interval: number | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Dashboard preset
 */
export interface DashboardPreset {
  id: number;
  name: string;
  description: string | null;
  widgets: WidgetConfig[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

/**
 * Dashboard preset response (snake_case for API)
 */
export interface DashboardPresetResponse {
  id: number;
  name: string;
  description: string | null;
  widgets: WidgetConfig[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

/**
 * Widget configuration for presets
 */
export interface WidgetConfig {
  type: WidgetType;
  title: string;
  data_source: WidgetDataSource;
  config?: Record<string, unknown>;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * KPI types
 */
export type KPIType =
  | 'revenue'
  | 'pipeline_value'
  | 'client_count'
  | 'project_count'
  | 'conversion_rate'
  | 'avg_project_value'
  | 'outstanding_invoices'
  | 'paid_invoices'
  | 'active_leads'
  | 'closed_leads';

/**
 * KPI snapshot
 */
export interface KPISnapshot {
  id: number;
  snapshotDate: string;
  kpiType: KPIType;
  value: number;
  previousValue: number | null;
  changePercent: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * KPI snapshot response (snake_case for API)
 */
export interface KPISnapshotResponse {
  id: number;
  snapshot_date: string;
  kpi_type: KPIType;
  value: number;
  previous_value: number | null;
  change_percent: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * KPI trend data point
 */
export interface KPITrendPoint {
  date: string;
  value: number;
  changePercent: number | null;
}

/**
 * KPI trend
 */
export interface KPITrend {
  kpiType: KPIType;
  points: KPITrendPoint[];
  currentValue: number;
  previousValue: number | null;
  overallChange: number | null;
}

/**
 * Alert condition types
 */
export type AlertCondition = 'above' | 'below' | 'equals' | 'change_above' | 'change_below';

/**
 * Metric alert
 */
export interface MetricAlert {
  id: number;
  name: string;
  kpiType: KPIType;
  condition: AlertCondition;
  thresholdValue: number;
  notificationEmails: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  triggerCount: number;
  createdBy: string | null;
  createdAt: string;
}

/**
 * Metric alert response (snake_case for API)
 */
export interface MetricAlertResponse {
  id: number;
  name: string;
  kpi_type: KPIType;
  condition: AlertCondition;
  threshold_value: number;
  notification_emails: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_by: string | null;
  created_at: string;
}

/**
 * Report run status
 */
export type ReportRunStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Report run type
 */
export type ReportRunType = 'manual' | 'scheduled';

/**
 * Report run history
 */
export interface ReportRun {
  id: number;
  reportId: number | null;
  scheduleId: number | null;
  runType: ReportRunType;
  status: ReportRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  rowCount: number | null;
  filePath: string | null;
  errorMessage: string | null;
  runBy: string | null;
  createdAt: string;
}

/**
 * Report run response (snake_case for API)
 */
export interface ReportRunResponse {
  id: number;
  report_id: number | null;
  schedule_id: number | null;
  run_type: ReportRunType;
  status: ReportRunStatus;
  started_at: string | null;
  completed_at: string | null;
  row_count: number | null;
  file_path: string | null;
  error_message: string | null;
  run_by: string | null;
  created_at: string;
}

/**
 * Revenue analytics data
 */
export interface RevenueAnalytics {
  totalRevenue: number;
  paidRevenue: number;
  outstandingRevenue: number;
  overdueRevenue: number;
  revenueByMonth: { month: string; revenue: number; paid: number }[];
  revenueByClient: { clientId: number; clientName: string; revenue: number }[];
  avgInvoiceValue: number;
  avgDaysToPayment: number;
}

/**
 * Pipeline analytics data
 */
export interface PipelineAnalytics {
  totalValue: number;
  weightedValue: number;
  leadCount: number;
  conversionRate: number;
  byStage: { stageId: number; stageName: string; value: number; count: number }[];
  bySource: { sourceId: number; sourceName: string; value: number; count: number }[];
  avgLeadScore: number;
  avgDaysToClose: number;
}

/**
 * Project analytics data
 */
export interface ProjectAnalytics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  onHoldProjects: number;
  avgCompletionTime: number;
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number }[];
  completionTrend: { month: string; completed: number; started: number }[];
}

/**
 * Client analytics data
 */
export interface ClientAnalytics {
  totalClients: number;
  activeClients: number;
  newClientsThisMonth: number;
  avgLifetimeValue: number;
  byIndustry: { industry: string; count: number }[];
  bySize: { size: string; count: number }[];
  topClients: { clientId: number; clientName: string; revenue: number; projects: number }[];
  healthDistribution: { status: string; count: number }[];
}

/**
 * Team analytics data
 */
export interface TeamAnalytics {
  totalHours: number;
  billableHours: number;
  billablePercent: number;
  revenue: number;
  byMember: { name: string; hours: number; billableHours: number; revenue: number }[];
  byProject: { projectId: number; projectName: string; hours: number }[];
  hoursTrend: { week: string; hours: number; billableHours: number }[];
}

/**
 * Create saved report request
 */
export interface CreateSavedReportRequest {
  name: string;
  description?: string;
  report_type: ReportType;
  filters?: Record<string, unknown>;
  columns?: string[];
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
  chart_type?: ChartType;
}

/**
 * Update saved report request
 */
export interface UpdateSavedReportRequest {
  name?: string;
  description?: string;
  filters?: Record<string, unknown>;
  columns?: string[];
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
  chart_type?: ChartType;
  is_shared?: boolean;
}

/**
 * Create report schedule request
 */
export interface CreateReportScheduleRequest {
  name?: string;
  frequency: ScheduleFrequency;
  day_of_week?: number;
  day_of_month?: number;
  time_of_day?: string;
  timezone?: string;
  recipients: { email: string; name?: string }[];
  format?: ReportFormat;
  include_charts?: boolean;
}

/**
 * Update report schedule request
 */
export interface UpdateReportScheduleRequest {
  name?: string;
  frequency?: ScheduleFrequency;
  day_of_week?: number;
  day_of_month?: number;
  time_of_day?: string;
  timezone?: string;
  recipients?: { email: string; name?: string }[];
  format?: ReportFormat;
  include_charts?: boolean;
  is_active?: boolean;
}

/**
 * Create dashboard widget request
 */
export interface CreateDashboardWidgetRequest {
  widget_type: WidgetType;
  title?: string;
  data_source: WidgetDataSource;
  config?: Record<string, unknown>;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  refresh_interval?: number;
}

/**
 * Update dashboard widget request
 */
export interface UpdateDashboardWidgetRequest {
  title?: string;
  config?: Record<string, unknown>;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  refresh_interval?: number;
  is_visible?: boolean;
}

/**
 * Widget layout update
 */
export interface WidgetLayoutUpdate {
  id: number;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
}

/**
 * Create metric alert request
 */
export interface CreateMetricAlertRequest {
  name: string;
  kpi_type: KPIType;
  condition: AlertCondition;
  threshold_value: number;
  notification_emails: string[];
}

/**
 * Update metric alert request
 */
export interface UpdateMetricAlertRequest {
  name?: string;
  condition?: AlertCondition;
  threshold_value?: number;
  notification_emails?: string[];
  is_active?: boolean;
}

/**
 * Latest KPIs response
 */
export interface LatestKPIsResponse {
  [key: string]: {
    value: number;
    previousValue: number | null;
    changePercent: number | null;
    date: string;
  };
}

/**
 * Triggered alert info
 */
export interface TriggeredAlert {
  alertId: number;
  alertName: string;
  kpiType: KPIType;
  currentValue: number;
  thresholdValue: number;
  condition: AlertCondition;
  triggeredAt: string;
}
