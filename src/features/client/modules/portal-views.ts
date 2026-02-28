/**
 * ===============================================
 * PORTAL VIEWS MODULE
 * ===============================================
 * @file src/features/client/modules/portal-views.ts
 *
 * Dynamic view renderers for client portal.
 * Each view is rendered on-demand when navigating to it.
 */

import { ICONS } from '../../../constants/icons';
import { BUSINESS_INFO } from '../../../constants/business';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('PortalViews');

// ============================================================================
// VIEW CONTAINER
// ============================================================================

/** Get the main content container */
function getContentContainer(): HTMLElement | null {
  return document.getElementById('portal-view-content');
}

/** Clear the content container */
export function clearView(): void {
  const container = getContentContainer();
  if (container) {
    container.innerHTML = '';
  }
}

// ============================================================================
// DASHBOARD VIEW
// ============================================================================

export function renderDashboardView(): void {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <!-- Quick Stats -->
    <div class="quick-stats">
      <button class="stat-card stat-card-clickable" data-tab="dashboard" type="button">
        <span class="stat-number">0</span>
        <span class="stat-label">Active Projects</span>
      </button>
      <button class="stat-card stat-card-clickable" data-tab="invoices" type="button">
        <span class="stat-number">0</span>
        <span class="stat-label">Pending Invoices</span>
      </button>
      <button class="stat-card stat-card-clickable" data-tab="messages" type="button">
        <span class="stat-number">0</span>
        <span class="stat-label">Unread Messages</span>
      </button>
    </div>

    <!-- Project Progress & Milestones (Combined) -->
    <div class="project-progress-section" id="project-progress-section">
      <!-- Progress Overview -->
      <div class="progress-overview">
        <div class="section-header-with-actions">
          <h3>Project Progress</h3>
          <span class="progress-percentage" id="progress-percentage">0%</span>
        </div>
        <div
          class="progress-bar"
          role="progressbar"
          aria-valuenow="0"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Project progress"
        >
          <div class="progress-fill" style="width: 0%"></div>
        </div>
      </div>

      <!-- Milestones -->
      <div class="milestones-section" id="milestones-section">
        <div class="section-header-with-actions">
          <h4>Milestones</h4>
          <span class="milestones-summary" id="milestones-summary"></span>
        </div>
        <div class="milestones-list" id="milestones-list">
          <div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading...</span></div>
        </div>
        <p class="milestones-empty" id="milestones-empty" style="display: none;">
          No milestones yet.
        </p>
      </div>
    </div>

    <!-- Pending Approvals -->
    <div class="pending-approvals-section hidden" id="pending-approvals-section">
      <div class="section-header-with-actions">
        <h3>Items Awaiting Your Review</h3>
        <span class="approval-count" id="approval-count"></span>
      </div>
      <div class="approvals-list" id="client-approvals-list">
        <div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading...</span></div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="recent-activity">
      <h3>Recent Activity</h3>
      <ul class="activity-list" id="recent-activity-list" aria-live="polite" aria-atomic="false">
        <li>Loading...</li>
      </ul>
    </div>
  `;
}

// ============================================================================
// FILES VIEW
// ============================================================================

export function renderFilesView(): void {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <!-- Upload Section -->
    <div class="files-upload-section">
      <h3>Upload Files</h3>
      <div class="upload-dropzone" id="upload-dropzone">
        <p class="dropzone-desktop">Drag and drop files here or</p>
        <p class="dropzone-mobile">Tap to select files</p>
        <button class="btn btn-secondary" id="btn-browse-files">Browse Files</button>
        <input type="file" id="file-input" multiple hidden accept=".jpeg,.jpg,.png,.gif,.pdf,.doc,.docx,.txt,.zip,.rar,image/*,application/pdf" />
      </div>
    </div>

    <!-- Files Browser (matching admin structure exactly) -->
    <div class="files-browser">
      <!-- Folder Tree Panel -->
      <div class="folder-panel">
        <div class="folder-panel-header">
          <h4>Folders</h4>
        </div>
        <div class="folder-tree" id="folder-tree">
          <div class="folder-item root active" data-folder-id="root">
            ${ICONS.FOLDER}
            <span>All Files</span>
          </div>
        </div>
      </div>

      <!-- Files List Panel -->
      <div class="files-panel">
        <div class="files-panel-header">
          <div class="files-path" id="files-path">
            <span>All Files</span>
          </div>
        </div>
        <div class="files-list" id="files-list">
          <div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading files...</span></div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// MESSAGES VIEW
// ============================================================================

export function renderMessagesView(): void {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <!-- Messages Layout - Split View (matching admin structure) -->
    <div class="messages-layout">
      <!-- Full-width Search Bar -->
      <div class="messages-global-search">
        <label for="messages-search-input" class="sr-only">Search messages</label>
        <div class="search-bar">
          <span class="search-bar-icon" aria-hidden="true">
            ${ICONS.SEARCH}
          </span>
          <input type="search" id="messages-search-input" class="search-bar-input" placeholder="Search messages..." autocomplete="off" aria-label="Search messages" />
        </div>
      </div>

      <!-- Two Columns Grid -->
      <div class="messages-columns">
        <!-- Left Column: Contact Info & Tips -->
        <div class="messages-clients-column">
          <section class="messages-contact-card" aria-label="Contact information">
            <div class="thread-list-header"><h3>Contact</h3></div>
            <div class="messages-contact-info">
              <p class="messages-contact-item">
                <span class="messages-contact-icon">${ICONS.MAIL}</span>
                <span>${BUSINESS_INFO.email}</span>
              </p>
              <p class="messages-contact-note">Responses within 24 hours</p>
            </div>
          </section>

          <section class="messages-tips-card" aria-label="Tips">
            <div class="thread-list-header"><h3>Tips</h3></div>
            <ul class="messages-tips-list">
              <li>Include project details for faster responses</li>
              <li>Attach screenshots when reporting issues</li>
              <li>Check your email for notifications</li>
            </ul>
          </section>
        </div>

        <!-- Right Column: Thread + Compose -->
        <div class="messages-thread-column">
          <div class="messages-thread" id="messages-thread" aria-live="polite" aria-atomic="false" aria-label="Messages thread">
            <div class="no-messages">
              <p>No messages yet. Send a message to Noelle to get started.</p>
            </div>
          </div>

          <!-- Compose Message -->
          <div class="message-compose">
            <div id="attachment-preview" class="attachment-preview hidden"></div>
            <div class="message-input-wrapper">
              <label for="message-input" class="sr-only">Message</label>
              <textarea
                id="message-input"
                class="form-textarea"
                placeholder="Type your message or drop files here..."
                aria-label="Type your message"
              ></textarea>
            </div>
            <div class="message-compose-actions">
              <button type="button" class="icon-btn btn-attach" id="btn-attach-file" title="Attach files">${ICONS.PAPERCLIP}</button>
              <button class="btn btn-secondary" id="btn-send-message">Send Message</button>
            </div>
            <input type="file" id="attachment-input" class="attachment-input" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt,.zip" />
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// INVOICES VIEW
// ============================================================================

export function renderInvoicesView(): void {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <!-- Invoice Summary -->
    <div class="invoice-summary">
      <div class="summary-card">
        <span class="summary-label">Total Outstanding</span>
        <span class="summary-value" id="invoice-total-outstanding">$0.00</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">Total Paid</span>
        <span class="summary-value" id="invoice-total-paid">$0.00</span>
      </div>
    </div>

    <!-- Invoices List -->
    <div class="invoices-list">
      <h3>Invoice History</h3>
      <div id="invoices-list-content">
        <div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading invoices...</span></div>
      </div>
      <p class="no-invoices-message" id="no-invoices-message" style="display: none;">
        No invoices yet. Your first invoice will appear here once your project begins.
      </p>
    </div>
  `;
}

