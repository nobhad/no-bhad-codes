import * as React from 'react';
import { useMemo } from 'react';
import {
  FileSignature,
  Check,
  Clock,
  AlertTriangle,
  Download,
  FileText,
  Calendar,
  DollarSign,
  ExternalLink,
  Inbox
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { StatusBadge } from '@react/components/portal/StatusBadge';
import type { Project, ProjectFile } from '../../types';

interface ContractTabProps {
  project: Project;
  files: ProjectFile[];
  onDownloadFile?: (file: ProjectFile) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Format currency
 */
function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format date for display
 */
function formatDate(date: string | undefined): string {
  if (!date) return '-';
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
        f.original_name.toLowerCase().includes('contract') ||
        f.original_name.toLowerCase().includes('agreement')
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
      <div className="tw-panel" style={{ padding: '1.5rem' }}>
        <div className="tw-flex tw-items-start tw-justify-between tw-gap-4">
          <div className="tw-flex tw-items-start tw-gap-4">
            <div
              className={cn(
                'tw-w-12 tw-h-12 tw-flex tw-items-center tw-justify-center',
                isSigned
                  ? 'tw-bg-white'
                  : 'tw-border tw-border-[var(--portal-border-color)]'
              )}
              style={{ borderRadius: 0 }}
            >
              {isSigned ? (
                <Check className="tw-h-6 tw-w-6 tw-text-black" />
              ) : (
                <FileSignature className="tw-h-6 tw-w-6 tw-text-muted" />
              )}
            </div>

            <div>
              <div className="tw-flex tw-items-center tw-gap-3">
                <h3 className="tw-heading" style={{ fontSize: '18px' }}>
                  Contract Status
                </h3>
                <span className="tw-badge">
                  {contractStatus.label}
                </span>
              </div>

              {isSigned && project.contract_signed_date && (
                <div className="tw-flex tw-items-center tw-gap-2 tw-text-muted tw-mt-2" style={{ fontSize: '14px' }}>
                  <Calendar className="tw-h-4 tw-w-4" />
                  <span>Signed on {formatDate(project.contract_signed_date)}</span>
                </div>
              )}

              {!isSigned && (
                <p className="tw-text-muted tw-mt-2" style={{ fontSize: '14px' }}>
                  {contractStatus.status === 'pending'
                    ? 'Contract has been sent and is awaiting client signature.'
                    : 'Contract has not been sent to the client yet.'}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="tw-flex tw-items-center tw-gap-2">
            {!isSigned && (
              <>
                <button
                  className="tw-btn-secondary"
                  onClick={handleGenerateContract}
                >
                  <FileText className="tw-h-4 tw-w-4" />
                  Generate
                </button>
                <button
                  className="tw-btn-primary"
                  onClick={handleSendForSignature}
                >
                  <ExternalLink className="tw-h-4 tw-w-4" />
                  Send for Signature
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contract Terms */}
      <div className="tw-grid tw-grid-cols-2 tw-gap-4">
        {/* Project Value */}
        <div className="tw-stat-card">
          <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
            <DollarSign className="tw-h-4 tw-w-4 tw-text-muted" />
            <span className="tw-label">
              Contract Value
            </span>
          </div>
          <div className="tw-stat-value">
            {formatCurrency(project.price || project.budget)}
          </div>
          {project.deposit_amount && (
            <div className="tw-text-muted tw-mt-1" style={{ fontSize: '14px' }}>
              Deposit: {formatCurrency(project.deposit_amount)}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="tw-stat-card">
          <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
            <Calendar className="tw-h-4 tw-w-4 tw-text-muted" />
            <span className="tw-label">
              Project Timeline
            </span>
          </div>
          <div className="tw-text-primary" style={{ fontSize: '18px' }}>
            {project.start_date && project.end_date ? (
              <>
                {formatDate(project.start_date)} - {formatDate(project.end_date)}
              </>
            ) : project.timeline ? (
              project.timeline
            ) : (
              <span className="tw-text-muted">Not specified</span>
            )}
          </div>
        </div>
      </div>

      {/* Contract Files */}
      <div className="tw-panel" style={{ padding: 0 }}>
        <div className="tw-flex tw-items-center tw-justify-between tw-px-4 tw-py-3" style={{ borderBottom: '1px solid var(--portal-border-color)' }}>
          <div className="tw-flex tw-items-center tw-gap-2">
            <FileText className="tw-h-4 tw-w-4 tw-text-muted" />
            <span className="tw-heading" style={{ fontSize: '14px' }}>
              Contract Documents
            </span>
          </div>
          <span className="tw-text-muted" style={{ fontSize: '12px' }}>
            {contractFiles.length} file{contractFiles.length !== 1 ? 's' : ''}
          </span>
        </div>

        {contractFiles.length === 0 ? (
          <div className="tw-empty-state" style={{ padding: '2rem' }}>
            <Inbox className="tw-h-6 tw-w-6 tw-mb-2" />
            <span>No contract documents</span>
            <span style={{ fontSize: '12px' }}>
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
                <div className="tw-flex tw-items-center tw-gap-3">
                  <FileText className="tw-h-5 tw-w-5" />
                  <div>
                    <span className="tw-text-primary" style={{ fontSize: '14px' }}>
                      {file.original_name}
                    </span>
                    <div className="tw-text-muted" style={{ fontSize: '12px' }}>
                      {formatDate(file.created_at)}
                    </div>
                  </div>
                </div>

                {file.download_url && (
                  <button
                    className="tw-btn-icon"
                    onClick={() => handleDownload(file)}
                    title="Download"
                  >
                    <Download className="tw-h-4 tw-w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warning for unsigned contracts */}
      {!isSigned && project.status === 'active' && (
        <div className="tw-card tw-flex tw-items-start tw-gap-3" style={{ borderColor: 'white' }}>
          <AlertTriangle className="tw-h-5 tw-w-5 tw-text-primary tw-flex-shrink-0 tw-mt-0.5" />
          <div>
            <h4 className="tw-heading" style={{ fontSize: '14px' }}>
              Contract Not Signed
            </h4>
            <p className="tw-text-muted tw-mt-1" style={{ fontSize: '14px' }}>
              This project is active but the contract has not been signed.
              Consider sending the contract for signature before proceeding with work.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
