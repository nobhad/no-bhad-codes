/**
 * ===============================================
 * ATTACHMENT MANAGER UTILITY
 * ===============================================
 * @file src/utils/attachment-manager.ts
 *
 * Consolidated file attachment handling utility.
 * Provides file validation, preview rendering, and selection management.
 */

import {
  MAX_FILE_SIZE,
  getFileExtension,
  formatFileSize,
  FILE_TYPE_CATEGORIES
} from './file-validation';
import { SanitizationUtils } from './sanitization-utils';
import { ICONS } from '../constants/icons';

/**
 * Represents an attachment file with metadata
 */
export interface AttachmentFile {
  file: File;
  id: string;
  previewUrl?: string;
}

/**
 * Configuration options for AttachmentManager
 */
export interface AttachmentManagerOptions {
  maxFiles?: number;
  allowedExtensions?: string[];
  maxFileSize?: number;
  onAdd?: (files: AttachmentFile[]) => void;
  onRemove?: (file: AttachmentFile) => void;
  onError?: (message: string) => void;
}

/**
 * Result of adding files to the manager
 */
export interface AddFilesResult {
  added: AttachmentFile[];
  errors: string[];
}

/**
 * Default allowed extensions for messaging
 */
export const DEFAULT_MESSAGING_EXTENSIONS = [
  ...FILE_TYPE_CATEGORIES.documents,
  ...FILE_TYPE_CATEGORIES.spreadsheets,
  ...FILE_TYPE_CATEGORIES.images.filter(ext => ext !== 'webp'),
  'zip'
];

/**
 * Default allowed extensions for general file uploads
 */
export const DEFAULT_UPLOAD_EXTENSIONS = [
  ...FILE_TYPE_CATEGORIES.images,
  ...FILE_TYPE_CATEGORIES.documents,
  ...FILE_TYPE_CATEGORIES.spreadsheets,
  ...FILE_TYPE_CATEGORIES.presentations,
  ...FILE_TYPE_CATEGORIES.archives
];

/**
 * Generate a unique ID for an attachment
 */
