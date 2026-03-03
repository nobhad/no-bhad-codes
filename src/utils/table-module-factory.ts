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
  type FilterState,
  type FilterCleanup
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
  cleanupBulkToolbar,
  type BulkActionConfig,
  type BulkSelectionCleanup
} from './table-bulk-actions';
import { exportToCsv, type ExportConfig } from './table-export';
import { showTableLoading, showTableEmpty } from './loading-utils';
import { showTableError } from './error-utils';
import { apiFetch } from './api-client';
import type { AdminDashboardContext } from '../features/admin/admin-types';
import { createLogger } from './logger';

const logger = createLogger('TableModuleFactory');

// ===============================================
// TYPES
// ===============================================

/**
 * View mode configuration for multi-view modules (table, kanban, grid)
 */
export interface ViewModeConfig<T> {
  /** Unique view mode identifier */
  id: string;
  /** Display label for the view toggle */
  label: string;
  /** Lucide icon name for the view toggle button */
  icon: string;
  /**
   * Render function for this view mode
   * @param data - Data array to render
   * @param ctx - Admin dashboard context
   * @param helpers - Helper functions from the module
   */
  render: (data: T[], ctx: AdminDashboardContext, helpers: TableModuleHelpers<T>) => void;
}

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

  /**
   * API endpoint to fetch data from.
   * Not required if fetchData is provided.
   */
  apiEndpoint?: string;

  /**
   * Custom data fetcher for complex scenarios (multiple endpoints, transformations).
   * If provided, takes precedence over apiEndpoint.
   * @param ctx - Admin dashboard context
   * @returns Promise with data array and optional stats
   */
  fetchData?: (ctx: AdminDashboardContext) => Promise<{ data: T[]; stats?: TStats }>;

  /** Bulk action configuration (optional) */
  bulkConfig?: BulkActionConfig;

  /** Export configuration (optional) */
  exportConfig?: ExportConfig;

  /**
   * Extract data and stats from API response.
   * Only used with apiEndpoint (not with fetchData).
   * @param response - Raw API response (after json.data ?? json)
   * @returns Object with data array and optional stats
   */
  extractData?: (response: unknown) => { data: T[]; stats?: TStats };

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

  /**
   * Optional: View modes for multi-view modules (e.g., table + kanban)
   * When provided, a view toggle will be rendered and the module
   * can switch between different visualizations.
   */
  viewModes?: ViewModeConfig<T>[];

  /**
   * Optional: Default view mode ID (must match one of viewModes[].id)
   * Defaults to 'table' or first viewMode if not specified.
   */
  defaultViewMode?: string;
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
  /** Get current view mode (if viewModes configured) */
  getCurrentViewMode: () => string | undefined;
  /** Set current view mode (if viewModes configured) */
  setViewMode: (modeId: string) => void;
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
  /** Get current view mode ID (if viewModes configured) */
  getCurrentViewMode: () => string | undefined;
  /** Set current view mode and re-render (if viewModes configured) */
  setViewMode: (modeId: string) => void;
  /** Get available view modes */
  getViewModes: () => ViewModeConfig<T>[] | undefined;
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

  // Cleanup functions for event listeners
  let filterCleanup: FilterCleanup | null = null;
  let bulkSelectionCleanup: BulkSelectionCleanup | null = null;

  // View mode state (for multi-view modules)
  let currentViewMode: string | undefined = config.viewModes
    ? config.defaultViewMode || config.viewModes[0]?.id || 'table'
    : undefined;
  const viewModeStorageKey = `admin_${config.moduleId}_viewMode`;

  // Load persisted view mode if available
  if (config.viewModes) {
    const savedViewMode = localStorage.getItem(viewModeStorageKey);
    if (savedViewMode && config.viewModes.some((v) => v.id === savedViewMode)) {
      currentViewMode = savedViewMode;
    }
  }

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
    return data.find((item) => item.id === id);
  }

  function updateItem(id: number, updates: Partial<T>): void {
    const item = findById(id);
    if (item) {
      Object.assign(item, updates);
    }
  }

  function setViewMode(modeId: string): void {
    if (!config.viewModes) return;
    const viewMode = config.viewModes.find((v) => v.id === modeId);
    if (!viewMode) return;

    currentViewMode = modeId;
    localStorage.setItem(viewModeStorageKey, modeId);

    // Update toggle button states
    const toggleContainer = getElement(`${config.moduleId}-view-toggle`);
    if (toggleContainer) {
      toggleContainer.querySelectorAll('button').forEach((btn) => {
        const isActive = btn.dataset.viewMode === modeId;
        btn.classList.toggle('btn-primary', isActive);
        btn.classList.toggle('btn-outline', !isActive);
      });
    }

    // Re-render with new view mode
    if (storedContext && data.length > 0) {
      renderCurrentView(data, storedContext);
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
        renderCurrentView(data, storedContext);
      }
    },
    findById,
    updateItem,
    getCurrentViewMode: () => currentViewMode,
    setViewMode
  };

  // ============================================
  // VIEW MODE TOGGLE INITIALIZATION
  // ============================================

  function initializeViewModeToggle(): void {
    if (!config.viewModes || config.viewModes.length <= 1) return;

    const toggleContainer = getElement(`${config.moduleId}-view-toggle`);
    if (!toggleContainer) return;

    // Clear existing content
    toggleContainer.innerHTML = '';
    toggleContainer.className = 'flex gap-1';

    config.viewModes.forEach((viewMode) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.viewMode = viewMode.id;
      btn.className =
        currentViewMode === viewMode.id ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
      btn.title = viewMode.label;
      btn.innerHTML = `<i data-lucide="${viewMode.icon}"></i>`;
      btn.addEventListener('click', () => setViewMode(viewMode.id));
      toggleContainer.appendChild(btn);
    });
  }

  // ============================================
  // FILTER UI INITIALIZATION
  // ============================================

  function initializeFilterUI(ctx: AdminDashboardContext): void {
    const container = getElement(`${config.moduleId}-filter-container`);
    if (!container) return;

    // Cleanup previous filter UI if re-initializing
    if (filterCleanup) {
      filterCleanup();
      filterCleanup = null;
    }

    // Initialize view mode toggle if configured
    initializeViewModeToggle();

    // Create filter UI (returns element and cleanup function)
    const filterResult = createFilterUI(config.filterConfig, filterState, (newState) => {
      filterState = newState;
      if (data.length > 0) {
        renderTable(data, ctx);
      }
    });

    // Store cleanup for later
    filterCleanup = filterResult.cleanup;

    // Insert before export button (Search → Filter → Export → Refresh order)
    const exportBtnRef = container.querySelector(`#export-${config.moduleId}-btn`);
    if (exportBtnRef) {
      container.insertBefore(filterResult.element, exportBtnRef);
    } else {
      container.appendChild(filterResult.element);
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
  // VIEW RENDERING (MULTI-VIEW SUPPORT)
  // ============================================

  /**
   * Render the current view mode (table or custom view)
   */
  function renderCurrentView(items: T[], ctx: AdminDashboardContext): void {
    // If view modes are configured and current mode is not 'table', use custom render
    if (config.viewModes && currentViewMode && currentViewMode !== 'table') {
      const viewMode = config.viewModes.find((v) => v.id === currentViewMode);
      if (viewMode) {
        // Apply filters first
        const filteredItems = applyFilters(items, filterState, config.filterConfig);
        viewMode.render(filteredItems, ctx, helpers);
        config.onTableRendered?.(filteredItems, ctx);
        return;
      }
    }

    // Default: render as table
    renderTable(items, ctx);
  }

  // ============================================
  // TABLE RENDERING
  // ============================================

  function renderTable(items: T[], ctx: AdminDashboardContext): void {
    const tableBody = getElement(`${config.moduleId}-table-body`);
    if (!tableBody) return;

    const emptyMsg = config.emptyMessage || `No ${config.moduleId} yet.`;
    const filterEmptyMsg =
      config.filterEmptyMessage || `No ${config.moduleId} match the current filters.`;

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

    // Setup bulk selection handlers (cleanup previous handlers first)
    if (config.bulkConfig) {
      if (bulkSelectionCleanup) {
        bulkSelectionCleanup();
        bulkSelectionCleanup = null;
      }
      cleanupBulkToolbar(config.moduleId);

      const allRowIds = paginatedItems.map((item) => item.id);
      const bulkResult = setupBulkSelectionHandlers(config.bulkConfig, allRowIds);
      bulkSelectionCleanup = bulkResult.cleanup;
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
      let extracted: { data: T[]; stats?: TStats };

      // Use custom fetchData if provided, otherwise use apiEndpoint
      if (config.fetchData) {
        extracted = await config.fetchData(ctx);
      } else if (config.apiEndpoint) {
        const response = await apiFetch(config.apiEndpoint);

        if (!response.ok) {
          if (response.status !== 401) {
            // Don't show error for 401 - handled by apiFetch
            const errorText = await response.text();
            logger.error(`[${config.moduleId}] API error:`, response.status, errorText);
            if (tableBody) {
              showTableError(
                tableBody,
                config.columnCount,
                `Error loading ${config.moduleId}: ${response.status}`,
                () => load(ctx)
              );
            }
          }
          return;
        }

        const json = await response.json();
        // Handle canonical API format { success: true, data: {...} }
        if (!config.extractData) {
          throw new Error(`[${config.moduleId}] extractData is required when using apiEndpoint`);
        }
        extracted = config.extractData(json.data ?? json);
      } else {
        throw new Error(`[${config.moduleId}] Either fetchData or apiEndpoint must be provided`);
      }

      data = extracted.data;
      stats = extracted.stats;

      // Update stats display if configured
      if (stats && config.renderStats) {
        config.renderStats(stats, ctx);
      }

      // Render current view (table or custom view mode)
      renderCurrentView(data, ctx);

      // Call optional callback
      config.onDataLoaded?.(data, ctx);
    } catch (error) {
      logger.error(`[${config.moduleId}] Failed to load:`, error);
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
        renderCurrentView(data, storedContext);
      }
    },
    getElement,
    resetCache: () => {
      // Cleanup event listeners before resetting
      if (filterCleanup) {
        filterCleanup();
        filterCleanup = null;
      }
      if (bulkSelectionCleanup) {
        bulkSelectionCleanup();
        bulkSelectionCleanup = null;
      }
      cleanupBulkToolbar(config.moduleId);

      cachedElements.clear();
      filterUIInitialized = false;
    },
    findById,
    updateItem: (id: number, updates: Partial<T>) => {
      updateItem(id, updates);
      if (storedContext) {
        renderCurrentView(data, storedContext);
      }
    },
    setContext: (ctx: AdminDashboardContext) => {
      storedContext = ctx;
    },
    getStats: () => stats,
    config,
    getCurrentViewMode: () => currentViewMode,
    setViewMode,
    getViewModes: () => config.viewModes
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
