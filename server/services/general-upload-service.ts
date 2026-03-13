/**
 * ===============================================
 * GENERAL UPLOAD SERVICE
 * ===============================================
 * @file server/services/general-upload-service.ts
 *
 * Saves metadata for general (non-project) file uploads
 * into the uploaded_files table.
 */

import { getDatabase } from '../database/init.js';

// ============================================
// TYPES
// ============================================

export interface GeneralUploadParams {
  filename: string;
  originalFilename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

// ============================================
// SERVICE
// ============================================

/**
 * Save general file upload metadata and return the new row ID.
 */
async function saveUploadMetadata(params: GeneralUploadParams): Promise<number> {
  const db = getDatabase();
  const result = await db.run(
    `INSERT INTO uploaded_files (filename, original_filename, file_path, file_size, mime_type, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [params.filename, params.originalFilename, params.filePath, params.fileSize, params.mimeType]
  );
  return result.lastID || 0;
}

export const generalUploadService = { saveUploadMetadata };
