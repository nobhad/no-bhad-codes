/**
 * ===============================================
 * DATABASE MODEL BASE CLASS
 * ===============================================
 * @file server/database/model.ts
 *
 * Base model class providing Active Record pattern functionality
 * with the query builder integration.
 */

import { Database } from 'sqlite3';
import {
  QueryBuilder,
  SelectQueryBuilder,
  InsertQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
  QueryResult
} from './query-builder.js';
import { logger } from '../services/logger.js';

// Model configuration interface
export interface ModelConfig {
  tableName: string;
  primaryKey?: string;
  timestamps?: boolean;
  softDeletes?: boolean;
  fillable?: string[];
  hidden?: string[];
  casts?: Record<string, 'string' | 'number' | 'boolean' | 'date' | 'json'>;
}

// Pagination result interface
export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Base Model class providing Active Record pattern
 */
export class BaseModel<T = any> {
  protected static db: Database;
  protected static queryBuilder: QueryBuilder;

  // Model configuration
  protected static config: ModelConfig = {
    tableName: '',
    primaryKey: 'id',
    timestamps: true,
    softDeletes: false,
    fillable: [],
    hidden: [],
    casts: {}
  };

  // Instance properties
  protected attributes: Record<string, any> = {};
  protected original: Record<string, any> = {};
  protected exists: boolean = false;

  constructor(attributes: Record<string, any> = {}) {
    this.fill(attributes);
  }

  /**
   * Initialize the model class with database connection
   */
  static initialize(db: Database): void {
    this.db = db;
    this.queryBuilder = new QueryBuilder(db);
  }

  /**
   * Get the table name for this model
   */
  static getTableName(): string {
    return this.config.tableName;
  }

  /**
   * Get the primary key column name
   */
  static getPrimaryKey(): string {
    return this.config.primaryKey || 'id';
  }

  /**
   * Create a new select query
   */
  static query<M extends BaseModel>(this: typeof BaseModel & (new () => M)): SelectQueryBuilder<M> {
    return this.queryBuilder.select((this as any).getTableName()) as SelectQueryBuilder<M>;
  }

  /**
   * Find a record by primary key
   */
  static async find<M extends BaseModel>(
    this: typeof BaseModel & (new () => M),
    id: any
  ): Promise<M | null> {
    const result = await (this as any)
      .query()
      .where((this as any).getPrimaryKey(), '=', id)
      .first();

    if (!result) {
      return null;
    }

    const instance = new this() as M;
    instance.setAttributes(result as any, true);
    return instance;
  }

  /**
   * Find a record by primary key or throw error
   */
  static async findOrFail<M extends BaseModel>(
    this: typeof BaseModel & (new () => M),
    id: any
  ): Promise<M> {
    const result = await (this as any).find(id);
    if (!result) {
      throw new Error(`Record with ${(this as any).getPrimaryKey()} ${id} not found`);
    }
    return result;
  }

  /**
   * Find records by conditions
   */
  static async where<M extends BaseModel>(
    this: typeof BaseModel & (new () => M),
    column: string,
    operator: any,
    value?: any
  ): Promise<SelectQueryBuilder<M>> {
    return (this as any).query().where(column, operator, value);
  }

  /**
   * Get all records
   */
  static async all<M extends BaseModel>(this: typeof BaseModel & (new () => M)): Promise<M[]> {
    const result = await (this as any).query().get();
    return result.rows.map((row: any) => {
      const instance = new this() as M;
      instance.setAttributes(row as any, true);
      return instance;
    });
  }

  /**
   * Get first record
   */
  static async first<M extends BaseModel>(
    this: typeof BaseModel & (new () => M)
  ): Promise<M | null> {
    const result = await (this as any).query().first();
    if (!result) {
      return null;
    }

    const instance = new this() as M;
    instance.setAttributes(result as any, true);
    return instance;
  }

  /**
   * Create a new record
   */
  static async create<M extends BaseModel>(
    this: typeof BaseModel & (new () => M),
    attributes: Record<string, any>
  ): Promise<M> {
    const instance = new this(attributes) as M;
    await instance.save();
    return instance;
  }

