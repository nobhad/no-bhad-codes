/**
 * ===============================================
 * REQUEST CONTEXT (AsyncLocalStorage)
 * ===============================================
 * @file server/observability/request-context.ts
 *
 * A request-scoped store for attribution fields — requestId, userId,
 * traceId, method, path — that any function in the async call graph
 * can read without being passed the values explicitly.
 *
 * Why: threading these through every function signature is infeasible,
 * and the alternative (module-level globals) collapses concurrent
 * requests into each other. AsyncLocalStorage gives each request its
 * own isolated store that follows the async continuation chain across
 * await, setTimeout, promise chains, etc.
 *
 * Usage:
 *   - Bootstrap middleware calls runWithRequestContext(ctx, () => next())
 *     once per request; everything inside that call tree can read the
 *     context with getRequestContext().
 *   - Auth middleware enriches the context with userId once the token
 *     is verified, so every log line downstream is attributed.
 *   - The logger reads the context inside createLogEntry and merges
 *     the fields into every LogEntry automatically.
 *
 * This is the "single source of truth for request attribution" pattern.
 * A log line from deep inside a service now carries the user + request
 * IDs without the service knowing they exist.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  /** Per-request UUID. Always set by the bootstrap middleware. */
  requestId: string;
  /** Authenticated user id, once auth middleware has verified the token. */
  userId?: number | null;
  /** 'admin' | 'client'. */
  userType?: string | null;
  /** OpenTelemetry trace id if available. */
  traceId?: string;
  /** OpenTelemetry span id if available. */
  spanId?: string;
  /** HTTP method — useful in logs emitted deep in the stack. */
  method?: string;
  /** Route path pattern (`/projects/:id`, not the raw URL). */
  path?: string;
  /** Client IP (already trust-proxy resolved). */
  ip?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Run `fn` with the given context bound for the whole async call tree
 * that `fn` spawns. Any `await` chain, timer, or promise originating
 * inside `fn` sees the same context.
 */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/**
 * Return the current request's context, or undefined if the caller is
 * outside an HTTP request (e.g. a scheduled job running on its own).
 */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * Mutate the current context in place. Intended for middleware that
 * learns new information about the request (e.g. auth middleware
 * populating userId after JWT verification).
 *
 * No-op if no context is active; callers outside an HTTP request
 * shouldn't be trying to mutate anything.
 */
export function updateRequestContext(patch: Partial<RequestContext>): void {
  const current = storage.getStore();
  if (!current) return;
  Object.assign(current, patch);
}

/**
 * Read a specific field — thin helper that's convenient at the
 * logger boundary where null/undefined checks are common.
 */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function getCurrentUserId(): number | null | undefined {
  return storage.getStore()?.userId;
}
