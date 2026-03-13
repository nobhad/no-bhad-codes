/**
 * ===============================================
 * API TYPES — CLIENTS
 * ===============================================
 */

import type { ProjectResponse, ProjectFileResponse, ProjectMilestoneResponse } from './projects.js';
import type { MessageResponse } from './messages.js';

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
export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'url'
  | 'email'
  | 'phone';

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
