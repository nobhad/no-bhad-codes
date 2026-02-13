/**
 * ===============================================
 * ADMIN FILES MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-files.ts
 *
 * Enhanced file management with folders, versions,
 * comments, and access tracking.
 * Dynamically imported for code splitting.
 */

import { apiFetch, apiPost, apiDelete } from '../../../utils/api-client';
import { formatFileSize, formatDate, formatDateTime } from '../../../utils/format-utils';
import { confirmDialog, alertSuccess, alertError } from '../../../utils/confirm-dialog';
import { createViewToggle } from '../../../components/view-toggle';
import { openModalOverlay, closeModalOverlay } from '../../../utils/modal-utils';
import { showToast } from '../../../utils/toast-notifications';

interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  path: string;
  file_count?: number;
}

interface FileItem {
  id: number;
  filename: string;
  original_name: string;
  size: number;
  mime_type: string;
  folder_id: number | null;
  uploaded_at: string;
  uploaded_by?: string;
  version_count?: number;
  comment_count?: number;
  is_locked?: boolean;
  locked_by?: string;
  category?: string;
  shared_with_client?: boolean;
  shared_at?: string;
  shared_by?: string;
}

interface FileVersion {
  id: number;
  file_id: number;
  version_number: number;
  filename: string;
  size: number;
  uploaded_at: string;
  uploaded_by?: string;
  is_current: boolean;
}

interface FileComment {
  id: number;
  file_id: number;
  user_email: string;
  content: string;
  created_at: string;
}

interface AccessLogEntry {
  id: number;
  file_id: number;
  action: string;
  user_email: string;
  created_at: string;
}

interface PendingRequest {
  id: number;
  title: string;
  description?: string;
  document_type?: string;
  priority?: string;
  status: string;
  due_date?: string;
  is_required: boolean;
  client_name?: string;
  file_name?: string;
}

type SourceFilter = 'all' | 'admin' | 'client' | 'pending';

let currentProjectId: number | null = null;
let currentFolderId: number | string = 'root';
let currentFileId: number | null = null;
let _currentView: 'list' | 'grid' = 'list';
let _currentSourceFilter: SourceFilter = 'all';
let _pendingRequestsCache: PendingRequest[] = [];

/**
 * Initialize the files module for a project
 */
export async function initFilesModule(projectId: number): Promise<void> {
  currentProjectId = projectId;
  currentFolderId = 'root';
  _currentSourceFilter = 'all';

  setupEventListeners();
  await loadFolders();
  await loadFiles();
  await loadPendingRequestsDropdown();
}

/**
 * Setup event listeners for file management
 */
function setupEventListeners(): void {
  // Source filter toggle (All | Admin | Client | Pending)
  const sourceToggleMount = document.getElementById('files-source-toggle-mount');
  if (sourceToggleMount && !sourceToggleMount.hasChildNodes()) {
    const sourceToggle = createViewToggle({
      id: 'files-source-toggle',
      options: [
        { value: 'all', label: 'All', title: 'All Files', ariaLabel: 'All files' },
        { value: 'admin', label: 'Admin', title: 'Admin Uploads', ariaLabel: 'Admin uploads' },
        { value: 'client', label: 'Client', title: 'Client Uploads', ariaLabel: 'Client uploads' },
        { value: 'pending', label: 'Pending', title: 'Pending Requests', ariaLabel: 'Pending document requests' }
      ],
      value: _currentSourceFilter,
      onChange: (v) => setSourceFilter(v as SourceFilter)
    });
    sourceToggleMount.appendChild(sourceToggle);
  }

  // View toggle (reusable component)
  const viewToggleMount = document.getElementById('files-view-toggle-mount');
  if (viewToggleMount && !viewToggleMount.hasChildNodes()) {
    const listIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';
    const gridIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
    const toggleEl = createViewToggle({
      id: 'files-view-toggle',
      options: [
        { value: 'list', label: 'List', title: 'List View', ariaLabel: 'List view', iconSvg: listIcon },
        { value: 'grid', label: 'Grid', title: 'Grid View', ariaLabel: 'Grid view', iconSvg: gridIcon }
      ],
      value: _currentView,
      onChange: (v) => setView(v as 'list' | 'grid')
    });
    viewToggleMount.appendChild(toggleEl);
  }

  // Create folder button
  const createFolderBtn = document.getElementById('btn-create-folder');
  if (createFolderBtn) {
    createFolderBtn.addEventListener('click', showCreateFolderDialog);
  }

  // File detail modal tabs
  const detailTabs = document.querySelector('.file-detail-tabs');
  if (detailTabs) {
    detailTabs.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab) switchDetailTab(tab);
      });
    });
  }

  // Close file detail modal
  const closeModal = document.getElementById('close-file-detail');
  if (closeModal) {
    closeModal.addEventListener('click', closeFileDetailModal);
  }

  // Modal backdrop click
  const modal = document.getElementById('file-detail-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeFileDetailModal();
    });
  }

  // Download button
  const downloadBtn = document.getElementById('btn-download-file');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadCurrentFile);
  }

  // Lock button
  const lockBtn = document.getElementById('btn-lock-file');
  if (lockBtn) {
    lockBtn.addEventListener('click', toggleFileLock);
  }

  // Delete button
  const deleteBtn = document.getElementById('btn-delete-file');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', deleteCurrentFile);
  }

  // Share toggle button
  const shareBtn = document.getElementById('btn-share-file');
  if (shareBtn) {
    shareBtn.addEventListener('click', toggleFileSharing);
  }

  // Add comment button
  const addCommentBtn = document.getElementById('btn-add-file-comment');
  if (addCommentBtn) {
    addCommentBtn.addEventListener('click', addFileComment);
  }
}

