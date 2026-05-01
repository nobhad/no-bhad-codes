/**
 * End-to-end auth flow: login → JWT cookie → CSRF roundtrip → token
 * expiry/tampering rejection. Drives the real Express app via supertest;
 * no auth code is mocked.
 *
 * The harness sets JWT_SECRET to a known test value so we can mint
 * expired and tampered tokens locally and watch the middleware reject
 * them with the documented error codes.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  setupTestDb,
  seedClient,
  mintJwt,
  authCookie,
  readCookie,
  type TestDbHandle
} from './helpers';

const TEST_PASSWORD = 'integration-flow-pwd';

let dbHandle: TestDbHandle;

beforeEach(async () => {
  dbHandle = await setupTestDb();
});

afterEach(async () => {
  await dbHandle.cleanup();
});

describe('Auth flow', () => {
  it('login sets an HttpOnly auth_token cookie and returns the client profile', async () => {
    const email = 'login-flow@test.local';
    await seedClient({ email, password: TEST_PASSWORD, status: 'active' });

    const { app } = await import('../../server/app.js');

    const res = await request(app)
      .post('/api/auth/portal-login')
      .send({ email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.user?.email).toBe(email);
    expect(res.body?.data?.user?.role).toBe('client');

    const setCookie = res.get('Set-Cookie');
    const token = readCookie(setCookie, 'auth_token');
    expect(token).toBeTruthy();

    // The cookie carries the security flags the middleware relies on.
    const rawCookies = (Array.isArray(setCookie) ? setCookie : [setCookie ?? '']).join(';');
    expect(rawCookies).toMatch(/HttpOnly/i);
    expect(rawCookies).toMatch(/SameSite/i);
  });

  it('CSRF: mutating request without the matching token is rejected; with it succeeds', async () => {
    const clientId = await seedClient({ status: 'active' });
    const { app } = await import('../../server/app.js');

    // GET seeds the csrf-token cookie and proves the JWT cookie is read.
    const seedRes = await request(app)
      .get('/api/clients/me')
      .set('Cookie', authCookie(mintJwt({
        id: clientId,
        email: `client${clientId}@test.local`,
        type: 'client'
      })));
    expect(seedRes.status).toBe(200);

    const csrfToken = readCookie(seedRes.get('Set-Cookie'), 'csrf-token');
    expect(csrfToken).toBeTruthy();

    const authJwt = mintJwt({
      id: clientId,
      email: `client${clientId}@test.local`,
      type: 'client'
    });

    // Without the x-csrf-token header the security middleware short-circuits.
    const noTokenRes = await request(app)
      .put('/api/clients/me')
      .set('Cookie', `auth_token=${authJwt}; csrf-token=${csrfToken}`)
      .send({ contact_name: 'Updated Name' });
    expect(noTokenRes.status).toBe(403);
    expect(noTokenRes.body?.code ?? noTokenRes.body?.error?.code).toMatch(/CSRF/i);

    // With the matching header it goes through.
    const okRes = await request(app)
      .put('/api/clients/me')
      .set('Cookie', `auth_token=${authJwt}; csrf-token=${csrfToken}`)
      .set('x-csrf-token', csrfToken!)
      .send({ contact_name: 'Updated Name' });
    expect(okRes.status).toBe(200);
    expect(okRes.body?.data?.client?.contact_name).toBe('Updated Name');
  });

  it('rejects an expired token with TOKEN_EXPIRED and a tampered token with TOKEN_INVALID', async () => {
    const clientId = await seedClient();
    const email = `client${clientId}@test.local`;
    const { app } = await import('../../server/app.js');

    // Expired path: mint with a past expiry. jwt.verify treats negative
    // expiresIn as already-expired, which is exactly what we want.
    const expired = mintJwt({ id: clientId, email, type: 'client', expiresIn: -1 });
    const expiredRes = await request(app)
      .get('/api/clients/me')
      .set('Cookie', authCookie(expired));
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body?.code ?? expiredRes.body?.error?.code).toBe('TOKEN_EXPIRED');

    // Tampered path: flip one byte of the signature segment so the HMAC
    // check fails. We can't just append junk because jsonwebtoken still
    // base64-decodes the signature, so swap a character inside it.
    const valid = mintJwt({ id: clientId, email, type: 'client' });
    const [h, p, s] = valid.split('.');
    const tampered = `${h}.${p}.${s.slice(0, -1)}${s.slice(-1) === 'a' ? 'b' : 'a'}`;
    const tamperedRes = await request(app)
      .get('/api/clients/me')
      .set('Cookie', authCookie(tampered));
    expect(tamperedRes.status).toBe(403);
    expect(tamperedRes.body?.code ?? tamperedRes.body?.error?.code).toBe('TOKEN_INVALID');
  });
});
