/**
 * Admin Feature Types
 * Type definitions for React admin components
 */

/**
 * Project status values
 */
export type ProjectStatus =
  | 'pending'
  | 'active'
  | 'in-progress'
  | 'on-hold'
  | 'completed'
  | 'cancelled';

/**
 * Project type values
 */
export type ProjectType =
  | 'simple-site'
  | 'business-site'
  | 'portfolio'
  | 'e-commerce'
  | 'web-app'
  | 'browser-extension';

/**
 * Project data from API
 * Maps to LeadProject in vanilla code
 */
export interface Project {
  id: number;
  project_name?: string;
  client_id?: number;
  client_name?: string;
  contact_name?: string;
  company_name?: string;
  email?: string;
  project_type?: ProjectType | string;
  budget_range?: string;
  budget?: number;
  timeline?: string;
  status: ProjectStatus;
  description?: string;
  features?: string;
  progress?: number;
  notes?: string;
  created_at?: string;
  start_date?: string;
  end_date?: string;
  // Financial fields
  price?: number;
  deposit_amount?: number;
  contract_signed_date?: string;
  // URL fields
  preview_url?: string;
  repo_url?: string;
  production_url?: string;
  // Computed fields from API
  file_count?: number;
  message_count?: number;
  unread_count?: number;
}

/**
 * Filter configuration for projects table
 */
export interface ProjectFilters {
  search: string;
  status: ProjectStatus | 'all';
  type: ProjectType | 'all';
  budgetRange: string | 'all';
  timeline: string | 'all';
}

/**
 * Sort configuration
 */
export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

/**
 * Pagination state
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Project stats for dashboard
 */
export interface ProjectStats {
  total: number;
  active: number;
  completed: number;
  onHold: number;
  pending: number;
}

/**
 * Status display configuration
 */
export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; variant: string }> = {
  pending: { label: 'Pending', variant: 'pending' },
  active: { label: 'Active', variant: 'active' },
  'in-progress': { label: 'In Progress', variant: 'active' },
  'on-hold': { label: 'On Hold', variant: 'on-hold' },
  completed: { label: 'Completed', variant: 'completed' },
  cancelled: { label: 'Cancelled', variant: 'cancelled' }
};

/**
 * Project type display labels
 */
export const PROJECT_TYPE_LABELS: Record<string, string> = {
  'simple-site': 'Simple Site',
  'business-site': 'Business Site',
  portfolio: 'Portfolio',
  'e-commerce': 'E-Commerce',
  'web-app': 'Web App',
  'browser-extension': 'Browser Extension'
};

// ============================================================================
// LEAD TYPES
// ============================================================================

/**
 * Lead status values (pipeline stages)
 */
export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'in-progress'
  | 'converted'
  | 'lost'
  | 'on-hold'
  | 'cancelled';

/**
 * Lead data from API
 */
export interface Lead {
  id: number;
  client_id?: number;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  status: LeadStatus;
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

/**
 * Lead stats for dashboard
 */
export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  inProgress: number;
  converted: number;
  lost: number;
}

/**
 * Lead status display configuration
 */
export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; variant: string }> = {
  new: { label: 'New', variant: 'pending' },
  contacted: { label: 'Contacted', variant: 'active' },
  qualified: { label: 'Qualified', variant: 'warning' },
  'in-progress': { label: 'In Progress', variant: 'active' },
  converted: { label: 'Converted', variant: 'completed' },
  lost: { label: 'Lost', variant: 'cancelled' },
  'on-hold': { label: 'On Hold', variant: 'on-hold' },
  cancelled: { label: 'Cancelled', variant: 'cancelled' }
};

/**
 * Lead source display labels
 */
export const LEAD_SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  referral: 'Referral',
  social: 'Social Media',
  direct: 'Direct',
  'ad-campaign': 'Ad Campaign',
  other: 'Other'
};

// ============================================================================
// CLIENT TYPES
// ============================================================================

/**
 * Client status values
 */
