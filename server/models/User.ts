/**
 * ===============================================
 * USER MODEL
 * ===============================================
 * @file server/models/User.ts
 *
 * User model for authentication and user management.
 */

import { BaseModel } from '../database/model.js';
import bcrypt from 'bcryptjs';

export interface UserAttributes {
  id?: number;
  name: string;
  email: string;
  password: string;
  email_verified_at?: string | null;
  remember_token?: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export class User extends BaseModel<UserAttributes> {
  protected static config = {
    tableName: 'users',
    primaryKey: 'id',
    timestamps: true,
    softDeletes: false,
    fillable: ['name', 'email', 'password', 'role', 'is_active'],
    hidden: ['password', 'remember_token'],
    casts: {
      id: 'number' as const,
      is_active: 'boolean' as const,
      email_verified_at: 'date' as const,
      last_login_at: 'date' as const,
      created_at: 'date' as const,
      updated_at: 'date' as const
    }
  };

  // Accessor methods
  getId(): number | undefined {
    return this.get('id');
  }

  getName(): string {
    return this.get('name');
  }

  getEmail(): string {
    return this.get('email');
  }

  getRole(): 'admin' | 'user' {
    return this.get('role') || 'user';
  }

  isActive(): boolean {
    return this.get('is_active') || false;
  }

  isAdmin(): boolean {
    return this.getRole() === 'admin';
  }

  isEmailVerified(): boolean {
    return !!this.get('email_verified_at');
  }

  getLastLoginAt(): Date | null {
    const lastLogin = this.get('last_login_at');
    return lastLogin ? new Date(lastLogin) : null;
  }

  // Mutator methods
  setName(name: string): this {
    return this.set('name', name);
  }

  setEmail(email: string): this {
    return this.set('email', email.toLowerCase());
  }

  async setPassword(password: string): Promise<this> {
    const hashedPassword = await bcrypt.hash(password, 12);
    return this.set('password', hashedPassword);
  }

  setRole(role: 'admin' | 'user'): this {
    return this.set('role', role);
  }

  setActive(active: boolean): this {
    return this.set('is_active', active);
  }

  markEmailAsVerified(): this {
    return this.set('email_verified_at', new Date().toISOString());
  }

  updateLastLogin(): this {
    return this.set('last_login_at', new Date().toISOString());
  }

  // Authentication methods
  async verifyPassword(password: string): Promise<boolean> {
    const hashedPassword = this.get('password');
    if (!hashedPassword) {
      return false;
    }

    return await bcrypt.compare(password, hashedPassword);
  }

  generateRememberToken(): string {
    const token =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    this.set('remember_token', token);
    return token;
  }

  // Query scopes
  static async findByEmail(email: string): Promise<User | null> {
    return await this.query().where('email', '=', email.toLowerCase()).first();
  }

  static async findActive(): Promise<User[]> {
    const result = await this.query().where('is_active', '=', true).get();

    return result.rows.map((row) => {
      const user = new this();
      user.setAttributes(row as any, true);
      return user;
    });
  }

  static async findAdmins(): Promise<User[]> {
    const result = await this.query()
      .where('role', '=', 'admin')
      .where('is_active', '=', true)
      .get();

    return result.rows.map((row) => {
      const user = new this();
      user.setAttributes(row as any, true);
      return user;
    });
  }

  static async findByRememberToken(token: string): Promise<User | null> {
    return await this.query()
      .where('remember_token', '=', token)
      .where('is_active', '=', true)
      .first();
  }

  // Validation
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[@$!%*?&]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Override save to handle password hashing
  async save(): Promise<boolean> {
    // Hash password if it's being set and not already hashed
    const password = this.get('password');
    if (password && !password.startsWith('$2')) {
      await this.setPassword(password);
    }

    return super.save();
  }
}
