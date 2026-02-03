/**
 * ===============================================
 * PORTAL DOCUMENT REQUESTS MODULE
 * ===============================================
 * @file src/features/client/modules/portal-document-requests.ts
 *
 * Documents tab: list document requests, view one, mark viewed, upload.
 * Uses /api/document-requests (my-requests, :id/view, :id/upload).
 */

import type { ClientPortalContext } from '../portal-types';

const DOC_REQUESTS_API = '/api/document-requests';
const UPLOADS_API = '/api/uploads';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentRequest {
  id: number;
  title: string;
  description?: string;
  status: string;
  due_date?: string;
  created_at: string;
  uploaded_at?: string;
}

interface MyRequestsResponse {
  requests: DocumentRequest[];
  stats?: { total: number; pending: number; uploaded: number };
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const cache = new Map<string, HTMLElement | null>();

function el(id: string): HTMLElement | null {
  if (!cache.has(id)) cache.set(id, document.getElementById(id));
  return cache.get(id) ?? null;
}

function formatDate(s: string | undefined): string {
  if (!s) return '—';
  try {
    const date = new Date(s);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  } catch {
    return s;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchMyRequests(): Promise<MyRequestsResponse> {
  const res = await fetch(`${DOC_REQUESTS_API}/my-requests`, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<MyRequestsResponse>;
}

async function markViewed(requestId: number): Promise<void> {
  const res = await fetch(`${DOC_REQUESTS_API}/${requestId}/view`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Failed to mark as viewed');
}

async function uploadForRequest(requestId: number, fileId: number, _ctx: ClientPortalContext): Promise<void> {
  const res = await fetch(`${DOC_REQUESTS_API}/${requestId}/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

// ---------------------------------------------------------------------------
// Render list
// ---------------------------------------------------------------------------

function renderList(requests: DocumentRequest[], _ctx: ClientPortalContext): void {
  const list = el('documents-list');
  const empty = el('documents-empty');
  const errEl = el('documents-load-error');
  if (!list || !empty) return;
  if (errEl) errEl.style.display = 'none';

  list.innerHTML = '';
  if (!requests.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  for (const r of requests) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'documents-card';
    card.setAttribute('data-request-id', String(r.id));
    card.innerHTML = `
      <span class="documents-card-title">${escapeHtml(r.title)}</span>
      <span class="documents-card-status documents-status-${r.status}">${escapeHtml(r.status)}</span>
      <span class="documents-card-due">Due: ${formatDate(r.due_date)}</span>
    `;
    list.appendChild(card);
  }
}

// ---------------------------------------------------------------------------
// Show / hide detail
// ---------------------------------------------------------------------------

function showList(): void {
  el('documents-list-wrap')?.style.setProperty('display', 'block');
  el('documents-detail-wrap')?.style.setProperty('display', 'none');
}

function showDetail(): void {
  el('documents-list-wrap')?.style.setProperty('display', 'none');
  el('documents-detail-wrap')?.style.setProperty('display', 'block');
}

// ---------------------------------------------------------------------------
// Load and show detail for one request
// ---------------------------------------------------------------------------

let currentRequestId: number | null = null;
let firstProjectId: number | null = null;
let requestsCache: DocumentRequest[] = [];

async function openDetail(request: DocumentRequest, _ctx: ClientPortalContext): Promise<void> {
  currentRequestId = request.id;
  showDetail();

  const titleEl = el('documents-detail-title');
  const descEl = el('documents-detail-description');
  const metaEl = el('documents-detail-meta');
  const uploadWrap = el('documents-detail-upload');
  const fileInput = document.getElementById('documents-file-input') as HTMLInputElement | null;
  const uploadBtn = el('documents-upload-btn');

  if (titleEl) titleEl.textContent = request.title;
  if (descEl) descEl.textContent = request.description || 'No description.';
  if (metaEl) metaEl.textContent = `Due: ${formatDate(request.due_date)} · Status: ${request.status}`;

  const canUpload = request.status === 'pending' || request.status === 'sent';
  if (uploadWrap) uploadWrap.style.display = canUpload ? 'block' : 'none';
  if (fileInput) fileInput.value = '';
  if (uploadBtn) (uploadBtn as HTMLButtonElement).disabled = true;

  try {
    await markViewed(request.id);
  } catch {
    // non-blocking
  }
}

// ---------------------------------------------------------------------------
// Upload flow: upload file to project, then attach to request
// ---------------------------------------------------------------------------

async function doUpload(ctx: ClientPortalContext): Promise<void> {
  const requestId = currentRequestId;
  const fileInput = document.getElementById('documents-file-input') as HTMLInputElement | null;
  if (!requestId || !fileInput?.files?.length) return;

  const file = fileInput.files[0];
  let projectId = firstProjectId;

  if (projectId === null || projectId === undefined) {
    try {
      const projRes = await fetch('/api/projects', { credentials: 'include' });
      if (!projRes.ok) throw new Error('Failed to load projects');
      const data = (await projRes.json()) as { projects?: { id: number }[] };
      const projects = data.projects || [];
      projectId = projects[0]?.id ?? null;
      firstProjectId = projectId;
    } catch (e) {
      ctx.showNotification((e as Error).message, 'error');
      return;
    }
  }

  if (projectId === null || projectId === undefined) {
    ctx.showNotification('You need at least one project to upload. Start a project first.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('project_file', file);

  try {
    const uploadRes = await fetch(`${UPLOADS_API}/project/${projectId}`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({ error: uploadRes.statusText }));
      throw new Error((err as { error?: string }).error || uploadRes.statusText);
    }
    const uploadData = (await uploadRes.json()) as { file?: { id?: number } };
    const fileId = uploadData.file?.id;
    if (fileId === null || fileId === undefined || typeof fileId !== 'number') {
      throw new Error('Upload did not return a file id.');
    }
    await uploadForRequest(requestId, fileId, ctx);
    ctx.showNotification('Document uploaded successfully.', 'success');
    fileInput.value = '';
    (el('documents-upload-btn') as HTMLButtonElement).disabled = true;
    await loadDocumentRequests(ctx);
    showList();
  } catch (e) {
    ctx.showNotification((e as Error).message, 'error');
  }
}

// ---------------------------------------------------------------------------
// One-time listeners
// ---------------------------------------------------------------------------

let docListenersSetup = false;

function setupListeners(ctx: ClientPortalContext): void {
  if (docListenersSetup) return;
  docListenersSetup = true;

  el('documents-list')?.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest('.documents-card[data-request-id]');
    if (!card) return;
    const id = parseInt(card.getAttribute('data-request-id')!, 10);
    const request = requestsCache.find((r) => r.id === id);
    if (request) openDetail(request, ctx);
  });

  el('documents-detail-back')?.addEventListener('click', () => {
    currentRequestId = null;
    showList();
  });

  const fileInput = document.getElementById('documents-file-input');
  fileInput?.addEventListener('change', () => {
    const btn = el('documents-upload-btn') as HTMLButtonElement | null;
    if (btn) btn.disabled = !(fileInput as HTMLInputElement).files?.length;
  });

  el('documents-upload-btn')?.addEventListener('click', () => doUpload(ctx));
}

// ---------------------------------------------------------------------------
// Main load
// ---------------------------------------------------------------------------

export async function loadDocumentRequests(ctx: ClientPortalContext): Promise<void> {
  setupListeners(ctx);

  const list = el('documents-list');
  const empty = el('documents-empty');
  const errEl = el('documents-load-error');
  if (list) list.innerHTML = '<p class="documents-loading">Loading...</p>';
  if (empty) empty.style.display = 'none';
  if (errEl) errEl.style.display = 'none';

  showList();

  try {
    const data = await fetchMyRequests();
    const requests = data.requests || [];
    requestsCache = requests;
    renderList(requests, ctx);
  } catch (e) {
    if (list) list.innerHTML = '';
    if (empty) empty.style.display = 'none';
    if (errEl) {
      errEl.textContent = (e as Error).message;
      errEl.style.display = 'block';
    }
    ctx.showNotification((e as Error).message, 'error');
  }
}
