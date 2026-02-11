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
import { formatFileSize, formatDate } from '../../../utils/format-utils';
import { ICONS } from '../../../constants/icons';
import { showContainerError } from '../../../utils/error-utils';
import { confirmDanger, alertError } from '../../../utils/confirm-dialog';
import { initModalDropdown, setModalDropdownValue } from '../../../utils/modal-dropdown';
import { createPortalModal, type PortalModalInstance } from '../../../components/portal-modal';

const FILES_API_BASE = '/api/uploads';
const DOC_REQUESTS_API = '/api/document-requests';

// ============================================================================
// PENDING REQUESTS STATE
// ============================================================================

interface PendingDocumentRequest {
  id: number;
  title: string;
  description?: string;
  document_type?: string;
  priority?: string;
  status: string;
  due_date?: string;
  is_required: boolean;
  project_name?: string;
}

let pendingRequestsCache: PendingDocumentRequest[] = [];
let pendingFilesToUpload: File[] = [];
let uploadRequestModalContext: ClientPortalContext | null = null;
let uploadRequestModalInstance: PortalModalInstance | null = null;
let uploadRequestOptionsContainer: HTMLElement | null = null;
let uploadRequestOtherDescriptionWrap: HTMLElement | null = null;

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

// Folder categories for the folder tree
interface FolderCategory {
  id: string;
  name: string;
  count: number;
}

let folderCategoriesCache: FolderCategory[] = [];
let folderTreeInitialized = false;

// Cache all files for client-side filtering
let allFilesCache: PortalFile[] = [];

// File type to folder category mapping
const FILE_TYPE_TO_FOLDER: Record<string, string> = {
  // Site folder - design and website files
  'wireframe': 'site',
  'mockup': 'site',
  'asset': 'site',
  'content': 'site',
  'reference': 'site',
  // Forms folder - intake and documents
  'intake': 'forms',
  'proposal': 'forms',
  'contract': 'forms',
  // Documents - invoices and receipts
  'invoice': 'documents',
  'receipt': 'documents'
};

// Folder display names
const FOLDER_NAMES: Record<string, string> = {
  'all': 'All Files',
  'site': 'Site',
  'forms': 'Forms',
  'documents': 'Documents',
  'client_uploads': 'Client Uploads'
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
 * Categorize a file into a folder based on its type and upload source
 */
function getFileFolder(file: { fileType?: string; category?: string; uploadedBy?: string }): string {
  // Check if uploaded by client
  if (file.uploadedBy?.includes('client') || file.category === 'client_upload') {
    return 'client_uploads';
  }

  // Check file type mapping
  if (file.fileType && FILE_TYPE_TO_FOLDER[file.fileType]) {
    return FILE_TYPE_TO_FOLDER[file.fileType];
  }

  // Default to site for other files
  return 'site';
}

/**
 * Count files per folder category
 */
function countFilesByFolder(files: Array<{ fileType?: string; category?: string; uploadedBy?: string }>): FolderCategory[] {
  const counts: Record<string, number> = {
    'site': 0,
    'forms': 0,
    'documents': 0,
    'client_uploads': 0
  };

  files.forEach((file) => {
    const folder = getFileFolder(file);
    counts[folder] = (counts[folder] || 0) + 1;
  });

  // Return only folders with files
  return Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([id, count]) => ({
      id,
      name: FOLDER_NAMES[id] || id,
      count
    }));
}

/**
 * Populate folder tree with category-based folders
 * Only shows folders that contain files
 */
function populateFolderTree(files: Array<{ fileType?: string; category?: string; uploadedBy?: string }>, ctx: ClientPortalContext): void {
  const folderTree = document.getElementById('folder-tree');
  if (!folderTree) return;

  // Count files per folder
  const folders = countFilesByFolder(files);
  folderCategoriesCache = folders;

  const folderIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';

  // Build folder tree HTML - always show "All Files"
  let html = `
    <div class="folder-item root ${currentFilters.category === 'all' ? 'active' : ''}" data-folder-id="all">
      ${folderIcon}
      <span>All Files</span>
    </div>
  `;

  // Add each folder that has files
  folders.forEach((folder) => {
    const isActive = currentFilters.category === folder.id;
    html += `
      <div class="folder-item ${isActive ? 'active' : ''}" data-folder-id="${folder.id}">
        ${folderIcon}
        <span>${ctx.escapeHtml(folder.name)}</span>
      </div>
    `;
  });

  folderTree.innerHTML = html;

  // Add click handlers to folder items
  folderTree.querySelectorAll('.folder-item').forEach((item) => {
    item.addEventListener('click', () => {
      const folderId = (item as HTMLElement).dataset.folderId;
      if (folderId) {
        selectFolder(folderId, ctx);
      }
    });
  });
}

