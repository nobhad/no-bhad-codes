import * as React from 'react';
import { useMemo } from 'react';
import {
  FileSignature,
  Check,
  AlertTriangle,
  Download,
  FileText,
  Calendar,
  DollarSign,
  ExternalLink,
  Inbox
} from 'lucide-react';
import type { Project, ProjectFile } from '../../types';
import { formatCurrency } from '../../../../../utils/format-utils';

interface ContractTabProps {
  project: Project;
  files: ProjectFile[];
  onDownloadFile?: (file: ProjectFile) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Format date for display
 */
function formatDate(date: string | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Get contract status based on project state
 */
function getContractStatus(project: Project): {
  status: 'signed' | 'pending' | 'not-sent';
  label: string;
  variant: 'completed' | 'on-hold' | 'pending';
} {
  if (project.contract_signed_date) {
    return { status: 'signed', label: 'Signed', variant: 'completed' };
  }

  // If project is active or beyond, contract should be pending (use on-hold for warning color)
  if (['active', 'in-progress', 'completed'].includes(project.status)) {
    return { status: 'pending', label: 'Awaiting Signature', variant: 'on-hold' };
  }

  return { status: 'not-sent', label: 'Not Sent', variant: 'pending' };
}

/**
 * ContractTab
 * Shows contract status, terms, and contract files
 */
export function ContractTab({
  project,
  files,
  onDownloadFile,
  showNotification
}: ContractTabProps) {
  // Filter for contract-related files
  const contractFiles = useMemo(() => {
    return files.filter(
      (f) =>
        f.category === 'contract' ||
        f.original_name?.toLowerCase().includes('contract') ||
        f.original_name?.toLowerCase().includes('agreement')
    );
  }, [files]);

  // Get contract status
  const contractStatus = getContractStatus(project);
  const isSigned = contractStatus.status === 'signed';

  // Handle download
  const handleDownload = (file: ProjectFile) => {
    if (file.download_url) {
      window.open(file.download_url, '_blank');
    }
    onDownloadFile?.(file);
  };

  // Handle generate contract (placeholder)
  const handleGenerateContract = () => {
    showNotification?.('Contract generation coming soon', 'info');
  };

  // Handle send for signature (placeholder)
  const handleSendForSignature = () => {
    showNotification?.('E-signature integration coming soon', 'info');
  };

  return (
    <div className="tw-section">
      {/* Contract Status Card */}
      <div className="tw-panel">
        <div className="contract-status-layout">
          <div className="pd-row-start-wide">
            {isSigned ? (
              <Check className="icon-xl" />
            ) : (
              <FileSignature className="icon-xl" />
            )}

            <div>
              <div className="pd-row-tight">
                <h3 className="heading pd-text-lg">
                  Contract Status
                </h3>
                <span className="tw-badge">
                  {contractStatus.label}
                </span>
              </div>

              {isSigned && project.contract_signed_date && (
                <div className="pd-row-compact text-muted pd-mt-2">
                  <Calendar className="icon-md" />
                  <span>Signed on {formatDate(project.contract_signed_date)}</span>
                </div>
              )}

              {!isSigned && (
                <p className="text-muted pd-mt-2">
                  {contractStatus.status === 'pending'
                    ? 'Contract has been sent and is awaiting client signature.'
                    : 'Contract has not been sent to the client yet.'}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pd-row-compact">
            {!isSigned && (
              <>
                <button
                  className="btn-secondary"
                  onClick={handleGenerateContract}
                >
                  <FileText className="icon-md" />
                  Generate
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSendForSignature}
                >
                  <ExternalLink className="icon-md" />
                  Send for Signature
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contract Terms */}
      <div className="pd-grid-2">
        {/* Project Value */}
        <div className="stat-card">
          <div className="contract-stat-header">
            <DollarSign className="icon-md" />
            <span className="field-label">
              Contract Value
            </span>
          </div>
          <div className="stat-value">
            {formatCurrency(project.price || project.budget)}
          </div>
          {project.deposit_amount && (
            <div className="text-muted pd-mt-1">
              Deposit: {formatCurrency(project.deposit_amount)}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="stat-card">
          <div className="contract-stat-header">
            <Calendar className="icon-md" />
            <span className="field-label">
              Project Timeline
            </span>
          </div>
          <div className="pd-highlight-value pd-text-lg">
            {project.start_date && project.end_date ? (
              <>
                {formatDate(project.start_date)} - {formatDate(project.end_date)}
              </>
            ) : project.timeline ? (
              project.timeline
            ) : (
              <span className="text-muted">Not specified</span>
            )}
          </div>
        </div>
      </div>

      {/* Contract Files */}
      <div className="tw-panel contract-panel-no-padding">
        <div className="pd-tab-header contract-files-header">
          <div className="pd-row-compact">
            <FileText className="icon-md" />
            <span className="heading">
              Contract Documents
            </span>
          </div>
          <span className="text-muted pd-hint">
            {contractFiles.length} file{contractFiles.length !== 1 ? 's' : ''}
          </span>
        </div>

        {contractFiles.length === 0 ? (
          <div className="empty-state contract-empty-state">
            <Inbox className="icon-xl pd-mb-2" />
            <span>No contract documents</span>
            <span className="pd-hint">
              Upload contracts in the Files tab or generate one above
            </span>
          </div>
        ) : (
          <div>
            {contractFiles.map((file) => (
              <div
                key={file.id}
                className="tw-list-item"
              >
                <div className="pd-row-tight">
                  <FileText className="icon-lg" />
                  <div>
                    <span className="pd-highlight-value">
                      {file.original_name}
                    </span>
                    <div className="text-muted pd-hint">
                      {formatDate(file.created_at)}
                    </div>
                  </div>
                </div>

                {file.download_url && (
                  <button
                    className="icon-btn"
                    onClick={() => handleDownload(file)}
                    title="Download"
                  >
                    <Download className="icon-md" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warning for unsigned contracts */}
      {!isSigned && project.status === 'active' && (
        <div className="portal-card contract-warning">
          <AlertTriangle className="icon-lg contract-warning-icon" />
          <div>
            <h4 className="heading">
              Contract Not Signed
            </h4>
            <p className="text-muted pd-mt-1">
              This project is active but the contract has not been signed.
              Consider sending the contract for signature before proceeding with work.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
