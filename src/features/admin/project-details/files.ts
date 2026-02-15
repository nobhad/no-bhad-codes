/**
 * Project Files Module
 * @file src/features/admin/project-details/files.ts
 *
 * Handles loading project files and file upload functionality.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { formatDate, formatFileSize } from '../../../utils/format-utils';
import { AdminAuth } from '../admin-auth';
import { apiFetch, apiPost, apiDelete, parseApiResponse } from '../../../utils/api-client';
import { alertError, alertSuccess, confirmDanger } from '../../../utils/confirm-dialog';
import { renderEmptyState } from '../../../components/empty-state';
import { domCache } from './dom-cache';
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from './types';
import { showToast } from '../../../utils/toast-notifications';
import { createModalDropdown, type ModalDropdownOption } from '../../../components/modal-dropdown';
import { openModalOverlay, closeModalOverlay } from '../../../utils/modal-utils';

// State for pending requests dropdown
interface PendingRequest {
  id: number;
  title: string;
  is_required: boolean;
}

// Common file type options for upload
const FILE_TYPE_OPTIONS: ModalDropdownOption[] = [
  { value: 'proposal', label: 'Project Proposal' },
  { value: 'contract', label: 'Contract' },
  { value: 'intake', label: 'Intake Form' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'wireframe', label: 'Wireframe' },
  { value: 'mockup', label: 'Design Mockup' },
  { value: 'asset', label: 'Brand Asset' },
  { value: 'content', label: 'Content/Copy' },
  { value: 'reference', label: 'Reference Material' },
  { value: 'other', label: 'Other' }
];

let _pendingRequestsCache: PendingRequest[] = [];
let pendingFilesToUpload: File[] = [];
let currentUploadProjectId: number | null = null;
let currentUploadCallback: (() => void) | null = null;
let uploadRequestDropdown: HTMLElement | null = null;
let uploadFileTypeDropdown: HTMLElement | null = null;

// File type including sharing fields
interface ProjectFile {
  id: number;
  originalName?: string;
  filename: string;
  uploadedAt: string;
  size: number;
  sharedWithClient: boolean;
  sharedAt?: string;
  sharedBy?: string;
}

/**
 * Lucide icon SVGs for share toggle
 */
const SHARE_ICONS = {
  // Share2 icon - shown when file is not shared (click to share)
  share: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
  // Lock icon - shown when file is shared (click to unshare/lock)
  lock: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
};

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
      const data = await parseApiResponse<{ files: ProjectFile[] }>(response);
      const files: ProjectFile[] = data.files || [];

      if (files.length === 0) {
        renderEmptyState(filesList, 'No files yet. Upload files above.');
      } else {
        filesList.innerHTML = files
          .map(
            (file: ProjectFile) => {
              const safeName = SanitizationUtils.escapeHtml(file.originalName || file.filename);
              const isShared = file.sharedWithClient;
              const shareIcon = isShared ? SHARE_ICONS.lock : SHARE_ICONS.share;
              const shareTitle = isShared ? 'Shared with client - Click to unshare' : 'Share with client';
              const shareClass = isShared ? 'icon-btn-active' : '';
              return `
            <div class="file-item" data-file-id="${file.id}">
              <span class="file-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </span>
              <div class="file-info">
                <span class="file-name">${file.originalName || file.filename}${isShared ? '<span class="file-shared-badge">Shared</span>' : ''}</span>
                <span class="file-meta">Uploaded ${formatDate(file.uploadedAt)} - ${formatFileSize(file.size)}</span>
              </div>
              <div class="file-actions">
                <button type="button" class="icon-btn btn-share-file ${shareClass}" data-file-id="${file.id}" data-shared="${isShared}" aria-label="${shareTitle}" title="${shareTitle}">${shareIcon}</button>
                <a href="/api/uploads/file/${file.id}" class="icon-btn" target="_blank" aria-label="Download ${safeName}" title="Download"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>
                <button type="button" class="icon-btn icon-btn-danger btn-delete-file" data-file-id="${file.id}" data-file-name="${safeName}" aria-label="Delete ${safeName}" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
              </div>
            </div>
          `;
            }
          )
          .join('');

        // Add handlers
        setupFileDeleteHandlers(projectId);
        setupFileShareHandlers(projectId);
      }
    }
  } catch (error) {
    console.error('[ProjectFiles] Error loading project files:', error);
    filesList.innerHTML = '<p class="empty-state">Error loading files.</p>';
  }
}

