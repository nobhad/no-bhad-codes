/**
 * ===============================================
 * TABLE EXPORT UTILITY
 * ===============================================
 * @file src/utils/table-export.ts
 *
 * CSV export functionality for admin tables.
 * Provides reusable export utilities with proper formatting.
 */

import { createLogger } from './logging';

const logger = createLogger('TableExport');

// ===============================================
// TYPES
// ===============================================

export interface ExportColumn {
  key: string;
  label: string;
  formatter?: (value: unknown, row: Record<string, unknown>) => string;
}

export interface ExportConfig {
  filename: string;
  columns: ExportColumn[];
}

// ===============================================
// EXPORT FUNCTIONS
// ===============================================

/**
 * Export data array to CSV and trigger download
 */
export function exportToCsv<T extends Record<string, unknown>>(
  data: T[],
  config: ExportConfig
): void {
  if (!data.length) {
    logger.warn('No data to export');
    return;
  }

  const { filename, columns } = config;

  // Build CSV content
  const headers = columns.map(col => escapeCSVField(col.label));
  const rows = data.map(row =>
    columns.map(col => {
      const value = getNestedValue(row, col.key);
      const formatted = col.formatter ? col.formatter(value, row) : formatValue(value);
      return escapeCSVField(formatted);
    })
  );

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  // Generate filename with date
  const dateStr = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${dateStr}.csv`;

  // Trigger download
  downloadFile(csvContent, fullFilename, 'text/csv;charset=utf-8;');

  logger.info('CSV export completed', { filename: fullFilename, rows: data.length });
}

/**
 * Export data array to JSON and trigger download
 */
export function exportToJson<T extends Record<string, unknown>>(
  data: T[],
  filename: string
): void {
  if (!data.length) {
    logger.warn('No data to export');
    return;
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${dateStr}.json`;

  const jsonContent = JSON.stringify({
    exportDate: new Date().toISOString(),
    count: data.length,
    data
  }, null, 2);

  downloadFile(jsonContent, fullFilename, 'application/json');

  logger.info('JSON export completed', { filename: fullFilename, rows: data.length });
}

// ===============================================
// HELPER FUNCTIONS
// ===============================================

/**
 * Escape a value for CSV (handles commas, quotes, newlines)
 */
function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format a value for CSV export
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.join('; ');
    }
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Trigger file download in browser
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ===============================================
// PRE-CONFIGURED EXPORT CONFIGS
// ===============================================

/**
 * Export configuration for clients table
 */
export const CLIENTS_EXPORT_CONFIG: ExportConfig = {
  filename: 'clients',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'contact_name', label: 'Contact Name' },
    { key: 'email', label: 'Email' },
    { key: 'company_name', label: 'Company' },
    { key: 'client_type', label: 'Type' },
    { key: 'phone', label: 'Phone' },
    { key: 'status', label: 'Status' },
    { key: 'project_count', label: 'Projects' },
    { key: 'health_score', label: 'Health Score' },
    { key: 'created_at', label: 'Created Date', formatter: formatDate },
    { key: 'billing_email', label: 'Billing Email' },
    { key: 'billing_address', label: 'Billing Address' },
    { key: 'billing_city', label: 'City' },
    { key: 'billing_state', label: 'State' },
    { key: 'billing_zip', label: 'ZIP' },
    { key: 'billing_country', label: 'Country' }
  ]
};

/**
 * Export configuration for leads table
 */
export const LEADS_EXPORT_CONFIG: ExportConfig = {
  filename: 'leads',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'contact_name', label: 'Contact Name' },
    { key: 'email', label: 'Email' },
    { key: 'company_name', label: 'Company' },
    { key: 'project_type', label: 'Project Type' },
    { key: 'budget_range', label: 'Budget Range' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'status', label: 'Status' },
    { key: 'source', label: 'Source' },
    { key: 'phone', label: 'Phone' },
    { key: 'description', label: 'Description' },
    { key: 'features', label: 'Features' },
    { key: 'score', label: 'Lead Score' },
    { key: 'created_at', label: 'Created Date', formatter: formatDate }
  ]
};

/**
 * Export configuration for projects table
 */
export const PROJECTS_EXPORT_CONFIG: ExportConfig = {
  filename: 'projects',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'project_name', label: 'Project Name' },
    { key: 'contact_name', label: 'Client Name' },
    { key: 'company_name', label: 'Company' },
    { key: 'project_type', label: 'Project Type' },
    { key: 'status', label: 'Status' },
    { key: 'budget_range', label: 'Budget' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'start_date', label: 'Start Date', formatter: formatDate },
    { key: 'end_date', label: 'End Date', formatter: formatDate },
    { key: 'created_at', label: 'Created Date', formatter: formatDate }
  ]
};

