/**
 * ===============================================
 * USE BULK ACTION HOOK
 * ===============================================
 * @file src/react/factories/useBulkAction.tsx
 *
 * Standardized hook for bulk table actions.
 * Eliminates ~25 lines of duplicated bulk action logic per table.
 */

import { useCallback, useState } from 'react';
import { createLogger } from '../../utils/logger';

const logger = createLogger('useBulkAction');

// ============================================
// TYPES
// ============================================

/**
 * Result from a bulk operation.
 */
export interface BulkOperationResult {
  /** Number of successful operations */
  success: number;
  /** Number of failed operations */
  failed: number;
  /** Error messages if any */
  errors?: string[];
}

/**
 * Selection state interface (from useSelection hook).
 */
export interface SelectionState<T> {
  selectedIds: Set<number | string>;
  selectedItems: T[];
  selectedCount: number;
  clearSelection: () => void;
}

/**
 * Notification function type.
 */
export type NotificationFn = (
  message: string,
  type: 'success' | 'error' | 'info' | 'warning'
) => void;

/**
 * Configuration for a bulk action.
 */
export interface BulkActionConfig<_T, R = BulkOperationResult> {
  /** Action name for logging */
  actionName: string;
  /** Confirmation message (set to false to skip confirmation) */
  confirmMessage?: string | false;
  /** The async operation to perform */
  operation: (ids: (number | string)[]) => Promise<R>;
  /** Success message generator */
  successMessage: (result: R, count: number) => string;
  /** Error message */
  errorMessage: string;
  /** Partial success message generator (optional) */
  partialSuccessMessage?: (result: R) => string;
  /** Callback after successful operation */
  onSuccess?: (result: R) => void;
  /** Callback after failed operation */
  onError?: (error: Error) => void;
}

/**
 * Options for useBulkAction hook.
 */
export interface UseBulkActionOptions<T> {
  /** Selection state from useSelection hook */
  selection: SelectionState<T>;
  /** Show notification callback */
  showNotification?: NotificationFn;
  /** Refetch data after operation */
  refetch?: () => void | Promise<void>;
}

/**
 * Return type from useBulkAction hook.
 */
export interface UseBulkActionReturn {
  /** Whether a bulk operation is in progress */
  isLoading: boolean;
  /** Execute a bulk action */
  executeBulkAction: <R = BulkOperationResult>(
    config: BulkActionConfig<unknown, R>
  ) => Promise<void>;
  /** Create a handler for a specific bulk action */
  createBulkHandler: <R = BulkOperationResult>(
    config: BulkActionConfig<unknown, R>
  ) => () => Promise<void>;
}

// ============================================
// HOOK
// ============================================

/**
 * Hook for standardized bulk action handling.
 *
 * @example
 * ```typescript
 * const { selection, ... } = useSelection<Invoice>();
 *
 * const { isLoading, createBulkHandler } = useBulkAction({
 *   selection,
 *   showNotification,
 *   refetch: loadInvoices
 * });
 *
 * const handleBulkMarkPaid = createBulkHandler({
 *   actionName: 'mark as paid',
 *   confirmMessage: 'Mark selected invoices as paid?',
 *   operation: bulkMarkPaid,
 *   successMessage: (result, count) =>
 *     `Marked ${result.success} invoice${result.success !== 1 ? 's' : ''} as paid`,
 *   errorMessage: 'Failed to mark invoices as paid'
 * });
 *
 * const handleBulkDelete = createBulkHandler({
 *   actionName: 'delete',
 *   confirmMessage: 'Permanently delete selected items? This cannot be undone.',
 *   operation: bulkDelete,
 *   successMessage: (_, count) => `Deleted ${count} item${count !== 1 ? 's' : ''}`,
 *   errorMessage: 'Failed to delete items'
 * });
 * ```
 */
