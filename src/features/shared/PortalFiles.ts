/**
 * ===============================================
 * PORTAL FILES MODULE
 * ===============================================
 * @file src/features/shared/PortalFiles.ts
 *
 * Role-adaptive file management module for both admin and client portals.
 * Admin can manage folders, permissions, versions, and all client files.
 * Client sees only shared files and can upload.
 *
 * CORE PRINCIPLE: Same module, different capabilities based on role.
 */

import { PortalFeatureModule } from './PortalFeatureModule';
import { apiFetch, apiPost, apiDelete, unwrapApiData } from '../../utils/api-client';
import { formatTimeAgo } from '../../utils/time-utils';
import type { DataItem } from './types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalFiles');

// ============================================
// TYPES
// ============================================

interface FileItem extends DataItem {
  id: number;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  folderId: number | null;
  uploadedAt: string;
  uploadedBy?: string;
  category?: string;
  sharedWithClient?: boolean;
  projectId?: number;
  projectName?: string;
}

interface Folder extends DataItem {
  id: number;
  name: string;
  parentId: number | null;
  path: string;
  fileCount?: number;
}

// ============================================
// UNIFIED FILES MODULE
// ============================================

/**
 * Portal Files Module
 *
 * Adapts UI and API calls based on user role:
 * - Admin: folder management, version control, access logs, permissions
 * - Client: view shared files, upload files
 */
export default class PortalFiles extends PortalFeatureModule {
  /** Files list */
  private files: FileItem[] = [];

  /** Folders list (admin only) */
  private folders: Folder[] = [];

  /** Current folder ID */
  private currentFolderId: number | string = 'all';

  /** Current view mode */
  private viewMode: 'list' | 'grid' = 'list';

  constructor() {
    super('UnifiedFiles');
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  async activate(): Promise<void> {
    this.showLoading();
    await this.loadFiles();
    if (this.isAdmin) {
      await this.loadFolders();
    }
    this.renderView();
    this.attachEventListeners();
    this.setModuleState('ready');
  }

  async deactivate(): Promise<void> {
    this.files = [];
    this.folders = [];
    this.currentFolderId = 'all';
  }

  // ============================================
  // API - Role-based endpoints
  // ============================================

  protected getApiEndpoint(): string {
    // Admin gets all files, client gets only shared files
    return this.capabilities.canViewAll
      ? '/api/uploads'
      : '/api/uploads/client';
  }

  private getFoldersEndpoint(): string {
    return '/api/projects/folders';
  }

  // ============================================
  // DATA LOADING
  // ============================================

  private async loadFiles(): Promise<void> {
    try {
      const response = await apiFetch(this.getApiEndpoint());
      const raw = await response.json();
      const data = unwrapApiData<Record<string, unknown>>(raw);
      this.files = (data.files as FileItem[]) || (data as unknown as FileItem[]) || [];
    } catch (error) {
      this.notify('Failed to load files', 'error');
      logger.error('Error loading files:', error);
    }
  }

  private async loadFolders(): Promise<void> {
    if (!this.capabilities.canViewAll) return;

    try {
      const response = await apiFetch(this.getFoldersEndpoint());
      const raw = await response.json();
      const data = unwrapApiData<Record<string, unknown>>(raw);
      this.folders = (data.folders as Folder[]) || (data as unknown as Folder[]) || [];
    } catch (error) {
      logger.error('Error loading folders:', error);
    }
  }

  // ============================================
  // VIEW RENDERING - Role-adaptive
  // ============================================

  protected renderView(): void {
    if (!this.container) return;

    const layout = this.isAdmin
      ? this.renderAdminLayout()
      : this.renderClientLayout();

    this.container.innerHTML = layout;
  }

  private renderAdminLayout(): string {
    return `
      <div class="files-layout admin-files">
        <div class="files-sidebar">
          <div class="folder-tree" id="folder-tree">
            ${this.renderFolderTree()}
          </div>
          ${this.capabilities.canCreate ? `
            <button class="btn btn-sm btn-secondary" data-action="create-folder">
              New Folder
            </button>
          ` : ''}
        </div>
        <div class="files-main">
          <div class="files-header">
            <div class="files-path" id="files-path">
              <span>All Files</span>
            </div>
            <div class="files-actions">
              ${this.renderToolbar()}
            </div>
          </div>
          <div class="files-upload-zone" id="upload-dropzone">
            ${this.renderUploadZone()}
          </div>
          <div class="files-list ${this.viewMode === 'grid' ? 'grid-view' : ''}" id="files-list">
            ${this.renderFilesList()}
          </div>
        </div>
      </div>
    `;
  }

  private renderClientLayout(): string {
    return `
      <div class="files-layout client-files">
        <div class="files-main">
          <div class="files-header">
            <h3>Your Files</h3>
          </div>
          <div class="files-upload-zone" id="upload-dropzone">
            ${this.renderUploadZone()}
          </div>
          <div class="files-list" id="files-list">
            ${this.renderFilesList()}
          </div>
        </div>
      </div>
    `;
  }

  private renderFolderTree(): string {
    const folderIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';

    let html = `
      <div class="folder-item ${this.currentFolderId === 'all' ? 'active' : ''}" data-folder-id="all">
        ${folderIcon}
        <span>All Files</span>
      </div>
    `;

    this.folders.forEach((folder) => {
      const isActive = this.currentFolderId === folder.id;
      html += `
        <div class="folder-item ${isActive ? 'active' : ''}" data-folder-id="${folder.id}">
          ${folderIcon}
          <span>${this.escapeHtml(folder.name)}</span>
          ${folder.fileCount ? `<span class="folder-count">(${folder.fileCount})</span>` : ''}
        </div>
      `;
    });

    return html;
  }

  private renderUploadZone(): string {
    return `
      <div class="dropzone-content">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>Drag and drop files here or</p>
        <button type="button" class="btn btn-secondary" data-action="browse-files">Browse Files</button>
        <input type="file" id="file-input" multiple hidden />
      </div>
    `;
  }

  private renderFilesList(): string {
    if (this.files.length === 0) {
      return `
        <div class="empty-state">
          <p>No files yet. Upload files using the dropzone above.</p>
        </div>
      `;
    }

    return `
      <table class="data-table files-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Size</th>
            <th>Uploaded</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${this.files.map((file) => this.renderFileRow(file)).join('')}
        </tbody>
      </table>
    `;
  }

  private renderFileRow(file: FileItem): string {
    const size = this.formatFileSize(file.size);
    const date = this.formatRelativeTime(file.uploadedAt);

    return `
      <tr data-file-id="${file.id}">
        <td class="name-cell">
          ${this.getFileIcon(file.mimeType)}
          <span class="file-name">${this.escapeHtml(file.originalName || file.filename)}</span>
        </td>
        <td class="size-cell">${size}</td>
        <td class="date-cell">${date}</td>
        <td class="actions-cell">
          <button class="btn-icon" data-action="preview" data-file-id="${file.id}" title="Preview">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn-icon" data-action="download" data-file-id="${file.id}" title="Download">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          ${this.capabilities.canDelete ? `
            <button class="btn-icon btn-danger" data-action="delete" data-file-id="${file.id}" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  private attachEventListeners(): void {
    if (!this.container) return;

    // File actions
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-action]') as HTMLElement;
      if (!button) return;

      const action = button.dataset.action;
      const fileId = button.dataset.fileId;

      switch (action) {
      case 'preview':
        if (fileId) this.previewFile(parseInt(fileId, 10));
        break;
      case 'download':
        if (fileId) this.downloadFile(parseInt(fileId, 10));
        break;
      case 'delete':
        if (fileId) this.deleteFile(parseInt(fileId, 10));
        break;
      case 'browse-files':
        this.triggerFileInput();
        break;
      case 'create-folder':
        this.handleCreateFolder();
        break;
      }
    });