/**
 * Set the file list view mode
 */
function setView(view: 'list' | 'grid'): void {
  _currentView = view;

  const filesList = document.getElementById('pd-files-list');
  if (filesList) {
    filesList.classList.toggle('grid-view', view === 'grid');
  }
}

/**
 * Set the source filter and reload content
 */
async function setSourceFilter(source: SourceFilter): Promise<void> {
  _currentSourceFilter = source;

  const filesList = document.getElementById('pd-files-list');
  const pendingList = document.getElementById('pd-pending-requests-list');

  if (source === 'pending') {
    // Show pending requests, hide files list
    if (filesList) filesList.classList.add('hidden');
    if (pendingList) pendingList.classList.remove('hidden');
    await loadPendingRequests();
  } else {
    // Show files list, hide pending requests
    if (filesList) filesList.classList.remove('hidden');
    if (pendingList) pendingList.classList.add('hidden');
    await loadFiles();
  }
}

/**
 * Load folders for the current project
 */
async function loadFolders(): Promise<void> {
  if (!currentProjectId) return;

  const folderTree = document.getElementById('pd-folder-tree');
  if (!folderTree) return;

  try {
    const response = await apiFetch(`/api/projects/${currentProjectId}/folders`);
    if (!response.ok) return;

    const data = await response.json();
    const folders: Folder[] = data.folders || [];

    const folderIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';

    // Build folder tree HTML with default virtual folders
    let html = `
      <div class="folder-item root ${currentFolderId === 'root' ? 'active' : ''}" data-folder-id="root">
        ${folderIcon}
        <span>All Files</span>
      </div>
      <div class="folder-item ${currentFolderId === 'client' ? 'active' : ''}" data-folder-id="client">
        ${folderIcon}
        <span>Client Files</span>
      </div>
      <div class="folder-item ${currentFolderId === 'shared' ? 'active' : ''}" data-folder-id="shared">
        ${folderIcon}
        <span>Shared Files</span>
      </div>
    `;

    // Add custom folders from database
    folders.forEach(folder => {
      const isNested = folder.parent_id !== null;
      html += `
        <div class="folder-item ${isNested ? 'nested' : ''} ${currentFolderId === folder.id ? 'active' : ''}" data-folder-id="${folder.id}">
          ${folderIcon}
          <span>${escapeHtml(folder.name)}</span>
          ${folder.file_count ? `<span class="folder-count">(${folder.file_count})</span>` : ''}
        </div>
      `;
    });

    folderTree.innerHTML = html;

    // Add click handlers
    folderTree.querySelectorAll('.folder-item').forEach(item => {
      item.addEventListener('click', () => {
        const folderId = (item as HTMLElement).dataset.folderId;
        if (folderId) {
          // Handle virtual folders and numeric IDs
          if (folderId === 'root' || folderId === 'client' || folderId === 'shared') {
            selectFolder(folderId);
          } else {
            selectFolder(parseInt(folderId, 10));
          }
        }
      });
    });

  } catch (error) {
    console.error('[AdminFiles] Error loading folders:', error);
  }
}

