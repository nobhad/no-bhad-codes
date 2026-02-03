/**
 * Invoice Scheduling Module
 * @file src/features/admin/project-details/invoice-scheduling.ts
 *
 * Handles scheduled and recurring invoice functionality.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { formatDate, formatCurrency } from '../../../utils/format-utils';
import { AdminAuth } from '../admin-auth';
import { apiFetch, apiPost } from '../../../utils/api-client';
import {
  confirmDialog,
  confirmDanger,
  alertError,
  alertSuccess,
  multiPromptDialog
} from '../../../utils/confirm-dialog';
import { domCache } from './dom-cache';

/**
 * Process late fees for overdue invoices on a project
 */
export async function processLateFees(
  projectId: number,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  const confirmed = await confirmDialog({
    title: 'Apply Late Fees',
    message: 'This will calculate and apply late fees to all overdue invoices for this project. Continue?',
    confirmText: 'Apply Late Fees',
    cancelText: 'Cancel',
    icon: 'warning'
  });

  if (!confirmed) return;

  try {
    const response = await apiPost('/api/invoices/process-late-fees', {
      projectId
    });

    if (response.ok) {
      const data = await response.json();
      alertSuccess(`Late fees applied to ${data.processed || 0} invoices`);
      onSuccess();
    } else {
      alertError('Failed to process late fees');
    }
  } catch (error) {
    console.error('[InvoiceScheduling] Error processing late fees:', error);
    alertError('Error processing late fees');
  }
}

/**
 * Show prompt to schedule an invoice for future generation
 */
export async function showScheduleInvoicePrompt(
  projectId: number,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split('T')[0];

  const result = await multiPromptDialog({
    title: 'Schedule Invoice',
    fields: [
      {
        name: 'amount',
        label: 'Invoice Amount ($)',
        type: 'number',
        required: true,
        placeholder: '0.00'
      },
      {
        name: 'description',
        label: 'Description',
        type: 'text',
        required: true,
        placeholder: 'e.g., Phase 2 Development'
      },
      {
        name: 'scheduledDate',
        label: 'Generate On Date',
        type: 'date',
        required: true,
        defaultValue: defaultDate
      }
    ],
    confirmText: 'Schedule',
    cancelText: 'Cancel'
  });

  if (!result) return;

  try {
    const response = await apiPost('/api/invoices/schedule', {
      project_id: projectId,
      amount: parseFloat(result.amount),
      description: result.description,
      scheduled_date: result.scheduledDate
    });

    if (response.ok) {
      alertSuccess('Invoice scheduled successfully');
      onSuccess();
    } else {
      alertError('Failed to schedule invoice');
    }
  } catch (error) {
    console.error('[InvoiceScheduling] Error scheduling invoice:', error);
    alertError('Error scheduling invoice');
  }
}

/**
 * Show prompt to set up recurring invoices
 */
