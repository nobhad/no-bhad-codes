#!/usr/bin/env node

/**
 * ===============================================
 * GOOGLE DRIVE BACKUP UPLOAD (CLI)
 * ===============================================
 * Uploads the most recent local database backup (from
 * scripts/backup-database.ts or the in-app scheduler) to a
 * Google Drive folder via a Google service account.
 *
 * Usage:
 *   npx tsx scripts/backup-to-drive.ts
 *
 * Required env:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  e.g. backup-bot@my-proj.iam.gserviceaccount.com
 *   GOOGLE_SERVICE_ACCOUNT_KEY    PEM private key (literal newlines or `\n` escapes)
 *   GOOGLE_DRIVE_FOLDER_ID        Drive folder ID (from the share URL after /folders/)
 *
 * Optional env:
 *   BACKUP_DIR                    default ./data/backups
 *   DRIVE_RETENTION_COUNT         default 30
 *
 * One-time setup: see docs/OPS_RUNBOOK.md → "Offsite backups (Google Drive)"
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  getLatestLocalBackup,
  isDriveBackupConfigured,
  uploadBackupToDrive
} from '../server/services/drive-backup-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function main(): Promise<void> {
  if (!isDriveBackupConfigured()) {
    console.error('❌ Drive backup not configured. Required env: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_DRIVE_FOLDER_ID');
    process.exit(1);
  }
  const backupDir = process.env.BACKUP_DIR || join(projectRoot, 'data/backups');
  const filePath = getLatestLocalBackup(backupDir);
  console.log(`📤 Uploading ${filePath}...`);
  const result = await uploadBackupToDrive(filePath);
  console.log(`✅ Uploaded ${result.uploaded.name} (id ${result.uploaded.id}, ${result.durationMs}ms, pruned ${result.prunedCount})`);
}

main().catch((err) => {
  console.error('❌ Drive backup failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
