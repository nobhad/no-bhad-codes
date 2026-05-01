/**
 * ===============================================
 * IDEMPOTENCY-KEY MIDDLEWARE
 * ===============================================
 * @file server/middleware/idempotency-key.ts
 *
 * Stripe-style idempotency: a client POST can carry an
 * `Idempotency-Key: <uuid>` header, and if the same key is retried
 * (network hiccup, user double-click, mobile radio retry) the server
 * returns the cached response verbatim instead of re-executing the
 * handler.
 *
 * Contract:
 *   - First call with a given (key, user, method, path) actually
 *     runs the handler. We snapshot its response body + status into
 *     the idempotency_keys table under that key.
 *   - Second call with the same key + same request body returns the
 *     cached response. The handler is skipped entirely.
 *   - Same key with a *different* body is a client bug — we return
 *     422 so the client knows they re-used a key for new content.
 *   - An in_flight row (handler still running) returns 409, telling
 *     the retrier to back off and retry after the original settles.
 *
 * Scope:
 *   Applied per-route via `withIdempotencyKey()`. Leaving the header
 *   off bypasses the middleware entirely — clients opt in only for
 *   endpoints where retry-safety matters (payment intent creation,
 *   signature submission, etc).
 */

import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { JWTAuthRequest } from '../types/request.js';
import { getDatabase } from '../database/init.js';
import { logger } from '../services/logger.js';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const KEY_MIN = 8;
const KEY_MAX = 200;

function resolveUserScope(req: JWTAuthRequest): string {
  if (req.user?.type === 'admin') return 'admin';
  if (req.user?.id != null) return `client:${req.user.id}`;
  return 'anon';
}

function hashRequestBody(req: Request): string {
  // Canonicalise body + query so a same-shape retry hashes to the
  // same value regardless of property order.
  const bodyKeys = req.body && typeof req.body === 'object' ? Object.keys(req.body).sort() : [];
  const bodyCanonical = bodyKeys
    .map((k) => `${k}=${JSON.stringify((req.body as Record<string, unknown>)[k])}`)
    .join('|');
  const queryKeys = Object.keys(req.query).sort();
  const queryCanonical = queryKeys
    .map((k) => `${k}=${JSON.stringify(req.query[k])}`)
    .join('|');
  return crypto.createHash('sha256').update(`${bodyCanonical}||${queryCanonical}`).digest('hex');
}

interface CachedRow {
  status: 'in_flight' | 'completed';
  response_status: number | null;
  response_body: string | null;
  request_hash: string;
}

export function withIdempotencyKey() {
  return async function idempotencyKeyMiddleware(
    req: JWTAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const rawHeader = req.header(IDEMPOTENCY_HEADER);
    if (!rawHeader) {
      // No header → client opted out; behave like a normal handler.
      return next();
    }
    const key = rawHeader.trim();
    if (key.length < KEY_MIN || key.length > KEY_MAX) {
      res.status(400).json({
        error: `Idempotency-Key must be ${KEY_MIN}-${KEY_MAX} characters`,
        code: 'INVALID_IDEMPOTENCY_KEY'
      });
      return;
    }

    const db = getDatabase();
    const scope = resolveUserScope(req);
    const method = req.method;
    const path = req.baseUrl + req.path;
    const requestHash = hashRequestBody(req);

    // Try to claim the key with an INSERT OR IGNORE of an in_flight row.
    // If changes===0, a row already existed — handle the matching cases.
    const claim = await db.run(
      `INSERT OR IGNORE INTO idempotency_keys
         (key, user_scope, method, path, request_hash, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'in_flight', datetime('now'))`,
      [key, scope, method, path, requestHash]
    );

    if (claim.changes) {
      // We own the key. Intercept res.json / res.send to snapshot the
      // response body, then upgrade the row to completed.
      interceptResponse(res, async (status, bodyString) => {
        try {
          await db.run(
            `UPDATE idempotency_keys
                SET status = 'completed',
                    response_status = ?,
                    response_body = ?,
                    completed_at = datetime('now')
              WHERE key = ? AND user_scope = ? AND method = ? AND path = ?`,
            [status, bodyString, key, scope, method, path]
          );
        } catch (err) {
          logger.error('[Idempotency] Failed to record response', {
            error: err instanceof Error ? err : undefined,
            metadata: { key, scope, method, path }
          });
        }
      });
      return next();
    }

    // Key already exists — fetch it and decide whether to replay or reject.
    const existing = await db.get<CachedRow>(
      `SELECT status, response_status, response_body, request_hash
         FROM idempotency_keys
        WHERE key = ? AND user_scope = ? AND method = ? AND path = ?`,
      [key, scope, method, path]
    );

    if (!existing) {
      // Race against concurrent purge; just run the handler.
      return next();
    }

    if (existing.request_hash !== requestHash) {
      res.status(422).json({
        error: 'Idempotency-Key has been used for a different request body',
        code: 'IDEMPOTENCY_KEY_MISMATCH'
      });
      return;
    }

    if (existing.status === 'in_flight') {
      res.status(409).json({
        error: 'A request with this Idempotency-Key is still in flight',
        code: 'IDEMPOTENCY_KEY_IN_FLIGHT'
      });
      return;
    }

    // Completed — replay the cached response verbatim.
    const cachedStatus = existing.response_status ?? 200;
    res.status(cachedStatus);
    res.setHeader('X-Idempotent-Replay', 'true');
    if (existing.response_body != null) {
      try {
        res.json(JSON.parse(existing.response_body));
      } catch {
        res.send(existing.response_body);
      }
    } else {
      res.end();
    }
  };
}

/**
 * Wrap res.json / res.send so we can capture the outgoing body + status
 * and feed it to `onFinish`. Works for handlers that use either API.
 */
function interceptResponse(
  res: Response,
  onFinish: (status: number, bodyString: string) => Promise<void>
): void {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  let captured = false;
  const capture = (body: unknown) => {
    if (captured) return;
    captured = true;
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    // Fire-and-forget; the response has already been committed by
    // the time this resolves, and any DB error is logged inside.
    onFinish(res.statusCode, bodyString).catch(() => undefined);
  };

  res.json = function patched(body: unknown) {
    capture(body);
    return originalJson(body);
  };
  res.send = function patched(body?: unknown) {
    capture(body);
    return originalSend(body);
  };
}

/**
 * Purge idempotency rows older than the retention window. Wired into
 * the scheduler by the caller.
 */
export async function purgeIdempotencyKeys(retentionDays = 7): Promise<number> {
  const db = getDatabase();
  const result = await db.run(
    'DELETE FROM idempotency_keys WHERE created_at < datetime(\'now\', ?)',
    [`-${retentionDays} days`]
  );
  return result.changes ?? 0;
}
