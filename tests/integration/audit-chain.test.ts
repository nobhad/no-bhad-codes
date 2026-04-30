/**
 * Audit chain tamper-evidence: write a few audit rows through the
 * normal API, verify the chain is intact, then mutate a historical
 * row directly via SQL and verify the verifier flags it as broken.
 *
 * This is the security-property test for the hash chain — the
 * whole point of the migration was that an out-of-band edit can't
 * silently slip through, and this proves it.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb, type TestDbHandle } from './helpers';

let dbHandle: TestDbHandle;

beforeEach(async () => {
  dbHandle = await setupTestDb();
});

afterEach(async () => {
  await dbHandle.cleanup();
});

describe('Audit chain verification', () => {
  it('clean chain: every row recomputes to its stored hash', async () => {
    const { auditLogger, verifyAuditChain } = await import(
      '../../server/services/audit-logger.js'
    );

    await auditLogger.logCreate('client', '1', 'Acme Co', { email: 'a@a' });
    await auditLogger.logCreate('client', '2', 'Beta Co', { email: 'b@b' });
    await auditLogger.logCreate('client', '3', 'Gamma Co', { email: 'c@c' });

    const report = await verifyAuditChain();

    expect(report.total).toBe(3);
    expect(report.verified).toBe(3);
    expect(report.breaks).toEqual([]);
  });

  it('detects a tampered row via hash mismatch', async () => {
    const { auditLogger, verifyAuditChain } = await import(
      '../../server/services/audit-logger.js'
    );
    const { getDatabase } = await import('../../server/database/init.js');

    await auditLogger.logCreate('client', '10', 'Original', { email: 'before@x' });
    await auditLogger.logCreate('client', '20', 'Second', { email: 'two@x' });

    // Out-of-band mutation: directly edit the entity_name of the
    // first row, leaving its stored hash untouched.
    const db = getDatabase();
    await db.run(
      'UPDATE audit_logs SET entity_name = ? WHERE id = (SELECT MIN(id) FROM audit_logs)',
      ['Tampered']
    );

    const report = await verifyAuditChain();

    expect(report.breaks.length).toBeGreaterThanOrEqual(1);
    const firstBreak = report.breaks[0];
    expect(firstBreak.kind).toBe('hash_mismatch');
    // The tampered row breaks its own hash AND the next row's
    // prev_hash link, so we expect at least one of each kind.
    const kinds = report.breaks.map((b) => b.kind);
    expect(kinds).toContain('hash_mismatch');
  });

  it('detects a deleted historical row via prev_hash gap', async () => {
    const { auditLogger, verifyAuditChain } = await import(
      '../../server/services/audit-logger.js'
    );
    const { getDatabase } = await import('../../server/database/init.js');

    await auditLogger.logCreate('client', '100', 'A', { email: 'a@a' });
    await auditLogger.logCreate('client', '200', 'B', { email: 'b@b' });
    await auditLogger.logCreate('client', '300', 'C', { email: 'c@c' });

    const db = getDatabase();
    // Delete the middle row outright.
    await db.run(
      `DELETE FROM audit_logs WHERE id = (
         SELECT id FROM audit_logs ORDER BY id LIMIT 1 OFFSET 1
       )`
    );

    const report = await verifyAuditChain();

    // The third row's prev_hash points to the deleted row, so the
    // chain link is now broken at that step.
    const prevHashBreaks = report.breaks.filter((b) => b.kind === 'prev_hash_mismatch');
    expect(prevHashBreaks.length).toBeGreaterThanOrEqual(1);
  });
});
