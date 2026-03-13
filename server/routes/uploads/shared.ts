/**
 * ===============================================
 * UPLOAD ROUTES — SHARED
 * ===============================================
 * Types, validation schemas, multer config, and helpers
 * shared across all upload sub-routers.
 */

import express from 'express';
import multer from 'multer';
import { resolve, extname, normalize } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { getDatabase } from '../../database/init.js';
import {
  getUploadsDir,
  getUploadsSubdir,
  UPLOAD_DIRS,
  sanitizeFilename
} from '../../config/uploads.js';
import { VALIDATION_PATTERNS } from '../../../shared/validation/patterns.js';

// ============================================
// Types
// ============================================

/** Database row type for file records */
export interface FileRow {
  id: number;
  project_id: number;
  project_name?: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  file_path: string;
  uploaded_by: string;
  created_at: string;
  description?: string;
  file_type?: string;
  category?: string;
  shared_with_client?: number | boolean;
  shared_at?: string;
  shared_by?: string;
}

/** Database row type for project records */
export interface ProjectRow {
  id: number;
  project_name: string;
}

// ============================================
// Validation Schemas
// ============================================

export const UploadValidationSchemas = {
  fileMetadata: {
    filename: {
      type: 'string' as const,
      maxLength: 255,
      customValidator: (value: string) => {
        if (value.includes('..') || value.includes('/') || value.includes('\\')) {
          return 'Filename cannot contain path traversal characters';
        }
        if (!VALIDATION_PATTERNS.FILENAME_SAFE.test(value)) {
          return 'Filename contains invalid characters';
        }
        return true;
      }
    },
    fileType: {
      type: 'string' as const,
      maxLength: 100,
      allowedValues: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'application/rtf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip', 'application/x-rar-compressed', 'application/x-tar',
        'application/gzip', 'application/x-7z-compressed',
        'application/json', 'text/xml', 'application/xml'
      ]
    },
    fileSize: {
      type: 'number' as const,
      min: 1,
      max: 10 * 1024 * 1024
    },
    description: { type: 'string' as const, maxLength: 1000 },
    category: {
      type: 'string' as const,
      allowedValues: ['general', 'avatar', 'project_file', 'invoice_attachment', 'message_attachment']
    }
  },
  deliverableAction: {
    notes: { type: 'string' as const, maxLength: 2000 },
    feedback: { type: 'string' as const, maxLength: 5000 },
    reason: { type: 'string' as const, maxLength: 2000 },
    comment: { type: 'string' as const, maxLength: 2000 }
  }
};

// ============================================
// Upload Directory & Path Helpers
// ============================================

export const uploadDir = getUploadsDir();

if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

/** Validate file path to prevent path traversal attacks */
export function isPathSafe(filePath: string): boolean {
  const cleanPath = filePath.replace(/^\//, '').replace(/^uploads\//, '');
  const resolvedPath = resolve(uploadDir, cleanPath);
  const normalizedPath = normalize(resolvedPath);
  return normalizedPath.startsWith(normalize(uploadDir));
}

/** Resolve a database file_path to the actual filesystem path */
export function resolveFilePath(dbFilePath: string): string {
  const cleanPath = dbFilePath.replace(/^\//, '').replace(/^uploads\//, '');
  return resolve(uploadDir, cleanPath);
}

// ============================================
// Access Control Helpers
// ============================================

export async function canAccessProject(req: AuthenticatedRequest, projectId: number): Promise<boolean> {
  if (req.user?.type === 'admin') {
    return true;
  }

  const db = getDatabase();
  const row = await db.get('SELECT 1 FROM projects WHERE id = ? AND client_id = ?', [
    projectId,
    req.user?.id
  ]);

  return !!row;
}

export async function canAccessFile(req: AuthenticatedRequest, fileId: number): Promise<boolean> {
  if (req.user?.type === 'admin') {
    return true;
  }

  const db = getDatabase();
  const userId = req.user?.id;
  const userEmail = req.user?.email;

  const row = await db.get(
    `SELECT 1
     FROM files f
     LEFT JOIN projects p ON f.project_id = p.id
     WHERE f.id = ? AND f.deleted_at IS NULL
       AND (
         f.uploaded_by = ?
         OR f.uploaded_by = ?
         OR f.uploaded_by = ?
         OR (p.client_id = ? AND f.shared_with_client = TRUE)
       )`,
    [fileId, userEmail, userId, String(userId), userId]
  );

  return !!row;
}

// ============================================
// Multer Configuration
// ============================================

const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'image/svg+xml': ['svg'],
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'text/plain': ['txt', 'md'],
  'application/rtf': ['rtf'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/csv': ['csv'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'application/zip': ['zip'],
  'application/x-rar-compressed': ['rar'],
  'application/x-tar': ['tar'],
  'application/gzip': ['gz'],
  'application/x-7z-compressed': ['7z'],
  'application/json': ['json'],
  'text/xml': ['xml'],
  'application/xml': ['xml']
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subDir: string = UPLOAD_DIRS.GENERAL;

    if (file.fieldname === 'avatar') {
      subDir = UPLOAD_DIRS.AVATARS;
    } else if (file.fieldname === 'project_file') {
      subDir = UPLOAD_DIRS.PROJECTS;
    } else if (file.fieldname === 'invoice_attachment') {
      subDir = UPLOAD_DIRS.INVOICES;
    } else if (file.fieldname === 'message_attachment') {
      subDir = UPLOAD_DIRS.MESSAGES;
    }

    const targetDir = getUploadsSubdir(subDir);
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const filename = sanitizeFilename(file.originalname);
    cb(null, filename);
  }
});

const fileFilter = (req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = {
    images: /\.(jpg|jpeg|png|gif|webp|svg)$/i,
    documents: /\.(pdf|doc|docx|txt|md|rtf)$/i,
    spreadsheets: /\.(xls|xlsx|csv)$/i,
    presentations: /\.(ppt|pptx)$/i,
    archives: /\.(zip|rar|tar|gz|7z)$/i,
    data: /\.(json|xml)$/i
  };

  const fileName = file.originalname.toLowerCase();
  const fileExt = extname(fileName).slice(1);
  const isAllowed = Object.values(allowedTypes).some((regex) => regex.test(fileName));

  if (!isAllowed) {
    return cb(new Error(`File type not allowed: ${extname(file.originalname)}`));
  }

  const allowedExtensions = MIME_TO_EXTENSIONS[file.mimetype];
  if (!allowedExtensions) {
    return cb(new Error(`Unsupported MIME type: ${file.mimetype}`));
  }

  if (!allowedExtensions.includes(fileExt)) {
    return cb(new Error(`MIME type ${file.mimetype} does not match extension .${fileExt}`));
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5
  }
});