// ============================================================================
// DOCUMENTS VIEW (Document Requests)
// ============================================================================

export function renderDocumentsView(): void {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <p id="documents-intro" class="documents-intro">Documents we need from you. Open a request to view details and upload.</p>
    <div id="documents-list-wrap" class="documents-list-wrap">
      <div id="documents-list" class="documents-list">
        <div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading document requests...</span></div>
      </div>
      <p id="documents-empty" class="documents-empty" style="display: none;">No document requests.</p>
      <p id="documents-load-error" class="documents-error" style="display: none;"></p>
    </div>
    <div id="documents-detail-wrap" class="documents-detail-wrap" style="display: none;">
      <div class="documents-detail-back">
        <button type="button" id="documents-detail-back" class="btn btn-outline btn-sm">
          ${ICONS.CHEVRON_LEFT}
          <span>BACK</span>
        </button>
      </div>
      <h3 id="documents-detail-title"></h3>
      <p id="documents-detail-description" class="documents-detail-description"></p>
      <p id="documents-detail-meta" class="documents-detail-meta"></p>
      <div id="documents-detail-upload" class="documents-detail-upload" style="display: none;">
        <span class="documents-upload-label">Upload document</span>
        <div class="upload-dropzone documents-dropzone" id="documents-dropzone">
          <div class="dropzone-content">
            ${ICONS.UPLOAD}
            <p class="dropzone-desktop">Drag and drop your document here or</p>
            <p class="dropzone-mobile">Tap to select a document</p>
            <button type="button" class="btn btn-secondary" id="documents-browse-btn">
              Browse Files
            </button>
            <input
              type="file"
              id="documents-file-input"
              class="documents-file-input"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              aria-label="Choose file"
              hidden
            />
          </div>
        </div>
        <div class="documents-upload-actions">
          <button type="button" id="documents-upload-btn" class="btn btn-primary btn-sm" disabled>
            Upload
          </button>
        </div>
        <p class="documents-upload-error" id="documents-upload-error" style="display: none;"></p>
        <p class="documents-upload-hint">
          Accepted: PDF, DOC/DOCX, TXT, JPG/PNG. Max 10MB.
        </p>
      </div>
    </div>
  `;
}

// ============================================================================
// REQUESTS VIEW (Ad Hoc Requests)
// ============================================================================

export function renderRequestsView(): void {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <div class="requests-grid">
      <div class="requests-form portal-card">
        <div class="section-header-with-actions">
          <h3>Request Something New</h3>
        </div>
        <p class="requests-intro">Need an extra feature or change? Send the details here.</p>
        <form id="ad-hoc-request-form" class="requests-form-body">
          <div class="form-group">
            <label class="field-label">Project</label>
            <div id="ad-hoc-project-dropdown"></div>
            <input type="hidden" id="ad-hoc-project" name="project" required />
          </div>
          <div class="form-group">
            <label for="ad-hoc-title" class="field-label">Title</label>
            <input type="text" id="ad-hoc-title" class="form-input" placeholder="Short summary" required autocomplete="off" />
          </div>
          <div class="form-group">
            <label class="field-label">Request type</label>
            <div id="ad-hoc-type-dropdown"></div>
            <input type="hidden" id="ad-hoc-type" name="type" required />
          </div>
          <div class="form-group">
            <label class="field-label">Priority</label>
            <div id="ad-hoc-priority-dropdown"></div>
            <input type="hidden" id="ad-hoc-priority" name="priority" value="normal" />
          </div>
          <div class="form-group">
            <label class="field-label">Urgency</label>
            <div id="ad-hoc-urgency-dropdown"></div>
            <input type="hidden" id="ad-hoc-urgency" name="urgency" value="normal" />
          </div>
          <div class="form-group">
            <label for="ad-hoc-description" class="field-label">Details</label>
            <textarea id="ad-hoc-description" class="form-textarea" placeholder="Describe what you need" required></textarea>
          </div>
          <div class="form-group">
            <label class="field-label">Attachment <span class="field-label-hint">(optional: Add screenshots or mockups if helpful.)</span></label>
            <div class="file-input-wrapper">
              <input type="file" id="ad-hoc-attachment" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" />
              <span class="file-input-text" id="ad-hoc-attachment-text">No file chosen</span>
              <button type="button" class="btn btn-secondary btn-sm file-input-btn" id="ad-hoc-attachment-btn">Choose File</button>
            </div>
          </div>
          <button type="submit" id="ad-hoc-submit-btn" class="btn btn-primary">Submit Request</button>
        </form>
      </div>
      <div class="requests-list portal-card">
        <div class="section-header-with-actions">
          <h3>Your Requests</h3>
          <button type="button" id="ad-hoc-refresh-btn" class="icon-btn" title="Refresh" aria-label="Refresh requests">
            ${ICONS.REFRESH}
          </button>
        </div>
        <div id="ad-hoc-requests-list" class="requests-list-body">
          <div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading requests...</span></div>
        </div>
        <p id="ad-hoc-requests-empty" class="requests-empty" style="display: none;">No requests yet.</p>
        <p id="ad-hoc-requests-error" class="requests-error" style="display: none;"></p>
      </div>
    </div>
  `;
}

