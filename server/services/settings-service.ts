/**
 * ===============================================
 * SYSTEM SETTINGS SERVICE
 * ===============================================
 * @file server/services/settings-service.ts
 *
 * Service for managing system settings stored in the database.
 * Provides centralized access to business info, payment settings,
 * and other configurable values.
 *
 * Phase 3.1 of Database Normalization
 */

import { getDatabase } from '../database/init.js';
import { getString, getNumber, getBoolean } from '../database/row-helpers.js';

export type SettingType = 'string' | 'number' | 'boolean' | 'json';

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  type: SettingType;
  description?: string;
  isSensitive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessInfo {
  name: string;
  owner: string;
  contact: string;
  tagline: string;
  email: string;
  website: string;
}

export interface PaymentSettings {
  venmoHandle: string;
  zelleEmail: string;
  paypalEmail: string;
}

export interface InvoiceSettings {
  defaultCurrency: string;
  defaultTerms: string;
  prefix: string;
  nextSequence: number;
}

interface SettingRow {
  id: number;
  setting_key: string;
  setting_value: string;
  setting_type: string;
  description: string | null;
  is_sensitive: number;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to SystemSetting
 */
function mapSetting(row: Record<string, unknown>): SystemSetting {
  return {
    id: getNumber(row, 'id'),
    key: getString(row, 'setting_key'),
    value: getString(row, 'setting_value'),
    type: getString(row, 'setting_type') as SettingType,
    description: row.description as string | undefined,
    isSensitive: getBoolean(row, 'is_sensitive'),
    createdAt: getString(row, 'created_at'),
    updatedAt: getString(row, 'updated_at')
  };
}

/**
 * Parse setting value based on type
 */
function parseSettingValue(value: string, type: SettingType): string | number | boolean | unknown {
  switch (type) {
    case 'number':
      return parseFloat(value) || 0;
    case 'boolean':
      return value.toLowerCase() === 'true' || value === '1';
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    case 'string':
    default:
      return value;
  }
}

/**
 * Convert value to string for storage
 */
function stringifySettingValue(value: unknown, type: SettingType): string {
  switch (type) {
    case 'number':
      return String(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'json':
      return JSON.stringify(value);
    case 'string':
    default:
      return String(value);
  }
}

class SettingsService {
  private cache: Map<string, SystemSetting> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    return this.cache.size > 0 && Date.now() < this.cacheExpiry;
  }

  /**
   * Invalidate cache
   */
  private invalidateCache(): void {
    this.cache.clear();
    this.cacheExpiry = 0;
  }

  /**
   * Load all settings into cache
   */
  private async loadCache(): Promise<void> {
    const db = getDatabase();
    const rows = await db.all('SELECT * FROM system_settings');

    this.cache.clear();
    for (const row of rows) {
      const setting = mapSetting(row as Record<string, unknown>);
      this.cache.set(setting.key, setting);
    }
    this.cacheExpiry = Date.now() + this.CACHE_TTL;
  }

  /**
   * Get a single setting by key
   */
  async getSetting(key: string): Promise<SystemSetting | null> {
    if (this.isCacheValid() && this.cache.has(key)) {
      return this.cache.get(key) ?? null;
    }

    const db = getDatabase();
    const row = await db.get(
      'SELECT * FROM system_settings WHERE setting_key = ?',
      [key]
    );

    if (!row) {
      return null;
    }

    const setting = mapSetting(row as Record<string, unknown>);
    this.cache.set(key, setting);
    return setting;
  }

  /**
   * Get setting value, parsed according to type
   */
  async getValue<T = string>(key: string, defaultValue?: T): Promise<T> {
    const setting = await this.getSetting(key);
    if (!setting) {
      return defaultValue as T;
    }
    return parseSettingValue(setting.value, setting.type) as T;
  }

  /**
   * Get all settings, optionally filtered by prefix
   */
  async getSettings(prefix?: string): Promise<SystemSetting[]> {
    if (!this.isCacheValid()) {
      await this.loadCache();
    }

    const settings = Array.from(this.cache.values());
    if (prefix) {
      return settings.filter((s) => s.key.startsWith(prefix));
    }
    return settings;
  }

  /**
   * Set a setting value
   */
  async setSetting(
    key: string,
    value: unknown,
    options?: {
      type?: SettingType;
      description?: string;
      isSensitive?: boolean;
    }
  ): Promise<SystemSetting> {
    const db = getDatabase();
    const type = options?.type ?? 'string';
    const stringValue = stringifySettingValue(value, type);

    const existing = await this.getSetting(key);

    if (existing) {
      await db.run(
        `UPDATE system_settings
         SET setting_value = ?, setting_type = ?, updated_at = datetime('now')
         WHERE setting_key = ?`,
        [stringValue, type, key]
      );
    } else {
      await db.run(
        `INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_sensitive)
         VALUES (?, ?, ?, ?, ?)`,
        [key, stringValue, type, options?.description ?? null, options?.isSensitive ? 1 : 0]
      );
    }

    this.invalidateCache();
    return (await this.getSetting(key))!;
  }

  /**
   * Delete a setting
   */
  async deleteSetting(key: string): Promise<boolean> {
    const db = getDatabase();
    const result = await db.run(
      'DELETE FROM system_settings WHERE setting_key = ?',
      [key]
    );
    this.invalidateCache();
    return (result.changes ?? 0) > 0;
  }

  /**
   * Get all business info settings
   */
  async getBusinessInfo(): Promise<BusinessInfo> {
    const [name, owner, contact, tagline, email, website] = await Promise.all([
      this.getValue('business.name', 'No Bhad Codes'),
      this.getValue('business.owner', 'Noelle Bhaduri'),
      this.getValue('business.contact', 'Noelle Bhaduri'),
      this.getValue('business.tagline', 'Web Development & Design'),
      this.getValue('business.email', 'nobhaduri@gmail.com'),
      this.getValue('business.website', 'nobhad.codes')
    ]);

    return { name, owner, contact, tagline, email, website };
  }

  /**
   * Update business info settings
   */
  async updateBusinessInfo(info: Partial<BusinessInfo>): Promise<BusinessInfo> {
    const updates: Promise<SystemSetting>[] = [];

    if (info.name !== undefined) {
      updates.push(this.setSetting('business.name', info.name));
    }
    if (info.owner !== undefined) {
      updates.push(this.setSetting('business.owner', info.owner));
    }
    if (info.contact !== undefined) {
      updates.push(this.setSetting('business.contact', info.contact));
    }
    if (info.tagline !== undefined) {
      updates.push(this.setSetting('business.tagline', info.tagline));
    }
    if (info.email !== undefined) {
      updates.push(this.setSetting('business.email', info.email));
    }
    if (info.website !== undefined) {
      updates.push(this.setSetting('business.website', info.website));
    }

    await Promise.all(updates);
    return this.getBusinessInfo();
  }

  /**
   * Get payment settings
   */
  async getPaymentSettings(): Promise<PaymentSettings> {
    const [venmoHandle, zelleEmail, paypalEmail] = await Promise.all([
      this.getValue('payment.venmo_handle', '@nobhaduri'),
      this.getValue('payment.zelle_email', 'nobhaduri@gmail.com'),
      this.getValue('payment.paypal_email', '')
    ]);

    return { venmoHandle, zelleEmail, paypalEmail };
  }

  /**
   * Update payment settings
   */
  async updatePaymentSettings(settings: Partial<PaymentSettings>): Promise<PaymentSettings> {
    const updates: Promise<SystemSetting>[] = [];

    if (settings.venmoHandle !== undefined) {
      updates.push(this.setSetting('payment.venmo_handle', settings.venmoHandle));
    }
    if (settings.zelleEmail !== undefined) {
      updates.push(this.setSetting('payment.zelle_email', settings.zelleEmail));
    }
    if (settings.paypalEmail !== undefined) {
      updates.push(this.setSetting('payment.paypal_email', settings.paypalEmail));
    }

    await Promise.all(updates);
    return this.getPaymentSettings();
  }

  /**
   * Get invoice settings
   */
  async getInvoiceSettings(): Promise<InvoiceSettings> {
    const [defaultCurrency, defaultTerms, prefix, nextSequence] = await Promise.all([
      this.getValue('invoice.default_currency', 'USD'),
      this.getValue('invoice.default_terms', 'Payment due within 30 days of invoice date.'),
      this.getValue('invoice.prefix', 'INV-'),
      this.getValue<number>('invoice.next_sequence', 1)
    ]);

    return { defaultCurrency, defaultTerms, prefix, nextSequence };
  }

  /**
   * Get and increment invoice sequence number
   */
  async getNextInvoiceNumber(): Promise<string> {
    const db = getDatabase();
    const settings = await this.getInvoiceSettings();
    const sequence = settings.nextSequence;

    // Increment sequence atomically
    await db.run(
      `UPDATE system_settings
       SET setting_value = ?, updated_at = datetime('now')
       WHERE setting_key = 'invoice.next_sequence'`,
      [String(sequence + 1)]
    );

    this.invalidateCache();

    // Format: INV-0001
    return `${settings.prefix}${String(sequence).padStart(4, '0')}`;
  }
}

export const settingsService = new SettingsService();
export default settingsService;
