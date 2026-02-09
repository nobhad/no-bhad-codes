/**
 * Invoice Creation Modals Module
 * @file src/features/admin/project-details/invoice-modals.ts
 *
 * Handles invoice creation modal UI and logic.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { AdminAuth } from '../admin-auth';
import { apiPost } from '../../../utils/api-client';
import { alertError, alertSuccess, alertWarning } from '../../../utils/confirm-dialog';
import { initModalDropdown } from '../../../utils/modal-dropdown';
import { createPortalModal } from '../../../components/portal-modal';
import type { ProjectResponse } from '../../../types/api';
import type { InvoiceLineItem } from './types';

/**
 * Show custom modal to create a new invoice with multiple line items
 */
export function showCreateInvoicePrompt(
  projectId: number,
  project: ProjectResponse,
  onSuccess: () => void
): void {
  // Line items data
  const lineItems: InvoiceLineItem[] = [
    { description: 'Web Development Services', quantity: 1, rate: project.price || 500 }
  ];

  // Create modal using portal modal component
  const modal = createPortalModal({
    id: 'create-invoice-modal',
    titleId: 'create-invoice-modal-title',
    title: 'Create Invoice',
    contentClassName: 'invoice-modal-content',
    onClose: () => modal.hide()
  });

  // Helper functions (defined before use)
  const saveCurrentValues = (): void => {
    const rows = modal.body.querySelectorAll('.line-item-row');
    rows.forEach((row, index) => {
      if (lineItems[index]) {
        const desc = row.querySelector('.line-item-desc') as HTMLInputElement;
        const qty = row.querySelector('.line-item-qty') as HTMLInputElement;
        const rate = row.querySelector('.line-item-rate') as HTMLInputElement;
        lineItems[index].description = desc?.value || '';
        lineItems[index].quantity = parseInt(qty?.value) || 1;
        lineItems[index].rate = parseFloat(rate?.value) || 0;
      }
    });
  };

  const updateLineItemAmounts = (): void => {
    const rows = modal.body.querySelectorAll('.line-item-row');
    let total = 0;
    rows.forEach((row) => {
      const qty = parseFloat((row.querySelector('.line-item-qty') as HTMLInputElement)?.value) || 1;
      const rate = parseFloat((row.querySelector('.line-item-rate') as HTMLInputElement)?.value) || 0;
      const amount = qty * rate;
      total += amount;
      const amountSpan = row.querySelector('.line-item-amount');
      if (amountSpan) amountSpan.textContent = `$${amount.toFixed(2)}`;
    });
    const totalEl = modal.body.querySelector('.invoice-total strong');
    if (totalEl) totalEl.textContent = `Total: $${total.toFixed(2)}`;
  };

  const submitInvoice = async (): Promise<void> => {
    saveCurrentValues();

    // Validate line items
    const validLineItems = lineItems.filter(item => item.description.trim() && item.rate > 0);
    if (validLineItems.length === 0) {
      alertWarning('Please add at least one line item with description and amount');
      return;
    }

    const typeSelect = modal.body.querySelector('#invoice-type-select') as HTMLSelectElement;
    const isDeposit = typeSelect?.value === 'deposit';
    const depositPercentageInput = modal.body.querySelector('#deposit-percentage') as HTMLInputElement;
    const depositPercentage = isDeposit && depositPercentageInput ? parseFloat(depositPercentageInput.value) : undefined;

    // Calculate total
    const totalAmount = validLineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);

    modal.hide();

    if (isDeposit) {
      // For deposit, use first line item description
      await createDepositInvoice(
        projectId,
        project.client_id,
        validLineItems[0].description,
        totalAmount,
        depositPercentage,
        onSuccess
      );
    } else {
      await createInvoiceWithLineItems(projectId, project.client_id, validLineItems, onSuccess);
    }
  };

  // Render the modal content
  const renderModalContent = (): void => {
    const totalAmount = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);

    modal.body.innerHTML = `
      <div class="form-group">
        <label class="form-label">Invoice Type *</label>
        <select id="invoice-type-select" class="form-input">
          <option value="standard">Standard Invoice</option>
          <option value="deposit">Deposit Invoice</option>
        </select>
      </div>

      <div class="form-group deposit-field" style="display: none;">
        <label class="form-label">Deposit Percentage</label>
        <input type="number" id="deposit-percentage" class="form-input" value="50" min="1" max="100" placeholder="e.g., 50">
      </div>

      <div class="form-group">
        <label class="form-label">Line Items</label>
        <div class="line-items-container">
          ${lineItems.map((item, index) => `
            <div class="line-item-row" data-index="${index}">
              <input type="text" class="form-input line-item-desc" placeholder="Description" value="${SanitizationUtils.escapeHtml(item.description)}" required>
              <input type="number" class="form-input line-item-qty" placeholder="Qty" value="${item.quantity}" min="1" style="width: 70px;">
              <input type="number" class="form-input line-item-rate" placeholder="Rate" value="${item.rate}" min="0" step="0.01" style="width: 100px;">
              <span class="line-item-amount">$${(item.quantity * item.rate).toFixed(2)}</span>
              ${lineItems.length > 1 ? `<button type="button" class="btn-remove-line" data-index="${index}" title="Remove">&times;</button>` : ''}
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn btn-outline btn-sm" id="btn-add-line-item">+ Add Line Item</button>
      </div>

      <div class="invoice-total">
        <strong>Total: $${totalAmount.toFixed(2)}</strong>
      </div>
    `;

    // Attach event handlers
    // Invoice type change - show/hide deposit percentage
    const typeSelect = modal.body.querySelector('#invoice-type-select') as HTMLSelectElement;
    const depositField = modal.body.querySelector('.deposit-field') as HTMLElement;
    if (typeSelect && !typeSelect.dataset.dropdownInit) {
      typeSelect.dataset.dropdownInit = 'true';
      initModalDropdown(typeSelect, { placeholder: 'Invoice type...' });
    }
    typeSelect?.addEventListener('change', () => {
      if (depositField) {
        depositField.style.display = typeSelect.value === 'deposit' ? 'block' : 'none';
      }
    });

    // Add line item button
    const addLineBtn = modal.body.querySelector('#btn-add-line-item');
    addLineBtn?.addEventListener('click', () => {
      lineItems.push({ description: '', quantity: 1, rate: 0 });
      saveCurrentValues();
      renderModalContent();
    });

    // Remove line item buttons
    modal.body.querySelectorAll('.btn-remove-line').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt((e.target as HTMLElement).dataset.index || '0');
        lineItems.splice(index, 1);
        saveCurrentValues();
        renderModalContent();
      });
    });

    // Update amounts on input change
    modal.body.querySelectorAll('.line-item-qty, .line-item-rate').forEach(input => {
      input.addEventListener('input', () => {
        updateLineItemAmounts();
      });
    });
  };

  // Build footer with action buttons
  modal.footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="invoice-cancel-btn">Cancel</button>
    <button type="button" class="btn btn-primary" id="invoice-confirm-btn">Create Invoice</button>
  `;

  // Initial render
  renderModalContent();
  document.body.appendChild(modal.overlay);
  modal.show();

  // Set up button handlers
  modal.footer.querySelector('#invoice-cancel-btn')?.addEventListener('click', () => modal.hide());
  modal.footer.querySelector('#invoice-confirm-btn')?.addEventListener('click', submitInvoice);

  // Close on Escape
  const escHandler = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      modal.hide();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Focus first input
  setTimeout(() => {
    const firstInput = modal.body.querySelector('.line-item-desc') as HTMLInputElement;
    firstInput?.focus();
  }, 100);
}

