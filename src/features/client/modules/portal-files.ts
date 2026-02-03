/**
 * ===============================================
 * PORTAL FILES MODULE
 * ===============================================
 * @file src/features/client/modules/portal-files.ts
 *
 * File management functionality for client portal.
 * Dynamically imported for code splitting.
 */

import type { PortalFile, ClientPortalContext } from '../portal-types';
import { formatFileSize } from '../../../utils/format-utils';
import { ICONS } from '../../../constants/icons';
import { showContainerError } from '../../../utils/error-utils';
import { confirmDanger, alertError } from '../../../utils/confirm-dialog';
import { initModalDropdown, setModalDropdownValue } from '../../../utils/modal-dropdown';

const FILES_API_BASE = '/api/uploads';

// Allowed file types (matches server validation)
const ALLOWED_EXTENSIONS = /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar)$/i;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed',
  'application/vnd.rar'
];

// ============================================================================
// FILTER STATE
// ============================================================================

interface FileFilters {
  projectId: string;
  fileType: string;
  category: string;
  dateFrom: string;
  dateTo: string;
}

let currentFilters: FileFilters = {
  projectId: 'all',
  fileType: 'all',
  category: 'all',
  dateFrom: '',
  dateTo: ''
};

// ============================================================================
// CACHED DOM REFERENCES
// ============================================================================

const cachedElements: Map<string, HTMLElement | null> = new Map();

/** Get cached element by ID */
function getElement(id: string): HTMLElement | null {
  if (!cachedElements.has(id)) {
    cachedElements.set(id, document.getElementById(id));
  }
  return cachedElements.get(id) ?? null;
}

/**
 * Build query string from current filters
 */
