/**
 * ===============================================
 * CLIENT PORTAL TYPES
 * ===============================================
 * @file src/features/client/portal-types.ts
 *
 * Shared types for client portal modules.
 */

/** Portal file from API */
export interface PortalFile {
  id: string | number;
  originalName?: string;
  filename?: string;
  mimetype: string;
  size: number;
  uploadedBy?: string;
  uploadedAt: string;
  projectId?: string | number;
  projectName?: string;
  fileType?: string;
  category?: string;
}

/** Portal invoice from API */
export interface PortalInvoice {
  id: string | number;
  invoice_number: string;
  amount_total: number;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
  created_at: string;
  due_date?: string;
  paid_date?: string;
  project_name?: string;
}

/** Project from API with preview URL */
export interface PortalProject {
  id: string | number;
  name: string;
  status: string;
  preview_url?: string;
}

/** Message attachment */
export interface MessageAttachment {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimeType: string;
}

/** Message from API */
export interface PortalMessage {
  id: string | number;
  sender_type: 'client' | 'admin' | 'system';
  sender_name?: string;
  message: string;
  created_at: string;
  attachments?: MessageAttachment[] | null;
}

/** Context passed to portal modules */
export interface ClientPortalContext {
  getAuthToken: () => string | null;
  showNotification: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  formatDate: (dateString: string) => string;
  escapeHtml: (text: string) => string;
}