/**
 * Create invoice with multiple line items
 */
export async function createInvoiceWithLineItems(
  projectId: number,
  clientId: number,
  lineItems: InvoiceLineItem[],
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiPost('/api/invoices', {
      projectId,
      clientId,
      lineItems: lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.quantity * item.rate
      })),
      notes: '',
      terms: 'Payment due within 30 days'
    });

    if (response.ok) {
      alertSuccess('Invoice created successfully!');
      onSuccess();
    } else {
      alertError('Failed to create invoice. Please try again.');
    }
  } catch (error) {
    console.error('[InvoiceModals] Error creating invoice:', error);
    alertError('Failed to create invoice. Please try again.');
  }
}

/**
 * Create a deposit invoice for the project
 */
export async function createDepositInvoice(
  projectId: number,
  clientId: number,
  description: string,
  amount: number,
  percentage: number | undefined,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiPost('/api/invoices/deposit', {
      projectId,
      clientId,
      amount,
      percentage,
      description
    });

    if (response.ok) {
      alertSuccess('Deposit invoice created successfully!');
      onSuccess();
    } else {
      alertError('Failed to create deposit invoice. Please try again.');
    }
  } catch (error) {
    console.error('[InvoiceModals] Error creating deposit invoice:', error);
    alertError('Failed to create deposit invoice. Please try again.');
  }
}

/**
 * Create a basic invoice (single line item)
 */
export async function createInvoice(
  projectId: number,
  clientId: number,
  description: string,
  amount: number,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiPost('/api/invoices', {
      projectId,
      clientId,
      lineItems: [
        {
          description,
          quantity: 1,
          rate: amount,
          amount
        }
      ],
      notes: '',
      terms: 'Payment due within 30 days'
    });

    if (response.ok) {
      alertSuccess('Invoice created successfully!');
      onSuccess();
    } else {
      alertError('Failed to create invoice. Please try again.');
    }
  } catch (error) {
    console.error('[InvoiceModals] Error creating invoice:', error);
    alertError('Failed to create invoice. Please try again.');
  }
}
