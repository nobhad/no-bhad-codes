#!/usr/bin/env node

/**
 * ===============================================
 * DATABASE BACKUP SCRIPT
 * ===============================================
 * Backs up SQLite database with retention policy.
 *
 * Usage: npx tsx scripts/backup-database.ts
 * Env:   DATABASE_PATH, BACKUP_DIR, BACKUP_RETENTION_DAILY, BACKUP_RETENTION_WEEKLY
 *
 * Retention: Keeps 7 daily + 4 weekly by default.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const DATABASE_PATH = process.env.DATABASE_PATH || join(projectRoot, 'data/client_portal.db');
const BACKUP_DIR = process.env.BACKUP_DIR || join(projectRoot, 'data/backups');
const RETENTION_DAILY = parseInt(process.env.BACKUP_RETENTION_DAILY || '7', 10);
const RETENTION_WEEKLY = parseInt(process.env.BACKUP_RETENTION_WEEKLY || '4', 10);

function backup(): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const basename = 'client_portal';
  const ext = '.db';
  const dailyName = `${basename}_${timestamp}${ext}`;
  const dailyPath = join(BACKUP_DIR, 'daily', dailyName);

  mkdirSync(join(BACKUP_DIR, 'daily'), { recursive: true });
  mkdirSync(join(BACKUP_DIR, 'weekly'), { recursive: true });

  copyFileSync(DATABASE_PATH, dailyPath);
  console.log(`Backup created: ${dailyPath}`);

  // Weekly backup on Sundays
  const now = new Date();
  if (now.getDay() === 0) {
    const weeklyName = `${basename}_week_${now.toISOString().slice(0, 10)}${ext}`;
    const weeklyPath = join(BACKUP_DIR, 'weekly', weeklyName);
    copyFileSync(DATABASE_PATH, weeklyPath);
    console.log(`Weekly backup created: ${weeklyPath}`);
  }

  pruneOldBackups();
}

function pruneOldBackups(): void {
  const dailyDir = join(BACKUP_DIR, 'daily');
  const weeklyDir = join(BACKUP_DIR, 'weekly');

  const prune = (dir: string, keep: number) => {
    if (!existsSync(dir)) return;
    const files = readdirSync(dir)
      .map((f) => ({ name: f, path: join(dir, f), mtime: statSync(join(dir, f)).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);

    files.slice(keep).forEach((f) => {
      unlinkSync(f.path);
      console.log(`Pruned: ${f.path}`);
    });
  };

  prune(dailyDir, RETENTION_DAILY);
  prune(weeklyDir, RETENTION_WEEKLY);
}

try {
  backup();
} catch (err) {
  console.error('Backup failed:', err);
  process.exit(1);
}
