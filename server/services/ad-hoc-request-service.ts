/**
 * ===============================================
 * AD HOC REQUEST SERVICE
 * ===============================================
 * @file server/services/ad-hoc-request-service.ts
 *
 * Service for managing custom ad hoc requests.
 */

import { getDatabase } from '../database/init.js';
import { getNumber, getString } from '../database/row-helpers.js';
import { userService } from './user-service.js';

export type AdHocRequestStatus =
  | 'submitted'
  | 'reviewing'
  | 'quoted'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'declined';

export type AdHocRequestType = 'feature' | 'change' | 'bug_fix' | 'enhancement' | 'support';

export type AdHocRequestPriority = 'low' | 'normal' | 'high' | 'urgent';

export type AdHocRequestUrgency = 'normal' | 'priority' | 'urgent' | 'emergency';

const REQUEST_STATUSES: AdHocRequestStatus[] = [
  'submitted',
  'reviewing',
  'quoted',
  'approved',
  'in_progress',
  'completed',
  'declined'
];

const REQUEST_TYPES: AdHocRequestType[] = [
  'feature',
  'change',
  'bug_fix',
  'enhancement',
  'support'
];

const REQUEST_PRIORITIES: AdHocRequestPriority[] = ['low', 'normal', 'high', 'urgent'];

const REQUEST_URGENCY: AdHocRequestUrgency[] = ['normal', 'priority', 'urgent', 'emergency'];

export interface AdHocRequest {
  id: number;
  projectId: number;
  clientId: number;
  title: string;
  description: string;
  status: AdHocRequestStatus;
  requestType: AdHocRequestType;
  priority: AdHocRequestPriority;
  urgency: AdHocRequestUrgency;
  estimatedHours: number | null;
  flatRate: number | null;
  hourlyRate: number | null;
  quotedPrice: number | null;
  attachmentFileId?: number | null;
  taskId?: number | null;
  convertedAt?: string | null;
  convertedBy?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  projectName?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface AdHocRequestCreateData {
  projectId: number;
  clientId: number;
  title: string;
  description: string;
  status?: AdHocRequestStatus;
  requestType: AdHocRequestType;
  priority?: AdHocRequestPriority;
  urgency?: AdHocRequestUrgency;
  estimatedHours?: number | null;
  flatRate?: number | null;
  hourlyRate?: number | null;
  quotedPrice?: number | null;
  attachmentFileId?: number | null;
}

export interface AdHocRequestUpdateData {
  projectId?: number;
  clientId?: number;
  title?: string;
  description?: string;
  status?: AdHocRequestStatus;
  requestType?: AdHocRequestType;
  priority?: AdHocRequestPriority;
  urgency?: AdHocRequestUrgency;
  estimatedHours?: number | null;
  flatRate?: number | null;
  hourlyRate?: number | null;
  quotedPrice?: number | null;
  attachmentFileId?: number | null;
  taskId?: number | null;
  convertedAt?: string | null;
  convertedBy?: string | null;
}

interface AdHocRequestFilters {
  projectId?: number;
  clientId?: number;
  status?: AdHocRequestStatus;
  requestType?: AdHocRequestType;
  priority?: AdHocRequestPriority;
  urgency?: AdHocRequestUrgency;
  includeDeleted?: boolean;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function mapRequest(row: Record<string, unknown>): AdHocRequest {
  return {
    id: getNumber(row, 'id'),
    projectId: getNumber(row, 'project_id'),
    clientId: getNumber(row, 'client_id'),
    title: getString(row, 'title'),
    description: getString(row, 'description'),
    status: getString(row, 'status') as AdHocRequestStatus,
    requestType: getString(row, 'request_type') as AdHocRequestType,
    priority: getString(row, 'priority') as AdHocRequestPriority,
    urgency: getString(row, 'urgency') as AdHocRequestUrgency,
    estimatedHours: toNumber(row.estimated_hours),
    flatRate: toNumber(row.flat_rate),
    hourlyRate: toNumber(row.hourly_rate),
    quotedPrice: toNumber(row.quoted_price),
    attachmentFileId: toNumber(row.attachment_file_id),
    taskId: toNumber(row.task_id),
    convertedAt: row.converted_at ? getString(row, 'converted_at') : null,
    convertedBy: row.converted_by ? getString(row, 'converted_by') : null,
    clientName: row.client_name ? getString(row, 'client_name') : null,
    clientEmail: row.client_email ? getString(row, 'client_email') : null,
    projectName: row.project_name ? getString(row, 'project_name') : null,
    createdAt: getString(row, 'created_at'),
    updatedAt: getString(row, 'updated_at'),
    deletedAt: row.deleted_at as string | null,
    deletedBy: row.deleted_by as string | null
  };
}

class AdHocRequestService {
  async getRequests(filters: AdHocRequestFilters = {}): Promise<AdHocRequest[]> {
    const db = getDatabase();
    const params: Array<string | number> = [];
    const where: string[] = [];

    if (!filters.includeDeleted) {
      where.push('ad_hoc_requests.deleted_at IS NULL');
    }

    if (filters.projectId !== undefined) {
      where.push('ad_hoc_requests.project_id = ?');
      params.push(filters.projectId);
    }

    if (filters.clientId !== undefined) {
      where.push('ad_hoc_requests.client_id = ?');
      params.push(filters.clientId);
    }

    if (filters.status) {
      where.push('ad_hoc_requests.status = ?');
      params.push(filters.status);
    }

    if (filters.requestType) {
      where.push('ad_hoc_requests.request_type = ?');
      params.push(filters.requestType);
    }

    if (filters.priority) {
      where.push('ad_hoc_requests.priority = ?');
      params.push(filters.priority);
    }

    if (filters.urgency) {
      where.push('ad_hoc_requests.urgency = ?');
      params.push(filters.urgency);
    }

    let query = `
      SELECT
        ad_hoc_requests.*,
        p.project_name as project_name,
        c.contact_name as client_name,
        c.email as client_email
      FROM ad_hoc_requests
      LEFT JOIN projects p ON ad_hoc_requests.project_id = p.id AND p.deleted_at IS NULL
      LEFT JOIN clients c ON ad_hoc_requests.client_id = c.id AND c.deleted_at IS NULL
    `;

    if (where.length > 0) {
      query += ` WHERE ${where.join(' AND ')}`;
    }

    query += ' ORDER BY created_at DESC';

    const rows = await db.all(query, params);
    return rows.map((row) => mapRequest(row as Record<string, unknown>));
  }

