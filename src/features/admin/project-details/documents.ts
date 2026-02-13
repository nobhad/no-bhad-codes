/**
 * Document Generation Module
 * @file src/features/admin/project-details/documents.ts
 *
 * Handles generation, preview, and saving of project documents:
 * - Project Reports (status, milestones, time tracking)
 * - Statement of Work (SOW) from proposal data
 */

import { apiFetch, apiPost } from '../../../utils/api-client';
import { showToast } from '../../../utils/toast-notifications';
import { alertError, alertSuccess, confirmDialog } from '../../../utils/confirm-dialog';

// ============================================
// Project Report Functions
// ============================================

/**
 * Download project report as PDF
 */
export async function downloadProjectReport(projectId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/projects/${projectId}/report/pdf`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      alertError(error.error || 'Failed to generate project report');
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const contentDisposition = response.headers.get('Content-Disposition');
    const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/);
    const filename = filenameMatch ? filenameMatch[1] : `project-report-${projectId}.pdf`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Project report downloaded', 'success');
  } catch (error) {
    console.error('[Documents] Error downloading project report:', error);
    alertError('Failed to download project report');
  }
}

/**
 * Preview project report in new tab
 */
export async function previewProjectReport(projectId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/projects/${projectId}/report/preview`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      alertError(error.error || 'Failed to generate project report preview');
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    // Clean up URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    console.error('[Documents] Error previewing project report:', error);
    alertError('Failed to preview project report');
  }
}

/**
 * Save project report to project files
 */
export async function saveProjectReportToFiles(
  projectId: number,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await apiPost(`/api/projects/${projectId}/report/save`, {});

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      alertError(error.error || 'Failed to save project report');
      return;
    }

    const result = await response.json();
    alertSuccess(`Project report saved: ${result.file.filename}`);

    if (onSuccess) {
      onSuccess();
    }
  } catch (error) {
    console.error('[Documents] Error saving project report:', error);
    alertError('Failed to save project report to files');
  }
}

// ============================================
// Statement of Work (SOW) Functions
// ============================================

/**
 * Download SOW as PDF
 */
export async function downloadSow(projectId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/projects/${projectId}/sow/pdf`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (error.code === 'NOT_FOUND') {
        alertError('No proposal found for this project. Create a proposal first to generate an SOW.');
      } else {
        alertError(error.error || 'Failed to generate Statement of Work');
      }
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const contentDisposition = response.headers.get('Content-Disposition');
    const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/);
    const filename = filenameMatch ? filenameMatch[1] : `sow-${projectId}.pdf`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Statement of Work downloaded', 'success');
  } catch (error) {
    console.error('[Documents] Error downloading SOW:', error);
    alertError('Failed to download Statement of Work');
  }
}

/**
 * Preview SOW in new tab
 */
export async function previewSow(projectId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/projects/${projectId}/sow/preview`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (error.code === 'NOT_FOUND') {
        alertError('No proposal found for this project. Create a proposal first to generate an SOW.');
      } else {
        alertError(error.error || 'Failed to generate SOW preview');
      }
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    // Clean up URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    console.error('[Documents] Error previewing SOW:', error);
    alertError('Failed to preview Statement of Work');
  }
}

/**
 * Save SOW to project files
 */
export async function saveSowToFiles(
  projectId: number,
  onSuccess?: () => void
): Promise<void> {
  try {
    const response = await apiPost(`/api/projects/${projectId}/sow/save`, {});

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (error.code === 'NOT_FOUND') {
        alertError('No proposal found for this project. Create a proposal first to generate an SOW.');
      } else {
        alertError(error.error || 'Failed to save Statement of Work');
      }
      return;
    }

    const result = await response.json();
    alertSuccess(`Statement of Work saved: ${result.file.filename}`);

    if (onSuccess) {
      onSuccess();
    }
  } catch (error) {
    console.error('[Documents] Error saving SOW:', error);
    alertError('Failed to save Statement of Work to files');
  }
}

// ============================================
// Document Generation Modal
// ============================================

/**
 * Show document generation modal with all options
 */
export async function showDocumentGenerationModal(
  projectId: number,
  onFilesUpdated?: () => void
): Promise<void> {
  const { createPortalModal } = await import('../../../components/portal-modal');

  const modal = createPortalModal({
    id: 'document-generation-modal',
    titleId: 'document-generation-title',
    title: 'Generate Documents',
    contentClassName: 'document-generation-modal',
    onClose: () => {
      modal.hide();
      modal.overlay.remove();
    }
  });

  modal.body.innerHTML = `
    <div class="document-generation-content">
      <p class="modal-description">Generate and export project documents. Preview before downloading or save directly to project files.</p>

      <div class="document-section">
        <div class="document-header">
          <div class="document-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div class="document-info">
            <h4>Project Report</h4>
            <p>Comprehensive summary including project status, milestones, deliverables, time tracking, and financial overview.</p>
          </div>
        </div>
        <div class="document-actions">
          <button type="button" class="btn btn-outline btn-sm" id="btn-preview-report">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Preview
          </button>
          <button type="button" class="btn btn-outline btn-sm" id="btn-download-report">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="btn-save-report">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Save to Files
          </button>
        </div>
      </div>

      <div class="document-section">
        <div class="document-header">
          <div class="document-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <div class="document-info">
            <h4>Statement of Work (SOW)</h4>
            <p>Formal project agreement generated from proposal data, including scope, deliverables, timeline, pricing, and terms.</p>
          </div>
        </div>
        <div class="document-actions">
          <button type="button" class="btn btn-outline btn-sm" id="btn-preview-sow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Preview
          </button>
          <button type="button" class="btn btn-outline btn-sm" id="btn-download-sow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="btn-save-sow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Save to Files
          </button>
        </div>
      </div>

      <p class="modal-note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        SOW generation requires an existing proposal for this project.
      </p>
    </div>
  `;

  modal.footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-close-doc-modal">Close</button>
  `;

  document.body.appendChild(modal.overlay);
  modal.show();

  // Event handlers
  const closeBtn = modal.footer.querySelector('#btn-close-doc-modal');
  closeBtn?.addEventListener('click', () => {
    modal.hide();
    modal.overlay.remove();
  });

  // Project Report actions
  const previewReportBtn = modal.body.querySelector('#btn-preview-report');
  const downloadReportBtn = modal.body.querySelector('#btn-download-report');
  const saveReportBtn = modal.body.querySelector('#btn-save-report');

  previewReportBtn?.addEventListener('click', async () => {
    await previewProjectReport(projectId);
  });

  downloadReportBtn?.addEventListener('click', async () => {
    await downloadProjectReport(projectId);
  });

  saveReportBtn?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Save Project Report',
      message: 'Save the project report PDF to the project files?',
      confirmText: 'Save',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      await saveProjectReportToFiles(projectId, () => {
        if (onFilesUpdated) onFilesUpdated();
      });
    }
  });

  // SOW actions
  const previewSowBtn = modal.body.querySelector('#btn-preview-sow');
  const downloadSowBtn = modal.body.querySelector('#btn-download-sow');
  const saveSowBtn = modal.body.querySelector('#btn-save-sow');

  previewSowBtn?.addEventListener('click', async () => {
    await previewSow(projectId);
  });

  downloadSowBtn?.addEventListener('click', async () => {
    await downloadSow(projectId);
  });

  saveSowBtn?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Save Statement of Work',
      message: 'Save the Statement of Work PDF to the project files?',
      confirmText: 'Save',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      await saveSowToFiles(projectId, () => {
        if (onFilesUpdated) onFilesUpdated();
      });
    }
  });
}
