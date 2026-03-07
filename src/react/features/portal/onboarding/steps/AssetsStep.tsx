/**
 * AssetsStep
 * Step 4: Upload assets and files
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { useCallback, useState } from 'react';
import { Upload, X, Image, FileText, FolderOpen } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { Checkbox } from '@react/components/ui/checkbox';
import type { StepProps, AssetData, UploadedFile } from '../types';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/svg+xml',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip'
];

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get icon for file type
 */
function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image;
  return FileText;
}

/**
 * AssetsStep Component
 */
export function AssetsStep({ data, onUpdate, errors: _errors }: StepProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const assets = data.assets || {
    files: [],
    logoProvided: false,
    existingAssets: '',
    contentAccess: ''
  };

  const handleChange = (field: keyof AssetData, value: UploadedFile[] | boolean | string) => {
    onUpdate({
      assets: {
        ...assets,
        [field]: value
      }
    });
  };

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      setUploadError(null);

      const newFiles: UploadedFile[] = [];
      const errors: string[] = [];

      Array.from(files).forEach((file) => {
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name} is too large (max 25MB)`);
          return;
        }

        // Validate file type
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
          errors.push(`${file.name} is not a supported file type`);
          return;
        }

        newFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString()
        });
      });

      if (errors.length > 0) {
        setUploadError(errors.join(', '));
      }

      if (newFiles.length > 0) {
        handleChange('files', [...assets.files, ...newFiles]);
      }
    },
    [assets.files, handleChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleRemoveFile = (fileId: string) => {
    handleChange(
      'files',
      assets.files.filter((f) => f.id !== fileId)
    );
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div ref={containerRef} className="tw-section">
      {/* Section Header */}
      <div className="tw-mb-4">
        <h3 className="heading tw-text-lg">
          Upload Assets
        </h3>
        <p className="text-muted tw-text-sm tw-mt-1">
          Share any files, logos, or resources for your project.
        </p>
      </div>

      {/* Drag & Drop Zone - Brutalist */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'tw-relative tw-flex tw-flex-col tw-items-center tw-justify-center',
          'tw-py-8 tw-px-4',
          'tw-border-2 tw-border-dashed tw-transition-colors tw-duration-200',
          isDragging
            ? 'tw-border-primary tw-bg-[var(--portal-bg-hover)]'
            : 'tw-border-[var(--portal-border-color)] hover:tw-border-primary'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_FILE_TYPES.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="tw-hidden"
        />

        <Upload
          className={cn(
            'tw-h-8 tw-w-8 tw-mb-3',
            isDragging ? 'tw-text-primary' : 'text-muted'
          )}
        />

        <p className="tw-text-sm tw-text-primary tw-font-mono tw-mb-1">
          Drag and drop files here
        </p>
        <p className="tw-text-xs text-muted tw-mb-3">
          or click to browse
        </p>

        <button type="button" className="btn-secondary" onClick={handleBrowseClick}>
          Browse Files
        </button>

        <p className="tw-text-xs text-muted tw-mt-3">
          Max 25MB per file. Supports images, PDFs, and documents.
        </p>
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div className="error-state tw-mt-4">
          {uploadError}
        </div>
      )}

      {/* Uploaded Files List */}
      {assets.files.length > 0 && (
        <div className="tw-flex tw-flex-col tw-gap-2 tw-mt-4">
          <label className="label tw-flex tw-items-center tw-gap-1">
            <FolderOpen className="icon-xs" />
            Uploaded Files ({assets.files.length})
          </label>
          <div className="tw-flex tw-flex-col tw-gap-1">
            {assets.files.map((file) => {
              const FileIcon = getFileIcon(file.type);
              return (
                <div
                  key={file.id}
                  className="tw-list-item"
                >
                  <FileIcon className="icon-sm text-muted tw-flex-shrink-0" />
                  <div className="tw-flex-1 tw-min-w-0">
                    <p className="tw-text-sm tw-text-primary tw-font-mono tw-truncate">
                      {file.name}
                    </p>
                    <p className="tw-text-xs text-muted">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(file.id)}
                    className="icon-btn"
                    title="Remove file"
                  >
                    <X className="icon-xs" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Logo Checkbox */}
      <div className="tw-mt-6">
        <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-px-3 tw-py-2 tw-border tw-border-[var(--portal-border-color)] tw-w-fit">
          <Checkbox
            checked={assets.logoProvided}
            onCheckedChange={(checked) => handleChange('logoProvided', checked === true)}
          />
          <span className="tw-text-sm tw-font-mono">
            Logo included in uploaded files
          </span>
        </label>
      </div>

      <div className="tw-divider" />

      {/* Additional Asset Information */}
      <div className="tw-mb-4">
        <h3 className="heading tw-text-lg">
          Additional Resources
        </h3>
        <p className="text-muted tw-text-sm tw-mt-1">
          Tell us about any other assets or content access we may need.
        </p>
      </div>

      {/* Existing Assets */}
      <div className="tw-flex tw-flex-col tw-gap-1">
        <label className="field-label">Existing Assets</label>
        <textarea
          value={assets.existingAssets}
          onChange={(e) => handleChange('existingAssets', e.target.value)}
          placeholder="Do you have existing assets like photography, icons, or illustrations? Where can we access them?"
          rows={2}
          className="tw-textarea"
        />
      </div>

      {/* Content Access */}
      <div className="tw-flex tw-flex-col tw-gap-1 tw-mt-4">
        <label className="field-label">Content & Access Details</label>
        <textarea
          value={assets.contentAccess}
          onChange={(e) => handleChange('contentAccess', e.target.value)}
          placeholder="Any login credentials, API keys, or access details we'll need? (You can also share these securely later)"
          rows={2}
          className="tw-textarea"
        />
        <span className="tw-text-xs text-muted">
          Never share passwords directly. We'll provide a secure way to share credentials if needed.
        </span>
      </div>
    </div>
  );
}