/**
 * Setup delete handlers for file items
 */
function setupFileDeleteHandlers(projectId: number): void {
  const filesList = domCache.get('filesList');
  if (!filesList) return;

  filesList.querySelectorAll('.btn-delete-file').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const fileId = (btn as HTMLElement).dataset.fileId;
      const fileName = (btn as HTMLElement).dataset.fileName || 'this file';

      if (!fileId) return;

      const confirmed = await confirmDanger(`Delete "${fileName}"? This action cannot be undone.`);
      if (!confirmed) return;

      try {
        const response = await apiDelete(`/api/uploads/file/${fileId}`);
        if (response.ok) {
          showToast('File deleted', 'success');
          await loadProjectFiles(projectId);
        } else {
          alertError('Failed to delete file');
        }
      } catch (error) {
        console.error('[ProjectFiles] Error deleting file:', error);
        alertError('Failed to delete file');
      }
    });
  });
}

/**
 * Setup share toggle handlers for file items
 */
function setupFileShareHandlers(projectId: number): void {
  const filesList = domCache.get('filesList');
  if (!filesList) return;

  filesList.querySelectorAll('.btn-share-file').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const fileId = (btn as HTMLElement).dataset.fileId;
      const isCurrentlyShared = (btn as HTMLElement).dataset.shared === 'true';

      if (!fileId) return;

      // Disable button during request
      (btn as HTMLButtonElement).disabled = true;

      try {
        const endpoint = isCurrentlyShared
          ? `/api/uploads/${fileId}/unshare`
          : `/api/uploads/${fileId}/share`;

        const response = await apiPost(endpoint, {});

        if (response.ok) {
          const message = isCurrentlyShared
            ? 'File unshared from client'
            : 'File shared with client';
          showToast(message, 'success');
          await loadProjectFiles(projectId);
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.message || 'Failed to update file sharing';
          alertError(errorMsg);
        }
      } catch (error) {
        console.error('[ProjectFiles] Error toggling file share:', error);
        alertError('Failed to update file sharing');
      } finally {
        (btn as HTMLButtonElement).disabled = false;
      }
    });
  });
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
 * Upload files to a project (simple upload without request linking)
 * Note: For uploads with request linking, use the upload modal via setupFileUploadHandlers
 */
