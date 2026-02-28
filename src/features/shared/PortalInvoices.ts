/**
 * ===============================================
 * PORTAL INVOICES MODULE
 * ===============================================
 * @file src/features/shared/PortalInvoices.ts
 *
 * Role-adaptive invoice management module for both admin and client portals.
 * Admin can create, edit, send, and manage all invoices.
 * Client can view their invoices and make payments.
 *
 * CORE PRINCIPLE: Same module, different capabilities based on role.
 */

import { PortalFeatureModule } from './PortalFeatureModule';
import { apiFetch, apiPut } from '../../utils/api-client';
import type { DataItem, ColumnDef } from './types';
import {
  getInvoiceStatusLabel,
  getInvoiceStatusVariant,
  getStatusBadgeClass
} from '../../utils/status-utils';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalInvoices');

// ============================================
// TYPES
// ============================================

interface Invoice extends DataItem {
  id: number;
  invoiceNumber: string;
  clientId: number;
  clientName?: string;
  projectId?: number;
  projectName?: string;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
  amountTotal: number;
  amountPaid: number;
  dueDate: string | null;
  paidDate: string | null;
  createdAt: string;
  lineItems?: InvoiceLineItem[];
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoiceStats {
  total: number;
  pending: number;
  paid: number;
  overdue: number;
  totalAmount: number;
  paidAmount: number;
}

// ============================================
// PORTAL INVOICES MODULE
// ============================================

/**
 * Portal Invoices Module
 *
 * Adapts UI and API calls based on user role:
 * - Admin: full CRUD, bulk actions, scheduling, reminders
 * - Client: view own invoices, download PDFs, make payments
 */
export default class PortalInvoices extends PortalFeatureModule {
  /** Invoices list */
  private invoices: Invoice[] = [];

  /** Invoice stats */
  private stats: InvoiceStats = {
    total: 0,
    pending: 0,
    paid: 0,
    overdue: 0,
    totalAmount: 0,
    paidAmount: 0
  };

  /** Current filter */
  private currentFilter: string = 'all';

