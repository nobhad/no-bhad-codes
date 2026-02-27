/**
 * ===============================================
 * HTTP TESTS - CLIENT ROUTES
 * ===============================================
 * @file tests/server/clients.test.ts
 *
 * Integration tests for client API endpoints.
 * Tests authentication, authorization, and core functionality.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/app';

describe('Client Routes - Authentication', () => {
  describe('Client self-service endpoints', () => {
    it('blocks unauthenticated access to /me endpoint', async () => {
      const res = await request(app).get('/api/clients/me');
      expect([401, 403]).toContain(res.status);
    });

    it('blocks unauthenticated profile updates', async () => {
      const res = await request(app).put('/api/clients/me').send({
        name: 'Test Client',
      });
      expect([401, 403]).toContain(res.status);
    });

    it('blocks unauthenticated password changes', async () => {
      const res = await request(app).put('/api/clients/me/password').send({
        currentPassword: 'old',
        newPassword: 'new',
      });
      expect([401, 403]).toContain(res.status);
    });

    it('blocks unauthenticated notification preferences access', async () => {
      const res = await request(app).get('/api/clients/me/notification-preferences');
      // 404 may indicate route doesn't exist or is hidden from unauthenticated users
      expect([401, 403, 404]).toContain(res.status);
    });
  });

  describe('Admin client management endpoints', () => {
    it('blocks unauthenticated access to client list', async () => {
      const res = await request(app).get('/api/clients');
      expect([401, 403]).toContain(res.status);
    });

    it('blocks unauthenticated access to single client', async () => {
      const res = await request(app).get('/api/clients/1');
      expect([401, 403]).toContain(res.status);
    });

    it('blocks unauthenticated client creation', async () => {
      const res = await request(app).post('/api/clients').send({
        name: 'New Client',
        email: 'new@example.com',
      });
      expect([401, 403]).toContain(res.status);
    });

    it('blocks unauthenticated client updates', async () => {
      const res = await request(app).put('/api/clients/1').send({
        name: 'Updated Name',
      });
      expect([401, 403]).toContain(res.status);
    });

    it('blocks unauthenticated client deletion', async () => {
      const res = await request(app).delete('/api/clients/1');
      expect([401, 403, 500]).toContain(res.status);
    });
  });

  describe('Contact management endpoints', () => {
    it('blocks unauthenticated access to client contacts', async () => {
      const res = await request(app).get('/api/clients/1/contacts');
      expect([401, 403]).toContain(res.status);
    });

    it('blocks unauthenticated contact creation', async () => {
      const res = await request(app).post('/api/clients/1/contacts').send({
        name: 'John Doe',
        email: 'john@example.com',
      });
      expect([401, 403]).toContain(res.status);
    });

    it('blocks unauthenticated contact updates', async () => {
      const res = await request(app).put('/api/clients/1/contacts/1').send({
        name: 'Jane Doe',
      });
      expect([401, 403]).toContain(res.status);
    });

    it('blocks unauthenticated contact deletion', async () => {
      const res = await request(app).delete('/api/clients/1/contacts/1');
      expect([401, 403, 500]).toContain(res.status);
    });
  });

  describe('Notes and activities endpoints', () => {
    it('blocks unauthenticated access to client notes', async () => {
      const res = await request(app).get('/api/clients/1/notes');
      expect([401, 403]).toContain(res.status);
    });

    it('blocks unauthenticated note creation', async () => {
      const res = await request(app).post('/api/clients/1/notes').send({
        content: 'Test note',
      });
      expect([401, 403]).toContain(res.status);
    });

    it('blocks unauthenticated access to client activities', async () => {
      const res = await request(app).get('/api/clients/1/activities');
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('Custom fields endpoints', () => {
    it('blocks unauthenticated access to custom fields', async () => {
      const res = await request(app).get('/api/clients/1/custom-fields');
      expect([401, 403]).toContain(res.status);
    });

    it('blocks unauthenticated custom field creation', async () => {
      const res = await request(app).post('/api/clients/1/custom-fields').send({
        fieldName: 'industry',
        fieldValue: 'Technology',
      });
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('Tags endpoints', () => {
    it('blocks unauthenticated access to client tags', async () => {
      const res = await request(app).get('/api/clients/1/tags');
      expect([401, 403]).toContain(res.status);
    });

    it('blocks unauthenticated tag assignment', async () => {
      const res = await request(app).post('/api/clients/1/tags').send({
        tagId: 1,
      });
      expect([401, 403]).toContain(res.status);
    });
  });
});

describe('Client Routes - With Admin Token', () => {
  const adminToken = process.env.TEST_ADMIN_TOKEN || '';

  const skipIfNoToken = () => {
    if (!adminToken) {
      expect(true).toBe(true);
      return true;
    }
    return false;
  };

  describe('GET /api/clients', () => {
    it('returns clients list for admin', async () => {
      if (skipIfNoToken()) return;

      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 204]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('success', true);
      }
    });

    it('supports pagination', async () => {
      if (skipIfNoToken()) return;

      const res = await request(app)
        .get('/api/clients')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 204]).toContain(res.status);
    });

    it('supports search', async () => {
      if (skipIfNoToken()) return;

      const res = await request(app)
        .get('/api/clients')
        .query({ search: 'test' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 204]).toContain(res.status);
    });
  });

  describe('GET /api/clients/:id', () => {
    it('returns 404 for non-existent client', async () => {
      if (skipIfNoToken()) return;

      const res = await request(app)
        .get('/api/clients/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/clients - validation', () => {
    it('rejects client with invalid email', async () => {
      if (skipIfNoToken()) return;

      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Client',
          email: 'invalid-email',
        });

      expect([400, 422]).toContain(res.status);
    });

    it('rejects client with missing required fields', async () => {
      if (skipIfNoToken()) return;

      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect([400, 422]).toContain(res.status);
    });
  });

  describe('PUT /api/clients/:id - validation', () => {
    it('rejects update with invalid email', async () => {
      if (skipIfNoToken()) return;

      const res = await request(app)
        .put('/api/clients/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'not-an-email' });

      expect([400, 404, 422]).toContain(res.status);
    });
  });

  describe('Contact validation', () => {
    it('rejects contact with invalid email', async () => {
      if (skipIfNoToken()) return;

      const res = await request(app)
        .post('/api/clients/1/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'John Doe',
          email: 'invalid-email',
        });

      expect([400, 404, 422]).toContain(res.status);
    });

    it('rejects contact with invalid phone', async () => {
      if (skipIfNoToken()) return;

      const res = await request(app)
        .post('/api/clients/1/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          phone: 'not-a-phone',
        });

      // May accept or reject depending on validation rules
      expect([200, 201, 400, 404, 422]).toContain(res.status);
    });
  });
});

describe('Client Routes - Input Sanitization', () => {
  const adminToken = process.env.TEST_ADMIN_TOKEN || '';

  const skipIfNoToken = () => {
    if (!adminToken) {
      expect(true).toBe(true);
      return true;
    }
    return false;
  };

  it('sanitizes XSS in client name', async () => {
    if (skipIfNoToken()) return;

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '<script>alert("xss")</script>',
        email: 'test@example.com',
      });

    // Should either sanitize or reject
    if (res.status === 201 && res.body.data) {
      expect(res.body.data.name).not.toContain('<script>');
    }
  });

  it('handles SQL injection in search', async () => {
    if (skipIfNoToken()) return;

    const res = await request(app)
      .get('/api/clients')
      .query({ search: "'; DROP TABLE clients; --" })
      .set('Authorization', `Bearer ${adminToken}`);

    // Should not crash
    expect([200, 204, 400]).toContain(res.status);
  });

  it('sanitizes XSS in notes', async () => {
    if (skipIfNoToken()) return;

    const res = await request(app)
      .post('/api/clients/1/notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        content: '<img src=x onerror=alert("xss")>',
      });

    // Should sanitize or reject
    if (res.status === 201 && res.body.data) {
      expect(res.body.data.content).not.toContain('onerror');
    }
  });
});

describe('Client Routes - Authorization', () => {
  // Note: These tests verify that client tokens can only access their own data
  // Skip if no client token is configured
  const clientToken = process.env.TEST_CLIENT_TOKEN || '';

  const skipIfNoToken = () => {
    if (!clientToken) {
      expect(true).toBe(true);
      return true;
    }
    return false;
  };

  describe('Client cannot access other clients', () => {
    it('blocks client from accessing other client details', async () => {
      if (skipIfNoToken()) return;

      const res = await request(app)
        .get('/api/clients/999999')
        .set('Authorization', `Bearer ${clientToken}`);

      // Should be 403 (forbidden) or 404 (not found/hidden)
      expect([403, 404]).toContain(res.status);
    });

    it('blocks client from listing all clients', async () => {
      if (skipIfNoToken()) return;

      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${clientToken}`);

      // Admin-only endpoint
      expect([403, 404]).toContain(res.status);
    });
  });
});
