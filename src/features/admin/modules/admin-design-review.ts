/**
 * ============================================
 * DESIGN REVIEW MODULE
 * ============================================
 * Complete design review system for deliverables
 * with annotations, approval tracking, and PDF export
 */

import { createPortalModal } from '../../../components/portal-modal';
import { AnnotationCanvas, createAnnotationCanvas, type Annotation } from '../../../components/annotation-canvas';
import { showToast } from '../../../utils/toast-notifications';

// Simple DOM helper
function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

interface Deliverable {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'reviewing' | 'approved' | 'revisions_requested';
  projectId: number;
  roundNumber: number;
}

interface DesignElement {
  id: number;
  name: string;
  approvalStatus: 'pending' | 'approved' | 'revisions_needed';
}

const API_BASE = '/api/v1/deliverables';
let currentDeliverable: Deliverable | null = null;
let currentRound = 1;
let annotationCanvas: AnnotationCanvas | null = null;
let designElements: DesignElement[] = [];

/**
 * Initialize design review system
 */
export async function initializeDesignReview(): Promise<void> {
  // Add design review tab to admin interface if needed
  const reviewButton = createDesignReviewButton();
  if (reviewButton) {
    document.body.appendChild(reviewButton);
  }
}

/**
 * Open design review modal for a deliverable
 */
export async function openDesignReview(deliverableId: number): Promise<void> {
  try {
    // Fetch deliverable
    const res = await fetch(`${API_BASE}/${deliverableId}`);
    if (!res.ok) throw new Error('Failed to fetch deliverable');

    const { deliverable } = await res.json();
    currentDeliverable = deliverable;
    currentRound = deliverable.roundNumber || 1;

    // Load design elements
    await loadDesignElements(deliverableId);

    // Create and show modal
    showDesignReviewModal();
  } catch (error) {
    showToast('Failed to load design review', 'error');
    console.error(error);
  }
}

/**
 * Load design elements for this deliverable
 */
