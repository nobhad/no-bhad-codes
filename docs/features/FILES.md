# File Management System

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [HTML Structure](#html-structure)
4. [Upload Section](#upload-section)
5. [File List](#file-list)
6. [TypeScript Implementation](#typescript-implementation)
7. [Backend Integration](#backend-integration)
8. [Styling](#styling)
9. [File Locations](#file-locations)

---

## Overview

The File Management system allows clients to upload, view, and download project-related files. Files are organized by project and include metadata such as upload date and file size.

**Access:** Client Portal > Files tab (`tab-files`)

---

## Features

| Feature | Description |
|---------|-------------|
| Drag & Drop Upload | Intuitive file upload via drag and drop |
| Browse Files | Traditional file picker button |
| Multi-file Upload | Upload multiple files at once |
| Project Filtering | Filter files by project |
| File Preview | Preview supported file types |
| File Download | Download individual files |
| File Icons | Visual file type identification (document, image) |

---

## HTML Structure

### Complete Files Tab

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
            <p>Drag and drop files here or</p>
            <button class="btn btn-secondary" id="btn-browse-files">Browse Files</button>
            <input type="file" id="file-input" multiple hidden>
        </div>
    </div>

    <!-- Files List -->
    <div class="files-list-section cp-shadow">
        <h3>Project Files</h3>
        <div class="files-filter">
            <select id="files-project-filter" class="form-select">
                <option value="all">All Projects</option>
                <option value="project-1">Your Website Project</option>
            </select>
        </div>
        <div class="files-list" id="files-list">
            <!-- File items rendered here -->
        </div>
    </div>
</div>
```

---

## Upload Section

### Dropzone Component

```html
<!-- templates/pages/client-portal.ejs:82-90 -->
<div class="files-upload-section cp-shadow">
    <h3>Upload Files</h3>
    <div class="upload-dropzone" id="upload-dropzone">
        <p>Drag and drop files here or</p>
        <button class="btn btn-secondary" id="btn-browse-files">Browse Files</button>
        <input type="file" id="file-input" multiple hidden>
    </div>
</div>
```

### Element IDs

| Element | ID | Purpose |
|---------|-----|---------|
| Dropzone | `upload-dropzone` | Drag and drop target area |
| Browse Button | `btn-browse-files` | Opens file picker |
| File Input | `file-input` | Hidden file input element |

### Drag & Drop Events (Planned)

```typescript
const dropzone = document.getElementById('upload-dropzone');

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag-active');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('drag-active');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-active');
  const files = e.dataTransfer?.files;
  if (files) {
    handleFileUpload(files);
  }
});
```

### Supported File Types

| Category | Extensions |
|----------|------------|
| Documents | PDF, DOC, DOCX, TXT |
| Images | PNG, JPG, JPEG, GIF, SVG, WEBP |
| Design | PSD, AI, SKETCH, FIG |
| Archives | ZIP, RAR, 7Z |
| Code | HTML, CSS, JS, TS, JSON |

---

## File List

### File List Container

```html
<!-- templates/pages/client-portal.ejs:92-125 -->
<div class="files-list-section cp-shadow">
    <h3>Project Files</h3>
    <div class="files-filter">
        <select id="files-project-filter" class="form-select">
            <option value="all">All Projects</option>
            <option value="project-1">Your Website Project</option>
        </select>
    </div>
    <div class="files-list" id="files-list">
        <!-- File items -->
    </div>
</div>
```

### File Item Component - Document

```html
<!-- templates/pages/client-portal.ejs:102-112 -->
<div class="file-item">
    <span class="file-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
    </span>
    <div class="file-info">
        <span class="file-name">project-brief.pdf</span>
        <span class="file-meta">Uploaded Nov 28, 2025 - 2.4 MB</span>
    </div>
    <div class="file-actions">
        <button class="btn btn-outline btn-sm">Preview</button>
        <button class="btn btn-outline btn-sm">Download</button>
    </div>
</div>
```

### File Item Component - Image

```html
<!-- templates/pages/client-portal.ejs:113-123 -->
<div class="file-item">
    <span class="file-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
    </span>
    <div class="file-info">
        <span class="file-name">logo-v1.png</span>
        <span class="file-meta">Uploaded Nov 29, 2025 - 156 KB</span>
    </div>
    <div class="file-actions">
        <button class="btn btn-outline btn-sm">Preview</button>
        <button class="btn btn-outline btn-sm">Download</button>
    </div>
</div>
```

### File Type Icons

| Type | Icon | SVG Path |
|------|------|----------|
| Document | File with lines | `d="M14 2H6a2 2 0 0 0-2 2v16..."` |
| Image | Rectangle with mountain/circle | `<rect>...<circle>...<polyline>` |
| Archive | Folder with zipper | (to be implemented) |
| Code | File with brackets | (to be implemented) |

---

## TypeScript Implementation

### Load Files Function

```typescript
// src/features/client/client-portal.ts:637-651
private loadFiles(): void {
  if (!this.currentProject) return;

  const filesContainer = document.getElementById('files-grid');
  if (!filesContainer) return;

  if (this.currentProject.files.length === 0) {
    filesContainer.innerHTML = '<p class="no-files">No files available yet.</p>';
    return;
  }

  // Populate files when available
  filesContainer.innerHTML = '';
  // Implementation for files display will be added later
}
```

### File Data Interface

```typescript
interface ProjectFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}
```

---

## Backend Integration

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/uploads` | POST | Upload file(s) |
| `/api/uploads` | GET | List files for project |
| `/api/uploads/:id` | GET | Download file |
| `/api/uploads/:id` | DELETE | Delete file |
| `/api/uploads/:id/preview` | GET | Get file preview |

### Upload Handler (Planned)

```typescript
// server/routes/uploads.ts
router.post('/',
  authenticateToken,
  upload.array('files', 10), // Max 10 files
  asyncHandler(async (req, res) => {
    const files = req.files as Express.Multer.File[];
    const projectId = req.body.project_id;

    const uploadedFiles = await Promise.all(
      files.map(file => FileService.saveFile(file, projectId, req.user.id))
    );

    res.status(201).json({ files: uploadedFiles });
  })
);
```

### Database Schema

```sql
CREATE TABLE uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### File Storage Structure

Files are stored in the `uploads/` directory with unique filenames:

```
uploads/
├── projects/
│   ├── {project_id}/
│   │   ├── {uuid}-original-filename.pdf
│   │   └── {uuid}-logo.png
```

---

## Styling

### Upload Section

```css
.files-upload-section {
  background: var(--color-neutral-100);
  border: 4px solid #000000;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.files-upload-section h3 {
  margin-bottom: 1rem;
  color: var(--color-dark);
}
```

### Upload Dropzone

```css
.upload-dropzone {
  border: 2px dashed var(--color-dark);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  transition: all 0.2s ease;
}

.upload-dropzone p {
  margin-bottom: 1rem;
  color: var(--color-text-muted);
}

.upload-dropzone.drag-active {
  border-color: var(--color-primary);
  background: rgba(var(--color-primary-rgb), 0.1);
}
```

### Files List Section

```css
.files-list-section {
  background: var(--color-neutral-100);
  border: 4px solid #000000;
  padding: 1.5rem;
}

.files-list-section h3 {
  margin-bottom: 1rem;
  color: var(--color-dark);
}
```

### Files Filter

```css
.files-filter {
  margin-bottom: 1rem;
}

.files-filter .form-select {
  max-width: 300px;
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
```

### File Icon

```css
.file-icon {
  color: var(--color-dark);
  flex-shrink: 0;
}

.file-icon svg {
  width: 24px;
  height: 24px;
}
```

### File Info

```css
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
```

### File Actions

```css
.file-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.file-actions .btn-sm {
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
}
```

---

## File Locations

| File | Lines | Purpose |
|------|-------|---------|
| `templates/pages/client-portal.ejs` | 76-126 | Files tab HTML |
| `src/features/client/client-portal.ts` | 637-651 | Load files function |
| `src/styles/pages/client-portal.css` | - | Files styling |
| `server/routes/uploads.ts` | - | Upload API endpoints |
| `server/middleware/upload.ts` | - | Multer configuration |

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [Settings](./SETTINGS.md) - Storage preferences
- [CSS Architecture](./CSS_ARCHITECTURE.md) - Styling system
