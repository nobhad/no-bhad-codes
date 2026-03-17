/**
 * ===============================================
 * RETAINER SERVICE
 * ===============================================
 * @file server/services/retainer-service.ts
 *
 * Manages retainer agreements, billing periods,
 * monthly invoicing, rollover calculations, and
 * usage alerts.
 */

import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';
import {
  USAGE_ALERT_THRESHOLD,
  ROLLOVER_CAP_DEFAULT
} from './retainer-types.js';
import type {
  RetainerRow,
  RetainerPeriodRow,
  RetainerWithDetails,
  CreateRetainerParams,
  UpdateRetainerParams,
  RetainerSummary,
  BillingResult,
  UsageAlertResult
} from './retainer-types.js';

// ============================================
// Date Helpers
// ============================================

/**
 * Get the last day of the month for a given date string (YYYY-MM-DD).
 */
function getEndOfMonth(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  return lastDay.toISOString().split('T')[0];
}

/**
 * Get the day after a given date string (YYYY-MM-DD).
 */
function getDayAfter(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

/**
 * Get today's date as YYYY-MM-DD.
 */
function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get today's day-of-month (1-31).
 */
function getTodayDay(): number {
  return new Date().getDate();
}

// ============================================
// CRUD
// ============================================

/**
 * Create a new retainer and its initial billing period.
 */
async function create(params: CreateRetainerParams): Promise<number> {
  const db = getDatabase();

  const billingDay = params.billingDay ?? 1;
  const autoInvoice = params.autoInvoice !== false ? 1 : 0;
  const rolloverEnabled = params.rolloverEnabled ? 1 : 0;
  const maxRolloverHours = params.maxRolloverHours ?? ROLLOVER_CAP_DEFAULT;

  const result = await db.run(
    `INSERT INTO retainers
     (client_id, project_id, retainer_type, status, monthly_hours, monthly_amount,
      rollover_enabled, max_rollover_hours, start_date, end_date, billing_day,
      auto_invoice, notes, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      params.clientId,
      params.projectId,
      params.retainerType,
      params.monthlyHours ?? null,
      params.monthlyAmount,
      rolloverEnabled,
      maxRolloverHours,
      params.startDate,
      params.endDate ?? null,
      billingDay,
      autoInvoice,
      params.notes ?? null
    ]
  );

  const retainerId = result.lastID!;

  // Create the first period: start_date to end of that month
  const periodEnd = getEndOfMonth(params.startDate);
  const allocatedHours = params.monthlyHours ?? null;
  const totalAvailable = allocatedHours;

  await db.run(
    `INSERT INTO retainer_periods
     (retainer_id, period_start, period_end, allocated_hours, used_hours,
      rollover_hours, total_available, status, created_at)
     VALUES (?, ?, ?, ?, 0, 0, ?, 'active', datetime('now'))`,
    [retainerId, params.startDate, periodEnd, allocatedHours, totalAvailable]
  );

  logger.info('Created retainer with initial period', {
    category: 'retainers',
    metadata: { retainerId, clientId: params.clientId, projectId: params.projectId }
  });

  return retainerId;
}

/**
 * Update an existing retainer.
 */
async function update(id: number, params: UpdateRetainerParams): Promise<void> {
  const db = getDatabase();

  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  if (params.retainerType !== undefined) {
    setClauses.push('retainer_type = ?');
    values.push(params.retainerType);
  }
  if (params.monthlyHours !== undefined) {
    setClauses.push('monthly_hours = ?');
    values.push(params.monthlyHours);
  }
  if (params.monthlyAmount !== undefined) {
    setClauses.push('monthly_amount = ?');
    values.push(params.monthlyAmount);
  }
  if (params.rolloverEnabled !== undefined) {
    setClauses.push('rollover_enabled = ?');
    values.push(params.rolloverEnabled ? 1 : 0);
  }
  if (params.maxRolloverHours !== undefined) {
    setClauses.push('max_rollover_hours = ?');
    values.push(params.maxRolloverHours);
  }
  if (params.endDate !== undefined) {
    setClauses.push('end_date = ?');
    values.push(params.endDate);
  }
  if (params.billingDay !== undefined) {
    setClauses.push('billing_day = ?');
    values.push(params.billingDay);
  }
  if (params.autoInvoice !== undefined) {
    setClauses.push('auto_invoice = ?');
    values.push(params.autoInvoice ? 1 : 0);
  }
  if (params.notes !== undefined) {
    setClauses.push('notes = ?');
    values.push(params.notes ?? null);
  }

  if (setClauses.length === 0) return;

  setClauses.push('updated_at = datetime(\'now\')');
  values.push(id);

  await db.run(
    `UPDATE retainers SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );

  logger.info('Updated retainer', {
    category: 'retainers',
    metadata: { retainerId: id }
  });
}

/**
 * Cancel a retainer and close its active period.
 */
async function cancel(id: number): Promise<void> {
  const db = getDatabase();

  await db.run(
    'UPDATE retainers SET status = \'cancelled\', updated_at = datetime(\'now\') WHERE id = ?',
    [id]
  );

  await db.run(
    'UPDATE retainer_periods SET status = \'closed\' WHERE retainer_id = ? AND status = \'active\'',
    [id]
  );

  logger.info('Cancelled retainer', {
    category: 'retainers',
    metadata: { retainerId: id }
  });
}

/**
 * Pause a retainer.
 */
async function pause(id: number): Promise<void> {
  const db = getDatabase();

  await db.run(
    'UPDATE retainers SET status = \'paused\', updated_at = datetime(\'now\') WHERE id = ? AND status = \'active\'',
    [id]
  );

  logger.info('Paused retainer', {
    category: 'retainers',
    metadata: { retainerId: id }
  });
}

/**
 * Resume a paused retainer.
 */
async function resume(id: number): Promise<void> {
  const db = getDatabase();

  await db.run(
    'UPDATE retainers SET status = \'active\', updated_at = datetime(\'now\') WHERE id = ? AND status = \'paused\'',
    [id]
  );

  logger.info('Resumed retainer', {
    category: 'retainers',
    metadata: { retainerId: id }
  });
}

// ============================================
// Queries
// ============================================

/**
 * List retainers with optional filters. Includes client/project
 * names and current period data.
 */
async function list(filters?: { status?: string; clientId?: number }): Promise<RetainerWithDetails[]> {
  const db = getDatabase();

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (filters?.status) {
    whereClause += ' AND r.status = ?';
    params.push(filters.status);
  }
  if (filters?.clientId) {
    whereClause += ' AND r.client_id = ?';
    params.push(filters.clientId);
  }

  const retainers = (await db.all(
    `SELECT r.*,
            c.name AS client_name,
            p.name AS project_name
     FROM retainers r
     LEFT JOIN clients c ON r.client_id = c.id
     LEFT JOIN projects p ON r.project_id = p.id
     ${whereClause}
     ORDER BY r.created_at DESC`,
    params
  )) as Array<RetainerRow & { client_name: string; project_name: string }>;

  return Promise.all(retainers.map(async (row) => {
    const currentPeriod = await getCurrentPeriod(row.id);
    return {
      ...row,
      clientName: row.client_name,
      projectName: row.project_name,
      currentPeriod: currentPeriod ?? undefined
    };
  }));
}

/**
 * Get a single retainer by ID with enrichments.
 */
async function getById(id: number): Promise<RetainerWithDetails | null> {
  const db = getDatabase();

  const row = (await db.get(
    `SELECT r.*,
            c.name AS client_name,
            p.name AS project_name
     FROM retainers r
     LEFT JOIN clients c ON r.client_id = c.id
     LEFT JOIN projects p ON r.project_id = p.id
     WHERE r.id = ?`,
    [id]
  )) as (RetainerRow & { client_name: string; project_name: string }) | undefined;

  if (!row) return null;

  const currentPeriod = await getCurrentPeriod(id);

  return {
    ...row,
    clientName: row.client_name,
    projectName: row.project_name,
    currentPeriod: currentPeriod ?? undefined
  };
}

/**
 * Get all retainers for a specific client.
 */
async function getByClient(clientId: number): Promise<RetainerWithDetails[]> {
  return list({ clientId });
}

/**
 * Get aggregate retainer summary stats.
 */
async function getSummary(): Promise<RetainerSummary> {
  const db = getDatabase();

  const stats = (await db.get(
    `SELECT
       COUNT(*) AS total_active,
       COALESCE(SUM(monthly_amount), 0) AS total_monthly_revenue
     FROM retainers
     WHERE status = 'active'`
  )) as { total_active: number; total_monthly_revenue: number } | undefined;

  // Calculate average utilization across active retainers with hourly tracking
  const utilizationData = (await db.all(
    `SELECT rp.used_hours, rp.total_available
     FROM retainer_periods rp
     JOIN retainers r ON rp.retainer_id = r.id
     WHERE rp.status = 'active'
       AND r.status = 'active'
       AND rp.total_available IS NOT NULL
       AND rp.total_available > 0`
  )) as Array<{ used_hours: number; total_available: number }>;

  let avgUtilization = 0;
  if (utilizationData.length > 0) {
    const totalUtilization = utilizationData.reduce((sum, row) => {
      return sum + (row.used_hours / row.total_available);
    }, 0);
    avgUtilization = totalUtilization / utilizationData.length;
  }

  // Count retainers near cap (>= 80% utilization)
  const nearCapCount = utilizationData.filter(
    (row) => (row.used_hours / row.total_available) >= USAGE_ALERT_THRESHOLD
  ).length;

  return {
    totalActive: stats?.total_active ?? 0,
    totalMonthlyRevenue: stats?.total_monthly_revenue ?? 0,
    avgUtilization,
    retainersNearCap: nearCapCount
  };
}

// ============================================
// Period Management
// ============================================

/**
 * Get the active (current) period for a retainer.
 */
async function getCurrentPeriod(retainerId: number): Promise<RetainerPeriodRow | null> {
  const db = getDatabase();

  const period = (await db.get(
    'SELECT * FROM retainer_periods WHERE retainer_id = ? AND status = \'active\' ORDER BY period_start DESC LIMIT 1',
    [retainerId]
  )) as RetainerPeriodRow | undefined;

  return period ?? null;
}

/**
 * Get all periods for a retainer, ordered newest first.
 */
async function getPeriods(retainerId: number): Promise<RetainerPeriodRow[]> {
  const db = getDatabase();

  return (await db.all(
    'SELECT * FROM retainer_periods WHERE retainer_id = ? ORDER BY period_start DESC',
    [retainerId]
  )) as RetainerPeriodRow[];
}

/**
 * Close the current period, calculate rollover, and create
 * the next period.
 *
 * Rollover formula:
 *   unused = totalAvailable - usedHours
 *   rollover = rolloverEnabled ? min(max(unused, 0), maxRolloverHours) : 0
 *
 * Next period starts the day after the current period_end and
 * ends on the last day of that month.
 */
async function closePeriod(retainerId: number): Promise<void> {
  const db = getDatabase();

  const retainer = (await db.get(
    'SELECT * FROM retainers WHERE id = ?',
    [retainerId]
  )) as RetainerRow | undefined;

  if (!retainer) throw new Error('Retainer not found');

  const currentPeriod = await getCurrentPeriod(retainerId);
  if (!currentPeriod) throw new Error('No active period found');

  // Close current period
  await db.run(
    'UPDATE retainer_periods SET status = \'closed\' WHERE id = ?',
    [currentPeriod.id]
  );

  // Calculate rollover
  const totalAvailable = currentPeriod.total_available ?? 0;
  const usedHours = currentPeriod.used_hours;
  const unused = totalAvailable - usedHours;
  const rolloverEnabled = retainer.rollover_enabled === 1;
  const maxRollover = retainer.max_rollover_hours ?? ROLLOVER_CAP_DEFAULT;
  const rolloverHours = rolloverEnabled
    ? Math.min(Math.max(unused, 0), maxRollover)
    : 0;

  // Create next period
  const nextStart = getDayAfter(currentPeriod.period_end);
  const nextEnd = getEndOfMonth(nextStart);
  const allocatedHours = retainer.monthly_hours ?? null;
  const nextTotalAvailable = allocatedHours !== null
    ? allocatedHours + rolloverHours
    : null;

  await db.run(
    `INSERT INTO retainer_periods
     (retainer_id, period_start, period_end, allocated_hours, used_hours,
      rollover_hours, total_available, status, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, 'active', datetime('now'))`,
    [retainerId, nextStart, nextEnd, allocatedHours, rolloverHours, nextTotalAvailable]
  );

  logger.info('Closed period and created next', {
    category: 'retainers',
    metadata: {
      retainerId,
      closedPeriodId: currentPeriod.id,
      rolloverHours,
      nextStart,
      nextEnd
    }
  });
}

// ============================================
// Billing & Alerts
// ============================================

/**
 * Process monthly billing for all active retainers whose
 * billing_day matches today. Creates an invoice for each
 * eligible retainer. Idempotent — skips if an invoice already
 * exists for the current active period.
 */
async function processMonthlyBilling(): Promise<BillingResult> {
  const db = getDatabase();

  const todayDay = getTodayDay();
  const todayStr = getTodayStr();

  const retainers = (await db.all(
    `SELECT r.* FROM retainers r
     WHERE r.billing_day = ?
       AND r.auto_invoice = 1
       AND r.status = 'active'`,
    [todayDay]
  )) as RetainerRow[];

  let invoiced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const retainer of retainers) {
    try {
      const currentPeriod = await getCurrentPeriod(retainer.id);
      if (!currentPeriod) {
        skipped++;
        continue;
      }

      // Idempotent: skip if invoice already exists for this period
      if (currentPeriod.invoice_id) {
        skipped++;
        continue;
      }

      // Create a simple invoice entry
      const invoiceResult = await db.run(
        `INSERT INTO invoices
         (client_id, project_id, amount, status, due_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, 'draft', ?, ?, datetime('now'), datetime('now'))`,
        [
          retainer.client_id,
          retainer.project_id,
          retainer.monthly_amount,
          todayStr,
          `Retainer billing for period ${currentPeriod.period_start} to ${currentPeriod.period_end}`
        ]
      );

      const invoiceId = invoiceResult.lastID!;

      // Link invoice to period
      await db.run(
        'UPDATE retainer_periods SET invoice_id = ? WHERE id = ?',
        [invoiceId, currentPeriod.id]
      );

      invoiced++;

      logger.info('Created retainer invoice', {
        category: 'retainers',
        metadata: {
          retainerId: retainer.id,
          invoiceId,
          amount: retainer.monthly_amount,
          periodId: currentPeriod.id
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Retainer ${retainer.id}: ${message}`);
      logger.error('Failed to process retainer billing', {
        category: 'retainers',
        metadata: { retainerId: retainer.id, error: message }
      });
    }
  }

  return { invoiced, skipped, errors };
}

/**
 * Find retainers where usage >= 80% and send an admin alert email.
 * Returns the count of alerts sent.
 */
async function sendUsageAlerts(): Promise<UsageAlertResult> {
  const db = getDatabase();

  const nearCap = (await db.all(
    `SELECT r.id, r.client_id, r.project_id,
            rp.used_hours, rp.total_available,
            c.name AS client_name,
            p.name AS project_name
     FROM retainer_periods rp
     JOIN retainers r ON rp.retainer_id = r.id
     LEFT JOIN clients c ON r.client_id = c.id
     LEFT JOIN projects p ON r.project_id = p.id
     WHERE rp.status = 'active'
       AND r.status = 'active'
       AND rp.total_available IS NOT NULL
       AND rp.total_available > 0
       AND (CAST(rp.used_hours AS REAL) / rp.total_available) >= ?`,
    [USAGE_ALERT_THRESHOLD]
  )) as Array<{
    id: number;
    client_id: number;
    project_id: number;
    used_hours: number;
    total_available: number;
    client_name: string;
    project_name: string;
  }>;

  let sent = 0;

  for (const entry of nearCap) {
    try {
      const { emailService } = await import('./email-service.js');
      const utilPct = Math.round((entry.used_hours / entry.total_available) * 100);

      await emailService.sendAdminNotification(
        'Retainer Usage Alert',
        {
          retainerId: entry.id,
          clientName: entry.client_name,
          projectName: entry.project_name,
          usedHours: entry.used_hours,
          totalAvailable: entry.total_available,
          utilizationPercent: utilPct
        }
      );

      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to send retainer usage alert', {
        category: 'retainers',
        metadata: { retainerId: entry.id, error: message }
      });
    }
  }

  return { sent };
}

/**
 * Recalculate the used_hours for a specific period by summing
 * billable time_entries within the period's date range for
 * the retainer's project.
 */
async function recalculateUsedHours(periodId: number): Promise<void> {
  const db = getDatabase();

  const period = (await db.get(
    `SELECT rp.*, r.project_id
     FROM retainer_periods rp
     JOIN retainers r ON rp.retainer_id = r.id
     WHERE rp.id = ?`,
    [periodId]
  )) as (RetainerPeriodRow & { project_id: number }) | undefined;

  if (!period) throw new Error('Period not found');

  const result = (await db.get(
    `SELECT COALESCE(SUM(hours), 0) AS total_hours
     FROM time_entries
     WHERE project_id = ?
       AND date >= ?
       AND date <= ?
       AND billable = 1`,
    [period.project_id, period.period_start, period.period_end]
  )) as { total_hours: number };

  await db.run(
    'UPDATE retainer_periods SET used_hours = ? WHERE id = ?',
    [result.total_hours, periodId]
  );

  logger.info('Recalculated used hours', {
    category: 'retainers',
    metadata: { periodId, usedHours: result.total_hours }
  });
}

// ============================================
// Singleton Export
// ============================================

export const retainerService = {
  create,
  update,
  cancel,
  pause,
  resume,
  list,
  getById,
  getByClient,
  getSummary,
  getCurrentPeriod,
  getPeriods,
  closePeriod,
  processMonthlyBilling,
  sendUsageAlerts,
  recalculateUsedHours
};