  async getRequest(requestId: number, includeDeleted: boolean = false): Promise<AdHocRequest> {
    const db = getDatabase();
    const where = includeDeleted ? '' : ' AND deleted_at IS NULL';
    const row = await db.get(
      `SELECT
         ad_hoc_requests.*,
         p.project_name as project_name,
         c.contact_name as client_name,
         c.email as client_email
       FROM ad_hoc_requests
       LEFT JOIN projects p ON ad_hoc_requests.project_id = p.id AND p.deleted_at IS NULL
       LEFT JOIN clients c ON ad_hoc_requests.client_id = c.id AND c.deleted_at IS NULL
       WHERE ad_hoc_requests.id = ?${where}`,
      [requestId]
    );

    if (!row) {
      throw new Error('Ad hoc request not found');
    }

    return mapRequest(row as Record<string, unknown>);
  }

  async createRequest(data: AdHocRequestCreateData): Promise<AdHocRequest> {
    const db = getDatabase();
    const status = data.status || 'submitted';
    const priority = data.priority || 'normal';
    const urgency = data.urgency || 'normal';

    if (!REQUEST_STATUSES.includes(status)) {
      throw new Error('Invalid ad hoc request status');
    }

    if (!REQUEST_TYPES.includes(data.requestType)) {
      throw new Error('Invalid ad hoc request type');
    }

    if (!REQUEST_PRIORITIES.includes(priority)) {
      throw new Error('Invalid ad hoc request priority');
    }

    if (!REQUEST_URGENCY.includes(urgency)) {
      throw new Error('Invalid ad hoc request urgency');
    }

    const result = await db.run(
      `INSERT INTO ad_hoc_requests (
        project_id, client_id, title, description, status, request_type,
        priority, urgency, estimated_hours, flat_rate, hourly_rate, quoted_price,
        attachment_file_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        data.projectId,
        data.clientId,
        data.title,
        data.description,
        status,
        data.requestType,
        priority,
        urgency,
        data.estimatedHours ?? null,
        data.flatRate ?? null,
        data.hourlyRate ?? null,
        data.quotedPrice ?? null,
        data.attachmentFileId ?? null
      ]
    );

    return this.getRequest(result.lastID!);
  }

  async updateRequest(requestId: number, data: AdHocRequestUpdateData): Promise<AdHocRequest> {
    const db = getDatabase();
    const updates: string[] = [];
    const params: Array<string | number | null> = [];

    if (data.projectId !== undefined) {
      updates.push('project_id = ?');
      params.push(data.projectId);
    }

    if (data.clientId !== undefined) {
      updates.push('client_id = ?');
      params.push(data.clientId);
    }

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }

    if (data.status !== undefined) {
      if (!REQUEST_STATUSES.includes(data.status)) {
        throw new Error('Invalid ad hoc request status');
      }
      updates.push('status = ?');
      params.push(data.status);
    }

    if (data.requestType !== undefined) {
      if (!REQUEST_TYPES.includes(data.requestType)) {
        throw new Error('Invalid ad hoc request type');
      }
      updates.push('request_type = ?');
      params.push(data.requestType);
    }

    if (data.priority !== undefined) {
      if (!REQUEST_PRIORITIES.includes(data.priority)) {
        throw new Error('Invalid ad hoc request priority');
      }
      updates.push('priority = ?');
      params.push(data.priority);
    }

    if (data.urgency !== undefined) {
      if (!REQUEST_URGENCY.includes(data.urgency)) {
        throw new Error('Invalid ad hoc request urgency');
      }
      updates.push('urgency = ?');
      params.push(data.urgency);
    }

    if (data.estimatedHours !== undefined) {
      updates.push('estimated_hours = ?');
      params.push(data.estimatedHours ?? null);
    }

    if (data.flatRate !== undefined) {
      updates.push('flat_rate = ?');
      params.push(data.flatRate ?? null);
    }

    if (data.hourlyRate !== undefined) {
      updates.push('hourly_rate = ?');
      params.push(data.hourlyRate ?? null);
    }

    if (data.quotedPrice !== undefined) {
      updates.push('quoted_price = ?');
      params.push(data.quotedPrice ?? null);
    }

    if (data.attachmentFileId !== undefined) {
      updates.push('attachment_file_id = ?');
      params.push(data.attachmentFileId ?? null);
    }

    if (data.taskId !== undefined) {
      updates.push('task_id = ?');
      params.push(data.taskId ?? null);
    }

    if (data.convertedAt !== undefined) {
      updates.push('converted_at = ?');
      params.push(data.convertedAt ?? null);
    }

    if (data.convertedBy !== undefined) {
      updates.push('converted_by = ?');
      params.push(data.convertedBy ?? null);
      // Look up user ID for converted_by during transition period
      if (data.convertedBy) {
        const convertedByUserId = await userService.getUserIdByEmail(data.convertedBy);
        updates.push('converted_by_user_id = ?');
        params.push(convertedByUserId);
      } else {
        updates.push('converted_by_user_id = ?');
        params.push(null);
      }
    }

    if (updates.length === 0) {
      return this.getRequest(requestId);
    }

    updates.push("updated_at = datetime('now')");
    params.push(requestId);

    await db.run(`UPDATE ad_hoc_requests SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.getRequest(requestId);
  }

  async softDeleteRequest(requestId: number, deletedBy: string | null): Promise<void> {
    const db = getDatabase();
    await db.run(
      `UPDATE ad_hoc_requests
       SET deleted_at = datetime('now'), deleted_by = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [deletedBy, requestId]
    );
  }

  isValidStatus(status: string): status is AdHocRequestStatus {
    return REQUEST_STATUSES.includes(status as AdHocRequestStatus);
  }

  isValidType(requestType: string): requestType is AdHocRequestType {
    return REQUEST_TYPES.includes(requestType as AdHocRequestType);
  }

  isValidPriority(priority: string): priority is AdHocRequestPriority {
    return REQUEST_PRIORITIES.includes(priority as AdHocRequestPriority);
  }

  isValidUrgency(urgency: string): urgency is AdHocRequestUrgency {
    return REQUEST_URGENCY.includes(urgency as AdHocRequestUrgency);
  }
}

export const adHocRequestService = new AdHocRequestService();
