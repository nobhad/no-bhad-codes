/**
 * ===============================================
 * UPLOADS CONFIGURATION
 * ===============================================
 * @file server/config/uploads.ts
 *
 * Centralized configuration for file uploads.
 * Uses persistent storage path on Railway.
 */

import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Get the base uploads directory.
 * On Railway, this uses the persistent volume at /app/data/uploads
 * In development, this uses ./uploads relative to project root
 */
export function getUploadsDir(): string {
  // Use UPLOADS_DIR env var, or default based on DATABASE_PATH location
  if (process.env.UPLOADS_DIR) {
    return resolve(process.env.UPLOADS_DIR);
  }

  // If DATABASE_PATH starts with /app/data, we're on Railway - use persistent volume
  const dbPath = process.env.DATABASE_PATH || '';
  if (dbPath.startsWith('/app/data')) {
    return '/app/data/uploads';
  }

  // Default to local uploads directory
  return resolve(process.cwd(), 'uploads');
}

/**
 * Get a specific uploads subdirectory, creating it if needed
 */
export function getUploadsSubdir(subdir: string): string {
  const baseDir = getUploadsDir();
  const fullPath = join(baseDir, subdir);

  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
    console.log(`[Uploads] Created directory: ${fullPath}`);
  }

  return fullPath;
}

/**
 * Get the relative path for storing in database
 * This is the path used to serve files via the API
 */
export function getRelativePath(subdir: string, filename: string): string {
  return `uploads/${subdir}/${filename}`;
}

/**
 * Standard upload subdirectories
 */
export const UPLOAD_DIRS = {
  INTAKE: 'intake',
  PROJECTS: 'projects',
  AVATARS: 'avatars',
  MESSAGES: 'messages',
  INVOICES: 'invoices',
  GENERAL: 'general',
  CONTRACTS: 'contracts',
  RECEIPTS: 'receipts'
} as const;

/**
 * Sanitize a filename for safe storage
 * - Adds NoBhadCodes branding prefix
 * - Replaces spaces with underscores
 * - Removes special characters (keeps alphanumeric, underscores, hyphens, dots)
 * - Preserves file extension
 * - Adds timestamp suffix for uniqueness
 */
export function sanitizeFilename(originalFilename: string): string {
  // Get the extension
  const lastDot = originalFilename.lastIndexOf('.');
  const ext = lastDot > 0 ? originalFilename.slice(lastDot) : '';
  const nameWithoutExt = lastDot > 0 ? originalFilename.slice(0, lastDot) : originalFilename;

  // Sanitize the name:
  // 1. Replace spaces with underscores
  // 2. Remove any character that's not alphanumeric, underscore, or hyphen
  // 3. Replace multiple underscores/hyphens with single ones
  // 4. Trim underscores/hyphens from start and end
  const sanitized = nameWithoutExt
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/[_-]+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
    .toLowerCase();

  // Add timestamp for uniqueness
  const timestamp = Date.now();

  // Ensure we have a valid name
  const finalName = sanitized || 'file';

  return `nobhadcodes_${finalName}_${timestamp}${ext.toLowerCase()}`;
}
