/**
 * Contract Action Handlers
 * @file src/features/admin/project-details/actions-contracts.ts
 *
 * Handles contract-related actions: signing and countersigning.
 * Contract builder extracted to: ./actions-contract-builder.ts
 */

import { apiFetch } from '../../../utils/api-client';
import { showToast } from '../../../utils/toast-notifications';
import {
  confirmDialog,
  alertError
} from '../../../utils/confirm-dialog';
import { formatDate } from '../../../utils/format-utils';
import type { ProjectResponse } from '../../../types/api';
import { ICONS } from '../../../constants/icons';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('ProjectActionsContracts');

// Re-export contract builder for backward compatibility
export { showContractBuilder } from './actions-contract-builder';

/**
 * Handle contract sign button click
 */
export async function handleContractSign(
  projectId: number,
  projectsData: ProjectResponse[]
): Promise<void> {
  const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
  if (!project) return;

  if (project.contract_signed_at) {
    showToast(`Contract signed on ${formatDate(project.contract_signed_at)}`, 'info');
    return;
  }

  const confirmed = await confirmDialog({
    title: 'Request Contract Signature',
    message: `Send a contract signature request to ${project.client_name || 'the client'}?\n\nThe client will receive an email with a link to review and sign the contract.`,
    confirmText: 'Send Request',
    cancelText: 'Cancel',
    icon: 'question'
  });

  if (!confirmed) return;

  try {
    const response = await apiFetch(`/api/projects/${projectId}/contract/request-signature`, {
      method: 'POST'
    });

    if (response.ok) {
      showToast('Signature request sent successfully', 'success');
    } else {
      const error = await response.json();
      showToast(error.message || 'Failed to send signature request', 'error');
    }
  } catch (error) {
    logger.error('Error requesting signature:', error);
    showToast('Failed to send signature request', 'error');
  }
}

/**
 * Handle contract countersign (admin)
 */
export async function handleContractCountersign(
  projectId: number,
  projectsData: ProjectResponse[]
): Promise<void> {
  const project = projectsData.find((p: ProjectResponse) => p.id === projectId);
  if (!project) return;

  if (!project.contract_signed_at) {
    showToast('Client signature is required before countersigning.', 'warning');
    return;
  }

  if (project.contract_countersigned_at) {
    showToast('Contract already countersigned.', 'info');
    return;
  }

  const { createPortalModal } = await import('../../../components/portal-modal');

  const modal = createPortalModal({
    id: 'contract-countersign-modal',
    titleId: 'contract-countersign-title',
    title: 'Countersign Contract',
    icon: ICONS.PENCIL,
    contentClassName: 'contract-countersign-modal',
    onClose: () => {
      modal.hide();
      modal.overlay.remove();
    }
  });

  const form = document.createElement('form');
  form.className = 'contract-countersign-form flex flex-col gap-2';
  form.innerHTML = `
    <div class="portal-form-group">
      <label for="contract-countersign-name">Signer Name</label>
      <input class="portal-input" id="contract-countersign-name" name="signerName" placeholder="Your name" required />
    </div>
    <div class="contract-signature-pad flex flex-col gap-1">
      <div class="signature-canvas-wrap">
        <canvas id="contract-countersign-canvas" width="520" height="180"></canvas>
      </div>
      <div class="signature-actions">
        <button type="button" class="btn btn-outline" id="contract-countersign-clear">Clear</button>
      </div>
      <p class="signature-hint">Draw your signature above using your mouse or trackpad.</p>
    </div>
  `;

  modal.body.appendChild(form);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-outline';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    modal.hide();
    modal.overlay.remove();
  });

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary';
  submitBtn.textContent = 'Countersign';

  modal.footer.appendChild(cancelBtn);
  modal.footer.appendChild(submitBtn);

  document.body.appendChild(modal.overlay);
  modal.show();

  setupCountersignCanvas(form, projectId, modal, submitBtn);
}

function setupCountersignCanvas(
  form: HTMLFormElement,
  projectId: number,
  modal: { hide: () => void; overlay: HTMLElement },
  submitBtn: HTMLButtonElement
): void {
  const canvas = form.querySelector('#contract-countersign-canvas') as HTMLCanvasElement | null;
  const clearBtn = form.querySelector('#contract-countersign-clear') as HTMLButtonElement | null;
  const nameInput = form.querySelector('#contract-countersign-name') as HTMLInputElement | null;

  if (!canvas || !clearBtn || !nameInput) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let isDrawing = false;
  let hasSignature = false;

  const strokeColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--portal-text-light')
    .trim();
  ctx.strokeStyle = strokeColor || 'currentColor';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const getPosition = (event: MouseEvent | TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (event instanceof MouseEvent) {
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    const touch = event.touches[0];
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const startDrawing = (event: MouseEvent | TouchEvent) => {
    event.preventDefault();
    isDrawing = true;
    const { x, y } = getPosition(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (event: MouseEvent | TouchEvent) => {
    if (!isDrawing) return;
    event.preventDefault();
    const { x, y } = getPosition(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasSignature = true;
  };

  const stopDrawing = () => {
    isDrawing = false;
  };

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);
  canvas.addEventListener('touchstart', startDrawing);
  canvas.addEventListener('touchmove', draw);
  canvas.addEventListener('touchend', stopDrawing);

  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature = false;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!nameInput.value.trim()) {
      alertError('Signer name is required.');
      return;
    }

    if (!hasSignature) {
      alertError('Please draw your signature before submitting.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const response = await apiFetch(`/api/projects/${projectId}/contract/countersign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerName: nameInput.value.trim(),
          signatureData: canvas.toDataURL('image/png')
        })
      });

      if (response.ok) {
        showToast('Contract countersigned successfully.', 'success');
        modal.hide();
        modal.overlay.remove();
      } else {
        const error = await response.json().catch(() => ({}));
        alertError(error.error || 'Failed to countersign contract.');
      }
    } catch (error) {
      logger.error(' Error countersigning contract:', error);
      alertError('Failed to countersign contract. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Countersign';
    }
  });
}
