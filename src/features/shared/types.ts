/**
 * ===============================================
 * UNIFIED PORTAL TYPES
 * ===============================================
 * @file src/features/shared/types.ts
 *
 * Shared type definitions for the unified portal architecture.
 */

import type { FeatureCapabilities, UserRole } from '../../../server/config/unified-navigation';

/**
 * Context passed to all unified feature modules
 * Provides access to role, capabilities, and common actions
 */
export interface PortalContext {
  /** Current user role (admin or client) */
  role: UserRole;
  /** Current user ID */
  userId: number;
  /** Current client ID (for client portal or admin viewing client) */
  clientId?: number;
  /** Feature capabilities based on role */
  capabilities: FeatureCapabilities;
  /** Show a notification to the user */
  showNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  /** Refresh current module data */
  refreshData: () => void;
  /** Switch to a different tab */
  switchTab: (tabId: string) => void;
  /** Get auth token for API calls */
  getAuthToken: () => string | null;
}

/**
 * Module lifecycle states
 */
export type ModuleState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Base data item interface
 */
export interface DataItem {
  id: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Filter configuration for data tables
 */
export interface FilterConfig {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'startsWith' | 'endsWith';
  value: string | number | boolean | null;
}

/**
 * Sort configuration
 */
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Column definition for data tables
 */
export interface ColumnDef<T> {
  id: string;
  header: string;
  accessor: keyof T | ((item: T) => string | number);
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: T[keyof T] | string | number, item: T) => string;
}

/**
 * Action button configuration
 */
export interface ActionConfig {
  id: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  requiresCapability?: keyof FeatureCapabilities;
  onClick: (item?: DataItem) => void | Promise<void>;
}

/**
 * Toolbar configuration
 */
export interface ToolbarConfig {
  showSearch?: boolean;
  searchPlaceholder?: string;
  primaryActions?: ActionConfig[];
  bulkActions?: ActionConfig[];
  filterOptions?: FilterConfig[];
}

/**
 * Module registration info
 */
export interface ModuleRegistration {
  id: string;
  name: string;
  roles: UserRole[];

  loader: () => Promise<{ default: unknown }>;
}
