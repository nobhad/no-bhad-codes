# File Management System

**Status:** Complete
**Last Updated:** February 2, 2026

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Backend API](#backend-api)
5. [Frontend Implementation](#frontend-implementation)
6. [HTML Structure](#html-structure)
7. [Styling](#styling)
8. [File Locations](#file-locations)
9. [Related Documentation](#related-documentation)

---

## Overview

The File Management system allows clients to upload, view, preview, and download project-related files. Files are stored on the server and associated with projects. The system includes access control to ensure clients can only access their own files.

**Access:** Client Portal > Files tab (`tab-files`)

---

## Features

|Feature|Status|Description|
|---------|--------|-------------|
|Drag & Drop Upload|Complete|Intuitive file upload via drag and drop (desktop only)|
|Browse Files|Complete|Traditional file picker button|
|Multi-file Upload|Complete|Upload up to 5 files at once|
|File List from API|Complete|Dynamic file list from backend|
|Demo Mode|Complete|Fallback demo files when backend unavailable|
|File Preview|Complete|Open images/PDFs in new browser tab|
|File Download|Complete|Download files with original filename|
|File Delete|Complete|Delete files with confirmation (client files only)|
|File Icons|Complete|Visual file type identification|
|File Size Display|Complete|Human-readable file sizes|
|Upload Progress|Complete|Visual feedback during upload|
|Success Messages|Complete|Confirmation after successful upload|
|Access Control|Complete|Clients can only access their own files|
|Admin File Protection|Complete|Clients cannot delete admin-uploaded files|
|Mobile Responsive|Complete|Optimized layout for mobile devices|
|Project Filtering|Complete|Filter by project, file type, category, date range (GET /api/uploads/client query params)|

---

## Architecture

### Technology Stack

|Component|Technology|
|-----------|------------|
|Backend|Express.js with TypeScript|
|File Storage|Multer middleware, local filesystem|
|Authentication|HttpOnly cookies (session-based)|
|Frontend|Vanilla TypeScript|
|API Communication|Fetch API with credentials: 'include'|

### Data Flow

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client Portal │ ──> │  Upload API      │ ──> │  File System    │
│   (TypeScript)  │     │  (Express)       │     │  (uploads/)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                        │
        │                       v                        │
        │               ┌──────────────────┐             │
        │               │  Database        │             │
        └─────────────> │  (uploads table) │ <───────────┘
                        └──────────────────┘
```

---

## Backend API

### Base URL

```text
/api/uploads
```

### Endpoints

#### GET `/api/uploads/client`

Get all files for the authenticated client (across all their projects).

**Authentication:** Required (HttpOnly cookie session)

**Response (200 OK):**

```json
{
  "success": true,
  "files": [
    {
      "id": 1,
      "originalName": "project-brief.pdf",
      "filename": "1701234567890-abc123.pdf",
      "mimetype": "application/pdf",
      "size": 245760,
      "projectId": 1,
      "projectName": "Website Redesign",
      "uploadedAt": "2025-12-01T10:30:00.000Z",
      "uploadedBy": 5
    }
  ],
  "count": 1
}
```

---

#### GET `/api/uploads/project/:projectId`

Get all files for a specific project.

**Authentication:** Required
**Parameters:**

- `projectId` (integer) - Project ID

**Response (200 OK):**

```json
{
  "success": true,
  "files": [...],
  "count": 3
}
```

**Error (403 Forbidden):**

```json
{
  "error": "Access denied to this project"
}
```

---

#### GET `/api/uploads/file/:fileId`

Download or preview a specific file.

**Authentication:** Required
**Parameters:**

- `fileId` (integer) - File ID

**Query Parameters:**

- `download` (boolean, optional) - If `true`, forces download; otherwise inline preview

**Response:** File stream with appropriate Content-Type and Content-Disposition headers

**Access Control:** User must own the project the file belongs to, or have uploaded the file

---

#### DELETE `/api/uploads/file/:fileId`

Delete a specific file.

**Authentication:** Required
**Parameters:**

- `fileId` (integer) - File ID

**Response (200 OK):**

```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

**Error (403 Forbidden):**

```json
{
  "error": "Access denied - you do not own this file"
}
```

---

#### POST `/api/uploads/single`

Upload a single file.

**Authentication:** Required
**Content-Type:** `multipart/form-data`

**Form Data:**

- `file` (file) - The file to upload
- `category` (string, optional) - File category

---

#### POST `/api/uploads/multiple`

Upload multiple files (max 5).

**Authentication:** Required
**Content-Type:** `multipart/form-data`

**Form Data:**

- `files` (file[]) - Array of files to upload

**Response (201 Created):**

```json
{
  "success": true,
  "message": "3 files uploaded successfully",
  "files": [...]
}
```

---

## Frontend Implementation

### TypeScript Module

Location: `src/features/client/modules/portal-files.ts`

The file module uses the `ClientPortalContext` pattern for shared utilities like `escapeHtml()`, `formatDate()`, and `isDemo()`.

### API Base URL

```typescript
const FILES_API_BASE = '/api/uploads';
```

### Key Methods

#### loadFiles()

Fetches files from the API and renders the list.

```typescript
// src/features/client/modules/portal-files.ts
export async function loadFiles(ctx: ClientPortalContext): Promise<void> {
  const filesContainer = document.querySelector('.files-list-section');
  if (!filesContainer) return;

  try {
    // Demo mode check using context
    if (ctx.isDemo()) {
      renderDemoFiles(filesContainer as HTMLElement, ctx);
      return;
    }

    const response = await fetch(`${FILES_API_BASE}/client`, {
      credentials: 'include' // HttpOnly cookie authentication
    });

    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }

    const data = await response.json();
    renderFilesList(filesContainer as HTMLElement, data.files || [], ctx);
  } catch (error) {
    console.error('Error loading files:', error);
    renderDemoFiles(filesContainer as HTMLElement, ctx);
  }
}
```

#### renderFilesList()

Renders the file list HTML with icons and action buttons.

```typescript
// src/features/client/modules/portal-files.ts
import { formatFileSize } from '../../../utils/format-utils';

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
      // Only show delete for client-uploaded files
      const canDelete = file.uploadedBy === clientEmail || file.uploadedBy === 'client';
      const deleteIcon = canDelete
        ? `<button class="file-delete-icon btn-delete" data-file-id="${file.id}"
             data-filename="${ctx.escapeHtml(file.originalName)}" aria-label="Delete file">
             ${trashIcon}
           </button>`
        : '';

      return `
        <div class="file-item" data-file-id="${file.id}">
          ${deleteIcon}
          <div class="file-icon">${getFileIcon(file.mimetype)}</div>
          <div class="file-info">
            <span class="file-name">${ctx.escapeHtml(file.originalName)}</span>
            <span class="file-meta">
              ${file.projectName ? `${file.projectName} • ` : ''}
              ${ctx.formatDate(file.uploadedAt)} • ${formatFileSize(file.size)}
            </span>
          </div>
          <div class="file-actions">
            <button class="btn btn-sm btn-outline btn-preview" data-file-id="${file.id}"
                    data-mimetype="${file.mimetype}">Preview</button>
            <button class="btn btn-sm btn-outline btn-download" data-file-id="${file.id}"
                    data-filename="${ctx.escapeHtml(file.originalName)}">Download</button>
          </div>
        </div>
      `;
    })
    .join('');

  attachFileActionListeners(container, ctx);
}
```

#### setupFileUploadHandlers()

Sets up drag & drop, browse button, and keyboard accessibility.

```typescript
// src/features/client/modules/portal-files.ts
export function setupFileUploadHandlers(ctx: ClientPortalContext): void {
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const browseBtn = document.getElementById('btn-browse-files');

  if (!dropzone) return;

  // Keyboard accessibility
  dropzone.setAttribute('tabindex', '0');
  dropzone.setAttribute('role', 'button');
  dropzone.setAttribute(
    'aria-label',
    'File upload dropzone - press Enter or Space to browse files, or drag and drop files here'
  );

  // Browse button click
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

  // Drag & drop handlers
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

  // Keyboard support for dropzone
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput?.click();
    }
  });

  // Prevent accidental drops outside dropzone
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}
```

#### uploadFiles()

Uploads files to the server via FormData with progress feedback.

```typescript
// src/features/client/modules/portal-files.ts
async function uploadFiles(files: File[], ctx: ClientPortalContext): Promise<void> {
  if (ctx.isDemo()) {
    alert('File upload not available in demo mode. Please log in to upload files.');
    return;
  }

  if (files.length > 5) {
    alert('Maximum 5 files allowed per upload.');
    return;
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  const oversizedFiles = files.filter((f) => f.size > maxSize);
  if (oversizedFiles.length > 0) {
    alert(`Some files exceed the 10MB limit: ${oversizedFiles.map((f) => f.name).join(', ')}`);
    return;
  }

  // Show upload progress in dropzone
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
      credentials: 'include', // HttpOnly cookie authentication
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
```

#### previewFile()

Opens files for preview in a new browser tab.

```typescript
// src/features/client/modules/portal-files.ts
function previewFile(fileId: number, mimetype: string, ctx: ClientPortalContext): void {
  if (ctx.isDemo()) {
    alert('Preview not available in demo mode. Please log in to preview files.');
    return;
  }

  // For images and PDFs, open in new tab
  if (mimetype.startsWith('image/') || mimetype === 'application/pdf') {
    const url = `${FILES_API_BASE}/file/${fileId}`;
    window.open(url, '_blank');
  } else {
    downloadFile(fileId, 'file', ctx);
  }
}
```

#### downloadFile()

Triggers file download.

```typescript
// src/features/client/modules/portal-files.ts
function downloadFile(fileId: number, filename: string, ctx: ClientPortalContext): void {
  if (ctx.isDemo()) {
    alert('Download not available in demo mode. Please log in to download files.');
    return;
  }

  const url = `${FILES_API_BASE}/file/${fileId}?download=true`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
```

#### deleteFile()

Deletes a file with confirmation dialog.

```typescript
// src/features/client/modules/portal-files.ts
async function deleteFile(
  fileId: number,
  filename: string,
  ctx: ClientPortalContext
): Promise<void> {
  if (ctx.isDemo()) {
    alert('Delete not available in demo mode. Please log in to delete files.');
    return;
  }

  if (!confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch(`${FILES_API_BASE}/file/${fileId}`, {
      method: 'DELETE',
      credentials: 'include' // HttpOnly cookie authentication
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete file');
    }

    // Remove from DOM
    const fileItem = document.querySelector(`.file-item[data-file-id="${fileId}"]`);
    if (fileItem) fileItem.remove();

    // Show "no files" message if list is now empty
    const filesContainer = document.querySelector('.files-list-section .file-item');
    if (!filesContainer) {
      const container = document.querySelector('.files-list-section');
      if (container) {
        const msgEl = document.createElement('p');
        msgEl.className = 'no-files';
        msgEl.textContent = 'No files uploaded yet. Drag and drop files above to upload.';
        container.appendChild(msgEl);
      }
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    alert(error instanceof Error ? error.message : 'Failed to delete file. Please try again.');
  }
}
```

### File Type Icons

```typescript
private getFileIcon(mimetype: string): string {
  const imageIcon = '<svg>...</svg>';  // Image icon SVG
  const pdfIcon = '<svg>...</svg>';    // PDF document icon SVG
  const docIcon = '<svg>...</svg>';    // Generic document icon SVG

  if (mimetype.startsWith('image/')) {
    return imageIcon;
  }
  if (mimetype === 'application/pdf') {
    return pdfIcon;
  }
  return docIcon;
}
```

### Utility Functions

The file module uses shared utilities:

```typescript
// Imported from shared utils
import { formatFileSize } from '../../../utils/format-utils';

// Context utilities from ClientPortalContext
ctx.escapeHtml(text)   // XSS protection
ctx.formatDate(date)   // Date formatting
ctx.isDemo()           // Demo mode check
```

#### formatFileSize (shared utility)

```typescript
// src/utils/format-utils.ts
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${size} ${sizes[i]}`;
}
```

---

## HTML Structure

### Files Tab

```html
<!-- templates/pages/client-portal.ejs:76-126 -->
<div class="tab-content" id="tab-files">
  <div class="page-header">
    <h2>Files</h2>
  </div>

  <!-- Upload Section -->
  <div class="files-upload-section cp-shadow">
    <h3>Upload Files</h3>
    <div class="upload-dropzone" id="upload-dropzone">
      <div class="dropzone-content">
        <svg><!-- Upload icon --></svg>
        <p>Drag and drop files here</p>
        <span class="dropzone-hint">or</span>
        <button type="button" class="btn btn-secondary" id="btn-browse-files">
          Browse Files
        </button>
      </div>
    </div>
    <input type="file" id="file-input" multiple hidden>
  </div>

  <!-- Files List -->
  <div class="files-list-section cp-shadow">
    <h3>Project Files</h3>
    <div class="files-filter">
      <select id="files-project-filter" class="form-select">
        <option value="all">All Projects</option>
      </select>
    </div>
    <div class="files-list" id="files-list">
      <!-- File items rendered dynamically -->
    </div>
  </div>
</div>
```

### File Item Component

```html
<div class="file-item" data-file-id="1">
  <div class="file-icon">
    <svg><!-- File type icon --></svg>
  </div>
  <div class="file-info">
    <span class="file-name">project-brief.pdf</span>
    <span class="file-meta">Website Redesign • Dec 1, 2025 • 2.4 MB</span>
  </div>
  <div class="file-actions">
    <button class="btn btn-outline btn-sm btn-preview">Preview</button>
    <button class="btn btn-outline btn-sm btn-download">Download</button>
  </div>
</div>
```

---

## Styling

### Upload Dropzone

```css
.upload-dropzone {
  border: 2px dashed var(--color-dark);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  transition: all 0.2s ease;
}

.upload-dropzone.drag-active {
  border-color: var(--color-primary);
  background: rgba(var(--color-primary-rgb), 0.1);
}
```

### File Item

```css
.file-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: 4px;
  margin-bottom: 0.5rem;
  transition: background 0.2s ease;
}

.file-item:hover {
  background: var(--color-neutral-200);
}

.file-icon {
  color: var(--color-dark);
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.file-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}
```

### Upload Success Message

```css
.upload-success-message {
  background: var(--color-primary);
  color: var(--color-dark);
  padding: 0.75rem 1rem;
  border: 2px solid var(--color-dark);
  margin-bottom: 1rem;
  font-weight: 600;
}
```

---

## Mobile Responsiveness

On mobile devices (screens under 768px), the Files section adapts for touch interaction:

### Mobile Layout Changes

- File items stack vertically instead of horizontal layout
- Drag & drop zone is hidden (not functional on touch devices)
- Only "Browse Files" button shown for uploads
- Trash icon only appears on client-uploaded files (admin files not deletable)
- File actions (preview/download) remain accessible

### Delete Permission Logic

Clients can only delete files they uploaded themselves. Admin-uploaded files show no delete option:

```typescript
// src/features/client/modules/portal-files.ts
const clientEmail = sessionStorage.getItem('clientEmail') || '';

// Check if current user can delete this file
const canDelete = file.uploadedBy === clientEmail || file.uploadedBy === 'client';
const deleteIcon = canDelete
  ? `<button class="file-delete-icon btn-delete" data-file-id="${file.id}"
       data-filename="${ctx.escapeHtml(file.originalName)}" aria-label="Delete file">
       ${trashIcon}
     </button>`
  : '';
```

### Mobile CSS

```css
@media (max-width: 768px) {
  /* Hide drag/drop zone on mobile */
  .upload-dropzone .dropzone-content p,
  .upload-dropzone .dropzone-hint {
    display: none;
  }

  /* Stack file items */
  .file-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .file-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
```

---

## File Locations

|File|Purpose|
|------|---------|
|`server/routes/uploads.ts`|Backend API endpoints|
|`src/features/client/modules/portal-files.ts`|Frontend file handling (~501 lines)|
|`src/styles/client-portal/files.css`|File section styling|
|`client/portal.html`|Files tab HTML (tab-files section)|

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [API Reference](../API_REFERENCE.md) - Complete API documentation
- [Settings](./SETTINGS.md) - Storage preferences
- [CSS Architecture](../design/CSS_ARCHITECTURE.md) - Styling system

---

## Phase 6: File Management Enhancement

**Status:** Complete
**Last Updated:** February 2, 2026

### Phase 6 Overview

The File Management Enhancement adds professional-grade file organization with versioning, folders, tags, access tracking, comments, archiving, expiration, locking, and comprehensive search capabilities comparable to Dropbox, Google Drive, and other industry leaders.

### New Features

#### File Versioning

- Upload new versions of existing files
- Automatic version numbering
- Version comments for change tracking
- Restore previous versions
- Version history with timestamps

#### Folder Organization

- Create folders within projects
- Nested folder support (subfolders)
- Custom folder colors and icons
- Move files between folders
- Move folders to new parents

#### File Tags

8 default file tags: Final, Draft, Review, Approved, Revision, Archive, Confidential, Client Provided

#### Access Tracking

- Log every file access (view/download/preview)
- Access count and download count
- User and IP tracking
- Access statistics

#### File Comments

- Comments on files with threading
- Internal (admin-only) comments
- Author tracking

#### Archiving & Expiration

- Archive/restore files
- Set expiration dates
- Auto-archive expired files

#### File Locking

- Lock files to prevent concurrent edits
- Track who locked and when
- Admin can force unlock

#### File Categories

7 categories: general, deliverable, source, asset, document, contract, invoice

### New Database Tables

```sql
-- File versions
CREATE TABLE IF NOT EXISTS file_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT,
  comment TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- File folders
CREATE TABLE IF NOT EXISTS file_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_folder_id INTEGER,
  color TEXT DEFAULT '#6b7280',
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- File tags junction
CREATE TABLE IF NOT EXISTS file_tags (
  file_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (file_id, tag_id)
);

-- File access log
CREATE TABLE IF NOT EXISTS file_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL,
  access_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- File comments
CREATE TABLE IF NOT EXISTS file_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  author_email TEXT NOT NULL,
  author_type TEXT NOT NULL,
  author_name TEXT,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  parent_comment_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### New API Endpoints

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/projects/files/:fileId/versions`|Get file versions|
|POST|`/api/projects/files/:fileId/versions`|Upload new version|
|POST|`/api/projects/files/:fileId/versions/:versionId/restore`|Restore version|
|GET|`/api/projects/:id/folders`|Get project folders|
|POST|`/api/projects/:id/folders`|Create folder|
|PUT|`/api/projects/folders/:folderId`|Update folder|
|DELETE|`/api/projects/folders/:folderId`|Delete folder|
|POST|`/api/projects/files/:fileId/move`|Move file to folder|
|POST|`/api/projects/folders/:folderId/move`|Move folder|
|GET|`/api/projects/files/:fileId/tags`|Get file tags|
|POST|`/api/projects/files/:fileId/tags/:tagId`|Add tag|
|DELETE|`/api/projects/files/:fileId/tags/:tagId`|Remove tag|
|POST|`/api/projects/files/:fileId/access`|Log file access|
|GET|`/api/projects/files/:fileId/access-log`|Get access log|
|GET|`/api/projects/files/:fileId/access-stats`|Get access stats|
|GET|`/api/projects/files/:fileId/comments`|Get comments|
|POST|`/api/projects/files/:fileId/comments`|Add comment|
|DELETE|`/api/projects/files/comments/:commentId`|Delete comment|
|POST|`/api/projects/files/:fileId/archive`|Archive file|
|POST|`/api/projects/files/:fileId/restore`|Restore file|
|GET|`/api/projects/:id/files/archived`|Get archived files|
|PUT|`/api/projects/files/:fileId/expiration`|Set expiration|
|GET|`/api/projects/files/expiring-soon`|Get expiring files|
|POST|`/api/projects/files/process-expired`|Process expired|
|POST|`/api/projects/files/:fileId/lock`|Lock file|
|POST|`/api/projects/files/:fileId/unlock`|Unlock file|
|PUT|`/api/projects/files/:fileId/category`|Set category|
|GET|`/api/projects/:id/files/by-category/:category`|Get by category|
|GET|`/api/projects/:id/files/stats`|Get file stats|
|GET|`/api/projects/:id/files/search`|Search files|

### Files Created

- `server/database/migrations/035_file_enhancements.sql` - Database migration
- `server/services/file-service.ts` - File service with all methods

### Files Modified

- `server/routes/projects.ts` - Added 30+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces

### Change Log

#### February 1, 2026 - Phase 6 Implementation

- Created database migration for file enhancement tables
- Implemented file-service.ts with versioning, folders, tags, access, comments, archiving, locking
- Added 30+ API endpoints to projects.ts
- Added TypeScript interfaces for all types
- Seeded 8 default file tags
