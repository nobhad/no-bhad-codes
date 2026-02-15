/**
 * Invoice Actions Module
 * @file src/features/admin/project-details/invoice-actions.ts
 *
 * Handles invoice actions: send, remind, edit, delete, payments, etc.
 */

import { AdminAuth } from '../admin-auth';
import { apiFetch, apiPost, apiPut, parseApiResponse } from '../../../utils/api-client';
import {
  confirmDialog,
  confirmDanger,
  alertError,
  alertSuccess,
  alertWarning,
  multiPromptDialog
} from '../../../utils/confirm-dialog';

/**
 * Edit a draft invoice
 */
export async function editInvoice(
  invoiceId: number,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) {
    return;
  }

  try {
    // Fetch current invoice data
    const response = await apiFetch(`/api/invoices/${invoiceId}`);
    if (!response.ok) {
      alertError('Failed to load invoice');
      return;
    }

    const data = await parseApiResponse<{ invoice: { status: string; notes?: string; lineItems?: { description: string; amount: number }[] } }>(response);
    const invoice = data.invoice;

    if (invoice.status !== 'draft') {
      alertWarning('Only draft invoices can be edited');
      return;
    }

    // Get current line item (backend returns camelCase)
    const lineItems = invoice.lineItems || [];
    const firstItem = lineItems[0] || { description: '', amount: 0 };

    const result = await multiPromptDialog({
      title: 'Edit Invoice',
      fields: [
        {
          name: 'description',
          label: 'Line Item Description',
          type: 'text',
          defaultValue: firstItem.description || '',
          required: true
        },
        {
          name: 'amount',
          label: 'Amount ($)',
          type: 'number',
          defaultValue: String(firstItem.amount || 0),
          placeholder: 'Enter amount',
          required: true
        },
        {
          name: 'notes',
          label: 'Notes (optional)',
          type: 'textarea',
          defaultValue: invoice.notes || ''
        }
      ],
      confirmText: 'Save Changes',
      cancelText: 'Cancel'
    });

    if (!result) return;

    const amount = parseFloat(result.amount);
    if (isNaN(amount) || amount <= 0) {
      alertWarning('Please enter a valid amount');
      return;
    }

    const updateResponse = await apiPut(`/api/invoices/${invoiceId}`, {
      lineItems: [{
        description: result.description,
        quantity: 1,
        rate: amount,
        amount
      }],
      notes: result.notes || ''
    });

    if (updateResponse.ok) {
      alertSuccess('Invoice updated successfully!');
      onSuccess();
    } else {
      alertError('Failed to update invoice');
    }
  } catch (error) {
    console.error('[InvoiceActions] Error editing invoice:', error);
    alertError('Error editing invoice');
  }
}

/**
 * Show prompt to apply deposit credit to an invoice
 */
export async function showApplyCreditPrompt(
  projectId: number,
  invoiceId: number,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  try {
    // Fetch available deposits for this project
    const depositsResponse = await apiFetch(`/api/invoices/deposits/${projectId}`);
    if (!depositsResponse.ok) {
      alertError('Failed to load available deposits');
      return;
    }

    const depositsData = await depositsResponse.json();
    const deposits = depositsData.deposits || [];

    if (deposits.length === 0) {
      alertWarning('No paid deposits available to apply as credit');
      return;
    }

    // Build options for deposit selection
    const depositOptions = deposits.map((d: { invoice_id: number; invoice_number: string; available_amount: number }) => ({
      value: String(d.invoice_id),
      label: `${d.invoice_number} - $${d.available_amount.toFixed(2)} available`
    }));

    const result = await multiPromptDialog({
      title: 'Apply Deposit Credit',
      fields: [
        {
          name: 'depositInvoiceId',
          label: 'Select Deposit',
          type: 'select',
          options: depositOptions,
          required: true
        },
        {
          name: 'amount',
          label: 'Credit Amount ($)',
          type: 'number',
          defaultValue: String(deposits[0]?.available_amount || 0),
          placeholder: 'Enter credit amount',
          required: true
        }
      ],
      confirmText: 'Apply Credit',
      cancelText: 'Cancel'
    });

    if (!result) return;

    const amount = parseFloat(result.amount);
    if (isNaN(amount) || amount <= 0) {
      alertWarning('Please enter a valid amount');
      return;
    }

    // Find the selected deposit to verify amount
    const selectedDeposit = deposits.find((d: { invoice_id: number }) => String(d.invoice_id) === result.depositInvoiceId);
    if (selectedDeposit && amount > selectedDeposit.available_amount) {
      alertWarning(`Amount exceeds available credit ($${selectedDeposit.available_amount.toFixed(2)})`);
      return;
    }

    const creditResponse = await apiPost(`/api/invoices/${invoiceId}/apply-credit`, {
      depositInvoiceId: parseInt(result.depositInvoiceId),
      amount
    });

    if (creditResponse.ok) {
      alertSuccess('Credit applied successfully!');
      onSuccess();
    } else {
      const errorData = await creditResponse.json();
      alertError(errorData.error || 'Failed to apply credit');
    }
  } catch (error) {
    console.error('[InvoiceActions] Error applying credit:', error);
    alertError('Error applying credit');
  }
}

