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
  GENERAL: 'general'
} as const;
