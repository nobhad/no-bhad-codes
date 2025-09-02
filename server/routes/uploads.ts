/**
 * ===============================================
 * FILE UPLOAD ROUTES
 * ===============================================
 * @file server/routes/uploads.ts
 *
 * Handles file uploads with secure storage and validation
 */

import express from 'express';
import multer from 'multer';
import { resolve, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = resolve(process.cwd(), 'uploads');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create subdirectories based on file type
    let subDir = 'general';
    
    if (file.fieldname === 'avatar') {
      subDir = 'avatars';
    } else if (file.fieldname === 'project_file') {
      subDir = 'projects';
    } else if (file.fieldname === 'invoice_attachment') {
      subDir = 'invoices';
    } else if (file.fieldname === 'message_attachment') {
      subDir = 'messages';
    }
    
    const targetDir = resolve(uploadDir, subDir);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and original extension
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2);
    const ext = extname(file.originalname);
    const filename = `${timestamp}-${randomString}${ext}`;
    cb(null, filename);
  }
});

// File filter for security
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Define allowed file types
  const allowedTypes = {
    images: /\.(jpg|jpeg|png|gif|webp)$/i,
    documents: /\.(pdf|doc|docx|txt|md)$/i,
    spreadsheets: /\.(xls|xlsx|csv)$/i,
    presentations: /\.(ppt|pptx)$/i,
    archives: /\.(zip|rar|tar|gz)$/i,
    code: /\.(js|ts|html|css|json|xml)$/i
  };

  const fileName = file.originalname.toLowerCase();
  const isAllowed = Object.values(allowedTypes).some(regex => regex.test(fileName));

  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${extname(file.originalname)}`));
  }
};

// Configure multer with limits and validation
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  }
});

/**
 * @swagger
 * /api/uploads/single:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: Upload a single file
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *                 enum: [general, avatar, project_file, invoice_attachment, message_attachment]
 */
router.post('/single', 
  authenticateToken,
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        code: 'NO_FILE'
      });
    }

    const fileInfo = {
      id: Date.now().toString(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      url: `/uploads/${req.file.filename}`,
      uploadedBy: req.user?.id,
      uploadedAt: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      file: fileInfo
    });
  })
);

/**
 * @swagger
 * /api/uploads/multiple:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: Upload multiple files
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 */
router.post('/multiple',
  authenticateToken,
  upload.array('files', 5),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
        code: 'NO_FILES'
      });
    }

    const files = (req.files as Express.Multer.File[]).map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      url: `/uploads/${file.filename}`,
      uploadedBy: req.user?.id,
      uploadedAt: new Date().toISOString()
    }));

    res.status(201).json({
      success: true,
      message: `${files.length} files uploaded successfully`,
      files
    });
  })
);

/**
 * @swagger
 * /api/uploads/avatar:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: Upload user avatar
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 */
router.post('/avatar',
  authenticateToken,
  upload.single('avatar'),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'No avatar file uploaded',
        code: 'NO_AVATAR'
      });
    }

    // Validate that it's an image
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        error: 'Avatar must be an image file',
        code: 'INVALID_AVATAR_TYPE'
      });
    }

    const avatarInfo = {
      id: Date.now().toString(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/avatars/${req.file.filename}`,
      uploadedBy: req.user?.id,
      uploadedAt: new Date().toISOString()
    };

    // TODO: Update user avatar URL in database
    
    res.status(201).json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar: avatarInfo
    });
  })
);

/**
 * @swagger
 * /api/uploads/project/{projectId}:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: Upload files for a specific project
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               project_file:
 *                 type: string
 *                 format: binary
 */
router.post('/project/:projectId',
  authenticateToken,
  upload.single('project_file'),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return res.status(400).json({
        error: 'Invalid project ID',
        code: 'INVALID_PROJECT_ID'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No project file uploaded',
        code: 'NO_PROJECT_FILE'
      });
    }

    const projectFile = {
      id: Date.now().toString(),
      projectId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/projects/${req.file.filename}`,
      uploadedBy: req.user?.id,
      uploadedAt: new Date().toISOString()
    };

    // TODO: Save project file info to database

    res.status(201).json({
      success: true,
      message: 'Project file uploaded successfully',
      file: projectFile
    });
  })
);

/**
 * @swagger
 * /api/uploads/test:
 *   get:
 *     tags:
 *       - Uploads
 *     summary: Test upload system
 *     responses:
 *       200:
 *         description: Upload system is working
 */
router.get('/test', (req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    message: 'Upload system is operational',
    timestamp: new Date().toISOString(),
    uploadDir: uploadDir,
    limits: {
      fileSize: '10MB',
      maxFiles: 5
    },
    allowedTypes: [
      'Images: jpg, jpeg, png, gif, webp',
      'Documents: pdf, doc, docx, txt, md',
      'Spreadsheets: xls, xlsx, csv',
      'Presentations: ppt, pptx',
      'Archives: zip, rar, tar, gz',
      'Code: js, ts, html, css, json, xml'
    ]
  });
});

// Error handler for multer
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        message: 'File size cannot exceed 10MB'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        code: 'TOO_MANY_FILES',
        message: 'Cannot upload more than 5 files at once'
      });
    }
    
    return res.status(400).json({
      error: 'Upload error',
      code: 'UPLOAD_ERROR',
      message: error.message
    });
  }
  
  if (error.message.includes('File type not allowed')) {
    return res.status(400).json({
      error: 'File type not allowed',
      code: 'INVALID_FILE_TYPE',
      message: error.message
    });
  }
  
  next(error);
});

export { router as uploadsRouter };
export default router;