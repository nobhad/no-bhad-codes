/**
 * ===============================================
 * CONTACT SERVICE
 * ===============================================
 * @file server/services/contact-service.ts
 *
 * Handles storing contact form submissions.
 */

import { getDatabase } from '../database/init.js';

// ============================================
// TYPES
// ============================================

export interface ContactSubmissionParams {
  name: string;
  email: string;
  subject: string;
  message: string;
  ipAddress: string;
  userAgent: string;
  messageId: string;
}

// ============================================
// SERVICE
// ============================================

/**
 * Save a contact form submission to the database.
 */
async function saveContactSubmission(params: ContactSubmissionParams): Promise<void> {
  const db = getDatabase();
  await db.run(
    `INSERT INTO contact_submissions (name, email, subject, message, ip_address, user_agent, message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.name,
      params.email,
      params.subject,
      params.message,
      params.ipAddress,
      params.userAgent,
      params.messageId
    ]
  );
}

export const contactService = { saveContactSubmission };
