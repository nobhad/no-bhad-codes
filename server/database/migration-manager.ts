/**
 * ===============================================
 * DATABASE MIGRATION MANAGER
 * ===============================================
 * @file server/database/migration-manager.ts
 *
 * Manages database schema migrations with version tracking.
 */

import fs from 'fs/promises';
import path from 'path';
import { Database } from 'sqlite3';
import { logger } from '../services/logger.js';

export interface Migration {
  id: number;
  name: string;
  filename: string;
  up: string;
  down: string;
  appliedAt?: string;
}

export class MigrationManager {
  private db: Database;
  private migrationDir: string;

  constructor(db: Database, migrationDir: string = './server/database/migrations') {
    this.db = db;
    this.migrationDir = migrationDir;
  }

  /**
   * Initialize migration tracking table
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          filename TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      this.db.run(query, (err) => {
        if (err) {
          logger.logError(err, { category: 'DATABASE_MIGRATION' });
          reject(err);
        } else {
          logger.info('Migration tracking table initialized');
          resolve();
        }
      });
    });
  }

  /**
   * Get all available migrations from disk
   */
  async getAvailableMigrations(): Promise<Migration[]> {
    try {
      // Ensure migrations directory exists
      await fs.mkdir(this.migrationDir, { recursive: true });

      const files = await fs.readdir(this.migrationDir);
      const migrationFiles = files.filter((file) => file.endsWith('.sql')).sort();

      const migrations: Migration[] = [];

      for (const file of migrationFiles) {
        const filePath = path.join(this.migrationDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Parse migration file format:
        // -- Migration: migration_name
        // -- Up
        // SQL statements for up migration
        // -- Down
        // SQL statements for down migration

        const lines = content.split('\n');
        let migrationName = '';
        let upSql = '';
        let downSql = '';
        let currentSection = '';

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (trimmedLine.startsWith('-- Migration:')) {
            migrationName = trimmedLine.replace('-- Migration:', '').trim();
          } else if (trimmedLine === '-- Up') {
            currentSection = 'up';
          } else if (trimmedLine === '-- Down') {
            currentSection = 'down';
          } else if (!trimmedLine.startsWith('--') && trimmedLine) {
            if (currentSection === 'up') {
              upSql += `${line  }\n`;
            } else if (currentSection === 'down') {
              downSql += `${line  }\n`;
            }
          }
        }

        // Extract ID from filename (format: 001_migration_name.sql)
        const match = file.match(/^(\d+)_/);
        const id = match ? parseInt(match[1]) : 0;

        migrations.push({
          id,
          name: migrationName || file.replace('.sql', ''),
          filename: file,
          up: upSql.trim(),
          down: downSql.trim()
        });
      }

      return migrations.sort((a, b) => a.id - b.id);
    } catch (error: any) {
      logger.logError(error, { category: 'DATABASE_MIGRATION' });
      throw error;
    }
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations(): Promise<Migration[]> {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM migrations ORDER BY id ASC';

      this.db.all(query, (err, rows: any[]) => {
        if (err) {
          logger.logError(err, { category: 'DATABASE_MIGRATION' });
          reject(err);
        } else {
          const migrations = rows.map((row) => ({
            id: row.id,
            name: row.name,
            filename: row.filename,
            appliedAt: row.applied_at,
            up: '',
            down: ''
          }));
          resolve(migrations);
        }
      });
    });
  }

  /**
   * Run pending migrations
   */
  async migrate(): Promise<void> {
    try {
      await this.initialize();

      const available = await this.getAvailableMigrations();
      const applied = await this.getAppliedMigrations();
      const appliedIds = new Set(applied.map((m) => m.id));

      const pending = available.filter((m) => !appliedIds.has(m.id));

      if (pending.length === 0) {
        logger.info('No pending migrations');
        return;
      }

      logger.info(`Running ${pending.length} pending migrations`);

      for (const migration of pending) {
        await this.runMigration(migration);
      }

      logger.info('All migrations completed successfully');
    } catch (error: any) {
      logger.logError(error, { category: 'DATABASE_MIGRATION' });
      throw error;
    }
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: Migration): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info(`Applying migration: ${migration.name}`);

      // Begin transaction
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        // Execute migration SQL
        this.db.exec(migration.up, (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            logger.logError(err, {
              category: 'DATABASE_MIGRATION',
              metadata: { migrationName: migration.name }
            });
            reject(err);
            return;
          }

          // Record migration as applied
          const query = 'INSERT INTO migrations (id, name, filename) VALUES (?, ?, ?)';
          this.db.run(query, [migration.id, migration.name, migration.filename], (err) => {
            if (err) {
              this.db.run('ROLLBACK');
              logger.logError(err, {
                category: 'DATABASE_MIGRATION',
                metadata: { migrationName: migration.name }
              });
              reject(err);
            } else {
              this.db.run('COMMIT');
              logger.info(`Migration applied: ${migration.name}`);
              resolve();
            }
          });
        });
      });
    });
  }

  /**
   * Rollback the last migration
   */
  async rollback(): Promise<void> {
    try {
      const applied = await this.getAppliedMigrations();
      if (applied.length === 0) {
        logger.warn('No migrations to rollback');
        return;
      }

      const lastMigration = applied[applied.length - 1];
      const available = await this.getAvailableMigrations();
      const migration = available.find((m) => m.id === lastMigration.id);

      if (!migration) {
        throw new Error(`Migration file not found for: ${lastMigration.name}`);
      }

      if (!migration.down) {
        throw new Error(`No down migration defined for: ${migration.name}`);
      }

      await this.runRollback(migration);
      logger.info(`Rollback completed: ${migration.name}`);
    } catch (error: any) {
      logger.logError(error, { category: 'DATABASE_MIGRATION' });
      throw error;
    }
  }

  /**
   * Run rollback for a single migration
   */
  private async runRollback(migration: Migration): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info(`Rolling back migration: ${migration.name}`);

      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        // Execute rollback SQL
        this.db.exec(migration.down, (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            logger.logError(err, {
              category: 'DATABASE_MIGRATION',
              metadata: { migrationName: migration.name }
            });
            reject(err);
            return;
          }

          // Remove migration record
          const query = 'DELETE FROM migrations WHERE id = ?';
          this.db.run(query, [migration.id], (err) => {
            if (err) {
              this.db.run('ROLLBACK');
              logger.logError(err, {
                category: 'DATABASE_MIGRATION',
                metadata: { migrationName: migration.name }
              });
              reject(err);
            } else {
              this.db.run('COMMIT');
              logger.info(`Migration rolled back: ${migration.name}`);
              resolve();
            }
          });
        });
      });
    });
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    available: Migration[];
    applied: Migration[];
    pending: Migration[];
  }> {
    const available = await this.getAvailableMigrations();
    const applied = await this.getAppliedMigrations();
    const appliedIds = new Set(applied.map((m) => m.id));
    const pending = available.filter((m) => !appliedIds.has(m.id));

    return { available, applied, pending };
  }

  /**
   * Create a new migration file
   */
  async createMigration(name: string): Promise<string> {
    try {
      // Ensure migrations directory exists
      await fs.mkdir(this.migrationDir, { recursive: true });

      // Get next ID
      const available = await this.getAvailableMigrations();
      const nextId = available.length > 0 ? Math.max(...available.map((m) => m.id)) + 1 : 1;

      // Create filename
      const filename = `${nextId.toString().padStart(3, '0')}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
      const filePath = path.join(this.migrationDir, filename);

      // Create migration file template
      const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Up
-- Add your up migration SQL here


-- Down  
-- Add your down migration SQL here (for rollback)

`;

      await fs.writeFile(filePath, template);
      logger.info(`Created migration file: ${filename}`);

      return filePath;
    } catch (error: any) {
      logger.logError(error, { category: 'DATABASE_MIGRATION' });
      throw error;
    }
  }
}
