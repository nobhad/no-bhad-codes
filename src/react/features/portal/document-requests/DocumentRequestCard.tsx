/**
 * DocumentRequestCard
 * Card component for displaying a document request with upload functionality
 */

import * as React from 'react';
import { useRef, useState, useCallback } from 'react';
import { Upload, Clock, CheckCircle, AlertCircle, FileText, X } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { formatDate, formatFileSize, isOverdue, getDaysUntilDue } from '@react/utils/cardFormatters';
import { PortalButton } from '@react/components/portal/PortalButton';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';

// File size limit: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png'
];

export interface DocumentRequest {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  due_date?: string;
  created_at: string;
  submitted_at?: string;
  uploaded_file?: {
    id: number;
    filename: string;
    file_size: number;
  };
}

interface DocumentRequestCardProps {
  request: DocumentRequest;
  onUploadSuccess: (requestId: number) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Validate file for upload
 */
function validateFile(file: File): string | null {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return `File size exceeds 10MB limit (${formatFileSize(file.size)})`;
  }

  // Check file extension
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `File type .${extension} is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return 'Invalid file type';
  }

  return null;
}

/**
 * DocumentRequestCard Component
 */
export function DocumentRequestCard({
  request,
  onUploadSuccess,
  getAuthToken,
  showNotification
}: DocumentRequestCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const daysUntilDue = getDaysUntilDue(request.due_date);
  const overdue = isOverdue(request.due_date);
  const isPending = request.status === 'pending';
  const isSubmitted = request.status === 'submitted';
  const isApproved = request.status === 'approved';
  const isRejected = request.status === 'rejected';

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      showNotification?.(error, 'error');
      return;
    }
    setSelectedFile(file);
  }, [showNotification]);

  // Handle file input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleFileSelect]);

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPending || isRejected) {
      setIsDragging(true);
    }
  }, [isPending, isRejected]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!isPending && !isRejected) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [isPending, isRejected, handleFileSelect]);

  // Clear selected file
  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  // Handle upload
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setIsUploading(true);

    try {
      const headers: Record<string, string> = {};
      const token = getAuthToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Step 1: Upload file to project
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', 'document_request');

      const uploadResponse = await fetch(`/api/uploads/project/${request.project_id}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to upload file');
      }

      const uploadData = await uploadResponse.json();
      const fileId = uploadData.file?.id || uploadData.id;

      if (!fileId) {
        throw new Error('Upload succeeded but no file ID returned');
      }

      // Step 2: Link uploaded file to document request
      const linkResponse = await fetch(`/api/document-requests/${request.id}/upload`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ file_id: fileId })
      });

      if (!linkResponse.ok) {
        const errorData = await linkResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to link file to request');
      }

      showNotification?.('Document uploaded successfully', 'success');
      setSelectedFile(null);
      onUploadSuccess(request.id);
    } catch (err) {
      console.error('[DocumentRequestCard] Upload error:', err);
      showNotification?.(
        err instanceof Error ? err.message : 'Failed to upload document',
        'error'
      );
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, request.id, request.project_id, getAuthToken, showNotification, onUploadSuccess]);

  // Get status display info
  const getStatusInfo = () => {
    if (isApproved) {
      return { icon: CheckCircle, text: 'Approved', variant: 'completed' as const };
    }
    if (isRejected) {
      return { icon: AlertCircle, text: 'Rejected', variant: 'cancelled' as const };
    }
    if (isSubmitted) {
      return { icon: Clock, text: 'Under Review', variant: 'qualified' as const };
    }
    if (overdue) {
      return { icon: AlertCircle, text: 'Overdue', variant: 'cancelled' as const };
    }
    return { icon: Clock, text: 'Pending', variant: 'pending' as const };
  };

  const statusInfo = getStatusInfo();
  const canUpload = isPending || isRejected;

  return (
    <div
      className={cn('tw-card', isDragging && 'tw-table-row-selected')}
      style={{ borderColor: isDragging ? 'var(--portal-text-light)' : undefined }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="tw-flex tw-items-start tw-justify-between tw-gap-2 tw-mb-2">
        <div className="tw-flex-1 card-content-truncate">
          <h3 className="tw-text-primary tw-text-sm">{request.title}</h3>
          {request.description && (
            <p className="tw-text-muted tw-text-sm tw-mt-1">
              {request.description}
            </p>
          )}
        </div>
        <span className="tw-badge">{statusInfo.text}</span>
      </div>

      {/* Due Date */}
      {request.due_date && (
        <div className="tw-flex tw-items-center tw-gap-1 tw-mb-2">
          <Clock className="tw-h-4 tw-w-4 tw-text-muted" />
          <span className={cn('tw-text-sm', overdue ? 'tw-text-primary' : 'tw-text-muted')}>
            Due {formatDate(request.due_date)}
            {daysUntilDue !== null && daysUntilDue > 0 && ` (${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'})`}
            {overdue && ' - Overdue'}
          </span>
        </div>
      )}

      {/* Uploaded File Info (for submitted/approved) */}
      {(isSubmitted || isApproved) && request.uploaded_file && (
        <div className="tw-panel tw-flex tw-items-center tw-gap-2 tw-p-2 tw-mb-2">
          <FileText className="tw-h-4 tw-w-4 tw-text-muted" />
          <span className="tw-text-primary tw-flex-1 tw-text-sm">
            {request.uploaded_file.filename}
          </span>
          <span className="tw-text-muted tw-text-xs">
            {formatFileSize(request.uploaded_file.file_size)}
          </span>
        </div>
      )}

      {/* Upload Area (for pending/rejected) */}
      {canUpload && (
        <div className="tw-mt-2">
          {selectedFile ? (
            <div className="tw-panel tw-flex tw-items-center tw-gap-2 tw-p-2">
              <FileText className="tw-h-4 tw-w-4" />
              <span className="tw-text-primary tw-flex-1 tw-text-sm">{selectedFile.name}</span>
              <span className="tw-text-muted tw-text-xs">{formatFileSize(selectedFile.size)}</span>
              <button className="tw-btn-icon" onClick={clearSelectedFile} disabled={isUploading}>
                <X className="tw-h-4 tw-w-4" />
              </button>
            </div>
          ) : (
            <div
              className="tw-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="tw-h-5 tw-w-5 tw-text-muted" />
              <p className="tw-text-muted tw-text-sm">
                Drop file here or <span className="tw-text-primary">browse</span>
              </p>
              <p className="tw-text-muted tw-text-xs tw-mt-1">
                PDF, DOC, DOCX, TXT, JPG, PNG (max 10MB)
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_MIME_TYPES.join(',')}
            onChange={handleInputChange}
            className="tw-hidden"
          />

          {selectedFile && (
            <div className="tw-mt-2">
              <button className="tw-btn-primary tw-w-full" onClick={handleUpload} disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Rejection Message */}
      {isRejected && (
        <div className="tw-panel tw-mt-2" style={{ borderColor: 'var(--portal-text-light)' }}>
          <p className="tw-text-sm">Please resubmit with the requested changes.</p>
        </div>
      )}
    </div>
  );
}
