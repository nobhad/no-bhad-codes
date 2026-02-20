/**
 * ===============================================
 * TABLE MODULE FACTORY
 * ===============================================
 * @file src/utils/table-module-factory.ts
 *
 * Factory for creating admin table modules with standardized
 * initialization patterns. Eliminates ~140 lines of duplicate
 * code per module (filter UI, pagination, bulk actions, etc.).
 */

import {
  createFilterUI,
  createSortableHeaders,
  applyFilters,
  loadFilterState,
  saveFilterState,
  type TableFilterConfig,
  type FilterState
} from './table-filter';
import {
  createPaginationUI,
  applyPagination,
  getDefaultPaginationState,
  loadPaginationState,
  savePaginationState,
  type PaginationState,
  type PaginationConfig
} from './table-pagination';
import {
  createBulkActionToolbar,
  setupBulkSelectionHandlers,
  resetSelection,
  type BulkActionConfig
} from './table-bulk-actions';
import { exportToCsv, type ExportConfig } from './table-export';
import { showTableLoading, showTableEmpty } from './loading-utils';
import { showTableError } from './error-utils';
import { apiFetch } from './api-client';
import type { AdminDashboardContext } from '../features/admin/admin-types';

// ===============================================
// TYPES
// ===============================================

/**
 * Configuration for creating a table module
 */
export interface TableModuleConfig<T, TStats = unknown> {
  /** Unique module identifier (e.g., 'leads', 'contacts', 'projects') */
  moduleId: string;

  /** Filter configuration for this table */
  filterConfig: TableFilterConfig;

  /** Pagination configuration */
  paginationConfig: PaginationConfig;

  /** Number of columns in the table (for loading/empty states) */
  columnCount: number;

  /** API endpoint to fetch data from */
  apiEndpoint: string;

  /** Bulk action configuration (optional) */
  bulkConfig?: BulkActionConfig;

  /** Export configuration (optional) */
  exportConfig?: ExportConfig;

  /**
   * Extract data and stats from API response
   * @param response - Raw API response (after json.data ?? json)
   * @returns Object with data array and optional stats
   */
  extractData: (response: unknown) => { data: T[]; stats?: TStats };

  /**
   * Render a single table row
   * @param item - Data item to render
   * @param ctx - Admin dashboard context
   * @param helpers - Helper functions from the module
   * @returns HTMLTableRowElement to append to tbody
   */
  renderRow: (
    item: T,
    ctx: AdminDashboardContext,
    helpers: TableModuleHelpers<T>
  ) => HTMLTableRowElement;

  /**
   * Optional: Update stats display when data is loaded
   * @param stats - Stats object from extractData
   * @param ctx - Admin dashboard context
   */
  renderStats?: (stats: TStats, ctx: AdminDashboardContext) => void;

  /**
   * Optional: Callback when data is loaded
   * @param data - Full data array
   * @param ctx - Admin dashboard context
   */
  onDataLoaded?: (data: T[], ctx: AdminDashboardContext) => void;

  /**
   * Optional: Callback after table is rendered
   * @param filteredData - Filtered data array
   * @param ctx - Admin dashboard context
   */
  onTableRendered?: (filteredData: T[], ctx: AdminDashboardContext) => void;

  /**
   * Optional: Custom empty message
   */
  emptyMessage?: string;

  /**
   * Optional: Custom loading message
   */
  loadingMessage?: string;

  /**
   * Optional: Custom filter empty message
   */
  filterEmptyMessage?: string;

