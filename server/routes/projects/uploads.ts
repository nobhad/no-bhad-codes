import multer from 'multer';
import path from 'path';
import { getUploadsSubdir, UPLOAD_DIRS, sanitizeFilename } from '../../config/uploads.js';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getUploadsSubdir(UPLOAD_DIRS.PROJECTS));
  },
  filename: (_req, file, cb) => {
    const filename = sanitizeFilename(file.originalname);
    cb(null, filename);
  },
});

// MIME type to extension mapping for validation
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'text/plain': ['txt'],
  'application/zip': ['zip'],
  'application/x-rar-compressed': ['rar'],
};

// Allowed extensions whitelist
const ALLOWED_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'pdf',
  'doc',
  'docx',
  'txt',
  'zip',
  'rar',
]);

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    const fileName = file.originalname.toLowerCase();
    const fileExt = path.extname(fileName).slice(1); // Remove leading dot

    // Check for double extensions (e.g., file.jpg.exe)
    const parts = fileName.split('.');
    if (parts.length > 2) {
      // Check if any middle part is a known executable extension
      const dangerousExts = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js', 'msi', 'dll'];
      for (let i = 1; i < parts.length - 1; i++) {
        if (dangerousExts.includes(parts[i])) {
          return cb(new Error('Suspicious file extension detected'));
        }
      }
    }

    // Check if extension is allowed
    if (!ALLOWED_EXTENSIONS.has(fileExt)) {
      return cb(new Error(`File type not allowed: .${fileExt}`));
    }

    // Verify MIME type matches the extension
    const allowedExtensions = MIME_TO_EXTENSIONS[file.mimetype];
    if (!allowedExtensions) {
      return cb(new Error(`Unsupported MIME type: ${file.mimetype}`));
    }

    if (!allowedExtensions.includes(fileExt)) {
      return cb(new Error(`MIME type ${file.mimetype} does not match extension .${fileExt}`));
    }

    cb(null, true);
  },
});