/**
 * Select a folder
 */
async function selectFolder(folderId: number | string): Promise<void> {
  currentFolderId = folderId;

  // Update active state
  document.querySelectorAll('.folder-item').forEach(item => {
    const itemId = (item as HTMLElement).dataset.folderId;
    item.classList.toggle('active', itemId === String(folderId));
  });

  // Update path
  const pathEl = document.getElementById('pd-files-path');
  if (pathEl) {
    const folderLabels: Record<string, string> = {
      'root': 'All Files',
      'client': 'Client Files',
      'shared': 'Shared Files'
    };
    const label = typeof folderId === 'string' && folderLabels[folderId]
      ? folderLabels[folderId]
      : String(folderId);
    pathEl.innerHTML = `<span>${label}</span>`;
  }

  await loadFiles();
}

/**
 * Load files for the current folder
 */
async function loadFiles(): Promise<void> {
  if (!currentProjectId) return;

  const filesList = document.getElementById('pd-files-list');
  if (!filesList) return;

  filesList.innerHTML = '<p class="loading-text">Loading files...</p>';

  try {
    let url = `/api/projects/${currentProjectId}/files`;
    // Only add folder_id for numeric folder IDs (not virtual folders)
    if (typeof currentFolderId === 'number') {
      url += `?folder_id=${currentFolderId}`;
    }

    const response = await apiFetch(url);
    if (!response.ok) {
      filesList.innerHTML = '<p class="empty-state">Error loading files.</p>';
      return;
    }

    const data = await response.json();
    let files: FileItem[] = data.files || [];

    // Apply virtual folder filter
    if (currentFolderId === 'client') {
      // Filter for client-uploaded files
      files = files.filter(f => f.uploaded_by && (f.uploaded_by.includes('client') || f.category === 'client_upload'));
    } else if (currentFolderId === 'shared') {
      // Filter for admin-shared files (uploaded by admin/non-client)
      files = files.filter(f => f.uploaded_by && !f.uploaded_by.includes('client') && f.category !== 'client_upload');
    }
    // 'root' shows all files

    // Apply source filter (from toggle)
    if (_currentSourceFilter === 'admin') {
      files = files.filter(f => f.uploaded_by && !f.uploaded_by.includes('client'));
    } else if (_currentSourceFilter === 'client') {
      files = files.filter(f => f.uploaded_by && f.uploaded_by.includes('client') || f.category === 'client_upload');
    }
    // 'all' shows everything, 'pending' handled separately

    if (files.length === 0) {
      const folderLabels: Record<string, string> = {
        'root': 'this folder',
        'client': 'Client Files',
        'shared': 'Shared Files'
      };
      const folderLabel = typeof currentFolderId === 'string' && folderLabels[currentFolderId]
        ? folderLabels[currentFolderId]
        : 'this folder';
      const emptyMessage = `No files in ${folderLabel}. Upload files above.`;
      filesList.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
      return;
    }

    filesList.innerHTML = files.map(file => renderFileItem(file)).join('');

    // Add click handlers
    filesList.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', () => {
        const fileId = parseInt((item as HTMLElement).dataset.fileId || '0', 10);
        if (fileId) openFileDetail(fileId);
      });
    });

  } catch (error) {
    console.error('[AdminFiles] Error loading files:', error);
    filesList.innerHTML = '<p class="empty-state">Error loading files.</p>';
  }
}

/**
 * Render a file item
 */
function renderFileItem(file: FileItem): string {
  const iconClass = getFileIconClass(file.mime_type);
  const iconSvg = getFileIcon(file.mime_type);

  return `
    <div class="file-item ${file.is_locked ? 'locked' : ''}" data-file-id="${file.id}">
      <div class="file-icon ${iconClass}">
        ${iconSvg}
      </div>
      <div class="file-info">
        <div class="file-name">
          ${escapeHtml(file.original_name || file.filename)}
          ${file.is_locked ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' : ''}
        </div>
        <div class="file-meta">
          ${formatFileSize(file.size)} • ${formatDate(file.uploaded_at)}
        </div>
      </div>
      <div class="file-badges">
        ${file.version_count && file.version_count > 1 ? `<span class="file-badge version">v${file.version_count}</span>` : ''}
        ${file.comment_count ? `<span class="file-badge comments"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> ${file.comment_count}</span>` : ''}
        ${file.is_locked ? '<span class="file-badge locked">Locked</span>' : ''}
      </div>
    </div>
  `;
}

