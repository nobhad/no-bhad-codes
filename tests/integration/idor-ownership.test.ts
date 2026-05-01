/**
 * IDOR coverage: prove that an authenticated client cannot read another
 * client's project, invoice, or message thread by passing the other
 * client's resource id in the URL.
 *
 * Each test seeds two clients (A and B) with one resource each, then
 * has client A try to fetch B's resource by id. The expected response
 * is 404 (not 403) — the routes intentionally collapse "not yours" and
 * "doesn't exist" so attackers can't enumerate ids by status code. The
 * positive case (owner gets 200) is asserted alongside so we know the
 * 404 isn't just a broken route.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  setupTestDb,
  seedClient,
  seedProject,
  seedInvoice,
  seedMessageThread,
  authCookie,
  mintJwt,
  type TestDbHandle
} from './helpers';

let dbHandle: TestDbHandle;

beforeEach(async () => {
  dbHandle = await setupTestDb();
});

afterEach(async () => {
  await dbHandle.cleanup();
});

function clientAuth(clientId: number): string {
  return authCookie(
    mintJwt({ id: clientId, email: `c${clientId}@test.local`, type: 'client' })
  );
}

describe('IDOR ownership enforcement', () => {
  it('GET /api/projects/:id — client A cannot read client B project; B can', async () => {
    const aId = await seedClient({ email: 'a@test.local' });
    const bId = await seedClient({ email: 'b@test.local' });
    const bProjectId = await seedProject(bId, { project_name: 'B-only project' });

    const { app } = await import('../../server/app.js');

    const aRes = await request(app)
      .get(`/api/projects/${bProjectId}`)
      .set('Cookie', clientAuth(aId));
    expect(aRes.status).toBe(404);
    expect(aRes.body?.code ?? aRes.body?.error?.code).toMatch(/NOT_FOUND|PROJECT_NOT_FOUND/);

    const bRes = await request(app)
      .get(`/api/projects/${bProjectId}`)
      .set('Cookie', clientAuth(bId));
    expect(bRes.status).toBe(200);
    expect(bRes.body?.data?.project?.id).toBe(bProjectId);
  });

  it('GET /api/invoices/:id — client A cannot read client B invoice; B can', async () => {
    const aId = await seedClient({ email: 'a-inv@test.local' });
    const bId = await seedClient({ email: 'b-inv@test.local' });
    const bProjectId = await seedProject(bId);
    const bInvoiceId = await seedInvoice(bId, bProjectId, {
      invoice_number: 'INV-IDOR-B',
      amount_total: 250
    });

    const { app } = await import('../../server/app.js');

    const aRes = await request(app)
      .get(`/api/invoices/${bInvoiceId}`)
      .set('Cookie', clientAuth(aId));
    expect(aRes.status).toBe(404);
    expect(aRes.body?.code ?? aRes.body?.error?.code).toMatch(/NOT_FOUND/);

    const bRes = await request(app)
      .get(`/api/invoices/${bInvoiceId}`)
      .set('Cookie', clientAuth(bId));
    expect(bRes.status).toBe(200);
    expect(bRes.body?.data?.invoice?.id).toBe(bInvoiceId);
  });

  it('GET /api/messages/threads/:id/messages — client A cannot read client B thread; B can', async () => {
    const aId = await seedClient({ email: 'a-msg@test.local' });
    const bId = await seedClient({ email: 'b-msg@test.local' });
    const bThreadId = await seedMessageThread(bId, { subject: 'B private thread' });

    const { app } = await import('../../server/app.js');

    const aRes = await request(app)
      .get(`/api/messages/threads/${bThreadId}/messages`)
      .set('Cookie', clientAuth(aId));
    expect(aRes.status).toBe(404);
    expect(aRes.body?.code ?? aRes.body?.error?.code).toMatch(/NOT_FOUND|THREAD_NOT_FOUND/);

    const bRes = await request(app)
      .get(`/api/messages/threads/${bThreadId}/messages`)
      .set('Cookie', clientAuth(bId));
    expect(bRes.status).toBe(200);
    expect(bRes.body?.data?.thread?.id).toBe(bThreadId);
  });
});
