/**
 * ===============================================
 * DATABASE INITIALIZATION WITH CONNECTION POOL
 * ===============================================
 * @file server/database/init.ts
 *
 * SQLite database connection pooling and initialization
 * Implements a connection pool pattern for better resource management
 */

import sqlite3 from 'sqlite3';
import { resolve } from 'path';

interface DatabaseRow {
  [key: string]: any;
}

interface TransactionContext {
  get(sql: string, params?: any[]): Promise<DatabaseRow | undefined>;
  all(sql: string, params?: any[]): Promise<DatabaseRow[]>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
}

interface Database {
  get(sql: string, params?: any[]): Promise<DatabaseRow | undefined>;
  all(sql: string, params?: any[]): Promise<DatabaseRow[]>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
  transaction<T>(fn: (ctx: TransactionContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  getConnectionStats(): ConnectionStats;
}

interface ConnectionStats {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maxConnections: number;
  queuedRequests: number;
}

interface PooledConnection {
  db: sqlite3.Database;
  inUse: boolean;
  lastUsed: number;
  id: string;
}

class DatabaseConnectionPool implements Database {
  private connections: PooledConnection[] = [];
  private maxConnections: number;
  private dbPath: string;
  private waitingQueue: Array<{
    resolve: (connection: PooledConnection) => void;
    reject: (error: Error) => void;
  }> = [];
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(dbPath: string, maxConnections: number = 5) {
    this.dbPath = dbPath;
    this.maxConnections = maxConnections;

    // Setup cleanup interval for idle connections
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 30000); // Cleanup every 30 seconds
  }

  private async createConnection(): Promise<PooledConnection> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Configure SQLite optimizations - these must run outside of any transaction
        // Use serialize to ensure they complete before the connection is used
        db.serialize(() => {
          db.run('PRAGMA foreign_keys = ON');
          db.run('PRAGMA journal_mode = WAL');
          db.run('PRAGMA synchronous = NORMAL');
          db.run('PRAGMA temp_store = MEMORY');
          db.run('PRAGMA mmap_size = 268435456'); // 256MB
        });

        const connection: PooledConnection = {
          db,
          inUse: false,
          lastUsed: Date.now(),
          id: Math.random().toString(36).substring(7),
        };

        resolve(connection);
      });
    });
  }

  private async getConnection(): Promise<PooledConnection> {
    // Look for an available connection
    const availableConnection = this.connections.find((conn) => !conn.inUse);
    if (availableConnection) {
      availableConnection.inUse = true;
      availableConnection.lastUsed = Date.now();
      return availableConnection;
    }

    // Create new connection if under limit
    if (this.connections.length < this.maxConnections) {
      const newConnection = await this.createConnection();
      newConnection.inUse = true;
      this.connections.push(newConnection);
      return newConnection;
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      this.waitingQueue.push({ resolve, reject });

      // Set timeout for waiting requests
      setTimeout(() => {
        const index = this.waitingQueue.findIndex((item) => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
          reject(new Error('Database connection timeout'));
        }
      }, 10000); // 10 second timeout
    });
  }

  private releaseConnection(connection: PooledConnection): void {
    connection.inUse = false;
    connection.lastUsed = Date.now();

    // Process waiting queue
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift();
      if (waiter) {
        connection.inUse = true;
        waiter.resolve(connection);
      }
    }
  }

  private cleanupIdleConnections(): void {
    const maxIdleTime = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    this.connections = this.connections.filter((conn) => {
      if (!conn.inUse && now - conn.lastUsed > maxIdleTime) {
        conn.db.close();
        return false;
      }
      return true;
    });
  }

  async get(sql: string, params: any[] = []): Promise<DatabaseRow | undefined> {
    const connection = await this.getConnection();
    try {
      return await new Promise<DatabaseRow | undefined>((resolve, reject) => {
        connection.db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row as DatabaseRow);
        });
      });
    } finally {
      this.releaseConnection(connection);
    }
  }

  async all(sql: string, params: any[] = []): Promise<DatabaseRow[]> {
    const connection = await this.getConnection();
    try {
      return await new Promise<DatabaseRow[]>((resolve, reject) => {
        connection.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows as DatabaseRow[]);
        });
      });
    } finally {
      this.releaseConnection(connection);
    }
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    const connection = await this.getConnection();
    try {
      return await new Promise<{ lastID?: number; changes?: number }>((resolve, reject) => {
        connection.db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    } finally {
      this.releaseConnection(connection);
    }
  }

  /**
   * Execute a function within a database transaction
   * All operations within the callback use the same connection
   */
  async transaction<T>(fn: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    const connection = await this.getConnection();

    // Create a context that uses this specific connection
    const ctx: TransactionContext = {
      get: (sql: string, params: any[] = []): Promise<DatabaseRow | undefined> => {
        return new Promise((resolve, reject) => {
          connection.db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row as DatabaseRow);
          });
        });
      },
      all: (sql: string, params: any[] = []): Promise<DatabaseRow[]> => {
        return new Promise((resolve, reject) => {
          connection.db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows as DatabaseRow[]);
          });
        });
      },
      run: (sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> => {
        return new Promise((resolve, reject) => {
          connection.db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
          });
        });
      },
    };

    try {
      // Begin transaction
      await ctx.run('BEGIN TRANSACTION');

      // Execute the callback
      const result = await fn(ctx);

      // Commit transaction
      await ctx.run('COMMIT');

      return result;
    } catch (error) {
      // Rollback on error
      try {
        await ctx.run('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
      throw error;
    } finally {
      this.releaseConnection(connection);
    }
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all connections
    const closePromises = this.connections.map(
      (conn) =>
        new Promise<void>((resolve) => {
          conn.db.close(() => resolve());
        })
    );

    await Promise.all(closePromises);
    this.connections = [];

    // Reject any waiting requests
    this.waitingQueue.forEach((waiter) => {
      waiter.reject(new Error('Database pool is closing'));
    });
    this.waitingQueue = [];
  }

  getConnectionStats(): ConnectionStats {
    const activeConnections = this.connections.filter((conn) => conn.inUse).length;
    const idleConnections = this.connections.filter((conn) => !conn.inUse).length;

    return {
      activeConnections,
      idleConnections,
      totalConnections: this.connections.length,
      maxConnections: this.maxConnections,
      queuedRequests: this.waitingQueue.length,
    };
  }
}