export type ClientStatus = 'active' | 'inactive' | 'pending';

/**
 * Client type values
 */
export type ClientType = 'personal' | 'business';

/**
 * Client data from API
 */
export interface Client {
  id: number;
  email: string;
  contact_name: string | null;
  company_name: string | null;
  client_type: ClientType;
  phone: string | null;
  status: ClientStatus;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  // Computed fields
  project_count?: number;
  // Invitation tracking
  invitation_sent_at?: string | null;
  invitation_expires_at?: string | null;
  // Billing fields
  billing_name?: string | null;
  billing_email?: string | null;
  billing_address?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip?: string | null;
  billing_country?: string | null;
  // CRM fields
  health_score?: number | null;
  health_status?: 'healthy' | 'at-risk' | 'critical' | null;
  tags?: Array<{ id: number; name: string; color: string }>;
}

/**
 * Client stats for dashboard
 */
export interface ClientStats {
  total: number;
  active: number;
  inactive: number;
  pending: number;
}

/**
 * Client status display configuration
 */
export const CLIENT_STATUS_CONFIG: Record<ClientStatus, { label: string; variant: string }> = {
  active: { label: 'Active', variant: 'active' },
  inactive: { label: 'Inactive', variant: 'cancelled' },
  pending: { label: 'Pending', variant: 'pending' }
};

/**
 * Client type display labels
 */
export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  personal: 'Personal',
  business: 'Business'
};

// ============================================================================
// INVOICE TYPES
// ============================================================================

/**
 * Invoice status values
 */
export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'pending'
  | 'viewed'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'partial';

/**
 * Invoice type values
 */
export type InvoiceType = 'standard' | 'deposit';

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
 * Invoice data from API
 */
export interface Invoice {
  id: number;
  project_id: number;
  client_id?: number;
  invoice_number: string;
  amount_total: number | string;
  amount_paid?: number | string;
  status: InvoiceStatus;
  due_date: string;
  paid_date?: string;
  created_at: string;
  updated_at?: string;
  invoice_type?: InvoiceType;
  deposit_for_project_id?: number;
  deposit_percentage?: number;
  line_items?: InvoiceLineItem[];
  notes?: string;
  terms?: string;
  // Joined fields
  client_name?: string;
  project_name?: string;
}

/**
 * Invoice stats for dashboard
 */
export interface InvoiceStats {
  total: number;
  pending: number;
  paid: number;
  overdue: number;
}

/**
 * Invoice status display configuration
 */
export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; variant: string }> = {
  draft: { label: 'Draft', variant: 'pending' },
  sent: { label: 'Sent', variant: 'active' },
  pending: { label: 'Pending', variant: 'warning' },
  viewed: { label: 'Viewed', variant: 'active' },
  paid: { label: 'Paid', variant: 'completed' },
  overdue: { label: 'Overdue', variant: 'cancelled' },
  cancelled: { label: 'Cancelled', variant: 'cancelled' },
  partial: { label: 'Partial', variant: 'warning' }
};

// ============================================================================
// PROJECT DETAIL TYPES
// ============================================================================

/**
 * Project milestone
 */
export interface ProjectMilestone {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  due_date?: string;
  completed_date?: string;
  is_completed: boolean;
  deliverables?: string[];
  order_index?: number;
  // Computed from tasks
  task_count?: number;
  completed_task_count?: number;
  progress_percentage?: number;
}

/**
 * Task within a milestone
 */
export interface ProjectTask {
  id: number;
  milestone_id: number;
  project_id: number;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  assigned_to?: string;
  due_date?: string;
  completed_date?: string;
  order_index?: number;
}

/**
 * Project file upload
 */
export interface ProjectFile {
  id: number;
  project_id: number;
  filename: string;
  original_name: string;
  file_type: string;
  file_size: number;
  category?: string;
  is_shared: boolean;
  uploaded_by?: string;
  created_at: string;
  download_url?: string;
}

/**
 * File category options
 */