/**
 * Get file icon class based on mime type
 */
function getFileIconClass(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return 'archive';
  return '';
}

/**
 * Get file icon SVG based on mime type
 */
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
  }
  if (mimeType.includes('pdf')) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
  }
  if (mimeType.includes('zip') || mimeType.includes('rar')) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"></path><polyline points="3 4 12 2 21 4"></polyline><line x1="12" y1="2" x2="12" y2="22"></line></svg>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
}

/**
 * Open file detail modal
 */
async function openFileDetail(fileId: number): Promise<void> {
  currentFileId = fileId;
  const modal = document.getElementById('file-detail-modal');
  if (!modal) return;

  openModalOverlay(modal);

  // Load file info
  await loadFileInfo(fileId);

  // Switch to info tab
  switchDetailTab('info');
}

/**
 * Close file detail modal
 */
function closeFileDetailModal(): void {
  const modal = document.getElementById('file-detail-modal');
  if (modal) {
    closeModalOverlay(modal);
  }
  currentFileId = null;
}

/**
 * Switch detail tab
 */
function switchDetailTab(tab: string): void {
  // Update tab buttons
  document.querySelectorAll('.file-detail-tabs button').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLButtonElement).dataset.tab === tab);
  });

  // Update tab content
  document.querySelectorAll('.file-detail-tab-content').forEach(content => {
    const isActive = (content as HTMLElement).dataset.tabContent === tab;
    content.classList.toggle('active', isActive);
  });

  // Load tab-specific data
  if (currentFileId) {
    switch (tab) {
    case 'versions':
      loadFileVersions(currentFileId);
      break;
    case 'comments':
      loadFileComments(currentFileId);
      break;
    case 'access':
      loadFileAccessLog(currentFileId);
      break;
    }
  }
}

/**
 * Load file info
 */
async function loadFileInfo(fileId: number): Promise<void> {
  const container = document.getElementById('file-info-content');
  const nameEl = document.getElementById('file-detail-name');
  if (!container) return;

  try {
    // We would need a file details endpoint - for now construct from list
    const response = await apiFetch(`/api/projects/${currentProjectId}/files`);
    if (!response.ok) return;

    const data = await response.json();
    const file = (data.files as FileItem[])?.find(f => f.id === fileId);

    if (!file) {
      container.innerHTML = '<p>File not found</p>';
      return;
    }

    if (nameEl) {
      nameEl.textContent = file.original_name || file.filename;
    }

    container.innerHTML = `
      <div class="file-info-item">
        <span class="file-info-label">File Name</span>
        <span class="file-info-value">${escapeHtml(file.original_name || file.filename)}</span>
      </div>
      <div class="file-info-item">
        <span class="file-info-label">Size</span>
        <span class="file-info-value">${formatFileSize(file.size)}</span>
      </div>
      <div class="file-info-item">
        <span class="file-info-label">Type</span>
        <span class="file-info-value">${file.mime_type}</span>
      </div>
      <div class="file-info-item">
        <span class="file-info-label">Uploaded</span>
        <span class="file-info-value">${formatDateTime(file.uploaded_at)}</span>
      </div>
      <div class="file-info-item">
        <span class="file-info-label">Uploaded By</span>
        <span class="file-info-value">${file.uploaded_by || 'Unknown'}</span>
      </div>
      <div class="file-info-item">
        <span class="file-info-label">Category</span>
        <span class="file-info-value">${file.category || 'Uncategorized'}</span>
      </div>
      <div class="file-info-item">
        <span class="file-info-label">Shared with Client</span>
        <span class="file-info-value">${file.shared_with_client ? `<span class="status-badge status-active">Yes</span> (${formatDateTime(file.shared_at || '')})` : '<span class="status-badge status-inactive">No</span>'}</span>
      </div>
    `;

    // Update lock button state
    const lockBtn = document.getElementById('btn-lock-file');
    if (lockBtn) {
      const svg = file.is_locked
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
      lockBtn.innerHTML = `${svg} ${file.is_locked ? 'Unlock' : 'Lock'}`;
    }

    // Update share button state
    const shareBtn = document.getElementById('btn-share-file');
    if (shareBtn) {
      const svg = file.shared_with_client
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';
      shareBtn.innerHTML = `${svg} ${file.shared_with_client ? 'Shared' : 'Share with Client'}`;
      shareBtn.classList.toggle('btn-success', Boolean(file.shared_with_client));
      shareBtn.classList.toggle('btn-secondary', !file.shared_with_client);
    }

  } catch (error) {
    console.error('[AdminFiles] Error loading file info:', error);
    container.innerHTML = '<p>Error loading file info</p>';
  }
}

