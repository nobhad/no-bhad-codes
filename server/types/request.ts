/**
 * ===============================================
 * EXPRESS REQUEST TYPE EXTENSIONS
 * ===============================================
 * @file server/types/request.ts
 *
 * Type definitions for Express request extensions,
 * including authentication context and custom properties.
 */

import { Request, Response, NextFunction } from 'express';
import type { LoggerService } from '../services/logger.js';

// ============================================
// User Types
// ============================================

/**
 * User role type
 */
export type UserRole = 'admin' | 'client';

/**
 * Base authenticated user
 */
export interface AuthenticatedUser {
  id: number;
  email: string;
  role: UserRole;
}

/**
 * Admin user context
 */
export interface AdminUser extends AuthenticatedUser {
  role: 'admin';
  username: string;
}

/**
 * Client user context
 */
export interface ClientUser extends AuthenticatedUser {
  role: 'client';
  companyName: string;
  contactName: string;
  status: string;
}

/**
 * Any authenticated user
 */
export type AnyUser = AdminUser | ClientUser;

// ============================================
// Request Extensions
// ============================================

/**
 * Request with user authentication context
 */
export interface AuthenticatedRequest<U extends AnyUser = AnyUser> extends Request {
  user: U;
  token?: string;
  sessionId?: string;
}

/**
 * Request with optional user (for routes that work with or without auth)
 */
export interface OptionalAuthRequest<U extends AnyUser = AnyUser> extends Request {
  user?: U;
  token?: string;
}

/**
 * Admin-only authenticated request
 */
export interface AdminRequest extends AuthenticatedRequest<AdminUser> {
  user: AdminUser;
}

/**
 * Client-only authenticated request
 */
export interface ClientRequest extends AuthenticatedRequest<ClientUser> {
  user: ClientUser;
}

/**
 * Request with logging context
 */
export interface LoggingRequest extends Request {
  id: string;
  startTime: number;
  logger: LoggerService;
}

/**
 * Request with both auth and logging
 */
export interface FullContextRequest<U extends AnyUser = AnyUser>
  extends AuthenticatedRequest<U>,
    LoggingRequest {
  user: U;
  id: string;
  startTime: number;
  logger: LoggerService;
}

// ============================================
// Request Body Types
// ============================================

/**
 * Typed request with body
 */
export interface TypedRequest<T> extends Request {
  body: T;
}

/**
 * Typed request with body and auth
 */
export interface AuthenticatedTypedRequest<T, U extends AnyUser = AnyUser>
  extends AuthenticatedRequest<U> {
  body: T;
}

/**
 * Typed request with query params
 */
export interface TypedQueryRequest<Q> extends Request {
  query: Q & Request['query'];
}

/**
 * Typed request with route params
 */
export interface TypedParamsRequest<P extends Record<string, string>> extends Request {
  params: P;
}

/**
 * Fully typed request
 */
export interface FullyTypedRequest<
  Body = unknown,
  Query = unknown,
  Params extends Record<string, string> = Record<string, string>,
  U extends AnyUser = AnyUser
> extends AuthenticatedRequest<U> {
  body: Body;
  query: Query & Request['query'];
  params: Params;
}

// ============================================
// Common Request Body Types
// ============================================

/**
 * Login request body
 */
export interface LoginRequestBody {
  email: string;
  password: string;
}

/**
 * Admin login request body
 */
export interface AdminLoginRequestBody {
  password: string;
}

/**
 * Contact form request body
 */
export interface ContactFormRequestBody {
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  subject?: string;
  inquiryType?: string;
  companyName?: string;
  message: string;
}

/**
 * Client intake request body
 */
export interface ClientIntakeRequestBody {
  name: string;
  email: string;
  companyName?: string;
  projectType: string;
  budgetRange: string;
  timeline: string;
  description: string;
  features?: string[];
  phone?: string;
}

/**
 * Send message request body
 */
export interface SendMessageRequestBody {
  message: string;
  attachments?: string[];
}

/**
 * Create thread request body
 */
