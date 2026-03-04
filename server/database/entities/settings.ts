/**
 * ===============================================
 * SETTINGS ENTITY SCHEMAS
 * ===============================================
 * @file server/database/entities/settings.ts
 *
 * Entity schemas and mappers for system settings.
 */

import { defineSchema, createMapper } from '../entity-mapper.js';
import type { DatabaseRow } from '../init.js';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

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

// =====================================================
// ROW TYPE DEFINITIONS
// =====================================================

export interface SettingRow extends DatabaseRow {
  id: number;
  setting_key: string;
  setting_value: string;
  setting_type: string;
  description?: string;
  is_sensitive: number;
  created_at: string;
  updated_at: string;
}

// =====================================================
// ENTITY SCHEMAS
// =====================================================

export const systemSettingSchema = defineSchema<SystemSetting>({
  id: 'number',
  key: { column: 'setting_key', type: 'string' },
  value: { column: 'setting_value', type: 'string' },
  type: {
    column: 'setting_type',
    type: 'string',
    transform: (v) => v as SettingType
  },
  description: 'string?',
  isSensitive: { column: 'is_sensitive', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' }
});

// =====================================================
// MAPPER FUNCTIONS
// =====================================================

export const toSystemSetting = createMapper<SettingRow, SystemSetting>(systemSettingSchema);
