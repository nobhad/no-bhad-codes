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

let currentProjectId: number | null = null;
let currentFolderId: number | string = 'root';
let currentFileId: number | null = null;
let _currentView: 'list' | 'grid' = 'list';

/**
 * Initialize the files module for a project
 */
export async function initFilesModule(projectId: number): Promise<void> {
  currentProjectId = projectId;
  currentFolderId = 'root';

  setupEventListeners();
  await loadFolders();
  await loadFiles();
}

/**
 * Setup event listeners for file management
 */
function setupEventListeners(): void {
  // View toggle
  const viewToggle = document.querySelector('.files-view-toggle');
  if (viewToggle) {
    viewToggle.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view as 'list' | 'grid';
        setView(view);
      });
    });
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

  // Update toggle buttons
  document.querySelectorAll('.files-view-toggle button').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLButtonElement).dataset.view === view);
  });

  // Update list class
  const filesList = document.getElementById('pd-files-list');
  if (filesList) {
    filesList.classList.toggle('grid-view', view === 'grid');
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

    // Build folder tree HTML
    let html = `
      <div class="folder-item root ${currentFolderId === 'root' ? 'active' : ''}" data-folder-id="root">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        <span>All Files</span>
      </div>
    `;

    // Add folders (nested structure would require recursive rendering)
    folders.forEach(folder => {
      const isNested = folder.parent_id !== null;
      html += `
        <div class="folder-item ${isNested ? 'nested' : ''} ${currentFolderId === folder.id ? 'active' : ''}" data-folder-id="${folder.id}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
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
        if (folderId) selectFolder(folderId === 'root' ? 'root' : parseInt(folderId, 10));
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
    pathEl.innerHTML = folderId === 'root'
      ? '<span>All Files</span>'
      : `<span>All Files</span> / <span>${folderId}</span>`;
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
    if (currentFolderId !== 'root') {
      url += `?folder_id=${currentFolderId}`;
    }

    const response = await apiFetch(url);
    if (!response.ok) {
      filesList.innerHTML = '<p class="empty-state">Error loading files.</p>';
      return;
    }

    const data = await response.json();
    const files: FileItem[] = data.files || [];

    if (files.length === 0) {
      filesList.innerHTML = '<p class="empty-state">No files in this folder. Upload files above.</p>';
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

  modal.classList.remove('hidden');

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
    modal.classList.add('hidden');
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
    `;

    // Update lock button state
    const lockBtn = document.getElementById('btn-lock-file');
    if (lockBtn) {
      const svg = file.is_locked
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
      lockBtn.innerHTML = `${svg} ${file.is_locked ? 'Unlock' : 'Lock'}`;
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
  if (!currentFileId || !currentProjectId) return;
  window.open(`/api/projects/${currentProjectId}/files/${currentFileId}/download`, '_blank');
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
    const response = await apiDelete(`/api/projects/${currentProjectId}/files/${currentFileId}`);
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
 * Cleanup function
 */
export function cleanup(): void {
  currentProjectId = null;
  currentFolderId = 'root';
  currentFileId = null;
}