  constructor() {
    super('PortalInvoices');
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  async activate(): Promise<void> {
    this.showLoading();
    await this.loadInvoices();
    this.calculateStats();
    this.renderView();
    this.attachEventListeners();
    this.setModuleState('ready');
  }

  async deactivate(): Promise<void> {
    this.invoices = [];
    this.currentFilter = 'all';
  }

  // ============================================
  // API - Role-based endpoints
  // ============================================

  protected getApiEndpoint(): string {
    return this.capabilities.canViewAll
      ? '/api/invoices'
      : '/api/invoices/client';
  }

  // ============================================
  // DATA LOADING
  // ============================================

  private async loadInvoices(): Promise<void> {
    try {
      const response = await apiFetch(this.getApiEndpoint());
      const data = await response.json();
      this.invoices = data.invoices || data || [];
    } catch (error) {
      this.notify('Failed to load invoices', 'error');
      logger.error('Error loading invoices:', error);
    }
  }

  private calculateStats(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.stats = {
      total: this.invoices.length,
      pending: 0,
      paid: 0,
      overdue: 0,
      totalAmount: 0,
      paidAmount: 0
    };

    this.invoices.forEach((inv) => {
      this.stats.totalAmount += inv.amountTotal || 0;
      this.stats.paidAmount += inv.amountPaid || 0;

      if (inv.status === 'paid') {
        this.stats.paid++;
      } else if (['sent', 'viewed', 'draft'].includes(inv.status)) {
        if (inv.dueDate) {
          const dueDate = new Date(inv.dueDate);
          if (dueDate < today) {
            this.stats.overdue++;
          } else {
            this.stats.pending++;
          }
        } else {
          this.stats.pending++;
        }
      }
    });
  }

  // ============================================
  // VIEW RENDERING - Role-adaptive
  // ============================================

  protected renderView(): void {
    if (!this.container) return;

    const layout = this.isAdmin
      ? this.renderAdminLayout()
      : this.renderClientLayout();

    this.container.innerHTML = layout;
  }

  private renderAdminLayout(): string {
    return `
      <div class="invoices-layout admin-invoices">
        <div class="invoices-stats">
          ${this.renderStatsCards()}
        </div>
        <div class="invoices-toolbar">
          ${this.renderToolbar({ showSearch: true, searchPlaceholder: 'Search invoices...' })}
        </div>
        <div class="invoices-filters">
          ${this.renderFilters()}
        </div>
        <div class="invoices-table-wrapper">
          ${this.renderInvoicesTable()}
        </div>
      </div>
    `;
  }

  private renderClientLayout(): string {
    return `
      <div class="invoices-layout client-invoices">
        <div class="invoices-header">
          <h3>Your Invoices</h3>
        </div>
        <div class="invoices-summary">
          ${this.renderClientSummary()}
        </div>
        <div class="invoices-filters">
          ${this.renderFilters()}
        </div>
        <div class="invoices-list">
          ${this.renderInvoicesList()}
        </div>
      </div>
    `;
  }

  private renderStatsCards(): string {
    return `
      <div class="stats-grid">
        <button class="stat-card ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">
          <span class="stat-number">${this.stats.total}</span>
          <span class="stat-label">Total Invoices</span>
        </button>
        <button class="stat-card ${this.currentFilter === 'pending' ? 'active' : ''}" data-filter="pending">
          <span class="stat-number">${this.stats.pending}</span>
          <span class="stat-label">Pending</span>
        </button>
        <button class="stat-card ${this.currentFilter === 'paid' ? 'active' : ''}" data-filter="paid">
          <span class="stat-number">${this.stats.paid}</span>
          <span class="stat-label">Paid</span>
        </button>
        <button class="stat-card ${this.currentFilter === 'overdue' ? 'active' : ''}" data-filter="overdue">
          <span class="stat-number">${this.stats.overdue}</span>
          <span class="stat-label">Overdue</span>
        </button>
      </div>
    `;
  }

  private renderClientSummary(): string {
    const balanceDue = this.stats.totalAmount - this.stats.paidAmount;

    return `
      <div class="client-invoice-summary">
        <div class="summary-item">
          <span class="summary-label">Total Billed</span>
          <span class="summary-value">${this.formatCurrency(this.stats.totalAmount)}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Paid</span>
          <span class="summary-value">${this.formatCurrency(this.stats.paidAmount)}</span>
        </div>
        <div class="summary-item ${balanceDue > 0 ? 'has-balance' : ''}">
          <span class="summary-label">Balance Due</span>
          <span class="summary-value">${this.formatCurrency(balanceDue)}</span>
        </div>
      </div>
    `;
  }

  private renderFilters(): string {
    const filters = [
      { id: 'all', label: 'All' },
      { id: 'pending', label: 'Pending' },
      { id: 'paid', label: 'Paid' },
      { id: 'overdue', label: 'Overdue' }
    ];

    return `
      <div class="filter-tabs">
        ${filters.map((f) => `
          <button class="filter-tab ${this.currentFilter === f.id ? 'active' : ''}" data-filter="${f.id}">
            ${f.label}
          </button>
        `).join('')}
      </div>
    `;
  }

  private renderInvoicesTable(): string {
    const filteredInvoices = this.getFilteredInvoices();

    const columns: ColumnDef<Invoice>[] = [
      {
        id: 'invoiceNumber',
        header: 'Invoice #',
        accessor: 'invoiceNumber',
        width: '120px'
      },
      {
        id: 'client',
        header: 'Client',
        accessor: (inv) => inv.clientName || '-'
      },
      {
        id: 'project',
        header: 'Project',
        accessor: (inv) => inv.projectName || '-'
      },
      {
        id: 'amount',
        header: 'Amount',
        accessor: 'amountTotal',
        align: 'right',
        render: (value) => this.formatCurrency(value as number)
      },
      {
        id: 'status',
        header: 'Status',
        accessor: 'status',
        render: (value) => this.renderStatusBadge(value as string)
      },
      {
        id: 'dueDate',
        header: 'Due Date',
        accessor: 'dueDate',
        render: (value) => value ? this.formatDate(value as string) : '-'
      }
    ];

    return this.renderTable(filteredInvoices, columns, { showCheckboxes: true });
  }

  private renderInvoicesList(): string {
    const filteredInvoices = this.getFilteredInvoices();

    if (filteredInvoices.length === 0) {
      return '<div class="empty-state"><p>No invoices found</p></div>';
    }

    return filteredInvoices.map((inv) => `
      <div class="invoice-card" data-invoice-id="${inv.id}">
        <div class="invoice-card-header">
          <span class="invoice-number">${this.escapeHtml(inv.invoiceNumber)}</span>
          ${this.renderStatusBadge(inv.status)}
        </div>
        <div class="invoice-card-body">
          <div class="invoice-amount">${this.formatCurrency(inv.amountTotal)}</div>
          ${inv.projectName ? `<div class="invoice-project">${this.escapeHtml(inv.projectName)}</div>` : ''}
        </div>
        <div class="invoice-card-footer">
          <span class="invoice-date">
            ${inv.dueDate ? `Due: ${this.formatDate(inv.dueDate)}` : 'No due date'}
          </span>
          <div class="invoice-actions">
            <button class="btn btn-sm btn-secondary" data-action="view" data-id="${inv.id}">View</button>
            <button class="btn btn-sm btn-secondary" data-action="download" data-id="${inv.id}">Download</button>
            ${inv.status !== 'paid' ? `
              <button class="btn btn-sm btn-primary" data-action="pay" data-id="${inv.id}">Pay Now</button>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }

  private getFilteredInvoices(): Invoice[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (this.currentFilter === 'all') {
      return this.invoices;
    }

    return this.invoices.filter((inv) => {
      if (this.currentFilter === 'paid') {
        return inv.status === 'paid';
      }
      if (this.currentFilter === 'pending') {
        if (inv.status === 'paid') return false;
        if (!inv.dueDate) return true;
        const dueDate = new Date(inv.dueDate);
        return dueDate >= today;
      }
      if (this.currentFilter === 'overdue') {
        if (inv.status === 'paid') return false;
        if (!inv.dueDate) return false;
        const dueDate = new Date(inv.dueDate);
        return dueDate < today;
      }
      return true;
    });
  }

  private renderStatusBadge(status: string): string {
    const variant = getInvoiceStatusVariant(status);
    const label = getInvoiceStatusLabel(status);
    return `<span class="${getStatusBadgeClass(variant)}">${label}</span>`;
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  private attachEventListeners(): void {
    if (!this.container) return;

    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Filter clicks
      const filterBtn = target.closest('[data-filter]') as HTMLElement;
      if (filterBtn) {
        this.currentFilter = filterBtn.dataset.filter || 'all';
        this.renderView();
        this.attachEventListeners();
        return;
      }

      // Action buttons
      const actionBtn = target.closest('[data-action]') as HTMLElement;
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        const invoiceId = actionBtn.dataset.id;

        if (invoiceId) {
          switch (action) {
          case 'view':
            this.viewInvoice(parseInt(invoiceId, 10));
            break;
          case 'download':
            this.downloadInvoice(parseInt(invoiceId, 10));
            break;
          case 'pay':
            this.initiatePayment(parseInt(invoiceId, 10));
            break;
          case 'edit':
            this.editInvoice(parseInt(invoiceId, 10));
            break;
          case 'send':
            this.sendInvoice(parseInt(invoiceId, 10));
            break;
          case 'mark-paid':
            this.markAsPaid(parseInt(invoiceId, 10));
            break;
          }
        }
      }
    });
  }