// ============================================================================
// QUESTIONNAIRES VIEW
// ============================================================================

export function renderQuestionnairesView(): void {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <div id="questionnaires-list-container" class="questionnaires-list-container">
      <div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading questionnaires...</span></div>
    </div>
  `;
}

// ============================================================================
// HELP VIEW (Knowledge Base)
// ============================================================================

export function renderHelpView(): void {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <!-- Hero Search Section -->
    <div class="help-hero">
      <p class="help-hero-text">How can we help you today?</p>
      <div class="help-search-container">
        <label for="help-search-input" class="sr-only">Search help articles</label>
        <div class="help-search-wrapper">
          <span class="help-search-icon" aria-hidden="true">
            ${ICONS.SEARCH}
          </span>
          <input
            type="search"
            id="help-search-input"
            class="help-search-input"
            placeholder="Search for help articles..."
            autocomplete="off"
            aria-describedby="help-search-hint"
          />
          <button type="button" id="help-search-clear" class="help-search-clear" aria-label="Clear search" style="display: none;">
            ${ICONS.X_SMALL}
          </button>
        </div>
        <div id="help-search-suggestions" class="help-search-suggestions" style="display: none;" role="listbox" aria-label="Search suggestions"></div>
        <p id="help-search-hint" class="help-search-hint">Start typing to see suggestions</p>
      </div>
    </div>

    <!-- Main Content - Two Column Layout -->
    <div id="help-browse" class="help-main-grid">
      <!-- Left Column: Categories Accordion -->
      <section class="help-left-column" id="help-categories-section" aria-label="Browse by category">
        <h3 class="help-section-title">Browse by Category</h3>
        <div id="help-categories-accordion" class="help-accordion">
          <div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading categories...</span></div>
        </div>
        <p id="help-categories-empty" class="help-empty" style="display: none;">No categories available.</p>
      </section>

      <!-- Right Column: Featured OR Article Detail -->
      <div class="help-right-column">
        <!-- Featured Articles (default view) -->
        <section class="help-featured-section" id="help-featured-section" aria-label="Featured articles">
          <h3 class="help-section-title">
            <span class="help-section-icon">${ICONS.ROCKET}</span>
            Quick Start
          </h3>
          <div id="help-featured-list" class="help-featured-list">
            <div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading featured articles...</span></div>
          </div>
          <p id="help-featured-empty" class="help-empty" style="display: none;">No featured articles.</p>
        </section>

        <!-- Article View (hidden by default, replaces featured) -->
        <div id="help-article-view" class="help-article-view" style="display: none;" aria-label="Article">
          <div class="help-article-header">
            <button type="button" id="help-article-back-btn" class="btn btn-outline btn-sm">
              ${ICONS.CHEVRON_LEFT}
              <span>Back</span>
            </button>
            <span id="help-article-category" class="help-article-category-badge"></span>
          </div>
          <article id="help-article-content">
            <h1 id="help-article-title"></h1>
            <div id="help-article-body" class="help-article-body"></div>
          </article>
        </div>

        <!-- Search Results (hidden by default, replaces featured) -->
        <div id="help-search-results" class="help-search-results" style="display: none;" aria-label="Search results">
          <div class="help-results-header">
            <h3 id="help-search-results-title">Search results</h3>
            <button type="button" id="help-search-results-back" class="btn btn-outline btn-sm">
              ${ICONS.X_SMALL}
              <span>Clear</span>
            </button>
          </div>
          <div id="help-search-results-list" class="help-results-list"></div>
        </div>
      </div>
    </div>

    <!-- Contact Section -->
    <section class="help-contact-section" aria-label="Contact support">
      <div class="help-contact-content">
        <div class="help-contact-text">
          <h3 class="help-section-title">Still Need Help?</h3>
          <p class="help-contact-description">Can't find what you're looking for? Send me a message.</p>
        </div>
        <div class="help-contact-actions">
          <a href="#/messages" class="btn btn-primary help-contact-btn" data-action="send-message">
            ${ICONS.SEND}
            <span>Message Noelle</span>
          </a>
          <p class="help-contact-email">
            <span class="help-contact-icon">${ICONS.MAIL}</span>
            <span>${BUSINESS_INFO.email}</span>
          </p>
        </div>
      </div>
    </section>

    <p id="help-load-error" class="help-error" style="display: none;"></p>
  `;
}

