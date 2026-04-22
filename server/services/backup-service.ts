/**
 * ===============================================
 * SQLITE BACKUP SERVICE
 * ===============================================
 * @file server/services/backup-service.ts
 *
 * Produces a consistent snapshot of the live SQLite database file
 * while the server is still serving traffic, then gzips it and
 * drops older backups past the retention window.
 *
 * Why not just `cp`:
 *   A naive file copy is unsafe against concurrent writes. SQLite's
 *   WAL mode means the main DB file can be missing committed data
 *   that lives in the -wal sidecar; copying the wrong snapshot
 *   produces a restore that silently loses the last few seconds of
 *   transactions.
 *
 * What we use:
 *   sqlite3's online backup API (`Database.backup(destPath)`) which
 *   takes a transactionally consistent copy of every page without
 *   blocking ongoing writes. The result is a standalone .sqlite file
 *   with no -wal/-shm dependency.
 *
 * Layout:
 *   ${BACKUP_DIR}/daily/
 *     client_portal-2026-04-21-030500.sqlite.gz
 *     client_portal-2026-04-22-030500.sqlite.gz
 *     ...
 *
 * Retention: anything older than BACKUP_RETENTION_DAYS (default 7)
 * is deleted on each run. Scheduled daily via the scheduler.
 *
 * Restore: decompress with `gunzip`, then point the server at the
 * resulting file via DATABASE_PATH and restart. Detail in the
 * ops runbook.
 */

import { promises as fs } from 'node:fs';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import sqlite3 from 'sqlite3';
import { logger } from './logger.js';

const DEFAULT_RETENTION_DAYS = 7;
const BACKUP_SUBDIR = 'daily';

function resolveBackupDir(): string {
  const override = process.env.BACKUP_DIR;
  if (override) return path.resolve(override);
  // Default to a sibling of the DB file so backups live on the same
  // volume (Railway persistent volume, local ./data, etc.).
  const dbPath = process.env.DATABASE_PATH || './data/client_portal.db';
  const dbDir = path.dirname(path.resolve(dbPath));
  return path.join(dbDir, 'backups');
}

function resolveDbPath(): string {
  return path.resolve(process.env.DATABASE_PATH || './data/client_portal.db');
}

function timestampSuffix(now = new Date()): string {
  // YYYY-MM-DD-HHMMSS, UTC, no separators that fight with filesystems.
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  );
}

/**
 * Take a consistent backup of the live DB via SQLite's online backup
 * API, then gzip the result. Returns the path to the compressed file.
 *
 * Safe against concurrent writes — the backup API uses SQLite's own
 * page-locking to produce a transactionally consistent snapshot.
 */
async function createBackupFile(): Promise<string> {
  const dbPath = resolveDbPath();
  const backupDir = path.join(resolveBackupDir(), BACKUP_SUBDIR);
  await fs.mkdir(backupDir, { recursive: true });

  const base = path.basename(dbPath, path.extname(dbPath));
  const stamped = `${base}-${timestampSuffix()}.sqlite`;
  const rawPath = path.join(backupDir, stamped);
  const gzPath = `${rawPath}.gz`;

  await new Promise<void>((resolve, reject) => {
    // Open the source in read-only mode so we never contend for a
    // write lock against the running server's pool.
    const source = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (openErr) => {
      if (openErr) {
        reject(openErr);
        return;
      }

      // sqlite3's TypeScript types don't expose .backup yet; it's
      // runtime-available on the underlying node binding.
      const backup = (source as unknown as {
        backup: (destPath: string, cb: (err: Error | null) => void) => {
          step: (pages: number, cb: (err: Error | null) => void) => void;
          finish: (cb: (err: Error | null) => void) => void;
        };
      }).backup(rawPath, (backupErr) => {
        if (backupErr) {
          source.close(() => reject(backupErr));
          return;
        }

        // step(-1) copies the entire DB in one shot. For a small DB
        // that's fine; for a huge one we'd chunk, but our footprint
        // is modest and the online API doesn't block writers.
        backup.step(-1, (stepErr) => {
          backup.finish((finishErr) => {
            source.close(() => {
              if (stepErr) reject(stepErr);
              else if (finishErr) reject(finishErr);
              else resolve();
            });
          });
        });
      });
    });
  });

  // gzip the snapshot so retention storage is cheap.
  await pipeline(
    createReadStream(rawPath),
    zlib.createGzip({ level: 6 }),
    createWriteStream(gzPath)
  );
  await fs.unlink(rawPath);

  return gzPath;
}

async function pruneOldBackups(retentionDays: number): Promise<number> {
  const dir = path.join(resolveBackupDir(), BACKUP_SUBDIR);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return 0;
    throw err;
  }

  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const name of entries) {
    if (!name.endsWith('.sqlite.gz')) continue;
    const filePath = path.join(dir, name);
    const stat = await fs.stat(filePath);
    if (stat.mtimeMs < cutoffMs) {
      await fs.unlink(filePath);
      removed += 1;
    }
  }
  return removed;
}

export interface BackupResult {
  file: string;
  bytes: number;
  prunedCount: number;
  durationMs: number;
}

export async function runDailyBackup(
  retentionDays = DEFAULT_RETENTION_DAYS
): Promise<BackupResult> {
  const start = Date.now();
  const file = await createBackupFile();
  const stat = await fs.stat(file);
  const prunedCount = await pruneOldBackups(retentionDays);
  return {
    file,
    bytes: stat.size,
    prunedCount,
    durationMs: Date.now() - start
  };
}

export interface BackupFileInfo {
  name: string;
  path: string;
  bytes: number;
  createdAt: string;
}

/** Inspect the on-disk backup set; used by the admin endpoint. */
export async function listBackups(): Promise<BackupFileInfo[]> {
  const dir = path.join(resolveBackupDir(), BACKUP_SUBDIR);
  try {
    const entries = await fs.readdir(dir);
    const files = entries.filter((n) => n.endsWith('.sqlite.gz'));
    const stats = await Promise.all(
      files.map(async (name) => {
        const full = path.join(dir, name);
        const s = await fs.stat(full);
        return {
          name,
          path: full,
          bytes: s.size,
          createdAt: s.mtime.toISOString()
        };
      })
    );
    return stats.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return [];
    throw err;
  }
}

export function getBackupDir(): string {
  return path.join(resolveBackupDir(), BACKUP_SUBDIR);
}

// Export logger so the scheduler can reach it via this module's
// surface for debug logging during the backup run.
export { logger as backupLogger };