/**
 * Load file versions
 */
async function loadFileVersions(fileId: number): Promise<void> {
  const container = document.getElementById('file-versions-list');
  if (!container) return;

  container.innerHTML = '<p class="loading-text">Loading versions...</p>';

  try {
    const response = await apiFetch(`/api/projects/files/${fileId}/versions`);
    if (!response.ok) {
      container.innerHTML = '<p class="empty-state">Could not load versions</p>';
      return;
    }

    const data = await response.json();
    const versions: FileVersion[] = data.versions || [];

    if (versions.length === 0) {
      container.innerHTML = '<p class="empty-state">No version history</p>';
      return;
    }

    container.innerHTML = versions.map(version => `
      <div class="version-item ${version.is_current ? 'current' : ''}">
        <div class="version-info">
          <span class="version-label">
            Version ${version.version_number}
            ${version.is_current ? '<span class="badge">Current</span>' : ''}
          </span>
          <span class="version-meta">
            ${formatFileSize(version.size)} • ${formatDateTime(version.uploaded_at)}
            ${version.uploaded_by ? ` • ${version.uploaded_by}` : ''}
          </span>
        </div>
        <div class="version-actions">
          ${!version.is_current ? `<button class="btn btn-secondary btn-sm restore-version-btn" data-version-id="${version.id}">Restore</button>` : ''}
        </div>
      </div>
    `).join('');

    // Add restore handlers
    container.querySelectorAll('.restore-version-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const versionId = (btn as HTMLElement).dataset.versionId;
        if (versionId) await restoreVersion(fileId, parseInt(versionId, 10));
      });
    });

  } catch (error) {
    console.error('[AdminFiles] Error loading versions:', error);
    container.innerHTML = '<p class="empty-state">Error loading versions</p>';
  }
}

/**
 * Restore a file version
 */
async function restoreVersion(fileId: number, versionId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Restore Version',
    message: 'This will make this version the current version. Continue?',
    confirmText: 'Restore',
    cancelText: 'Cancel'
  });

  if (!confirmed) return;

  try {
    const response = await apiPost(`/api/projects/files/${fileId}/versions/${versionId}/restore`, {});
    if (response.ok) {
      alertSuccess('Version restored successfully');
      await loadFileVersions(fileId);
      await loadFiles();
    } else {
      alertError('Failed to restore version');
    }
  } catch (error) {
    console.error('[AdminFiles] Error restoring version:', error);
    alertError('Failed to restore version');
  }
}

/**
 * Load file comments
 */
async function loadFileComments(fileId: number): Promise<void> {
  const container = document.getElementById('file-comments-list');
  if (!container) return;

  container.innerHTML = '<p class="loading-text">Loading comments...</p>';

  try {
    const response = await apiFetch(`/api/projects/files/${fileId}/comments`);
    if (!response.ok) {
      container.innerHTML = '<p class="empty-state">Could not load comments</p>';
      return;
    }

    const data = await response.json();
    const comments: FileComment[] = data.comments || [];

    if (comments.length === 0) {
      container.innerHTML = '<p class="empty-state">No comments yet</p>';
      return;
    }

    container.innerHTML = comments.map(comment => `
      <div class="comment-item">
        <div class="comment-header">
          <span class="comment-author">${escapeHtml(comment.user_email)}</span>
          <span class="comment-date">${formatDateTime(comment.created_at)}</span>
        </div>
        <div class="comment-text">${escapeHtml(comment.content)}</div>
      </div>
    `).join('');

  } catch (error) {
    console.error('[AdminFiles] Error loading comments:', error);
    container.innerHTML = '<p class="empty-state">Error loading comments</p>';
  }
}