// ============================================================================
// SETTINGS VIEW
// ============================================================================

export function renderSettingsView(): void {
  const container = getContentContainer();
  if (!container) return;

  // Render container for React component to mount into
  // The React PortalSettings component handles all settings UI with inline editing
  container.innerHTML = `
    <div class="settings-content" id="settings-content">
      <div class="loading-state">
        <span class="loading-spinner"></span>
        <span>Loading settings...</span>
      </div>
    </div>
  `;
}

// ============================================================================
// NEW PROJECT VIEW (Terminal Intake)
// ============================================================================

export function renderNewProjectView(): void {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <section class="terminal-intake-container portal-intake" id="terminal-intake-container">
      <!-- Terminal UI will be rendered by JavaScript -->
    </section>
  `;
}

// ============================================================================
// PREVIEW VIEW
// ============================================================================

export function renderPreviewView(): void {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <div class="preview-container">
      <div class="preview-toolbar">
        <div class="preview-url">
          <span class="url-icon">${ICONS.GLOBE}</span>
          <span class="url-text" id="preview-url">https://your-project.nobhad.codes</span>
        </div>
        <div class="preview-actions">
          <button class="icon-btn" id="btn-open-new-tab" title="Open in new tab" aria-label="Open preview in new tab">
            ${ICONS.EXTERNAL_LINK}
          </button>
          <button class="icon-btn" id="btn-refresh-preview" title="Refresh preview" aria-label="Refresh preview">
            ${ICONS.REFRESH}
          </button>
        </div>
      </div>
      <div class="preview-frame-wrapper">
        <iframe id="preview-iframe" class="preview-frame" src="" title="Project Preview"></iframe>
      </div>
    </div>
  `;
}

