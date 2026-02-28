/**
 * ===============================================
 * API WRAPPER UTILITIES
 * ===============================================
 * @file src/utils/api-wrappers.ts
 *
 * Consolidates duplicated try-catch + toast notification patterns
 * found across admin modules. Provides a clean, DRY interface for
 * executing API calls with automatic error handling and notifications.
 *
 * USAGE EXAMPLES:
 *
 * // Basic usage with success/error messages
 * const result = await executeWithToast(
 *   () => apiPut(`/api/admin/leads/${id}/status`, { status }),
 *   { success: 'Status updated', error: 'Failed to update status' }
 * );
 *
 * // With loading message and onSuccess callback
 * await executeWithToast<{ projectId: number }>(
 *   () => apiPost(`/api/admin/leads/${leadId}/activate`),
 *   { loading: 'Activating lead...', success: 'Lead activated!', error: 'Failed to activate' },
 *   (data) => navigateToProject(data.projectId)
 * );
 *
 * // Simple action that returns boolean
 * const success = await executeActionWithToast(
 *   () => apiDelete(`/api/admin/rules/${ruleId}`),
 *   { success: 'Rule deleted', error: 'Failed to delete rule' }
 * );
 */

import { showToast } from './toast-notifications';
import { createLogger } from './logger';

const logger = createLogger('ApiWrappers');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Messages to display for different API call states
 */
export interface ApiMessages {
  /** Optional loading message (shown as info toast while request is in progress) */
  loading?: string;
  /** Success message (shown when API returns ok response) */
  success: string;
  /** Error message (fallback when API fails or returns error) */
  error: string;
}

/**
 * Result of an API call execution
 */
export interface ApiResult<T> {
  /** Whether the API call succeeded */
  success: boolean;
  /** Response data (only present on success) */
  data?: T;
  /** Error message (only present on failure) */
  errorMessage?: string;
}

/**
 * Options for API call execution
 */
export interface ApiExecuteOptions {
  /** Whether to show toast notifications (default: true) */
  showToasts?: boolean;
  /** Whether to log errors to console (default: true) */
  logErrors?: boolean;
  /** Custom error extractor for non-standard API responses */
  extractError?: (response: Response, data: unknown) => string | undefined;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Execute an API call with automatic toast notifications and error handling.
 *
 * Consolidates the common pattern of:
 * 1. Show loading toast (optional)
 * 2. Execute API call
 * 3. Parse response
 * 4. Show success/error toast
 * 5. Call onSuccess callback
 *
 * @param apiCall - Function that returns a fetch Promise (from api-client)
 * @param messages - Toast messages for loading/success/error states
 * @param onSuccess - Optional callback executed on success with parsed data
 * @param options - Additional options for execution behavior
 * @returns Promise with success status and optional data
 *
 * @example
 * // Update status with notification
 * const result = await executeWithToast(
 *   () => apiPut(`/api/leads/${id}/status`, { status: 'active' }),
 *   { success: 'Status updated', error: 'Failed to update status' }
 * );
 *
 * if (result.success) {
 *   refreshTable();
 * }
 */
export async function executeWithToast<T = unknown>(
  apiCall: () => Promise<Response>,
  messages: ApiMessages,
  onSuccess?: (data: T) => void | Promise<void>,
  options: ApiExecuteOptions = {}
): Promise<ApiResult<T>> {
  const { showToasts = true, logErrors = true, extractError } = options;

  try {
    // Show loading toast if provided
    if (messages.loading && showToasts) {
      showToast(messages.loading, 'info');
    }

    const response = await apiCall();

    if (response.ok) {
      // Parse response data
      const data = await parseResponseData<T>(response);

      // Show success toast
      if (showToasts) {
        showToast(messages.success, 'success');
      }

      // Execute success callback
      if (onSuccess) {
        await onSuccess(data);
      }

      return { success: true, data };
    }

    // Handle non-401 errors (401 is handled by api-client interceptor)
    if (response.status !== 401) {
      const errorData = await parseErrorData(response);
      const errorMessage = extractErrorMessage(errorData, messages.error, extractError, response);

      if (showToasts) {
        showToast(errorMessage, 'error');
      }

      if (logErrors) {
        logger.error('API Error:', { status: response.status, error: errorMessage });
      }

      return { success: false, errorMessage };
    }

    // 401 errors are handled by the auth system
    return { success: false, errorMessage: 'Authentication required' };
  } catch (error) {
    // Network or unexpected errors
    if (logErrors) {
      logger.error('API Error:', error);
    }

    if (showToasts) {
      showToast(messages.error, 'error');
    }

    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : messages.error
    };
  }
}

