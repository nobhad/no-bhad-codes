/**
 * ===============================================
 * UNIT TESTS - SETTINGS SERVICE
 * ===============================================
 * @file tests/unit/services/settings-service.test.ts
 *
 * Tests for settings service including:
 * - getSetting / getValue
 * - getSettings with and without prefix
 * - setSetting (create and update paths)
 * - deleteSetting
 * - getBusinessInfo / updateBusinessInfo
 * - getPaymentSettings / updatePaymentSettings
 * - getInvoiceSettings / updateInvoiceSettings
 * - getNextInvoiceNumber
 * - Cache behavior (load, invalidation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn()
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb)
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock entity mapper/entities to avoid deep dependency chain
vi.mock('../../../server/config/business', () => ({
  BUSINESS_INFO: {
    name: 'No Bhad Codes',
    owner: 'Noelle Bhaduri',
    contact: 'Noelle Bhaduri',
    tagline: 'Web Development & Design',
    email: 'nobhaduri@gmail.com',
    website: 'nobhad.codes',
    venmoHandle: '@nobhaduri',
    zelleEmail: 'nobhaduri@gmail.com',
    paypalEmail: ''
  }
}));

vi.mock('../../../server/database/entities/index', () => ({
  toSystemSetting: vi.fn((row: Record<string, unknown>) => ({
    id: row['id'],
    key: row['setting_key'],
    value: row['setting_value'],
    type: row['setting_type'] ?? 'string',
    description: row['description'],
    isSensitive: Boolean(row['is_sensitive']),
    createdAt: row['created_at'],
    updatedAt: row['updated_at']
  }))
}));

// Import after mocks
import { settingsService } from '../../../server/services/settings-service';

const makeRow = (key: string, value: string, type = 'string') => ({
  id: 1,
  setting_key: key,
  setting_value: value,
  setting_type: type,
  description: null,
  is_sensitive: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
});

const _makeSetting = (key: string, value: string, type = 'string') => ({
  id: 1,
  key,
  value,
  type,
  description: undefined,
  isSensitive: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
});

describe('SettingsService - getSetting', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    // Force cache invalidation between tests by resetting the service cache
    // We do this by calling deleteSetting (which invalidates) – but simpler to
    // just ensure cache is cold by mocking db.get directly.
    // The service caches in-process, so we need to re-import or use its own
    // invalidation. We'll call settingsService's internal flow through setSetting
    // or rely on cold-cache paths via fresh mock returns.
  });

  it('returns null when setting not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const result = await settingsService.getSetting('nonexistent.key');

    expect(result).toBeNull();
  });

  it('returns setting when found in db', async () => {
    mockDb.get.mockResolvedValueOnce(makeRow('app.name', 'MyApp'));

    const result = await settingsService.getSetting('app.name');

    expect(result).toMatchObject({ key: 'app.name', value: 'MyApp' });
  });
});

describe('SettingsService - getValue', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns string value', async () => {
    mockDb.get.mockResolvedValueOnce(makeRow('my.key', 'hello', 'string'));

    const result = await settingsService.getValue('my.key');

    expect(result).toBe('hello');
  });

  it('returns parsed number value', async () => {
    mockDb.get.mockResolvedValueOnce(makeRow('my.num', '42', 'number'));

    const result = await settingsService.getValue<number>('my.num');

    expect(result).toBe(42);
  });

  it('returns parsed boolean value for true', async () => {
    mockDb.get.mockResolvedValueOnce(makeRow('my.bool', 'true', 'boolean'));

    const result = await settingsService.getValue<boolean>('my.bool');

    expect(result).toBe(true);
  });

  it('returns parsed boolean value for false', async () => {
    mockDb.get.mockResolvedValueOnce(makeRow('my.bool.off', '0', 'boolean'));

    const result = await settingsService.getValue<boolean>('my.bool.off');

    expect(result).toBe(false);
  });

  it('returns parsed json value', async () => {
    mockDb.get.mockResolvedValueOnce(makeRow('my.json', '{"x":1}', 'json'));

    const result = await settingsService.getValue<{ x: number }>('my.json');

    expect(result).toEqual({ x: 1 });
  });

  it('returns null for malformed json', async () => {
    mockDb.get.mockResolvedValueOnce(makeRow('bad.json', '{not-valid}', 'json'));

    const result = await settingsService.getValue('bad.json');

    expect(result).toBeNull();
  });

  it('returns defaultValue when setting not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const result = await settingsService.getValue('missing.key', 'fallback');

    expect(result).toBe('fallback');
  });
});

describe('SettingsService - getSettings', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    // Force cache invalidation by simulating a delete (changes = 1)
    mockDb.run.mockResolvedValueOnce({ changes: 1 });
    return settingsService.deleteSetting('__force_invalidate__');
  });

  it('loads cache and returns all settings', async () => {
    mockDb.all.mockResolvedValueOnce([
      makeRow('a.one', '1'),
      makeRow('b.two', '2')
    ]);

    const result = await settingsService.getSettings();

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(mockDb.all).toHaveBeenCalledTimes(1);
  });

  it('filters by prefix', async () => {
    mockDb.all.mockResolvedValueOnce([
      makeRow('a.one', '1'),
      makeRow('a.two', '2'),
      makeRow('b.three', '3')
    ]);

    const result = await settingsService.getSettings('a.');

    expect(result.every((s) => s.key.startsWith('a.'))).toBe(true);
    expect(result.length).toBe(2);
  });
});

describe('SettingsService - setSetting', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('inserts a new setting when key does not exist', async () => {
    // getSetting lookup (cache miss) -> not found
    mockDb.get.mockResolvedValueOnce(null);
    // db.run insert
    mockDb.run.mockResolvedValueOnce({ changes: 1 });
    // getSetting after invalidation (final return)
    mockDb.get.mockResolvedValueOnce(makeRow('new.key', 'value'));

    const result = await settingsService.setSetting('new.key', 'value');

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO system_settings'),
      expect.arrayContaining(['new.key', 'value', 'string'])
    );
    expect(result).toMatchObject({ key: 'new.key', value: 'value' });
  });

  it('updates an existing setting when key already exists', async () => {
    // getSetting lookup -> found
    mockDb.get.mockResolvedValueOnce(makeRow('existing.key', 'old'));
    // db.run update
    mockDb.run.mockResolvedValueOnce({ changes: 1 });
    // getSetting after invalidation
    mockDb.get.mockResolvedValueOnce(makeRow('existing.key', 'new'));

    const result = await settingsService.setSetting('existing.key', 'new');

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE system_settings'),
      expect.arrayContaining(['new', 'string', 'existing.key'])
    );
    expect(result).toMatchObject({ value: 'new' });
  });

  it('stringifies number type correctly', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRow('count', '5', 'number'));

    await settingsService.setSetting('count', 5, { type: 'number' });

    const runArgs = mockDb.run.mock.calls[0][1] as unknown[];
    expect(runArgs[1]).toBe('5');
    expect(runArgs[2]).toBe('number');
  });

  it('stringifies boolean type correctly', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRow('flag', 'true', 'boolean'));

    await settingsService.setSetting('flag', true, { type: 'boolean' });

    const runArgs = mockDb.run.mock.calls[0][1] as unknown[];
    expect(runArgs[1]).toBe('true');
  });

  it('marks setting as sensitive when isSensitive option is set', async () => {
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRow('secret', 'pass', 'string'));

    await settingsService.setSetting('secret', 'pass', { isSensitive: true });

    const runArgs = mockDb.run.mock.calls[0][1] as unknown[];
    expect(runArgs[4]).toBe(1); // is_sensitive = 1
  });
});

describe('SettingsService - deleteSetting', () => {
  beforeEach(() => {
    mockDb.run.mockReset();
  });

  it('deletes a setting and returns true when rows affected', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    const result = await settingsService.deleteSetting('my.key');

    expect(result).toBe(true);
    expect(mockDb.run).toHaveBeenCalledWith(
      'DELETE FROM system_settings WHERE setting_key = ?',
      ['my.key']
    );
  });

  it('returns false when no rows were affected', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 0 });

    const result = await settingsService.deleteSetting('ghost.key');

    expect(result).toBe(false);
  });
});

describe('SettingsService - getBusinessInfo', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.run.mockReset();
  });

  it('returns business info with defaults when keys are missing', async () => {
    // Each getValue calls getSetting which calls db.get - return null for all 6
    mockDb.get.mockResolvedValue(null);

    const result = await settingsService.getBusinessInfo();

    expect(result).toMatchObject({
      name: 'No Bhad Codes',
      owner: 'Noelle Bhaduri',
      contact: 'Noelle Bhaduri',
      tagline: 'Web Development & Design',
      email: 'nobhaduri@gmail.com',
      website: 'nobhad.codes'
    });
  });

  it('returns stored values when present', async () => {
    mockDb.get
      .mockResolvedValueOnce(makeRow('business.name', 'ACME Inc'))
      .mockResolvedValueOnce(makeRow('business.owner', 'Jane Doe'))
      .mockResolvedValueOnce(makeRow('business.contact', 'Jane Doe'))
      .mockResolvedValueOnce(makeRow('business.tagline', 'We build things'))
      .mockResolvedValueOnce(makeRow('business.email', 'jane@acme.com'))
      .mockResolvedValueOnce(makeRow('business.website', 'acme.com'));

    const result = await settingsService.getBusinessInfo();

    expect(result.name).toBe('ACME Inc');
    expect(result.email).toBe('jane@acme.com');
  });
});

describe('SettingsService - updateBusinessInfo', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.run.mockReset();
  });

  it('updates only provided fields', async () => {
    // setSetting for 'business.name': getSetting (not found) -> insert -> getSetting (return)
    mockDb.get.mockResolvedValueOnce(null); // getSetting for name (check existing)
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRow('business.name', 'New Name'));

    // getBusinessInfo calls after update (6 getSetting calls)
    mockDb.get.mockResolvedValue(null);

    await settingsService.updateBusinessInfo({ name: 'New Name' });

    // Should have called run at least once (for the update)
    expect(mockDb.run).toHaveBeenCalled();
  });
});

describe('SettingsService - getPaymentSettings', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
  });

  it('returns payment settings with defaults', async () => {
    mockDb.get.mockResolvedValue(null);

    const result = await settingsService.getPaymentSettings();

    expect(result).toMatchObject({
      venmoHandle: '@nobhaduri',
      zelleEmail: 'nobhaduri@gmail.com',
      paypalEmail: ''
    });
  });
});

describe('SettingsService - getInvoiceSettings', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
  });

  it('returns invoice settings with defaults', async () => {
    mockDb.get.mockResolvedValue(null);

    const result = await settingsService.getInvoiceSettings();

    expect(result).toMatchObject({
      defaultCurrency: 'USD',
      prefix: 'INV-',
      nextSequence: 1
    });
  });
});

describe('SettingsService - updateInvoiceSettings', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.run.mockReset();
  });

  it('updates invoice prefix setting', async () => {
    mockDb.get.mockResolvedValueOnce(null); // getSetting for prefix (not found)
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeRow('invoice.prefix', 'BILL-'));

    // getInvoiceSettings calls after
    mockDb.get.mockResolvedValue(null);

    await settingsService.updateInvoiceSettings({ prefix: 'BILL-' });

    expect(mockDb.run).toHaveBeenCalled();
  });
});

describe('SettingsService - getNextInvoiceNumber', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('generates formatted invoice number and increments sequence', async () => {
    // getInvoiceSettings calls (4 getValue calls = 4 getSetting = 4 db.get)
    mockDb.get.mockResolvedValueOnce(makeRow('invoice.default_currency', 'USD'));
    mockDb.get.mockResolvedValueOnce(makeRow('invoice.default_terms', 'Net 30'));
    mockDb.get.mockResolvedValueOnce(makeRow('invoice.prefix', 'INV-'));
    mockDb.get.mockResolvedValueOnce(makeRow('invoice.next_sequence', '5', 'number'));

    // db.run for increment
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    const result = await settingsService.getNextInvoiceNumber();

    expect(result).toBe('INV-0005');
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('WHERE setting_key = \'invoice.next_sequence\''),
      ['6']
    );
  });

  it('uses default prefix and sequence when settings not found', async () => {
    mockDb.get.mockResolvedValue(null); // all 4 getInvoiceSettings calls miss
    mockDb.run.mockResolvedValueOnce({});

    const result = await settingsService.getNextInvoiceNumber();

    // defaults: prefix = 'INV-', nextSequence = 1
    expect(result).toBe('INV-0001');
  });
});
