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

const FILES_API_BASE = '/api/uploads';

/**
 * Load files from API
 */
export async function loadFiles(ctx: ClientPortalContext): Promise<void> {
  const filesContainer = document.querySelector('.files-list-section');
  if (!filesContainer) return;

  try {
    const response = await fetch(`${FILES_API_BASE}/client`, {
      credentials: 'include' // Include HttpOnly cookies
    });

    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }

    const data = await response.json();
    renderFilesList(filesContainer as HTMLElement, data.files || [], ctx);
  } catch (error) {
    console.error('Error loading files:', error);
    (filesContainer as HTMLElement).innerHTML =
      '<p class="no-files">Unable to load files. Please try again later.</p>';
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

  const trashIcon =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';

  container.innerHTML = files
    .map((file) => {
      const canDelete = file.uploadedBy === clientEmail || file.uploadedBy === 'client';
      const deleteIcon = canDelete
        ? `<button class="file-delete-icon btn-delete" data-file-id="${file.id}" data-filename="${ctx.escapeHtml(file.originalName)}" aria-label="Delete file">
            ${trashIcon}
          </button>`
        : '';

      return `
        <div class="file-item" data-file-id="${file.id}">
          ${deleteIcon}
          <div class="file-icon">
            ${getFileIcon(file.mimetype)}
          </div>
          <div class="file-info">
            <span class="file-name">${ctx.escapeHtml(file.originalName)}</span>
            <span class="file-meta">
              ${file.projectName ? `${file.projectName} • ` : ''}
              ${ctx.formatDate(file.uploadedAt)} • ${formatFileSize(file.size)}
            </span>
          </div>
          <div class="file-actions">
            <button class="btn btn-sm btn-outline btn-preview" data-file-id="${file.id}" data-mimetype="${file.mimetype}">
              Preview
            </button>
            <button class="btn btn-sm btn-outline btn-download" data-file-id="${file.id}" data-filename="${ctx.escapeHtml(file.originalName)}">
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
  const imageIcon =
    '<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><rect x=\'3\' y=\'3\' width=\'18\' height=\'18\' rx=\'2\' ry=\'2\'/><circle cx=\'8.5\' cy=\'8.5\' r=\'1.5\'/><polyline points=\'21 15 16 10 5 21\'/></svg>';
  const pdfIcon =
    '<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\'/><polyline points=\'14 2 14 8 20 8\'/><line x1=\'16\' y1=\'13\' x2=\'8\' y2=\'13\'/><line x1=\'16\' y1=\'17\' x2=\'8\' y2=\'17\'/><polyline points=\'10 9 9 9 8 9\'/></svg>';
  const docIcon =
    '<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\'/><polyline points=\'14 2 14 8 20 8\'/></svg>';

  if (mimetype.startsWith('image/')) {
    return imageIcon;
  }
  if (mimetype === 'application/pdf') {
    return pdfIcon;
  }
  return docIcon;
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
  if (!confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
    return;
  }

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
    alert(error instanceof Error ? error.message : 'Failed to delete file. Please try again.');
  }
}

/**
 * Setup file upload handlers (drag & drop + browse)
 */
export function setupFileUploadHandlers(ctx: ClientPortalContext): void {
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const browseBtn = document.getElementById('btn-browse-files');

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
 * Upload files to the server
 */
async function uploadFiles(files: File[], ctx: ClientPortalContext): Promise<void> {
  if (files.length > 5) {
    alert('Maximum 5 files allowed per upload.');
    return;
  }

  const maxSize = 10 * 1024 * 1024;
  const oversizedFiles = files.filter((f) => f.size > maxSize);
  if (oversizedFiles.length > 0) {
    alert(`Some files exceed the 10MB limit: ${oversizedFiles.map((f) => f.name).join(', ')}`);
    return;
  }

  const dropzone = document.getElementById('upload-dropzone');
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
    resetDropzone();
    alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Reset dropzone to initial state
 */
function resetDropzone(): void {
  const dropzone = document.getElementById('upload-dropzone');
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
        <input type="file" id="file-input" multiple hidden />
      </div>
    `;
    const browseBtn = document.getElementById('btn-browse-files');
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
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
  const filesSection = document.getElementById('tab-files');
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
