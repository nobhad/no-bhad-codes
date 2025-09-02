/**
 * ===============================================
 * QUERY BUILDER TESTS
 * ===============================================
 * @file tests/unit/database/query-builder.test.ts
 * 
 * Unit tests for the database query builder.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Database } from 'sqlite3';
import { QueryBuilder, SelectQueryBuilder, InsertQueryBuilder, UpdateQueryBuilder, DeleteQueryBuilder } from '../../../server/database/query-builder.js';

// Mock logger
vi.mock('../../../server/services/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock sqlite3 Database
const mockDb = {
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn()
};

describe('QueryBuilder', () => {
  let queryBuilder: QueryBuilder;

  beforeEach(() => {
    queryBuilder = new QueryBuilder(mockDb as unknown as Database);
    vi.clearAllMocks();
  });

  describe('Factory Methods', () => {
    it('should create a SelectQueryBuilder', () => {
      const select = queryBuilder.select('users');
      expect(select).toBeInstanceOf(SelectQueryBuilder);
    });

    it('should create an InsertQueryBuilder', () => {
      const insert = queryBuilder.insert('users');
      expect(insert).toBeInstanceOf(InsertQueryBuilder);
    });

    it('should create an UpdateQueryBuilder', () => {
      const update = queryBuilder.update('users');
      expect(update).toBeInstanceOf(UpdateQueryBuilder);
    });

    it('should create a DeleteQueryBuilder', () => {
      const deleteBuilder = queryBuilder.delete('users');
      expect(deleteBuilder).toBeInstanceOf(DeleteQueryBuilder);
    });
  });

  describe('Raw SQL Execution', () => {
    it('should execute raw SQL queries', async () => {
      const mockRows = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockRows);
      });

      const result = await queryBuilder.raw('SELECT * FROM users WHERE active = ?', [true]);

      expect(mockDb.all).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE active = ?',
        [true],
        expect.any(Function)
      );
      expect(result.rows).toEqual(mockRows);
      expect(result.rowCount).toBe(2);
    });

    it('should handle raw SQL errors', async () => {
      const error = new Error('SQL error');
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(error, null);
      });

      await expect(
        queryBuilder.raw('INVALID SQL')
      ).rejects.toThrow('Database query failed: SQL error');
    });
  });

  describe('Transaction Support', () => {
    it('should execute transactions successfully', async () => {
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      const result = await queryBuilder.transaction(async (qb) => {
        await qb.raw('INSERT INTO users (name) VALUES (?)', ['John']);
        await qb.raw('INSERT INTO users (name) VALUES (?)', ['Jane']);
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockDb.all).toHaveBeenCalledWith('BEGIN TRANSACTION', [], expect.any(Function));
      expect(mockDb.all).toHaveBeenCalledWith('COMMIT', [], expect.any(Function));
    });

    it('should rollback on transaction error', async () => {
      mockDb.all.mockImplementation((sql, params, callback) => {
        if (sql.includes('INSERT')) {
          callback(new Error('Insert failed'), null);
        } else {
          callback(null, []);
        }
      });

      await expect(
        queryBuilder.transaction(async (qb) => {
          await qb.raw('INSERT INTO users (name) VALUES (?)', ['John']);
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');

      expect(mockDb.all).toHaveBeenCalledWith('ROLLBACK', [], expect.any(Function));
    });
  });
});

describe('SelectQueryBuilder', () => {
  let selectBuilder: SelectQueryBuilder;

  beforeEach(() => {
    selectBuilder = new SelectQueryBuilder(mockDb as unknown as Database, 'users');
    vi.clearAllMocks();
  });

  describe('Basic Query Building', () => {
    it('should build basic SELECT query', () => {
      const { sql, params } = selectBuilder.toSql();

      expect(sql).toBe('SELECT * FROM users');
      expect(params).toEqual([]);
    });

    it('should build SELECT with specific columns', () => {
      const { sql } = selectBuilder.select('id', 'name', 'email').toSql();

      expect(sql).toBe('SELECT id, name, email FROM users');
    });

    it('should build SELECT with DISTINCT', () => {
      const { sql } = selectBuilder.distinct().select('name').toSql();

      expect(sql).toBe('SELECT DISTINCT name FROM users');
    });
  });

  describe('WHERE Clauses', () => {
    it('should build WHERE clauses', () => {
      const { sql, params } = selectBuilder
        .where('id', '=', 1)
        .where('active', '=', true)
        .toSql();

      expect(sql).toBe('SELECT * FROM users WHERE id = ? AND active = ?');
      expect(params).toEqual([1, true]);
    });

    it('should build OR WHERE clauses', () => {
      const { sql, params } = selectBuilder
        .where('role', '=', 'admin')
        .orWhere('role', '=', 'moderator')
        .toSql();

      expect(sql).toBe('SELECT * FROM users WHERE role = ? OR role = ?');
      expect(params).toEqual(['admin', 'moderator']);
    });

    it('should build WHERE IN clauses', () => {
      const { sql, params } = selectBuilder
        .whereIn('id', [1, 2, 3])
        .toSql();

      expect(sql).toBe('SELECT * FROM users WHERE id IN (?, ?, ?)');
      expect(params).toEqual([1, 2, 3]);
    });

    it('should build WHERE NULL clauses', () => {
      const { sql, params } = selectBuilder
        .whereNull('deleted_at')
        .toSql();

      expect(sql).toBe('SELECT * FROM users WHERE deleted_at IS NULL');
      expect(params).toEqual([]);
    });

    it('should build LIKE clauses', () => {
      const { sql, params } = selectBuilder
        .whereLike('name', '%john%')
        .toSql();

      expect(sql).toBe('SELECT * FROM users WHERE name LIKE ?');
      expect(params).toEqual(['%john%']);
    });
  });

  describe('JOIN Clauses', () => {
    it('should build INNER JOIN', () => {
      const { sql } = selectBuilder
        .join('profiles', 'users.id = profiles.user_id')
        .toSql();

      expect(sql).toBe('SELECT * FROM users INNER JOIN profiles ON users.id = profiles.user_id');
    });

    it('should build LEFT JOIN', () => {
      const { sql } = selectBuilder
        .leftJoin('orders', 'users.id = orders.user_id')
        .toSql();

      expect(sql).toBe('SELECT * FROM users LEFT JOIN orders ON users.id = orders.user_id');
    });

    it('should build multiple JOINs', () => {
      const { sql } = selectBuilder
        .join('profiles', 'users.id = profiles.user_id')
        .leftJoin('orders', 'users.id = orders.user_id')
        .toSql();

      expect(sql).toBe(
        'SELECT * FROM users INNER JOIN profiles ON users.id = profiles.user_id' +
        ' LEFT JOIN orders ON users.id = orders.user_id'
      );
    });
  });

  describe('ORDER BY Clauses', () => {
    it('should build ORDER BY', () => {
      const { sql } = selectBuilder
        .orderBy('name', 'ASC')
        .toSql();

      expect(sql).toBe('SELECT * FROM users ORDER BY name ASC');
    });

    it('should build multiple ORDER BY', () => {
      const { sql } = selectBuilder
        .orderBy('role', 'ASC')
        .orderBy('created_at', 'DESC')
        .toSql();

      expect(sql).toBe('SELECT * FROM users ORDER BY role ASC, created_at DESC');
    });
  });

  describe('GROUP BY and HAVING', () => {
    it('should build GROUP BY', () => {
      const { sql } = selectBuilder
        .select('role', 'COUNT(*) as count')
        .groupBy('role')
        .toSql();

      expect(sql).toBe('SELECT role, COUNT(*) as count FROM users GROUP BY role');
    });

    it('should build HAVING', () => {
      const { sql, params } = selectBuilder
        .select('role', 'COUNT(*) as count')
        .groupBy('role')
        .having('COUNT(*)', '>', 5)
        .toSql();

      expect(sql).toBe('SELECT role, COUNT(*) as count FROM users GROUP BY role HAVING COUNT(*) > ?');
      expect(params).toEqual([5]);
    });
  });

  describe('LIMIT and OFFSET', () => {
    it('should build LIMIT', () => {
      const { sql } = selectBuilder
        .limit(10)
        .toSql();

      expect(sql).toBe('SELECT * FROM users LIMIT 10');
    });

    it('should build LIMIT with OFFSET', () => {
      const { sql } = selectBuilder
        .limit(10)
        .offset(20)
        .toSql();

      expect(sql).toBe('SELECT * FROM users LIMIT 10 OFFSET 20');
    });

    it('should build pagination', async () => {
      const result = await selectBuilder.paginate(3, 15); // page 3, 15 per page

      expect(result.pagination.page).toBe(3);
      expect(result.pagination.perPage).toBe(15);
      expect(result.pagination.total).toBeDefined();
      expect(result.pagination.totalPages).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('Query Execution', () => {
    it('should execute get() query', async () => {
      const mockRows = [{ id: 1, name: 'John' }];
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockRows);
      });

      const result = await selectBuilder.get();

      expect(result.rows).toEqual(mockRows);
      expect(result.rowCount).toBe(1);
    });

    it('should execute first() query', async () => {
      const mockRow = { id: 1, name: 'John' };
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, mockRow);
      });

      const result = await selectBuilder.first();

      expect(result).toEqual(mockRow);
    });

    it('should return null when first() finds no results', async () => {
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, undefined);
      });

      const result = await selectBuilder.first();

      expect(result).toBeNull();
    });

    it('should execute count() query', async () => {
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { count: 5 });
      });

      const result = await selectBuilder.count();

      expect(result).toBe(5);
    });

    it('should execute exists() query', async () => {
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { count: 1 });
      });

      const result = await selectBuilder.exists();

      expect(result).toBe(true);
    });
  });

  describe('Pagination', () => {
    it('should execute paginate() query', async () => {
      // Mock count query
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(null, { count: 25 });
      });

      // Mock data query
      const mockRows = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
      mockDb.all.mockImplementationOnce((sql, params, callback) => {
        callback(null, mockRows);
      });

      const result = await selectBuilder.paginate(2, 10);

      expect(result.data).toEqual(mockRows);
      expect(result.pagination).toEqual({
        page: 2,
        perPage: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: true
      });
    });
  });
});

describe('InsertQueryBuilder', () => {
  let insertBuilder: InsertQueryBuilder;

  beforeEach(() => {
    insertBuilder = new InsertQueryBuilder(mockDb as unknown as Database, 'users');
    vi.clearAllMocks();
  });

  describe('Query Building', () => {
    it('should build single INSERT query', () => {
      const { sql, params } = insertBuilder
        .values({ name: 'John', email: 'john@example.com' })
        .toSql();

      expect(sql).toBe('INSERT INTO users (name, email) VALUES (?, ?)');
      expect(params).toEqual(['John', 'john@example.com']);
    });

    it('should build bulk INSERT query', () => {
      const { sql, params } = insertBuilder
        .values([
          { name: 'John', email: 'john@example.com' },
          { name: 'Jane', email: 'jane@example.com' }
        ])
        .toSql();

      expect(sql).toBe('INSERT INTO users (name, email) VALUES (?, ?), (?, ?)');
      expect(params).toEqual(['John', 'john@example.com', 'Jane', 'jane@example.com']);
    });

    it('should build INSERT OR IGNORE', () => {
      const { sql } = insertBuilder
        .values({ name: 'John', email: 'john@example.com' })
        .ignore()
        .toSql();

      expect(sql).toBe('INSERT OR IGNORE INTO users (name, email) VALUES (?, ?)');
    });

    it('should build INSERT OR REPLACE', () => {
      const { sql } = insertBuilder
        .values({ name: 'John', email: 'john@example.com' })
        .replace()
        .toSql();

      expect(sql).toBe('INSERT OR REPLACE INTO users (name, email) VALUES (?, ?)');
    });

    it('should throw error when no data provided', () => {
      expect(() => {
        insertBuilder.toSql();
      }).toThrow('No data provided for insert');
    });
  });

  describe('Query Execution', () => {
    it('should execute insert query', async () => {
      mockDb.run.mockImplementation(function (sql, params, callback) {
        callback.call({ lastID: 123, changes: 1 }, null);
      });

      const result = await insertBuilder
        .values({ name: 'John', email: 'john@example.com' })
        .execute();

      expect(result.insertId).toBe(123);
      expect(result.changes).toBe(1);
    });

    it('should handle insert errors', async () => {
      const error = new Error('Insert failed');
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(error);
      });

      await expect(
        insertBuilder.values({ name: 'John' }).execute()
      ).rejects.toThrow('Insert query failed: Insert failed');
    });
  });
});

describe('UpdateQueryBuilder', () => {
  let updateBuilder: UpdateQueryBuilder;

  beforeEach(() => {
    updateBuilder = new UpdateQueryBuilder(mockDb as unknown as Database, 'users');
    vi.clearAllMocks();
  });

  describe('Query Building', () => {
    it('should build UPDATE query with object', () => {
      const { sql, params } = updateBuilder
        .set({ name: 'John Updated', email: 'john.updated@example.com' })
        .where('id', '=', 1)
        .toSql();

      expect(sql).toBe('UPDATE users SET name = ?, email = ? WHERE id = ?');
      expect(params).toEqual(['John Updated', 'john.updated@example.com', 1]);
    });

    it('should build UPDATE query with individual sets', () => {
      const { sql, params } = updateBuilder
        .set('name', 'John Updated')
        .set('email', 'john.updated@example.com')
        .where('id', '=', 1)
        .toSql();

      expect(sql).toBe('UPDATE users SET name = ?, email = ? WHERE id = ?');
      expect(params).toEqual(['John Updated', 'john.updated@example.com', 1]);
    });

    it('should build increment operations', () => {
      const { sql } = updateBuilder
        .increment('login_count', 1)
        .where('id', '=', 1)
        .toSql();

      expect(sql).toBe('UPDATE users SET login_count = ? WHERE id = ?');
    });

    it('should throw error when no data provided', () => {
      expect(() => {
        updateBuilder.where('id', '=', 1).toSql();
      }).toThrow('No data provided for update');
    });

    it('should throw error when no WHERE clause provided', () => {
      expect(() => {
        updateBuilder.set('name', 'John').toSql();
      }).toThrow('Update query must have WHERE conditions');
    });
  });

  describe('Query Execution', () => {
    it('should execute update query', async () => {
      mockDb.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const result = await updateBuilder
        .set({ name: 'John Updated' })
        .where('id', '=', 1)
        .execute();

      expect(result.changes).toBe(1);
    });

    it('should handle update errors', async () => {
      const error = new Error('Update failed');
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(error);
      });

      await expect(
        updateBuilder.set({ name: 'John' }).where('id', '=', 1).execute()
      ).rejects.toThrow('Update query failed: Update failed');
    });
  });
});

describe('DeleteQueryBuilder', () => {
  let deleteBuilder: DeleteQueryBuilder;

  beforeEach(() => {
    deleteBuilder = new DeleteQueryBuilder(mockDb as unknown as Database, 'users');
    vi.clearAllMocks();
  });

  describe('Query Building', () => {
    it('should build DELETE query', () => {
      const { sql, params } = deleteBuilder
        .where('id', '=', 1)
        .toSql();

      expect(sql).toBe('DELETE FROM users WHERE id = ?');
      expect(params).toEqual([1]);
    });

    it('should throw error when no WHERE clause provided', () => {
      expect(() => {
        deleteBuilder.toSql();
      }).toThrow('Delete query must have WHERE conditions');
    });
  });

  describe('Query Execution', () => {
    it('should execute delete query', async () => {
      mockDb.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const result = await deleteBuilder
        .where('id', '=', 1)
        .execute();

      expect(result.changes).toBe(1);
    });

    it('should handle delete errors', async () => {
      const error = new Error('Delete failed');
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(error);
      });

      await expect(
        deleteBuilder.where('id', '=', 1).execute()
      ).rejects.toThrow('Delete query failed: Delete failed');
    });
  });
});

describe('Query Builder Immutability', () => {
  let selectBuilder: SelectQueryBuilder;

  beforeEach(() => {
    selectBuilder = new SelectQueryBuilder(mockDb as unknown as Database, 'users');
  });

  it('should return new instances for chained methods', () => {
    const original = selectBuilder;
    const withWhere = original.where('id', '=', 1);
    const withOrder = withWhere.orderBy('name');

    expect(withWhere).not.toBe(original);
    expect(withOrder).not.toBe(withWhere);
    expect(withOrder).not.toBe(original);
  });

  it('should not modify original query when chaining', () => {
    const original = selectBuilder;
    const originalSql = original.toSql().sql;

    original.where('id', '=', 1).orderBy('name');

    expect(original.toSql().sql).toBe(originalSql);
  });
});