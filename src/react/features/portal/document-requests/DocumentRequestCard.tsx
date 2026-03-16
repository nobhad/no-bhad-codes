/**
 * DocumentRequestCard
 * Card component for displaying a document request with upload functionality
 */

import * as React from 'react';
import { useRef, useState, useCallback } from 'react';
import { Upload, Clock, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { formatCardDate, formatFileSize, isOverdue, getDaysUntilDue } from '@react/utils/cardFormatters';
import { IconButton } from '@react/factories';
import { createLogger } from '@/utils/logger';
import { getCsrfToken, CSRF_HEADER_NAME, apiPost } from '@/utils/api-client';
import { buildEndpoint } from '@/constants/api-endpoints';
import { formatErrorMessage } from '@/utils/error-utils';

const logger = createLogger('DocumentRequestCard');

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
  status: 'requested' | 'viewed' | 'uploaded' | 'under_review' | 'approved' | 'rejected';
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
  getAuthToken: _getAuthToken,
  showNotification
}: DocumentRequestCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const daysUntilDue = getDaysUntilDue(request.due_date);
  const overdue = isOverdue(request.due_date);
  const isPending = request.status === 'requested' || request.status === 'viewed';
  const isSubmitted = request.status === 'uploaded' || request.status === 'under_review';
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
      // Step 1: Upload file to project (FormData — raw fetch with CSRF)
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', 'document_request');

      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers[CSRF_HEADER_NAME] = csrfToken;

      const uploadResponse = await fetch(buildEndpoint.projectUpload(request.project_id), {
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
      const linkResponse = await apiPost(buildEndpoint.documentRequestUpload(request.id), { file_id: fileId });

      if (!linkResponse.ok) {
        const errorData = await linkResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to link file to request');
      }

      showNotification?.('Document uploaded successfully', 'success');
      setSelectedFile(null);
      onUploadSuccess(request.id);
    } catch (err) {
      logger.error('[DocumentRequestCard] Upload error:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to upload document'),
        'error'
      );
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, request.id, request.project_id, showNotification, onUploadSuccess]);

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
      className={cn('portal-card', isDragging && 'card-drag-highlight')}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="portal-card-header">
        <div className="portal-card-title-group">
          <h3 className="text-primary">{request.title}</h3>
        </div>
        <div className="portal-card-status-group">
          <span className="badge">{statusInfo.text}</span>
        </div>
      </div>

      {/* Description */}
      {request.description && (
        <p className="portal-card-description">{request.description}</p>
      )}

      {/* Due Date */}
      {request.due_date && (
        <div className={cn('portal-card-meta-item', overdue && 'text-primary')}>
          <Clock className="icon-xs" />
          <span>
            Due {formatCardDate(request.due_date)}
            {daysUntilDue !== null && daysUntilDue > 0 && ` (${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'})`}
            {overdue && ' - Overdue'}
          </span>
        </div>
      )}

      {/* Uploaded File Info (for submitted/approved) */}
      {(isSubmitted || isApproved) && request.uploaded_file && (
        <div className="panel portal-card-meta-item">
          <FileText className="icon-xs" />
          <span className="text-primary flex-1">
            {request.uploaded_file.filename}
          </span>
          <span className="text-secondary">
            {formatFileSize(request.uploaded_file.file_size)}
          </span>
        </div>
      )}

      {/* Upload Area (for pending/rejected) */}
      {canUpload && (
        <div>
          {selectedFile ? (
            <div className="panel portal-card-meta-item">
              <FileText className="icon-xs" />
              <span className="text-primary flex-1">{selectedFile.name}</span>
              <span className="text-secondary">{formatFileSize(selectedFile.size)}</span>
              <IconButton action="close" onClick={clearSelectedFile} disabled={isUploading} />
            </div>
          ) : (
            <div
              className="dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="icon-xs" />
              <span className="text-secondary">
                Drop file here or <span className="text-primary">browse</span>
              </span>
              <span className="text-secondary dropzone-hint">
                PDF, DOC, JPG, PNG · max 10MB
              </span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_MIME_TYPES.join(',')}
            onChange={handleInputChange}
            className="hidden"
          />

          {selectedFile && (
            <div>
              <button className="btn-primary w-full" onClick={handleUpload} disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Rejection Message */}
      {isRejected && (
        <div className="panel text-status-cancelled">
          <p>Please resubmit with the requested changes.</p>
        </div>
      )}
    </div>
  );
}
