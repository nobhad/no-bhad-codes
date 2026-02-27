/**
 * FileUploadDropzone
 * Drag-and-drop file upload component for the client portal
 */

import * as React from 'react';
import { useState, useCallback, useRef } from 'react';
import { Upload, X, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';

// Allowed file types (matches server validation)
const ALLOWED_EXTENSIONS = /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar)$/i;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed',
  'application/vnd.rar',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

interface FileUploadDropzoneProps {
  /** Callback when files are ready to upload */
  onUpload: (files: File[]) => Promise<void>;
  /** Whether upload is in progress */
  isUploading?: boolean;
  /** Upload progress (0-100) */
  uploadProgress?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
}

type DropzoneState = 'idle' | 'drag-active' | 'uploading' | 'success' | 'error';

interface UploadError {
  message: string;
  files?: File[];
}

/**
 * Check if a file type is allowed
 */
function isAllowedFileType(file: File): boolean {
  const hasValidExtension = ALLOWED_EXTENSIONS.test(file.name);
  const hasValidMimeType = ALLOWED_MIME_TYPES.includes(file.type);
  return hasValidExtension || hasValidMimeType;
}

/**
 * Validate files for upload
 */
function validateFiles(files: File[]): { valid: File[]; errors: string[] } {
  const errors: string[] = [];
  let valid = files;

  // Check file count
  if (files.length > MAX_FILES) {
    errors.push(`Maximum ${MAX_FILES} files allowed per upload.`);
    valid = files.slice(0, MAX_FILES);
  }

  // Check file types
  const invalidTypes = valid.filter((f) => !isAllowedFileType(f));
  if (invalidTypes.length > 0) {
    errors.push(
      `Unsupported file type(s): ${invalidTypes.map((f) => f.name).join(', ')}. Allowed: images, PDF, Word docs, text, ZIP, RAR`
    );
    valid = valid.filter((f) => isAllowedFileType(f));
  }

  // Check file sizes
  const oversized = valid.filter((f) => f.size > MAX_FILE_SIZE);
  if (oversized.length > 0) {
    errors.push(`Some files exceed the 10MB limit: ${oversized.map((f) => f.name).join(', ')}`);
    valid = valid.filter((f) => f.size <= MAX_FILE_SIZE);
  }

  return { valid, errors };
}

/**
 * FileUploadDropzone Component
 */
export function FileUploadDropzone({
  onUpload,
  isUploading = false,
  uploadProgress = 0,
  disabled = false,
  className,
}: FileUploadDropzoneProps) {
  const [state, setState] = useState<DropzoneState>('idle');
  const [error, setError] = useState<UploadError | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update state when uploading prop changes
  React.useEffect(() => {
    if (isUploading) {
      setState('uploading');
    }
  }, [isUploading]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (disabled || files.length === 0) return;

      const { valid, errors } = validateFiles(files);

      if (errors.length > 0 && valid.length === 0) {
        setError({ message: errors.join(' '), files: [] });
        setState('error');
        return;
      }

      if (errors.length > 0) {
        setError({ message: errors.join(' '), files: valid });
        setState('error');
        return;
      }

      try {
        setState('uploading');
        setError(null);
        await onUpload(valid);
        setSuccessCount(valid.length);
        setState('success');

        // Reset to idle after success message
        setTimeout(() => {
          setState('idle');
          setSuccessCount(0);
        }, 3000);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : 'Upload failed',
          files: valid,
        });
        setState('error');
      }
    },
    [disabled, onUpload]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isUploading) {
        setState('drag-active');
      }
    },
    [disabled, isUploading]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isUploading) {
        setState('idle');
      }
    },
    [disabled, isUploading]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isUploading) return;

      setState('idle');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleFiles(Array.from(files));
      }
    },
    [disabled, isUploading, handleFiles]
  );

  const handleBrowseClick = useCallback(() => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, isUploading]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(Array.from(files));
        // Reset input
        e.target.value = '';
      }
    },
    [handleFiles]
  );

  const handleRetry = useCallback(() => {
    if (error?.files && error.files.length > 0) {
      handleFiles(error.files);
    }
  }, [error, handleFiles]);

  const handleDismiss = useCallback(() => {
    setError(null);
    setState('idle');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled && !isUploading) {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [disabled, isUploading]
  );

  // Render error state
  if (state === 'error' && error) {
    return (
      <div
        className={cn('tw-error', className)}
        role="alert"
        style={{ borderStyle: 'dashed', borderWidth: '2px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle className="tw-h-6 tw-w-6" />
          <p style={{ fontSize: '12px', textAlign: 'center' }}>{error.message}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {error.files && error.files.length > 0 && (
              <button className="tw-btn-secondary" onClick={handleRetry}>Try Again</button>
            )}
            <button className="tw-btn-ghost" onClick={handleDismiss}>Dismiss</button>
          </div>
        </div>
      </div>
    );
  }

  // Render uploading state
  if (state === 'uploading') {
    return (
      <div
        className={cn('tw-panel', className)}
        style={{ borderStyle: 'dashed', borderWidth: '2px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <RefreshCw className="tw-h-6 tw-w-6 tw-animate-spin" />
          <p className="tw-text-muted" style={{ fontSize: '12px' }}>Uploading files...</p>
          <div className="tw-progress-track" style={{ width: '100%', maxWidth: '16rem' }}>
            <div className="tw-progress-bar" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      </div>
    );
  }

  // Render success state
  if (state === 'success') {
    return (
      <div
        className={cn('tw-panel', className)}
        style={{ borderStyle: 'dashed', borderWidth: '2px', borderColor: 'var(--portal-text-light)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle className="tw-h-6 tw-w-6" />
          <p style={{ fontSize: '12px' }}>{successCount} file(s) uploaded successfully</p>
        </div>
      </div>
    );
  }

  // Render idle/drag-active state
  return (
    <div
      className={cn('tw-panel', className)}
      style={{
        borderStyle: 'dashed',
        borderWidth: '2px',
        borderColor: state === 'drag-active' ? 'var(--portal-text-light)' : 'var(--portal-border-color)',
        background: state === 'drag-active' ? 'var(--portal-bg-hover)' : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      onClick={handleBrowseClick}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-label="File upload dropzone - press Enter or Space to browse files, or drag and drop files here"
      aria-disabled={disabled}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        <Upload className={cn('tw-h-6 tw-w-6', state === 'drag-active' ? 'tw-text-primary' : 'tw-text-muted')} />
        <div style={{ textAlign: 'center' }}>
          <p className="tw-text-primary" style={{ fontSize: '12px' }}>
            Drag and drop files here or
          </p>
        </div>
        <button
          className="tw-btn-secondary"
          onClick={(e) => {
            e.stopPropagation();
            handleBrowseClick();
          }}
          disabled={disabled}
        >
          Browse Files
        </button>
        <p className="tw-text-muted" style={{ fontSize: '11px' }}>
          Max 5 files, 10MB each. Images, PDF, Word, ZIP accepted.
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        accept=".jpeg,.jpg,.png,.gif,.pdf,.doc,.docx,.txt,.zip,.rar,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip"
        onChange={handleFileInputChange}
        disabled={disabled}
      />
    </div>
  );
}