  // ============================================
  // INVOICE OPERATIONS
  // ============================================

  private viewInvoice(invoiceId: number): void {
    // Open invoice in modal or new page
    this.notify(`Viewing invoice #${  invoiceId}`, 'info');
  }

  private downloadInvoice(invoiceId: number): void {
    const link = document.createElement('a');
    link.href = `/api/invoices/${invoiceId}/pdf`;
    link.download = `invoice-${invoiceId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private initiatePayment(_invoiceId: number): void {
    // Navigate to payment page or open payment modal
    this.notify('Payment feature coming soon', 'info');
  }

  private editInvoice(_invoiceId: number): void {
    if (!this.capabilities.canEdit) {
      this.notify('You do not have permission to edit invoices', 'error');
      return;
    }
    // Open edit modal
    this.notify('Edit feature coming soon', 'info');
  }

  private async sendInvoice(invoiceId: number): Promise<void> {
    if (!this.capabilities.canEdit) return;

    try {
      await apiPut(`/api/invoices/${invoiceId}`, { status: 'sent' });
      this.notify('Invoice sent successfully', 'success');
      await this.loadInvoices();
      this.calculateStats();
      this.renderView();
      this.attachEventListeners();
    } catch (error) {
      this.notify('Failed to send invoice', 'error');
      logger.error('Error sending invoice:', error);
    }
  }

  private async markAsPaid(invoiceId: number): Promise<void> {
    if (!this.capabilities.canEdit) return;

    try {
      await apiPut(`/api/invoices/${invoiceId}`, { status: 'paid' });
      this.notify('Invoice marked as paid', 'success');
      await this.loadInvoices();
      this.calculateStats();
      this.renderView();
      this.attachEventListeners();
    } catch (error) {
      this.notify('Failed to update invoice', 'error');
      logger.error('Error marking invoice as paid:', error);
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}