/**
 * Send an invoice to the client
 */
export async function sendInvoice(
  invoiceId: number,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) {
    return;
  }

  try {
    const response = await apiPost(`/api/invoices/${invoiceId}/send`);

    if (response.ok) {
      alertSuccess('Invoice sent successfully!');
      onSuccess();
    } else {
      alertError('Failed to send invoice');
    }
  } catch (error) {
    console.error('[InvoiceActions] Error sending invoice:', error);
    alertError('Error sending invoice');
  }
}

/**
 * Mark an invoice as paid
 */
export async function markInvoicePaid(
  invoiceId: number,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiPut(`/api/invoices/${invoiceId}`, { status: 'paid' });

    if (response.ok) {
      alertSuccess('Invoice marked as paid!');
      onSuccess();
    } else {
      alertError('Failed to update invoice');
    }
  } catch (error) {
    console.error('[InvoiceActions] Error marking invoice paid:', error);
    alertError('Error updating invoice');
  }
}

/**
 * Send a payment reminder for an overdue invoice
 */
export async function sendInvoiceReminder(invoiceId: number): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiPost(`/api/invoices/${invoiceId}/send-reminder`);

    if (response.ok) {
      alertSuccess('Payment reminder sent!');
    } else {
      alertError('Failed to send reminder');
    }
  } catch (error) {
    console.error('[InvoiceActions] Error sending reminder:', error);
    alertError('Error sending reminder');
  }
}

/**
 * Duplicate an invoice (creates a new draft copy)
 */
export async function duplicateInvoice(
  invoiceId: number,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  const confirmed = await confirmDialog({
    title: 'Duplicate Invoice',
    message: 'This will create a new draft invoice as a copy. Continue?',
    confirmText: 'Duplicate',
    cancelText: 'Cancel',
    icon: 'info'
  });

  if (!confirmed) return;

  try {
    const response = await apiPost(`/api/invoices/${invoiceId}/duplicate`);

    if (response.ok) {
      alertSuccess('Invoice duplicated successfully');
      onSuccess();
    } else {
      alertError('Failed to duplicate invoice');
    }
  } catch (error) {
    console.error('[InvoiceActions] Error duplicating invoice:', error);
    alertError('Error duplicating invoice');
  }
}

/**
 * Delete or void an invoice
 */
export async function deleteInvoice(
  invoiceId: number,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  const confirmed = await confirmDanger(
    'Draft invoices will be permanently deleted. Sent invoices will be voided (marked as cancelled). Continue?',
    'Delete/Void',
    'Delete Invoice'
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    if (response.ok) {
      const data = await parseApiResponse<{ action: string }>(response);
      alertSuccess(data.action === 'deleted' ? 'Invoice deleted' : 'Invoice voided');
      onSuccess();
    } else {
      const err = await response.json();
      alertError(err.error || 'Failed to delete invoice');
    }
  } catch (error) {
    console.error('[InvoiceActions] Error deleting invoice:', error);
    alertError('Error deleting invoice');
  }
}

/**
 * Record a payment on an invoice
 */
export async function recordPayment(
  invoiceId: number,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  const result = await multiPromptDialog({
    title: 'Record Payment',
    fields: [
      {
        name: 'amount',
        label: 'Payment Amount ($)',
        type: 'number',
        required: true,
        placeholder: '0.00'
      },
      {
        name: 'paymentMethod',
        label: 'Payment Method',
        type: 'select',
        options: [
          { value: 'zelle', label: 'Zelle' },
          { value: 'venmo', label: 'Venmo' },
          { value: 'check', label: 'Check' },
          { value: 'bank_transfer', label: 'Bank Transfer' },
          { value: 'credit_card', label: 'Credit Card' },
          { value: 'cash', label: 'Cash' },
          { value: 'other', label: 'Other' }
        ],
        required: true
      },
      {
        name: 'reference',
        label: 'Reference/Transaction ID (optional)',
        type: 'text',
        placeholder: 'e.g., TXN-12345'
      }
    ]
  });

  if (!result) return;

  const amount = parseFloat(result.amount);
  if (isNaN(amount) || amount <= 0) {
    alertError('Please enter a valid payment amount');
    return;
  }

  try {
    const response = await apiPost(`/api/invoices/${invoiceId}/record-payment`, {
      amount,
      paymentMethod: result.paymentMethod,
      paymentReference: result.reference || undefined
    });

    if (response.ok) {
      const data = await parseApiResponse<{ message: string }>(response);
      alertSuccess(data.message || 'Payment recorded');
      onSuccess();
    } else {
      const err = await response.json();
      alertError(err.error || 'Failed to record payment');
    }
  } catch (error) {
    console.error('[InvoiceActions] Error recording payment:', error);
    alertError('Error recording payment');
  }
}
