/**
 * ===============================================
 * TABLE MANAGER CONSTANTS
 * ===============================================
 * @file src/features/shared/table-manager/constants.ts
 *
 * Named constants for the table manager system.
 * No magic numbers — all values are documented.
 */

/** Available page sizes for pagination */
export const PAGE_SIZES = [10, 25, 50, 100] as const;

/** Default page size when none is specified */
export const DEFAULT_PAGE_SIZE = 25;

/** LocalStorage key prefix for persisted table state */
export const STORAGE_KEY_PREFIX = 'table-manager';

/** Debounce delay (ms) for search input */
export const SEARCH_DEBOUNCE_MS = 250;

/** GSAP animation durations (seconds) */
export const ANIMATION = {
  /** Duration for row fade-in on initial render */
  ROW_FADE_IN: 0.3,
  /** Stagger delay between rows during fade-in */
  ROW_STAGGER: 0.03,
  /** Duration for sort reorder animation */
  SORT_REORDER: 0.35,
  /** Duration for pagination crossfade */
  PAGE_CROSSFADE: 0.2,
  /** Duration for bulk toolbar show/hide */
  TOOLBAR_TOGGLE: 0.2,
  /** Maximum number of rows to animate stagger (perf limit) */
  MAX_STAGGER_ROWS: 50
} as const;

/** CSS selectors used by the table manager */
export const SELECTORS = {
  TABLE_ROOT: '[data-table-id]',
  TABLE_CONFIG: 'data-table-config',
  TABLE_ROWS: 'data-table-rows',
  SORT_BUTTON: '[data-sort-key]',
  SEARCH_INPUT: '.table-search-input',
  FILTER_SELECT: '[data-filter]',
  ROW: '.table-row',
  ROW_CHECKBOX: '.row-checkbox',
  SELECT_ALL: '[data-action="select-all"]',
  PAGINATION: '[data-action="pagination"]',
  PAGE_PREV: '[data-page="prev"]',
  PAGE_NEXT: '[data-page="next"]',
  PAGE_INFO: '[data-page-info]',
  PAGINATION_SHOWING: '.pagination-showing',
  BULK_TOOLBAR: '[data-action="bulk-toolbar"]',
  BULK_COUNT: '.bulk-selected-count',
  REFRESH_BTN: '[data-action="refresh"]',
  EXPORT_BTN: '[data-action="export"]',
  ACTION_BTN: '[data-action]'
} as const;

/** CSS classes used by the table manager */
export const CLASSES = {
  INITIALIZED: 'data-initialized',
  SORT_ASC: 'sort-asc',
  SORT_DESC: 'sort-desc',
  ROW_HIDDEN: 'row-hidden',
  ROW_SELECTED: 'row-selected',
  ROW_FOCUSED: 'row-focused'
} as const;

/** Data attributes */
export const DATA_ATTRS = {
  ROW_ID: 'data-row-id',
  ROW_DATA: 'data-row',
  ROW_INDEX: 'data-row-index',
  SORT_KEY: 'data-sort-key',
  FILTER: 'data-filter',
  ACTION: 'data-action',
  CLICK_TARGET: 'data-click-target'
} as const;
