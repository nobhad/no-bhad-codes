# File Management System

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

**Last Updated:** December 1, 2025

---

## Features

| Feature | Status | Description |
|---------|--------|-------------|
| Drag & Drop Upload | Complete | Intuitive file upload via drag and drop |
| Browse Files | Complete | Traditional file picker button |
| Multi-file Upload | Complete | Upload up to 5 files at once |
| File List from API | Complete | Dynamic file list from backend |
| Demo Mode | Complete | Fallback demo files when backend unavailable |
| File Preview | Complete | Open images/PDFs in new browser tab |
| File Download | Complete | Download files with original filename |
| File Icons | Complete | Visual file type identification |
| File Size Display | Complete | Human-readable file sizes |
| Upload Progress | Complete | Visual feedback during upload |
| Success Messages | Complete | Confirmation after successful upload |
| Access Control | Complete | Clients can only access their own files |
| Project Filtering | Planned | Filter files by project |

---

## Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | Express.js with TypeScript |
| File Storage | Multer middleware, local filesystem |
| Authentication | JWT tokens |
| Frontend | Vanilla TypeScript |
| API Communication | Fetch API |

### Data Flow

```
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

```
/api/uploads
```

### Endpoints

#### GET `/api/uploads/client`

Get all files for the authenticated client (across all their projects).

**Authentication:** Required (JWT Bearer token)

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

Location: `src/features/client/client-portal.ts`

### API Base URL

```typescript
private static readonly FILES_API_BASE = 'http://localhost:3001/api/uploads';
```

### Key Methods

#### loadFiles()

Fetches files from the API and renders the list.

```typescript
private async loadFiles(): Promise<void> {
  const filesContainer = document.getElementById('files-list');
  if (!filesContainer) return;

  filesContainer.innerHTML = '<p class="loading-files">Loading files...</p>';

  try {
    const token = localStorage.getItem('client_auth_token');

    // Use demo data if no token (demo mode)
    if (!token || token.startsWith('demo_token_')) {
      this.renderDemoFiles(filesContainer);
      return;
    }

    const response = await fetch(`${ClientPortalModule.FILES_API_BASE}/client`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }

    const data = await response.json();
    this.renderFilesList(filesContainer, data.files || []);
  } catch (error) {
    console.error('Error loading files:', error);
    this.renderDemoFiles(filesContainer);
  }
}
```

#### renderFilesList()

Renders the file list HTML with icons and action buttons.

```typescript
private renderFilesList(container: HTMLElement, files: any[]): void {
  if (files.length === 0) {
    container.innerHTML = '<p class="no-files">No files uploaded yet.</p>';
    return;
  }

  container.innerHTML = files.map((file) => `
    <div class="file-item" data-file-id="${file.id}">
      <div class="file-icon">${this.getFileIcon(file.mimetype)}</div>
      <div class="file-info">
        <span class="file-name">${this.escapeHtml(file.originalName)}</span>
        <span class="file-meta">
          ${file.projectName ? `${file.projectName} • ` : ''}
          ${this.formatDate(file.uploadedAt)} • ${this.formatFileSize(file.size)}
        </span>
      </div>
      <div class="file-actions">
        <button class="btn btn-sm btn-outline btn-preview"
                data-file-id="${file.id}"
                data-mimetype="${file.mimetype}">
          Preview
        </button>
        <button class="btn btn-sm btn-outline btn-download"
                data-file-id="${file.id}"
                data-filename="${this.escapeHtml(file.originalName)}">
          Download
        </button>
      </div>
    </div>
  `).join('');

  this.attachFileActionListeners(container);
}
```

#### setupFileUploadHandlers()

Sets up drag & drop and browse button functionality.

```typescript
private setupFileUploadHandlers(): void {
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const browseBtn = document.getElementById('btn-browse-files');

  if (!dropzone) return;

  // Browse button click
  if (browseBtn && fileInput) {
    browseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        this.uploadFiles(Array.from(fileInput.files));
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
      this.uploadFiles(Array.from(files));
    }
  });
}
```

#### uploadFiles()

Uploads files to the server via FormData.

```typescript
private async uploadFiles(files: File[]): Promise<void> {
  const token = localStorage.getItem('client_auth_token');

  if (!token || token.startsWith('demo_token_')) {
    alert('File upload not available in demo mode.');
    return;
  }

  if (files.length > 5) {
    alert('Maximum 5 files allowed per upload.');
    return;
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  const oversizedFiles = files.filter((f) => f.size > maxSize);
  if (oversizedFiles.length > 0) {
    alert(`Some files exceed the 10MB limit.`);
    return;
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(`${ClientPortalModule.FILES_API_BASE}/multiple`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (response.ok) {
    this.showUploadSuccess(files.length);
    await this.loadFiles();
  }
}
```

#### previewFile()

Opens files for preview in a new browser tab.

```typescript
private previewFile(fileId: number, mimetype: string): void {
  const token = localStorage.getItem('client_auth_token');

  if (!token || token.startsWith('demo_token_')) {
    alert('Preview not available in demo mode.');
    return;
  }

  // For images and PDFs, open in new tab
  if (mimetype.startsWith('image/') || mimetype === 'application/pdf') {
    const url = `${ClientPortalModule.FILES_API_BASE}/file/${fileId}`;
    window.open(url, '_blank');
  } else {
    this.downloadFile(fileId, 'file');
  }
}
```

#### downloadFile()

Triggers file download.

```typescript
private downloadFile(fileId: number, filename: string): void {
  const token = localStorage.getItem('client_auth_token');

  if (!token || token.startsWith('demo_token_')) {
    alert('Download not available in demo mode.');
    return;
  }

  const url = `${ClientPortalModule.FILES_API_BASE}/file/${fileId}?download=true`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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

```typescript
// Format file size in human-readable format
private formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${size} ${sizes[i]}`;
}

// Escape HTML to prevent XSS
private escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

## File Locations

| File | Purpose |
|------|---------|
| `server/routes/uploads.ts` | Backend API endpoints |
| `src/features/client/client-portal.ts:679-1075` | Frontend file handling |
| `src/styles/pages/client-portal.css:773-870` | File section styling |
| `templates/pages/client-portal.ejs:76-126` | Files tab HTML |

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [API Reference](../API_REFERENCE.md) - Complete API documentation
- [Settings](./SETTINGS.md) - Storage preferences
- [CSS Architecture](./CSS_ARCHITECTURE.md) - Styling system
