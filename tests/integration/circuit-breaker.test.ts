/**
 * Circuit breaker behaviour: drive a real CircuitBreaker through
 * the closed → open → half-open → closed cycle with a controllable
 * mock upstream and assert the state machine.
 *
 * The breaker module ALSO calls errorTracker.captureMessage on
 * transitions to 'open' — that's intentionally not asserted here
 * (Sentry isn't initialised in the test process, so the call no-
 * ops). The state transition + ServiceUnavailableError contract
 * is what callers actually depend on.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupTestDb, type TestDbHandle } from './helpers';

let dbHandle: TestDbHandle;

beforeEach(async () => {
  dbHandle = await setupTestDb();
});

afterEach(async () => {
  await dbHandle.cleanup();
});

describe('CircuitBreaker', () => {
  it('opens after N consecutive failures and fast-fails subsequent calls', async () => {
    const { CircuitBreaker } = await import('../../server/utils/circuit-breaker.js');
    const { ServiceUnavailableError } = await import('../../server/utils/app-errors.js');

    // Failures must look like upstream-fault to count toward the
    // threshold — tag with status>=500 so the default classifier
    // treats them as failures.
    const upstream = vi.fn().mockImplementation(async () => {
      const err = new Error('500 from mock upstream') as Error & { status?: number };
      err.status = 502;
      throw err;
    });

    const breaker = new CircuitBreaker({
      name: 'test-breaker-trip',
      failureThreshold: 3,
      cooldownMs: 1000
    });

    // Three failures → breaker opens. Each rethrows the original.
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(upstream)).rejects.toThrow('500 from mock upstream');
    }
    expect(upstream).toHaveBeenCalledTimes(3);

    // Fourth call: breaker is open, fast-fails without invoking
    // the upstream at all.
    await expect(breaker.execute(upstream)).rejects.toThrow(ServiceUnavailableError);
    expect(upstream).toHaveBeenCalledTimes(3);

    const snapshot = breaker.snapshot();
    expect(snapshot.state).toBe('open');
    expect(snapshot.consecutiveFailures).toBe(3);
    expect(snapshot.rejectedCount).toBe(1);
  });

  it('does not count caller-fault errors (4xx) toward the threshold', async () => {
    const { CircuitBreaker } = await import('../../server/utils/circuit-breaker.js');

    const breaker = new CircuitBreaker({
      name: 'test-breaker-4xx',
      failureThreshold: 3,
      cooldownMs: 1000
    });

    const callerFault = vi.fn().mockImplementation(async () => {
      const err = new Error('400 bad input') as Error & { status?: number };
      err.status = 400;
      throw err;
    });

    // Five 4xx in a row — breaker should stay closed because the
    // upstream isn't actually unhealthy.
    for (let i = 0; i < 5; i++) {
      await expect(breaker.execute(callerFault)).rejects.toThrow('400 bad input');
    }
    expect(breaker.snapshot().state).toBe('closed');
  });

  it('half-open probe success closes the circuit', async () => {
    const { CircuitBreaker } = await import('../../server/utils/circuit-breaker.js');

    const responses: Array<'fail' | 'ok'> = ['fail', 'fail', 'fail', 'ok'];
    const upstream = vi.fn().mockImplementation(async () => {
      const next = responses.shift();
      if (next === 'fail') {
        const err = new Error('upstream 502') as Error & { status?: number };
        err.status = 502;
        throw err;
      }
      return 'recovered';
    });

    const breaker = new CircuitBreaker({
      name: 'test-breaker-recover',
      failureThreshold: 3,
      cooldownMs: 30 // short for the test
    });

    // Trip it.
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(upstream)).rejects.toThrow();
    }
    expect(breaker.snapshot().state).toBe('open');

    // Wait past cooldown, then one probe should succeed and the
    // circuit should reset to closed.
    await new Promise((r) => setTimeout(r, 50));
    const result = await breaker.execute(upstream);
    expect(result).toBe('recovered');
    expect(breaker.snapshot().state).toBe('closed');
    expect(breaker.snapshot().consecutiveFailures).toBe(0);
  });
});
