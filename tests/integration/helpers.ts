/**
 * ===============================================
 * INTEGRATION TEST HELPERS
 * ===============================================
 * @file tests/integration/helpers.ts
 *
 * One DB per test, real migrations applied, JWT minting against the
 * same secret the app reads. The pool needs file-backed SQLite
 * because :memory: is per-connection — two pool slots against
 * :memory: would be different databases.
 */

import { promises as fsp } from 'node:fs';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// __dirname isn't defined in ES modules; derive it from import.meta.url so the
// schema dump path resolves the same way under vitest as under node.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_JWT_SECRET = 'integration-test-jwt-secret-do-not-use-in-prod';
const TEST_STRIPE_WEBHOOK_SECRET = 'whsec_test_integration_do_not_use_in_prod';

// Lock the JWT secret + safe defaults for the test run before any
// app module reads them.
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.OTEL_ENABLED = 'false';        // skip OTel SDK init in tests
process.env.SCHEDULER_ENABLED = 'false';   // tests drive the work directly
process.env.LOG_LEVEL = 'error';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@test.local';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'integration-admin-pwd';
// Webhook tests forge signatures against this secret. Production uses a
// secret loaded from env; the verifier just calls HMAC against whatever
// process.env.STRIPE_WEBHOOK_SECRET says, so a known test value is fine.
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET ?? TEST_STRIPE_WEBHOOK_SECRET;

export interface TestDbHandle {
  path: string;
  cleanup: () => Promise<void>;
}

/**
 * Create a fresh SQLite file, run every migration against it, and
 * initialize the app's connection pool to point at that file.
 *
 * Returns a handle whose cleanup closes the pool and removes the
 * file (plus its WAL sidecar).
 */
export async function setupTestDb(): Promise<TestDbHandle> {
  const dbPath = path.join(tmpdir(), `nobhad-int-${randomUUID()}.db`);
  process.env.DATABASE_PATH = dbPath;

  // Load the schema from a captured dump (see tests/integration/
  // schema.sql) instead of replaying every migration. The migration
  // set has historical ordering issues — e.g. 032 ALTERs
  // proposal_requests before 047 creates it; production was patched
  // manually long ago — so a clean-room replay errors out. The dump
  // matches the same shape production runs against.
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSqlRaw = await fsp.readFile(schemaPath, 'utf8');
  // sqlite_sequence is managed by SQLite itself; AUTOINCREMENT tables
  // recreate it on demand. Trying to CREATE it directly throws
  // "object name reserved for internal use".
  const schemaSql = schemaSqlRaw.replace(
    /CREATE TABLE sqlite_sequence\([^)]*\);\s*/gi,
    ''
  );
  // The live schema has projects.intake_id REFERENCES
  // "_client_intakes_archived_086"(id), but that archived table has
  // been dropped in production. With foreign_keys=ON, SQLite errors
  // out on inserts into projects unless the referenced table exists.
  // Provide a stub so FK resolution succeeds.
  const FK_STUBS = `
    CREATE TABLE IF NOT EXISTS "_client_intakes_archived_086" (id INTEGER PRIMARY KEY);
  `;
  const raw = new sqlite3.Database(dbPath);
  await new Promise<void>((resolve, reject) => {
    raw.exec(FK_STUBS + schemaSql, (err) => (err ? reject(err) : resolve()));
  });
  await new Promise<void>((resolve, reject) => {
    raw.close((err) => (err ? reject(err) : resolve()));
  });

  const { initializeDatabase, closeDatabase } = await import('../../server/database/init.js');
  await initializeDatabase();

  return {
    path: dbPath,
    cleanup: async () => {
      try {
        await closeDatabase();
      } catch {
        // Pool may have been torn down by a test; ignore.
      }
      for (const suffix of ['', '-wal', '-shm', '-journal']) {
        const file = `${dbPath}${suffix}`;
        if (existsSync(file)) {
          try {
            await fsp.unlink(file);
          } catch {
            // Best effort — Windows holds locks.
          }
        }
      }
    }
  };
}

/**
 * Mint a JWT cookie value for the given user shape. The app's auth
 * middleware reads `auth_token` from req.cookies and verifies against
 * process.env.JWT_SECRET — we wrote that secret above.
 */
export function mintJwt(payload: {
  id: number;
  email: string;
  type: 'admin' | 'client';
  expiresIn?: SignOptions['expiresIn'];
}): string {
  const { expiresIn = '1h', ...claims } = payload;
  return jwt.sign(claims, TEST_JWT_SECRET, { expiresIn } as SignOptions);
}

/** Format a JWT as a Cookie header for supertest .set('Cookie', …). */
export function authCookie(token: string): string {
  return `auth_token=${token}`;
}

/** Convenience: full Cookie header for an admin user. */
export function adminCookie(): string {
  return authCookie(
    mintJwt({ id: 0, email: process.env.ADMIN_EMAIL ?? 'admin@test.local', type: 'admin' })
  );
}

/** Convenience: full Cookie header for a client user with a given id. */
export function clientCookie(clientId: number, email = `client${clientId}@test.local`): string {
  return authCookie(mintJwt({ id: clientId, email, type: 'client' }));
}

