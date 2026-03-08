/**
 * NewRequestForm
 * Form component for submitting new ad-hoc requests
 */

import * as React from 'react';
import { useState, useRef } from 'react';
import { Upload, X, Paperclip, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@react/lib/utils';
import type { AdHocRequestPriority, NewAdHocRequestPayload } from './types';
import { AD_HOC_REQUEST_PRIORITY_CONFIG } from './types';

export interface NewRequestFormProps {
  /** Callback when form is submitted */
  onSubmit: (payload: NewAdHocRequestPayload) => Promise<void>;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Whether form submission is in progress */
  loading?: boolean;
  /** Available projects for selection */
  projects?: Array<{ id: number; name: string }>;
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Maximum number of files */
  maxFiles?: number;
}

const PRIORITY_OPTIONS: AdHocRequestPriority[] = ['low', 'normal', 'high', 'urgent'];
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_FILES = 5;

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * NewRequestForm Component
 */
export function NewRequestForm({
  onSubmit,
  onCancel,
  loading = false,
  projects = [],
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  maxFiles = DEFAULT_MAX_FILES
}: NewRequestFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<AdHocRequestPriority>('normal');
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    } else if (description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const payload: NewAdHocRequestPayload = {
      title: title.trim(),
      description: description.trim(),
      priority,
      project_id: projectId,
      attachments: files.length > 0 ? files : undefined
    };

    await onSubmit(payload);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    setFileError(null);
    const newFiles: File[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];

      // Check file size
      if (file.size > maxFileSize) {
        setFileError(`File "${file.name}" exceeds ${formatFileSize(maxFileSize)} limit`);
        continue;
      }

      // Check total files count
      if (files.length + newFiles.length >= maxFiles) {
        setFileError(`Maximum ${maxFiles} files allowed`);
        break;
      }

      newFiles.push(file);
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles) return;

    setFileError(null);
    const newFiles: File[] = [];

    for (let i = 0; i < droppedFiles.length; i++) {
      const file = droppedFiles[i];

      if (file.size > maxFileSize) {
        setFileError(`File "${file.name}" exceeds ${formatFileSize(maxFileSize)} limit`);
        continue;
      }

      if (files.length + newFiles.length >= maxFiles) {
        setFileError(`Maximum ${maxFiles} files allowed`);
        break;
      }

      newFiles.push(file);
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <form onSubmit={handleSubmit} className="section">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="field-label">
          Title
          <span className="form-required">*</span>
        </label>
        <input
          type="text"
          placeholder="Brief description of your request"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) {
              setErrors((prev) => ({ ...prev, title: '' }));
            }
          }}
          disabled={loading}
          className={cn('input', errors.title && 'input-error')}
        />
        {errors.title && (
          <span className="form-error-text">{errors.title}</span>
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="field-label">
          Description
          <span className="form-required">*</span>
        </label>
        <textarea
          placeholder="Provide details about what you need..."
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description) {
              setErrors((prev) => ({ ...prev, description: '' }));
            }
          }}
          disabled={loading}
          rows={4}
          className={cn('textarea form-textarea-resizable', errors.description && 'input-error')}
        />
        {errors.description && (
          <span className="form-error-text">{errors.description}</span>
        )}
      </div>

      {/* Priority */}
      <div className="flex flex-col gap-1">
        <label className="field-label">Priority</label>
        <div className="flex gap-2">
          {PRIORITY_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              disabled={loading}
              className={cn('flex-1 text-xs', priority === p ? 'btn-primary' : 'btn-secondary')}
              style={{
                color: priority === p ? 'var(--portal-text-light)' : AD_HOC_REQUEST_PRIORITY_CONFIG[p].color,
                backgroundColor: priority === p ? AD_HOC_REQUEST_PRIORITY_CONFIG[p].color : 'transparent',
                borderColor: priority === p ? AD_HOC_REQUEST_PRIORITY_CONFIG[p].color : undefined
              }}
            >
              {AD_HOC_REQUEST_PRIORITY_CONFIG[p].label}
            </button>
          ))}
        </div>
      </div>

      {/* Project (Optional) */}
      {projects.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="field-label">Related Project (Optional)</label>
          <select
            value={projectId || ''}
            onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : undefined)}
            disabled={loading}
            className="select"
          >
            <option value="">Select a project...</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* File Upload */}
      <div className="flex flex-col gap-1">
        <label className="field-label">Attachments (Optional)</label>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={cn('dropzone', loading && 'cursor-not-allowed')}
          style={{ opacity: loading ? 0.5 : 1 }}
        >
          <Upload className="icon-sm" />
          <div className="text-center">
            <p className="text-secondary text-xs">
              Drop files here or{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-primary underline"
              >
                browse
              </button>
            </p>
            <p className="text-muted text-xs mt-0.5">
              Max {maxFiles} files, {formatFileSize(maxFileSize)} each
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* File Error */}
        {fileError && (
          <div className="flex items-center gap-1.5 text-xs form-error-text">
            <AlertCircle className="icon-xs" />
            {fileError}
          </div>
        )}

        {/* File List */}
        {files.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="list-item justify-between"
              >
                <div className="flex items-center gap-2 card-content-truncate">
                  <Paperclip className="icon-xs flex-shrink-0" />
                  <span className="text-primary text-xs">
                    {file.name}
                  </span>
                  <span className="text-muted text-xs">
                    ({formatFileSize(file.size)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  disabled={loading}
                  className="icon-btn"
                >
                  <X className="icon-xs" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn-primary flex items-center gap-1.5"
          disabled={loading}
        >
          {loading && <RefreshCw className="icon-xs loading-spin" />}
          Submit Request
        </button>
      </div>
    </form>
  );
}