  /**
   * Update records matching conditions
   */
  static async updateWhere(
    conditions: Record<string, any>,
    updates: Record<string, any>
  ): Promise<number> {
    let query = this.queryBuilder.update(this.getTableName());

    // Add WHERE conditions
    Object.entries(conditions).forEach(([column, value]) => {
      query = query.where(column, '=', value);
    });

    // Add timestamps if enabled
    if (this.config.timestamps) {
      updates.updated_at = new Date().toISOString();
    }

    const result = await query.set(updates).execute();
    return result.changes;
  }

  /**
   * Delete records matching conditions
   */
  static async deleteWhere(conditions: Record<string, any>): Promise<number> {
    let query = this.queryBuilder.delete(this.getTableName());

    Object.entries(conditions).forEach(([column, value]) => {
      query = query.where(column, '=', value);
    });

    const result = await query.execute();
    return result.changes;
  }

  /**
   * Get count of records
   */
  static async count(column: string = '*'): Promise<number> {
    return await this.query().count(column);
  }

  /**
   * Check if records exist
   */
  static async exists(): Promise<boolean> {
    return await this.query().exists();
  }

  /**
   * Get paginated results
   */
  static async paginate<M extends BaseModel>(
    this: typeof BaseModel & (new () => M),
    page: number = 1,
    perPage: number = 15
  ): Promise<PaginationResult<M>> {
    const result = await (this as any).query().getPaginated(page, perPage);

    return {
      data: result.data.map((row: any) => {
        const instance = new this() as M;
        instance.setAttributes(row as any, true);
        return instance;
      }),
      pagination: result.pagination
    };
  }

  /**
   * Begin a database transaction
   */
  static async transaction<R>(callback: (qb: QueryBuilder) => Promise<R>): Promise<R> {
    return await this.queryBuilder.transaction(callback);
  }

  /**
   * Execute raw SQL
   */
  static async raw<R = any>(sql: string, params: any[] = []): Promise<QueryResult<R>> {
    return await this.queryBuilder.raw<R>(sql, params);
  }

  /**
   * Fill the model with attributes
   */
  fill(attributes: Record<string, any>): this {
    const fillable = (this.constructor as typeof BaseModel).config.fillable || [];

    Object.entries(attributes).forEach(([key, value]) => {
      if (fillable.length === 0 || fillable.includes(key)) {
        this.attributes[key] = this.castAttribute(key, value);
      }
    });

    return this;
  }

  /**
   * Set attributes (bypass fillable check)
   */
  setAttributes(attributes: Record<string, any>, fromDatabase: boolean = false): this {
    this.attributes = { ...attributes };

    if (fromDatabase) {
      this.original = { ...attributes };
      this.exists = true;
    }

    // Apply casts
    const casts = (this.constructor as typeof BaseModel).config.casts || {};
    Object.entries(casts).forEach(([key, type]) => {
      if (this.attributes[key] !== undefined) {
        this.attributes[key] = this.castAttribute(key, this.attributes[key]);
      }
    });

    return this;
  }

  /**
   * Cast an attribute to the specified type
   */
  protected castAttribute(key: string, value: any): any {
    const casts = (this.constructor as typeof BaseModel).config.casts || {};
    const castType = casts[key];

    if (!castType || value === null || value === undefined) {
      return value;
    }

    switch (castType) {
    case 'string':
      return String(value);
    case 'number':
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'date':
      return value instanceof Date ? value : new Date(value);
    case 'json':
      return typeof value === 'string' ? JSON.parse(value) : value;
    default:
      return value;
    }
  }

  /**
   * Get an attribute value
   */
  get(key: string): any {
    return this.attributes[key];
  }

  /**
   * Set an attribute value
   */
  set(key: string, value: any): this {
    this.attributes[key] = this.castAttribute(key, value);
    return this;
  }

  /**
   * Get the primary key value
   */
  getKey(): any {
    const primaryKey = (this.constructor as typeof BaseModel).getPrimaryKey();
    return this.attributes[primaryKey];
  }

  /**
   * Set the primary key value
   */
  setKey(value: any): this {
    const primaryKey = (this.constructor as typeof BaseModel).getPrimaryKey();
    this.attributes[primaryKey] = value;
    return this;
  }