    // Folder selection
    const folderTree = this.container.querySelector('#folder-tree');
    if (folderTree) {
      folderTree.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest('.folder-item');
        if (item) {
          const folderId = (item as HTMLElement).dataset.folderId;
          if (folderId) {
            this.selectFolder(folderId === 'all' ? 'all' : parseInt(folderId, 10));
          }
        }
      });
    }

    // File input change
    const fileInput = this.container.querySelector('#file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          this.uploadFiles(Array.from(fileInput.files));
          fileInput.value = '';
        }
      });
    }

    // Drag and drop
    this.setupDragAndDrop();
  }

  private setupDragAndDrop(): void {
    const dropzone = this.container?.querySelector('#upload-dropzone');
    if (!dropzone) return;

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-active');
    });

    dropzone.addEventListener('drop', (e: Event) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
      const dragEvent = e as globalThis.DragEvent;
      const files = dragEvent.dataTransfer?.files;
      if (files && files.length > 0) {
        this.uploadFiles(Array.from(files));
      }
    });
  }

  private triggerFileInput(): void {
    const fileInput = this.container?.querySelector('#file-input') as HTMLInputElement;
    fileInput?.click();
  }

  private selectFolder(folderId: number | string): void {
    this.currentFolderId = folderId;
    this.renderView();
    this.attachEventListeners();
    this.loadFiles();
  }

  // ============================================
  // FILE OPERATIONS
  // ============================================

  private previewFile(fileId: number): void {
    window.open(`/api/uploads/file/${fileId}`, '_blank');
  }

  private downloadFile(fileId: number): void {
    const link = document.createElement('a');
    link.href = `/api/uploads/file/${fileId}?download=true`;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private async deleteFile(fileId: number): Promise<void> {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await apiDelete(`/api/uploads/file/${fileId}`);
      this.notify('File deleted', 'success');
      await this.loadFiles();
      this.renderView();
      this.attachEventListeners();
    } catch (error) {
      this.notify('Failed to delete file', 'error');
      logger.error('Error deleting file:', error);
    }
  }

  private async uploadFiles(files: File[]): Promise<void> {
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));

      await apiPost('/api/uploads/multiple', formData);
      this.notify(`${files.length} file(s) uploaded`, 'success');
      await this.loadFiles();
      this.renderView();
      this.attachEventListeners();
    } catch (error) {
      this.notify('Failed to upload files', 'error');
      logger.error('Error uploading files:', error);
    }
  }

  private handleCreateFolder(): void {
    const name = prompt('Enter folder name:');
    if (!name?.trim()) return;

    this.createFolder(name.trim());
  }

  private async createFolder(name: string): Promise<void> {
    try {
      await apiPost('/api/projects/folders', {
        name,
        parent_id: this.currentFolderId === 'all' ? null : this.currentFolderId
      });
      this.notify('Folder created', 'success');
      await this.loadFolders();
      this.renderView();
      this.attachEventListeners();
    } catch (error) {
      this.notify('Failed to create folder', 'error');
      logger.error('Error creating folder:', error);
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))  } ${  sizes[i]}`;
  }

  private formatRelativeTime(dateString: string): string {
    return formatTimeAgo(dateString);
  }

  private getFileIcon(mimeType: string): string {
    if (mimeType?.startsWith('image/')) {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    }
    if (mimeType?.includes('pdf')) {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
  }
}
