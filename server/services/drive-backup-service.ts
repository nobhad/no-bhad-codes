/**
 * ===============================================
 * GOOGLE DRIVE BACKUP SERVICE
 * ===============================================
 * @file server/services/drive-backup-service.ts
 *
 * Off-server backup destination for SQLite snapshots produced by
 * backup-service.ts. Authenticates with a Google service account
 * (JWT bearer flow), uploads via the Drive REST API, and prunes
 * old uploads in the destination folder.
 *
 * Why no `googleapis` SDK? It's a 50MB+ dependency for a 50-line
 * use case. We use built-in `fetch` + `crypto` for JWT signing.
 *
 * Required env (when enabled):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_KEY    (PEM private key; literal newlines or `\n` escapes)
 *   GOOGLE_DRIVE_FOLDER_ID
 *
 * Optional env:
 *   DRIVE_RETENTION_COUNT         default 30
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { basename, join } from 'path';
import { createSign } from 'crypto';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';

export interface DriveFileInfo {
  id: string;
  name: string;
  createdTime: string;
}

/** True when all required env vars are set. Prevents accidental no-op uploads. */
export function isDriveBackupConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY &&
    process.env.GOOGLE_DRIVE_FOLDER_ID
  );
}

/** Find the newest backup in `${BACKUP_DIR}/daily/`. Throws if none. */
export function getLatestLocalBackup(backupDir: string): string {
  const dailyDir = join(backupDir, 'daily');
  if (!existsSync(dailyDir)) {
    throw new Error(`No backup directory at ${dailyDir}`);
  }
  const files = readdirSync(dailyDir)
    .filter((f) => /\.(db|sqlite)(\.gz)?$/.test(f))
    .map((f) => ({ name: f, path: join(dailyDir, f), mtime: statSync(join(dailyDir, f)).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) {
    throw new Error(`No backup files in ${dailyDir}`);
  }
  return files[0]!.path;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function mintAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!;
  // Allow both literal-newline keys and `\n`-escaped keys (Railway, .env files)
  const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64UrlEncode(JSON.stringify({
    iss: email,
    scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claim}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = base64UrlEncode(signer.sign(privateKey));
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  if (!res.ok) {
    throw new Error(`Token mint failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!json.access_token) {
    throw new Error(`Token mint failed: ${json.error ?? 'unknown'} ${json.error_description ?? ''}`);
  }
  return json.access_token;
}

async function uploadFile(filePath: string, folderId: string, token: string): Promise<DriveFileInfo> {
  const data = readFileSync(filePath);
  const filename = basename(filePath);
  const metadata = { name: filename, parents: [folderId] };

  const boundary = `----nbc-${Date.now().toString(16)}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    data,
    Buffer.from(`\r\n--${boundary}--`)
  ]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/related; boundary=${boundary}`,
        'content-length': String(body.length)
      },
      body
    }
  );
  if (!res.ok) {
    throw new Error(`Drive upload failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as DriveFileInfo;
}

async function pruneFolder(folderId: string, keep: number, token: string): Promise<number> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime)&orderBy=createdTime%20desc&pageSize=200`,
    { headers: { authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) return 0;
  const { files } = (await listRes.json()) as { files: DriveFileInfo[] };
  const toDelete = files.slice(keep);
  let pruned = 0;
  for (const file of toDelete) {
    const delRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` }
    });
    if (delRes.ok || delRes.status === 204) pruned += 1;
  }
  return pruned;
}

export interface DriveBackupResult {
  uploaded: DriveFileInfo;
  prunedCount: number;
  durationMs: number;
}

/**
 * Upload a single backup file to the configured Drive folder and prune older
 * uploads down to DRIVE_RETENTION_COUNT (default 30). Throws if not configured
 * or if any step fails — caller decides how to handle (scheduler logs and
 * continues, CLI exits non-zero).
 */
export async function uploadBackupToDrive(filePath: string): Promise<DriveBackupResult> {
  if (!isDriveBackupConfigured()) {
    throw new Error('Drive backup not configured (missing GOOGLE_SERVICE_ACCOUNT_* / GOOGLE_DRIVE_FOLDER_ID)');
  }
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const retention = parseInt(process.env.DRIVE_RETENTION_COUNT || '30', 10);

  const start = Date.now();
  const token = await mintAccessToken();
  const uploaded = await uploadFile(filePath, folderId, token);
  const prunedCount = await pruneFolder(folderId, retention, token);
  return { uploaded, prunedCount, durationMs: Date.now() - start };
}