/**
 * Add a comment to the current file
 */
async function addFileComment(): Promise<void> {
  if (!currentFileId) return;

  const input = document.getElementById('file-comment-input') as HTMLTextAreaElement;
  if (!input || !input.value.trim()) return;

  try {
    const response = await apiPost(`/api/projects/files/${currentFileId}/comments`, {
      content: input.value.trim()
    });

    if (response.ok) {
      input.value = '';
      await loadFileComments(currentFileId);
      await loadFiles(); // Refresh to update comment count
      alertSuccess('Comment added');
    } else {
      alertError('Failed to add comment');
    }
  } catch (error) {
    console.error('[AdminFiles] Error adding comment:', error);
    alertError('Failed to add comment');
  }
}

/**
 * Load file access log
 */
async function loadFileAccessLog(fileId: number): Promise<void> {
  const container = document.getElementById('file-access-log');
  if (!container) return;

  container.innerHTML = '<p class="loading-text">Loading access log...</p>';

  try {
    const response = await apiFetch(`/api/projects/files/${fileId}/access-log`);
    if (!response.ok) {
      container.innerHTML = '<p class="empty-state">Could not load access log</p>';
      return;
    }

    const data = await response.json();
    const log: AccessLogEntry[] = data.log || [];

    if (log.length === 0) {
      container.innerHTML = '<p class="empty-state">No access history</p>';
      return;
    }

    container.innerHTML = log.slice(0, 20).map(entry => `
      <div class="access-log-item">
        <span class="access-log-action">${formatAccessAction(entry.action)}</span>
        <span class="access-log-user">${escapeHtml(entry.user_email)}</span>
        <span class="access-log-date">${formatDateTime(entry.created_at)}</span>
      </div>
    `).join('');

  } catch (error) {
    console.error('[AdminFiles] Error loading access log:', error);
    container.innerHTML = '<p class="empty-state">Error loading access log</p>';
  }
}

/**
 * Format access action for display
 */
function formatAccessAction(action: string): string {
  const actions: Record<string, string> = {
    'view': 'Viewed',
    'download': 'Downloaded',
    'upload': 'Uploaded',
    'delete': 'Deleted',
    'lock': 'Locked',
    'unlock': 'Unlocked',
    'comment': 'Commented',
    'restore': 'Restored version'
  };
  return actions[action] || action;
}

/**
 * Download current file
 */
function downloadCurrentFile(): void {
  if (!currentFileId) return;
  window.open(`/api/uploads/file/${currentFileId}`, '_blank');
}

/**
 * Toggle file lock
 */
async function toggleFileLock(): Promise<void> {
  if (!currentFileId) return;

  try {
    // Check current lock state from button text
    const lockBtn = document.getElementById('btn-lock-file');
    const isLocked = lockBtn?.textContent?.includes('Unlock');

    const endpoint = isLocked
      ? `/api/projects/files/${currentFileId}/unlock`
      : `/api/projects/files/${currentFileId}/lock`;

    const response = await apiPost(endpoint, {});
    if (response.ok) {
      alertSuccess(isLocked ? 'File unlocked' : 'File locked');
      await loadFileInfo(currentFileId);
      await loadFiles();
    } else {
      alertError('Failed to update lock status');
    }
  } catch (error) {
    console.error('[AdminFiles] Error toggling lock:', error);
    alertError('Failed to update lock status');
  }
}

/**
 * Toggle file sharing with client
 */
async function toggleFileSharing(): Promise<void> {
  if (!currentFileId) return;

  try {
    // Check current sharing state from button text
    const shareBtn = document.getElementById('btn-share-file');
    const isShared = shareBtn?.textContent?.includes('Shared');

    const endpoint = isShared
      ? `/api/uploads/${currentFileId}/unshare`
      : `/api/uploads/${currentFileId}/share`;

    const response = await apiPost(endpoint, {});
    if (response.ok) {
      showToast(
        isShared ? 'File unshared from client' : 'File shared with client',
        isShared ? 'info' : 'success'
      );
      await loadFileInfo(currentFileId);
      await loadFiles();
    } else {
      alertError('Failed to update sharing status');
    }
  } catch (error) {
    console.error('[AdminFiles] Error toggling sharing:', error);
    alertError('Failed to update sharing status');
  }
}

