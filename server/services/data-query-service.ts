/**
 * ===============================================
 * DATA QUERY SERVICE
 * ===============================================
 * @file server/services/data-query-service.ts
 *
 * Paginated project data queries for the admin /data endpoint.
 */

import { getDatabase } from '../database/init.js';

// ============================================
// CONSTANTS
// ============================================

const MAX_PAGE_SIZE = 500;

const PROJECT_COLUMNS = `
  id, client_id, project_name, description, status, priority, progress,
  start_date, estimated_end_date, actual_end_date, budget_range, project_type,
  timeline, preview_url, price, notes, repository_url, staging_url, production_url,
  deposit_amount, contract_signed_at, cancelled_by, cancellation_reason,
  default_deposit_percentage, hourly_rate, estimated_hours, actual_hours, template_id,
  features, design_level, content_status, tech_comfort, hosting_preference,
  page_count, integrations, brand_assets, inspiration, current_site, challenges,
  additional_info, addons, referral_source, contract_reminders_enabled,
  deleted_at, deleted_by, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const VALID_SORT_FIELDS = ['id', 'project_name', 'status', 'created_at', 'updated_at'];

// ============================================
// TYPES
// ============================================

export interface DataQueryParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: string;
  search?: string;
}

export interface DataQueryResult {
  data: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta: {
    sortBy: string;
    sortOrder: string;
    search: string | null;
  };
}

// ============================================
// SERVICE
// ============================================

/**
 * Query projects with pagination, sorting, and optional search.
 */
async function queryProjects(params: DataQueryParams): Promise<DataQueryResult> {
  const db = getDatabase();

  const pageNum = Math.max(1, params.page);
  const limitNum = Math.min(MAX_PAGE_SIZE, Math.max(1, params.limit));
  const offset = (pageNum - 1) * limitNum;

  let query = `SELECT ${PROJECT_COLUMNS} FROM projects`;
  let countQuery = 'SELECT COUNT(*) as count FROM projects';
  const queryParams: (string | number)[] = [];

  if (params.search) {
    const searchClause = ' WHERE project_name LIKE ? OR description LIKE ?';
    query += searchClause;
    countQuery += searchClause;
    const searchPattern = `%${params.search}%`;
    queryParams.push(searchPattern, searchPattern);
  }

  const sortField = VALID_SORT_FIELDS.includes(params.sortBy) ? params.sortBy : 'created_at';
  const order = params.sortOrder === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY ${sortField} ${order}`;

  query += ' LIMIT ? OFFSET ?';
  queryParams.push(limitNum, offset);

  const countParams = params.search
    ? [`%${params.search}%`, `%${params.search}%`]
    : [];
  const countRow = await db.get<{ count: number }>(countQuery, countParams);
  const total = typeof countRow?.count === 'number' ? countRow.count : 0;

  const data = await db.all(query, queryParams);
  const totalPages = Math.ceil(total / limitNum);

  return {
    data,
    pagination: { page: pageNum, limit: limitNum, total, totalPages },
    meta: { sortBy: sortField, sortOrder: order, search: params.search || null }
  };
}

export const dataQueryService = { queryProjects };
