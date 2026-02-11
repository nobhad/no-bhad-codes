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
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|txt|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  }
});