function generateAttachmentId(): string {
  return `attachment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * AttachmentManager class for handling file attachments
 *
 * Provides validation, preview rendering, and management of file attachments.
 *
 * @example
 * ```typescript
 * const manager = new AttachmentManager({
 *   maxFiles: 5,
 *   onError: (msg) => showToast(msg, 'error')
 * });
 *
 * // Add files from input
 * const { added, errors } = manager.add(inputElement.files);
 *
 * // Render preview
 * previewContainer.innerHTML = manager.renderPreview();
 *
 * // Get files for FormData
 * const formData = new FormData();
 * manager.getRawFiles().forEach(file => formData.append('attachments', file));
 * ```
 */
export class AttachmentManager {
  private files: AttachmentFile[] = [];
  private options: Required<AttachmentManagerOptions>;

  constructor(options: AttachmentManagerOptions = {}) {
    this.options = {
      maxFiles: options.maxFiles ?? 5,
      allowedExtensions: options.allowedExtensions ?? DEFAULT_MESSAGING_EXTENSIONS,
      maxFileSize: options.maxFileSize ?? MAX_FILE_SIZE,
      onAdd: options.onAdd ?? (() => {}),
      onRemove: options.onRemove ?? (() => {}),
      onError: options.onError ?? (() => {})
    };
  }

  /**
   * Add files from FileList (e.g., from input element)
   * Returns the added files and any validation errors
   */
  add(fileList: FileList | File[]): AddFilesResult {
    const result: AddFilesResult = {
      added: [],
      errors: []
    };

    const filesArray = Array.from(fileList);
    const remainingSlots = this.options.maxFiles - this.files.length;

    if (remainingSlots <= 0) {
      const errorMsg = `Maximum ${this.options.maxFiles} attachments allowed`;
      result.errors.push(errorMsg);
      this.options.onError(errorMsg);
      return result;
    }

    const filesToAdd = filesArray.slice(0, remainingSlots);

    for (const file of filesToAdd) {
      const validationError = this.validate(file);
      if (validationError) {
        result.errors.push(validationError);
        this.options.onError(validationError);
        continue;
      }

      const attachmentFile: AttachmentFile = {
        file,
        id: generateAttachmentId()
      };

      // Generate preview URL for images
      if (this.isImageFile(file)) {
        attachmentFile.previewUrl = URL.createObjectURL(file);
      }

      this.files.push(attachmentFile);
      result.added.push(attachmentFile);
    }

    // Notify if some files were skipped due to limit
    if (filesArray.length > remainingSlots) {
      const skippedMsg = `Only ${remainingSlots} more files can be added`;
      result.errors.push(skippedMsg);
      this.options.onError(skippedMsg);
    }

    // Trigger onAdd callback if files were added
    if (result.added.length > 0) {
      this.options.onAdd(result.added);
    }

    return result;
  }

  /**
   * Remove a file by ID
   */
  remove(id: string): void {
    const index = this.files.findIndex(f => f.id === id);
    if (index === -1) return;

    const removed = this.files[index];

    // Revoke object URL to prevent memory leaks
    if (removed.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
    }

    this.files.splice(index, 1);
    this.options.onRemove(removed);
  }

  /**
   * Remove a file by index
   */
  removeByIndex(index: number): void {
    if (index < 0 || index >= this.files.length) return;

    const removed = this.files[index];

    // Revoke object URL to prevent memory leaks
    if (removed.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
    }

    this.files.splice(index, 1);
    this.options.onRemove(removed);
  }

  /**
   * Clear all files
   */
  clear(): void {
    // Revoke all object URLs to prevent memory leaks
    for (const file of this.files) {
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
    }
    this.files = [];
  }

  /**
   * Get all current files
   */
  getFiles(): AttachmentFile[] {
    return [...this.files];
  }

  /**
   * Get raw File objects for FormData
   */
  getRawFiles(): File[] {
    return this.files.map(f => f.file);
  }

  /**
   * Get the number of current files
   */
  getCount(): number {
    return this.files.length;
  }

  /**
   * Check if the manager has any files
   */
  hasFiles(): boolean {
    return this.files.length > 0;
  }

  /**
   * Check if more files can be added
   */
  canAddMore(): boolean {
    return this.files.length < this.options.maxFiles;
  }

  /**
   * Get remaining slots for files
   */
  getRemainingSlots(): number {
    return this.options.maxFiles - this.files.length;
  }

  /**
   * Render preview HTML for all attachments
   * Returns HTML string for attachment preview chips
   */
  renderPreview(): string {
    if (this.files.length === 0) {
      return '';
    }

    return this.files
      .map((attachment, index) => {
        const file = attachment.file;
        const size = formatFileSize(file.size);
        const name = file.name.length > 20
          ? `${file.name.substring(0, 17)}...`
          : file.name;
        const safeName = SanitizationUtils.escapeHtml(name);
        const safeFullName = SanitizationUtils.escapeHtml(file.name);

        // Image preview
        if (attachment.previewUrl) {
          return `
            <div class="attachment-chip attachment-chip--image" data-id="${attachment.id}" data-index="${index}">
              <img src="${attachment.previewUrl}" alt="${safeFullName}" class="attachment-chip-thumbnail" />
              <span class="attachment-chip-name" title="${safeFullName}">${safeName}</span>
              <span class="attachment-chip-size">(${size})</span>
              <button type="button" class="attachment-chip-remove" data-id="${attachment.id}" data-index="${index}" aria-label="Remove attachment">
                ${ICONS.X_SMALL}
              </button>
            </div>
          `;
        }

        // File preview (non-image)
        return `
          <div class="attachment-chip" data-id="${attachment.id}" data-index="${index}">
            <span class="attachment-chip-icon">${ICONS.FILE}</span>
            <span class="attachment-chip-name" title="${safeFullName}">${safeName}</span>
            <span class="attachment-chip-size">(${size})</span>
            <button type="button" class="attachment-chip-remove" data-id="${attachment.id}" data-index="${index}" aria-label="Remove attachment">
              ${ICONS.X_SMALL}
            </button>
          </div>
        `;
      })
      .join('');
  }

  /**
   * Setup remove button event listeners for preview elements
   * Call this after rendering the preview HTML to the DOM
   */
  setupPreviewListeners(container: HTMLElement): void {
    container.querySelectorAll('.attachment-chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        if (id) {
          this.remove(id);
        }
      });
    });
  }

  /**
   * Validate a single file
   * Returns error message if invalid, null if valid
   */
  private validate(file: File): string | null {
    const ext = getFileExtension(file.name);

    // Check extension
    if (!this.options.allowedExtensions.includes(ext)) {
      return `File type .${ext} is not allowed. Allowed: ${this.options.allowedExtensions.join(', ')}`;
    }

    // Check file size
    if (file.size > this.options.maxFileSize) {
      const maxSizeFormatted = formatFileSize(this.options.maxFileSize);
      return `File ${file.name} is too large. Maximum size is ${maxSizeFormatted}.`;
    }

    return null;
  }

  /**
   * Check if a file is an image based on its extension
   */
  private isImageFile(file: File): boolean {
    const ext = getFileExtension(file.name);
    return FILE_TYPE_CATEGORIES.images.includes(ext as typeof FILE_TYPE_CATEGORIES.images[number]);
  }

  /**
   * Get the allowed extensions for this manager
   */
  getAllowedExtensions(): string[] {
    return [...this.options.allowedExtensions];
  }

  /**
   * Get the max file size for this manager
   */
  getMaxFileSize(): number {
    return this.options.maxFileSize;
  }

  /**
   * Get the max files count for this manager
   */
  getMaxFiles(): number {
    return this.options.maxFiles;
  }
}

/**
 * Create an AttachmentManager instance with messaging defaults
 */
export function createMessagingAttachmentManager(
  options: Omit<AttachmentManagerOptions, 'allowedExtensions'> = {}
): AttachmentManager {
  return new AttachmentManager({
    ...options,
    allowedExtensions: DEFAULT_MESSAGING_EXTENSIONS
  });
}

/**
 * Create an AttachmentManager instance with general upload defaults
 */
export function createUploadAttachmentManager(
  options: Omit<AttachmentManagerOptions, 'allowedExtensions'> = {}
): AttachmentManager {
  return new AttachmentManager({
    ...options,
    allowedExtensions: DEFAULT_UPLOAD_EXTENSIONS
  });
}