async function loadDesignElements(deliverableId: number): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/${deliverableId}/design-elements`);
    if (res.ok) {
      const { elements } = await res.json();
      designElements = elements || [];
    }
  } catch (error) {
    console.warn('Failed to load design elements:', error);
    designElements = [];
  }
}

/**
 * Show design review modal
 */
async function showDesignReviewModal(): Promise<void> {
  if (!currentDeliverable) return;

  const modal = createPortalModal({
    id: 'design-review-modal',
    titleId: 'design-review-modal-title',
    title: `Design Review: ${currentDeliverable.title}`,
    contentClassName: 'design-review-modal-content modal-content-wide',
    onClose: () => modal.hide()
  });

  // Setup modal content
  modal.body.innerHTML = `
    <div class="design-review-container">
      <!-- Left: Deliverable viewer -->
      <div class="design-review-viewer">
        <div class="design-viewer-header">
          <div class="round-selector">
            <label>Design Round:</label>
            <select id="design-round-select" class="portal-input">
              <option value="1">Round 1</option>
              <option value="2">Round 2</option>
              <option value="3">Final Round</option>
            </select>
          </div>
          <div class="view-controls">
            <button id="design-zoom-in" class="icon-btn" title="Zoom In" aria-label="Zoom In">+</button>
            <button id="design-zoom-out" class="icon-btn" title="Zoom Out" aria-label="Zoom Out">−</button>
            <span id="design-zoom-level">100%</span>
          </div>
        </div>
        <div id="design-canvas-container" class="design-canvas-container">
          <!-- Canvas will be inserted here -->
        </div>
      </div>

      <!-- Right: Annotation tools & approval -->
      <div class="design-review-sidebar">
        <!-- Annotation tools -->
        <div class="annotation-tools-section">
          <h3>Annotation Tools</h3>
          <div class="tool-buttons">
            <button class="tool-btn pointer-tool" data-tool="pointer" title="Pointer (no annotation)">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <button class="tool-btn draw-tool active" data-tool="draw" title="Draw annotation">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="tool-btn highlight-tool" data-tool="highlight" title="Highlight area">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            <button class="tool-btn text-tool" data-tool="text" title="Add text comment">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>

          <!-- Color selector -->
          <div class="color-selector">
            <label>Color:</label>
            <div class="color-buttons">
              <button class="color-btn red-btn active" data-color="red" style="background-color: #ef4444;" title="Red"></button>
              <button class="color-btn yellow-btn" data-color="yellow" style="background-color: #eab308;" title="Yellow"></button>
              <button class="color-btn blue-btn" data-color="blue" style="background-color: #3b82f6;" title="Blue"></button>
              <button class="color-btn green-btn" data-color="green" style="background-color: #22c55e;" title="Green"></button>
            </div>
          </div>

          <button id="design-clear-annotations" class="btn btn-secondary btn-sm">Clear All</button>
        </div>

        <!-- Design elements approval -->
        <div class="design-elements-section">
          <h3>Design Elements</h3>
          <div id="design-elements-list" class="design-elements-list">
            <!-- Will be populated dynamically -->
          </div>
        </div>

        <!-- Action buttons -->
        <div class="design-review-actions">
          <button id="design-request-revision" class="btn btn-secondary">Request Revision</button>
          <button id="design-approve-all" class="btn btn-primary">Approve Design</button>
        </div>
      </div>
    </div>
  `;

  // Load deliverable image/file
  await setupDesignViewer();

  // Setup event handlers
  setupAnnotationTools(modal);
  setupElementApproval(modal);
  setupRoundSelector(modal);

  modal.footer.innerHTML = `
    <button type="button" class="btn btn-secondary" id="design-export-pdf">Export Feedback as PDF</button>
    <button type="button" class="btn btn-secondary" id="design-close-btn">Close</button>
  `;

  el('design-export-pdf')?.addEventListener('click', () => exportFeedbackPDF());
  el('design-close-btn')?.addEventListener('click', () => modal.hide());

  modal.show();
}

/**
 * Setup design viewer with image/deliverable
 */
async function setupDesignViewer(): Promise<void> {
  if (!currentDeliverable) return;

  const container = el('design-canvas-container');
  if (!container) return;

  try {
    // Fetch latest version
    const res = await fetch(`${API_BASE}/${currentDeliverable.id}/versions/latest`);
    if (!res.ok) {
      container.innerHTML = '<div class="error-message">No design files uploaded</div>';
      return;
    }

    const { version } = await res.json();

    // Create annotation canvas
    annotationCanvas = await createAnnotationCanvas(version.filePath, container);

    // Setup zoom controls
    const zoomInBtn = el('design-zoom-in');
    const zoomOutBtn = el('design-zoom-out');
    const zoomLevel = el('design-zoom-level');
    let currentZoom = 1;

    zoomInBtn?.addEventListener('click', () => {
      currentZoom = Math.min(currentZoom + 0.2, 3);
      annotationCanvas?.setZoom(currentZoom);
      if (zoomLevel) zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
    });

    zoomOutBtn?.addEventListener('click', () => {
      currentZoom = Math.max(currentZoom - 0.2, 0.5);
      annotationCanvas?.setZoom(currentZoom);
      if (zoomLevel) zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
    });
  } catch (error) {
    console.error('Failed to setup design viewer:', error);
    const container = el('design-canvas-container');
    if (container) {
      container.innerHTML = '<div class="error-message">Failed to load design file</div>';
    }
  }
}

/**
 * Setup annotation tools
 */
function setupAnnotationTools(modal: any): void {
  if (!annotationCanvas) return;

  // Tool buttons
  document.querySelectorAll('.tool-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
      (e.currentTarget as HTMLElement).classList.add('active');
      const tool = (e.currentTarget as HTMLElement).dataset.tool;
      annotationCanvas?.setTool(tool as any);
    });
  });

  // Color buttons
  document.querySelectorAll('.color-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.color-btn').forEach((b) => b.classList.remove('active'));
      (e.currentTarget as HTMLElement).classList.add('active');
      const color = (e.currentTarget as HTMLElement).dataset.color;
      annotationCanvas?.setColor(color as any);
    });
  });

  // Clear button
  el('design-clear-annotations')?.addEventListener('click', () => {
    if (confirm('Clear all annotations?')) {
      annotationCanvas?.clearAnnotations();
    }
  });

  // Set annotation callback
  annotationCanvas.setOnAnnotationAdded(async (annotation: Annotation) => {
    // Save annotation to server
    if (!currentDeliverable) return;

    try {
      const userId = localStorage.getItem('adminUserId') || '1';
      await fetch(`${API_BASE}/${currentDeliverable.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: userId,
          text: annotation.text || `${annotation.type} annotation (${annotation.color})`,
          x: annotation.x,
          y: annotation.y,
          annotationType: annotation.type,
          elementId: annotation.elementId
        })
      });
    } catch (error) {
      console.error('Failed to save annotation:', error);
    }
  });
}

/**
 * Setup element approval
 */
