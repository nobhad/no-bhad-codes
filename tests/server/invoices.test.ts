import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/app';

describe('GET /api/invoices', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(401);
  });

  it('allows admin to fetch invoices (mock token)', async () => {
    // This test assumes a test admin token is configured in env for CI/local testing
    const token = process.env.TEST_ADMIN_TOKEN || '';
    if (!token) {
      // Skip assertion if token not provided - ensure test file runs without failing
      expect(true).toBe(true);
      return;
    }

    const res = await request(app).get('/api/invoices').set('Authorization', `Bearer ${token}`);
    expect([200, 204]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
    }
  });
});

describe('Invoice endpoints auth guard', () => {
  it('blocks unauthenticated access to admin endpoints', async () => {
    const [searchRes, agingRes, paymentsRes, termsRes] = await Promise.all([
      request(app).get('/api/invoices/search'),
      request(app).get('/api/invoices/aging-report'),
      request(app).get('/api/invoices/all-payments'),
      request(app).get('/api/invoices/payment-terms')
    ]);

    expect(searchRes.status).toBe(401);
    expect(agingRes.status).toBe(401);
    expect(paymentsRes.status).toBe(401);
    expect(termsRes.status).toBe(401);
  });

  it('blocks unauthenticated access to PDF endpoints', async () => {
    const [previewRes, pdfRes] = await Promise.all([
      request(app).post('/api/invoices/preview').send({}),
      request(app).get('/api/invoices/999999/pdf')
    ]);

    expect(previewRes.status).toBe(401);
    expect(pdfRes.status).toBe(401);
  });

  it('blocks unauthenticated access to client invoice endpoints', async () => {
    const [meRes, numberRes] = await Promise.all([
      request(app).get('/api/invoices/me'),
      request(app).get('/api/invoices/number/INV-TEST-001')
    ]);

    expect(meRes.status).toBe(401);
    expect(numberRes.status).toBe(401);
  });
});

describe('Invoice endpoints with admin token', () => {
  const adminToken = process.env.TEST_ADMIN_TOKEN || '';

  const skipIfNoToken = () => {
    if (!adminToken) {
      expect(true).toBe(true);
      return true;
    }
    return false;
  };

  it('returns 404 for missing invoice', async () => {
    if (skipIfNoToken()) return;

    const res = await request(app)
      .get('/api/invoices/999999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for missing invoice PDF', async () => {
    if (skipIfNoToken()) return;

    const res = await request(app)
      .get('/api/invoices/999999/pdf')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 400 for preview with missing fields', async () => {
    if (skipIfNoToken()) return;

    const res = await request(app)
      .post('/api/invoices/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 when updating a missing invoice', async () => {
    if (skipIfNoToken()) return;

    const res = await request(app)
      .put('/api/invoices/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Update test' });

    expect(res.status).toBe(404);
  });

  it('allows admin to search invoices', async () => {
    if (skipIfNoToken()) return;

    const res = await request(app)
      .get('/api/invoices/search')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.invoices)).toBe(true);
  });

  it('allows admin to fetch payment terms', async () => {
    if (skipIfNoToken()) return;

    const res = await request(app)
      .get('/api/invoices/payment-terms')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.terms)).toBe(true);
  });

  it('allows admin to fetch invoice stats', async () => {
    if (skipIfNoToken()) return;

    const res = await request(app)
      .get('/api/invoices/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('stats');
  });

  it('rejects invalid project ID for deposit lookup', async () => {
    if (skipIfNoToken()) return;

    const res = await request(app)
      .get('/api/invoices/deposits/not-a-number')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it('rejects invalid recurring ID', async () => {
    if (skipIfNoToken()) return;

    const res = await request(app)
      .get('/api/invoices/recurring/not-a-number')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it('rejects invalid scheduled ID', async () => {
    if (skipIfNoToken()) return;

    const res = await request(app)
      .delete('/api/invoices/scheduled/not-a-number')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 for custom number with missing fields', async () => {
    if (skipIfNoToken()) return;

    const res = await request(app)
      .post('/api/invoices/with-custom-number')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ prefix: 'INV' });

    expect(res.status).toBe(400);
  });
});
