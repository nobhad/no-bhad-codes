#!/usr/bin/env node

/**
 * Database Migration CLI Tool
 * Usage: node scripts/migrate.js [command]
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'sqlite3';
import { MigrationManager } from '../server/database/migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Configuration
const DATABASE_PATH = process.env.DATABASE_PATH || './data/client_portal.db';
const MIGRATIONS_DIR = resolve(projectRoot, 'server/database/migrations');

// Commands
const commands = {
  async migrate() {
    console.log('🚀 Running database migrations...');
    const db = new Database.Database(DATABASE_PATH);
    const migrator = new MigrationManager(db, MIGRATIONS_DIR);
    
    try {
      await migrator.migrate();
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    } finally {
      db.close();
    }
  },

  async rollback() {
    console.log('⏪ Rolling back last migration...');
    const db = new Database.Database(DATABASE_PATH);
    const migrator = new MigrationManager(db, MIGRATIONS_DIR);
    
    try {
      await migrator.rollback();
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      process.exit(1);
    } finally {
      db.close();
    }
  },

  async status() {
    console.log('📋 Migration status...');
    const db = new Database.Database(DATABASE_PATH);
    const migrator = new MigrationManager(db, MIGRATIONS_DIR);
    
    try {
      const status = await migrator.getStatus();
      
      console.log(`\nTotal migrations: ${status.total}`);
      console.log(`Executed: ${status.executed.length}`);
      console.log(`Pending: ${status.pending.length}\n`);
      
      if (status.executed.length > 0) {
        console.log('✅ Executed migrations:');
        status.executed.forEach(migration => {
          console.log(`  ${migration.id.toString().padStart(3, '0')}: ${migration.name} (${migration.executed_at})`);
        });
        console.log('');
      }
      
      if (status.pending.length > 0) {
        console.log('⏳ Pending migrations:');
        status.pending.forEach(migration => {
          console.log(`  ${migration.id.toString().padStart(3, '0')}: ${migration.name}`);
        });
      } else {
        console.log('✅ All migrations are up to date!');
      }
      
    } catch (error) {
      console.error('❌ Failed to get status:', error.message);
      process.exit(1);
    } finally {
      db.close();
    }
  },

  async create() {
    const migrationName = process.argv[3];
    if (!migrationName) {
      console.error('❌ Please provide a migration name: node scripts/migrate.js create "migration name"');
      process.exit(1);
    }

    try {
      const filepath = MigrationManager.createMigration(migrationName, MIGRATIONS_DIR);
      console.log(`✅ Created migration: ${filepath}`);
    } catch (error) {
      console.error('❌ Failed to create migration:', error.message);
      process.exit(1);
    }
  },

  help() {
    console.log(`
Database Migration Tool

Usage: node scripts/migrate.js [command]

Commands:
  migrate     Run all pending migrations
  rollback    Rollback the last migration
  status      Show migration status
  create      Create a new migration file
  help        Show this help message

Examples:
  node scripts/migrate.js migrate
  node scripts/migrate.js create "add user roles"
  node scripts/migrate.js status
  node scripts/migrate.js rollback
`);
  }
};

// Main execution
const command = process.argv[2] || 'help';

if (!commands[command]) {
  console.error(`❌ Unknown command: ${command}`);
  commands.help();
  process.exit(1);
}

commands[command]().catch(error => {
  console.error('❌ Command failed:', error);
  process.exit(1);
});