  /**
   * Check if the model exists in the database
   */
  isExists(): boolean {
    return this.exists;
  }

  /**
   * Get all attributes
   */
  getAttributes(): Record<string, any> {
    const hidden = (this.constructor as typeof BaseModel).config.hidden || [];

    if (hidden.length === 0) {
      return { ...this.attributes };
    }

    const result: Record<string, any> = {};
    Object.entries(this.attributes).forEach(([key, value]) => {
      if (!hidden.includes(key)) {
        result[key] = value;
      }
    });

    return result;
  }

  /**
   * Get changed attributes
   */
  getDirty(): Record<string, any> {
    const dirty: Record<string, any> = {};

    Object.entries(this.attributes).forEach(([key, value]) => {
      if (JSON.stringify(value) !== JSON.stringify(this.original[key])) {
        dirty[key] = value;
      }
    });

    return dirty;
  }

  /**
   * Check if model has been modified
   */
  isDirty(): boolean {
    return Object.keys(this.getDirty()).length > 0;
  }

  /**
   * Save the model to the database
   */
  async save(): Promise<boolean> {
    try {
      const config = (this.constructor as typeof BaseModel).config;

      if (this.exists) {
        // Update existing record
        const dirty = this.getDirty();

        if (Object.keys(dirty).length === 0) {
          return true; // No changes to save
        }

        // Add timestamps
        if (config.timestamps) {
          dirty.updated_at = new Date().toISOString();
        }

        const primaryKey = (this.constructor as typeof BaseModel).getPrimaryKey();
        const result = await (this.constructor as typeof BaseModel).queryBuilder
          .update((this.constructor as typeof BaseModel).getTableName())
          .set(dirty)
          .where(primaryKey, '=', this.getKey())
          .execute();

        if (result.changes > 0) {
          // Update original attributes
          this.original = { ...this.attributes };
          return true;
        }

        return false;
      }
      // Create new record
      const insertData = { ...this.attributes };

      // Add timestamps
      if (config.timestamps) {
        const now = new Date().toISOString();
        insertData.created_at = now;
        insertData.updated_at = now;
      }

      const result = await (this.constructor as typeof BaseModel).queryBuilder
        .insert((this.constructor as typeof BaseModel).getTableName())
        .values(insertData)
        .execute();

      if (result.insertId) {
        this.setKey(result.insertId);
        this.exists = true;
        this.original = { ...this.attributes };
        return true;
      }

      return false;

    } catch (error) {
      const err = error as Error;
      await logger.error('Model save failed');

      throw new Error(`Failed to save model: ${err.message}`);
    }
  }

  /**
   * Delete the model from the database
   */
  async delete(): Promise<boolean> {
    try {
      const config = (this.constructor as typeof BaseModel).config;
      const primaryKey = (this.constructor as typeof BaseModel).getPrimaryKey();

      if (!this.exists) {
        return false;
      }

      if (config.softDeletes) {
        // Soft delete - just set deleted_at
        this.set('deleted_at', new Date().toISOString());
        return await this.save();
      }
      // Hard delete
      const result = await (this.constructor as typeof BaseModel).queryBuilder
        .delete((this.constructor as typeof BaseModel).getTableName())
        .where(primaryKey, '=', this.getKey())
        .execute();

      if (result.changes > 0) {
        this.exists = false;
        return true;
      }

      return false;

    } catch (error) {
      const err = error as Error;
      await logger.error('Model delete failed');

      throw new Error(`Failed to delete model: ${err.message}`);
    }
  }

  /**
   * Reload the model from the database
   */
  async refresh(): Promise<this> {
    if (!this.exists) {
      throw new Error('Cannot refresh model that does not exist in database');
    }

    const primaryKey = (this.constructor as typeof BaseModel).getPrimaryKey();
    const fresh = await (this.constructor as any).find(this.getKey());

    if (!fresh) {
      throw new Error('Model not found when refreshing');
    }

    this.setAttributes((fresh as any).attributes, true);
    return this;
  }

  /**
   * Convert model to JSON
   */
  toJSON(): Record<string, any> {
    return this.getAttributes();
  }

  /**
   * Convert model to string
   */
  toString(): string {
    return JSON.stringify(this.toJSON());
  }
}
