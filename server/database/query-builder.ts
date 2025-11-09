/**
 * ===============================================
 * DATABASE QUERY BUILDER
 * ===============================================
 * @file server/database/query-builder.ts
 * 
 * Fluent, type-safe database query builder for SQLite.
 * Provides a clean API for building and executing database queries.
 */

import { Database } from 'sqlite3';
import { logger } from '../services/logger.js';

// Type definitions
export type WhereOperator = '=' | '!=' | '<' | '<=' | '>' | '>=' | 'LIKE' | 'NOT LIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL';
export type OrderDirection = 'ASC' | 'DESC';
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

export interface WhereCondition {
  column: string;
  operator: WhereOperator;
  value?: any;
  logical?: 'AND' | 'OR';
}

export interface JoinCondition {
  type: JoinType;
  table: string;
  on: string;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  executionTime: number;
  sql: string;
  params: any[];
}

/**
 * Base query builder class
 */
export abstract class BaseQueryBuilder<T = any> {
  protected db: Database;
  protected tableName: string;
  protected selectColumns: string[] = ['*'];
  protected whereConditions: WhereCondition[] = [];
  protected joinConditions: JoinCondition[] = [];
  protected orderByColumns: Array<{ column: string; direction: OrderDirection }> = [];
  protected groupByColumns: string[] = [];
  protected havingConditions: WhereCondition[] = [];
  protected limitValue?: number;
  protected offsetValue?: number;
  protected distinctValue: boolean = false;

  constructor(db: Database, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  /**
   * Clone the current query builder
   */
  protected clone(): this {
    const cloned = Object.create(Object.getPrototypeOf(this));
    Object.assign(cloned, this);
    
    // Deep copy arrays
    cloned.selectColumns = [...this.selectColumns];
    cloned.whereConditions = [...this.whereConditions];
    cloned.joinConditions = [...this.joinConditions];
    cloned.orderByColumns = [...this.orderByColumns];
    cloned.groupByColumns = [...this.groupByColumns];
    cloned.havingConditions = [...this.havingConditions];

    return cloned;
  }

  /**
   * Select specific columns
   */
  select(...columns: string[]): this {
    const cloned = this.clone();
    cloned.selectColumns = columns.length > 0 ? columns : ['*'];
    return cloned;
  }

  /**
   * Add DISTINCT clause
   */
  distinct(): this {
    const cloned = this.clone();
    cloned.distinctValue = true;
    return cloned;
  }

  /**
   * Add WHERE condition
   */
  where(column: string, operator: WhereOperator, value?: any): this {
    const cloned = this.clone();
    cloned.whereConditions.push({ column, operator, value, logical: 'AND' });
    return cloned;
  }

  /**
   * Add OR WHERE condition
   */
  orWhere(column: string, operator: WhereOperator, value?: any): this {
    const cloned = this.clone();
    cloned.whereConditions.push({ column, operator, value, logical: 'OR' });
    return cloned;
  }

  /**
   * Add WHERE IN condition
   */
  whereIn(column: string, values: any[]): this {
    return this.where(column, 'IN', values);
  }

  /**
   * Add WHERE NOT IN condition
   */
  whereNotIn(column: string, values: any[]): this {
    return this.where(column, 'NOT IN', values);
  }

  /**
   * Add WHERE NULL condition
   */
  whereNull(column: string): this {
    return this.where(column, 'IS NULL');
  }

  /**
   * Add WHERE NOT NULL condition
   */
  whereNotNull(column: string): this {
    return this.where(column, 'IS NOT NULL');
  }

  /**
   * Add LIKE condition
   */
  whereLike(column: string, pattern: string): this {
    return this.where(column, 'LIKE', pattern);
  }

  /**
   * Add JOIN clause
   */
  join(table: string, on: string, type: JoinType = 'INNER'): this {
    const cloned = this.clone();
    cloned.joinConditions.push({ type, table, on });
    return cloned;
  }

  /**
   * Add LEFT JOIN clause
   */
  leftJoin(table: string, on: string): this {
    return this.join(table, on, 'LEFT');
  }

  /**
   * Add RIGHT JOIN clause
   */
  rightJoin(table: string, on: string): this {
    return this.join(table, on, 'RIGHT');
  }

  /**
   * Add ORDER BY clause
   */
  orderBy(column: string, direction: OrderDirection = 'ASC'): this {
    const cloned = this.clone();
    cloned.orderByColumns.push({ column, direction });
    return cloned;
  }

  /**
   * Add GROUP BY clause
   */
  groupBy(...columns: string[]): this {
    const cloned = this.clone();
    cloned.groupByColumns = [...cloned.groupByColumns, ...columns];
    return cloned;
  }

  /**
   * Add HAVING clause
   */
  having(column: string, operator: WhereOperator, value?: any): this {
    const cloned = this.clone();
    cloned.havingConditions.push({ column, operator, value, logical: 'AND' });
    return cloned;
  }

  /**
   * Add LIMIT clause
   */
  limit(count: number): this {
    const cloned = this.clone();
    cloned.limitValue = count;
    return cloned;
  }

  /**
   * Add OFFSET clause
   */
  offset(count: number): this {
    const cloned = this.clone();
    cloned.offsetValue = count;
    return cloned;
  }

  /**
   * Pagination helper (for building queries)
   * Note: SelectQueryBuilder overrides this to execute and return results
   */
  protected paginateBuilder(page: number, perPage: number): this {
    const offset = (page - 1) * perPage;
    return this.limit(perPage).offset(offset);
  }

  /**
   * Build WHERE clause SQL
   */
  protected buildWhereClause(conditions: WhereCondition[]): { sql: string; params: any[] } {
    if (conditions.length === 0) {
      return { sql: '', params: [] };
    }

    let sql = ' WHERE ';
    const params: any[] = [];
    
    conditions.forEach((condition, index) => {
      if (index > 0) {
        sql += ` ${condition.logical} `;
      }

      if (condition.operator === 'IS NULL' || condition.operator === 'IS NOT NULL') {
        sql += `${condition.column} ${condition.operator}`;
      } else if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
        const placeholders = Array(condition.value.length).fill('?').join(', ');
        sql += `${condition.column} ${condition.operator} (${placeholders})`;
        params.push(...condition.value);
      } else {
        sql += `${condition.column} ${condition.operator} ?`;
        params.push(condition.value);
      }
    });

    return { sql, params };
  }

