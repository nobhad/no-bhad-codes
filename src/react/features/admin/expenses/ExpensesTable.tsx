/**
 * ===============================================
 * EXPENSES TABLE
 * ===============================================
 * @file src/react/features/admin/expenses/ExpensesTable.tsx
 *
 * Admin table for viewing, creating, filtering, and
 * deleting project expenses.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { DollarSign, Inbox, Plus as _Plus, X as _X } from 'lucide-react';
import { IconButton } from '@react/factories';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableHead,
  PortalTableRow,
  PortalTableCell,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from '@react/components/portal/PortalTable';
import { StatusBadge } from '@react/components/portal/StatusBadge';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { usePagination } from '@react/hooks/usePagination';
import { useFadeIn } from '@react/hooks/useGsap';
import { formatDate } from '@react/utils/formatDate';
import { formatCurrency } from '@/utils/format-utils';
import { apiFetch, apiPost, apiDelete } from '@/utils/api-client';
import { showToast } from '@/utils/toast-notifications';
import { API_ENDPOINTS } from '@/constants/api-endpoints';

// ============================================
// Constants
// ============================================

const EXPENSES_API = API_ENDPOINTS.EXPENSES;

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  software: 'Software',
  hosting: 'Hosting',
  domain: 'Domain',
  stock_assets: 'Stock Assets',
  subcontractor: 'Subcontractor',
  hardware: 'Hardware',
  travel: 'Travel',
  marketing: 'Marketing',
  office: 'Office',
  professional_services: 'Professional Services',
  subscription: 'Subscription',
  other: 'Other'
};

const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label
}));

const FILTER_CONFIG = [
  {
    key: 'category',
    label: 'Category',
    options: [
      { value: 'all', label: 'All Categories' },
      ...CATEGORY_OPTIONS
    ]
  }
];

// ============================================
// Types
// ============================================

interface Expense {
  id: number;
  project_id: number | null;
  category: string;
  description: string;
  amount: number | string;
  vendor_name: string | null;
  expense_date: string;
  is_billable: number;
  is_recurring: number;
  recurring_interval: string | null;
  tax_deductible: number;
  notes: string | null;
  project_name: string | null;
}

interface ProjectOption {
  value: string;
  label: string;
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

interface ExpensesTableProps {
  getAuthToken?: () => string | null;
  onNavigate?: (tab: string, entityId?: string) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  defaultPageSize?: number;
}

// ============================================
// Filter / Sort helpers
// ============================================

function filterExpense(
  expense: Expense,
  filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      expense.description?.toLowerCase().includes(searchLower) ||
      expense.vendor_name?.toLowerCase().includes(searchLower) ||
      expense.project_name?.toLowerCase().includes(searchLower) ||
      EXPENSE_CATEGORY_LABELS[expense.category]?.toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;
  }

  const categoryFilter = filters.category;
  if (categoryFilter && categoryFilter.length > 0 && !categoryFilter.includes(expense.category)) {
    return false;
  }

  return true;
}

function sortExpenses(a: Expense, b: Expense, sort: SortConfig): number {
  const multiplier = sort.direction === 'asc' ? 1 : -1;

  switch (sort.column) {
  case 'date':
    return multiplier * (new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime());
  case 'amount': {
    const aAmt = typeof a.amount === 'string' ? parseFloat(a.amount) : (a.amount || 0);
    const bAmt = typeof b.amount === 'string' ? parseFloat(b.amount) : (b.amount || 0);
    return multiplier * (aAmt - bAmt);
  }
  case 'category':
    return multiplier * (a.category || '').localeCompare(b.category || '');
  case 'description':
    return multiplier * (a.description || '').localeCompare(b.description || '');
  default:
    return 0;
  }
}

// ============================================
// Inline Create Form
// ============================================

interface CreateFormProps {
  projectOptions: ProjectOption[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

function ExpenseCreateForm({ projectOptions, onSubmit, onCancel, isSubmitting }: CreateFormProps) {
  const [formData, setFormData] = useState({
    projectId: '',
    category: 'other',
    description: '',
    amount: '',
    vendorName: '',
    expenseDate: new Date().toISOString().split('T')[0],
    isBillable: false,
    notes: ''
  });

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description.trim() || !formData.amount || !formData.expenseDate) {
      showToast('Description, amount, and date are required', 'error');
      return;
    }

    const parsedAmount = parseFloat(formData.amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      showToast('Amount must be a valid non-negative number', 'error');
      return;
    }

    await onSubmit({
      projectId: formData.projectId ? Number(formData.projectId) : null,
      category: formData.category,
      description: formData.description.trim(),
      amount: parsedAmount,
      vendorName: formData.vendorName.trim() || null,
      expenseDate: formData.expenseDate,
      isBillable: formData.isBillable,
      notes: formData.notes.trim() || null
    });
  }, [formData, onSubmit]);

  const updateField = useCallback((field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  return (
    <form className="inline-create-form" onSubmit={handleSubmit}>
      <div className="inline-form-grid">
        <div className="form-field">
          <label className="form-label" htmlFor="expense-project">Project (optional)</label>
          <select
            id="expense-project"
            className="form-input"
            value={formData.projectId}
            onChange={(e) => updateField('projectId', e.target.value)}
          >
            <option value="">No project</option>
            {projectOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="expense-category">Category</label>
          <select
            id="expense-category"
            className="form-input"
            value={formData.category}
            onChange={(e) => updateField('category', e.target.value)}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="expense-description">Description</label>
          <input
            id="expense-description"
            className="form-input"
            type="text"
            placeholder="What was this expense for?"
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            required
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="expense-amount">Amount</label>
          <input
            id="expense-amount"
            className="form-input"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) => updateField('amount', e.target.value)}
            required
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="expense-vendor">Vendor</label>
          <input
            id="expense-vendor"
            className="form-input"
            type="text"
            placeholder="Vendor name"
            value={formData.vendorName}
            onChange={(e) => updateField('vendorName', e.target.value)}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="expense-date">Date</label>
          <input
            id="expense-date"
            className="form-input"
            type="date"
            value={formData.expenseDate}
            onChange={(e) => updateField('expenseDate', e.target.value)}
            required
          />
        </div>

        <div className="form-field form-field--checkbox">
          <label className="form-label" htmlFor="expense-billable">
            <input
              id="expense-billable"
              type="checkbox"
              checked={formData.isBillable}
              onChange={(e) => updateField('isBillable', e.target.checked)}
            />
            Billable
          </label>
        </div>

        <div className="form-field form-field--wide">
          <label className="form-label" htmlFor="expense-notes">Notes</label>
          <textarea
            id="expense-notes"
            className="form-input"
            rows={2}
            placeholder="Optional notes..."
            value={formData.notes}
            onChange={(e) => updateField('notes', e.target.value)}
          />
        </div>
      </div>

      <div className="inline-form-actions">
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Expense'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ============================================
// Main Component
// ============================================

export function ExpensesTable({
  getAuthToken: _getAuthToken,
  onNavigate,
  showNotification: _showNotification,
  defaultPageSize = 25
}: ExpensesTableProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  // State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const fetchedProjects = useRef(false);

  // Delete confirmation
  const deleteDialog = useConfirmDialog();
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Stats
  const stats = useMemo(() => {
    let total = 0;
    let billable = 0;
    for (const exp of expenses) {
      const amt = typeof exp.amount === 'string' ? parseFloat(exp.amount) : (exp.amount || 0);
      total += amt;
      if (exp.is_billable) billable += amt;
    }
    return {
      count: expenses.length,
      total: Math.round(total * 100) / 100,
      billable: Math.round(billable * 100) / 100
    };
  }, [expenses]);

  // Fetch expenses
  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(EXPENSES_API);
      if (!res.ok) throw new Error('Failed to load expenses');
      const json = await res.json();
      setExpenses(json.data?.expenses || json.expenses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch project options for the create form dropdown
  const fetchProjectOptions = useCallback(async () => {
    if (fetchedProjects.current) return;
    fetchedProjects.current = true;
    try {
      const res = await apiFetch('/api/admin/projects');
      if (res.ok) {
        const json = await res.json();
        const projects = (json.data?.projects || json.projects || []) as Array<{ id: number; name?: string; project_name?: string }>;
        setProjectOptions(projects.map((p) => ({
          value: String(p.id),
          label: p.name || p.project_name || `Project #${p.id}`
        })));
      }
    } catch {
      // Non-critical — form can still submit without project
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Open create form — also lazy-load project options
  const handleOpenCreate = useCallback(() => {
    setShowCreateForm(true);
    fetchProjectOptions();
  }, [fetchProjectOptions]);

  // Create expense
  const handleCreate = useCallback(async (data: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      const res = await apiPost(EXPENSES_API, data);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to create expense');
      }
      showToast('Expense created', 'success');
      setShowCreateForm(false);
      fetchExpenses();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create expense', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchExpenses]);

  // Delete expense
  const handleDeleteConfirm = useCallback(async () => {
    if (pendingDeleteId == null) return;
    try {
      const res = await apiDelete(`${EXPENSES_API}/${pendingDeleteId}`);
      if (!res.ok) throw new Error('Failed to delete expense');
      showToast('Expense deleted', 'success');
      setPendingDeleteId(null);
      fetchExpenses();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete expense', 'error');
    }
  }, [pendingDeleteId, fetchExpenses]);

  const openDeleteConfirm = useCallback((id: number) => {
    setPendingDeleteId(id);
    deleteDialog.open();
  }, [deleteDialog]);

  // Filtering and sorting
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<Expense>({
    storageKey: 'admin_expenses',
    filters: FILTER_CONFIG,
    filterFn: filterExpense,
    sortFn: sortExpenses,
    defaultSort: { column: 'date', direction: 'desc' }
  });

  const filteredExpenses = useMemo(() => applyFilters(expenses), [applyFilters, expenses]);

  // Pagination
  const pagination = usePagination({
    storageKey: 'admin_expenses_pagination',
    totalItems: filteredExpenses.length,
    defaultPageSize
  });

  const paginatedExpenses = useMemo(
    () => pagination.paginate(filteredExpenses),
    [pagination, filteredExpenses]
  );

  return (
    <>
      <TableLayout
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        title="EXPENSES"
        stats={
          <TableStats
            items={[
              { value: stats.count, label: 'total' },
              { value: formatCurrency(stats.total), label: 'spent' },
              { value: formatCurrency(stats.billable), label: 'billable' }
            ]}
            tooltip={`${stats.count} Expenses • ${formatCurrency(stats.total)} Total • ${formatCurrency(stats.billable)} Billable`}
          />
        }
        actions={
          <>
            <SearchFilter
              value={search}
              onChange={setSearch}
              placeholder="Search expenses..."
            />
            <FilterDropdown
              sections={FILTER_CONFIG}
              values={{ category: filterValues.category || 'all' }}
              onChange={(key, value) => setFilter(key, value)}
            />
            <IconButton
              action="add"
              onClick={handleOpenCreate}
              title="Add expense"
            />
            <IconButton
              action="refresh"
              onClick={fetchExpenses}
              disabled={isLoading}
              loading={isLoading}
            />
          </>
        }
        pagination={
          !isLoading && filteredExpenses.length > 0 ? (
            <TablePagination
              pageInfo={pagination.pageInfo}
              page={pagination.page}
              pageSize={pagination.pageSize}
              pageSizeOptions={pagination.pageSizeOptions}
              canGoPrev={pagination.canGoPrev}
              canGoNext={pagination.canGoNext}
              onPageSizeChange={pagination.setPageSize}
              onFirstPage={pagination.firstPage}
              onPrevPage={pagination.prevPage}
              onNextPage={pagination.nextPage}
              onLastPage={pagination.lastPage}
            />
          ) : undefined
        }
      >
        {/* Inline Create Form */}
        {showCreateForm && (
          <ExpenseCreateForm
            projectOptions={projectOptions}
            onSubmit={handleCreate}
            onCancel={() => setShowCreateForm(false)}
            isSubmitting={isSubmitting}
          />
        )}

        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'date' ? sort.direction : null}
                onClick={() => toggleSort('date')}
              >
                Date
              </PortalTableHead>
              <PortalTableHead
                className="name-col"
                sortable
                sortDirection={sort?.column === 'description' ? sort.direction : null}
                onClick={() => toggleSort('description')}
              >
                Description
              </PortalTableHead>
              <PortalTableHead
                className="status-col"
                sortable
                sortDirection={sort?.column === 'category' ? sort.direction : null}
                onClick={() => toggleSort('category')}
              >
                Category
              </PortalTableHead>
              <PortalTableHead className="client-col">Vendor</PortalTableHead>
              <PortalTableHead
                className="amount-col"
                sortable
                sortDirection={sort?.column === 'amount' ? sort.direction : null}
                onClick={() => toggleSort('amount')}
              >
                Amount
              </PortalTableHead>
              <PortalTableHead className="client-col">Project</PortalTableHead>
              <PortalTableHead className="status-col">Billable</PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={8} message={error} onRetry={fetchExpenses} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={8} rows={5} />
            ) : paginatedExpenses.length === 0 ? (
              <PortalTableEmpty
                colSpan={8}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No expenses match your filters' : 'No expenses yet'}
              />
            ) : (
              paginatedExpenses.map((expense) => {
                const amount = typeof expense.amount === 'string'
                  ? parseFloat(expense.amount) : (expense.amount || 0);

                return (
                  <PortalTableRow key={expense.id}>
                    {/* Date */}
                    <PortalTableCell className="date-col">
                      {expense.expense_date && formatDate(expense.expense_date)}
                    </PortalTableCell>

                    {/* Description */}
                    <PortalTableCell className="primary-cell">
                      <div className="cell-with-icon">
                        <DollarSign className="icon-sm" />
                        <span className="cell-title">{expense.description}</span>
                      </div>
                    </PortalTableCell>

                    {/* Category */}
                    <PortalTableCell className="status-col">
                      <StatusBadge status="qualified">
                        {EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}
                      </StatusBadge>
                    </PortalTableCell>

                    {/* Vendor */}
                    <PortalTableCell className="client-cell">
                      {expense.vendor_name || '--'}
                    </PortalTableCell>

                    {/* Amount */}
                    <PortalTableCell className="amount-col">
                      {formatCurrency(amount)}
                    </PortalTableCell>

                    {/* Project */}
                    <PortalTableCell className="client-cell">
                      {expense.project_id && expense.project_name && onNavigate ? (
                        <span
                          className="table-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('project-detail', String(expense.project_id));
                          }}
                        >
                          {expense.project_name}
                        </span>
                      ) : (
                        expense.project_name || '--'
                      )}
                    </PortalTableCell>

                    {/* Billable */}
                    <PortalTableCell className="status-col">
                      {expense.is_billable ? (
                        <StatusBadge status="active">Billable</StatusBadge>
                      ) : (
                        <StatusBadge status="inactive">Non-billable</StatusBadge>
                      )}
                    </PortalTableCell>

                    {/* Actions */}
                    <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="action-group">
                        <IconButton
                          action="delete"
                          onClick={() => openDeleteConfirm(expense.id)}
                          title="Delete expense"
                        />
                      </div>
                    </PortalTableCell>
                  </PortalTableRow>
                );
              })
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Expense"
        description="Are you sure you want to delete this expense? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </>
  );
}