export function useBulkAction<T>(options: UseBulkActionOptions<T>): UseBulkActionReturn {
  const { selection, showNotification, refetch } = options;
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Execute a bulk action with standardized handling.
   */
  const executeBulkAction = useCallback(
    async <R = BulkOperationResult>(config: BulkActionConfig<unknown, R>): Promise<void> => {
      const {
        actionName,
        confirmMessage,
        operation,
        successMessage,
        errorMessage,
        partialSuccessMessage,
        onSuccess,
        onError
      } = config;

      // Check selection
      if (selection.selectedCount === 0) {
        showNotification?.(`No items selected to ${actionName}`, 'warning');
        return;
      }

      // Confirmation
      if (confirmMessage !== false) {
        const message = confirmMessage ||
          `Are you sure you want to ${actionName} ${selection.selectedCount} item${selection.selectedCount !== 1 ? 's' : ''}?`;
        if (!confirm(message)) {
          return;
        }
      }

      setIsLoading(true);

      try {
        const ids = Array.from(selection.selectedIds);
        const result = await operation(ids);

        // Type guard to check if result matches BulkOperationResult structure
        const isBulkResult = (r: unknown): r is BulkOperationResult =>
          typeof r === 'object' &&
          r !== null &&
          'success' in r &&
          'failed' in r &&
          typeof (r as BulkOperationResult).success === 'number' &&
          typeof (r as BulkOperationResult).failed === 'number';

        if (isBulkResult(result)) {
          // Standard bulk result handling
          if (result.failed === 0) {
            showNotification?.(successMessage(result, ids.length), 'success');
          } else if (result.success > 0 && partialSuccessMessage) {
            showNotification?.(partialSuccessMessage(result), 'warning');
          } else if (result.success === 0) {
            showNotification?.(errorMessage, 'error');
          }
        } else {
          // Simple success (operation didn't return detailed result)
          showNotification?.(successMessage(result, ids.length), 'success');
        }

        selection.clearSelection();
        onSuccess?.(result);
        await refetch?.();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[useBulkAction] ${actionName} failed:`, error);
        showNotification?.(errorMessage, 'error');
        onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [selection, showNotification, refetch]
  );

  /**
   * Create a handler function for a specific bulk action.
   * Useful for binding to buttons.
   */
  const createBulkHandler = useCallback(
    <R = BulkOperationResult>(config: BulkActionConfig<unknown, R>) => {
      return () => executeBulkAction(config);
    },
    [executeBulkAction]
  );

  return {
    isLoading,
    executeBulkAction,
    createBulkHandler
  };
}

// ============================================
// PRESET BULK ACTIONS
// ============================================

/**
 * Common bulk action presets for quick setup.
 */
export const BULK_ACTION_PRESETS = {
  delete: (operation: (ids: (number | string)[]) => Promise<BulkOperationResult>) => ({
    actionName: 'delete',
    confirmMessage: 'Are you sure you want to delete the selected items? This action cannot be undone.',
    operation,
    successMessage: (result: BulkOperationResult) =>
      `Deleted ${result.success} item${result.success !== 1 ? 's' : ''}`,
    errorMessage: 'Failed to delete items',
    partialSuccessMessage: (result: BulkOperationResult) =>
      `Deleted ${result.success} items, ${result.failed} failed`
  }),

  archive: (operation: (ids: (number | string)[]) => Promise<BulkOperationResult>) => ({
    actionName: 'archive',
    confirmMessage: 'Archive the selected items?',
    operation,
    successMessage: (result: BulkOperationResult) =>
      `Archived ${result.success} item${result.success !== 1 ? 's' : ''}`,
    errorMessage: 'Failed to archive items'
  }),

  restore: (operation: (ids: (number | string)[]) => Promise<BulkOperationResult>) => ({
    actionName: 'restore',
    confirmMessage: 'Restore the selected items?',
    operation,
    successMessage: (result: BulkOperationResult) =>
      `Restored ${result.success} item${result.success !== 1 ? 's' : ''}`,
    errorMessage: 'Failed to restore items'
  }),

  export: (operation: (ids: (number | string)[]) => Promise<BulkOperationResult>) => ({
    actionName: 'export',
    confirmMessage: false as const, // No confirmation needed
    operation,
    successMessage: (_: BulkOperationResult, count: number) =>
      `Exported ${count} item${count !== 1 ? 's' : ''}`,
    errorMessage: 'Failed to export items'
  })
} as const;

/**
 * Helper to create a bulk status change action.
 */
export function createStatusChangeAction<S extends string>(
  statusLabel: string,
  operation: (ids: (number | string)[], status: S) => Promise<BulkOperationResult>,
  status: S
): BulkActionConfig<unknown, BulkOperationResult> {
  return {
    actionName: `mark as ${statusLabel}`,
    confirmMessage: `Mark selected items as ${statusLabel}?`,
    operation: (ids) => operation(ids, status),
    successMessage: (result) =>
      `Marked ${result.success} item${result.success !== 1 ? 's' : ''} as ${statusLabel}`,
    errorMessage: `Failed to mark items as ${statusLabel}`
  };
}
