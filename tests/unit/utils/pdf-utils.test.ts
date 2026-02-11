/**
 * ===============================================
 * PDF UTILS TESTS
 * ===============================================
 * @file tests/unit/utils/pdf-utils.test.ts
 *
 * Unit tests for PDF cache helpers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getPdfCacheKey,
  getCachedPdf,
  cachePdf,
  invalidatePdfCache,
  clearPdfCache
} from '../../../server/utils/pdf-utils';

describe('PDF Utils', () => {
  beforeEach(() => {
    clearPdfCache();
  });

  afterEach(() => {
    clearPdfCache();
    vi.useRealTimers();
  });

  it('creates cache keys using type, id, and updatedAt', () => {
    const key = getPdfCacheKey('invoice', 123, '2026-02-10T12:00:00Z');
    expect(key.startsWith('invoice:123:')).toBe(true);
  });

  it('returns cached pdf when available', () => {
    const key = getPdfCacheKey('invoice', 1, '2026-02-10T12:00:00Z');
    const data = new Uint8Array([1, 2, 3]);

    cachePdf(key, data, '2026-02-10T12:00:00Z');

    const cached = getCachedPdf(key);
    expect(cached).toEqual(data);
  });

  it('expires cached pdf after TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T12:00:00Z'));

    const key = getPdfCacheKey('invoice', 2, '2026-02-10T12:00:00Z');
    const data = new Uint8Array([4, 5, 6]);

    cachePdf(key, data, '2026-02-10T12:00:00Z');

    vi.setSystemTime(new Date('2026-02-10T12:10:00Z'));

    const cached = getCachedPdf(key);
    expect(cached).toBeNull();
  });

  it('invalidates cache entries by type and id', () => {
    const keyA = getPdfCacheKey('invoice', 10, '2026-02-10T12:00:00Z');
    const keyB = getPdfCacheKey('invoice', 11, '2026-02-10T12:00:00Z');
    const data = new Uint8Array([7, 8, 9]);

    cachePdf(keyA, data, '2026-02-10T12:00:00Z');
    cachePdf(keyB, data, '2026-02-10T12:00:00Z');

    invalidatePdfCache('invoice', 10);

    expect(getCachedPdf(keyA)).toBeNull();
    expect(getCachedPdf(keyB)).toEqual(data);
  });

  it('clears cache entries by type prefix', () => {
    const invoiceKey = getPdfCacheKey('invoice', 20, '2026-02-10T12:00:00Z');
    const proposalKey = getPdfCacheKey('proposal', 1, '2026-02-10T12:00:00Z');
    const data = new Uint8Array([1, 1, 1]);

    cachePdf(invoiceKey, data, '2026-02-10T12:00:00Z');
    cachePdf(proposalKey, data, '2026-02-10T12:00:00Z');

    invalidatePdfCache('invoice');

    expect(getCachedPdf(invoiceKey)).toBeNull();
    expect(getCachedPdf(proposalKey)).toEqual(data);
  });
});