/**
 * Execute an API call that returns void/no data with toast notifications.
 *
 * Simplified version of executeWithToast for actions that don't need response data.
 *
 * @param apiCall - Function that returns a fetch Promise
 * @param messages - Toast messages for success/error states
 * @param options - Additional options for execution behavior
 * @returns Promise with boolean success status
 *
 * @example
 * const success = await executeActionWithToast(
 *   () => apiPost(`/api/leads/tasks/${taskId}/complete`),
 *   { success: 'Task completed', error: 'Failed to complete task' }
 * );
 */
export async function executeActionWithToast(
  apiCall: () => Promise<Response>,
  messages: ApiMessages,
  options?: ApiExecuteOptions
): Promise<boolean> {
  const result = await executeWithToast(apiCall, messages, undefined, options);
  return result.success;
}

/**
 * Execute a delete operation with confirmation and toast.
 *
 * Convenience wrapper for common delete pattern.
 *
 * @param entityName - Name of entity being deleted (for messages)
 * @param deleteCall - Function that performs the delete API call
 * @param onSuccess - Optional callback after successful deletion
 * @returns Promise with boolean success status
 *
 * @example
 * const deleted = await executeDeleteWithToast(
 *   'scoring rule',
 *   () => apiDelete(`/api/admin/leads/scoring-rules/${ruleId}`),
 *   () => loadScoringRules()
 * );
 */
export async function executeDeleteWithToast(
  entityName: string,
  deleteCall: () => Promise<Response>,
  onSuccess?: () => void | Promise<void>
): Promise<boolean> {
  const result = await executeWithToast(
    deleteCall,
    {
      success: `${capitalizeFirst(entityName)} deleted successfully`,
      error: `Failed to delete ${entityName}`
    },
    onSuccess
  );
  return result.success;
}

/**
 * Execute an update operation with toast notifications.
 *
 * Convenience wrapper for common update pattern.
 *
 * @param entityName - Name of entity being updated (for messages)
 * @param updateCall - Function that performs the update API call
 * @param onSuccess - Optional callback after successful update
 * @returns Promise with success status and data
 *
 * @example
 * const result = await executeUpdateWithToast<Client>(
 *   'client',
 *   () => apiPut(`/api/clients/${clientId}`, { status: 'active' }),
 *   (client) => updateLocalState(client)
 * );
 */
export async function executeUpdateWithToast<T = unknown>(
  entityName: string,
  updateCall: () => Promise<Response>,
  onSuccess?: (data: T) => void | Promise<void>
): Promise<ApiResult<T>> {
  return executeWithToast<T>(
    updateCall,
    {
      success: `${capitalizeFirst(entityName)} updated successfully`,
      error: `Failed to update ${entityName}`
    },
    onSuccess
  );
}

/**
 * Execute a create operation with toast notifications.
 *
 * Convenience wrapper for common create pattern.
 *
 * @param entityName - Name of entity being created (for messages)
 * @param createCall - Function that performs the create API call
 * @param onSuccess - Optional callback after successful creation
 * @returns Promise with success status and data
 *
 * @example
 * const result = await executeCreateWithToast<{ id: number }>(
 *   'task',
 *   () => apiPost(`/api/admin/leads/${leadId}/tasks`, taskData),
 *   (data) => refreshTaskList(data.id)
 * );
 */
export async function executeCreateWithToast<T = unknown>(
  entityName: string,
  createCall: () => Promise<Response>,
  onSuccess?: (data: T) => void | Promise<void>
): Promise<ApiResult<T>> {
  return executeWithToast<T>(
    createCall,
    {
      success: `${capitalizeFirst(entityName)} created successfully`,
      error: `Failed to create ${entityName}`
    },
    onSuccess
  );
}

