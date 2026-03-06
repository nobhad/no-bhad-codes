/**
 * Project detail tab HTML renderer
 * @file src/features/admin/project-details/render-tab.ts
 *
 * Generates the full HTML structure for the project detail view tabs.
 */

import { RENDER_ICONS } from './render-icons';

/**
 * Render the project detail tab structure dynamically
 */
export function renderProjectDetailTab(container: HTMLElement): void {
  container.innerHTML = `
    <!-- Tab Navigation (hidden - tabs are in header) -->
    <div class="project-detail-tabs portal-tabs">
      <button class="active" data-pd-tab="overview">${RENDER_ICONS.OVERVIEW}<span>Overview</span></button>
      <button data-pd-tab="files">${RENDER_ICONS.FILE}<span>Files</span></button>
      <button data-pd-tab="deliverables">${RENDER_ICONS.UPLOAD}<span>Deliverables</span></button>
      <button data-pd-tab="messages">${RENDER_ICONS.MESSAGE}<span>Messages</span></button>
      <button data-pd-tab="invoices">${RENDER_ICONS.INVOICE}<span>Invoices</span></button>
      <button data-pd-tab="tasks">${RENDER_ICONS.TASK}<span>Tasks</span></button>
      <button data-pd-tab="time">${RENDER_ICONS.CLOCK}<span>Time</span></button>
      <button data-pd-tab="contract">${RENDER_ICONS.CONTRACT}<span>Contract</span></button>
      <button data-pd-tab="notes">${RENDER_ICONS.NOTES}<span>Notes</span></button>
    </div>

    <!-- Overview Tab -->
    <div class="portal-tab-panel active" id="pd-tab-overview">
      <!-- Project Header Card - Only in Overview -->
      <div class="portal-project-card pd-header-card">
        <div class="pd-header-top">
          <div class="pd-header-info">
            <div class="detail-title-row">
              <div class="detail-title-group">
                <h2 class="detail-title inline-editable" id="pd-project-name">Project Name</h2>
                <span class="status-badge inline-editable" id="pd-status">-</span>
              </div>
              <div class="detail-actions">
                <div class="table-dropdown detail-more-menu" id="pd-more-menu">
                  <button type="button" class="custom-dropdown-trigger" aria-label="More actions">
                    ${RENDER_ICONS.MORE}
                  </button>
                  <ul class="custom-dropdown-menu">
                    <li class="custom-dropdown-item" data-action="duplicate">${RENDER_ICONS.COPY} Duplicate Project</li>
                    <li class="custom-dropdown-item" data-action="archive">${RENDER_ICONS.ARCHIVE} Archive Project</li>
                    <li class="custom-dropdown-item" data-action="generate-docs">${RENDER_ICONS.DOC} Generate Documents</li>
                    <li class="dropdown-divider"></li>
                    <li class="custom-dropdown-item danger" data-action="delete">${RENDER_ICONS.TRASH} Delete Project</li>
                  </ul>
                </div>
              </div>
            </div>
            <!-- Client Info -->
            <div class="pd-header-client">
              <div class="pd-client-item clickable-client" id="pd-client-link">
                ${RENDER_ICONS.USER}
                <span id="pd-client-name">-</span>
              </div>
              <div class="pd-client-item" id="pd-company-row">
                ${RENDER_ICONS.BUILDING}
                <span id="pd-company">-</span>
              </div>
              <div class="pd-client-item">
                ${RENDER_ICONS.MAIL}
                <span id="pd-client-email">-</span>
              </div>
            </div>
            <!-- Project Meta -->
            <div class="pd-header-meta">
              <div class="pd-meta-item">
                <span class="field-label">Type</span>
                <span class="pd-meta-value inline-editable" id="pd-type">-</span>
              </div>
              <div class="pd-meta-item">
                <span class="field-label">Start</span>
                <span class="pd-meta-value inline-editable" id="pd-start-date">-</span>
              </div>
              <div class="pd-meta-item">
                <span class="field-label">Target End</span>
                <span class="pd-meta-value inline-editable" id="pd-end-date">-</span>
              </div>
              <div class="pd-meta-item">
                <span class="field-label">Budget</span>
                <span class="pd-meta-value inline-editable" id="pd-budget">-</span>
              </div>
            </div>
            <!-- Description -->
            <div class="pd-header-description">
              <span class="field-label">Description</span>
              <p class="pd-description inline-editable" id="pd-description">-</p>
            </div>
            <!-- Financial Details -->
            <div class="pd-header-meta">
              <div class="pd-meta-item">
                <span class="field-label">Timeline</span>
                <span class="pd-meta-value inline-editable" id="pd-timeline">-</span>
              </div>
              <div class="pd-meta-item">
                <span class="field-label">Quoted Price</span>
                <span class="pd-meta-value inline-editable" id="pd-price">-</span>
              </div>
              <div class="pd-meta-item">
                <span class="field-label">Deposit</span>
                <span class="pd-meta-value inline-editable" id="pd-deposit">-</span>
              </div>
            </div>
            <!-- URLs -->
            <div class="pd-header-urls" id="pd-urls-section">
              <span class="field-label">Links</span>
              <div class="pd-urls-row">
                <a href="#" id="pd-preview-url-link" target="_blank" rel="noopener noreferrer" class="pd-url-link">
                  ${RENDER_ICONS.EYE} <span>Preview</span>
                </a>
                <a href="#" id="pd-repo-url-link" target="_blank" rel="noopener noreferrer" class="pd-url-link">
                  ${RENDER_ICONS.GITHUB} <span>Repository</span>
                </a>
                <a href="#" id="pd-production-url-link" target="_blank" rel="noopener noreferrer" class="pd-url-link">
                  ${RENDER_ICONS.GLOBE} <span>Production</span>
                </a>
              </div>
            </div>
            <!-- Admin Notes -->
            <div class="pd-header-description" id="pd-admin-notes-section">
              <span class="field-label">Admin Notes (Internal)</span>
              <p class="pd-description inline-editable" id="pd-admin-notes">Click to add notes...</p>
            </div>
          </div>
        </div>
      </div>
      <div class="pd-overview-grid">
        <div class="pd-overview-main flex flex-col gap-3">
          <div class="portal-project-card pd-progress-card">
            <h3>Progress</h3>
            <div class="pd-progress-display pd-progress-horizontal">
              <div class="pd-progress-ring">
                <span class="pd-progress-percent" id="pd-progress-percent">0%</span>
              </div>
              <div class="progress-bar" role="progressbar" id="pd-progress-bar-container" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Project completion progress">
                <div class="progress-fill" id="pd-progress-bar" style="width: 0%"></div>
              </div>
            </div>
          </div>
          <div class="portal-project-card">
            <div class="card-header-with-action">
              <h3>Milestones</h3>
              <button class="btn btn-secondary btn-sm" id="btn-add-milestone">+ Add Milestone</button>
            </div>
            <div class="milestones-list" id="pd-milestones-list">
              <div class="empty-state">No milestones yet. Add milestones to track project progress.</div>
            </div>
          </div>
        </div>
        <div class="pd-overview-sidebar flex flex-col gap-3">
          <div class="portal-project-card">
            <h3>Financials</h3>
            <div class="pd-financial-stats">
              <div class="pd-stat-item"><span class="pd-stat-label">Budget</span><span class="pd-stat-value" id="pd-sidebar-budget">-</span></div>
              <div class="pd-stat-item"><span class="pd-stat-label">Invoiced</span><span class="pd-stat-value" id="pd-sidebar-invoiced">$0</span></div>
              <div class="pd-stat-item"><span class="pd-stat-label">Paid</span><span class="pd-stat-value pd-stat-success" id="pd-sidebar-paid">$0</span></div>
              <div class="pd-stat-item"><span class="pd-stat-label">Outstanding</span><span class="pd-stat-value pd-stat-warning" id="pd-sidebar-outstanding">$0</span></div>
            </div>
          </div>
          <div class="portal-project-card">
            <h3>Quick Stats</h3>
            <div class="pd-quick-stats">
              <div class="pd-stat-item"><span class="pd-stat-label">Files</span><span class="pd-stat-value" id="pd-stat-files">0</span></div>
              <div class="pd-stat-item"><span class="pd-stat-label">Messages</span><span class="pd-stat-value" id="pd-stat-messages">0</span></div>
              <div class="pd-stat-item"><span class="pd-stat-label">Tasks</span><span class="pd-stat-value" id="pd-stat-tasks">0</span></div>
              <div class="pd-stat-item"><span class="pd-stat-label">Invoices</span><span class="pd-stat-value" id="pd-stat-invoices">0</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="portal-project-card pd-activity-card">
        <h3>Recent Activity</h3>
        <ul class="activity-list" id="pd-activity-list" aria-live="polite" aria-atomic="false">
          <li>No activity recorded yet.</li>
        </ul>
      </div>
    </div>

    <!-- Deliverables Tab -->
    <div class="portal-tab-panel" id="pd-tab-deliverables">
      <div class="tab-content-wrapper">
        <div class="portal-project-card">
          <div class="card-header-with-action">
            <h3>Project Deliverables</h3>
            <button class="btn btn-secondary btn-sm" id="btn-manage-deliverables" data-action="open-deliverables">Manage Deliverables</button>
          </div>
          <div id="pd-deliverables-list" class="deliverables-inline-list">
            <div class="empty-state">No deliverables yet. Click "Manage Deliverables" to add and track project deliverables.</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Files Tab -->
    <div class="portal-tab-panel" id="pd-tab-files">
      <div class="tab-content-wrapper">
        <div class="portal-project-card files-upload-section">
          <div class="card-header-with-action">
            <h3>Upload Files for Client</h3>
            <div class="table-dropdown generate-document-menu" id="pd-generate-document-menu">
              <button type="button" class="btn btn-secondary btn-sm custom-dropdown-trigger" aria-label="Generate document">
                ${RENDER_ICONS.DOC} <span>Generate Document</span> ${RENDER_ICONS.CHEVRON_DOWN}
              </button>
              <ul class="custom-dropdown-menu">
                <li class="custom-dropdown-item" data-action="generate-proposal">${RENDER_ICONS.DOC} Generate Proposal PDF</li>
                <li class="custom-dropdown-item" data-action="generate-contract">${RENDER_ICONS.PEN} Generate Contract PDF</li>
                <li class="custom-dropdown-item" data-action="generate-receipt">${RENDER_ICONS.CREDIT_CARD} Generate Receipt PDF</li>
                <li class="custom-dropdown-item" data-action="generate-report">${RENDER_ICONS.DOC} Generate Project Report</li>
                <li class="custom-dropdown-item" data-action="generate-sow">${RENDER_ICONS.LIST} Generate SOW</li>
              </ul>
            </div>
          </div>
          <div class="upload-dropzone" id="pd-upload-dropzone">
            <p>Drag and drop files here or</p>
            <button class="btn btn-secondary" id="btn-pd-browse-files">Browse Files</button>
            <input type="file" id="pd-file-input" multiple hidden accept=".jpeg,.jpg,.png,.gif,.pdf,.doc,.docx,.txt,.zip,.rar,image/*,application/pdf" />
          </div>
        </div>
        <div class="admin-modal-overlay hidden" id="file-upload-modal" role="dialog" aria-modal="true" aria-labelledby="file-upload-modal-title">
          <div class="admin-modal">
            <div class="admin-modal-header">
              <h2 id="file-upload-modal-title">Upload Files</h2>
              <button type="button" class="icon-btn close-modal" id="file-upload-modal-close" aria-label="Close">${RENDER_ICONS.CLOSE}</button>
            </div>
            <div class="admin-modal-body">
              <div class="upload-files-preview" id="upload-files-preview"></div>
              <div class="form-group">
                <label for="upload-file-type" class="field-label">File Type</label>
                <div id="upload-file-type-mount"></div>
              </div>
              <div class="form-group" id="pd-upload-link-request" style="display: none;">
                <label for="upload-request-select" class="field-label">Link to pending request (optional)</label>
                <div id="upload-request-select-mount"></div>
              </div>
            </div>
            <div class="admin-modal-footer">
              <button type="button" class="btn btn-secondary" id="file-upload-modal-cancel">Cancel</button>
              <button type="button" class="btn btn-primary" id="file-upload-modal-confirm">Upload</button>
            </div>
          </div>
        </div>
        <div class="portal-project-card files-browser">
          <div class="folder-panel">
            <div class="folder-panel-header">
              <h4>Folders</h4>
              <button class="icon-btn" id="btn-create-folder" title="Create Folder" aria-label="Create folder">${RENDER_ICONS.FOLDER_PLUS}</button>
            </div>
            <div class="folder-tree" id="pd-folder-tree">
              <div class="folder-item root active" data-folder-id="root">${RENDER_ICONS.FOLDER} <span>All Files</span></div>
            </div>
          </div>
          <div class="files-panel">
            <div class="files-panel-header">
              <div class="files-path" id="pd-files-path"><span>All Files</span></div>
              <div class="files-panel-controls">
                <div id="files-source-toggle-mount"></div>
                <div id="files-view-toggle-mount"></div>
              </div>
            </div>
            <div class="files-list" id="pd-files-list"><div class="empty-state">No files uploaded yet.</div></div>
            <div class="pending-requests-list hidden" id="pd-pending-requests-list"></div>
          </div>
        </div>
        <div class="file-detail-modal hidden" id="file-detail-modal">
          <div class="file-detail-content">
            <div class="file-detail-header">
              <h2 id="file-detail-name">File Name</h2>
              <button class="icon-btn close-modal" id="close-file-detail">${RENDER_ICONS.CLOSE}</button>
            </div>
            <div class="file-detail-tabs">
              <button class="active" data-tab="info">Info</button>
              <button data-tab="versions">Versions</button>
              <button data-tab="comments">Comments</button>
              <button data-tab="access">Access Log</button>
            </div>
            <div class="file-detail-tab-content active" data-tab-content="info">
              <div class="file-info-grid" id="file-info-content"></div>
            </div>
            <div class="file-detail-tab-content" data-tab-content="versions">
              <div class="file-versions-list flex flex-col gap-1" id="file-versions-list"></div>
            </div>
            <div class="file-detail-tab-content" data-tab-content="comments">
              <div class="file-comments-list" id="file-comments-list"></div>
              <div class="file-comment-form flex flex-col gap-1">
                <label for="file-comment-input" class="sr-only">Add a comment</label>
                <textarea id="file-comment-input" placeholder="Add a comment..." rows="2" aria-label="Add a comment"></textarea>
                <button class="btn btn-secondary btn-sm" id="btn-add-file-comment">Add Comment</button>
              </div>
            </div>
            <div class="file-detail-tab-content" data-tab-content="access">
              <div class="file-access-log flex flex-col gap-0-5" id="file-access-log"></div>
            </div>
            <div class="file-detail-actions">
              <button class="btn btn-secondary" id="btn-download-file">${RENDER_ICONS.DOWNLOAD} Download</button>
              <button class="btn btn-secondary" id="btn-lock-file">${RENDER_ICONS.LOCK} Lock</button>
              <button class="btn btn-secondary" id="btn-share-file">${RENDER_ICONS.SHARE} Share with Client</button>
              <button class="btn btn-danger" id="btn-delete-file">${RENDER_ICONS.TRASH} Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Messages Tab -->
    <div class="portal-tab-panel" id="pd-tab-messages">
      <div class="tab-content-wrapper">
        <div class="messages-container">
          <div class="messages-thread" id="pd-messages-thread" aria-live="polite" aria-atomic="false" aria-label="Project messages thread">
            <div class="empty-state">No messages yet. Start the conversation with your client.</div>
          </div>
          <div class="message-compose">
            <div class="message-input-wrapper">
              <label for="pd-message-input" class="sr-only">Message</label>
              <textarea id="pd-message-input" class="form-textarea" placeholder="Type your message to the client..." aria-label="Type your message to the client"></textarea>
            </div>
            <button class="btn btn-secondary" id="btn-pd-send-message">Send Message</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Invoices Tab -->
    <div class="portal-tab-panel" id="pd-tab-invoices">
      <div class="tab-content-wrapper">
        <div class="invoice-summary">
          <div class="portal-project-card summary-card"><h4>Total Outstanding</h4><span class="summary-value" id="pd-outstanding">$0.00</span></div>
          <div class="portal-project-card summary-card"><h4>Total Paid</h4><span class="summary-value" id="pd-paid">$0.00</span></div>
        </div>
        <div class="portal-project-card">
          <div class="card-header-with-action">
            <h3>Invoices</h3>
            <div class="invoice-action-buttons">
              <div id="pd-invoices-filter" class="invoice-filter-container"></div>
              <button class="btn btn-outline" id="btn-process-late-fees" title="Apply late fees to overdue invoices">Apply Late Fees</button>
              <button class="btn btn-secondary" id="btn-create-invoice">+ Create Invoice</button>
            </div>
          </div>
          <div class="invoices-list" id="pd-invoices-list"><div class="empty-state">No invoices yet. Create one above.</div></div>
        </div>
        <div class="portal-project-card">
          <div class="card-header-with-action">
            <h3>Payment Plans & Recurring</h3>
            <div class="invoice-action-buttons">
              <button class="btn btn-outline" id="btn-schedule-invoice">Schedule Invoice</button>
              <button class="btn btn-outline" id="btn-setup-recurring">Setup Recurring</button>
            </div>
          </div>
          <div class="payment-plans-section">
            <h4>Scheduled Invoices</h4>
            <div id="pd-scheduled-invoices" class="scheduled-list flex flex-col gap-2"><div class="empty-state">No scheduled invoices.</div></div>
            <h4>Recurring Invoices</h4>
            <div id="pd-recurring-invoices" class="recurring-list flex flex-col gap-2"><div class="empty-state">No recurring invoices configured.</div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tasks Tab -->
    <div class="portal-tab-panel" id="pd-tab-tasks">
      <div class="tab-content-wrapper">
        <div class="portal-project-card">
          <div class="card-header-with-action">
            <div class="view-toggle-container">
              <div id="tasks-view-toggle-mount"></div>
              <button class="btn btn-secondary" id="btn-add-task">+ Add Task</button>
            </div>
          </div>
          <div id="tasks-kanban-container"></div>
          <div id="tasks-list-container" style="display: none;"></div>
        </div>
      </div>
    </div>

    <!-- Time Tracking Tab -->
    <div class="portal-tab-panel" id="pd-tab-time">
      <div class="tab-content-wrapper">
        <div class="portal-project-card">
          <div class="card-header-with-action">
            <h3>Time Tracking</h3>
            <div class="time-tracking-actions">
              <button class="btn btn-secondary btn-sm" id="btn-log-time">+ Log Time</button>
              <button class="btn btn-outline btn-sm" id="btn-export-time">Export CSV</button>
            </div>
          </div>
          <div class="time-tracking-summary" id="time-tracking-summary"></div>
        </div>
        <div class="portal-project-card time-weekly-chart">
          <h3>This Week</h3>
          <div id="time-weekly-chart-container"></div>
        </div>
        <div class="portal-project-card">
          <h3>Time Entries</h3>
          <div id="time-entries-list"><div class="empty-state">No time entries yet.</div></div>
        </div>
      </div>
    </div>

    <!-- Contract Tab -->
    <div class="portal-tab-panel" id="pd-tab-contract">
      <div class="tab-content-wrapper">
        <div class="portal-project-card">
          <div class="contract-status-display">
            <div class="contract-status-info">
              <div class="status-item"><span class="field-label">Status</span><span class="status-badge" id="pd-contract-status-badge">Not Signed</span></div>
              <div class="status-item" id="pd-contract-signed-info" style="display: none;"><span class="field-label">Signed On</span><span class="meta-value" id="pd-contract-date">-</span></div>
              <div class="status-item" id="pd-contract-countersigned-info" style="display: none;"><span class="field-label">Countersigned On</span><span class="meta-value" id="pd-contract-countersigned-date">-</span></div>
              <div class="status-item" id="pd-contract-requested-info" style="display: none;"><span class="field-label">Signature Requested</span><span class="meta-value" id="pd-contract-requested-date">-</span></div>
            </div>
          </div>
        </div>
        <div class="portal-project-card">
          <h3>Contract Document</h3>
          <p class="contract-description">Preview, download, or request a signature for this project's contract.</p>
          <div class="contract-actions-grid">
            <a href="#" id="pd-contract-preview-btn" target="_blank" class="contract-action-card">
              ${RENDER_ICONS.EYE.replace('width="14"', 'width="24"').replace('height="14"', 'height="24"')} <span>Preview Contract</span>
            </a>
            <a href="#" id="pd-contract-download-btn" class="contract-action-card" download>
              ${RENDER_ICONS.DOWNLOAD} <span>Download PDF</span>
            </a>
            <button type="button" id="pd-contract-sign-btn" class="contract-action-card primary">
              ${RENDER_ICONS.SIGN} <span id="pd-contract-sign-btn-text">Request Signature</span>
            </button>
            <button type="button" id="pd-contract-countersign-btn" class="contract-action-card" style="display: none;">
              ${RENDER_ICONS.COUNTERSIGN} <span>Countersign</span>
            </button>
          </div>
        </div>
        <div class="portal-project-card">
          <div class="card-header-with-action">
            <div>
              <h3>Contract Builder</h3>
              <p class="contract-description">Build a draft, pull from templates, and preview before sending.</p>
            </div>
            <button type="button" class="btn btn-secondary" id="pd-contract-builder-btn">Open Builder</button>
          </div>
          <div class="contract-builder-meta">
            <div class="status-item"><span class="field-label">Template</span><span class="meta-value" id="pd-contract-template-label">Not selected</span></div>
            <div class="status-item"><span class="field-label">Draft</span><span class="meta-value" id="pd-contract-draft-status">No draft yet</span></div>
          </div>
        </div>
        <div class="portal-project-card" id="pd-contract-signature-card" style="display: none;">
          <h3>Signature Details</h3>
          <div class="signature-details">
            <div class="signature-info-row"><span class="field-label">Signed By</span><span class="meta-value" id="pd-contract-signer">-</span></div>
            <div class="signature-info-row"><span class="field-label">Date & Time</span><span class="meta-value" id="pd-contract-signed-datetime">-</span></div>
            <div class="signature-info-row" id="pd-contract-countersign-row" style="display: none;"><span class="field-label">Countersigned By</span><span class="meta-value" id="pd-contract-countersigner">-</span></div>
            <div class="signature-info-row" id="pd-contract-countersign-date-row" style="display: none;"><span class="field-label">Countersigned At</span><span class="meta-value" id="pd-contract-countersigned-datetime">-</span></div>
            <div class="signature-info-row"><span class="field-label">IP Address</span><span class="meta-value" id="pd-contract-signer-ip">-</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Notes Tab -->
    <div class="portal-tab-panel" id="pd-tab-notes">
      <div class="tab-content-wrapper">
        <div class="portal-project-card">
          <div class="card-header-with-action">
            <h3>Admin Notes (Internal)</h3>
            <button class="btn btn-secondary btn-sm" id="btn-edit-project-notes">Edit Notes</button>
          </div>
          <div id="pd-notes-display" class="notes-display">
            <div class="empty-state">No notes yet. Click "Edit Notes" to add internal notes about this project.</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