  /**
   * Build JOIN clause SQL
   */
  protected buildJoinClause(): string {
    if (this.joinConditions.length === 0) {
      return '';
    }

    return this.joinConditions
      .map(join => ` ${join.type} JOIN ${join.table} ON ${join.on}`)
      .join('');
  }

  /**
   * Build ORDER BY clause SQL
   */
  protected buildOrderByClause(): string {
    if (this.orderByColumns.length === 0) {
      return '';
    }

    const orderBy = this.orderByColumns
      .map(order => `${order.column} ${order.direction}`)
      .join(', ');

    return ` ORDER BY ${orderBy}`;
  }

  /**
   * Build GROUP BY clause SQL
   */
  protected buildGroupByClause(): string {
    if (this.groupByColumns.length === 0) {
      return '';
    }

    return ` GROUP BY ${this.groupByColumns.join(', ')}`;
  }

  /**
   * Build HAVING clause SQL
   */
  protected buildHavingClause(): { sql: string; params: any[] } {
    if (this.havingConditions.length === 0) {
      return { sql: '', params: [] };
    }

    let sql = ' HAVING ';
    const params: any[] = [];
    
    this.havingConditions.forEach((condition, index) => {
      if (index > 0) {
        sql += ` ${condition.logical} `;
      }

      if (condition.operator === 'IS NULL' || condition.operator === 'IS NOT NULL') {
        sql += `${condition.column} ${condition.operator}`;
      } else {
        sql += `${condition.column} ${condition.operator} ?`;
        params.push(condition.value);
      }
    });

    return { sql, params };
  }

  /**
   * Build LIMIT/OFFSET clause SQL
   */
  protected buildLimitClause(): string {
    let sql = '';

    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return sql;
  }

