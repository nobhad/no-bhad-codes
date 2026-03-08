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
    <div ref={containerRef} className="section">
      {/* Section Header */}
      <div className="mb-4">
        <h3 className="heading text-lg">
          Upload Assets
        </h3>
        <p className="text-muted text-sm mt-1">
          Share any files, logos, or resources for your project.
        </p>
      </div>

      {/* Drag & Drop Zone - Brutalist */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center',
          'py-8 px-4',
          'border-2 border-dashed transition-colors duration-200',
          isDragging
            ? 'border-primary bg-[var(--portal-bg-hover)]'
            : 'border-[var(--portal-border-color)] hover:border-primary'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_FILE_TYPES.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        <Upload
          className={cn(
            'h-8 w-8 mb-3',
            isDragging ? 'text-primary' : 'text-muted'
          )}
        />

        <p className="text-sm text-primary font-mono mb-1">
          Drag and drop files here
        </p>
        <p className="text-xs text-muted mb-3">
          or click to browse
        </p>

        <button type="button" className="btn-secondary" onClick={handleBrowseClick}>
          Browse Files
        </button>

        <p className="text-xs text-muted mt-3">
          Max 25MB per file. Supports images, PDFs, and documents.
        </p>
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div className="error-state mt-4">
          {uploadError}
        </div>
      )}

      {/* Uploaded Files List */}
      {assets.files.length > 0 && (
        <div className="flex flex-col gap-2 mt-4">
          <label className="label flex items-center gap-1">
            <FolderOpen className="icon-xs" />
            Uploaded Files ({assets.files.length})
          </label>
          <div className="flex flex-col gap-1">
            {assets.files.map((file) => {
              const FileIcon = getFileIcon(file.type);
              return (
                <div
                  key={file.id}
                  className="list-item"
                >
                  <FileIcon className="icon-sm text-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary font-mono truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(file.id)}
                    className="icon-btn"
                    title="Remove file"
                    aria-label="Remove file"
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
      <div className="mt-6">
        <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-[var(--portal-border-color)] w-fit">
          <Checkbox
            checked={assets.logoProvided}
            onCheckedChange={(checked) => handleChange('logoProvided', checked === true)}
          />
          <span className="text-sm font-mono">
            Logo included in uploaded files
          </span>
        </label>
      </div>

      <div className="divider" />

      {/* Additional Asset Information */}
      <div className="mb-4">
        <h3 className="heading text-lg">
          Additional Resources
        </h3>
        <p className="text-muted text-sm mt-1">
          Tell us about any other assets or content access we may need.
        </p>
      </div>

      {/* Existing Assets */}
      <div className="flex flex-col gap-1">
        <label className="field-label" htmlFor="assets-existing">Existing Assets</label>
        <textarea
          id="assets-existing"
          value={assets.existingAssets}
          onChange={(e) => handleChange('existingAssets', e.target.value)}
          placeholder="Do you have existing assets like photography, icons, or illustrations? Where can we access them?"
          rows={2}
          className="textarea"
        />
      </div>

      {/* Content Access */}
      <div className="flex flex-col gap-1 mt-4">
        <label className="field-label" htmlFor="assets-content-access">Content & Access Details</label>
        <textarea
          id="assets-content-access"
          value={assets.contentAccess}
          onChange={(e) => handleChange('contentAccess', e.target.value)}
          placeholder="Any login credentials, API keys, or access details we'll need? (You can also share these securely later)"
          rows={2}
          className="textarea"
        />
        <span className="text-xs text-muted">
          Never share passwords directly. We'll provide a secure way to share credentials if needed.
        </span>
      </div>
    </div>
  );
}