export const FILE_CATEGORY_OPTIONS = [
  { value: 'proposal', label: 'Project Proposal' },
  { value: 'contract', label: 'Contract' },
  { value: 'intake', label: 'Intake Form' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'wireframe', label: 'Wireframe' },
  { value: 'mockup', label: 'Design Mockup' },
  { value: 'brand', label: 'Brand Asset' },
  { value: 'content', label: 'Content/Copy' },
  { value: 'reference', label: 'Reference Material' },
  { value: 'other', label: 'Other' }
] as const;

/**
 * Message thread
 */
export interface MessageThread {
  id: number;
  project_id?: number;
  client_id: number;
  subject?: string;
  last_message_at?: string;
  unread_count?: number;
  created_at: string;
}

/**
 * Message in a thread
 */
export interface Message {
  id: number;
  thread_id: number;
  sender_type: 'admin' | 'client';
  sender_name?: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

/**
 * Project detail tab IDs
 */
export type ProjectDetailTab =
  | 'overview'
  | 'files'
  | 'deliverables'
  | 'messages'
  | 'invoices'
  | 'tasks'
  | 'contract'
  | 'notes';

/**
 * Tab configuration for project detail
 */
export const PROJECT_DETAIL_TABS: Array<{
  id: ProjectDetailTab;
  label: string;
  icon: string;
}> = [
  { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
  { id: 'files', label: 'Files', icon: 'FolderOpen' },
  { id: 'deliverables', label: 'Deliverables', icon: 'Package' },
  { id: 'messages', label: 'Messages', icon: 'MessageSquare' },
  { id: 'invoices', label: 'Invoices', icon: 'Receipt' },
  { id: 'tasks', label: 'Tasks', icon: 'CheckSquare' },
  { id: 'contract', label: 'Contract', icon: 'FileSignature' },
  { id: 'notes', label: 'Notes', icon: 'StickyNote' }
];

// ============================================================================
// CLIENT DETAIL TYPES
// ============================================================================

/**
 * Client health score and breakdown
 */
export interface ClientHealth {
  score: number;
  status: 'healthy' | 'at-risk' | 'critical';
  factors: {
    engagement: number;
    payment: number;
    project_success: number;
    communication: number;
  };
  calculated_at: string;
}

/**
 * Client contact person
 */
export interface ClientContact {
  id: number;
  client_id: number;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  role?: 'primary' | 'billing' | 'technical' | 'decision_maker' | 'other';
  is_primary: boolean;
  notes?: string;
  created_at: string;
}

/**
 * Client activity log entry
 */
export interface ClientActivity {
  id: number;
  client_id: number;
  type: string;
  title: string;
  description?: string;
  created_at: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Client note
 */
export interface ClientNote {
  id: number;
  client_id: number;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

/**
 * Client statistics
 */
export interface ClientDetailStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  avgResponseTime?: number;
}

/**
 * Client project summary
 */
export interface ClientProject {
  id: number;
  project_name: string;
  status: string;
  created_at: string;
  progress?: number;
}

/**
 * Tag for client CRM
 */
export interface ClientTag {
  id: number;
  name: string;
  color: string;
}

/**
 * Client detail tab IDs
 */
export type ClientDetailTab = 'overview' | 'contacts' | 'activity' | 'projects' | 'notes';

/**
 * Tab configuration for client detail
 */
export const CLIENT_DETAIL_TABS: Array<{
  id: ClientDetailTab;
  label: string;
  icon: string;
}> = [
  { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
  { id: 'contacts', label: 'Contacts', icon: 'Users' },
  { id: 'activity', label: 'Activity', icon: 'Clock' },
  { id: 'projects', label: 'Projects', icon: 'FolderKanban' },
  { id: 'notes', label: 'Notes', icon: 'StickyNote' }
];

/**
 * Contact role display labels
 */
export const CONTACT_ROLE_LABELS: Record<string, string> = {
  primary: 'Primary Contact',
  billing: 'Billing',
  technical: 'Technical',
  decision_maker: 'Decision Maker',
  other: 'Other'
};