// ============================================================================
// BULK OPERATION HELPERS
// ============================================================================

/**
 * Execute a bulk operation with progress tracking.
 *
 * Useful for operations on multiple items with consolidated feedback.
 *
 * @param operations - Array of API call functions to execute
 * @param messages - Messages object with templates (use {count} for counts)
 * @returns Promise with success/failure counts
 *
 * @example
 * const operations = selectedIds.map(id => () => apiPut(`/api/leads/${id}/status`, { status }));
 * const { successCount, failCount } = await executeBulkWithToast(
 *   operations,
 *   {
 *     success: 'Updated {count} leads',
 *     error: 'Failed to update some leads',
 *     partial: 'Updated {successCount} of {totalCount} leads'
 *   }
 * );
 */
export async function executeBulkWithToast(
  operations: Array<() => Promise<Response>>,
  messages: {
    success: string;
    error: string;
    partial?: string;
  }
): Promise<{ successCount: number; failCount: number }> {
  const results = await Promise.allSettled(
    operations.map(async (op) => {
      const response = await op();
      return response.ok;
    })
  );

  const successCount = results.filter(
    (r) => r.status === 'fulfilled' && r.value === true
  ).length;
  const failCount = operations.length - successCount;

  if (successCount === operations.length) {
    // All succeeded
    const message = messages.success.replace('{count}', String(successCount));
    showToast(message, 'success');
  } else if (successCount === 0) {
    // All failed
    showToast(messages.error, 'error');
  } else {
    // Partial success
    const template = messages.partial || `${messages.success} (${failCount} failed)`;
    const message = template
      .replace('{successCount}', String(successCount))
      .replace('{failCount}', String(failCount))
      .replace('{totalCount}', String(operations.length))
      .replace('{count}', String(successCount));
    showToast(message, 'warning');
  }

  return { successCount, failCount };
}

// ============================================================================
// SILENT EXECUTION (NO TOASTS)
// ============================================================================

/**
 * Execute an API call silently (no toasts, just error logging).
 *
 * Useful for background refreshes or non-critical operations.
 *
 * @param apiCall - Function that returns a fetch Promise
 * @returns Promise with success status and optional data
 *
 * @example
 * const result = await executeSilent<Stats>(() => apiFetch('/api/stats'));
 * if (result.success) {
 *   updateStats(result.data);
 * }
 */
export async function executeSilent<T = unknown>(
  apiCall: () => Promise<Response>
): Promise<ApiResult<T>> {
  return executeWithToast<T>(
    apiCall,
    { success: '', error: '' },
    undefined,
    { showToasts: false }
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse response data from successful API response
 */
async function parseResponseData<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    return (await response.json()) as T;
  }

  // For non-JSON responses, return empty object
  return {} as T;
}

/**
 * Parse error data from failed API response
 */
async function parseErrorData(response: Response): Promise<unknown> {
  try {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

/**
 * Extract error message from error data
 */
function extractErrorMessage(
  errorData: unknown,
  fallbackMessage: string,
  customExtractor?: (response: Response, data: unknown) => string | undefined,
  response?: Response
): string {
  // Try custom extractor first
  if (customExtractor && response) {
    const customMessage = customExtractor(response, errorData);
    if (customMessage) return customMessage;
  }

  // Standard error message extraction
  if (errorData && typeof errorData === 'object') {
    const data = errorData as Record<string, unknown>;

    // Check common error message fields
    if (typeof data.message === 'string') return data.message;
    if (typeof data.error === 'string') return data.error;
    if (typeof data.errors === 'string') return data.errors;

    // Check for array of errors
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const firstError = data.errors[0];
      if (typeof firstError === 'string') return firstError;
      if (typeof firstError === 'object' && firstError && 'message' in firstError) {
        return String(firstError.message);
      }
    }
  }

  return fallbackMessage;
}

/**
 * Capitalize first letter of a string
 */
function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
