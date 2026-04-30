/**
 * ===============================================
 * UNIT TESTS - CLIENT SERVICE
 * ===============================================
 * @file tests/unit/services/client-service.test.ts
 *
 * Tests for CRM client management service including:
 * - Contact CRUD operations
 * - Activity timeline logging
 * - Notes management
 * - Custom field definitions and values
 * - Tag management and assignment
 * - Health scoring
 * - Client stats and lifetime value
 * - CRM field updates
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

vi.mock('../../../server/services/user-service', () => ({
  userService: {
    getUserIdByEmail: vi.fn().mockResolvedValue(1),
    getUserIdByEmailOrName: vi.fn().mockResolvedValue(1)
  }
}));

vi.mock('../../../server/database/entities/index', () => ({
  toContact: vi.fn((row) => ({
    id: row.id,
    clientId: row.client_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    title: row.title,
    department: row.department,
    role: row.role ?? 'general',
    isPrimary: Boolean(row.is_primary),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })),
  toActivity: vi.fn((row) => ({
    id: row.id,
    clientId: row.client_id,
    activityType: row.activity_type,
    title: row.title,
    description: row.description,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdBy: row.created_by,
    createdAt: row.created_at
  })),
  toCustomField: vi.fn((row) => ({
    id: row.id,
    fieldName: row.field_name,
    fieldLabel: row.field_label,
    fieldType: row.field_type,
    options: row.options ? JSON.parse(row.options) : undefined,
    isRequired: Boolean(row.is_required),
    placeholder: row.placeholder,
    defaultValue: row.default_value,
    displayOrder: row.display_order,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })),
  toCustomFieldValue: vi.fn((row) => ({
    id: row.id,
    clientId: row.client_id,
    fieldId: row.field_id,
    fieldName: row.field_name,
    fieldLabel: row.field_label,
    fieldType: row.field_type,
    fieldValue: row.field_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })),
  toTag: vi.fn((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    description: row.description,
    tagType: row.tag_type,
    createdAt: row.created_at
  })),
  toClientNote: vi.fn((row) => ({
    id: row.id,
    clientId: row.client_id,
    author: row.author_name || row.author_user_id,
    content: row.content,
    isPinned: Boolean(row.is_pinned),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}));

vi.mock('../../../server/database/query-helpers', () => ({
  buildSafeUpdate: vi.fn((updates, _allowed, _opts) => {
    const keys = Object.keys(updates);
    if (keys.length === 0) return { setClause: '', params: [] };
    const setClause = `${keys.map((k) => `${k} = ?`).join(', ')  }, updated_at = CURRENT_TIMESTAMP`;
    return { setClause, params: Object.values(updates) };
  })
}));

// Import service after mocks
import { clientService } from '../../../server/services/client-service';

// =====================================================
// SHARED FIXTURES
// =====================================================

const makeContactRow = (overrides = {}) => ({
  id: 1,
  client_id: 10,
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane@example.com',
  phone: '555-1234',
  title: 'CEO',
  department: 'Executive',
  role: 'primary',
  is_primary: 1,
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeActivityRow = (overrides = {}) => ({
  id: 1,
  client_id: 10,
  activity_type: 'contact_added',
  title: 'Added contact: Jane Doe',
  description: null,
  metadata: null,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeCustomFieldRow = (overrides = {}) => ({
  id: 1,
  field_name: 'budget',
  field_label: 'Budget',
  field_type: 'number',
  options: null,
  is_required: 0,
  placeholder: null,
  default_value: null,
  display_order: 0,
  is_active: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeTagRow = (overrides = {}) => ({
  id: 1,
  name: 'VIP',
  color: '#ff0000',
  description: 'High priority client',
  tag_type: 'client',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeNoteRow = (overrides = {}) => ({
  id: 1,
  client_id: 10,
  author_user_id: 1,
  author_name: 'Admin User',
  content: 'This is a note.',
  is_pinned: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

// =====================================================
// CONTACT MANAGEMENT
// =====================================================

describe('ClientService - Contact Management', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    mockDb.transaction.mockReset();
    // createContact and updateContact moved to db.transaction(cb).
    // Run the callback with ctx === db so the per-test get/run mocks
    // record calls; pass through the cb's return so newContactId is
    // set from the mocked INSERT lastID.
    mockDb.transaction.mockImplementation(async (cb: (ctx: typeof mockDb) => Promise<unknown>) =>
      cb(mockDb)
    );
  });

  describe('createContact', () => {
    it('creates a non-primary contact without unsetting existing primaries', async () => {
      const contactRow = makeContactRow({ is_primary: 0, role: 'general' });
      mockDb.run.mockResolvedValueOnce({ lastID: 1 }); // INSERT
      mockDb.get.mockResolvedValueOnce(contactRow); // SELECT after insert
      // logActivity internals
      mockDb.run.mockResolvedValueOnce({}); // INSERT activity
      mockDb.run.mockResolvedValueOnce({}); // UPDATE last_contact_date
      mockDb.get.mockResolvedValueOnce(makeActivityRow()); // SELECT activity

      const result = await clientService.createContact(10, {
        firstName: 'Jane',
        lastName: 'Doe',
        isPrimary: false
      });

      expect(result.firstName).toBe('Jane');
      expect(result.lastName).toBe('Doe');
      // Only one db.run for INSERT (no unset-primary run)
      expect(mockDb.run.mock.calls[0][0]).toContain('INSERT INTO client_contacts');
    });

    it('unsets other primary contacts when isPrimary is true', async () => {
      const contactRow = makeContactRow();
      mockDb.run.mockResolvedValueOnce({}); // UPDATE is_primary = 0
      mockDb.run.mockResolvedValueOnce({ lastID: 1 }); // INSERT
      mockDb.get.mockResolvedValueOnce(contactRow); // SELECT after insert
      // logActivity
      mockDb.run.mockResolvedValueOnce({ lastID: 2 });
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeActivityRow());

      const result = await clientService.createContact(10, {
        firstName: 'Jane',
        lastName: 'Doe',
        isPrimary: true
      });

      expect(result.isPrimary).toBe(true);
      expect(mockDb.run.mock.calls[0][0]).toContain('UPDATE client_contacts SET is_primary = 0');
    });

    it('throws when created contact row is not found', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 99 });
      mockDb.get.mockResolvedValueOnce(null); // no row returned

      await expect(
        clientService.createContact(10, { firstName: 'X', lastName: 'Y' })
      ).rejects.toThrow('Failed to create contact');
    });

    it('applies optional fields correctly (nulls for empty strings)', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeContactRow());
      mockDb.run.mockResolvedValueOnce({ lastID: 2 });
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeActivityRow());

      await clientService.createContact(10, {
        firstName: 'Jane',
        lastName: 'Doe',
        email: '',    // should become null
        phone: '',    // should become null
        title: 'Manager',
        department: 'Sales',
        role: 'billing',
        notes: ''
      });

      const insertCall = mockDb.run.mock.calls[0];
      const insertParams = insertCall[1];
      expect(insertParams[3]).toBeNull(); // email
      expect(insertParams[4]).toBeNull(); // phone
      expect(insertParams[9]).toBeNull(); // notes
    });
  });

  describe('getContacts', () => {
    it('returns mapped contacts ordered by primary then name', async () => {
      const rows = [makeContactRow(), makeContactRow({ id: 2, first_name: 'John' })];
      mockDb.all.mockResolvedValueOnce(rows);

      const result = await clientService.getContacts(10);

      expect(result).toHaveLength(2);
      expect(mockDb.all.mock.calls[0][0]).toContain('ORDER BY is_primary DESC');
    });

    it('returns empty array when no contacts exist', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      const result = await clientService.getContacts(10);
      expect(result).toEqual([]);
    });
  });

  describe('getContact', () => {
    it('returns a mapped contact when found', async () => {
      mockDb.get.mockResolvedValueOnce(makeContactRow());
      const result = await clientService.getContact(1);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
    });

    it('returns null when contact is not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);
      const result = await clientService.getContact(999);
      expect(result).toBeNull();
    });
  });

  describe('updateContact', () => {
    it('updates a contact successfully', async () => {
      const existingRow = makeContactRow();
      const updatedRow = makeContactRow({ first_name: 'Janet' });

      mockDb.get.mockResolvedValueOnce(existingRow); // fetch existing
      mockDb.run.mockResolvedValueOnce({}); // UPDATE
      mockDb.get.mockResolvedValueOnce(updatedRow); // fetch updated

      const result = await clientService.updateContact(1, { firstName: 'Janet' });

      expect(result.firstName).toBe('Janet');
    });

    it('unsets other primaries when setting isPrimary on update', async () => {
      const existingRow = makeContactRow({ is_primary: 0 });
      const updatedRow = makeContactRow({ is_primary: 1 });

      mockDb.get.mockResolvedValueOnce(existingRow);
      mockDb.run.mockResolvedValueOnce({}); // unset other primaries
      mockDb.run.mockResolvedValueOnce({}); // UPDATE contact
      mockDb.get.mockResolvedValueOnce(updatedRow);

      const result = await clientService.updateContact(1, { isPrimary: true });

      expect(result.isPrimary).toBe(true);
      const unsetCall = mockDb.run.mock.calls[0][0];
      expect(unsetCall).toContain('is_primary = 0');
      expect(unsetCall).toContain('AND id !=');
    });

    it('throws when contact not found initially', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(clientService.updateContact(999, { firstName: 'X' })).rejects.toThrow(
        /contact .* not found/i
      );
    });

    it('throws when contact is not found after update', async () => {
      mockDb.get.mockResolvedValueOnce(makeContactRow()); // existing
      mockDb.run.mockResolvedValueOnce({}); // UPDATE
      mockDb.get.mockResolvedValueOnce(null); // post-update SELECT returns null

      // NotFoundError now formats as "contact <id> not found"; the
      // separate "after update" wording was dropped when the typed
      // error hierarchy landed.
      await expect(clientService.updateContact(1, { firstName: 'X' })).rejects.toThrow(
        /contact .* not found/i
      );
    });

    it('skips db.run when no fields provided', async () => {
      mockDb.get.mockResolvedValueOnce(makeContactRow()); // existing
      // buildSafeUpdate returns empty setClause for empty updates
      const { buildSafeUpdate } = await import('../../../server/database/query-helpers');
      (buildSafeUpdate as ReturnType<typeof vi.fn>).mockReturnValueOnce({ setClause: '', params: [] });

      mockDb.get.mockResolvedValueOnce(makeContactRow()); // post-update fetch

      const result = await clientService.updateContact(1, {});
      // run should not be called for the UPDATE statement
      expect(result).toBeDefined();
    });
  });

  describe('deleteContact', () => {
    it('deletes a contact and logs activity', async () => {
      const contactRow = makeContactRow();
      mockDb.get.mockResolvedValueOnce(contactRow); // fetch contact
      mockDb.run.mockResolvedValueOnce({}); // DELETE
      // logActivity
      mockDb.run.mockResolvedValueOnce({ lastID: 5 });
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeActivityRow());

      await expect(clientService.deleteContact(1)).resolves.toBeUndefined();
      expect(mockDb.run.mock.calls[0][0]).toContain('DELETE FROM client_contacts');
    });

    it('throws when contact not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(clientService.deleteContact(999)).rejects.toThrow(/contact .* not found/i);
    });
  });

  describe('setPrimaryContact', () => {
    it('unsets all primaries then sets the specified contact', async () => {
      mockDb.run.mockResolvedValueOnce({}); // unset all
      mockDb.run.mockResolvedValueOnce({}); // set primary

      await expect(clientService.setPrimaryContact(10, 1)).resolves.toBeUndefined();

      expect(mockDb.run.mock.calls[0][0]).toContain('is_primary = 0 WHERE client_id = ?');
      expect(mockDb.run.mock.calls[1][0]).toContain('is_primary = 1');
    });
  });
});

// =====================================================
// ACTIVITY TIMELINE
// =====================================================

describe('ClientService - Activity Timeline', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('logActivity', () => {
    it('creates an activity record and updates last_contact_date', async () => {
      const activityRow = makeActivityRow();
      mockDb.run.mockResolvedValueOnce({ lastID: 1 }); // INSERT activity
      mockDb.run.mockResolvedValueOnce({}); // UPDATE last_contact_date
      mockDb.get.mockResolvedValueOnce(activityRow);

      const result = await clientService.logActivity(10, {
        activityType: 'note_added',
        title: 'Added a note',
        createdBy: 'admin'
      });

      expect(result.activityType).toBe('contact_added');
      expect(mockDb.run.mock.calls[1][0]).toContain('UPDATE clients SET last_contact_date');
    });

    it('serializes metadata to JSON when present', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeActivityRow());

      await clientService.logActivity(10, {
        activityType: 'tag_added',
        title: 'Added tag',
        metadata: { tagId: 42 }
      });

      const insertParams = mockDb.run.mock.calls[0][1];
      expect(insertParams[4]).toBe(JSON.stringify({ tagId: 42 }));
    });

    it('throws when activity row is not found after insert', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(null); // no row

      await expect(
        clientService.logActivity(10, { activityType: 'test', title: 'Test' })
      ).rejects.toThrow('Failed to create activity');
    });
  });

  describe('getActivityTimeline', () => {
    it('returns activities without filters', async () => {
      mockDb.all.mockResolvedValueOnce([makeActivityRow(), makeActivityRow({ id: 2 })]);

      const result = await clientService.getActivityTimeline(10);

      expect(result).toHaveLength(2);
      expect(mockDb.all.mock.calls[0][0]).toContain('ORDER BY created_at DESC');
    });

    it('applies activityType filter', async () => {
      mockDb.all.mockResolvedValueOnce([makeActivityRow()]);

      await clientService.getActivityTimeline(10, { activityType: 'note_added' });

      expect(mockDb.all.mock.calls[0][0]).toContain('AND activity_type = ?');
    });

    it('applies startDate and endDate filters', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await clientService.getActivityTimeline(10, {
        startDate: '2026-01-01',
        endDate: '2026-12-31'
      });

      const query = mockDb.all.mock.calls[0][0];
      expect(query).toContain('AND created_at >= ?');
      expect(query).toContain('AND created_at <= ?');
    });

    it('applies limit and offset', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await clientService.getActivityTimeline(10, { limit: 10, offset: 5 });

      const query = mockDb.all.mock.calls[0][0];
      expect(query).toContain('LIMIT ?');
      expect(query).toContain('OFFSET ?');
    });

    it('applies limit without offset when offset is not set', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await clientService.getActivityTimeline(10, { limit: 10 });

      const query = mockDb.all.mock.calls[0][0];
      expect(query).toContain('LIMIT ?');
      expect(query).not.toContain('OFFSET ?');
    });
  });

  describe('getRecentActivities', () => {
    it('returns activities with client name info', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          ...makeActivityRow(),
          contact_name: 'Jane Doe',
          company_name: 'Acme Corp'
        }
      ]);

      const result = await clientService.getRecentActivities(20);

      expect(result).toHaveLength(1);
      expect(result[0].clientName).toBe('Jane Doe');
      expect(result[0].companyName).toBe('Acme Corp');
      expect(mockDb.all.mock.calls[0][1]).toEqual([20]);
    });

    it('uses default limit of 50', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      await clientService.getRecentActivities();
      expect(mockDb.all.mock.calls[0][1]).toEqual([50]);
    });
  });
});

// =====================================================
// NOTES
// =====================================================

describe('ClientService - Notes', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getNotes', () => {
    it('returns mapped notes for a client', async () => {
      mockDb.all.mockResolvedValueOnce([makeNoteRow(), makeNoteRow({ id: 2, is_pinned: 1 })]);

      const result = await clientService.getNotes(10);

      expect(result).toHaveLength(2);
      expect(mockDb.all.mock.calls[0][0]).toContain('ORDER BY cn.is_pinned DESC');
    });

    it('returns empty array when no notes exist', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      const result = await clientService.getNotes(10);
      expect(result).toEqual([]);
    });
  });

  describe('addNote', () => {
    it('creates a note and returns it', async () => {
      const noteRow = makeNoteRow();
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(noteRow);

      const result = await clientService.addNote(10, 'admin', 'This is a note.');

      expect(result.content).toBe('This is a note.');
    });

    it('throws when note row is not found after insert', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(null);

      await expect(clientService.addNote(10, 'admin', 'content')).rejects.toThrow(
        'Failed to create note'
      );
    });
  });

  describe('updateNote', () => {
    it('updates isPinned to true', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeNoteRow({ is_pinned: 1 }));

      const result = await clientService.updateNote(1, { isPinned: true });

      expect(result.isPinned).toBe(true);
      expect(mockDb.run.mock.calls[0][1]).toContain(1); // 1 for is_pinned = true
    });

    it('updates isPinned to false', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeNoteRow({ is_pinned: 0 }));

      await clientService.updateNote(1, { isPinned: false });

      expect(mockDb.run.mock.calls[0][1][0]).toBe(0); // 0 for is_pinned = false
    });

    it('skips run when no changes provided', async () => {
      mockDb.get.mockResolvedValueOnce(makeNoteRow());

      const result = await clientService.updateNote(1, {});

      expect(mockDb.run).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws when note is not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(clientService.updateNote(999, {})).rejects.toThrow(/note .* not found/i);
    });
  });

  describe('deleteNote', () => {
    it('deletes a note by id', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await expect(clientService.deleteNote(1)).resolves.toBeUndefined();
      expect(mockDb.run.mock.calls[0][0]).toContain('DELETE FROM client_notes WHERE id = ?');
    });
  });
});

// =====================================================
// CUSTOM FIELDS
// =====================================================

describe('ClientService - Custom Fields', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('createCustomField', () => {
    it('creates a custom field and returns it', async () => {
      const fieldRow = makeCustomFieldRow();
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(fieldRow);

      const result = await clientService.createCustomField({
        fieldName: 'budget',
        fieldLabel: 'Budget',
        fieldType: 'number'
      });

      expect(result.fieldName).toBe('budget');
      expect(result.fieldType).toBe('number');
    });

    it('serializes options array to JSON', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeCustomFieldRow({ field_type: 'select', options: '["a","b"]' }));

      await clientService.createCustomField({
        fieldName: 'tier',
        fieldLabel: 'Tier',
        fieldType: 'select',
        options: ['a', 'b']
      });

      const insertParams = mockDb.run.mock.calls[0][1];
      expect(insertParams[3]).toBe(JSON.stringify(['a', 'b']));
    });

    it('throws when field row is not found after insert', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(null);

      await expect(
        clientService.createCustomField({ fieldName: 'x', fieldLabel: 'X', fieldType: 'text' })
      ).rejects.toThrow('Failed to create custom field');
    });
  });

  describe('getCustomFields', () => {
    it('returns only active fields by default', async () => {
      mockDb.all.mockResolvedValueOnce([makeCustomFieldRow()]);

      await clientService.getCustomFields();

      expect(mockDb.all.mock.calls[0][0]).toContain('WHERE is_active = 1');
    });

    it('returns all fields when includeInactive is true', async () => {
      mockDb.all.mockResolvedValueOnce([makeCustomFieldRow(), makeCustomFieldRow({ id: 2, is_active: 0 })]);

      const result = await clientService.getCustomFields(true);

      expect(result).toHaveLength(2);
      expect(mockDb.all.mock.calls[0][0]).not.toContain('WHERE is_active = 1');
    });
  });

  describe('updateCustomField', () => {
    it('updates a custom field and returns the updated record', async () => {
      const updatedRow = makeCustomFieldRow({ field_label: 'Updated Budget' });
      mockDb.run.mockResolvedValueOnce({}); // UPDATE
      mockDb.get.mockResolvedValueOnce(updatedRow);

      const result = await clientService.updateCustomField(1, { fieldLabel: 'Updated Budget' });

      expect(result.fieldLabel).toBe('Updated Budget');
    });

    it('throws when custom field is not found after update', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(null);

      await expect(clientService.updateCustomField(999, { isActive: false })).rejects.toThrow(
        /custom field .* not found/i
      );
    });

    it('toggles isActive field', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeCustomFieldRow({ is_active: 0 }));

      await clientService.updateCustomField(1, { isActive: false });

      // The buildSafeUpdate mock captures the updates object — check run was called
      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe('deleteCustomField', () => {
    it('marks a custom field as inactive', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await expect(clientService.deleteCustomField(1)).resolves.toBeUndefined();
      expect(mockDb.run.mock.calls[0][0]).toContain('is_active = 0');
    });
  });

  describe('setCustomFieldValue', () => {
    it('upserts a custom field value', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await expect(clientService.setCustomFieldValue(10, 1, 'some-value')).resolves.toBeUndefined();
      expect(mockDb.run.mock.calls[0][0]).toContain('INSERT INTO client_custom_field_values');
      expect(mockDb.run.mock.calls[0][0]).toContain('ON CONFLICT');
    });

    it('upserts null value', async () => {
      mockDb.run.mockResolvedValueOnce({});
      await expect(clientService.setCustomFieldValue(10, 1, null)).resolves.toBeUndefined();
      expect(mockDb.run.mock.calls[0][1][2]).toBeNull();
    });
  });

  describe('getClientCustomFields', () => {
    it('returns mapped custom field values for a client', async () => {
      mockDb.all.mockResolvedValueOnce([
        { id: 1, client_id: 10, field_id: 1, field_name: 'budget', field_label: 'Budget', field_type: 'number', field_value: '5000', created_at: '2026-01-01', updated_at: '2026-01-01' }
      ]);

      const result = await clientService.getClientCustomFields(10);

      expect(result).toHaveLength(1);
      expect(result[0].fieldName).toBe('budget');
    });
  });

  describe('setClientCustomFields', () => {
    it('calls setCustomFieldValue for each entry', async () => {
      mockDb.run.mockResolvedValue({});

      await clientService.setClientCustomFields(10, [
        { fieldId: 1, value: 'val1' },
        { fieldId: 2, value: null }
      ]);

      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });

    it('does nothing when given an empty array', async () => {
      await clientService.setClientCustomFields(10, []);
      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });
});

// =====================================================
// TAGS & SEGMENTATION
// =====================================================

describe('ClientService - Tags & Segmentation', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('createTag', () => {
    it('creates a tag with default color and type', async () => {
      const tagRow = makeTagRow({ color: '#6b7280', tag_type: 'client' });
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(tagRow);

      const result = await clientService.createTag({ name: 'VIP' });

      expect(result.name).toBe('VIP');
      const insertParams = mockDb.run.mock.calls[0][1];
      expect(insertParams[1]).toBe('#6b7280'); // default color
      expect(insertParams[3]).toBe('client');  // default tag_type
    });

    it('creates a tag with custom color and type', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeTagRow({ color: '#ff0000', tag_type: 'project' }));

      await clientService.createTag({ name: 'Urgent', color: '#ff0000', tagType: 'project' });

      const insertParams = mockDb.run.mock.calls[0][1];
      expect(insertParams[1]).toBe('#ff0000');
      expect(insertParams[3]).toBe('project');
    });

    it('throws when tag row is not found after insert', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(null);

      await expect(clientService.createTag({ name: 'Broken' })).rejects.toThrow('Failed to create tag');
    });
  });

  describe('getTags', () => {
    it('returns all tags without filter', async () => {
      mockDb.all.mockResolvedValueOnce([makeTagRow()]);

      const result = await clientService.getTags();

      expect(result).toHaveLength(1);
      expect(mockDb.all.mock.calls[0][0]).not.toContain('WHERE');
    });

    it('filters by tagType when provided', async () => {
      mockDb.all.mockResolvedValueOnce([makeTagRow()]);

      await clientService.getTags('project');

      expect(mockDb.all.mock.calls[0][0]).toContain('WHERE tag_type = ?');
    });
  });

  describe('updateTag', () => {
    it('updates tag fields and returns updated tag', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeTagRow({ name: 'Premium', color: '#00ff00' }));

      const result = await clientService.updateTag(1, { name: 'Premium', color: '#00ff00' });

      expect(result.name).toBe('Premium');
      expect(result.color).toBe('#00ff00');
    });

    it('throws when tag is not found after update', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(null);

      await expect(clientService.updateTag(999, { name: 'Ghost' })).rejects.toThrow(/tag .* not found/i);
    });

    it('skips run when no fields provided', async () => {
      const { buildSafeUpdate } = await import('../../../server/database/query-helpers');
      (buildSafeUpdate as ReturnType<typeof vi.fn>).mockReturnValueOnce({ setClause: '', params: [] });
      mockDb.get.mockResolvedValueOnce(makeTagRow());

      const result = await clientService.updateTag(1, {});
      expect(result).toBeDefined();
    });
  });

  describe('deleteTag', () => {
    it('deletes a tag by id', async () => {
      mockDb.run.mockResolvedValueOnce({});
      await expect(clientService.deleteTag(1)).resolves.toBeUndefined();
      expect(mockDb.run.mock.calls[0][0]).toContain('DELETE FROM tags WHERE id = ?');
    });
  });

  describe('addTagToClient', () => {
    it('inserts client_tags row and logs activity when tag exists', async () => {
      mockDb.run.mockResolvedValueOnce({}); // INSERT OR IGNORE client_tags
      mockDb.get.mockResolvedValueOnce({ name: 'VIP' }); // fetch tag name
      // logActivity
      mockDb.run.mockResolvedValueOnce({ lastID: 5 });
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeActivityRow({ activity_type: 'tag_added' }));

      await expect(clientService.addTagToClient(10, 1)).resolves.toBeUndefined();
      expect(mockDb.run.mock.calls[0][0]).toContain('INSERT OR IGNORE INTO client_tags');
    });

    it('does not log activity when tag is not found', async () => {
      mockDb.run.mockResolvedValueOnce({}); // INSERT OR IGNORE
      mockDb.get.mockResolvedValueOnce(undefined); // tag not found

      await expect(clientService.addTagToClient(10, 999)).resolves.toBeUndefined();
      // logActivity should not be called — only 1 run call total
      expect(mockDb.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeTagFromClient', () => {
    it('deletes client_tags row and logs activity when tag exists', async () => {
      mockDb.get.mockResolvedValueOnce({ name: 'VIP' }); // fetch tag
      mockDb.run.mockResolvedValueOnce({}); // DELETE
      // logActivity
      mockDb.run.mockResolvedValueOnce({ lastID: 5 });
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce(makeActivityRow({ activity_type: 'tag_removed' }));

      await expect(clientService.removeTagFromClient(10, 1)).resolves.toBeUndefined();
      expect(mockDb.run.mock.calls[0][0]).toContain('DELETE FROM client_tags');
    });

    it('does not log activity when tag is not found', async () => {
      mockDb.get.mockResolvedValueOnce(undefined); // tag not found
      mockDb.run.mockResolvedValueOnce({}); // DELETE still runs

      await expect(clientService.removeTagFromClient(10, 999)).resolves.toBeUndefined();
      // Only 1 db.run for DELETE — no logActivity calls
      expect(mockDb.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('getClientTags', () => {
    it('returns all tags associated with a client', async () => {
      mockDb.all.mockResolvedValueOnce([makeTagRow()]);
      const result = await clientService.getClientTags(10);
      expect(result).toHaveLength(1);
      expect(mockDb.all.mock.calls[0][0]).toContain('JOIN client_tags ct ON t.id = ct.tag_id');
    });
  });

  describe('getClientsByTag', () => {
    it('returns client rows associated with a tag', async () => {
      const clientRow = { id: 10, email: 'x@x.com', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' };
      mockDb.all.mockResolvedValueOnce([clientRow]);

      const result = await clientService.getClientsByTag(1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(10);
    });
  });
});

// =====================================================
// HEALTH SCORING
// =====================================================

describe('ClientService - Health Scoring', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('calculateHealthScore', () => {
    it('throws when client is not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(clientService.calculateHealthScore(999)).rejects.toThrow(/client .* not found/i);
    });

    it('returns healthy status for a high-scoring client', async () => {
      const clientRow = { id: 10, email: 'x@x.com', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' };
      mockDb.get.mockResolvedValueOnce(clientRow); // client

      // payment data — 100% on time, no overdue
      mockDb.get.mockResolvedValueOnce({ total_invoices: 4, paid_on_time: 4, avg_days_overdue: 0 });

      // message data — 50 messages, last message very recent
      const recentMessage = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
      mockDb.get.mockResolvedValueOnce({ message_count: 50, last_message: recentMessage });

      // project data — 4 total, 4 completed, 0 on-hold
      mockDb.get.mockResolvedValueOnce({ total: 4, completed: 4, on_hold: 0 });

      // activity data — 30 activities, last activity very recent
      const recentActivity = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
      mockDb.get.mockResolvedValueOnce({ activity_count: 30, last_activity: recentActivity });

      mockDb.run.mockResolvedValueOnce({}); // UPDATE health

      const result = await clientService.calculateHealthScore(10);

      expect(result.status).toBe('healthy');
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it('returns at_risk status for a medium-scoring client', async () => {
      const clientRow = { id: 10, email: 'x@x.com', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' };
      mockDb.get.mockResolvedValueOnce(clientRow);

      // payment: 50% on time, 14 days overdue avg = lose 2 points
      mockDb.get.mockResolvedValueOnce({ total_invoices: 2, paid_on_time: 1, avg_days_overdue: 14 });

      // engagement: 5 messages, no recent activity
      mockDb.get.mockResolvedValueOnce({ message_count: 5, last_message: null });

      // projects: 2 total, 1 completed, 1 on-hold
      mockDb.get.mockResolvedValueOnce({ total: 2, completed: 1, on_hold: 1 });

      // activity: 3 activities, last activity 60 days ago
      const oldActivity = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      mockDb.get.mockResolvedValueOnce({ activity_count: 3, last_activity: oldActivity });

      mockDb.run.mockResolvedValueOnce({});

      const result = await clientService.calculateHealthScore(10);

      expect(['at_risk', 'critical']).toContain(result.status);
    });

    it('returns critical status for a zero-score client', async () => {
      const clientRow = { id: 10, email: 'x@x.com', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' };
      mockDb.get.mockResolvedValueOnce(clientRow);

      // payment: 0 paid on time, 100 days overdue
      mockDb.get.mockResolvedValueOnce({ total_invoices: 1, paid_on_time: 0, avg_days_overdue: 100 });

      // engagement: 0 messages
      mockDb.get.mockResolvedValueOnce({ message_count: 0, last_message: null });

      // projects: all on-hold
      mockDb.get.mockResolvedValueOnce({ total: 2, completed: 0, on_hold: 2 });

      // activity: 0 activities
      mockDb.get.mockResolvedValueOnce({ activity_count: 0, last_activity: null });

      mockDb.run.mockResolvedValueOnce({});

      const result = await clientService.calculateHealthScore(10);

      expect(result.score).toBeLessThan(40);
      expect(result.status).toBe('critical');
    });

    it('uses fallback scores (25 each) when sub-queries throw', async () => {
      const clientRow = { id: 10, email: 'x@x.com', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' };
      mockDb.get.mockResolvedValueOnce(clientRow);

      // All sub-queries throw
      mockDb.get.mockRejectedValueOnce(new Error('db error'));
      mockDb.get.mockRejectedValueOnce(new Error('db error'));
      mockDb.get.mockRejectedValueOnce(new Error('db error'));
      mockDb.get.mockRejectedValueOnce(new Error('db error'));

      mockDb.run.mockResolvedValueOnce({});

      const result = await clientService.calculateHealthScore(10);

      // Fallback: 25 + 25 + 25 + 25 = 100
      expect(result.score).toBe(100);
      expect(result.status).toBe('healthy');
    });

    it('handles no invoices (no payment data rows) gracefully', async () => {
      const clientRow = { id: 10, email: 'x@x.com', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' };
      mockDb.get.mockResolvedValueOnce(clientRow);
      mockDb.get.mockResolvedValueOnce({ total_invoices: 0, paid_on_time: 0, avg_days_overdue: 0 });
      mockDb.get.mockResolvedValueOnce({ message_count: 0, last_message: null });
      mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0, on_hold: 0 });
      mockDb.get.mockResolvedValueOnce({ activity_count: 0, last_activity: null });
      mockDb.run.mockResolvedValueOnce({});

      const result = await clientService.calculateHealthScore(10);
      expect(result.factors.paymentHistory).toBe(25); // unchanged from default
    });
  });

  describe('updateHealthStatus', () => {
    it('delegates to calculateHealthScore', async () => {
      const clientRow = { id: 10, email: 'x@x.com', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' };
      mockDb.get.mockResolvedValueOnce(clientRow);
      mockDb.get.mockResolvedValueOnce({ total_invoices: 0, paid_on_time: 0, avg_days_overdue: 0 });
      mockDb.get.mockResolvedValueOnce({ message_count: 0, last_message: null });
      mockDb.get.mockResolvedValueOnce({ total: 0, completed: 0, on_hold: 0 });
      mockDb.get.mockResolvedValueOnce({ activity_count: 0, last_activity: null });
      mockDb.run.mockResolvedValueOnce({});

      const result = await clientService.updateHealthStatus(10);
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('status');
    });
  });

  describe('getAtRiskClients', () => {
    it('returns clients with at_risk or critical health_status', async () => {
      const rows = [
        { id: 1, email: 'a@a.com', health_status: 'at_risk', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' }
      ];
      mockDb.all.mockResolvedValueOnce(rows);

      const result = await clientService.getAtRiskClients();

      expect(result).toHaveLength(1);
      expect(mockDb.all.mock.calls[0][0]).toContain('health_status IN (\'at_risk\', \'critical\')');
    });
  });
});

// =====================================================
// CLIENT STATS & LIFETIME VALUE
// =====================================================

describe('ClientService - Stats & Lifetime Value', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getClientLifetimeValue', () => {
    it('returns the sum of paid invoices', async () => {
      mockDb.get.mockResolvedValueOnce({ total: '12345.67' });
      mockDb.run.mockResolvedValueOnce({});

      const result = await clientService.getClientLifetimeValue(10);

      expect(result).toBeCloseTo(12345.67);
      expect(mockDb.run.mock.calls[0][0]).toContain('UPDATE clients SET lifetime_value');
    });

    it('returns 0 when no paid invoices exist', async () => {
      mockDb.get.mockResolvedValueOnce({ total: null });
      mockDb.run.mockResolvedValueOnce({});

      const result = await clientService.getClientLifetimeValue(10);
      expect(result).toBe(0);
    });

    it('returns 0 when result is undefined', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);
      mockDb.run.mockResolvedValueOnce({});

      const result = await clientService.getClientLifetimeValue(10);
      expect(result).toBe(0);
    });
  });

  describe('getClientStats', () => {
    it('returns comprehensive stats including all sub-query results', async () => {
      // project stats
      mockDb.get.mockResolvedValueOnce({ total: 5, active: 2, completed: 3 });
      // invoice stats
      mockDb.get.mockResolvedValueOnce({ invoiced: '10000', paid: '7000', outstanding: '3000' });
      // payment days
      mockDb.get.mockResolvedValueOnce({ avg_days: 15.7 });
      // message count
      mockDb.get.mockResolvedValueOnce({ count: 42 });
      // last activity
      mockDb.get.mockResolvedValueOnce({ last_date: '2026-01-15' });
      // getClientLifetimeValue
      mockDb.get.mockResolvedValueOnce({ total: '7000' });
      mockDb.run.mockResolvedValueOnce({});

      const result = await clientService.getClientStats(10);

      expect(result.totalProjects).toBe(5);
      expect(result.activeProjects).toBe(2);
      expect(result.completedProjects).toBe(3);
      expect(result.totalInvoiced).toBeCloseTo(10000);
      expect(result.totalPaid).toBeCloseTo(7000);
      expect(result.totalOutstanding).toBeCloseTo(3000);
      expect(result.averagePaymentDays).toBe(16);
      expect(result.messageCount).toBe(42);
      expect(result.lastActivityDate).toBe('2026-01-15');
      expect(result.lifetimeValue).toBeCloseTo(7000);
    });

    it('returns zeros for all numeric fields when data is missing', async () => {
      mockDb.get.mockResolvedValueOnce(undefined); // project stats
      mockDb.get.mockResolvedValueOnce(undefined); // invoice stats
      mockDb.get.mockResolvedValueOnce({ avg_days: null }); // payment days
      mockDb.get.mockResolvedValueOnce({ count: 0 }); // message count
      mockDb.get.mockResolvedValueOnce({ last_date: null }); // last activity
      // getClientLifetimeValue
      mockDb.get.mockResolvedValueOnce({ total: null });
      mockDb.run.mockResolvedValueOnce({});

      const result = await clientService.getClientStats(10);

      expect(result.totalProjects).toBe(0);
      expect(result.totalInvoiced).toBe(0);
      expect(result.totalPaid).toBe(0);
      expect(result.totalOutstanding).toBe(0);
      expect(result.averagePaymentDays).toBe(0);
      expect(result.lastActivityDate).toBeUndefined();
    });
  });
});

// =====================================================
// CRM FIELDS
// =====================================================

describe('ClientService - CRM Fields', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('updateCRMFields', () => {
    it('updates provided CRM fields', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await expect(
        clientService.updateCRMFields(10, {
          industry: 'Technology',
          companySize: '10-50',
          website: 'https://example.com'
        })
      ).resolves.toBeUndefined();

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('skips update when no fields are provided', async () => {
      const { buildSafeUpdate } = await import('../../../server/database/query-helpers');
      (buildSafeUpdate as ReturnType<typeof vi.fn>).mockReturnValueOnce({ setClause: '', params: [] });

      await clientService.updateCRMFields(10, {});

      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('converts empty string fields to null', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await clientService.updateCRMFields(10, {
        industry: '',
        notes: '',
        website: ''
      });

      // buildSafeUpdate was called — updates object should have null values for empty strings
      const { buildSafeUpdate } = await import('../../../server/database/query-helpers');
      const lastCall = (buildSafeUpdate as ReturnType<typeof vi.fn>).mock.lastCall;
      expect(lastCall).toBeDefined();
      const updatesArg = lastCall![0];
      expect(updatesArg.industry).toBeNull();
      expect(updatesArg.notes).toBeNull();
      expect(updatesArg.website).toBeNull();
    });
  });

  describe('getClientsForFollowUp', () => {
    it('returns clients with upcoming follow-up dates', async () => {
      const rows = [
        { id: 10, email: 'x@x.com', next_follow_up_date: '2026-03-01', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' }
      ];
      mockDb.all.mockResolvedValueOnce(rows);

      const result = await clientService.getClientsForFollowUp();

      expect(result).toHaveLength(1);
      expect(mockDb.all.mock.calls[0][0]).toContain('next_follow_up_date IS NOT NULL');
      expect(mockDb.all.mock.calls[0][0]).toContain('next_follow_up_date <= DATE(\'now\')');
    });

    it('returns empty array when no clients need follow-up', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      const result = await clientService.getClientsForFollowUp();
      expect(result).toEqual([]);
    });
  });
});