/**
 * Insert a minimal client row and return the new id. Use as a
 * fixture before tests that need an authenticated client. The set
 * of columns is whatever the migrations have left required; we
 * supply the bare minimum to satisfy NOT NULL + CHECK constraints.
 *
 * Pass `password` to install a real bcrypt hash so the login route
 * can authenticate via POST /api/auth/portal-login. Tests that mint
 * their own JWT directly can omit it — any non-empty hash satisfies
 * NOT NULL.
 */
export async function seedClient(overrides: Partial<{
  email: string;
  contact_name: string;
  status: string;
  client_type: string;
  password: string;
}> = {}): Promise<number> {
  const { getDatabase } = await import('../../server/database/init.js');
  const db = getDatabase();
  const passwordHash = overrides.password
    ? bcrypt.hashSync(overrides.password, 4) // low cost — tests run hot
    : '$2b$10$nottherealhashitsforjwttests____________________________';
  const result = await db.run(
    `INSERT INTO clients (
       email, contact_name, status, client_type, password_hash,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      overrides.email ?? `seed-${randomUUID().slice(0, 8)}@test.local`,
      overrides.contact_name ?? 'Seed Client',
      overrides.status ?? 'active',
      overrides.client_type ?? 'individual',
      passwordHash
    ]
  );
  if (!result.lastID) throw new Error('Failed to insert seed client');
  return result.lastID;
}

/** Insert a minimal project owned by `clientId`; return the project id. */
export async function seedProject(clientId: number, overrides: Partial<{
  project_name: string;
  status: string;
}> = {}): Promise<number> {
  const { getDatabase } = await import('../../server/database/init.js');
  const db = getDatabase();
  const result = await db.run(
    `INSERT INTO projects (client_id, project_name, status, created_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
    [
      clientId,
      overrides.project_name ?? `Project ${randomUUID().slice(0, 6)}`,
      overrides.status ?? 'active'
    ]
  );
  if (!result.lastID) throw new Error('Failed to insert seed project');
  return result.lastID;
}

/** Insert a minimal invoice owned by `clientId`; returns the invoice id. */
export async function seedInvoice(
  clientId: number,
  projectId: number,
  overrides: Partial<{
    invoice_number: string;
    amount_total: number;
    status: string;
  }> = {}
): Promise<number> {
  const { getDatabase } = await import('../../server/database/init.js');
  const db = getDatabase();
  const result = await db.run(
    `INSERT INTO invoices (
       invoice_number, project_id, client_id, amount_total, status,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      overrides.invoice_number ?? `INV-${randomUUID().slice(0, 8)}`,
      projectId,
      clientId,
      overrides.amount_total ?? 100,
      overrides.status ?? 'sent'
    ]
  );
  if (!result.lastID) throw new Error('Failed to insert seed invoice');
  return result.lastID;
}

/** Insert a minimal message thread owned by `clientId`; returns the thread id. */
export async function seedMessageThread(
  clientId: number,
  overrides: Partial<{ subject: string; thread_type: string }> = {}
): Promise<number> {
  const { getDatabase } = await import('../../server/database/init.js');
  const db = getDatabase();
  const result = await db.run(
    `INSERT INTO message_threads (
       client_id, subject, thread_type, created_at, updated_at
     ) VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
    [
      clientId,
      overrides.subject ?? 'Seed thread',
      overrides.thread_type ?? 'general'
    ]
  );
  if (!result.lastID) throw new Error('Failed to insert seed message thread');
  return result.lastID;
}

/**
 * Insert a stripe_payment_intents row for `clientId`/`invoiceId` so the
 * webhook handler can find it during handlePaymentSuccess. Returns the
 * stripe_intent_id (the Stripe-side opaque id Stripe would echo back).
 */
export async function seedStripePaymentIntent(args: {
  clientId: number;
  invoiceId: number;
  amountCents: number;
  stripeIntentId?: string;
}): Promise<string> {
  const { getDatabase } = await import('../../server/database/init.js');
  const db = getDatabase();
  const stripeIntentId = args.stripeIntentId ?? `pi_test_${randomUUID().replace(/-/g, '')}`;
  await db.run(
    `INSERT INTO stripe_payment_intents (
       stripe_intent_id, client_id, invoice_id, amount_cents,
       currency, status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'usd', 'requires_payment_method', datetime('now'), datetime('now'))`,
    [stripeIntentId, args.clientId, args.invoiceId, args.amountCents]
  );
  return stripeIntentId;
}

/**
 * Build the value of a Stripe webhook `stripe-signature` header for an
 * arbitrary payload. Production reads STRIPE_WEBHOOK_SECRET, hashes
 * `${timestamp}.${payload}` with HMAC-SHA256, and rejects timestamps
 * older than five minutes. We use the same algorithm so the verifier
 * accepts the test event without any mocking.
 */
export function signStripeWebhook(payload: string, timestampSec?: number): string {
  const ts = timestampSec ?? Math.floor(Date.now() / 1000);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not set');
  const sig = createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex');
  return `t=${ts},v1=${sig}`;
}

/** Convenience: parse a Set-Cookie value list and return the value of `name`. */
export function readCookie(setCookieHeader: string | string[] | undefined, name: string): string | undefined {
  if (!setCookieHeader) return undefined;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const raw of cookies) {
    const match = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    if (match) return match[1];
  }
  return undefined;
}