/**
 * Handle folder selection
 */
function selectFolder(folderId: string, ctx: ClientPortalContext): void {
  // Update active state
  const folderTree = document.getElementById('folder-tree');
  if (folderTree) {
    folderTree.querySelectorAll('.folder-item').forEach((item) => {
      const itemId = (item as HTMLElement).dataset.folderId;
      item.classList.toggle('active', itemId === folderId);
    });
  }

  // Update path display
  const pathEl = document.getElementById('files-path');
  if (pathEl) {
    const label = FOLDER_NAMES[folderId] || folderId;
    pathEl.innerHTML = `<span>${ctx.escapeHtml(label)}</span>`;
  }

  // Update filter
  currentFilters.category = folderId;

  // If we have cached files, filter and render without refetching
  if (allFilesCache.length > 0) {
    const filesContainer = document.getElementById('files-list') || document.querySelector('.files-list-section');
    if (filesContainer) {
      let filteredFiles = allFilesCache;
      if (folderId !== 'all') {
        filteredFiles = allFilesCache.filter((file) => {
          const fileFolder = getFileFolder(file);
          return fileFolder === folderId;
        });
      }
      renderFilesList(filesContainer as HTMLElement, filteredFiles, ctx);
    }
  } else {
    // No cache, need to fetch
    loadFiles(ctx);
  }
}

/**
 * Load files from API
 */
