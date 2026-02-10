/**
 * ===============================================
 * USER SERVICE
 * ===============================================
 * @file server/services/user-service.ts
 *
 * Service for managing team member users.
 * Created as part of Phase 2 database normalization (Migration 068).
 *
 * This service provides helper functions for:
 * - Looking up user IDs from emails/names
 * - Creating new users
 * - Managing the transition from TEXT to INTEGER FK references
 */

import { getDatabase } from '../database/init.js';

// =====================================================
// TYPES
// =====================================================

export type UserRole = 'admin' | 'team_member' | 'contractor' | 'system';

export interface User {
  id: number;
  email: string;
  display_name: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  email: string;
  displayName: string;
  role?: UserRole;
  avatarUrl?: string;
}

// =====================================================
// SERVICE CLASS
// =====================================================

class UserService {
  // Cache for email -> id lookups (cleared on user changes)
  private emailCache: Map<string, number | null> = new Map();
  private nameCache: Map<string, number | null> = new Map();

  /**
   * Get user ID from email address.
   * Returns null if user not found.
   * Uses caching to minimize database lookups.
   */
  async getUserIdByEmail(email: string | null | undefined): Promise<number | null> {
    if (!email) return null;

    const normalizedEmail = email.toLowerCase().trim();

    // Check cache first
    if (this.emailCache.has(normalizedEmail)) {
      return this.emailCache.get(normalizedEmail) ?? null;
    }

    const db = await getDatabase();
    const user = await db.get(
      'SELECT id FROM users WHERE LOWER(email) = ?',
      [normalizedEmail]
    ) as { id: number } | undefined;

    const userId = user ? user.id : null;
    this.emailCache.set(normalizedEmail, userId);
    return userId;
  }

  /**
   * Get user ID from display name or email.
   * Tries email match first, then display name match.
   * Returns null if user not found.
   */
  async getUserIdByEmailOrName(identifier: string | null | undefined): Promise<number | null> {
    if (!identifier) return null;

    const normalized = identifier.trim();

    // If it looks like an email, try email lookup first
    if (normalized.includes('@')) {
      const userId = await this.getUserIdByEmail(normalized);
      if (userId) return userId;
    }

    // Check name cache
    const cacheKey = normalized.toLowerCase();
    if (this.nameCache.has(cacheKey)) {
      return this.nameCache.get(cacheKey) ?? null;
    }

    // Try display name match
    const db = await getDatabase();
    const user = await db.get(
      'SELECT id FROM users WHERE LOWER(display_name) = ? OR LOWER(email) = ?',
      [cacheKey, cacheKey]
    ) as { id: number } | undefined;

    const userId = user ? user.id : null;
    this.nameCache.set(cacheKey, userId);
    return userId;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<User | null> {
    const db = await getDatabase();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    return user ? this.mapUser(user) : null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const db = await getDatabase();
    const user = await db.get(
      'SELECT * FROM users WHERE LOWER(email) = ?',
      [email.toLowerCase().trim()]
    );
    return user ? this.mapUser(user) : null;
  }

  /**
   * Get all active users
   */
  async getActiveUsers(): Promise<User[]> {
    const db = await getDatabase();
    const users = await db.all(
      'SELECT * FROM users WHERE is_active = 1 ORDER BY display_name'
    );
    return users.map((u: any) => this.mapUser(u));
  }

  /**
   * Get all users (including inactive)
   */
  async getAllUsers(): Promise<User[]> {
    const db = await getDatabase();
    const users = await db.all('SELECT * FROM users ORDER BY display_name');
    return users.map((u: any) => this.mapUser(u));
  }

  /**
   * Create a new user
   */
  async createUser(data: CreateUserData): Promise<User> {
    const db = await getDatabase();

    const result = await db.run(
      `INSERT INTO users (email, display_name, role, avatar_url)
       VALUES (?, ?, ?, ?)`,
      [
        data.email.toLowerCase().trim(),
        data.displayName,
        data.role || 'team_member',
        data.avatarUrl || null
      ]
    );

    // Clear caches
    this.clearCache();

    const user = await this.getUserById(result.lastID!);
    if (!user) throw new Error('Failed to create user');
    return user;
  }

  /**
   * Create user if not exists, return existing if found
   */
  async getOrCreateUser(email: string, displayName?: string): Promise<User> {
    const existing = await this.getUserByEmail(email);
    if (existing) return existing;

    return this.createUser({
      email,
      displayName: displayName || email.split('@')[0],
      role: 'team_member'
    });
  }

  /**
   * Update user's last active timestamp
   */
  async updateLastActive(userId: number): Promise<void> {
    const db = await getDatabase();
    await db.run(
      'UPDATE users SET last_active_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );
  }

  /**
   * Deactivate a user
   */
  async deactivateUser(userId: number): Promise<void> {
    const db = await getDatabase();
    await db.run(
      'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );
    this.clearCache();
  }

  /**
   * Reactivate a user
   */
  async reactivateUser(userId: number): Promise<void> {
    const db = await getDatabase();
    await db.run(
      'UPDATE users SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );
    this.clearCache();
  }

  /**
   * Clear internal caches (call after user changes)
   */
  clearCache(): void {
    this.emailCache.clear();
    this.nameCache.clear();
  }

  /**
   * Map database row to User type
   */
  private mapUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      role: row.role as UserRole,
      avatar_url: row.avatar_url,
      is_active: Boolean(row.is_active),
      last_active_at: row.last_active_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  // =====================================================
  // TRANSITION HELPERS
  // =====================================================
  // These methods help during the TEXT -> INTEGER FK transition

  /**
   * Build SQL fragments for writing both TEXT and user_id columns.
   * Use during transition period to maintain backward compatibility.
   *
   * @example
   * const { columns, placeholders, values } = await userService.buildAssignedToParams(email);
   * // columns: 'assigned_to, assigned_to_user_id'
   * // placeholders: '?, ?'
   * // values: ['email@example.com', 5]
   */
  async buildAssignedToParams(
    email: string | null | undefined
  ): Promise<{ columns: string; placeholders: string; values: (string | number | null)[] }> {
    const userId = await this.getUserIdByEmail(email);
    return {
      columns: 'assigned_to, assigned_to_user_id',
      placeholders: '?, ?',
      values: [email || null, userId]
    };
  }

  /**
   * Get SET clause fragments for UPDATE statements
   *
   * @example
   * const { setClause, values } = await userService.buildAssignedToSet(email);
   * // setClause: 'assigned_to = ?, assigned_to_user_id = ?'
   * // values: ['email@example.com', 5]
   */
  async buildAssignedToSet(
    email: string | null | undefined
  ): Promise<{ setClause: string; values: (string | number | null)[] }> {
    const userId = await this.getUserIdByEmail(email);
    return {
      setClause: 'assigned_to = ?, assigned_to_user_id = ?',
      values: [email || null, userId]
    };
  }

  /**
   * Generic method for any TEXT/user_id column pair
   */
  async buildUserColumnSet(
    textColumn: string,
    userIdColumn: string,
    identifier: string | null | undefined
  ): Promise<{ setClause: string; values: (string | number | null)[] }> {
    const userId = await this.getUserIdByEmailOrName(identifier);
    return {
      setClause: `${textColumn} = ?, ${userIdColumn} = ?`,
      values: [identifier || null, userId]
    };
  }
}

// Export singleton instance
export const userService = new UserService();
