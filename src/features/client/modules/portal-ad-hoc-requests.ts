/**
 * ===============================================
 * PORTAL AD HOC REQUESTS MODULE
 * ===============================================
 * @file src/features/client/modules/portal-ad-hoc-requests.ts
 *
 * Client portal: submit ad hoc requests and view history.
 */

import type { ClientPortalContext } from '../portal-types';
import { createPortalModal } from '../../../components/portal-modal';
import { createModalDropdown } from '../../../components/modal-dropdown';

const REQUESTS_API = '/api/ad-hoc-requests';
const PROJECTS_API = '/api/projects';
const UPLOADS_API = '/api/uploads';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdHocRequest {
  id: number;
  projectId: number;
  title: string;
  description: string;
  status: string;
  requestType: string;
  priority: string;
  urgency: string;
  estimatedHours?: number | null;
  hourlyRate?: number | null;
  flatRate?: number | null;
  quotedPrice?: number | null;
  createdAt: string;
  attachmentFileId?: number | null;
}

interface ProjectOption {
  id: number;
  project_name?: string;
  projectName?: string;
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

const cache = new Map<string, HTMLElement | null>();

function el(id: string): HTMLElement | null {
  if (!cache.has(id)) cache.set(id, document.getElementById(id));
  return cache.get(id) ?? null;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  try {
    const date = new Date(value);
    return date.toLocaleDateString('en-US');
  } catch {
    return value;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getProjectLabel(project: ProjectOption): string {
  return project.project_name || project.projectName || `Project #${project.id}`;
}

function getStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getRequestStatusBadgeClass(status: string): string {
  const statusMap: Record<string, string> = {
    submitted: 'status-pending',
    reviewing: 'status-pending',
    quoted: 'status-pending',
    approved: 'status-active',
    in_progress: 'status-in_progress',
    completed: 'status-completed',
    declined: 'status-cancelled',
    cancelled: 'status-cancelled'
  };

  return statusMap[status] || 'status-pending';
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchProjects(): Promise<ProjectOption[]> {
  const res = await fetch(PROJECTS_API, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const data = (await res.json()) as { projects?: ProjectOption[] };
  return data.projects || [];
}

async function fetchMyRequests(): Promise<AdHocRequest[]> {
  const res = await fetch(`${REQUESTS_API}/my-requests`, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const data = (await res.json()) as { requests?: AdHocRequest[] };
  return data.requests || [];
}

async function respondToQuote(requestId: number, decision: 'approve' | 'decline'): Promise<void> {
  const res = await fetch(`${REQUESTS_API}/my-requests/${requestId}/${decision}`, {
    method: 'POST',
    credentials: 'include'
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { message?: string; error?: string }).message || (err as { error?: string }).error || res.statusText);
  }
}

async function submitRequest(payload: {
  projectId: number;
  title: string;
  description: string;
  requestType: string;
  priority: string;
  urgency: string;
  attachmentFileId?: number | null;
}): Promise<AdHocRequest> {
  const res = await fetch(`${REQUESTS_API}/my-requests`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || 'Failed to submit request');
  }
  return (data as { request: AdHocRequest }).request;
}

async function uploadAttachment(projectId: number, file: File): Promise<number> {
  const formData = new FormData();
  formData.append('project_file', file);

  const res = await fetch(`${UPLOADS_API}/project/${projectId}`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }

  const data = (await res.json()) as { file?: { id?: number } };
  const fileId = data.file?.id;
  if (fileId === null || fileId === undefined || typeof fileId !== 'number') {
    throw new Error('Upload did not return a file id.');
  }

  return fileId;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderRequests(requests: AdHocRequest[]): void {
  const list = el('ad-hoc-requests-list');
  const empty = el('ad-hoc-requests-empty');
  const error = el('ad-hoc-requests-error');
  if (!list || !empty) return;

  if (error) error.style.display = 'none';
  list.innerHTML = '';

  if (!requests.length) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  requests.forEach((request) => {
    const card = document.createElement('div');
    card.className = 'requests-card portal-list-item';
    const attachmentNote = request.attachmentFileId ? '<span>Attachment on file</span>' : '';
    const hasQuoteDetails =
      request.quotedPrice !== null && request.quotedPrice !== undefined ||
      request.flatRate !== null && request.flatRate !== undefined ||
      (request.estimatedHours !== null && request.estimatedHours !== undefined &&
        request.hourlyRate !== null && request.hourlyRate !== undefined);
    const quoteSummary = hasQuoteDetails
      ? `
        <div class="requests-quote">
          <div>Estimated hours: <strong>${request.estimatedHours ?? '—'}</strong></div>
          <div>Hourly rate: <strong>${formatCurrency(request.hourlyRate)}</strong></div>
          <div>Flat rate: <strong>${formatCurrency(request.flatRate)}</strong></div>
          <div>Quoted total: <strong>${formatCurrency(request.quotedPrice)}</strong></div>
        </div>
      `
      : '';
    const quoteActions = request.status === 'quoted'
      ? `
        <div class="requests-quote-actions">
          <button class="btn btn-primary" data-action="approve-quote" data-id="${request.id}">Approve Quote</button>
          <button class="btn btn-secondary" data-action="decline-quote" data-id="${request.id}">Decline Quote</button>
        </div>
      `
      : '';
    card.innerHTML = `
      <div class="requests-card-header">
        <span class="requests-card-title">${escapeHtml(request.title)}</span>
        <span class="requests-card-status status-badge ${getRequestStatusBadgeClass(request.status)}">${escapeHtml(getStatusLabel(request.status))}</span>
      </div>
      <div class="requests-card-meta">
        <span>${escapeHtml(getStatusLabel(request.requestType))}</span>
        <span>Priority: ${escapeHtml(getStatusLabel(request.priority))}</span>
        <span>Urgency: ${escapeHtml(getStatusLabel(request.urgency))}</span>
        ${attachmentNote}
      </div>
      ${quoteSummary}
      <p class="requests-card-description">${escapeHtml(request.description)}</p>
      ${quoteActions}
      <div class="requests-card-footer">Submitted: ${formatDate(request.createdAt)}</div>
    `;
    list.appendChild(card);
  });
}

function formatCurrency(value?: number | null): string {
  if (value === null || value === undefined) return '—';
  return `$${value.toFixed(2)}`;
}

function openQuoteConfirmModal(request: AdHocRequest, decision: 'approve' | 'decline'): Promise<boolean> {
  return new Promise((resolve) => {
    const actionLabel = decision === 'approve' ? 'Approve Quote' : 'Decline Quote';
    const modal = createPortalModal({
      id: `ad-hoc-quote-${decision}-${request.id}`,
      titleId: `ad-hoc-quote-${decision}-title-${request.id}`,
      title: actionLabel,
      contentClassName: 'requests-quote-modal',
      onClose: () => {
        modal.hide();
        modal.overlay.remove();
        resolve(false);
      }
    });

    const body = document.createElement('div');
    body.className = 'requests-quote-modal-body';
    body.innerHTML = `
      <p>${decision === 'approve'
    ? 'You are about to approve this quote.'
    : 'You are about to decline this quote.'}
      </p>
      <div class="requests-quote-modal-summary">
        <div><strong>Request:</strong> ${escapeHtml(request.title)}</div>
        <div><strong>Estimated hours:</strong> ${request.estimatedHours ?? '—'}</div>
        <div><strong>Hourly rate:</strong> ${formatCurrency(request.hourlyRate)}</div>
        <div><strong>Flat rate:</strong> ${formatCurrency(request.flatRate)}</div>
        <div><strong>Quoted total:</strong> ${formatCurrency(request.quotedPrice)}</div>
      </div>
      <p class="requests-quote-modal-note">You can message us if you'd like changes before proceeding.</p>
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.textContent = actionLabel;

    cancelBtn.addEventListener('click', () => {
      modal.hide();
      modal.overlay.remove();
      resolve(false);
    });

    confirmBtn.addEventListener('click', () => {
      modal.hide();
      modal.overlay.remove();
      resolve(true);
    });

    modal.body.appendChild(body);
    modal.footer.appendChild(cancelBtn);
    modal.footer.appendChild(confirmBtn);
    document.body.appendChild(modal.overlay);
    modal.show();
  });
}

function renderProjects(projects: ProjectOption[]): void {
  const mountPoint = el('ad-hoc-project-dropdown');
  const hiddenInput = el('ad-hoc-project') as HTMLInputElement | null;
  if (!mountPoint || !hiddenInput) return;

  mountPoint.innerHTML = '';

  if (!projects.length) {
    mountPoint.innerHTML = '<div class="form-input" style="opacity: 0.5;">No active projects</div>';
    return;
  }

  const options = projects.map(p => ({
    value: String(p.id),
    label: getProjectLabel(p)
  }));

  // Set initial value to first project
  const initialValue = options[0]?.value || '';
  hiddenInput.value = initialValue;

  const dropdown = createModalDropdown({
    options,
    currentValue: initialValue,
    placeholder: 'Select project',
    ariaLabelPrefix: 'Project',
    onChange: (value) => {
      hiddenInput.value = value;
    }
  });
  dropdown.setAttribute('data-modal-dropdown', 'true');
  mountPoint.appendChild(dropdown);
}

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------

function resetForm(): void {
  const form = el('ad-hoc-request-form') as HTMLFormElement | null;
  if (!form) return;
  form.reset();
  // Re-create static dropdowns to reset their display
  createStaticDropdowns();
}

function setSubmitting(isSubmitting: boolean): void {
  const button = el('ad-hoc-submit-btn') as HTMLButtonElement | null;
  if (!button) return;
  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? 'Submitting...' : 'Submit Request';
}

// ---------------------------------------------------------------------------
// Load + listeners
// ---------------------------------------------------------------------------

let listenersAttached = false;
let requestsCache: AdHocRequest[] = [];

async function loadRequests(_ctx: ClientPortalContext): Promise<void> {
  const error = el('ad-hoc-requests-error');
  if (error) error.style.display = 'none';

  try {
    const requests = await fetchMyRequests();
    requestsCache = requests;
    renderRequests(requests);
  } catch (err) {
    if (error) {
      error.textContent = (err as Error).message;
      error.style.display = 'block';
    }
  }
}

function createStaticDropdowns(): void {
  // Request Type dropdown
  const typeMount = el('ad-hoc-type-dropdown');
  const typeInput = el('ad-hoc-type') as HTMLInputElement | null;
  if (typeMount && typeInput) {
    typeMount.innerHTML = '';
    const dropdown = createModalDropdown({
      options: [
        { value: 'feature', label: 'Feature' },
        { value: 'change', label: 'Change' },
        { value: 'bug_fix', label: 'Bug fix' },
        { value: 'enhancement', label: 'Enhancement' },
        { value: 'support', label: 'Support' }
      ],
      currentValue: '',
      placeholder: 'Select type',
      ariaLabelPrefix: 'Request type',
      onChange: (value) => { typeInput.value = value; }
    });
    dropdown.setAttribute('data-modal-dropdown', 'true');
    typeMount.appendChild(dropdown);
  }

  // Priority dropdown
  const priorityMount = el('ad-hoc-priority-dropdown');
  const priorityInput = el('ad-hoc-priority') as HTMLInputElement | null;
  if (priorityMount && priorityInput) {
    priorityMount.innerHTML = '';
    const dropdown = createModalDropdown({
      options: [
        { value: 'normal', label: 'Normal' },
        { value: 'low', label: 'Low' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' }
      ],
      currentValue: 'normal',
      ariaLabelPrefix: 'Priority',
      onChange: (value) => { priorityInput.value = value; }
    });
    dropdown.setAttribute('data-modal-dropdown', 'true');
    priorityMount.appendChild(dropdown);
  }

  // Urgency dropdown
  const urgencyMount = el('ad-hoc-urgency-dropdown');
  const urgencyInput = el('ad-hoc-urgency') as HTMLInputElement | null;
  if (urgencyMount && urgencyInput) {
    urgencyMount.innerHTML = '';
    const dropdown = createModalDropdown({
      options: [
        { value: 'normal', label: 'Normal' },
        { value: 'priority', label: 'Priority' },
        { value: 'urgent', label: 'Urgent' },
        { value: 'emergency', label: 'Emergency' }
      ],
      currentValue: 'normal',
      ariaLabelPrefix: 'Urgency',
      onChange: (value) => { urgencyInput.value = value; }
    });
    dropdown.setAttribute('data-modal-dropdown', 'true');
    urgencyMount.appendChild(dropdown);
  }
}

async function loadProjectsForForm(ctx: ClientPortalContext): Promise<void> {
  try {
    const projects = await fetchProjects();
    renderProjects(projects);
    createStaticDropdowns();
  } catch (err) {
    ctx.showNotification((err as Error).message, 'error');
  }
}

function setupListeners(ctx: ClientPortalContext): void {
  if (listenersAttached) return;
  listenersAttached = true;

  // File input change handler - update display text
  const attachmentInputEl = el('ad-hoc-attachment') as HTMLInputElement | null;
  const attachmentText = el('ad-hoc-attachment-text');
  attachmentInputEl?.addEventListener('change', () => {
    const file = attachmentInputEl.files?.[0];
    if (attachmentText) {
      if (file) {
        attachmentText.textContent = file.name;
        attachmentText.classList.add('has-file');
      } else {
        attachmentText.textContent = 'No file chosen';
        attachmentText.classList.remove('has-file');
      }
    }
  });

  const form = el('ad-hoc-request-form') as HTMLFormElement | null;
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Read values from hidden inputs (set by modal dropdowns)
    const projectInput = el('ad-hoc-project') as HTMLInputElement | null;
    const titleInput = el('ad-hoc-title') as HTMLInputElement | null;
    const typeInput = el('ad-hoc-type') as HTMLInputElement | null;
    const priorityInput = el('ad-hoc-priority') as HTMLInputElement | null;
    const urgencyInput = el('ad-hoc-urgency') as HTMLInputElement | null;
    const descriptionInput = el('ad-hoc-description') as HTMLTextAreaElement | null;
    const attachmentInput = el('ad-hoc-attachment') as HTMLInputElement | null;

    const projectId = projectInput?.value ? Number(projectInput.value) : 0;
    const title = titleInput?.value.trim() || '';
    const requestType = typeInput?.value || '';
    const priority = priorityInput?.value || 'normal';
    const urgency = urgencyInput?.value || 'normal';
    const description = descriptionInput?.value.trim() || '';
    const attachmentFile = attachmentInput?.files?.[0] || null;

    if (!projectId || !title || !description || !requestType) {
      ctx.showNotification('Please complete all required fields.', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const attachmentFileId = attachmentFile
        ? await uploadAttachment(projectId, attachmentFile)
        : null;
      await submitRequest({
        projectId,
        title,
        description,
        requestType,
        priority,
        urgency,
        attachmentFileId
      });
      ctx.showNotification('Request submitted successfully.', 'success');
      resetForm();
      if (attachmentInput) attachmentInput.value = '';
      // Reset file input text display
      const fileText = el('ad-hoc-attachment-text');
      if (fileText) {
        fileText.textContent = 'No file chosen';
        fileText.classList.remove('has-file');
      }
      await loadRequests(ctx);
    } catch (err) {
      ctx.showNotification((err as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  });

  const refreshBtn = el('ad-hoc-refresh-btn');
  refreshBtn?.addEventListener('click', () => loadRequests(ctx));

  const list = el('ad-hoc-requests-list');
  list?.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const actionBtn = target.closest('button[data-action]') as HTMLButtonElement | null;
    if (!actionBtn) return;

    const requestId = Number(actionBtn.dataset.id);
    const action = actionBtn.dataset.action;
    if (!requestId || !action) return;

    const request = requestsCache.find((item) => item.id === requestId);
    if (!request) return;

    const decision = action === 'approve-quote' ? 'approve' : 'decline';
    const confirmed = await openQuoteConfirmModal(request, decision);
    if (!confirmed) return;

    try {
      actionBtn.disabled = true;
      await respondToQuote(requestId, decision);
      ctx.showNotification('Quote response saved.', 'success');
      await loadRequests(ctx);
    } catch (err) {
      ctx.showNotification((err as Error).message, 'error');
    } finally {
      actionBtn.disabled = false;
    }
  });
}

export async function loadAdHocRequests(ctx: ClientPortalContext): Promise<void> {
  await loadProjectsForForm(ctx);
  await loadRequests(ctx);
  setupListeners(ctx);
}