/**
 * Export configuration for contacts table
 */
export const CONTACTS_EXPORT_CONFIG: ExportConfig = {
  filename: 'contacts',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'company', label: 'Company' },
    { key: 'phone', label: 'Phone' },
    { key: 'status', label: 'Status' },
    { key: 'message', label: 'Message' },
    { key: 'created_at', label: 'Created Date', formatter: formatDate }
  ]
};

/**
 * Export configuration for invoices table
 */
export const INVOICES_EXPORT_CONFIG: ExportConfig = {
  filename: 'invoices',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'invoice_number', label: 'Invoice Number' },
    { key: 'client_name', label: 'Client' },
    { key: 'project_name', label: 'Project' },
    { key: 'status', label: 'Status' },
    { key: 'amount_total', label: 'Total Amount', formatter: formatCurrencyForExport },
    { key: 'due_date', label: 'Due Date', formatter: formatDate },
    { key: 'paid_at', label: 'Paid Date', formatter: formatDate },
    { key: 'created_at', label: 'Created Date', formatter: formatDate }
  ]
};

// ===============================================
// VALUE FORMATTERS
// ===============================================

/**
 * Format date for export
 */
function formatDate(value: unknown): string {
  if (!value) return '';
  try {
    const date = new Date(String(value));
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Format currency for CSV export (raw number without $ symbol for spreadsheet compatibility)
 */
function formatCurrencyForExport(value: unknown): string {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(num)) return '';
  return num.toFixed(2);
}

/**
 * Export configuration for proposals table
 */
export const PROPOSALS_EXPORT_CONFIG: ExportConfig = {
  filename: 'proposals',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'client.name', label: 'Client Name' },
    { key: 'client.company', label: 'Company' },
    { key: 'client.email', label: 'Client Email' },
    { key: 'project.name', label: 'Project Name' },
    { key: 'projectType', label: 'Project Type' },
    { key: 'selectedTier', label: 'Tier' },
    { key: 'finalPrice', label: 'Final Price', formatter: formatCurrencyForExport },
    { key: 'status', label: 'Status' },
    { key: 'maintenanceOption', label: 'Maintenance Option' },
    { key: 'createdAt', label: 'Created Date', formatter: formatDate }
  ]
};

/**
 * Export configuration for document requests table
 */
export const DOCUMENT_REQUESTS_EXPORT_CONFIG: ExportConfig = {
  filename: 'document_requests',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Title' },
    { key: 'client_name', label: 'Client' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'due_date', label: 'Due Date', formatter: formatDate },
    { key: 'created_at', label: 'Created Date', formatter: formatDate }
  ]
};

/**
 * Export configuration for knowledge base articles
 */
export const KNOWLEDGE_BASE_EXPORT_CONFIG: ExportConfig = {
  filename: 'knowledge_base',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Title' },
    { key: 'category_name', label: 'Category' },
    { key: 'slug', label: 'Slug' },
    { key: 'is_featured', label: 'Featured' },
    { key: 'is_published', label: 'Published' },
    { key: 'updated_at', label: 'Updated Date', formatter: formatDate }
  ]
};

/**
 * Export configuration for time entries
 */
export const TIME_ENTRIES_EXPORT_CONFIG: ExportConfig = {
  filename: 'time_entries',
  columns: [
    { key: 'date', label: 'Date', formatter: formatDate },
    { key: 'description', label: 'Description' },
    { key: 'task_title', label: 'Task' },
    { key: 'duration_minutes', label: 'Duration (hours)', formatter: formatDurationHours },
    { key: 'is_billable', label: 'Billable' },
    { key: 'hourly_rate', label: 'Hourly Rate' },
    { key: 'amount', label: 'Amount', formatter: formatBillableAmount }
  ]
};

/**
 * Format duration in minutes to hours
 */
function formatDurationHours(value: unknown): string {
  if (value === null || value === undefined) return '';
  const minutes = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(minutes)) return '';
  return (minutes / 60).toFixed(2);
}

/**
 * Format billable amount based on row data
 */
function formatBillableAmount(_value: unknown, row: Record<string, unknown>): string {
  const isBillable = row.is_billable;
  const hourlyRate = row.hourly_rate;
  const durationMinutes = row.duration_minutes;

  if (!isBillable || !hourlyRate || !durationMinutes) return '';

  const rate = typeof hourlyRate === 'string' ? parseFloat(hourlyRate) : Number(hourlyRate);
  const minutes = typeof durationMinutes === 'string' ? parseFloat(durationMinutes) : Number(durationMinutes);

  if (isNaN(rate) || isNaN(minutes)) return '';

  return ((minutes / 60) * rate).toFixed(2);
}
