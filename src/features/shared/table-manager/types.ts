/**
 * ===============================================
 * TABLE MANAGER TYPES
 * ===============================================
 * @file src/features/shared/table-manager/types.ts
 *
 * Shared TypeScript interfaces for the client-side table manager system.
 */

import type { TableDef, ColumnDef, SortDirection, TableFeatures, FilterDef } from '../../../config/table-definitions';

// Re-export shared types
export type { TableDef, ColumnDef, SortDirection, TableFeatures, FilterDef };

/** Sort state for a table */
export interface SortState {
  column: string;
  direction: SortDirection;
}

/** Pagination state */
export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

/** Row data with required id field */
export interface RowData {
  id: number | string;
  [key: string]: unknown;
}

/** Configuration passed to TableManager.init() */
export interface TableManagerConfig {
  /** The parsed table definition */
  tableDef: TableDef;
  /** The parsed row data */
  rows: RowData[];
  /** Root DOM element containing the table */
  rootEl: HTMLElement;
  /** Callback when a row action is triggered */
  onAction?: (action: string, rowId: string | number, row: RowData) => void;
  /** Callback when row is clicked (for navigation) */
  onRowClick?: (rowId: string | number, row: RowData) => void;
  /** Callback for bulk actions */
  onBulkAction?: (action: string, selectedIds: Set<string>) => void;
  /** Callback to refresh data */
  onRefresh?: () => Promise<void>;
}

/** Event emitted by table sub-modules */
export interface TableEvent {
  type: 'sort' | 'filter' | 'page' | 'select' | 'action' | 'refresh';
  payload?: unknown;
}

/** Listener for table events */
export type TableEventListener = (event: TableEvent) => void;
