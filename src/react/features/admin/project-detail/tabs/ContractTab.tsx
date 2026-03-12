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
  Inbox
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { EmptyState } from '@react/components/portal/EmptyState';
import { StatCard, StatsRow } from '@react/components/portal/StatCard';
import type { Project, ProjectFile } from '../../types';
import { formatCurrency, formatDate } from '@/utils/format-utils';
import { NOTIFICATIONS } from '@/constants/notifications';

interface ContractTabProps {
  project: Project;
  files: ProjectFile[];
  onDownloadFile?: (file: ProjectFile) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
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
    showNotification?.(NOTIFICATIONS.contract.GENERATE_COMING_SOON, 'info');
  };

  // Handle send for signature (placeholder)
  const handleSendForSignature = () => {
    showNotification?.(NOTIFICATIONS.contract.SIGNATURE_COMING_SOON, 'info');
  };

  return (
    <div className="section">
      {/* Contract Status Card */}
      <div className="panel">
        <div className="contract-status-layout">
          <div>
            <div className="layout-row">
              {isSigned ? (
                <Check className="icon-md" />
              ) : (
                <FileSignature className="icon-md" />
              )}
              <h3 className="heading">
                Contract Status
              </h3>
              <span className="badge">
                {contractStatus.label}
              </span>
            </div>

            {isSigned && project.contract_signed_date && (
              <div className="layout-row gap-2 text-muted pd-mt-2">
                <Calendar className="icon-md" />
                <span>Signed on {formatDate(project.contract_signed_date, 'label')}</span>
              </div>
            )}

            {!isSigned && (
              <p className="text-muted pd-mt-1">
                {contractStatus.status === 'pending'
                  ? 'Contract has been sent and is awaiting client signature.'
                  : 'Contract has not been sent to the client yet.'}
              </p>
            )}
          </div>

          {/* Actions */}
          {!isSigned && (
            <div className="detail-actions">
              <IconButton action="generate" onClick={handleGenerateContract} title="Generate Contract" />
              <IconButton action="send" onClick={handleSendForSignature} title="Send for Signature" />
            </div>
          )}
        </div>
      </div>

      {/* Contract Terms */}
      <StatsRow className="grid-2col contract-stats-grid">
        <StatCard
          label="Contract Value"
          value={formatCurrency(project.price || project.budget)}
          icon={<DollarSign className="icon-md" />}
          meta={project.deposit_amount ? `Deposit: ${formatCurrency(project.deposit_amount)}` : undefined}
        />
        <StatCard
          label="Project Timeline"
          value={
            project.start_date && project.end_date
              ? `${formatDate(project.start_date, 'label')} - ${formatDate(project.end_date, 'label')}`
              : project.timeline || 'Not specified'
          }
          icon={<Calendar className="icon-md" />}
        />
      </StatsRow>

      {/* Contract Files */}
      <div className="panel contract-panel-no-padding">
        <div className="section-header">
          <div className="section-title-group">
            <FileText className="section-icon" />
            <span className="heading">
              Contract Documents
            </span>
          </div>
          <span className="text-muted pd-hint">
            {contractFiles.length} file{contractFiles.length !== 1 ? 's' : ''}
          </span>
        </div>

        {contractFiles.length === 0 ? (
          <EmptyState
            icon={<Inbox className="icon-lg" />}
            message="No contract documents. Upload contracts in the Files tab or generate one above."
          />
        ) : (
          <div>
            {contractFiles.map((file) => (
              <div
                key={file.id}
                className="list-item"
              >
                <div className="layout-row">
                  <FileText className="icon-md" />
                  <div>
                    <span className="pd-highlight-value">
                      {file.original_name}
                    </span>
                    <div className="text-muted pd-hint">
                      {formatDate(file.created_at, 'label')}
                    </div>
                  </div>
                </div>

                {file.download_url && (
                  <button
                    className="icon-btn"
                    onClick={() => handleDownload(file)}
                    title="Download"
                    aria-label="Download file"
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
          <AlertTriangle className="icon-md contract-warning-icon" />
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
