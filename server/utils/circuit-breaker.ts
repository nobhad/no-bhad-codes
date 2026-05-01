/**
 * ===============================================
 * CIRCUIT BREAKER
 * ===============================================
 * @file server/utils/circuit-breaker.ts
 *
 * Wraps an operation (usually an outbound HTTP call) so a run of
 * failures stops hammering the upstream. The goal is NOT to reduce
 * total error count — errors are going to happen regardless — but to:
 *
 *   - preserve local latency: a request that would have waited 10s
 *     for the timeout now fails in < 1ms while the breaker is open
 *   - conserve connection pool slots, retry worker time, and
 *     downstream rate-limit budget during a known outage
 *   - give the upstream a chance to recover instead of DDOSing it
 *     with our own retries
 *
 * States:
 *
 *   closed     — normal operation, every call is forwarded
 *   open       — recent failures crossed `failureThreshold`, all calls
 *                fast-fail until `cooldownMs` elapses
 *   half-open  — cooldown elapsed, a single probe is allowed; success
 *                closes the circuit, failure re-opens it
 *
 * Classification:
 *
 *   Not every thrown error counts as a circuit-tripping failure. The
 *   default `isFailure` predicate treats only network/server errors
 *   (TypeError for `fetch` aborts, FetchTimeoutError, any Error whose
 *   status >= 500) as failures. 4xx responses from the upstream are
 *   the caller's fault and don't indicate the upstream is unhealthy.
 *
 *   Callers with richer classification (e.g. Stripe's error types)
 *   should pass their own predicate.
 *
 * Observability:
 *
 *   Every state transition emits a logger.warn / logger.info with the
 *   breaker name so ops can grep for `[CircuitBreaker] <name>`.
 *   `getState()` is exposed for an admin endpoint.
 */

import { logger } from '../services/logger.js';
import { errorTracker } from '../services/error-tracking.js';
import { ServiceUnavailableError } from './app-errors.js';
import { FetchTimeoutError } from './fetch-with-timeout.js';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Human-readable name — appears in logs, metrics, admin endpoint. */
  name: string;
  /** Consecutive failures that trip the circuit. Default 5. */
  failureThreshold?: number;
  /** Milliseconds the circuit stays open before allowing a probe. */
  cooldownMs?: number;
  /**
   * Predicate that decides whether an error counts as a real
   * "upstream is unhealthy" signal vs a 4xx-style caller-fault that
   * should NOT move us toward opening. Default: server-error-like.
   */
  isFailure?: (err: unknown) => boolean;
}

function defaultIsFailure(err: unknown): boolean {
  if (err instanceof FetchTimeoutError) return true;
  if (err instanceof TypeError) return true; // fetch network error
  if (err instanceof Error) {
    const status = (err as Error & { status?: number }).status;
    if (typeof status === 'number' && status >= 500) return true;
    if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/.test(err.message)) return true;
  }
  return false;
}

export interface CircuitBreakerSnapshot {
  name: string;
  state: CircuitState;
  consecutiveFailures: number;
  openedAt: string | null;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  rejectedCount: number;
}

// Module-level registry of named breakers. Declared before CircuitBreaker
// so the constructor's registry.set call doesn't trip
// @typescript-eslint/no-use-before-define. Forward-references in class
// bodies are safe at runtime (the constructor only runs after module
// init), but the lint rule rejects the textual order.
const registry = new Map<string, CircuitBreaker>();

export class CircuitBreaker {
  readonly name: string;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly isFailure: (err: unknown) => boolean;

  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private openedAtMs: number | null = null;
  private lastFailureAtMs: number | null = null;
  private lastSuccessAtMs: number | null = null;
  private rejectedCount = 0;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.isFailure = options.isFailure ?? defaultIsFailure;
    registry.set(this.name, this);
  }

  /**
   * Run `fn` inside the breaker. Throws ServiceUnavailableError
   * without calling `fn` when the breaker is open and cooldown
   * hasn't elapsed. Otherwise forwards the result / rethrows the
   * underlying error, updating breaker state on the way through.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const sinceOpen = this.openedAtMs != null ? Date.now() - this.openedAtMs : Infinity;
      if (sinceOpen < this.cooldownMs) {
        this.rejectedCount += 1;
        throw new ServiceUnavailableError(
          `${this.name} circuit is open; retry in ${Math.ceil((this.cooldownMs - sinceOpen) / 1000)}s`
        );
      }
      this.transition('half-open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      if (this.isFailure(err)) {
        this.onFailure();
      }
      throw err;
    }
  }

  private onSuccess(): void {
    this.lastSuccessAtMs = Date.now();
    this.consecutiveFailures = 0;
    if (this.state !== 'closed') {
      this.transition('closed');
    }
  }

  private onFailure(): void {
    this.lastFailureAtMs = Date.now();
    this.consecutiveFailures += 1;
    if (this.state === 'half-open') {
      // Probe failed; immediately re-open without counting toward threshold.
      this.transition('open');
      return;
    }
    if (this.state === 'closed' && this.consecutiveFailures >= this.failureThreshold) {
      this.transition('open');
    }
  }

  private transition(next: CircuitState): void {
    if (this.state === next) return;
    const prev = this.state;
    this.state = next;
    if (next === 'open') {
      this.openedAtMs = Date.now();
      logger.warn(`[CircuitBreaker] ${this.name} → open (from ${prev})`, {
        category: 'CIRCUIT_BREAKER',
        metadata: {
          name: this.name,
          consecutiveFailures: this.consecutiveFailures,
          cooldownMs: this.cooldownMs
        }
      });
      // Also page Sentry so on-call sees a breaker open in real time
      // rather than waiting to grep logs. Warning level, not error —
      // an open breaker IS the intended defence against a sustained
      // upstream failure, not a code bug.
      errorTracker.captureMessage(
        `Circuit breaker opened: ${this.name}`,
        'warning',
        {
          tags: {
            resilience_event: 'circuit_breaker_open',
            breaker: this.name
          },
          extra: {
            consecutiveFailures: this.consecutiveFailures,
            cooldownMs: this.cooldownMs,
            previousState: prev
          }
        }
      );
    } else if (next === 'half-open') {
      logger.info(`[CircuitBreaker] ${this.name} → half-open; probing`);
    } else {
      this.openedAtMs = null;
      logger.info(`[CircuitBreaker] ${this.name} → closed (from ${prev})`);
    }
  }

  snapshot(): CircuitBreakerSnapshot {
    return {
      name: this.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      openedAt: this.openedAtMs != null ? new Date(this.openedAtMs).toISOString() : null,
      lastFailureAt:
        this.lastFailureAtMs != null ? new Date(this.lastFailureAtMs).toISOString() : null,
      lastSuccessAt:
        this.lastSuccessAtMs != null ? new Date(this.lastSuccessAtMs).toISOString() : null,
      rejectedCount: this.rejectedCount
    };
  }
}

/** All registered breakers — used by the admin endpoint. */
export function listCircuitBreakers(): CircuitBreakerSnapshot[] {
  return [...registry.values()].map((cb) => cb.snapshot());
}

/**
 * Return the breaker named `options.name`, creating + registering one
 * with the supplied options if it doesn't exist yet. Lets callers in
 * different modules share a breaker (e.g. both stripePayment and
 * autoPay hit the same Stripe API and should trip together) without
 * manually plumbing the instance through shared state.
 */
export function getCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
  const existing = registry.get(options.name);
  if (existing) return existing;
  return new CircuitBreaker(options);
}
