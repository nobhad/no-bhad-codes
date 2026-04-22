/**
 * ===============================================
 * DB ROW VALIDATION
 * ===============================================
 * @file server/database/row-validator.ts
 *
 * Thin Zod wrapper that turns silent schema drift into a loud signal.
 *
 * Without this, `db.get(...) as MyRow` happily hands callers
 * `undefined` for a column that was renamed or dropped, and the bug
 * only surfaces deep downstream as `Cannot read property of undefined`
 * or a wrong number in a financial total. With it, the drift is
 * caught at the DB boundary with the table name and column list.
 *
 * Dev-mode behaviour (NODE_ENV !== 'production'): throw. Tests and
 * local runs should fail fast so drift shows up in CI rather than
 * prod.
 *
 * Prod behaviour: log an error with Zod's issue list and return
 * null. The caller treats null the same as "row not found," which is
 * the safest fallback — a degraded read is better than an unbounded
 * server crash from something like a dashboard query.
 */

import type { ZodType } from 'zod';
import { logger } from '../services/logger.js';

export interface RowValidationContext {
  /** Short label identifying where the read happened, e.g. "async_tasks.claim". */
  op: string;
  /** Optional extra metadata for the log entry (row id, task type, etc.). */
  meta?: Record<string, unknown>;
}

function formatContext(ctx: RowValidationContext): string {
  return ctx.op;
}

export function parseRow<T>(
  schema: ZodType<T>,
  row: unknown,
  ctx: RowValidationContext
): T | null {
  if (row === undefined || row === null) return null;

  const result = schema.safeParse(row);
  if (result.success) return result.data;

  const issues = result.error.issues.map((i) => ({
    path: i.path.join('.'),
    code: i.code,
    message: i.message
  }));

  logger.error(`[DB] Row validation failed at ${formatContext(ctx)}`, {
    category: 'DB_VALIDATION',
    metadata: { ...ctx.meta, issues }
  });

  if (process.env.NODE_ENV !== 'production') {
    const summary = issues.map((i) => `${i.path}: ${i.message}`).join('; ');
    throw new Error(`DB row validation failed at ${formatContext(ctx)} — ${summary}`);
  }

  return null;
}

export function parseRows<T>(
  schema: ZodType<T>,
  rows: unknown[],
  ctx: RowValidationContext
): T[] {
  const parsed: T[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = parseRow(schema, rows[i], { ...ctx, meta: { ...ctx.meta, index: i } });
    if (row !== null) parsed.push(row);
  }
  return parsed;
}