function setupElementApproval(modal: any): void {
  const elementsList = el('design-elements-list');
  if (!elementsList) return;

  elementsList.innerHTML = designElements
    .map(
      (el) =>
        `
    <div class="design-element-item" data-element-id="${el.id}">
      <div class="element-name">${el.name}</div>
      <div class="element-approval">
        <button class="approval-btn pending ${el.approvalStatus === 'pending' ? 'active' : ''}" data-status="pending">
          Pending
        </button>
        <button class="approval-btn approved ${el.approvalStatus === 'approved' ? 'active' : ''}" data-status="approved">
          Approved
        </button>
        <button class="approval-btn revisions ${el.approvalStatus === 'revisions_needed' ? 'active' : ''}" data-status="revisions_needed">
          Revisions
        </button>
      </div>
    </div>
  `
    )
    .join('');

  // Add event listeners
  document.querySelectorAll('.approval-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const button = e.currentTarget as HTMLElement;
      const item = button.closest('.design-element-item') as HTMLElement;
      const elementId = item?.dataset.elementId;
      const status = button.dataset.status;

      // Update UI
      item
        ?.querySelectorAll('.approval-btn')
        .forEach((b) => b.classList.remove('active'));
      button.classList.add('active');

      // Save to server
      if (currentDeliverable && elementId) {
        try {
          await fetch(`${API_BASE}/${currentDeliverable.id}/design-elements/${elementId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvalStatus: status })
          });
        } catch (error) {
          console.error('Failed to update element approval:', error);
        }
      }
    });
  });
}

/**
 * Setup round selector
 */
function setupRoundSelector(modal: any): void {
  const select = el('design-round-select') as HTMLSelectElement;
  if (!select) return;

  select.value = currentRound.toString();
  select.addEventListener('change', (e) => {
    currentRound = parseInt((e.currentTarget as HTMLSelectElement).value);
    // Reload design for this round
    setupDesignViewer();
  });
}

/**
 * Export feedback as PDF
 */
async function exportFeedbackPDF(): Promise<void> {
  if (!currentDeliverable || !annotationCanvas) return;

  try {
    showToast('Preparing PDF export...', 'info');

    // Create printable HTML document
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Design Review Feedback - ${currentDeliverable.title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          page { display: block; page-break-after: always; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ddd; padding-bottom: 20px; }
          h1 { font-size: 24px; margin-bottom: 10px; }
          .meta { font-size: 13px; color: #666; }
          .meta-item { display: inline-block; margin-right: 20px; }
          .image-container { text-align: center; margin: 30px 0; }
          .image-container img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; }
          .elements-section { margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; }
          h2 { font-size: 16px; margin-bottom: 15px; color: #222; }
          .element-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
          .element-name { font-weight: 600; }
          .element-status { padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
          .status-approved { background: #d4edda; color: #155724; }
          .status-revisions { background: #f8d7da; color: #721c24; }
          .status-pending { background: #fff3cd; color: #856404; }
          @media print { body { padding: 0; } page { padding: 20px; } }
        </style>
      </head>
      <body>
        <page>
          <div class="header">
            <h1>Design Review Feedback</h1>
            <p class="meta">
              <span class="meta-item"><strong>Project:</strong> ${currentDeliverable.title}</span>
              <span class="meta-item"><strong>Round:</strong> ${currentRound}</span>
              <span class="meta-item"><strong>Date:</strong> ${new Date().toLocaleDateString()}</span>
            </p>
          </div>

          <div class="image-container">
            <img src="${annotationCanvas.getCanvasImage()}" alt="Design with annotations">
          </div>

          ${
  designElements.length > 0
    ? `
            <div class="elements-section">
              <h2>Design Elements Approval Status</h2>
              ${designElements
    .map(
      (el) => `
                <div class="element-item">
                  <span class="element-name">${el.name}</span>
                  <span class="element-status status-${el.approvalStatus === 'approved' ? 'approved' : el.approvalStatus === 'revisions_needed' ? 'revisions' : 'pending'}">
                    ${el.approvalStatus === 'approved' ? '✓ Approved' : el.approvalStatus === 'revisions_needed' ? '✗ Revisions Needed' : '○ Pending'}
                  </span>
                </div>
              `
    )
    .join('')}
            </div>
          `
    : ''
}

          <p style="margin-top: 40px; font-size: 12px; color: #999;">
            This document was generated on ${new Date().toLocaleString()}
          </p>
        </page>
      </body>
      </html>
    `;

    // Open in new window for printing
    const printWindow = window.open('', '', 'width=1200,height=800');
    if (!printWindow) {
      showToast('Failed to open print window. Please check popup blockers.', 'error');
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.print();
    };

    showToast('PDF ready - use your browser\'s print dialog to save as PDF', 'success');
  } catch (error) {
    showToast('Failed to prepare PDF export', 'error');
    console.error(error);
  }
}

/**
 * Create design review button for admin interface
 */
function createDesignReviewButton(): HTMLElement | null {
  // This would be integrated into the admin UI
  return null;
}