function buildFilterQueryString(): string {
  const params = new URLSearchParams();

  if (currentFilters.projectId && currentFilters.projectId !== 'all') {
    params.append('projectId', currentFilters.projectId);
  }
  if (currentFilters.fileType && currentFilters.fileType !== 'all') {
    params.append('fileType', currentFilters.fileType);
  }
  if (currentFilters.category && currentFilters.category !== 'all') {
    params.append('category', currentFilters.category);
  }
  if (currentFilters.dateFrom) {
    params.append('dateFrom', currentFilters.dateFrom);
  }
  if (currentFilters.dateTo) {
    params.append('dateTo', currentFilters.dateTo);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Populate project dropdown from API response
 */
function populateProjectFilter(projects: { id: number; name: string }[]): void {
  const projectFilter = getElement('files-project-filter') as HTMLSelectElement;
  if (!projectFilter) return;

  // Clear existing options except "All Projects"
  projectFilter.innerHTML = '<option value="all">All Projects</option>';

  // Add project options
  projects.forEach((project) => {
    const option = document.createElement('option');
    option.value = String(project.id);
    option.textContent = project.name;
    projectFilter.appendChild(option);
  });

  // Restore selected value if it exists
  if (currentFilters.projectId && currentFilters.projectId !== 'all') {
    projectFilter.value = currentFilters.projectId;
  }

  // Init custom dropdown for project filter (after options are populated)
  if (projectFilter && !(projectFilter as HTMLElement).dataset.dropdownInit) {
    (projectFilter as HTMLElement).dataset.dropdownInit = 'true';
    initModalDropdown(projectFilter, { placeholder: 'All Projects' });
  }
}

/**
 * Load files from API
 */
export async function loadFiles(ctx: ClientPortalContext): Promise<void> {
  const filesContainer = document.querySelector('.files-list-section');
  if (!filesContainer) return;

  try {
    const queryString = buildFilterQueryString();
    const response = await fetch(`${FILES_API_BASE}/client${queryString}`, {
      credentials: 'include' // Include HttpOnly cookies
    });

    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }

    const data = await response.json();

    // Populate project filter dropdown (only on first load or when projects data is returned)
    if (data.projects) {
      populateProjectFilter(data.projects);
    }

    renderFilesList(filesContainer as HTMLElement, data.files || [], ctx);
  } catch (error) {
    console.error('Error loading files:', error);
    showContainerError(
      filesContainer as HTMLElement,
      'Unable to load files',
      () => loadFiles(ctx)
    );
  }
}


/**
 * Render the files list
 */
function renderFilesList(
  container: HTMLElement,
  files: PortalFile[],
  ctx: ClientPortalContext
): void {
  if (files.length === 0) {
    container.innerHTML =
      '<p class="no-files">No files uploaded yet. Drag and drop files above to upload.</p>';
    return;
  }

  const clientEmail = sessionStorage.getItem('clientEmail') || '';

  container.innerHTML = files
    .map((file) => {
      const safeName = ctx.escapeHtml(file.originalName);
      const canDelete = file.uploadedBy === clientEmail || file.uploadedBy === 'client';
      const deleteIcon = canDelete
        ? `<button class="file-delete-icon btn-delete" data-file-id="${file.id}" data-filename="${file.originalName}" aria-label="Delete ${safeName}">
            ${ICONS.TRASH}
          </button>`
        : '';
      return `
        <div class="file-item" data-file-id="${file.id}">
          ${deleteIcon}
          <div class="file-icon">
            ${getFileIcon(file.mimetype)}
          </div>
          <div class="file-info">
            <span class="file-name">${safeName}</span>
            <span class="file-meta">
              ${file.projectName ? `${file.projectName} • ` : ''}
              ${ctx.formatDate(file.uploadedAt)} • ${formatFileSize(file.size)}
            </span>
          </div>
          <div class="file-actions">
            <button class="btn btn-sm btn-outline btn-preview" data-file-id="${file.id}" data-mimetype="${file.mimetype}" aria-label="Preview ${safeName}">
              Preview
            </button>
            <button class="btn btn-sm btn-outline btn-download" data-file-id="${file.id}" data-filename="${file.originalName}" aria-label="Download ${safeName}">
              Download
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  attachFileActionListeners(container, ctx);
}

/**
 * Get appropriate icon SVG for file type
 */
function getFileIcon(mimetype: string): string {
  if (mimetype.startsWith('image/')) {
    return ICONS.IMAGE;
  }
  if (mimetype === 'application/pdf') {
    return ICONS.DOCUMENT;
  }
  return ICONS.FILE;
}

/**
 * Attach event listeners to file action buttons
 */
function attachFileActionListeners(container: HTMLElement, ctx: ClientPortalContext): void {
  container.querySelectorAll('.btn-preview').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const fileId = (btn as HTMLElement).dataset.fileId;
      const mimetype = (btn as HTMLElement).dataset.mimetype;
      if (fileId) {
        previewFile(parseInt(fileId), mimetype || '', ctx);
      }
    });
  });

  container.querySelectorAll('.btn-download').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const fileId = (btn as HTMLElement).dataset.fileId;
      const filename = (btn as HTMLElement).dataset.filename;
      if (fileId) {
        downloadFile(parseInt(fileId), filename || 'download', ctx);
      }
    });
  });

  container.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const fileId = (btn as HTMLElement).dataset.fileId;
      const filename = (btn as HTMLElement).dataset.filename;
      if (fileId) {
        deleteFile(parseInt(fileId), filename || 'file', ctx);
      }
    });
  });
}

/**
 * Preview a file - opens in modal or new tab
 */
function previewFile(fileId: number, mimetype: string, _ctx: ClientPortalContext): void {
  if (mimetype.startsWith('image/') || mimetype === 'application/pdf') {
    const url = `${FILES_API_BASE}/file/${fileId}`;
    window.open(url, '_blank');
  } else {
    downloadFile(fileId, 'file', _ctx);
  }
}

/**
 * Download a file
 */
function downloadFile(fileId: number, filename: string, _ctx: ClientPortalContext): void {
  const url = `${FILES_API_BASE}/file/${fileId}?download=true`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Delete a file
 */
async function deleteFile(
  fileId: number,
  filename: string,
  _ctx: ClientPortalContext
): Promise<void> {
  const confirmed = await confirmDanger(
    `Are you sure you want to delete "${filename}"? This action cannot be undone.`,
    'Delete File'
  );
  if (!confirmed) return;

  try {
    const response = await fetch(`${FILES_API_BASE}/file/${fileId}`, {
      method: 'DELETE',
      credentials: 'include' // Include HttpOnly cookies
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete file');
    }

    const fileItem = document.querySelector(`.file-item[data-file-id="${fileId}"]`);
    if (fileItem) {
      fileItem.remove();
    }

    const filesContainer = document.querySelector('.files-list-section .file-item');
    if (!filesContainer) {
      const container = document.querySelector('.files-list-section');
      if (container) {
        const noFilesMsg = container.querySelector('.no-files');
        if (!noFilesMsg) {
          const msgEl = document.createElement('p');
          msgEl.className = 'no-files';
          msgEl.textContent = 'No files uploaded yet. Drag and drop files above to upload.';
          container.appendChild(msgEl);
        }
      }
    }

    // File deleted successfully
  } catch (error) {
    console.error('Error deleting file:', error);
    alertError(error instanceof Error ? error.message : 'Failed to delete file. Please try again.');
  }
}

/**
 * Setup file upload handlers (drag & drop + browse)
 */
export function setupFileUploadHandlers(ctx: ClientPortalContext): void {
  const dropzone = getElement('upload-dropzone');
  const fileInput = getElement('file-input') as HTMLInputElement;
  const browseBtn = getElement('btn-browse-files');

  if (!dropzone) return;

  dropzone.setAttribute('tabindex', '0');
  dropzone.setAttribute('role', 'button');
  dropzone.setAttribute(
    'aria-label',
    'File upload dropzone - press Enter or Space to browse files, or drag and drop files here'
  );

  if (browseBtn && fileInput) {
    browseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        uploadFiles(Array.from(fileInput.files), ctx);
        fileInput.value = '';
      }
    });
  }

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('drag-active');
  });

  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-active');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-active');

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      uploadFiles(Array.from(files), ctx);
    }
  });

  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput?.click();
    }
  });

  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}

/**
 * Setup file filter event listeners
 */
export function setupFileFilterListeners(ctx: ClientPortalContext): void {
  const projectFilter = getElement('files-project-filter') as HTMLSelectElement;
  const typeFilter = getElement('files-type-filter') as HTMLSelectElement;
  const categoryFilter = getElement('files-category-filter') as HTMLSelectElement;
  const dateFromInput = getElement('files-date-from') as HTMLInputElement;
  const dateToInput = getElement('files-date-to') as HTMLInputElement;
  const clearFiltersBtn = getElement('files-clear-filters');

  // Helper to update filters and reload
  const applyFilters = () => {
    currentFilters = {
      projectId: projectFilter?.value || 'all',
      fileType: typeFilter?.value || 'all',
      category: categoryFilter?.value || 'all',
      dateFrom: dateFromInput?.value || '',
      dateTo: dateToInput?.value || ''
    };
    loadFiles(ctx);
  };

  // Attach change listeners
  if (projectFilter) {
    projectFilter.addEventListener('change', applyFilters);
  }

  if (typeFilter) {
    typeFilter.addEventListener('change', applyFilters);
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', applyFilters);
  }

  if (dateFromInput) {
    dateFromInput.addEventListener('change', applyFilters);
  }

  if (dateToInput) {
    dateToInput.addEventListener('change', applyFilters);
  }

  // Clear filters button
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      // Reset all filter controls (selects may be wrapped by custom dropdowns)
      const setFilterValue = (selectEl: HTMLSelectElement | null, value: string) => {
        if (!selectEl) return;
        selectEl.value = value;
        const wrapper = selectEl.previousElementSibling as HTMLElement;
        if (wrapper?.dataset?.modalDropdown === 'true') {
          setModalDropdownValue(wrapper, value);
        }
      };
      setFilterValue(projectFilter, 'all');
      setFilterValue(typeFilter, 'all');
      setFilterValue(categoryFilter, 'all');
      if (dateFromInput) dateFromInput.value = '';
      if (dateToInput) dateToInput.value = '';

      // Reset filter state and reload
      currentFilters = {
        projectId: 'all',
        fileType: 'all',
        category: 'all',
        dateFrom: '',
        dateTo: ''
      };
      loadFiles(ctx);
    });
  }

  // Init custom dropdowns for type and category (static options)
  if (typeFilter && !(typeFilter as HTMLElement).dataset.dropdownInit) {
    (typeFilter as HTMLElement).dataset.dropdownInit = 'true';
    initModalDropdown(typeFilter, { placeholder: 'All Types' });
  }
  if (categoryFilter && !(categoryFilter as HTMLElement).dataset.dropdownInit) {
    (categoryFilter as HTMLElement).dataset.dropdownInit = 'true';
    initModalDropdown(categoryFilter, { placeholder: 'All Categories' });
  }
}

/**
 * Check if a file type is allowed
 */
function isAllowedFileType(file: File): boolean {
  // Check extension
  const hasValidExtension = ALLOWED_EXTENSIONS.test(file.name);

  // Check MIME type
  const hasValidMimeType = ALLOWED_MIME_TYPES.includes(file.type);

  // Accept if either matches (some browsers report different MIME types)
  return hasValidExtension || hasValidMimeType;
}

/**
 * Upload files to the server
 */
async function uploadFiles(files: File[], ctx: ClientPortalContext): Promise<void> {
  if (files.length > 5) {
    showDropzoneError('Maximum 5 files allowed per upload.', ctx, files);
    return;
  }

  // Validate file types
  const invalidFiles = files.filter((f) => !isAllowedFileType(f));
  if (invalidFiles.length > 0) {
    showDropzoneError(
      `Unsupported file type(s): ${invalidFiles.map((f) => f.name).join(', ')}. Allowed: images, PDF, Word docs, text, ZIP, RAR`,
      ctx,
      files.filter((f) => isAllowedFileType(f))
    );
    return;
  }

  const maxSize = 10 * 1024 * 1024;
  const oversizedFiles = files.filter((f) => f.size > maxSize);
  if (oversizedFiles.length > 0) {
    showDropzoneError(
      `Some files exceed the 10MB limit: ${oversizedFiles.map((f) => f.name).join(', ')}`,
      ctx,
      files.filter((f) => f.size <= maxSize)
    );
    return;
  }

  const dropzone = getElement('upload-dropzone');
  if (dropzone) {
    dropzone.innerHTML = `
      <div class="upload-progress">
        <p>Uploading ${files.length} file(s)...</p>
        <div class="progress-bar"><div class="progress-fill" style="width: 0%"></div></div>
      </div>
    `;
  }

  try {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch(`${FILES_API_BASE}/multiple`, {
      method: 'POST',
      credentials: 'include', // Include HttpOnly cookies
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }

    const result = await response.json();

    resetDropzone();
    showUploadSuccess(result.files?.length || files.length);
    await loadFiles(ctx);
  } catch (error) {
    console.error('Upload error:', error);
    showDropzoneError(
      `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ctx,
      files
    );
  }
}

/**
 * Show error message in dropzone with retry option
 */
function showDropzoneError(message: string, ctx: ClientPortalContext, filesToRetry?: File[]): void {
  const dropzone = getElement('upload-dropzone');
  if (!dropzone) return;

  const retryBtn = filesToRetry && filesToRetry.length > 0
    ? '<button type="button" class="btn btn-sm btn-retry" id="btn-retry-upload">Try Again</button>'
    : '';
  const dismissBtn = '<button type="button" class="btn btn-sm btn-secondary" id="btn-dismiss-error">Dismiss</button>';

  dropzone.innerHTML = `
    <div class="dropzone-error" role="alert">
      <span class="error-icon error-icon--large" aria-hidden="true">⚠</span>
      <p class="error-message">${message}</p>
      <div class="dropzone-error-actions">
        ${retryBtn}
        ${dismissBtn}
      </div>
    </div>
  `;

  // Dynamic buttons need fresh queries (not cached - they were just created)
  const retryButton = document.getElementById('btn-retry-upload');
  if (retryButton && filesToRetry && filesToRetry.length > 0) {
    retryButton.addEventListener('click', () => {
      uploadFiles(filesToRetry, ctx);
    });
  }

  const dismissButton = document.getElementById('btn-dismiss-error');
  if (dismissButton) {
    dismissButton.addEventListener('click', () => {
      resetDropzone();
      setupFileUploadHandlers(ctx);
    });
  }
}

/**
 * Reset dropzone to initial state
 */
function resetDropzone(): void {
  const dropzone = getElement('upload-dropzone');
  if (dropzone) {
    dropzone.innerHTML = `
      <div class="dropzone-content">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p class="dropzone-desktop">Drag and drop files here or</p>
        <p class="dropzone-mobile">Tap to select files</p>
        <button type="button" class="btn btn-secondary" id="btn-browse-files">Browse Files</button>
        <input type="file" id="file-input" multiple hidden accept=".jpeg,.jpg,.png,.gif,.pdf,.doc,.docx,.txt,.zip,.rar,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip" />
      </div>
    `;
    // Clear cache for these elements since they were recreated
    cachedElements.delete('btn-browse-files');
    cachedElements.delete('file-input');

    const browseBtn = getElement('btn-browse-files');
    const fileInput = getElement('file-input') as HTMLInputElement;
    if (browseBtn && fileInput) {
      browseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
      });
    }
  }
}

/**
 * Show upload success message
 */
function showUploadSuccess(count: number): void {
  const filesSection = getElement('tab-files');
  if (filesSection) {
    const successMsg = document.createElement('div');
    successMsg.className = 'upload-success-message';
    successMsg.innerHTML = `<span>✓ ${count} file(s) uploaded successfully</span>`;
    filesSection.insertBefore(successMsg, filesSection.firstChild);

    setTimeout(() => {
      successMsg.remove();
    }, 3000);
  }
}
