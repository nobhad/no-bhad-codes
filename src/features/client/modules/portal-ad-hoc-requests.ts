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
    card.className = 'requests-card';
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
        <span class="requests-card-status requests-status-${request.status}">${escapeHtml(getStatusLabel(request.status))}</span>
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
  const select = el('ad-hoc-project') as HTMLSelectElement | null;
  if (!select) return;

  select.innerHTML = '';

  if (!projects.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No active projects';
    select.appendChild(option);
    select.disabled = true;
    return;
  }

  select.disabled = false;
  projects.forEach((project) => {
    const option = document.createElement('option');
    option.value = String(project.id);
    option.textContent = getProjectLabel(project);
    select.appendChild(option);
  });
}

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------

function resetForm(): void {
  const form = el('ad-hoc-request-form') as HTMLFormElement | null;
  if (!form) return;
  form.reset();
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

async function loadRequests(ctx: ClientPortalContext): Promise<void> {
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

async function loadProjectsForForm(ctx: ClientPortalContext): Promise<void> {
  try {
    const projects = await fetchProjects();
    renderProjects(projects);
  } catch (err) {
    ctx.showNotification((err as Error).message, 'error');
  }
}

function setupListeners(ctx: ClientPortalContext): void {
  if (listenersAttached) return;
  listenersAttached = true;

  const form = el('ad-hoc-request-form') as HTMLFormElement | null;
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const projectSelect = el('ad-hoc-project') as HTMLSelectElement | null;
    const titleInput = el('ad-hoc-title') as HTMLInputElement | null;
    const typeSelect = el('ad-hoc-type') as HTMLSelectElement | null;
    const prioritySelect = el('ad-hoc-priority') as HTMLSelectElement | null;
    const urgencySelect = el('ad-hoc-urgency') as HTMLSelectElement | null;
    const descriptionInput = el('ad-hoc-description') as HTMLTextAreaElement | null;
    const attachmentInput = el('ad-hoc-attachment') as HTMLInputElement | null;

    const projectId = projectSelect?.value ? Number(projectSelect.value) : 0;
    const title = titleInput?.value.trim() || '';
    const requestType = typeSelect?.value || '';
    const priority = prioritySelect?.value || 'normal';
    const urgency = urgencySelect?.value || 'normal';
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
