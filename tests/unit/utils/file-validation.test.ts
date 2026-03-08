/**
 * ===============================================
 * FILE VALIDATION TESTS
 * ===============================================
 * @file tests/unit/utils/file-validation.test.ts
 *
 * Unit tests for file validation utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  hasAllowedExtension,
  hasAllowedMimeType,
  isWithinSizeLimit,
  validateFileUpload,
  validateFilesUpload,
  getAllowedExtensionsDisplay,
  getFileExtension,
  getFileCategory,
  getFileTypeLabel,
  isImageFile,
  isPdfFile,
  canPreviewInBrowser,
  MAX_FILE_SIZE
} from '../../../src/utils/file-validation';

// ============================================
// Helpers
// ============================================

/**
 * Build a minimal mock File. The File constructor in jsdom accepts content as an
 * array, so the .size property is derived from the byte length of that content.
 * For size-specific tests we override the property explicitly.
 */
function makeFile(name: string, type: string, sizeBytes?: number): File {
  // Create a file with enough content to hit the requested size, or use a small
  // placeholder when the exact size is not load-bearing.
  const content = sizeBytes !== undefined
    ? new Uint8Array(sizeBytes)
    : new Uint8Array(8);
  return new File([content], name, { type });
}

// ============================================
// hasAllowedExtension
// ============================================

describe('hasAllowedExtension', () => {
  it('returns true for .jpg', () => {
    expect(hasAllowedExtension('photo.jpg')).toBe(true);
  });

  it('returns true for .jpeg', () => {
    expect(hasAllowedExtension('image.jpeg')).toBe(true);
  });

  it('returns true for .png', () => {
    expect(hasAllowedExtension('image.png')).toBe(true);
  });

  it('returns true for .pdf', () => {
    expect(hasAllowedExtension('doc.pdf')).toBe(true);
  });

  it('returns true for .csv', () => {
    expect(hasAllowedExtension('data.csv')).toBe(true);
  });

  it('returns true for .xls', () => {
    expect(hasAllowedExtension('sheet.xls')).toBe(true);
  });

  it('returns true for .xlsx', () => {
    expect(hasAllowedExtension('sheet.xlsx')).toBe(true);
  });

  it('returns true for .docx', () => {
    expect(hasAllowedExtension('doc.docx')).toBe(true);
  });

  it('returns true for .zip', () => {
    expect(hasAllowedExtension('archive.zip')).toBe(true);
  });

  it('returns true for uppercase extension (case insensitive)', () => {
    expect(hasAllowedExtension('PHOTO.JPG')).toBe(true);
  });

  it('returns false for .exe', () => {
    expect(hasAllowedExtension('file.exe')).toBe(false);
  });

  it('returns false for .sh', () => {
    expect(hasAllowedExtension('script.sh')).toBe(false);
  });

  it('returns false for a file with no extension', () => {
    expect(hasAllowedExtension('noextension')).toBe(false);
  });
});

// ============================================
// hasAllowedMimeType
// ============================================