  /**
   * Optional: Default sort configuration
   */
  defaultSort?: {
    column: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * Helper functions provided to renderRow and other callbacks
 */
export interface TableModuleHelpers<T> {
  /** Get cached DOM element by ID */
  getElement: (id: string) => HTMLElement | null;
  /** Get current filter state */
  getFilterState: () => FilterState;
  /** Get current pagination state */
  getPaginationState: () => PaginationState;
  /** Get current data array */
  getData: () => T[];
  /** Get stored context */
  getContext: () => AdminDashboardContext | null;
  /** Re-render the table with current data */
  rerender: () => void;
  /** Find item by ID in current data */
  findById: (id: number) => T | undefined;
  /** Update an item in the data array */
  updateItem: (id: number, updates: Partial<T>) => void;
}

/**
 * Public API returned by createTableModule
 */
export interface TableModule<T, TStats = unknown> {
  /** Load data from API and render table */
  load: (ctx: AdminDashboardContext) => Promise<void>;
  /** Get current data array */
  getData: () => T[];
  /** Get stored dashboard context */
  getContext: () => AdminDashboardContext | null;
  /** Get current filter state */
  getFilterState: () => FilterState;
  /** Get current pagination state */
  getPaginationState: () => PaginationState;
  /** Re-render table with current data */
  rerender: () => void;
  /** Get cached DOM element by ID */
  getElement: (id: string) => HTMLElement | null;
  /** Clear cached DOM elements (call when tab re-renders) */
  resetCache: () => void;
  /** Find item by ID */
  findById: (id: number) => T | undefined;
  /** Update item in data array and re-render */
  updateItem: (id: number, updates: Partial<T>) => void;
  /** Set the context (for external use) */
  setContext: (ctx: AdminDashboardContext) => void;
  /** Get the last loaded stats */
  getStats: () => TStats | undefined;
  /** Module configuration */
  config: TableModuleConfig<T, TStats>;
}

// ===============================================
// FACTORY FUNCTION
// ===============================================

/**
 * Create a standardized admin table module
 *
 * @example
 * const leadsModule = createTableModule({
 *   moduleId: 'leads',
 *   filterConfig: LEADS_FILTER_CONFIG,
 *   paginationConfig: LEADS_PAGINATION_CONFIG,
 *   columnCount: 7,
 *   apiEndpoint: '/api/admin/leads',
 *   bulkConfig: LEADS_BULK_CONFIG,
 *   exportConfig: LEADS_EXPORT_CONFIG,
 *   extractData: (json) => ({ data: json.leads || [], stats: json.stats }),
 *   renderRow: (lead, ctx, helpers) => {
 *     const row = document.createElement('tr');
 *     // ... build row
 *     return row;
 *   },
 *   renderStats: (stats, ctx) => {
 *     // ... update stat cards
 *   }
 * });
 *
 * // Usage in module:
 * export const loadLeads = leadsModule.load;
 * export const getLeadsData = leadsModule.getData;
 */
export function createTableModule<T extends { id: number }, TStats = unknown>(
  config: TableModuleConfig<T, TStats>
): TableModule<T, TStats> {
  // ============================================
  // INTERNAL STATE
  // ============================================

  let data: T[] = [];
  let stats: TStats | undefined;
  let storedContext: AdminDashboardContext | null = null;
  let filterUIInitialized = false;

  // Load filter state with optional default sort
  let filterState: FilterState = (() => {
    const loaded = loadFilterState(config.filterConfig.storageKey);
    if (config.defaultSort && !loaded.sortColumn) {
      loaded.sortColumn = config.defaultSort.column;
      loaded.sortDirection = config.defaultSort.direction;
    }
    return loaded;
  })();

  let paginationState: PaginationState = {
    ...getDefaultPaginationState(config.paginationConfig),
    ...loadPaginationState(config.paginationConfig.storageKey!)
  };

  // DOM element cache
  const cachedElements: Map<string, HTMLElement | null> = new Map();

  // ============================================
  // INTERNAL HELPERS
  // ============================================

  function getElement(id: string): HTMLElement | null {
    if (!cachedElements.has(id)) {
      cachedElements.set(id, document.getElementById(id));
    }
    return cachedElements.get(id) ?? null;
  }

  function findById(id: number): T | undefined {
    return data.find(item => item.id === id);
  }

  function updateItem(id: number, updates: Partial<T>): void {
    const item = findById(id);
    if (item) {
      Object.assign(item, updates);
    }
  }

  // Helper object passed to renderRow
  const helpers: TableModuleHelpers<T> = {
    getElement,
    getFilterState: () => filterState,
    getPaginationState: () => paginationState,
    getData: () => data,
    getContext: () => storedContext,
    rerender: () => {
      if (storedContext) {
        renderTable(data, storedContext);
      }
    },
    findById,
    updateItem
  };

  // ============================================
  // FILTER UI INITIALIZATION
  // ============================================

  function initializeFilterUI(ctx: AdminDashboardContext): void {
    const container = getElement(`${config.moduleId}-filter-container`);
    if (!container) return;

    // Create filter UI
    const filterUI = createFilterUI(
      config.filterConfig,
      filterState,
      (newState) => {
        filterState = newState;
        if (data.length > 0) {
          renderTable(data, ctx);
        }
      }
    );

    // Insert before export button (Search → Filter → Export → Refresh order)
    const exportBtnRef = container.querySelector(`#export-${config.moduleId}-btn`);
    if (exportBtnRef) {
      container.insertBefore(filterUI, exportBtnRef);
    } else {
      container.appendChild(filterUI);
    }

    // Setup sortable headers after table is rendered
    setTimeout(() => {
      createSortableHeaders(config.filterConfig, filterState, (column, direction) => {
        filterState = { ...filterState, sortColumn: column, sortDirection: direction };
        saveFilterState(config.filterConfig.storageKey, filterState);
        if (data.length > 0) {
          renderTable(data, ctx);
        }
      });
    }, 100);

    // Setup bulk action toolbar if configured
    if (config.bulkConfig) {
      const bulkToolbarEl = document.getElementById(`${config.moduleId}-bulk-toolbar`);
      if (bulkToolbarEl) {
        const toolbar = createBulkActionToolbar({
          ...config.bulkConfig,
          onSelectionChange: () => {}
        });
        bulkToolbarEl.replaceWith(toolbar);
      }
    }

    // Wire export button if configured
    if (config.exportConfig) {
      const exportBtn = container.querySelector(`#export-${config.moduleId}-btn`);
      if (exportBtn && !(exportBtn as HTMLElement).dataset.listenerAdded) {
        (exportBtn as HTMLElement).dataset.listenerAdded = 'true';
        exportBtn.addEventListener('click', () => {
          const filtered = applyFilters(data, filterState, config.filterConfig);
          exportToCsv(filtered as unknown as Record<string, unknown>[], config.exportConfig!);
        });
      }
    }
  }

  // ============================================
  // TABLE RENDERING
  // ============================================

  function renderTable(items: T[], ctx: AdminDashboardContext): void {
    const tableBody = getElement(`${config.moduleId}-table-body`);
    if (!tableBody) return;

    const emptyMsg = config.emptyMessage || `No ${config.moduleId} yet.`;
    const filterEmptyMsg = config.filterEmptyMessage || `No ${config.moduleId} match the current filters.`;

    // Handle empty data
    if (!items || items.length === 0) {
      showTableEmpty(tableBody, config.columnCount, emptyMsg);
      renderPaginationUI(0, ctx);
      return;
    }

    // Apply filters
    const filteredItems = applyFilters(items, filterState, config.filterConfig);

    // Handle no matches
    if (filteredItems.length === 0) {
      showTableEmpty(tableBody, config.columnCount, filterEmptyMsg);
      renderPaginationUI(0, ctx);
      return;
    }

    // Update pagination state
    paginationState.totalItems = filteredItems.length;

    // Apply pagination
    const paginatedItems = applyPagination(filteredItems, paginationState);

    // Reset bulk selection
    if (config.bulkConfig) {
      resetSelection(config.moduleId);
    }

    // Clear and rebuild table
    tableBody.innerHTML = '';

    paginatedItems.forEach((item) => {
      const row = config.renderRow(item, ctx, helpers);
      tableBody.appendChild(row);
    });

    // Setup bulk selection handlers
    if (config.bulkConfig) {
      const allRowIds = paginatedItems.map(item => item.id);
      setupBulkSelectionHandlers(config.bulkConfig, allRowIds);
    }

    // Render pagination
    renderPaginationUI(filteredItems.length, ctx);

    // Call optional callback
    config.onTableRendered?.(filteredItems, ctx);
  }

  // ============================================
  // PAGINATION UI
  // ============================================

  function renderPaginationUI(totalItems: number, ctx: AdminDashboardContext): void {
    const container = document.getElementById(`${config.moduleId}-pagination`);
    if (!container) return;

    paginationState.totalItems = totalItems;

    const paginationUI = createPaginationUI(
      config.paginationConfig,
      paginationState,
      (newState) => {
        paginationState = newState;
        savePaginationState(config.paginationConfig.storageKey!, paginationState);
        if (data.length > 0) {
          renderTable(data, ctx);
        }
      }
    );

    container.innerHTML = '';
    container.appendChild(paginationUI);
  }

  // ============================================
  // DATA LOADING
  // ============================================

  async function load(ctx: AdminDashboardContext): Promise<void> {
    storedContext = ctx;

    // Initialize filter UI once
    if (!filterUIInitialized) {
      initializeFilterUI(ctx);
      filterUIInitialized = true;
    }

    // Show loading state
    const tableBody = getElement(`${config.moduleId}-table-body`);
    const loadingMsg = config.loadingMessage || `Loading ${config.moduleId}...`;
    if (tableBody) {
      showTableLoading(tableBody, config.columnCount, loadingMsg);
    }

    try {
      const response = await apiFetch(config.apiEndpoint);

      if (response.ok) {
        const json = await response.json();
        // Handle canonical API format { success: true, data: {...} }
        const extracted = config.extractData(json.data ?? json);
        data = extracted.data;
        stats = extracted.stats;

        // Update stats display if configured
        if (stats && config.renderStats) {
          config.renderStats(stats, ctx);
        }

        // Render table
        renderTable(data, ctx);

        // Call optional callback
        config.onDataLoaded?.(data, ctx);

      } else if (response.status !== 401) {
        // Don't show error for 401 - handled by apiFetch
        const errorText = await response.text();
        console.error(`[${config.moduleId}] API error:`, response.status, errorText);
        if (tableBody) {
          showTableError(
            tableBody,
            config.columnCount,
            `Error loading ${config.moduleId}: ${response.status}`,
            () => load(ctx)
          );
        }
      }
    } catch (error) {
      console.error(`[${config.moduleId}] Failed to load:`, error);
      // Reuse tableBody from outer scope (already fetched before try block)
      if (tableBody) {
        showTableError(
          tableBody,
          config.columnCount,
          `Network error loading ${config.moduleId}`,
          () => load(ctx)
        );
      }
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    load,
    getData: () => data,
    getContext: () => storedContext,
    getFilterState: () => filterState,
    getPaginationState: () => paginationState,
    rerender: () => {
      if (storedContext) {
        renderTable(data, storedContext);
      }
    },
    getElement,
    resetCache: () => {
      cachedElements.clear();
      filterUIInitialized = false;
    },
    findById,
    updateItem: (id: number, updates: Partial<T>) => {
      updateItem(id, updates);
      if (storedContext) {
        renderTable(data, storedContext);
      }
    },
    setContext: (ctx: AdminDashboardContext) => {
      storedContext = ctx;
    },
    getStats: () => stats,
    config
  };
}

// ===============================================
// HELPER: CREATE STANDARD PAGINATION CONFIG
// ===============================================

/**
 * Create a standard pagination config for a module
 */
export function createPaginationConfig(moduleId: string): PaginationConfig {
  return {
    tableId: moduleId,
    pageSizeOptions: [10, 25, 50, 100],
    defaultPageSize: 25,
    storageKey: `admin_${moduleId}_pagination`
  };
}

// ===============================================
// HELPER: STANDARD ROW DATA ATTRIBUTES
// ===============================================

/**
 * Set standard data attributes on a table row
 */
export function setRowDataAttributes(
  row: HTMLTableRowElement,
  moduleId: string,
  itemId: number
): void {
  row.dataset[`${moduleId}Id`] = String(itemId);
}
