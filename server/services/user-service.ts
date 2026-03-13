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

import { getDatabase, type DatabaseRow } from '../database/init.js';
import { getString, getNumber, getBoolean } from '../database/row-helpers.js';

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

/** Shape returned by findClientByEmail */
export interface ClientLoginRow {
  id: number;
  email: string;
  passwordHash: string;
  companyName: string;
  contactName: string;
  status: string;
  isAdmin: boolean;
  lastLogin: unknown;
  failedLoginAttempts: number;
  lockedUntil: string;
}

/** Shape returned by findActiveClientByEmail (magic-link) */
export interface ClientMagicLinkRow {
  id: number;
  email: string;
  contactName: string;
}

/** Shape returned by findClientByMagicToken */
export interface ClientMagicTokenRow {
  id: number;
  email: string;
  contactName: string;
  companyName: string;
  status: string;
  isAdmin: boolean;
  magicLinkExpiresAt: string;
}

/** Shape returned by getSystemSetting */
export interface SystemSettingRow {
  settingValue: string;
}

/** Database row shape returned from the users table */
interface UserRow {
  id: number;
  email: string;
  display_name: string;
  role: string;
  avatar_url: string | null;
  is_active: number | boolean;
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
// COLUMN CONSTANTS - Explicit column lists for SELECT queries
// =====================================================

const USER_COLUMNS = `
  id, email, display_name, role, avatar_url, is_active, last_active_at, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

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
    const user = (await db.get('SELECT id FROM users WHERE LOWER(email) = ?', [
      normalizedEmail
    ])) as { id: number } | undefined;

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
    const user = (await db.get(
      'SELECT id FROM users WHERE LOWER(display_name) = ? OR LOWER(email) = ?',
      [cacheKey, cacheKey]
    )) as { id: number } | undefined;

    const userId = user ? user.id : null;
    this.nameCache.set(cacheKey, userId);
    return userId;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<User | null> {
    const db = await getDatabase();
    const user = await db.get(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
    return user ? this.mapUser(user) : null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const db = await getDatabase();
    const user = await db.get(`SELECT ${USER_COLUMNS} FROM users WHERE LOWER(email) = ?`, [
      email.toLowerCase().trim()
    ]);
    return user ? this.mapUser(user) : null;
  }

  /**
   * Get all active users
   */
  async getActiveUsers(): Promise<User[]> {
    const db = await getDatabase();
    const users = await db.all(`SELECT ${USER_COLUMNS} FROM users WHERE is_active = 1 ORDER BY display_name`);
    return users.map((u: UserRow) => this.mapUser(u));
  }

  /**
   * Get all users (including inactive)
   */
  async getAllUsers(): Promise<User[]> {
    const db = await getDatabase();
    const users = await db.all(`SELECT ${USER_COLUMNS} FROM users ORDER BY display_name`);
    return users.map((u: UserRow) => this.mapUser(u));
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
    await db.run('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      userId
    ]);
    this.clearCache();
  }

  /**
   * Reactivate a user
   */
  async reactivateUser(userId: number): Promise<void> {
    const db = await getDatabase();
    await db.run('UPDATE users SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      userId
    ]);
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
  private mapUser(row: UserRow): User {
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
  // CLIENT AUTH HELPERS
  // =====================================================

  /**
   * Find a client by email for login (includes lockout columns).
   * Returns null if not found or soft-deleted.
   */
  async findClientByEmail(email: string): Promise<ClientLoginRow | null> {
    const db = await getDatabase();
    const row = await db.get(
      'SELECT id, email, password_hash, company_name, contact_name, status, is_admin, last_login, failed_login_attempts, locked_until FROM clients WHERE email = ? AND deleted_at IS NULL',
      [email.toLowerCase()]
    ) as DatabaseRow | undefined;

    if (!row) return null;

    return {
      id: getNumber(row, 'id'),
      email: getString(row, 'email'),
      passwordHash: getString(row, 'password_hash'),
      companyName: getString(row, 'company_name'),
      contactName: getString(row, 'contact_name'),
      status: getString(row, 'status'),
      isAdmin: getBoolean(row, 'is_admin'),
      lastLogin: row.last_login,
      failedLoginAttempts: getNumber(row, 'failed_login_attempts') || 0,
      lockedUntil: getString(row, 'locked_until')
    };
  }

  /**
   * Find an active client by email (for magic link requests).
   */
  async findActiveClientByEmail(email: string): Promise<ClientMagicLinkRow | null> {
    const db = await getDatabase();
    const row = await db.get(
      'SELECT id, email, contact_name FROM clients WHERE email = ? AND status = "active"',
      [email.toLowerCase()]
    ) as DatabaseRow | undefined;

    if (!row) return null;

    return {
      id: getNumber(row, 'id'),
      email: getString(row, 'email'),
      contactName: getString(row, 'contact_name')
    };
  }

  /**
   * Find a client by magic link token.
   */
  async findClientByMagicToken(token: string): Promise<ClientMagicTokenRow | null> {
    const db = await getDatabase();
    const row = await db.get(
      `SELECT id, email, contact_name, company_name, status, is_admin, magic_link_expires_at
       FROM clients
       WHERE magic_link_token = ?`,
      [token]
    ) as DatabaseRow | undefined;

    if (!row) return null;

    return {
      id: getNumber(row, 'id'),
      email: getString(row, 'email'),
      contactName: getString(row, 'contact_name'),
      companyName: getString(row, 'company_name'),
      status: getString(row, 'status'),
      isAdmin: getBoolean(row, 'is_admin'),
      magicLinkExpiresAt: getString(row, 'magic_link_expires_at')
    };
  }

  /**
   * Reset expired client lockout (clear attempts and locked_until).
   */
  async resetClientLockout(clientId: number): Promise<void> {
    const db = await getDatabase();
    await db.run(
      'UPDATE clients SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [clientId]
    );
  }

  /**
   * Lock a client account after too many failed attempts.
   */
  async lockClientAccount(clientId: number, failedAttempts: number, lockUntil: Date): Promise<void> {
    const db = await getDatabase();
    await db.run(
      'UPDATE clients SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
      [failedAttempts, lockUntil.toISOString(), clientId]
    );
  }

  /**
   * Increment failed login attempts for a client.
   */
  async incrementClientFailedAttempts(clientId: number, newCount: number): Promise<void> {
    const db = await getDatabase();
    await db.run(
      'UPDATE clients SET failed_login_attempts = ? WHERE id = ?',
      [newCount, clientId]
    );
  }

  /**
   * Record successful client login (update last_login, reset lockout).
   */
  async recordClientLoginSuccess(clientId: number): Promise<void> {
    const db = await getDatabase();
    await db.run(
      'UPDATE clients SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [clientId]
    );
  }

  /**
   * Store a magic link token for a client.
   */
  async storeMagicLinkToken(clientId: number, token: string, expiresAt: Date): Promise<void> {
    const db = await getDatabase();
    await db.run(
      'UPDATE clients SET magic_link_token = ?, magic_link_expires_at = ? WHERE id = ?',
      [token, expiresAt.toISOString(), clientId]
    );
  }

  /**
   * Clear a client's magic link token (expired or consumed).
   */
  async clearMagicLinkToken(clientId: number): Promise<void> {
    const db = await getDatabase();
    await db.run(
      'UPDATE clients SET magic_link_token = NULL, magic_link_expires_at = NULL WHERE id = ?',
      [clientId]
    );
  }

  /**
   * Consume a magic link token: clear it and record login.
   */
  async consumeMagicLinkToken(clientId: number): Promise<void> {
    const db = await getDatabase();
    await db.run(
      'UPDATE clients SET magic_link_token = NULL, magic_link_expires_at = NULL, last_login_at = ? WHERE id = ?',
      [new Date().toISOString(), clientId]
    );
  }

  // =====================================================
  // ADMIN AUTH HELPERS (system_settings-based)
  // =====================================================

  /**
   * Get a single system setting value by key.
   */
  async getSystemSetting(key: string): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.get(
      'SELECT setting_value FROM system_settings WHERE setting_key = ?',
      [key]
    ) as DatabaseRow | undefined;

    if (!row) return null;
    return getString(row, 'setting_value') || null;
  }

  /**
   * Check if admin account is locked. Returns lock expiry Date if locked, null otherwise.
   */
  async getAdminLockoutExpiry(): Promise<Date | null> {
    const value = await this.getSystemSetting('admin.locked_until');
    if (!value) return null;

    const lockedUntil = new Date(value);
    if (new Date() < lockedUntil) {
      return lockedUntil;
    }
    return null;
  }

  /**
   * Get current admin failed login attempt count.
   */
  async getAdminFailedAttempts(): Promise<number> {
    const value = await this.getSystemSetting('admin.failed_login_attempts');
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * Lock the admin account (set locked_until and failed attempts in system_settings).
   */
  async lockAdminAccount(failedAttempts: number, lockUntil: Date): Promise<void> {
    const db = await getDatabase();
    await db.run(
      'INSERT OR REPLACE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES (\'admin.locked_until\', ?, \'string\', \'Admin account lockout expiry\')',
      [lockUntil.toISOString()]
    );
    await db.run(
      'INSERT OR REPLACE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES (\'admin.failed_login_attempts\', ?, \'number\', \'Admin failed login attempts\')',
      [failedAttempts.toString()]
    );
  }

  /**
   * Increment admin failed login attempts in system_settings.
   */
  async incrementAdminFailedAttempts(newCount: number): Promise<void> {
    const db = await getDatabase();
    await db.run(
      'INSERT OR REPLACE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES (\'admin.failed_login_attempts\', ?, \'number\', \'Admin failed login attempts\')',
      [newCount.toString()]
    );
  }

  /**
   * Reset admin lockout state (delete lockout and failed attempt settings).
   */
  async resetAdminLockout(): Promise<void> {
    const db = await getDatabase();
    await db.run(
      'DELETE FROM system_settings WHERE setting_key IN (\'admin.locked_until\', \'admin.failed_login_attempts\')'
    );
  }

  /**
   * Check if admin two-factor authentication is enabled.
   */
  async isAdmin2FAEnabled(settingKey: string): Promise<boolean> {
    const value = await this.getSystemSetting(settingKey);
    return value === 'true';
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
