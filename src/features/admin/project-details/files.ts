/**
 * Project Files Module
 * @file src/features/admin/project-details/files.ts
 *
 * Handles loading project files and file upload functionality.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { formatDate, formatFileSize } from '../../../utils/format-utils';
import { AdminAuth } from '../admin-auth';
import { apiFetch } from '../../../utils/api-client';
import { alertError, alertSuccess } from '../../../utils/confirm-dialog';
import { renderEmptyState } from '../../../components/empty-state';
import { domCache } from './dom-cache';
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from './types';

/**
 * Load files for the specified project
 */
export async function loadProjectFiles(projectId: number): Promise<void> {
  const filesList = domCache.get('filesList');
  if (!filesList) return;

  if (!AdminAuth.isAuthenticated()) {
    filesList.innerHTML = '<p class="empty-state">Authentication required to view files.</p>';
    return;
  }

  try {
    const response = await apiFetch(`/api/uploads/project/${projectId}`);

    if (response.ok) {
      const data = await response.json();
      const files = data.files || [];

      if (files.length === 0) {
        renderEmptyState(filesList, 'No files yet. Upload files above.');
      } else {
        filesList.innerHTML = files
          .map(
            (file: { id: number; originalName?: string; filename: string; uploadedAt: string; size: number }) => {
              const safeName = SanitizationUtils.escapeHtml(file.originalName || file.filename);
              return `
            <div class="file-item">
              <span class="file-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </span>
              <div class="file-info">
                <span class="file-name">${file.originalName || file.filename}</span>
                <span class="file-meta">Uploaded ${formatDate(file.uploadedAt)} - ${formatFileSize(file.size)}</span>
              </div>
              <div class="file-actions">
                <a href="/api/uploads/file/${file.id}" class="icon-btn" target="_blank" aria-label="Download ${safeName}" title="Download"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>
              </div>
            </div>
          `;
            }
          )
          .join('');
      }
    }
  } catch (error) {
    console.error('[ProjectFiles] Error loading project files:', error);
    filesList.innerHTML = '<p class="empty-state">Error loading files.</p>';
  }
}

/**
 * Check if a file type is allowed for upload
 */
export function isAllowedFileType(file: File): boolean {
  const hasValidExtension = ALLOWED_EXTENSIONS.test(file.name);
  const hasValidMimeType = ALLOWED_MIME_TYPES.includes(file.type);
  return hasValidExtension || hasValidMimeType;
}

/**
 * Upload files to a project
 */
export async function uploadFiles(
  projectId: number,
  files: FileList,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  // Validate file types
  const invalidFiles: string[] = [];
  for (let i = 0; i < files.length; i++) {
    if (!isAllowedFileType(files[i])) {
      invalidFiles.push(files[i].name);
    }
  }

  if (invalidFiles.length > 0) {
    alertError(`Unsupported file type(s): ${invalidFiles.join(', ')}. Allowed: images, PDF, Word docs, text, ZIP, RAR`);
    return;
  }

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  try {
    const response = await apiFetch(`/api/projects/${projectId}/files`, {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const data = await response.json();
      alertSuccess(`${data.files?.length || files.length} file(s) uploaded successfully!`);
      onSuccess();
    } else {
      alertError('Failed to upload files. Please try again.');
    }
  } catch (error) {
    console.error('[ProjectFiles] Error uploading files:', error);
    alertError('Failed to upload files. Please try again.');
  }
}

/**
 * Set up file upload handlers (drag/drop, browse button)
 */
export function setupFileUploadHandlers(
  projectId: number,
  onUploadSuccess: () => void
): void {
  const dropzone = domCache.get('uploadDropzone');
  const fileInput = domCache.getAs<HTMLInputElement>('fileInput');
  const browseBtn = domCache.get('browseFilesBtn');

  if (browseBtn && fileInput && !browseBtn.dataset.listenerAdded) {
    browseBtn.dataset.listenerAdded = 'true';
    browseBtn.addEventListener('click', () => fileInput.click());
  }

  if (fileInput && !fileInput.dataset.listenerAdded) {
    fileInput.dataset.listenerAdded = 'true';
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        uploadFiles(projectId, fileInput.files, onUploadSuccess);
        fileInput.value = ''; // Reset input
      }
    });
  }

  if (dropzone && !dropzone.dataset.listenerAdded) {
    dropzone.dataset.listenerAdded = 'true';
    // Make dropzone keyboard accessible
    dropzone.setAttribute('tabindex', '0');
    dropzone.setAttribute('role', 'button');
    dropzone.setAttribute('aria-label', 'File upload dropzone - press Enter or Space to browse files, or drag and drop files here');

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        uploadFiles(projectId, e.dataTransfer.files, onUploadSuccess);
      }
    });

    // Keyboard support - Enter or Space triggers file browser
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput?.click();
      }
    });
  }
}