export async function loadFiles(ctx: ClientPortalContext): Promise<void> {
  // Support both old layout (.files-list-section) and new layout (#files-list)
  const filesContainer = document.getElementById('files-list') || document.querySelector('.files-list-section');
  if (!filesContainer) return;

  try {
    // Always fetch all files (don't filter on server for category)
    const params = new URLSearchParams();
    if (currentFilters.projectId && currentFilters.projectId !== 'all') {
      params.append('projectId', currentFilters.projectId);
    }
    if (currentFilters.dateFrom) {
      params.append('dateFrom', currentFilters.dateFrom);
    }
    if (currentFilters.dateTo) {
      params.append('dateTo', currentFilters.dateTo);
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${FILES_API_BASE}/client${queryString}`, {
      credentials: 'include' // Include HttpOnly cookies
    });

    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }

    const data = await response.json();
    const files = data.files || [];

    // Cache all files for filtering
    allFilesCache = files;

    // Populate project filter dropdown
    if (data.projects) {
      populateProjectFilter(data.projects);
    }

    // Populate folder tree based on all files (check if needs repopulation)
    const folderTree = document.getElementById('folder-tree');
    const folderCount = folderTree?.querySelectorAll('.folder-item').length ?? 0;
    if (!folderTreeInitialized || folderCount <= 1) {
      populateFolderTree(files, ctx);
      folderTreeInitialized = true;
    }

    // Filter files by selected folder category (client-side)
    let filteredFiles = files;
    if (currentFilters.category && currentFilters.category !== 'all') {
      filteredFiles = files.filter((file: typeof files[0]) => {
        const fileFolder = getFileFolder(file);
        return fileFolder === currentFilters.category;
      });
    }

    renderFilesList(filesContainer as HTMLElement, filteredFiles, ctx);
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
 * Get file icon CSS class based on mime type
 */
function _getFileIconClass(mimetype: string): string {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.includes('pdf') || mimetype.includes('document') || mimetype.includes('text')) return 'document';
  if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('archive')) return 'archive';
  return '';
}

/**
 * Render the files list as a table (matching admin layout)
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

  const tableRows = files
    .map((file) => {
      const safeName = ctx.escapeHtml(file.originalName || file.filename || 'File');
      const canDelete = file.uploadedBy === clientEmail || file.uploadedBy === 'client';
      const size = formatFileSize(file.size);
      const date = ctx.formatDate(file.uploadedAt);

      const previewBtn = `<button class="icon-btn btn-preview" data-file-id="${file.id}" data-project-id="${file.projectId || ''}" data-filename="${ctx.escapeHtml(file.filename || '')}" data-mimetype="${file.mimetype}" aria-label="Preview ${safeName}" title="Preview">${ICONS.EYE}</button>`;
      const downloadBtn = `<button class="icon-btn btn-download" data-file-id="${file.id}" data-project-id="${file.projectId || ''}" data-filename="${ctx.escapeHtml(file.filename || '')}" data-original-name="${ctx.escapeHtml(file.originalName || '')}" data-mimetype="${file.mimetype}" aria-label="Download ${safeName}" title="Download">${ICONS.DOWNLOAD}</button>`;
      const deleteBtn = canDelete
        ? `<button class="icon-btn icon-btn-danger btn-delete" data-file-id="${file.id}" data-filename="${file.originalName}" aria-label="Delete ${safeName}" title="Delete">${ICONS.TRASH}</button>`
        : '';

      return `
        <tr>
          <td data-label="File">${safeName}</td>
          <td data-label="Size">${size}</td>
          <td data-label="Uploaded">${date}</td>
          <td class="file-actions" data-label="Actions">
            ${previewBtn}
            ${downloadBtn}
            ${deleteBtn}
          </td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <table class="files-table" aria-label="Project files">
      <thead>
        <tr>
          <th scope="col">File</th>
          <th scope="col">Size</th>
          <th scope="col">Uploaded</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;

  attachFileActionListeners(container, ctx);
}

/**
 * Get appropriate icon SVG for file type
 */
function _getFileIcon(mimetype: string): string {
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
      const el = btn as HTMLElement;
      const fileId = el.dataset.fileId;
      const projectId = el.dataset.projectId;
      const filename = el.dataset.filename;
      const mimetype = el.dataset.mimetype;
      if (fileId) {
        previewFile(parseInt(fileId), projectId ? parseInt(projectId) : undefined, filename || '', mimetype || '', ctx);
      }
    });
  });

  container.querySelectorAll('.btn-download').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const el = btn as HTMLElement;
      const fileId = el.dataset.fileId;
      const projectId = el.dataset.projectId;
      const filename = el.dataset.filename;
      const originalName = el.dataset.originalName;
      const mimetype = el.dataset.mimetype;
      if (fileId) {
        downloadFile(parseInt(fileId), projectId ? parseInt(projectId) : undefined, filename || '', originalName || 'download', mimetype || '', ctx);
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

/** Pattern to detect intake files that should be shown as PDF */
const INTAKE_FILE_PATTERN = /^(intake_|admin_project_|project_intake_|nobhadcodes_intake_)/i;

/**
 * Check if a file is an intake form JSON that should be converted to PDF
 */
function isIntakeFile(filename: string): boolean {
  return INTAKE_FILE_PATTERN.test(filename) && /\.json$/i.test(filename);
}

/**
 * Preview a file - opens in modal or new tab
 * For intake files, opens the PDF version instead of raw JSON
 */
function previewFile(
  fileId: number,
  projectId: number | undefined,
  filename: string,
  _mimetype: string,
  _ctx: ClientPortalContext
): void {
  // For intake JSON files, open the branded PDF version
  if (isIntakeFile(filename) && projectId) {
    const pdfUrl = `/api/projects/${projectId}/intake/pdf`;
    window.open(pdfUrl, '_blank', 'noopener');
    return;
  }

  // For regular files, use the standard file endpoint
  const url = `${FILES_API_BASE}/file/${fileId}`;
  const previewWindow = window.open(url, '_blank', 'noopener');
  if (previewWindow) {
    previewWindow.opener = null;
  }
}

/**
 * Download a file
 * For intake files, downloads the PDF version instead of raw JSON
 */
function downloadFile(
  fileId: number,
  projectId: number | undefined,
  filename: string,
  originalName: string,
  _mimetype: string,
  _ctx: ClientPortalContext
): void {
  // For intake JSON files, download the branded PDF version
  if (isIntakeFile(filename) && projectId) {
    const pdfUrl = `/api/projects/${projectId}/intake/pdf`;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = originalName.replace(/\.json$/i, '.pdf');
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // For regular files, use the standard file endpoint
  const url = `${FILES_API_BASE}/file/${fileId}?download=true`;
  const a = document.createElement('a');
  a.href = url;
  a.download = originalName;
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
 * Fetch pending document requests for the client
 */
async function fetchPendingRequests(): Promise<PendingDocumentRequest[]> {
  try {
    const response = await fetch(`${DOC_REQUESTS_API}/my-pending`, {
      credentials: 'include'
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.requests || [];
  } catch (error) {
    console.error('[PortalFiles] Error fetching pending requests:', error);
    return [];
  }
}

/**
 * Link uploaded file to a document request
 */
async function linkFileToRequest(requestId: number, fileId: number): Promise<boolean> {
  try {
    const response = await fetch(`${DOC_REQUESTS_API}/${requestId}/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId })
    });

    return response.ok;
  } catch (error) {
    console.error('[PortalFiles] Error linking file to request:', error);
    return false;
  }
}

/**
 * Show the upload request selection modal
 */
function showUploadRequestModal(files: File[], ctx: ClientPortalContext): void {
  pendingFilesToUpload = files;
  uploadRequestModalContext = ctx;

  const modal = ensureUploadRequestModal();
  const optionsContainer = uploadRequestOptionsContainer;

  if (!modal || !optionsContainer) {
    proceedWithUpload(files, null, ctx);
    return;
  }

  // Populate pending requests options
  optionsContainer.innerHTML = pendingRequestsCache
    .map(req => {
      const dueDate = req.due_date ? formatDate(req.due_date) : 'No due date';
      const isOverdue = req.due_date && new Date(req.due_date) < new Date();

      return `
        <label class="upload-request-option">
          <input type="radio" name="upload-request-selection" value="${req.id}" />
          <span class="upload-request-option-label">
            <span class="upload-request-option-title">
              ${escapeHtml(req.title)}
              ${req.is_required ? '<span class="upload-request-badge required">Required</span>' : ''}
            </span>
            <span class="upload-request-option-desc">
              ${req.project_name ? `${escapeHtml(req.project_name)} • ` : ''}
              ${req.document_type ? `${escapeHtml(req.document_type)} • ` : ''}
              <span class="${isOverdue ? 'overdue' : ''}">${dueDate}${isOverdue ? ' (Overdue)' : ''}</span>
            </span>
          </span>
        </label>
      `;
    })
    .join('');

  // Reset to "Other" selection
  const otherRadio = modal.overlay.querySelector('input[name="upload-request-selection"][value="other"]') as HTMLInputElement | null;
  if (otherRadio) {
    otherRadio.checked = true;
  }

  if (uploadRequestOtherDescriptionWrap) {
    uploadRequestOtherDescriptionWrap.style.display = 'block';
  }

  // Show the modal
  modal.show();
}

/**
 * Hide the upload request selection modal
 */
function hideUploadRequestModal(): void {
  uploadRequestModalInstance?.hide();
  pendingFilesToUpload = [];
  uploadRequestModalContext = null;
}

/**
 * Get the selected request ID from the modal
 */
function getSelectedRequestId(): number | null {
  const modal = uploadRequestModalInstance?.overlay;
  if (!modal) return null;

  const selectedRadio = modal.querySelector('input[name="upload-request-selection"]:checked') as HTMLInputElement | null;
  if (!selectedRadio || selectedRadio.value === 'other') {
    return null;
  }

  const parsed = parseInt(selectedRadio.value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Setup modal event listeners
 */
function setupUploadRequestModalListeners(_ctx: ClientPortalContext): void {
  ensureUploadRequestModal();
}

function ensureUploadRequestModal(): PortalModalInstance | null {
  if (uploadRequestModalInstance) {
    return uploadRequestModalInstance;
  }

  const modal = createPortalModal({
    id: 'upload-request-modal',
    titleId: 'upload-request-modal-title',
    title: 'What are you uploading?',
    contentClassName: 'upload-request-modal-content',
    onClose: hideUploadRequestModal
  });

  modal.overlay.classList.add('upload-request-modal');

  const description = document.createElement('p');
  description.className = 'upload-request-modal-description';
  description.textContent =
    'Select which document request you are fulfilling, or choose "Other" for general uploads.';

  const options = document.createElement('div');
  options.className = 'upload-request-options';
  options.id = 'upload-request-options';
  options.setAttribute('role', 'radiogroup');
  options.setAttribute('aria-label', 'Document request options');

  const otherWrap = document.createElement('div');
  otherWrap.className = 'upload-request-other-wrap';

  const otherLabel = document.createElement('label');
  otherLabel.className = 'upload-request-option';

  const otherInput = document.createElement('input');
  otherInput.type = 'radio';
  otherInput.name = 'upload-request-selection';
  otherInput.value = 'other';
  otherInput.checked = true;

  const otherLabelText = document.createElement('span');
  otherLabelText.className = 'upload-request-option-label';

  const otherTitle = document.createElement('span');
  otherTitle.className = 'upload-request-option-title';
  otherTitle.textContent = 'Other / General Upload';

  const otherDesc = document.createElement('span');
  otherDesc.className = 'upload-request-option-desc';
  otherDesc.textContent = 'Upload files not related to a specific request';

  otherLabelText.appendChild(otherTitle);
  otherLabelText.appendChild(otherDesc);
  otherLabel.appendChild(otherInput);
  otherLabel.appendChild(otherLabelText);

  const otherDescriptionWrap = document.createElement('div');
  otherDescriptionWrap.className = 'upload-other-description-wrap';
  otherDescriptionWrap.id = 'upload-other-description-wrap';

  const otherDescriptionLabel = document.createElement('label');
  otherDescriptionLabel.className = 'sr-only';
  otherDescriptionLabel.htmlFor = 'upload-other-description';
  otherDescriptionLabel.textContent = 'Description (optional)';

  const otherDescription = document.createElement('textarea');
  otherDescription.id = 'upload-other-description';
  otherDescription.className = 'form-textarea';
  otherDescription.placeholder = 'Description (optional)';
  otherDescription.rows = 2;

  otherDescriptionWrap.appendChild(otherDescriptionLabel);
  otherDescriptionWrap.appendChild(otherDescription);

  otherWrap.appendChild(otherLabel);
  otherWrap.appendChild(otherDescriptionWrap);

  modal.body.appendChild(description);
  modal.body.appendChild(options);
  modal.body.appendChild(otherWrap);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.id = 'upload-request-modal-cancel';
  cancelBtn.textContent = 'Cancel';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.id = 'upload-request-modal-confirm';
  confirmBtn.textContent = 'Upload';

  cancelBtn.addEventListener('click', hideUploadRequestModal);
  confirmBtn.addEventListener('click', async () => {
    const selectedRequestId = getSelectedRequestId();
    hideUploadRequestModal();

    if (pendingFilesToUpload.length > 0 && uploadRequestModalContext) {
      await proceedWithUpload(pendingFilesToUpload, selectedRequestId, uploadRequestModalContext);
    }
  });

  modal.overlay.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement | null;
    if (!target || target.name !== 'upload-request-selection') return;

    if (uploadRequestOtherDescriptionWrap) {
      uploadRequestOtherDescriptionWrap.style.display = target.value === 'other' ? 'block' : 'none';
    }
  });

  modal.footer.appendChild(cancelBtn);
  modal.footer.appendChild(confirmBtn);

  document.body.appendChild(modal.overlay);

  uploadRequestModalInstance = modal;
  uploadRequestOptionsContainer = options;
  uploadRequestOtherDescriptionWrap = otherDescriptionWrap;

  return modal;
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

  // Check for pending document requests
  pendingRequestsCache = await fetchPendingRequests();

  if (pendingRequestsCache.length > 0) {
    // Show modal to let user select which request they're fulfilling
    setupUploadRequestModalListeners(ctx);
    showUploadRequestModal(files, ctx);
    return;
  }

  // No pending requests, proceed with direct upload
  await proceedWithUpload(files, null, ctx);
}

/**
 * Proceed with actual file upload
 */
async function proceedWithUpload(
  files: File[],
  requestId: number | null,
  ctx: ClientPortalContext
): Promise<void> {
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
      credentials: 'include',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }

    const result = await response.json();
    const uploadedFiles = result.files || [];

    // If a request was selected and we have uploaded files, link the first file to the request
    if (requestId && uploadedFiles.length > 0) {
      const firstFileId = uploadedFiles[0].id;
      const linked = await linkFileToRequest(requestId, firstFileId);
      if (linked) {
        showUploadSuccess(uploadedFiles.length, 'Files uploaded and linked to document request');
      } else {
        showUploadSuccess(uploadedFiles.length, 'Files uploaded (failed to link to request)');
      }
    } else {
      showUploadSuccess(uploadedFiles.length);
    }

    resetDropzone();
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
function showUploadSuccess(count: number, customMessage?: string): void {
  const filesSection = getElement('tab-files');
  if (filesSection) {
    const message = customMessage || `${count} file(s) uploaded successfully`;
    const successMsg = document.createElement('div');
    successMsg.className = 'upload-success-message';
    successMsg.innerHTML = `<span>${message}</span>`;
    filesSection.insertBefore(successMsg, filesSection.firstChild);

    setTimeout(() => {
      successMsg.remove();
    }, 3000);
  }
}

/**
 * Reset files module state when leaving the files view
 * This ensures the folder tree is repopulated on next visit
 */
export function resetFilesState(): void {
  folderTreeInitialized = false;
  currentFilters = {
    projectId: 'all',
    fileType: 'all',
    category: 'all',
    dateFrom: '',
    dateTo: ''
  };
  folderCategoriesCache = [];
  allFilesCache = [];
  cachedElements.clear();
}