  /**
   * Execute query with error handling and logging
   */
  protected async executeQuery<R = T>(sql: string, params: any[] = []): Promise<QueryResult<R>> {
    const startTime = Date.now();
    
    try {
      await logger.debug('Executing database query');

      const rows = await new Promise<R[]>((resolve, reject) => {
        this.db.all(sql, params, (error, rows) => {
          if (error) {
            reject(error);
          } else {
            resolve(rows as R[]);
          }
        });
      });

      const executionTime = Date.now() - startTime;

      await logger.debug('Database query completed');

      return {
        rows,
        rowCount: rows.length,
        executionTime,
        sql,
        params
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      const err = error as Error;
      await logger.error('Database query failed', {
        message: err.message
      });

      throw new Error(`Database query failed: ${err.message}`);
    }
  }

  /**
   * Execute a single row query
   */
  protected async executeQuerySingle<R = T>(sql: string, params: any[] = []): Promise<R | null> {
    const startTime = Date.now();
    
    try {
      await logger.debug('Executing single row query');

      const row = await new Promise<R | null>((resolve, reject) => {
        this.db.get(sql, params, (error, row) => {
          if (error) {
            reject(error);
          } else {
            resolve(row as R || null);
          }
        });
      });

      const executionTime = Date.now() - startTime;

      await logger.debug('Single row query completed');

      return row;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      const err = error as Error;
      await logger.error('Single row query failed', {
        message: err.message
      });

      throw new Error(`Database query failed: ${err.message}`);
    }
  }
}

/**
 * Select query builder
 */
export class SelectQueryBuilder<T = any> extends BaseQueryBuilder<T> {
  /**
   * Build and return the SELECT SQL query
   */
  toSql(): { sql: string; params: any[] } {
    const columns = this.distinctValue ? `DISTINCT ${this.selectColumns.join(', ')}` : this.selectColumns.join(', ');
    let sql = `SELECT ${columns} FROM ${this.tableName}`;

    sql += this.buildJoinClause();

    const whereClause = this.buildWhereClause(this.whereConditions);
    sql += whereClause.sql;

    sql += this.buildGroupByClause();

    const havingClause = this.buildHavingClause();
    sql += havingClause.sql;

    sql += this.buildOrderByClause();
    sql += this.buildLimitClause();

    return {
      sql,
      params: [...whereClause.params, ...havingClause.params]
    };
  }

  /**
   * Execute the query and return all results
   */
  async get(): Promise<QueryResult<T>> {
    const { sql, params } = this.toSql();
    return this.executeQuery<T>(sql, params);
  }

  /**
   * Execute the query and return the first result
   */
  async first(): Promise<T | null> {
    const { sql, params } = this.limit(1).toSql();
    return this.executeQuerySingle<T>(sql, params);
  }

  /**
   * Execute the query and return count
   */
  async count(column: string = '*'): Promise<number> {
    const countQuery = this.clone();
    countQuery.selectColumns = [`COUNT(${column}) as count`];
    countQuery.orderByColumns = [];
    countQuery.limitValue = undefined;
    countQuery.offsetValue = undefined;

    const { sql, params } = countQuery.toSql();
    const result = await this.executeQuerySingle<{ count: number }>(sql, params);
    return result?.count || 0;
  }

