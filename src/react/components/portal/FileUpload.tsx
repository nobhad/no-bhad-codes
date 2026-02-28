import * as React from 'react';
import { useCallback, useState, useRef } from 'react';
import { Upload, X, File, AlertCircle } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_FILES = 5;

const DEFAULT_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed',
];

export interface FileUploadFile {
  file: File;
  id: string;
  preview?: string;
  error?: string;
}

export interface FileUploadProps {
  /** Callback when files are selected */
  onFilesSelected: (files: File[]) => void;
  /** Accepted MIME types */
  acceptedTypes?: string[];
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Maximum number of files */
  maxFiles?: number;
  /** Whether multiple files are allowed */
  multiple?: boolean;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Custom class name */
  className?: string;
  /** Dropzone text for desktop */
  dropzoneText?: string;
  /** Dropzone text for mobile */
  dropzoneTextMobile?: string;
}

/**
 * FileUpload
 * Drag-and-drop file upload component with validation
 * Uses existing portal CSS classes for styling
 */
export function FileUpload({
  onFilesSelected,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxSize = DEFAULT_MAX_SIZE,
  maxFiles = DEFAULT_MAX_FILES,
  multiple = true,
  disabled = false,
  loading = false,
  error,
  className,
  dropzoneText = 'Drag and drop files here, or click to browse',
  dropzoneTextMobile = 'Tap to select files',
}: FileUploadProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateFiles = useCallback(
    (files: FileList | File[]): { valid: File[]; errors: string[] } => {
      const valid: File[] = [];
      const errors: string[] = [];
      const fileArray = Array.from(files);

      if (fileArray.length > maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        return { valid, errors };
      }

      for (const file of fileArray) {
        if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
          errors.push(`${file.name}: File type not allowed`);
          continue;
        }

        if (file.size > maxSize) {
          const maxSizeMB = Math.round(maxSize / (1024 * 1024));
          errors.push(`${file.name}: File size exceeds ${maxSizeMB}MB limit`);
          continue;
        }

        valid.push(file);
      }

      return { valid, errors };
    },
    [acceptedTypes, maxSize, maxFiles]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      setValidationError(null);
      const { valid, errors } = validateFiles(files);

      if (errors.length > 0) {
        setValidationError(errors.join('. '));
      }

      if (valid.length > 0) {
        onFilesSelected(valid);
      }
    },
    [validateFiles, onFilesSelected]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled || loading) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [disabled, loading, handleFiles]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !loading) {
      inputRef.current?.click();
    }
  }, [disabled, loading]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
      // Reset input to allow selecting same file again
      e.target.value = '';
    },
    [handleFiles]
  );

  const displayError = error || validationError;

  return (
    <div ref={containerRef} className={cn('file-upload-container', className)}>
      <div
        className={cn(
          'upload-dropzone',
          isDragOver && 'dragover',
          disabled && 'disabled',
          loading && 'loading'
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-label="Upload files"
        aria-disabled={disabled}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          multiple={multiple}
          onChange={handleInputChange}
          disabled={disabled || loading}
          className="tw-sr-only"
          aria-hidden="true"
        />

        {loading ? (
          <div className="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <div className="tw-animate-spin">
              <Upload className="tw-h-8 tw-w-8" />
            </div>
            <p>Uploading...</p>
          </div>
        ) : (
          <div className="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <Upload className="tw-h-8 tw-w-8" />
            <p className="dropzone-desktop">{dropzoneText}</p>
            <p className="dropzone-mobile">{dropzoneTextMobile}</p>
            <span className="tw-text-sm tw-text-muted">
              Max {maxFiles} files, {Math.round(maxSize / (1024 * 1024))}MB each
            </span>
          </div>
        )}
      </div>

      {displayError && (
        <div className="tw-flex tw-items-center tw-gap-2 tw-mt-2 tw-text-sm tw-text-danger">
          <AlertCircle className="tw-h-4 tw-w-4 tw-flex-shrink-0" />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
}

export interface FileUploadProgressProps {
  /** File name */
  fileName: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Whether upload is complete */
  complete?: boolean;
  /** Whether upload failed */
  error?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Callback to cancel upload */
  onCancel?: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * FileUploadProgress
 * Shows upload progress for a single file
 */
export function FileUploadProgress({
  fileName,
  progress,
  complete = false,
  error = false,
  errorMessage,
  onCancel,
  className,
}: FileUploadProgressProps) {
  return (
    <div
      className={cn(
        'tw-flex tw-items-center tw-gap-3 tw-p-2 tw-border tw-border-white/20',
        error && 'tw-border-danger',
        complete && 'tw-border-success',
        className
      )}
    >
      <File className="tw-h-5 tw-w-5 tw-flex-shrink-0" />

      <div className="tw-flex-1 tw-min-w-0">
        <div className="tw-flex tw-justify-between tw-items-center tw-mb-1">
          <span className="tw-text-sm tw-truncate">{fileName}</span>
          {!complete && !error && (
            <span className="tw-text-xs tw-text-muted">{Math.round(progress)}%</span>
          )}
        </div>

        {!complete && !error && (
          <div className="tw-h-1 tw-bg-white/10 tw-overflow-hidden">
            <div
              className="tw-h-full tw-bg-primary tw-transition-all tw-duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {error && errorMessage && (
          <span className="tw-text-xs tw-text-danger">{errorMessage}</span>
        )}
      </div>

      {!complete && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="tw-p-1 tw-text-muted hover:tw-text-white tw-transition-colors"
          aria-label="Cancel upload"
        >
          <X className="tw-h-4 tw-w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * useFileUpload
 * Hook for managing file upload state
 */
export interface UseFileUploadOptions {
  /** Upload function */
  uploadFn: (files: File[]) => Promise<void>;
  /** Callback on successful upload */
  onSuccess?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

export interface UseFileUploadReturn {
  /** Whether upload is in progress */
  isUploading: boolean;
  /** Upload error message */
  error: string | null;
  /** Start upload */
  upload: (files: File[]) => Promise<void>;
  /** Clear error */
  clearError: () => void;
}

export function useFileUpload({
  uploadFn,
  onSuccess,
  onError,
}: UseFileUploadOptions): UseFileUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (files: File[]) => {
      setIsUploading(true);
      setError(null);

      try {
        await uploadFn(files);
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        onError?.(message);
      } finally {
        setIsUploading(false);
      }
    },
    [uploadFn, onSuccess, onError]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isUploading,
    error,
    upload,
    clearError,
  };
}
