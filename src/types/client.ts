/**
 * ===============================================
 * CLIENT TYPE DEFINITIONS
 * ===============================================
 * @file src/types/client.ts
 *
 * Type definitions for client portal, project management, and intake forms.
 */

export type ClientProjectStatus = 'pending' | 'in-progress' | 'in-review' | 'completed' | 'on-hold';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectType =
  | 'website'
  | 'application'
  | 'e-commerce'
  | 'extension'
  | 'consultation'
  | 'other';
export type BudgetRange = 'under-5k' | '5k-10k' | '10k-25k' | '25k-50k' | 'over-50k' | 'ongoing';
export type Timeline =
  | 'asap'
  | '1-month'
  | '2-3-months'
  | '3-6-months'
  | 'over-6-months'
  | 'flexible';

export interface ClientProject {
  id: string;
  projectName: string;
  description?: string;
  clientId: string;
  clientName: string;
  status: ClientProjectStatus;
  priority: ProjectPriority;
  progress: number; // 0-100
  startDate: string;
  estimatedEndDate?: string;
  actualEndDate?: string;
  updates: ProjectUpdate[];
  files: ProjectFile[];
  messages: ClientMessage[];
  milestones: ProjectMilestone[];
  invoice?: InvoiceInfo;
}

export interface ProjectUpdate {
  id: string;
  date: string;
  title: string;
  description: string;
  author: string;
  type: 'progress' | 'milestone' | 'issue' | 'resolution' | 'general';
}

export interface ProjectFile {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedDate: string;
  uploadedBy: string;
  type: 'document' | 'image' | 'video' | 'archive' | 'other';
  description?: string;
}

export interface ClientMessage {
  id: string;
  sender: string;
  senderRole: 'client' | 'developer' | 'system';
  message: string;
  timestamp: string;
  isRead: boolean;
  attachments?: ProjectFile[];
}

export interface ProjectMilestone {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  completedDate?: string;
  isCompleted: boolean;
  deliverables: string[];
}

export interface InvoiceInfo {
  id: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: string;
  paidDate?: string;
}

// Client Intake Form Types
export interface ClientIntakeForm {
  // Contact Information
  contactInfo: ContactInfo;

  // Company Information
  companyInfo?: CompanyInfo;

  // Project Details
  projectDetails: ProjectDetails;

  // Technical Requirements
  technicalRequirements: TechnicalRequirements;

  // Timeline & Budget
  timelineBudget: TimelineBudget;

  // Additional Information
  additionalInfo?: AdditionalInfo;

  // Form Metadata
  submittedAt?: string;
  formId?: string;
}

export interface ContactInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  preferredContact: 'email' | 'phone' | 'either';
  timezone?: string;
}

export interface CompanyInfo {
  companyName?: string;
  website?: string;
  industry?: string;
  companySize?: 'solo' | 'small' | 'medium' | 'large' | 'enterprise';
  role?: string;
}

export interface ProjectDetails {
  projectTitle: string;
  projectDescription: string;
  projectType: ProjectType[];
  targetAudience?: string;
  competitors?: string;
  uniqueValue?: string;
}

export interface TechnicalRequirements {
  features: string[];
  integrations?: string[];
  hasExistingAssets: boolean;
  existingAssets?: string;
  hostingPreference?: 'managed' | 'self-hosted' | 'no-preference';
  maintenanceRequired: boolean;
  seoRequired: boolean;
  analyticsRequired: boolean;
  accessibilityLevel?: 'basic' | 'wcag-a' | 'wcag-aa' | 'wcag-aaa';
}

export interface TimelineBudget {
  timeline: Timeline;
  startDate?: string;
  budgetRange: BudgetRange;
  paymentPreference?: 'upfront' | 'milestone' | 'monthly' | 'completion';
}

export interface AdditionalInfo {
  inspiration?: string[];
  additionalNotes?: string;
  fileUploads?: ProjectFile[];
  howDidYouHear?: string;
  referralSource?: string;
}

// Authentication Types
export interface ClientCredentials {
  projectName: string;
  password: string;
}

export interface ClientSession {
  projectId: string;
  clientName: string;
  loginTime: string;
  expiresAt: string;
  token: string;
}

import { getProjectStatusColor } from '../config/constants';

// Helper functions
export function getStatusColor(status: ClientProjectStatus): string {
  return getProjectStatusColor(status);
}

export function getPriorityIcon(priority: ProjectPriority): string {
  const icons: Record<ProjectPriority, string> = {
    low: '🔵',
    medium: '🟡',
    high: '🟠',
    urgent: '🔴'
  };
  return icons[priority] || '⚪';
}

export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
}