  /**
   * Check if any rows exist
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  /**
   * Execute paginated query (overrides base paginate to return results)
   */
  async paginate(page: number, perPage: number): Promise<{
    data: T[];
    pagination: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    // Get total count
    const total = await this.count();
    const totalPages = Math.ceil(total / perPage);

    // Build and execute paginated query using base class logic
    const offset = (page - 1) * perPage;
    const result = await this.limit(perPage).offset(offset).get();

    return {
      data: result.rows,
      pagination: {
        page,
        perPage,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get paginated results (alias for paginate for backward compatibility)
   */
  async getPaginated(page: number = 1, perPage: number = 15): Promise<{
    data: T[];
    pagination: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return this.paginate(page, perPage);
  }
}

/**
 * Insert query builder
 */
export class InsertQueryBuilder<T = any> extends BaseQueryBuilder<T> {
  private insertData: Record<string, any>[] = [];
  private conflictAction: 'IGNORE' | 'REPLACE' | null = null;

  /**
   * Set data to insert
   */
  values(data: Record<string, any> | Record<string, any>[]): this {
    const cloned = this.clone();
    cloned.insertData = Array.isArray(data) ? data : [data];
    return cloned;
  }

  /**
   * Add ON CONFLICT IGNORE
   */
  ignore(): this {
    const cloned = this.clone();
    cloned.conflictAction = 'IGNORE';
    return cloned;
  }

  /**
   * Add ON CONFLICT REPLACE
   */
  replace(): this {
    const cloned = this.clone();
    cloned.conflictAction = 'REPLACE';
    return cloned;
  }

  /**
   * Build INSERT SQL
   */
  toSql(): { sql: string; params: any[] } {
    if (this.insertData.length === 0) {
      throw new Error('No data provided for insert');
    }

    const columns = Object.keys(this.insertData[0]);
    const placeholders = columns.map(() => '?').join(', ');
    
    let sql = `INSERT`;
    
    if (this.conflictAction === 'IGNORE') {
      sql += ' OR IGNORE';
    } else if (this.conflictAction === 'REPLACE') {
      sql += ' OR REPLACE';
    }

    sql += ` INTO ${this.tableName} (${columns.join(', ')}) VALUES `;

    const valueGroups = this.insertData.map(() => `(${placeholders})`);
    sql += valueGroups.join(', ');

    const params = this.insertData.flatMap(row => columns.map(col => row[col]));

    return { sql, params };
  }

  /**
   * Execute the insert query
   */
  async execute(): Promise<{ insertId: number; changes: number }> {
    const { sql, params } = this.toSql();
    const startTime = Date.now();

    try {
      await logger.debug('Executing insert query');

      const result = await new Promise<{ insertId: number; changes: number }>((resolve, reject) => {
        this.db.run(sql, params, function(error) {
          if (error) {
            reject(error);
          } else {
            resolve({
              insertId: this.lastID,
              changes: this.changes
            });
          }
        });
      });

      const executionTime = Date.now() - startTime;

      await logger.debug('Insert query completed');

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      const err = error as Error;
      await logger.error('Insert query failed', {
        message: err.message
      });

      throw new Error(`Insert query failed: ${err.message}`);
    }
  }
}

/**
 * Update query builder
 */
export class UpdateQueryBuilder<T = any> extends BaseQueryBuilder<T> {
  private updateData: Record<string, any> = {};

  /**
   * Set data to update
   */
  set(data: Record<string, any>): this;
  set(column: string, value: any): this;
  set(columnOrData: string | Record<string, any>, value?: any): this {
    const cloned = this.clone();
    
    if (typeof columnOrData === 'string') {
      cloned.updateData = { ...cloned.updateData, [columnOrData]: value };
    } else {
      cloned.updateData = { ...cloned.updateData, ...columnOrData };
    }
    
    return cloned;
  }

  /**
   * Increment a column value
   */
  increment(column: string, amount: number = 1): this {
    const cloned = this.clone();
    cloned.updateData = { ...cloned.updateData, [column]: `${column} + ${amount}` };
    return cloned;
  }

  /**
   * Decrement a column value
   */
  decrement(column: string, amount: number = 1): this {
    const cloned = this.clone();
    cloned.updateData = { ...cloned.updateData, [column]: `${column} - ${amount}` };
    return cloned;
  }

  /**
   * Build UPDATE SQL
   */
  toSql(): { sql: string; params: any[] } {
    if (Object.keys(this.updateData).length === 0) {
      throw new Error('No data provided for update');
    }

    if (this.whereConditions.length === 0) {
      throw new Error('Update query must have WHERE conditions');
    }

    const setClause = Object.keys(this.updateData)
      .map(column => `${column} = ?`)
      .join(', ');

    let sql = `UPDATE ${this.tableName} SET ${setClause}`;

    const whereClause = this.buildWhereClause(this.whereConditions);
    sql += whereClause.sql;

    const updateParams = Object.values(this.updateData);

    return {
      sql,
      params: [...updateParams, ...whereClause.params]
    };
  }

  /**
   * Execute the update query
   */
  async execute(): Promise<{ changes: number }> {
    const { sql, params } = this.toSql();
    const startTime = Date.now();

    try {
      await logger.debug('Executing update query');

      const result = await new Promise<{ changes: number }>((resolve, reject) => {
        this.db.run(sql, params, function(error) {
          if (error) {
            reject(error);
          } else {
            resolve({ changes: this.changes });
          }
        });
      });

      const executionTime = Date.now() - startTime;

      await logger.debug('Update query completed');

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      const err = error as Error;
      await logger.error('Update query failed', {
        message: err.message
      });

      throw new Error(`Update query failed: ${err.message}`);
    }
  }
}

/**
 * Delete query builder
 */
export class DeleteQueryBuilder<T = any> extends BaseQueryBuilder<T> {
  /**
   * Build DELETE SQL
   */
  toSql(): { sql: string; params: any[] } {
    if (this.whereConditions.length === 0) {
      throw new Error('Delete query must have WHERE conditions');
    }

    let sql = `DELETE FROM ${this.tableName}`;

    const whereClause = this.buildWhereClause(this.whereConditions);
    sql += whereClause.sql;

    return {
      sql,
      params: whereClause.params
    };
  }

  /**
   * Execute the delete query
   */
  async execute(): Promise<{ changes: number }> {
    const { sql, params } = this.toSql();
    const startTime = Date.now();

    try {
      await logger.debug('Executing delete query');

      const result = await new Promise<{ changes: number }>((resolve, reject) => {
        this.db.run(sql, params, function(error) {
          if (error) {
            reject(error);
          } else {
            resolve({ changes: this.changes });
          }
        });
      });

      const executionTime = Date.now() - startTime;

      await logger.debug('Delete query completed');

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      const err = error as Error;
      await logger.error('Delete query failed', {
        message: err.message
      });

      throw new Error(`Delete query failed: ${err.message}`);
    }
  }
}

/**
 * Main query builder factory
 */
export class QueryBuilder {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Create a SELECT query
   */
  select<T = any>(table: string): SelectQueryBuilder<T> {
    return new SelectQueryBuilder<T>(this.db, table);
  }

  /**
   * Create an INSERT query
   */
  insert<T = any>(table: string): InsertQueryBuilder<T> {
    return new InsertQueryBuilder<T>(this.db, table);
  }

  /**
   * Create an UPDATE query
   */
  update<T = any>(table: string): UpdateQueryBuilder<T> {
    return new UpdateQueryBuilder<T>(this.db, table);
  }

  /**
   * Create a DELETE query
   */
  delete<T = any>(table: string): DeleteQueryBuilder<T> {
    return new DeleteQueryBuilder<T>(this.db, table);
  }

  /**
   * Execute raw SQL query
   */
  async raw<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    const startTime = Date.now();

    try {
      await logger.debug('Executing raw SQL query');

      const rows = await new Promise<T[]>((resolve, reject) => {
        this.db.all(sql, params, (error, rows) => {
          if (error) {
            reject(error);
          } else {
            resolve(rows as T[]);
          }
        });
      });

      const executionTime = Date.now() - startTime;

      await logger.debug('Raw SQL query completed');

      return {
        rows,
        rowCount: rows.length,
        executionTime,
        sql,
        params
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      const err = error as Error;
      await logger.error('Database query failed', {
        message: err.message
      });

      throw new Error(`Database query failed: ${err.message}`);
    }
  }

  /**
   * Start a transaction
   */
  async transaction<T>(callback: (qb: QueryBuilder) => Promise<T>): Promise<T> {
    await this.raw('BEGIN TRANSACTION');

    try {
      const result = await callback(this);
      await this.raw('COMMIT');
      return result;
    } catch (error) {
      await this.raw('ROLLBACK');
      const err = error as Error;
      throw err;
    }
  }
}

// Export factory function
export function createQueryBuilder(db: Database): QueryBuilder {
  return new QueryBuilder(db);
}