export async function uploadFiles(
  projectId: number,
  files: FileList | File[],
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  const fileArray = Array.isArray(files) ? files : Array.from(files);

  // Validate file types
  const invalidFiles: string[] = [];
  for (const file of fileArray) {
    if (!isAllowedFileType(file)) {
      invalidFiles.push(file.name);
    }
  }

  if (invalidFiles.length > 0) {
    alertError(`Unsupported file type(s): ${invalidFiles.join(', ')}. Allowed: images, PDF, Word docs, text, ZIP, RAR`);
    return;
  }

  const formData = new FormData();
  for (const file of fileArray) {
    formData.append('files', file);
  }

  try {
    const response = await apiFetch(`/api/projects/${projectId}/files`, {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const data = await parseApiResponse<{ files: ProjectFile[] }>(response);
      const uploadedFiles = data.files || [];
      showToast(`${uploadedFiles.length} file(s) uploaded`, 'success');
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
 * Load pending document requests for the project
 */
export async function loadPendingRequestsDropdown(projectId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/document-requests/project/${projectId}/pending`);
    if (!response.ok) return;

    const data = await parseApiResponse<{ requests: PendingRequest[] }>(response);
    const requests: PendingRequest[] = data.requests || [];
    _pendingRequestsCache = requests;
  } catch (error) {
    console.error('[ProjectFiles] Error loading pending requests:', error);
  }
}

/**
 * Show the upload confirmation modal
 */
function showUploadModal(files: File[], projectId: number, onSuccess: () => void): void {
  // Validate file types first
  const invalidFiles: string[] = [];
  const validFiles: File[] = [];

  for (let i = 0; i < files.length; i++) {
    if (!isAllowedFileType(files[i])) {
      invalidFiles.push(files[i].name);
    } else {
      validFiles.push(files[i]);
    }
  }

  if (invalidFiles.length > 0) {
    alertError(`Unsupported file type(s): ${invalidFiles.join(', ')}. Allowed: images, PDF, Word docs, text, ZIP, RAR`);
    if (validFiles.length === 0) return;
  }

  // Store state for upload
  pendingFilesToUpload = validFiles;
  currentUploadProjectId = projectId;
  currentUploadCallback = onSuccess;

  // Get modal elements
  const modal = document.getElementById('file-upload-modal');
  const preview = document.getElementById('upload-files-preview');
  const selectMount = document.getElementById('upload-request-select-mount');
  const linkRequestGroup = document.getElementById('pd-upload-link-request');

  if (!modal || !preview) return;

  // Render file preview
  preview.innerHTML = validFiles.map(file => `
    <div class="upload-file-preview-item">
      <span class="file-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      </span>
      <span class="file-name">${SanitizationUtils.escapeHtml(file.name)}</span>
      <span class="file-size">${formatFileSize(file.size)}</span>
    </div>
  `).join('');

  // Initialize the file type dropdown
  const fileTypeMount = document.getElementById('upload-file-type-mount');
  if (fileTypeMount) {
    fileTypeMount.innerHTML = '';
    uploadFileTypeDropdown = createModalDropdown({
      options: FILE_TYPE_OPTIONS,
      currentValue: '',
      placeholder: 'Select file type...',
      ariaLabelPrefix: 'File type'
    });
    fileTypeMount.appendChild(uploadFileTypeDropdown);
  }

  // Initialize the pending requests dropdown if there are pending requests
  if (selectMount && _pendingRequestsCache.length > 0) {
    selectMount.innerHTML = '';

    const requestOptions: ModalDropdownOption[] = [
      { value: '', label: 'General upload (no request)' },
      ..._pendingRequestsCache.map(req => ({
        value: String(req.id),
        label: `${req.title}${req.is_required ? ' (Required)' : ''}`
      }))
    ];

    uploadRequestDropdown = createModalDropdown({
      options: requestOptions,
      currentValue: '',
      placeholder: 'Select request...',
      ariaLabelPrefix: 'Link to request'
    });

    selectMount.appendChild(uploadRequestDropdown);

    if (linkRequestGroup) {
      linkRequestGroup.style.display = 'block';
    }
  } else if (linkRequestGroup) {
    linkRequestGroup.style.display = 'none';
  }

  // Show modal
  openModalOverlay(modal);
}

/**
 * Hide the upload modal and reset state
 */
function hideUploadModal(): void {
  const modal = document.getElementById('file-upload-modal');
  if (modal) {
    closeModalOverlay(modal);
  }

  // Cleanup file type dropdown
  if (uploadFileTypeDropdown) {
    const cleanup = (uploadFileTypeDropdown as HTMLElement & { _cleanup?: () => void })._cleanup;
    if (cleanup) cleanup();
  }
  const fileTypeMount = document.getElementById('upload-file-type-mount');
  if (fileTypeMount) {
    fileTypeMount.innerHTML = '';
  }

  // Cleanup request dropdown
  if (uploadRequestDropdown) {
    const cleanup = (uploadRequestDropdown as HTMLElement & { _cleanup?: () => void })._cleanup;
    if (cleanup) cleanup();
  }
  const selectMount = document.getElementById('upload-request-select-mount');
  if (selectMount) {
    selectMount.innerHTML = '';
  }

  uploadFileTypeDropdown = null;
  uploadRequestDropdown = null;
  pendingFilesToUpload = [];
  currentUploadProjectId = null;
  currentUploadCallback = null;
}

/**
 * Handle upload confirmation
 */
async function handleUploadConfirm(): Promise<void> {
  if (!currentUploadProjectId || pendingFilesToUpload.length === 0) {
    hideUploadModal();
    return;
  }

  const projectId = currentUploadProjectId;
  const files = pendingFilesToUpload;
  const onSuccess = currentUploadCallback;
  const selectedRequestValue = uploadRequestDropdown?.dataset.value;
  const selectedRequestId = selectedRequestValue
    ? parseInt(selectedRequestValue, 10)
    : null;

  // Get file type from dropdown
  const fileType = uploadFileTypeDropdown?.dataset.value || '';
  // Get the label text for the selected file type
  const fileTypeOption = FILE_TYPE_OPTIONS.find(opt => opt.value === fileType);
  const fileLabel = fileTypeOption?.label || '';

  // Hide modal before upload
  hideUploadModal();

  // Build FormData
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  if (fileType) {
    formData.append('label', fileLabel);
    formData.append('file_type', fileType);
  }

  try {
    const response = await apiFetch(`/api/projects/${projectId}/files`, {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const data = await parseApiResponse<{ files: ProjectFile[] }>(response);
      const uploadedFiles = data.files || [];

      // If a request was selected and we have uploaded files, link the first file
      if (selectedRequestId && uploadedFiles.length > 0) {
        const firstFileId = uploadedFiles[0].id;
        const linked = await linkFileToRequest(selectedRequestId, firstFileId);
        if (linked) {
          showToast(`${uploadedFiles.length} file(s) uploaded and linked to request`, 'success');
        } else {
          alertSuccess(`${uploadedFiles.length} file(s) uploaded (failed to link to request)`);
        }
      } else {
        showToast(`${uploadedFiles.length} file(s) uploaded`, 'success');
      }

      // Refresh pending requests and call success callback
      await loadPendingRequestsDropdown(projectId);
      if (onSuccess) onSuccess();
    } else {
      alertError('Failed to upload files. Please try again.');
    }
  } catch (error) {
    console.error('[ProjectFiles] Error uploading files:', error);
    alertError('Failed to upload files. Please try again.');
  }
}

/**
 * Setup modal event handlers
 */
function setupUploadModalHandlers(): void {
  const closeBtn = document.getElementById('file-upload-modal-close');
  const cancelBtn = document.getElementById('file-upload-modal-cancel');
  const confirmBtn = document.getElementById('file-upload-modal-confirm');

  if (closeBtn && !closeBtn.dataset.listenerAdded) {
    closeBtn.dataset.listenerAdded = 'true';
    closeBtn.addEventListener('click', hideUploadModal);
  }

  if (cancelBtn && !cancelBtn.dataset.listenerAdded) {
    cancelBtn.dataset.listenerAdded = 'true';
    cancelBtn.addEventListener('click', hideUploadModal);
  }

  if (confirmBtn && !confirmBtn.dataset.listenerAdded) {
    confirmBtn.dataset.listenerAdded = 'true';
    confirmBtn.addEventListener('click', handleUploadConfirm);
  }
}


/**
 * Link uploaded file to a document request
 */
async function linkFileToRequest(requestId: number, fileId: number): Promise<boolean> {
  try {
    const response = await apiPost(`/api/document-requests/${requestId}/upload`, { fileId });
    return response.ok;
  } catch (error) {
    console.error('[ProjectFiles] Error linking file to request:', error);
    return false;
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

  // Setup modal handlers
  setupUploadModalHandlers();

  if (browseBtn && fileInput && !browseBtn.dataset.listenerAdded) {
    browseBtn.dataset.listenerAdded = 'true';
    browseBtn.addEventListener('click', () => fileInput.click());
  }

  if (fileInput && !fileInput.dataset.listenerAdded) {
    fileInput.dataset.listenerAdded = 'true';
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        // Show modal instead of uploading directly
        showUploadModal(Array.from(fileInput.files), projectId, onUploadSuccess);
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
        // Show modal instead of uploading directly
        showUploadModal(Array.from(e.dataTransfer.files), projectId, onUploadSuccess);
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