describe('hasAllowedMimeType', () => {
  it('returns true for image/jpeg', () => {
    expect(hasAllowedMimeType('image/jpeg')).toBe(true);
  });

  it('returns true for image/png', () => {
    expect(hasAllowedMimeType('image/png')).toBe(true);
  });

  it('returns true for application/pdf', () => {
    expect(hasAllowedMimeType('application/pdf')).toBe(true);
  });

  it('returns true for text/csv', () => {
    expect(hasAllowedMimeType('text/csv')).toBe(true);
  });

  it('returns true for application/zip', () => {
    expect(hasAllowedMimeType('application/zip')).toBe(true);
  });

  it('returns true for image/gif', () => {
    expect(hasAllowedMimeType('image/gif')).toBe(true);
  });

  it('returns false for application/x-executable', () => {
    expect(hasAllowedMimeType('application/x-executable')).toBe(false);
  });

  it('returns false for text/javascript', () => {
    expect(hasAllowedMimeType('text/javascript')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(hasAllowedMimeType('')).toBe(false);
  });
});

// ============================================
// isWithinSizeLimit
// ============================================

describe('isWithinSizeLimit', () => {
  it('returns true for 0 bytes', () => {
    expect(isWithinSizeLimit(0)).toBe(true);
  });

  it('returns true for 1024 bytes (1 KB)', () => {
    expect(isWithinSizeLimit(1024)).toBe(true);
  });

  it('returns true for exactly 10 MB (the limit)', () => {
    expect(isWithinSizeLimit(MAX_FILE_SIZE)).toBe(true);
  });

  it('returns false for one byte over 10 MB', () => {
    expect(isWithinSizeLimit(MAX_FILE_SIZE + 1)).toBe(false);
  });

  it('returns false for a very large file', () => {
    expect(isWithinSizeLimit(100 * 1024 * 1024)).toBe(false);
  });
});

// ============================================
// validateFileUpload
// ============================================

describe('validateFileUpload', () => {
  it('returns valid:true for a valid JPEG file within size limit', () => {
    const file = makeFile('photo.jpg', 'image/jpeg', 1024);
    const result = validateFileUpload(file);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns valid:true for a valid PDF file', () => {
    const file = makeFile('document.pdf', 'application/pdf', 512);
    expect(validateFileUpload(file).valid).toBe(true);
  });

  it('returns valid:false with "File type not allowed" for .exe extension', () => {
    const file = makeFile('malware.exe', 'application/x-msdownload', 100);
    const result = validateFileUpload(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('File type not allowed');
  });

  it('returns valid:false with "Invalid file format" for an invalid MIME type', () => {
    // Extension is allowed but MIME type is not
    const file = makeFile('photo.jpg', 'application/x-executable', 100);
    const result = validateFileUpload(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid file format');
  });

  it('returns valid:false with size error message for a file exceeding 10MB', () => {
    const file = makeFile('huge.pdf', 'application/pdf', MAX_FILE_SIZE + 1);
    const result = validateFileUpload(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('10MB');
  });

  it('checks extension before MIME type (fails on extension first)', () => {
    // Both extension and MIME are wrong — should fail with extension error
    const file = makeFile('bad.exe', 'application/x-executable', 100);
    const result = validateFileUpload(file);
    expect(result.error).toContain('File type not allowed');
  });
});

// ============================================
// validateFilesUpload
// ============================================

describe('validateFilesUpload', () => {
  it('returns valid:true for an empty array', () => {
    expect(validateFilesUpload([]).valid).toBe(true);
  });

  it('returns valid:true when all files are valid', () => {
    const files = [
      makeFile('photo.jpg', 'image/jpeg', 500),
      makeFile('doc.pdf', 'application/pdf', 1000)
    ];
    expect(validateFilesUpload(files).valid).toBe(true);
  });

  it('returns valid:false and includes filename when one file is invalid', () => {
    const files = [
      makeFile('photo.jpg', 'image/jpeg', 500),
      makeFile('bad.exe', 'application/x-msdownload', 100)
    ];
    const result = validateFilesUpload(files);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('bad.exe');
  });

  it('reports the first invalid file when multiple files are invalid', () => {
    const files = [
      makeFile('first-bad.exe', 'application/x-msdownload', 100),
      makeFile('second-bad.exe', 'application/x-msdownload', 100)
    ];
    const result = validateFilesUpload(files);
    expect(result.error).toContain('first-bad.exe');
  });
});

// ============================================
// getAllowedExtensionsDisplay
// ============================================

describe('getAllowedExtensionsDisplay', () => {
  it('returns a string containing JPEG', () => {
    expect(getAllowedExtensionsDisplay()).toContain('JPEG');
  });

  it('returns a string containing PNG', () => {
    expect(getAllowedExtensionsDisplay()).toContain('PNG');
  });

  it('returns a string containing PDF', () => {
    expect(getAllowedExtensionsDisplay()).toContain('PDF');
  });

  it('returns a non-empty string', () => {
    expect(getAllowedExtensionsDisplay().length).toBeGreaterThan(0);
  });
});

// ============================================
// getFileExtension
// ============================================

describe('getFileExtension', () => {
  it('returns "jpg" for "photo.jpg"', () => {
    expect(getFileExtension('photo.jpg')).toBe('jpg');
  });

  it('returns "pdf" for "doc.PDF" (lowercased)', () => {
    expect(getFileExtension('doc.PDF')).toBe('pdf');
  });

  it('returns empty string for a filename with no extension', () => {
    expect(getFileExtension('noext')).toBe('');
  });

  it('returns the last extension for a multi-part filename', () => {
    expect(getFileExtension('multi.part.ts')).toBe('ts');
  });

  it('returns "png" for "IMAGE.PNG" (lowercased)', () => {
    expect(getFileExtension('IMAGE.PNG')).toBe('png');
  });
});

// ============================================
// getFileCategory
// ============================================

describe('getFileCategory', () => {
  it('returns "images" for .jpg', () => {
    expect(getFileCategory('photo.jpg')).toBe('images');
  });

  it('returns "images" for .jpeg', () => {
    expect(getFileCategory('photo.jpeg')).toBe('images');
  });

  it('returns "images" for .png', () => {
    expect(getFileCategory('photo.png')).toBe('images');
  });

  it('returns "documents" for .pdf', () => {
    expect(getFileCategory('doc.pdf')).toBe('documents');
  });

  it('returns "documents" for .docx', () => {
    expect(getFileCategory('doc.docx')).toBe('documents');
  });

  it('returns "spreadsheets" for .xlsx', () => {
    expect(getFileCategory('data.xlsx')).toBe('spreadsheets');
  });

  it('returns "spreadsheets" for .csv', () => {
    expect(getFileCategory('data.csv')).toBe('spreadsheets');
  });

  it('returns "presentations" for .pptx', () => {
    expect(getFileCategory('slides.pptx')).toBe('presentations');
  });

  it('returns "presentations" for .ppt', () => {
    expect(getFileCategory('slides.ppt')).toBe('presentations');
  });

  it('returns "archives" for .zip', () => {
    expect(getFileCategory('archive.zip')).toBe('archives');
  });

  it('returns "archives" for .rar', () => {
    expect(getFileCategory('archive.rar')).toBe('archives');
  });

  it('returns "other" for an unrecognised extension', () => {
    expect(getFileCategory('file.exe')).toBe('other');
  });

  it('returns "other" for a file with no extension', () => {
    expect(getFileCategory('noextension')).toBe('other');
  });
});

// ============================================
// getFileTypeLabel
// ============================================

describe('getFileTypeLabel', () => {
  it('returns "JPG" for "photo.jpg"', () => {
    expect(getFileTypeLabel('photo.jpg')).toBe('JPG');
  });

  it('returns "PDF" for "file.pdf"', () => {
    expect(getFileTypeLabel('file.pdf')).toBe('PDF');
  });

  it('returns "PNG" for "image.png"', () => {
    expect(getFileTypeLabel('image.png')).toBe('PNG');
  });

  it('returns "File" for a filename with no extension', () => {
    expect(getFileTypeLabel('noext')).toBe('File');
  });

  it('returns an uppercase label regardless of input case', () => {
    expect(getFileTypeLabel('doc.Pdf')).toBe('PDF');
  });
});

// ============================================
// isImageFile
// ============================================

describe('isImageFile', () => {
  it('returns true for .jpg', () => {
    expect(isImageFile('photo.jpg')).toBe(true);
  });

  it('returns true for .jpeg', () => {
    expect(isImageFile('photo.jpeg')).toBe(true);
  });

  it('returns true for .png', () => {
    expect(isImageFile('photo.png')).toBe(true);
  });

  it('returns true for .gif', () => {
    expect(isImageFile('animation.gif')).toBe(true);
  });

  it('returns false for .pdf', () => {
    expect(isImageFile('doc.pdf')).toBe(false);
  });

  it('returns false for .docx', () => {
    expect(isImageFile('document.docx')).toBe(false);
  });

  it('returns false for a filename with no extension', () => {
    expect(isImageFile('noext')).toBe(false);
  });
});

// ============================================
// isPdfFile
// ============================================

describe('isPdfFile', () => {
  it('returns true for .pdf', () => {
    expect(isPdfFile('doc.pdf')).toBe(true);
  });

  it('returns true for uppercase .PDF', () => {
    expect(isPdfFile('doc.PDF')).toBe(true);
  });

  it('returns false for .jpg', () => {
    expect(isPdfFile('photo.jpg')).toBe(false);
  });

  it('returns false for .docx', () => {
    expect(isPdfFile('document.docx')).toBe(false);
  });

  it('returns false for a file with no extension', () => {
    expect(isPdfFile('noext')).toBe(false);
  });
});

// ============================================
// canPreviewInBrowser
// ============================================

describe('canPreviewInBrowser', () => {
  it('returns true for a JPEG image', () => {
    expect(canPreviewInBrowser('photo.jpg')).toBe(true);
  });

  it('returns true for a PNG image', () => {
    expect(canPreviewInBrowser('photo.png')).toBe(true);
  });

  it('returns true for a PDF', () => {
    expect(canPreviewInBrowser('doc.pdf')).toBe(true);
  });

  it('returns false for a spreadsheet', () => {
    expect(canPreviewInBrowser('data.xlsx')).toBe(false);
  });

  it('returns false for a Word document', () => {
    expect(canPreviewInBrowser('doc.docx')).toBe(false);
  });

  it('returns false for a ZIP archive', () => {
    expect(canPreviewInBrowser('archive.zip')).toBe(false);
  });

  it('returns false for a file with no extension', () => {
    expect(canPreviewInBrowser('noext')).toBe(false);
  });
});
