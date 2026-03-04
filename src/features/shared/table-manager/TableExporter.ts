/**
 * ===============================================
 * TABLE EXPORTER
 * ===============================================
 * @file src/features/shared/table-manager/TableExporter.ts
 *
 * Exports table data to CSV format.
 */

import type { RowData, ColumnDef } from './types';

/** Format a value for CSV output */
function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export class TableExporter {
  private columns: ColumnDef[];

  constructor(columns: ColumnDef[]) {
    this.columns = columns;
  }

  /** Export rows to CSV and trigger download */
  exportCsv(rows: RowData[], filename: string): void {
    // Filter out special columns (_select, _actions)
    const exportColumns = this.columns.filter((col) => !col.id.startsWith('_'));

    // Build header row
    const headers = exportColumns.map((col) => formatCsvValue(col.label));

    // Build data rows
    const dataRows = rows.map((row) =>
      exportColumns.map((col) => formatCsvValue(row[col.id]))
    );

    // Combine
    const csvContent = [
      headers.join(','),
      ...dataRows.map((row) => row.join(','))
    ].join('\n');

    // Trigger download
    this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  }

  /** Create a download from a string */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