let dbPool: DatabaseConnectionPool | null = null;

/**
 * Initialize and get database connection pool
 */
export function getDatabase(): Database {
  if (!dbPool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return dbPool;
}

/**
 * Initialize the database connection pool
 */
export async function initializeDatabase(): Promise<void> {
  const dbPath = process.env.DATABASE_PATH || './data/client_portal.db';
  const maxConnections = parseInt(process.env.DB_MAX_CONNECTIONS || '5');

  try {
    dbPool = new DatabaseConnectionPool(dbPath, maxConnections);

    // Test the connection by running a simple query
    await dbPool.get('SELECT 1');

    console.log(`✅ Database connection pool initialized with ${maxConnections} max connections`);
    console.log(`📊 Database path: ${dbPath}`);

    // Log connection stats
    const stats = dbPool.getConnectionStats();
    console.log(
      `📈 Pool stats: ${stats.activeConnections} active, ${stats.totalConnections} total`
    );
  } catch (error: any) {
    console.error('❌ Failed to initialize database:', error.message);
    throw error;
  }
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (!dbPool) {
    return;
  }

  try {
    const stats = dbPool.getConnectionStats();
    console.log(`🔄 Closing database pool (${stats.totalConnections} connections)...`);

    await dbPool.close();
    dbPool = null;
    console.log('✅ Database connection pool closed');
  } catch (err) {
    console.error('❌ Error closing database pool:', err);
    throw err;
  }
}

/**
 * Get database connection pool statistics
 */
export function getDatabaseStats(): ConnectionStats | null {
  return dbPool ? dbPool.getConnectionStats() : null;
}
