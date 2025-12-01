# File Management System

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Upload Section](#upload-section)
4. [File List](#file-list)
5. [Backend Integration](#backend-integration)
6. [Styling](#styling)
7. [File Locations](#file-locations)

---

## Overview

The File Management system allows clients to upload, view, and download project-related files. Files are organized by project and include metadata such as upload date and file size.

**Access:** Client Portal > Files tab

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
| File Icons | Visual file type identification |

---

## Upload Section

### Dropzone Component

```html
<div class="files-upload-section cp-shadow">
  <h3>Upload Files</h3>
  <div class="upload-dropzone" id="upload-dropzone">
    <p>Drag and drop files here or</p>
    <button class="btn btn-secondary" id="btn-browse-files">Browse Files</button>
    <input type="file" id="file-input" multiple hidden>
  </div>
</div>
```

### Drag & Drop Events

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

### File List Structure

```html
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
```

### File Item Component

```html
<div class="file-item">
  <span class="file-icon">
    <svg><!-- File type icon --></svg>
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

### File Type Icons

Different icons for different file types:

| Type | Icon |
|------|------|
| Document | File with lines |
| Image | Rectangle with mountain/circle |
| Archive | Folder with zipper |
| Code | File with brackets |

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

### Upload Handler

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

### File Storage

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
}

.file-icon {
  color: var(--color-dark);
}

.file-info {
  flex: 1;
}

.file-name {
  font-weight: 500;
  display: block;
}

.file-meta {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.file-actions {
  display: flex;
  gap: 0.5rem;
}
```

---

## File Locations

| File | Purpose |
|------|---------|
| `templates/pages/client-portal.ejs:77-126` | Files tab HTML |
| `src/features/client/client-portal.ts` | Upload event handlers |
| `src/styles/pages/client-portal.css` | File styling |
| `server/routes/uploads.ts` | Upload API endpoints |
| `server/middleware/upload.ts` | Multer configuration |

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [Settings](./SETTINGS.md) - Storage preferences
