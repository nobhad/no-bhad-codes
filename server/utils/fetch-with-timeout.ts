/**
 * ===============================================
 * FETCH WITH TIMEOUT
 * ===============================================
 * @file server/utils/fetch-with-timeout.ts
 *
 * Every outbound HTTP call in this codebase goes through here so
 * nothing can hang forever on a slow or unresponsive upstream.
 *
 * Node's native `fetch` honours no default socket timeout beyond the
 * agent's `socketTimeout`; in practice a TCP connection that stalls
 * after headers can keep an awaited `fetch()` pending for the full
 * duration of a deployed server's life. Threading an AbortController
 * in by hand is correct but easy to forget — this helper makes it
 * impossible to skip.
 *
 * Behaviour:
 *   - Caller can pass `timeoutMs` (default 10s), composed with any
 *     AbortSignal the caller already had by chaining aborts.
 *   - On timeout, rejects with a `FetchTimeoutError` whose message
 *     identifies the URL and elapsed time; the upstream response, if
 *     any, is discarded.
 *   - Always clears the timer on completion so we don't leak handles.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

export class FetchTimeoutError extends Error {
  readonly name = 'FetchTimeoutError';
  constructor(
    public readonly url: string,
    public readonly timeoutMs: number
  ) {
    super(`Upstream fetch to ${url} timed out after ${timeoutMs}ms`);
  }
}

export interface FetchWithTimeoutOptions extends RequestInit {
  /** Abort the request after this many milliseconds (default 10000). */
  timeoutMs?: number;
}

export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...rest } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Fan-in any caller-supplied abort signal.
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (err) {
    // Rewrite the aborted-by-our-own-timer case so callers can
    // distinguish network errors from timeout-elapsed.
    if (controller.signal.aborted && !callerSignal?.aborted) {
      throw new FetchTimeoutError(url, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
