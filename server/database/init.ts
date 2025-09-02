/**
 * ===============================================
 * DATABASE INITIALIZATION
 * ===============================================
 * @file server/database/init.ts
 *
 * SQLite database connection and initialization
 */

import sqlite3 from 'sqlite3';
import { resolve } from 'path';

interface DatabaseRow {
  [key: string]: any;
}

interface Database {
  get(sql: string, params?: any[]): Promise<DatabaseRow | undefined>;
  all(sql: string, params?: any[]): Promise<DatabaseRow[]>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
  close(): Promise<void>;
}

class DatabaseWrapper implements Database {
  private db: sqlite3.Database;

  constructor(db: sqlite3.Database) {
    this.db = db;
  }

  async get(sql: string, params: any[] = []): Promise<DatabaseRow | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as DatabaseRow);
      });
    });
  }

  async all(sql: string, params: any[] = []): Promise<DatabaseRow[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as DatabaseRow[]);
      });
    });
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

let db: DatabaseWrapper | null = null;

/**
 * Initialize and get database connection
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Initialize the database connection
 */
export async function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const dbPath = process.env.DATABASE_PATH || './database.sqlite';
    
    const sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Failed to connect to database:', err.message);
        reject(err);
        return;
      }
      
      console.log('Connected to SQLite database');
      
      // Enable foreign key constraints
      sqliteDb.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          console.error('Failed to enable foreign keys:', err);
          reject(err);
          return;
        }
        
        db = new DatabaseWrapper(sqliteDb);
        resolve();
      });
    });
  });
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (!db) {
    return;
  }
  
  try {
    await db.close();
    db = null;
    console.log('Database connection closed');
  } catch (err) {
    console.error('Error closing database:', err);
    throw err;
  }
}