export async function showSetupRecurringPrompt(
  projectId: number,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  const result = await multiPromptDialog({
    title: 'Setup Recurring Invoice',
    fields: [
      {
        name: 'amount',
        label: 'Invoice Amount ($)',
        type: 'number',
        required: true,
        placeholder: '0.00'
      },
      {
        name: 'description',
        label: 'Description',
        type: 'text',
        required: true,
        placeholder: 'e.g., Monthly Maintenance'
      },
      {
        name: 'frequency',
        label: 'Frequency',
        type: 'select',
        required: true,
        options: [
          { value: 'weekly', label: 'Weekly' },
          { value: 'biweekly', label: 'Bi-weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'quarterly', label: 'Quarterly' }
        ]
      },
      {
        name: 'startDate',
        label: 'Start Date',
        type: 'date',
        required: true
      }
    ],
    confirmText: 'Setup Recurring',
    cancelText: 'Cancel'
  });

  if (!result) return;

  try {
    const response = await apiPost('/api/invoices/recurring', {
      project_id: projectId,
      amount: parseFloat(result.amount),
      description: result.description,
      frequency: result.frequency,
      start_date: result.startDate
    });

    if (response.ok) {
      alertSuccess('Recurring invoice configured');
      onSuccess();
    } else {
      alertError('Failed to setup recurring invoice');
    }
  } catch (error) {
    console.error('[InvoiceScheduling] Error setting up recurring invoice:', error);
    alertError('Error setting up recurring invoice');
  }
}

/**
 * Load scheduled invoices for a project
 */
export async function loadScheduledInvoices(projectId: number): Promise<void> {
  const container = domCache.get('scheduledInvoicesList');
  if (!container) return;

  try {
    const response = await apiFetch(`/api/invoices/scheduled?projectId=${projectId}`);
    if (response.ok) {
      const data = await response.json();
      const scheduled = data.scheduled || [];

      if (scheduled.length === 0) {
        container.innerHTML = '<p class="empty-state">No scheduled invoices.</p>';
      } else {
        container.innerHTML = scheduled.map((inv: { id: number; amount: number; description: string; scheduled_date: string }) => `
          <div class="scheduled-item">
            <span class="scheduled-date">${formatDate(inv.scheduled_date)}</span>
            <span class="scheduled-desc">${SanitizationUtils.escapeHtml(inv.description)}</span>
            <span class="scheduled-amount">${formatCurrency(inv.amount)}</span>
            <button class="btn btn-danger btn-sm" onclick="window.adminDashboard?.cancelScheduledInvoice(${inv.id})">Cancel</button>
          </div>
        `).join('');
      }
    }
  } catch (error) {
    console.error('[InvoiceScheduling] Error loading scheduled invoices:', error);
  }
}

/**
 * Load recurring invoices for a project
 */
export async function loadRecurringInvoices(projectId: number): Promise<void> {
  const container = domCache.get('recurringInvoicesList');
  if (!container) return;

  try {
    const response = await apiFetch(`/api/invoices/recurring?projectId=${projectId}`);
    if (response.ok) {
      const data = await response.json();
      const recurring = data.recurring || [];

      if (recurring.length === 0) {
        container.innerHTML = '<p class="empty-state">No recurring invoices configured.</p>';
      } else {
        container.innerHTML = recurring.map((inv: { id: number; amount: number; description: string; frequency: string; is_active: boolean; next_date: string }) => `
          <div class="recurring-item">
            <span class="recurring-desc">${SanitizationUtils.escapeHtml(inv.description)}</span>
            <span class="recurring-freq">${inv.frequency}</span>
            <span class="recurring-amount">${formatCurrency(inv.amount)}</span>
            <span class="recurring-next">Next: ${formatDate(inv.next_date)}</span>
            <span class="recurring-status ${inv.is_active ? 'active' : 'paused'}">${inv.is_active ? 'Active' : 'Paused'}</span>
            <button class="btn btn-outline btn-sm" onclick="window.adminDashboard?.toggleRecurringInvoice(${inv.id}, ${inv.is_active})">${inv.is_active ? 'Pause' : 'Resume'}</button>
          </div>
        `).join('');
      }
    }
  } catch (error) {
    console.error('[InvoiceScheduling] Error loading recurring invoices:', error);
  }
}

/**
 * Cancel a scheduled invoice
 */
export async function cancelScheduledInvoice(
  scheduleId: number,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  const confirmed = await confirmDanger(
    'Are you sure you want to cancel this scheduled invoice?',
    'Cancel',
    'Cancel Scheduled Invoice'
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`/api/invoices/scheduled/${scheduleId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (response.ok) {
      alertSuccess('Scheduled invoice cancelled');
      onSuccess();
    } else {
      alertError('Failed to cancel scheduled invoice');
    }
  } catch (error) {
    console.error('[InvoiceScheduling] Error cancelling scheduled invoice:', error);
    alertError('Error cancelling scheduled invoice');
  }
}

/**
 * Toggle (pause/resume) a recurring invoice
 */
export async function toggleRecurringInvoice(
  recurringId: number,
  isActive: boolean,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  try {
    const action = isActive ? 'pause' : 'resume';
    const response = await apiPost(`/api/invoices/recurring/${recurringId}/${action}`);

    if (response.ok) {
      alertSuccess(`Recurring invoice ${isActive ? 'paused' : 'resumed'}`);
      onSuccess();
    } else {
      alertError(`Failed to ${action} recurring invoice`);
    }
  } catch (error) {
    console.error('[InvoiceScheduling] Error toggling recurring invoice:', error);
    alertError('Error updating recurring invoice');
  }
}