export interface CreateThreadRequestBody {
  client_id: number;
  subject: string;
  message: string;
}

/**
 * Status update request body
 */
export interface StatusUpdateRequestBody {
  status: string;
}

// ============================================
// Common Query Param Types
// ============================================

/**
 * Pagination query params
 */
export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

/**
 * Date range query params
 */
export interface DateRangeQuery {
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Lead filter query params
 */
export interface LeadFilterQuery extends PaginationQuery, DateRangeQuery {
  status?: string;
  source?: string;
}

/**
 * Project filter query params
 */
export interface ProjectFilterQuery extends PaginationQuery, DateRangeQuery {
  status?: string;
  clientId?: string;
}

/**
 * Client filter query params
 */
export interface ClientFilterQuery extends PaginationQuery {
  status?: string;
}

// ============================================
// Common Route Param Types
// ============================================

/**
 * ID route param
 */
export interface IdParams {
  id: string;
}

/**
 * Thread and message ID params
 */
export interface ThreadMessageParams {
  threadId: string;
  messageId?: string;
}

/**
 * Project and milestone params
 */
export interface ProjectMilestoneParams {
  projectId: string;
  milestoneId?: string;
}

// ============================================
// Middleware Types
// ============================================

/**
 * Express middleware handler
 */
export type MiddlewareHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Authenticated middleware handler
 */
export type AuthenticatedMiddlewareHandler<U extends AnyUser = AnyUser> = (
  req: AuthenticatedRequest<U>,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Error middleware handler
 */
export type ErrorMiddlewareHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Async handler wrapper type
 */
export type AsyncHandler<T extends Request = Request> = (
  req: T,
  res: Response,
  next: NextFunction
) => Promise<void>;

// ============================================
// Response Types
// ============================================

/**
 * API response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

/**
 * Paginated API response
 */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
  timestamp: string;
}

// ============================================
// Type Guards
// ============================================

/**
 * Check if user is admin
 */
export function isAdminUser(user: AnyUser | undefined): user is AdminUser {
  return user !== undefined && user.role === 'admin';
}

/**
 * Check if user is client
 */
export function isClientUser(user: AnyUser | undefined): user is ClientUser {
  return user !== undefined && user.role === 'client';
}

/**
 * Check if request is authenticated
 */
export function isAuthenticatedRequest(
  req: Request
): req is AuthenticatedRequest {
  return 'user' in req && req.user !== undefined;
}

/**
 * Check if request has logging context
 */
export function hasLoggingContext(req: Request): req is LoggingRequest {
  return 'id' in req && 'startTime' in req && 'logger' in req;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Parse pagination from query params
 */
export function parsePagination(query: PaginationQuery): {
  page: number;
  limit: number;
  offset: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
} {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '15', 10)));
  const offset = (page - 1) * limit;
  const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';

  return {
    page,
    limit,
    offset,
    sortBy: query.sortBy,
    sortOrder
  };
}

/**
 * Parse date range from query params
 */
export function parseDateRange(query: DateRangeQuery): {
  dateFrom?: Date;
  dateTo?: Date;
} {
  return {
    dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
    dateTo: query.dateTo ? new Date(query.dateTo) : undefined
  };
}

/**
 * Send success response
 */
export function sendSuccess<T>(res: Response, data: T, status: number = 200): void {
  res.status(status).json({
    success: true,
    data
  } as ApiResponse<T>);
}

/**
 * Send error response
 */
export function sendError(
  res: Response,
  error: string,
  status: number = 400,
  code?: string
): void {
  res.status(status).json({
    success: false,
    error,
    code,
    timestamp: new Date().toISOString()
  } as ErrorResponse);
}

/**
 * Send paginated response
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    perPage: number;
    total: number;
  }
): void {
  const totalPages = Math.ceil(pagination.total / pagination.perPage);

  res.json({
    success: true,
    data,
    pagination: {
      page: pagination.page,
      perPage: pagination.perPage,
      total: pagination.total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1
    }
  } as PaginatedApiResponse<T>);
}