/**
 * Delete current file
 */
async function deleteCurrentFile(): Promise<void> {
  if (!currentFileId || !currentProjectId) return;

  const confirmed = await confirmDialog({
    title: 'Delete File',
    message: 'Are you sure you want to delete this file? This action cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    danger: true
  });

  if (!confirmed) return;

  try {
    const response = await apiDelete(`/api/uploads/file/${currentFileId}`);
    if (response.ok) {
      alertSuccess('File deleted');
      closeFileDetailModal();
      await loadFiles();
    } else {
      alertError('Failed to delete file');
    }
  } catch (error) {
    console.error('[AdminFiles] Error deleting file:', error);
    alertError('Failed to delete file');
  }
}

/**
 * Show create folder dialog
 */
async function showCreateFolderDialog(): Promise<void> {
  const folderName = prompt('Enter folder name:');
  if (!folderName?.trim() || !currentProjectId) return;

  try {
    const response = await apiPost(`/api/projects/${currentProjectId}/folders`, {
      name: folderName.trim(),
      parent_id: currentFolderId === 'root' ? null : currentFolderId
    });

    if (response.ok) {
      alertSuccess('Folder created');
      await loadFolders();
    } else {
      alertError('Failed to create folder');
    }
  } catch (error) {
    console.error('[AdminFiles] Error creating folder:', error);
    alertError('Failed to create folder');
  }
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Load pending document requests for the current project
 */
async function loadPendingRequests(): Promise<void> {
  if (!currentProjectId) return;

  const pendingList = document.getElementById('pd-pending-requests-list');
  if (!pendingList) return;

  pendingList.innerHTML = '<p class="loading-text">Loading pending requests...</p>';

  try {
    const response = await apiFetch(`/api/document-requests/project/${currentProjectId}/pending`);
    if (!response.ok) {
      pendingList.innerHTML = '<p class="empty-state">Error loading pending requests.</p>';
      return;
    }

    const data = await response.json();
    const requests: PendingRequest[] = data.requests || [];
    _pendingRequestsCache = requests;

    if (requests.length === 0) {
      pendingList.innerHTML = '<p class="empty-state">No pending document requests for this project.</p>';
      return;
    }

    pendingList.innerHTML = requests.map(req => renderPendingRequestItem(req)).join('');

    // Add click handlers for actions
    pendingList.querySelectorAll('.pending-request-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = (btn as HTMLElement).dataset.action;
        const requestId = parseInt((btn as HTMLElement).dataset.requestId || '0', 10);
        if (action && requestId) {
          await handlePendingRequestAction(requestId, action);
        }
      });
    });

  } catch (error) {
    console.error('[AdminFiles] Error loading pending requests:', error);
    pendingList.innerHTML = '<p class="empty-state">Error loading pending requests.</p>';
  }
}

/**
 * Render a pending request item
 */
