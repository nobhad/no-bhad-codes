/**
 * ===============================================
 * TABLE MANAGER - BARREL EXPORT
 * ===============================================
 * @file src/features/shared/table-manager/index.ts
 */

export { TableManager, createTableManagerFromElement } from './TableManager';
export { TableSorter } from './TableSorter';
export { TableFilter } from './TableFilter';
export { TablePaginator } from './TablePaginator';
export { TableSelector } from './TableSelector';
export { TableExporter } from './TableExporter';
export { TableAnimator } from './TableAnimator';
export { loadEjsTable, destroyEjsTable, destroyAllEjsTables, hasEjsTable } from './loadEjsTable';

export type {
  TableManagerConfig,
  RowData,
  SortState,
  PaginationState,
  TableEvent,
  TableEventListener,
  TableDef,
  ColumnDef,
  SortDirection,
  TableFeatures,
  FilterDef
} from './types';

export {
  PAGE_SIZES,
  DEFAULT_PAGE_SIZE,
  SEARCH_DEBOUNCE_MS,
  ANIMATION,
  SELECTORS,
  CLASSES,
  DATA_ATTRS
} from './constants';
