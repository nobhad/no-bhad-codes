/**
 * ===============================================
 * FILE VALIDATION UTILITIES
 * ===============================================
 * @file src/utils/file-validation.ts
 *
 * Shared file validation constants and functions.
 * Single source of truth for file type restrictions across all portals.
 */

/**
 * Maximum file size in bytes (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Maximum file size formatted for display
 */
export const MAX_FILE_SIZE_DISPLAY = '10MB';

/**
 * Allowed file extensions regex
 */
export const ALLOWED_EXTENSIONS = /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar|xls|xlsx|csv|ppt|pptx)$/i;

/**
 * Allowed MIME types
 */
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  // Spreadsheets
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  // Presentations
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed'
];

/**
 * File type categories for display
 */
export const FILE_TYPE_CATEGORIES = {
  images: ['jpeg', 'jpg', 'png', 'gif', 'webp'],
  documents: ['pdf', 'doc', 'docx', 'txt'],
  spreadsheets: ['xls', 'xlsx', 'csv'],
  presentations: ['ppt', 'pptx'],
  archives: ['zip', 'rar', '7z']
} as const;

/**
 * Validation result interface
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Check if a file has an allowed extension
 */
export function hasAllowedExtension(filename: string): boolean {
  return ALLOWED_EXTENSIONS.test(filename);
}

/**
 * Check if a file has an allowed MIME type
 */
export function hasAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * Check if a file size is within the allowed limit
 */
export function isWithinSizeLimit(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

/**
 * Validate a file for upload
 */
export function validateFileUpload(file: File): FileValidationResult {
  // Check file extension
  if (!hasAllowedExtension(file.name)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${getAllowedExtensionsDisplay()}`
    };
  }

  // Check MIME type
  if (!hasAllowedMimeType(file.type)) {
    return {
      valid: false,
      error: 'Invalid file format. Please upload a valid file.'
    };
  }

  // Check file size
  if (!isWithinSizeLimit(file.size)) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE_DISPLAY} limit.`
    };
  }

  return { valid: true };
}

/**
 * Validate multiple files for upload
 */
export function validateFilesUpload(files: FileList | File[]): FileValidationResult {
  const fileArray = Array.from(files);

  for (const file of fileArray) {
    const result = validateFileUpload(file);
    if (!result.valid) {
      return {
        valid: false,
        error: `${file.name}: ${result.error}`
      };
    }
  }

  return { valid: true };
}

/**
 * Get allowed extensions as a display string
 */
export function getAllowedExtensionsDisplay(): string {
  return 'JPEG, PNG, GIF, PDF, DOC, DOCX, TXT, XLS, XLSX, CSV, PPT, PPTX, ZIP, RAR';
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.slice(lastDot + 1).toLowerCase() : '';
}

/**
 * Get file type category
 */
export function getFileCategory(filename: string): string {
  const ext = getFileExtension(filename);

  for (const [category, extensions] of Object.entries(FILE_TYPE_CATEGORIES)) {
    if ((extensions as readonly string[]).includes(ext)) {
      return category;
    }
  }

  return 'other';
}

/**
 * Get file type label for display
 */
export function getFileTypeLabel(filename: string): string {
  const ext = getFileExtension(filename).toUpperCase();
  return ext || 'File';
}

// Re-export formatFileSize from canonical source
export { formatFileSize } from './format-utils';

/**
 * Check if file is an image
 */
export function isImageFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return FILE_TYPE_CATEGORIES.images.includes(ext as typeof FILE_TYPE_CATEGORIES.images[number]);
}

/**
 * Check if file is a PDF
 */
export function isPdfFile(filename: string): boolean {
  return getFileExtension(filename) === 'pdf';
}

/**
 * Check if file can be previewed in browser
 */
export function canPreviewInBrowser(filename: string): boolean {
  return isImageFile(filename) || isPdfFile(filename);
}