function renderPendingRequestItem(request: PendingRequest): string {
  const statusClass = `status-${request.status}`;
  const priorityClass = request.priority ? `priority-${request.priority}` : '';
  const dueDate = request.due_date ? formatDate(request.due_date) : 'No due date';
  const isOverdue = request.due_date && new Date(request.due_date) < new Date();

  return `
    <div class="pending-request-item ${statusClass} ${priorityClass}" data-request-id="${request.id}">
      <div class="pending-request-info">
        <div class="pending-request-header">
          <span class="pending-request-title">${escapeHtml(request.title)}</span>
          <span class="pending-request-badge ${statusClass}">${escapeHtml(request.status)}</span>
          ${request.is_required ? '<span class="pending-request-badge required">Required</span>' : ''}
        </div>
        <div class="pending-request-meta">
          <span class="pending-request-type">${escapeHtml(request.document_type || 'general')}</span>
          <span class="pending-request-due ${isOverdue ? 'overdue' : ''}">${dueDate}${isOverdue ? ' (Overdue)' : ''}</span>
        </div>
        ${request.description ? `<p class="pending-request-description">${escapeHtml(request.description)}</p>` : ''}
      </div>
      <div class="pending-request-actions">
        <button type="button" class="btn btn-secondary btn-sm pending-request-action" data-action="view" data-request-id="${request.id}" title="View Details">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button type="button" class="btn btn-secondary btn-sm pending-request-action" data-action="remind" data-request-id="${request.id}" title="Send Reminder">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </button>
        <button type="button" class="btn btn-danger btn-sm pending-request-action" data-action="delete" data-request-id="${request.id}" title="Delete Request">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Handle pending request actions
 */
async function handlePendingRequestAction(requestId: number, action: string): Promise<void> {
  try {
    if (action === 'view') {
      // Navigate to document requests section or show details
      window.location.hash = `#document-requests?id=${requestId}`;
    } else if (action === 'remind') {
      const response = await apiPost(`/api/document-requests/${requestId}/remind`, {});
      if (response.ok) {
        showToast('Reminder sent successfully', 'success');
      } else {
        alertError('Failed to send reminder');
      }
    } else if (action === 'delete') {
      const confirmed = await confirmDialog({
        title: 'Delete Document Request',
        message: 'Are you sure you want to delete this document request? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        danger: true
      });

      if (confirmed) {
        const response = await apiDelete(`/api/document-requests/${requestId}`);
        if (response.ok) {
          alertSuccess('Document request deleted');
          await loadPendingRequests();
          await loadPendingRequestsDropdown();
        } else {
          alertError('Failed to delete request');
        }
      }
    }
  } catch (error) {
    console.error('[AdminFiles] Error handling pending request action:', error);
    alertError('An error occurred');
  }
}

/**
 * Load pending requests for the upload dropdown
 */
async function loadPendingRequestsDropdown(): Promise<void> {
  if (!currentProjectId) return;

  const select = document.getElementById('pd-upload-request-select') as HTMLSelectElement;
  if (!select) return;

  try {
    const response = await apiFetch(`/api/document-requests/project/${currentProjectId}/pending`);
    if (!response.ok) return;

    const data = await response.json();
    const requests: PendingRequest[] = data.requests || [];
    _pendingRequestsCache = requests;

    // Clear and repopulate options
    select.innerHTML = '<option value="">General upload</option>';

    requests.forEach(req => {
      const option = document.createElement('option');
      option.value = String(req.id);
      option.textContent = `${req.title}${req.is_required ? ' (Required)' : ''}`;
      select.appendChild(option);
    });

    // Show/hide the dropdown based on whether there are pending requests
    const container = document.getElementById('pd-upload-link-request');
    if (container) {
      container.style.display = requests.length > 0 ? 'block' : 'none';
    }

  } catch (error) {
    console.error('[AdminFiles] Error loading pending requests dropdown:', error);
  }
}

/**
 * Link uploaded file to a document request
 */
async function linkFileToRequest(fileId: number, requestId: number): Promise<boolean> {
  try {
    const response = await apiPost(`/api/document-requests/${requestId}/upload`, { fileId });
    if (response.ok) {
      showToast('File linked to document request', 'success');
      await loadPendingRequestsDropdown();
      return true;
    }
    return false;
  } catch (error) {
    console.error('[AdminFiles] Error linking file to request:', error);
    return false;
  }
}

/**
 * Get selected request ID from dropdown
 */
function getSelectedRequestId(): number | null {
  const select = document.getElementById('pd-upload-request-select') as HTMLSelectElement;
  if (!select || !select.value) return null;
  return parseInt(select.value, 10);
}

/**
 * Reset the upload dropdown after upload
 */
function resetUploadDropdown(): void {
  const select = document.getElementById('pd-upload-request-select') as HTMLSelectElement;
  if (select) {
    select.value = '';
  }
}

/**
 * Handle file upload with optional request linking
 * This function should be called after a successful file upload
 */
export async function handleFileUploadComplete(fileId: number): Promise<void> {
  const selectedRequestId = getSelectedRequestId();
  if (selectedRequestId) {
    await linkFileToRequest(fileId, selectedRequestId);
  }
  resetUploadDropdown();
  await loadFiles();
}

/**
 * Cleanup function
 */
export function cleanup(): void {
  currentProjectId = null;
  currentFolderId = 'root';
  currentFileId = null;
  _currentSourceFilter = 'all';
  _pendingRequestsCache = [];
}