// ============================================================================
// PROJECTS VIEW
// ============================================================================

export function renderProjectsView(): void {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <div class="projects-section">
      <div id="projects-list" class="projects-list">
        <div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading projects...</span></div>
      </div>
    </div>
  `;
}

// ============================================================================
// APPROVALS VIEW
// ============================================================================

export function renderApprovalsView(): void {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <div class="approvals-section">
      <p class="approvals-intro">Review and approve deliverables for your project.</p>
      <div id="approvals-list" class="approvals-list">
        <div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading approvals...</span></div>
      </div>
      <p id="approvals-empty" class="approvals-empty" style="display: none;">No pending approvals.</p>
    </div>
  `;
}

// ============================================================================
// VIEW REGISTRY
// ============================================================================

/** Map of view names to render functions */
export const VIEW_RENDERERS: Record<string, () => void> = {
  dashboard: renderDashboardView,
  projects: renderProjectsView,
  files: renderFilesView,
  messages: renderMessagesView,
  invoices: renderInvoicesView,
  approvals: renderApprovalsView,
  documents: renderDocumentsView,
  requests: renderRequestsView,
  questionnaires: renderQuestionnairesView,
  help: renderHelpView,
  settings: renderSettingsView,
  'new-project': renderNewProjectView,
  preview: renderPreviewView
};

/**
 * Render a view by name
 * Clears the current view and renders the new one
 */
export function renderView(viewName: string): void {
  const renderer = VIEW_RENDERERS[viewName];
  if (renderer) {
    clearView();
    renderer();
  } else {
    logger.warn(`Unknown view: ${viewName}, rendering dashboard`);
    clearView();
    renderDashboardView();
  }
}
