/**
 * ===============================================
 * DATABASE MIGRATIONS SYSTEM
 * ===============================================
 * @file server/database/migrations.ts
 *
 * Handles database schema migrations for version control and updates.
 */

import Database from 'sqlite3';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export interface Migration {
  id: number;
  name: string;
  filename: string;
  executed_at?: string;
}

export interface MigrationFile {
  id: number;
  name: string;
  filename: string;
  up: string;
  down: string;
}

export class MigrationManager {
  private db: Database.Database;
  private migrationsDir: string;

  constructor(database: Database.Database, migrationsDir: string = './server/database/migrations') {
    this.db = database;
    this.migrationsDir = resolve(migrationsDir);
  }

  /**
   * Initialize the migrations table
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          filename TEXT NOT NULL,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(id, name)
        )
      `;

      this.db.run(sql, (err) => {
        if (err) {
          reject(new Error(`Failed to create migrations table: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get all migration files from the migrations directory
   */
  getMigrationFiles(): MigrationFile[] {
    if (!existsSync(this.migrationsDir)) {
      console.warn(`Migrations directory does not exist: ${this.migrationsDir}`);
      return [];
    }

    const files = readdirSync(this.migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    return files.map((filename) => {
      const fullPath = join(this.migrationsDir, filename);
      const content = readFileSync(fullPath, 'utf-8');

      // Parse migration file
      const parts = content.split('-- DOWN');
      const up = parts[0].replace('-- UP', '').trim();
      const down = parts[1]?.trim() || '';

      // Extract ID and name from filename (format: 001_create_users.sql)
      const match = filename.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        throw new Error(`Invalid migration filename format: ${filename}`);
      }

      const id = parseInt(match[1], 10);
      const name = match[2].replace(/_/g, ' ');

      return {
        id,
        name,
        filename,
        up,
        down
      };
    });
  }

  /**
   * Get executed migrations from database
   */
  async getExecutedMigrations(): Promise<Migration[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM migrations ORDER BY id ASC', [], (err, rows) => {
        if (err) {
          reject(new Error(`Failed to get executed migrations: ${err.message}`));
        } else {
          resolve(rows as Migration[]);
        }
      });
    });
  }

  /**
   * Get pending migrations that need to be executed
   */
  async getPendingMigrations(): Promise<MigrationFile[]> {
    const allMigrations = this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();
    const executedIds = new Set(executedMigrations.map((m) => m.id));

    return allMigrations.filter((migration) => !executedIds.has(migration.id));
  }

  /**
   * Execute a single migration
   */
  private async executeMigration(migration: MigrationFile): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        // Execute the migration SQL
        this.db.exec(migration.up, (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(new Error(`Migration ${migration.filename} failed: ${err.message}`));
            return;
          }

          // Record the migration as executed
          this.db.run(
            'INSERT INTO migrations (id, name, filename) VALUES (?, ?, ?)',
            [migration.id, migration.name, migration.filename],
            (recordErr) => {
              if (recordErr) {
                this.db.run('ROLLBACK');
                reject(new Error(`Failed to record migration: ${recordErr.message}`));
                return;
              }

              this.db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  reject(new Error(`Failed to commit migration: ${commitErr.message}`));
                } else {
                  console.log(`✅ Executed migration: ${migration.filename}`);
                  resolve();
                }
              });
            }
          );
        });
      });
    });
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    await this.init();
    const pendingMigrations = await this.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`🔄 Running ${pendingMigrations.length} pending migration(s)...`);

    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    console.log(`🎉 Successfully executed ${pendingMigrations.length} migration(s)`);
  }

  /**
   * Rollback the last migration
   */
  async rollback(): Promise<void> {
    const executedMigrations = await this.getExecutedMigrations();

    if (executedMigrations.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const lastMigration = executedMigrations[executedMigrations.length - 1];
    const migrationFiles = this.getMigrationFiles();
    const migrationFile = migrationFiles.find((m) => m.id === lastMigration.id);

    if (!migrationFile || !migrationFile.down) {
      throw new Error(`Cannot rollback migration ${lastMigration.filename}: no DOWN script found`);
    }

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        // Execute the rollback SQL
        this.db.exec(migrationFile.down, (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(new Error(`Rollback of ${migrationFile.filename} failed: ${err.message}`));
            return;
          }

          // Remove the migration record
          this.db.run('DELETE FROM migrations WHERE id = ?', [migrationFile.id], (deleteErr) => {
            if (deleteErr) {
              this.db.run('ROLLBACK');
              reject(new Error(`Failed to remove migration record: ${deleteErr.message}`));
              return;
            }

            this.db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                reject(new Error(`Failed to commit rollback: ${commitErr.message}`));
              } else {
                console.log(`⏪ Rolled back migration: ${migrationFile.filename}`);
                resolve();
              }
            });
          });
        });
      });
    });
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    executed: Migration[];
    pending: MigrationFile[];
    total: number;
  }> {
    const executed = await this.getExecutedMigrations();
    const pending = await this.getPendingMigrations();
    const total = this.getMigrationFiles().length;

    return {
      executed,
      pending,
      total
    };
  }

  /**
   * Create a new migration file template
   */
  static createMigration(
    name: string,
    migrationsDir: string = './server/database/migrations'
  ): string {
    const timestamp = Date.now();
    const id = String(timestamp).slice(-6); // Use last 6 digits as ID
    const filename = `${id.padStart(3, '0')}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
    const filepath = join(migrationsDir, filename);

    const template = `-- UP
-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   name TEXT NOT NULL,
--   created_at DATETIME DEFAULT CURRENT_TIMESTAMP
-- );

-- DOWN
-- Rollback SQL (optional but recommended)
-- Example:
-- DROP TABLE IF EXISTS example;
`;

    require('fs').writeFileSync(filepath, template);
    console.log(`📝 Created migration: ${filepath}`);

    return filepath;
  }
}
