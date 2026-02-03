/**
 * Types for the project details module
 * @file src/features/admin/project-details/types.ts
 */

import type { ProjectResponse } from '../../../types/api';

/**
 * Context object passed to all project detail sub-modules.
 * Provides shared state and functions needed across modules.
 */
export interface ProjectDetailsContext {
  /** Current project ID being viewed */
  projectId: number;
  /** Current project data */
  project: ProjectResponse;
  /** All projects data for lookups */
  projectsData: ProjectResponse[];
  /** Navigate back to projects list */
  switchTab: (tab: string) => void;
  /** Refresh projects data from API */
  loadProjects: () => Promise<void>;
  /** Format project type for display */
  formatProjectType: (type: string) => string;
  /** Invite lead to portal */
  inviteLead: (leadId: number, email: string) => Promise<void>;
}

/**
 * Handler interface for the main project details class.
 * Exposed methods that need to be available globally (e.g., for onclick handlers).
 */
export interface ProjectDetailsHandler {
  showProjectDetails(
    projectId: number,
    projectsData: ProjectResponse[],
    switchTab: (tab: string) => void,
    loadProjects: () => Promise<void>,
    formatProjectType: (type: string) => string,
    inviteLead: (leadId: number, email: string) => Promise<void>
  ): void;
  toggleMilestone(milestoneId: number, isCompleted: boolean): Promise<void>;
  deleteMilestone(milestoneId: number): Promise<void>;
  sendInvoice(invoiceId: number): Promise<void>;
  editInvoice(invoiceId: number): Promise<void>;
  markInvoicePaid(invoiceId: number): Promise<void>;
  sendInvoiceReminder(invoiceId: number): Promise<void>;
  duplicateInvoice(invoiceId: number): Promise<void>;
  deleteInvoice(invoiceId: number): Promise<void>;
  showApplyCreditPrompt(invoiceId: number): Promise<void>;
  recordPayment(invoiceId: number): Promise<void>;
  cancelScheduledInvoice(scheduleId: number): Promise<void>;
  toggleRecurringInvoice(recurringId: number, isActive: boolean): Promise<void>;
  getCurrentProjectId(): number | null;
  getCurrentProjectName(): string | null;
}

/** Line item structure for invoices */
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount?: number;
}

/** Allowed file extensions for upload */
export const ALLOWED_EXTENSIONS = /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar)$/i;

/** Allowed MIME types for upload */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed',
  'application/vnd.rar'
];
