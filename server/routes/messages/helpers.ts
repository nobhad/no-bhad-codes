/**
 * ===============================================
 * MESSAGE ROUTE HELPERS
 * ===============================================
 * @file server/routes/messages/helpers.ts
 *
 * Shared constants, middleware, types, and helper functions for message routes
 */

import crypto from 'crypto';

import multer from 'multer';
import path from 'path';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { messageService } from '../../services/message-service.js';
import { getUploadsSubdir, UPLOAD_DIRS } from '../../config/uploads.js';

// Explicit column lists for SELECT queries (avoid SELECT *)
export const MESSAGE_THREAD_COLUMNS = `
  id, project_id, client_id, subject, thread_type, status, priority,
  last_message_at, last_message_by, participant_count, created_at, updated_at,
  pinned_count, archived_at, archived_by
`.replace(/\s+/g, ' ').trim();

export const MESSAGE_COLUMNS = `
  id, project_id, client_id, thread_id, context_type, sender_type, sender_name,
  subject, message, message_type, priority, read_at, attachments,
  parent_message_id, is_internal, edited_at, deleted_at, deleted_by,
  reaction_count, reply_count, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

export const NOTIFICATION_PREF_COLUMNS = `
  id, client_id, email_enabled, sms_enabled, push_enabled,
  new_message_notifications, project_updates_notifications,
  invoice_notifications, marketing_notifications,
  quiet_hours_start, quiet_hours_end, timezone, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

/**
 * Check if the authenticated user can access a specific message
 */
export async function canAccessMessage(req: AuthenticatedRequest, messageId: number): Promise<boolean> {
  return messageService.canUserAccessMessage(req.user?.type || '', req.user?.id, messageId);
}

/**
 * Check if the authenticated user can access a specific project
 */
export async function canAccessProject(req: AuthenticatedRequest, projectId: number): Promise<boolean> {
  return messageService.canUserAccessProject(req.user?.type || '', req.user?.id, projectId);
}

// MIME type to extension mapping for validation
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/plain': ['txt'],
  'application/zip': ['zip']
};

// Allowed extensions whitelist
const ALLOWED_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'txt',
  'zip'
]);

// Configure multer for file attachments using centralized config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadsSubdir(UPLOAD_DIRS.MESSAGES));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for message attachments
    files: 5 // Max 5 files per message
  },
  fileFilter: (req, file, cb) => {
    const fileName = file.originalname.toLowerCase();
    const fileExt = path.extname(fileName).slice(1); // Remove leading dot

    // Check for double extensions (e.g., file.jpg.exe)
    const parts = fileName.split('.');
    if (parts.length > 2) {
      const dangerousExts = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js', 'msi', 'dll'];
      for (let i = 1; i < parts.length - 1; i++) {
        if (dangerousExts.includes(parts[i])) {
          return cb(new Error('Suspicious file extension detected'));
        }
      }
    }

    // Check if extension is allowed
    if (!ALLOWED_EXTENSIONS.has(fileExt)) {
      return cb(new Error(`File type not allowed: .${fileExt}`));
    }

    // Verify MIME type matches the extension
    const allowedExtensions = MIME_TO_EXTENSIONS[file.mimetype];
    if (!allowedExtensions) {
      return cb(new Error(`Unsupported MIME type: ${file.mimetype}`));
    }

    if (!allowedExtensions.includes(fileExt)) {
      return cb(new Error(`MIME type ${file.mimetype} does not match extension .${fileExt}`));
    }

    cb(null, true);
  }
});
