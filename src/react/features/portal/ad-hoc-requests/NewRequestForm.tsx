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
  maxFiles = DEFAULT_MAX_FILES,
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
      attachments: files.length > 0 ? files : undefined,
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
    <form onSubmit={handleSubmit} className="tw-section">
      {/* Title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label className="tw-label">
          Title
          <span style={{ color: 'var(--status-cancelled)', marginLeft: '0.125rem' }}>*</span>
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
          className={cn('tw-input', errors.title && 'tw-input-error')}
        />
        {errors.title && (
          <span style={{ fontSize: '11px', color: 'var(--status-cancelled)' }}>{errors.title}</span>
        )}
      </div>

      {/* Description */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label className="tw-label">
          Description
          <span style={{ color: 'var(--status-cancelled)', marginLeft: '0.125rem' }}>*</span>
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
          className={cn('tw-textarea', errors.description && 'tw-input-error')}
          style={{ minHeight: '80px', resize: 'vertical' }}
        />
        {errors.description && (
          <span style={{ fontSize: '11px', color: 'var(--status-cancelled)' }}>{errors.description}</span>
        )}
      </div>

      {/* Priority */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label className="tw-label">Priority</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {PRIORITY_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              disabled={loading}
              className={priority === p ? 'tw-btn-primary' : 'tw-btn-secondary'}
              style={{
                flex: 1,
                fontSize: '11px',
                color: priority === p ? '#ffffff' : AD_HOC_REQUEST_PRIORITY_CONFIG[p].color,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label className="tw-label">Related Project (Optional)</label>
          <select
            value={projectId || ''}
            onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : undefined)}
            disabled={loading}
            className="tw-select"
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label className="tw-label">Attachments (Optional)</label>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="tw-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '1rem',
            border: '2px dashed rgba(255, 255, 255, 0.2)',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          <Upload className="tw-h-5 tw-w-5 tw-text-muted" />
          <div style={{ textAlign: 'center' }}>
            <p className="tw-text-secondary" style={{ fontSize: '11px' }}>
              Drop files here or{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="tw-text-primary"
                style={{ textDecoration: 'underline' }}
              >
                browse
              </button>
            </p>
            <p className="tw-text-muted" style={{ fontSize: '10px', marginTop: '0.125rem' }}>
              Max {maxFiles} files, {formatFileSize(maxFileSize)} each
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* File Error */}
        {fileError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '11px', color: 'var(--status-cancelled)' }}>
            <AlertCircle className="tw-h-3 tw-w-3" />
            {fileError}
          </div>
        )}

        {/* File List */}
        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="tw-list-item"
                style={{ justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                  <Paperclip className="tw-h-3 tw-w-3 tw-text-muted" style={{ flexShrink: 0 }} />
                  <span className="tw-text-primary" style={{ fontSize: '11px' }}>
                    {file.name}
                  </span>
                  <span className="tw-text-muted" style={{ fontSize: '10px' }}>
                    ({formatFileSize(file.size)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  disabled={loading}
                  className="tw-btn-icon"
                >
                  <X className="tw-h-3 tw-w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
        {onCancel && (
          <button
            type="button"
            className="tw-btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="tw-btn-primary"
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
        >
          {loading && <RefreshCw className="tw-h-3.5 tw-w-3.5 tw-animate-spin" />}
          Submit Request
        </button>
      </div>
    </form>
  );
}
