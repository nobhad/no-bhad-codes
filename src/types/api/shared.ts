/**
 * ===============================================
 * API TYPES — SHARED
 * ===============================================
 */

// ============================================
// Generic API Response Types
// ============================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  timestamp?: string;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * API error response
 */
export interface ApiError {
  error: string;
  code: string;
  timestamp: string;
  details?: ValidationErrorDetail[];
}

/**
 * Validation error detail
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code?: string;
  value?: unknown;
}


// ============================================
// Query Parameter Types
// ============================================

/**
 * Standard pagination query params
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

