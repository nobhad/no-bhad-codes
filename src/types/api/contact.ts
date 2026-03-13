/**
 * ===============================================
 * API TYPES — CONTACT
 * ===============================================
 */

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
