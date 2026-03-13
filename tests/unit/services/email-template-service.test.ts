/**
 * ===============================================
 * UNIT TESTS - EMAIL TEMPLATE SERVICE
 * ===============================================
 * @file tests/unit/services/email-template-service.test.ts
 *
 * Tests for email template management service including:
 * - Template CRUD operations
 * - Versioning (create, get, restore)
 * - Preview and variable interpolation
 * - Send logging
 * - Helper utilities (generateSampleData, getCategories)
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

vi.mock('../../../server/utils/safe-json', () => ({
  safeJsonParseArray: vi.fn((val: string) => {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }),
  safeJsonParseOrNull: vi.fn((val: string) => {
    try {
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  })
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Import service after mocks
import { emailTemplateService } from '../../../server/services/email-template-service';
import type { EmailTemplate, EmailTemplateVersion } from '../../../server/services/email-template-service';

// ============================================
// Shared Test Data
// ============================================

const makeDbRow = (overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  id: 1,
  name: 'Welcome Email',
  description: 'Sent on signup',
  category: 'notification',
  subject: 'Welcome, {{client.name}}!',
  body_html: '<p>Hello {{client.name}}</p>',
  body_text: 'Hello {{client.name}}',
  variables: JSON.stringify([{ name: 'client.name', description: 'Client full name' }]),
  is_active: 1,
  is_system: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeTemplate = (overrides: Partial<EmailTemplate> = {}): EmailTemplate => ({
  id: 1,
  name: 'Welcome Email',
  description: 'Sent on signup',
  category: 'notification',
  subject: 'Welcome, {{client.name}}!',
  body_html: '<p>Hello {{client.name}}</p>',
  body_text: 'Hello {{client.name}}',
  variables: [{ name: 'client.name', description: 'Client full name' }],
  is_active: true,
  is_system: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeVersion = (overrides: Partial<EmailTemplateVersion> = {}): EmailTemplateVersion => ({
  id: 1,
  template_id: 1,
  version: 1,
  subject: 'Welcome!',
  body_html: '<p>Hello</p>',
  body_text: null,
  changed_by: 'admin@example.com',
  change_reason: 'Initial version',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

// ============================================
// TEMPLATE CRUD
// ============================================

describe('EmailTemplateService - getTemplates', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns all templates without category filter', async () => {
    mockDb.all.mockResolvedValueOnce([makeDbRow(), makeDbRow({ id: 2, name: 'Invoice Email' })]);

    const result = await emailTemplateService.getTemplates();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Welcome Email');
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('FROM email_templates'),
      []
    );
  });

  it('filters templates by category when provided', async () => {
    mockDb.all.mockResolvedValueOnce([makeDbRow()]);

    const result = await emailTemplateService.getTemplates('notification');

    expect(result).toHaveLength(1);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE category = ?'),
      ['notification']
    );
  });

  it('returns empty array when no templates found', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    const result = await emailTemplateService.getTemplates();
    expect(result).toEqual([]);
  });

  it('correctly parses is_active and is_system as booleans', async () => {
    mockDb.all.mockResolvedValueOnce([makeDbRow({ is_active: 0, is_system: 1 })]);
    const result = await emailTemplateService.getTemplates();
    expect(result[0].is_active).toBe(false);
    expect(result[0].is_system).toBe(true);
  });

  it('parses variables from JSON string', async () => {
    const vars = [{ name: 'client.name', description: 'Client name' }];
    mockDb.all.mockResolvedValueOnce([makeDbRow({ variables: JSON.stringify(vars) })]);
    const result = await emailTemplateService.getTemplates();
    expect(result[0].variables).toEqual(vars);
  });
});

describe('EmailTemplateService - getTemplate', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns a template by ID', async () => {
    mockDb.get.mockResolvedValueOnce(makeDbRow());
    const result = await emailTemplateService.getTemplate(1);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
    expect(result!.name).toBe('Welcome Email');
  });

  it('returns null when template not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    const result = await emailTemplateService.getTemplate(999);
    expect(result).toBeNull();
  });
});

describe('EmailTemplateService - getTemplateByName', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns a template by name', async () => {
    mockDb.get.mockResolvedValueOnce(makeDbRow());
    const result = await emailTemplateService.getTemplateByName('Welcome Email');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Welcome Email');
    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('WHERE name = ?'),
      ['Welcome Email']
    );
  });

  it('returns null when template not found by name', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    const result = await emailTemplateService.getTemplateByName('Nonexistent');
    expect(result).toBeNull();
  });
});

describe('EmailTemplateService - createTemplate', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('creates a template with all required fields', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    // getTemplate call inside createTemplate
    mockDb.get.mockResolvedValueOnce(makeDbRow());
    // createVersion -> getDatabase -> get (MAX version)
    mockDb.get.mockResolvedValueOnce({ max_version: null });
    // createVersion -> run (INSERT version)
    mockDb.run.mockResolvedValueOnce({ lastID: 10 });

    const result = await emailTemplateService.createTemplate({
      name: 'Welcome Email',
      subject: 'Welcome!',
      body_html: '<p>Welcome</p>'
    });

    expect(result).not.toBeNull();
    expect(result.name).toBe('Welcome Email');
    expect(mockDb.run).toHaveBeenCalled();
  });

  it('defaults category to general when not provided', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 2 });
    mockDb.get.mockResolvedValueOnce(makeDbRow({ category: 'general' }));
    mockDb.get.mockResolvedValueOnce({ max_version: null });
    mockDb.run.mockResolvedValueOnce({ lastID: 10 });

    await emailTemplateService.createTemplate({
      name: 'New Template',
      subject: 'Hello',
      body_html: '<p>Hello</p>'
    });

    const insertCall = mockDb.run.mock.calls[0];
    expect(insertCall[1]).toContain('general');
  });

  it('defaults is_active to true when not explicitly false', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.get.mockResolvedValueOnce(makeDbRow());
    mockDb.get.mockResolvedValueOnce({ max_version: null });
    mockDb.run.mockResolvedValueOnce({ lastID: 10 });

    await emailTemplateService.createTemplate({
      name: 'Active Template',
      subject: 'Hi',
      body_html: '<p>Hi</p>'
    });

    const insertCall = mockDb.run.mock.calls[0];
    // is_active = data.is_active !== false => true (truthy)
    expect(insertCall[1]).toContain(true);
  });

  it('sets is_active to false when explicitly false', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.get.mockResolvedValueOnce(makeDbRow({ is_active: 0 }));
    mockDb.get.mockResolvedValueOnce({ max_version: null });
    mockDb.run.mockResolvedValueOnce({ lastID: 10 });

    await emailTemplateService.createTemplate({
      name: 'Inactive Template',
      subject: 'Hi',
      body_html: '<p>Hi</p>',
      is_active: false
    });

    const insertCall = mockDb.run.mock.calls[0];
    expect(insertCall[1]).toContain(false);
  });

  it('throws when insert returns no lastID', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 0 });

    await expect(
      emailTemplateService.createTemplate({
        name: 'Fail Template',
        subject: 'Hi',
        body_html: '<p>Hi</p>'
      })
    ).rejects.toThrow('Failed to create template');
  });

  it('throws when getTemplate returns null after insert', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.get.mockResolvedValueOnce(undefined);

    await expect(
      emailTemplateService.createTemplate({
        name: 'Ghost Template',
        subject: 'Hi',
        body_html: '<p>Hi</p>'
      })
    ).rejects.toThrow('Failed to create template');
  });

  it('creates initial version with incremented version number', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.get.mockResolvedValueOnce(makeDbRow());
    mockDb.get.mockResolvedValueOnce({ max_version: 3 });
    mockDb.run.mockResolvedValueOnce({ lastID: 10 });

    await emailTemplateService.createTemplate(
      { name: 'Versioned', subject: 'Hi', body_html: '<p>Hi</p>' },
      'admin@example.com'
    );

    const versionInsert = mockDb.run.mock.calls[1];
    expect(versionInsert[1]).toContain(4); // max_version 3 + 1 = 4
    expect(versionInsert[1]).toContain('admin@example.com');
    expect(versionInsert[1]).toContain('Initial version');
  });
});

describe('EmailTemplateService - updateTemplate', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns null when template not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    const result = await emailTemplateService.updateTemplate(999, { name: 'New Name' });
    expect(result).toBeNull();
  });

  it('returns existing template when no fields provided', async () => {
    const existing = makeTemplate();
    mockDb.get.mockResolvedValueOnce(makeDbRow());

    const result = await emailTemplateService.updateTemplate(1, {});

    expect(result).not.toBeNull();
    expect(mockDb.run).not.toHaveBeenCalled();
    expect(result!.name).toBe(existing.name);
  });

  it('throws when trying to rename a system template', async () => {
    mockDb.get.mockResolvedValueOnce(makeDbRow({ is_system: 1, name: 'System Template' }));

    await expect(
      emailTemplateService.updateTemplate(1, { name: 'New Name' })
    ).rejects.toThrow('Cannot change the name of a system template');
  });

  it('allows updating system template name to the same name', async () => {
    mockDb.get
      .mockResolvedValueOnce(makeDbRow({ is_system: 1, name: 'System Template' }))
      .mockResolvedValueOnce(makeDbRow({ is_system: 1, name: 'System Template' }));
    mockDb.run.mockResolvedValueOnce({});

    // does NOT create a version (no content fields changed)
    const result = await emailTemplateService.updateTemplate(1, { name: 'System Template' });
    expect(result).not.toBeNull();
  });

  it('updates provided fields and calls db.run', async () => {
    mockDb.get
      .mockResolvedValueOnce(makeDbRow())
      .mockResolvedValueOnce(makeDbRow({ subject: 'Updated Subject' }));
    mockDb.run.mockResolvedValueOnce({});
    // createVersion path
    mockDb.get.mockResolvedValueOnce({ max_version: 1 });
    mockDb.run.mockResolvedValueOnce({ lastID: 2 });

    const result = await emailTemplateService.updateTemplate(
      1,
      { subject: 'Updated Subject' },
      'admin@example.com',
      'Changed subject'
    );

    expect(mockDb.run).toHaveBeenCalled();
    expect(result!.subject).toBe('Updated Subject');
  });

  it('creates a version when body_html is changed', async () => {
    mockDb.get
      .mockResolvedValueOnce(makeDbRow())
      .mockResolvedValueOnce(makeDbRow({ body_html: '<p>New HTML</p>' }));
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce({ max_version: 2 });
    mockDb.run.mockResolvedValueOnce({ lastID: 3 });

    await emailTemplateService.updateTemplate(1, { body_html: '<p>New HTML</p>' });

    // run called twice: once for UPDATE, once for INSERT version
    expect(mockDb.run).toHaveBeenCalledTimes(2);
  });

  it('does not create a version when only non-content fields change', async () => {
    mockDb.get
      .mockResolvedValueOnce(makeDbRow())
      .mockResolvedValueOnce(makeDbRow({ is_active: 0 }));
    mockDb.run.mockResolvedValueOnce({});

    await emailTemplateService.updateTemplate(1, { is_active: false });

    // Only one db.run call (the UPDATE), no version insert
    expect(mockDb.run).toHaveBeenCalledTimes(1);
  });

  it('updates all provided fields', async () => {
    mockDb.get
      .mockResolvedValueOnce(makeDbRow())
      .mockResolvedValueOnce(makeDbRow());
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce({ max_version: 1 });
    mockDb.run.mockResolvedValueOnce({ lastID: 2 });

    await emailTemplateService.updateTemplate(1, {
      name: 'New Name',
      description: 'New Desc',
      category: 'invoice',
      subject: 'New Subject',
      body_html: '<p>New</p>',
      body_text: 'New text',
      variables: [{ name: 'invoice.number', description: 'Invoice #' }],
      is_active: false
    });

    const updateCall = mockDb.run.mock.calls[0];
    const sql = updateCall[0] as string;
    expect(sql).toContain('name = ?');
    expect(sql).toContain('description = ?');
    expect(sql).toContain('category = ?');
    expect(sql).toContain('subject = ?');
    expect(sql).toContain('body_html = ?');
    expect(sql).toContain('body_text = ?');
    expect(sql).toContain('variables = ?');
    expect(sql).toContain('is_active = ?');
  });
});

describe('EmailTemplateService - deleteTemplate', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns false when template not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    const result = await emailTemplateService.deleteTemplate(999);
    expect(result).toBe(false);
  });

  it('throws when trying to delete a system template', async () => {
    mockDb.get.mockResolvedValueOnce(makeDbRow({ is_system: 1 }));

    await expect(emailTemplateService.deleteTemplate(1)).rejects.toThrow(
      'Cannot delete a system template'
    );
  });

  it('deletes a non-system template and returns true', async () => {
    mockDb.get.mockResolvedValueOnce(makeDbRow({ is_system: 0 }));
    mockDb.run.mockResolvedValueOnce({});

    const result = await emailTemplateService.deleteTemplate(1);

    expect(result).toBe(true);
    expect(mockDb.run).toHaveBeenCalledWith(
      'DELETE FROM email_templates WHERE id = ?',
      [1]
    );
  });
});

// ============================================
// VERSIONING
// ============================================

describe('EmailTemplateService - getVersions', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns all versions for a template', async () => {
    const versions = [makeVersion({ version: 2 }), makeVersion({ version: 1 })];
    mockDb.all.mockResolvedValueOnce(versions);

    const result = await emailTemplateService.getVersions(1);

    expect(result).toHaveLength(2);
    expect(result[0].version).toBe(2);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE template_id = ?'),
      [1]
    );
  });

  it('returns empty array when no versions exist', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    const result = await emailTemplateService.getVersions(1);
    expect(result).toEqual([]);
  });
});

describe('EmailTemplateService - getVersion', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns a specific version', async () => {
    mockDb.get.mockResolvedValueOnce(makeVersion({ version: 3 }));
    const result = await emailTemplateService.getVersion(1, 3);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(3);
  });

  it('returns null when version not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    const result = await emailTemplateService.getVersion(1, 999);
    expect(result).toBeNull();
  });
});

describe('EmailTemplateService - restoreVersion', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns null when version not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    const result = await emailTemplateService.restoreVersion(1, 999);
    expect(result).toBeNull();
  });

  it('calls updateTemplate with version content', async () => {
    const version = makeVersion({
      subject: 'Old Subject',
      body_html: '<p>Old</p>',
      body_text: 'Old text',
      version: 2
    });

    // getVersion
    mockDb.get.mockResolvedValueOnce(version);
    // updateTemplate: getTemplate (existing)
    mockDb.get.mockResolvedValueOnce(makeDbRow());
    // updateTemplate: db.run (UPDATE)
    mockDb.run.mockResolvedValueOnce({});
    // updateTemplate: getTemplate (updated)
    mockDb.get.mockResolvedValueOnce(makeDbRow({ subject: 'Old Subject' }));
    // createVersion: MAX(version)
    mockDb.get.mockResolvedValueOnce({ max_version: 2 });
    // createVersion: INSERT version
    mockDb.run.mockResolvedValueOnce({ lastID: 3 });

    const result = await emailTemplateService.restoreVersion(1, 2, 'admin@example.com');

    expect(result).not.toBeNull();
    // Verify the update SQL had the right params
    const updateCall = mockDb.run.mock.calls[0];
    expect(updateCall[1]).toContain('Old Subject');
    expect(updateCall[1]).toContain('<p>Old</p>');
  });

  it('handles version with null body_text correctly', async () => {
    const version = makeVersion({ body_text: null, version: 1 });
    mockDb.get.mockResolvedValueOnce(version);
    mockDb.get.mockResolvedValueOnce(makeDbRow());
    mockDb.run.mockResolvedValueOnce({});
    mockDb.get.mockResolvedValueOnce(makeDbRow());
    mockDb.get.mockResolvedValueOnce({ max_version: 1 });
    mockDb.run.mockResolvedValueOnce({ lastID: 2 });

    const result = await emailTemplateService.restoreVersion(1, 1);
    expect(result).not.toBeNull();
  });
});

// ============================================
// PREVIEW AND VARIABLE INTERPOLATION
// ============================================

describe('EmailTemplateService - previewTemplate', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns null when template not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    const result = await emailTemplateService.previewTemplate(999, {});
    expect(result).toBeNull();
  });

  it('interpolates variables and returns preview data', async () => {
    mockDb.get.mockResolvedValueOnce(makeDbRow());

    const result = await emailTemplateService.previewTemplate(1, {
      client: { name: 'Alice' }
    });

    expect(result).not.toBeNull();
    expect(result!.subject).toBe('Welcome, Alice!');
    expect(result!.body_html).toBe('<p>Hello Alice</p>');
    expect(result!.body_text).toBe('Hello Alice');
  });

  it('returns null body_text when template has no body_text', async () => {
    mockDb.get.mockResolvedValueOnce(makeDbRow({ body_text: null }));

    const result = await emailTemplateService.previewTemplate(1, { client: { name: 'Bob' } });

    expect(result!.body_text).toBeNull();
  });
});

describe('EmailTemplateService - previewContent', () => {
  it('interpolates subject, body_html, and body_text with sample data', () => {
    const result = emailTemplateService.previewContent(
      'Hello {{name}}',
      '<p>Dear {{name}}</p>',
      'Dear {{name}}',
      { name: 'Jane' }
    );

    expect(result.subject).toBe('Hello Jane');
    expect(result.body_html).toBe('<p>Dear Jane</p>');
    expect(result.body_text).toBe('Dear Jane');
  });

  it('returns null body_text when null passed', () => {
    const result = emailTemplateService.previewContent('Hi', '<p>Hi</p>', null, {});
    expect(result.body_text).toBeNull();
  });
});

describe('EmailTemplateService - interpolate', () => {
  it('replaces simple variable placeholders', () => {
    const result = emailTemplateService.interpolate('Hello {{name}}', { name: 'World' });
    expect(result).toBe('Hello World');
  });

  it('replaces nested variable paths using dot notation', () => {
    const result = emailTemplateService.interpolate(
      '{{user.profile.email}}',
      { user: { profile: { email: 'test@test.com' } } }
    );
    expect(result).toBe('test@test.com');
  });

  it('leaves placeholder unchanged when variable not found', () => {
    const result = emailTemplateService.interpolate('Hello {{missing}}', {});
    expect(result).toBe('Hello {{missing}}');
  });

  it('HTML-escapes interpolated values to prevent XSS', () => {
    const result = emailTemplateService.interpolate('{{val}}', {
      val: '<script>alert("xss")</script>'
    });
    expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes all HTML special characters', () => {
    const result = emailTemplateService.interpolate('{{val}}', { val: '& < > " \'' });
    expect(result).toBe('&amp; &lt; &gt; &quot; &#x27;');
  });

  it('handles multiple placeholders in one string', () => {
    const result = emailTemplateService.interpolate(
      '{{first}} and {{second}}',
      { first: 'Alpha', second: 'Beta' }
    );
    expect(result).toBe('Alpha and Beta');
  });

  it('returns intermediate value as undefined when nested path is broken', () => {
    const result = emailTemplateService.interpolate('{{a.b.c}}', { a: null });
    expect(result).toBe('{{a.b.c}}');
  });
});

describe('EmailTemplateService - generateSampleData', () => {
  it('returns empty object for empty variables array', () => {
    const result = emailTemplateService.generateSampleData([]);
    expect(result).toEqual({});
  });

  it('generates sample value for email variable', () => {
    const result = emailTemplateService.generateSampleData([
      { name: 'client.email', description: 'Email address' }
    ]);
    expect(result.client).toBeDefined();
    expect((result.client as Record<string, unknown>).email).toBe('client@example.com');
  });

  it('generates sample value for client.name variable', () => {
    const result = emailTemplateService.generateSampleData([
      { name: 'client.name', description: 'Client name' }
    ]);
    expect((result.client as Record<string, unknown>).name).toBe('John Smith');
  });

  it('generates sample value for company name variable', () => {
    const result = emailTemplateService.generateSampleData([
      { name: 'company_name', description: 'Company name' }
    ]);
    expect(result.company_name).toBe('Acme Corp');
  });

  it('generates sample value for project name variable', () => {
    const result = emailTemplateService.generateSampleData([
      { name: 'project_name', description: 'Project name' }
    ]);
    expect(result.project_name).toBe('Website Redesign');
  });

  it('generates sample values for url, amount, date, number, status, message, hours', () => {
    const variables = [
      { name: 'portal_url', description: 'Portal link' },
      { name: 'invoice_amount', description: 'Total amount' },
      { name: 'due_date', description: 'Due date' },
      { name: 'invoice_number', description: 'Invoice number' },
      { name: 'project_status', description: 'Status' },
      { name: 'message_body', description: 'Message' },
      { name: 'response_hours', description: 'Response hours' }
    ];
    const result = emailTemplateService.generateSampleData(variables);

    expect(result.portal_url).toBe('https://example.com/action');
    expect(result.invoice_amount).toBe('$1,500.00');
    expect(result.due_date).toBe('January 15, 2026');
    expect(result.invoice_number).toBe('INV-2026-001');
    expect(result.project_status).toBe('Active');
    expect(result.message_body).toBe('This is a sample message for preview purposes.');
    expect(result.response_hours).toBe('24');
  });

  it('falls back to bracket notation for unknown variable names', () => {
    const result = emailTemplateService.generateSampleData([
      { name: 'some_unknown_var', description: 'Unknown' }
    ]);
    expect(result.some_unknown_var).toBe('[some_unknown_var]');
  });

  it('builds nested objects for dot-notation variable names', () => {
    const result = emailTemplateService.generateSampleData([
      { name: 'a.b.c', description: 'Nested' }
    ]);
    expect((result.a as Record<string, unknown>)).toBeDefined();
    expect(((result.a as Record<string, unknown>).b as Record<string, unknown>)).toBeDefined();
  });
});

// ============================================
// SEND LOGGING
// ============================================

describe('EmailTemplateService - logSend', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('logs a send and returns the log ID', async () => {
    // getTemplateByName returns null (no template found)
    mockDb.get.mockResolvedValueOnce(undefined);
    mockDb.run.mockResolvedValueOnce({ lastID: 42 });

    const id = await emailTemplateService.logSend(
      null,
      'user@example.com',
      'User Name',
      'Test Subject',
      'sent'
    );

    expect(id).toBe(42);
  });

  it('looks up template ID when template name is provided', async () => {
    // getTemplateByName
    mockDb.get.mockResolvedValueOnce(makeDbRow({ id: 5 }));
    mockDb.run.mockResolvedValueOnce({ lastID: 10 });

    const id = await emailTemplateService.logSend(
      'Welcome Email',
      'user@example.com',
      null,
      'Welcome!',
      'pending'
    );

    expect(id).toBe(10);
    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams[0]).toBe(5); // template_id from lookup
  });

  it('sets template_id to null when template name not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });

    await emailTemplateService.logSend(
      'Nonexistent Template',
      'a@b.com',
      null,
      'Hi',
      'failed'
    );

    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams[0]).toBeNull(); // template_id is null
  });

  it('sets sent_at when status is sent', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });

    await emailTemplateService.logSend(null, 'a@b.com', null, 'Hi', 'sent');

    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams[8]).not.toBeNull(); // sent_at is set
  });

  it('sets sent_at to null when status is not sent', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });

    await emailTemplateService.logSend(null, 'a@b.com', null, 'Hi', 'pending');

    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams[8]).toBeNull(); // sent_at is null
  });

  it('includes metadata as JSON string when provided', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });

    await emailTemplateService.logSend(
      null, 'a@b.com', null, 'Hi', 'sent',
      undefined,
      { projectId: 123 }
    );

    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams[7]).toBe(JSON.stringify({ projectId: 123 }));
  });

  it('throws when insert returns no lastID', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    mockDb.run.mockResolvedValueOnce({ lastID: 0 });

    await expect(
      emailTemplateService.logSend(null, 'a@b.com', null, 'Hi', 'sent')
    ).rejects.toThrow('Failed to log email send');
  });

  it('includes errorMessage in insert when provided', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });

    await emailTemplateService.logSend(null, 'a@b.com', null, 'Hi', 'failed', 'SMTP error');

    const insertParams = mockDb.run.mock.calls[0][1];
    expect(insertParams[6]).toBe('SMTP error');
  });
});

describe('EmailTemplateService - updateSendLog', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('updates the send log status to sent', async () => {
    mockDb.run.mockResolvedValueOnce({});
    await emailTemplateService.updateSendLog(1, 'sent');

    const params = mockDb.run.mock.calls[0][1];
    expect(params[0]).toBe('sent');
    expect(params[2]).not.toBeNull(); // sent_at is set
    expect(params[3]).toBe(1); // id
  });

  it('updates the send log status to failed with null sent_at', async () => {
    mockDb.run.mockResolvedValueOnce({});
    await emailTemplateService.updateSendLog(1, 'failed', 'Connection refused');

    const params = mockDb.run.mock.calls[0][1];
    expect(params[0]).toBe('failed');
    expect(params[1]).toBe('Connection refused');
    expect(params[2]).toBeNull(); // sent_at is null for failed
  });

  it('updates status to bounced', async () => {
    mockDb.run.mockResolvedValueOnce({});
    await emailTemplateService.updateSendLog(5, 'bounced');

    const params = mockDb.run.mock.calls[0][1];
    expect(params[0]).toBe('bounced');
    expect(params[3]).toBe(5);
  });
});

describe('EmailTemplateService - getSendLogs', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  const makeLogRow = (overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
    id: 1,
    template_id: 1,
    template_name: 'Welcome Email',
    recipient_email: 'user@example.com',
    recipient_name: 'User',
    subject: 'Welcome!',
    status: 'sent',
    error_message: null,
    metadata: null,
    sent_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides
  });

  it('returns all logs without filters', async () => {
    mockDb.all.mockResolvedValueOnce([makeLogRow()]);
    const result = await emailTemplateService.getSendLogs();
    expect(result).toHaveLength(1);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('FROM email_send_logs WHERE 1=1'),
      []
    );
  });

  it('filters by templateId', async () => {
    mockDb.all.mockResolvedValueOnce([makeLogRow()]);
    await emailTemplateService.getSendLogs({ templateId: 5 });

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('template_id = ?'),
      expect.arrayContaining([5])
    );
  });

  it('filters by recipientEmail', async () => {
    mockDb.all.mockResolvedValueOnce([makeLogRow()]);
    await emailTemplateService.getSendLogs({ recipientEmail: 'user@example.com' });

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('recipient_email = ?'),
      expect.arrayContaining(['user@example.com'])
    );
  });

  it('filters by status', async () => {
    mockDb.all.mockResolvedValueOnce([makeLogRow()]);
    await emailTemplateService.getSendLogs({ status: 'failed' });

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('status = ?'),
      expect.arrayContaining(['failed'])
    );
  });

  it('applies LIMIT when provided', async () => {
    mockDb.all.mockResolvedValueOnce([makeLogRow()]);
    await emailTemplateService.getSendLogs({ limit: 10 });

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT ?'),
      expect.arrayContaining([10])
    );
  });

  it('parses metadata from JSON string', async () => {
    mockDb.all.mockResolvedValueOnce([makeLogRow({ metadata: JSON.stringify({ key: 'value' }) })]);

    const result = await emailTemplateService.getSendLogs();
    expect(result[0].metadata).toEqual({ key: 'value' });
  });

  it('applies all filters together', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    await emailTemplateService.getSendLogs({
      templateId: 1,
      recipientEmail: 'a@b.com',
      status: 'sent',
      limit: 5
    });

    const [sql, params] = mockDb.all.mock.calls[0];
    expect(sql).toContain('template_id = ?');
    expect(sql).toContain('recipient_email = ?');
    expect(sql).toContain('status = ?');
    expect(sql).toContain('LIMIT ?');
    expect(params).toContain(1);
    expect(params).toContain('a@b.com');
    expect(params).toContain('sent');
    expect(params).toContain(5);
  });
});

// ============================================
// HELPERS
// ============================================

describe('EmailTemplateService - getCategories', () => {
  it('returns all 6 category options', () => {
    const categories = emailTemplateService.getCategories();
    expect(categories).toHaveLength(6);

    const values = categories.map((c) => c.value);
    expect(values).toContain('notification');
    expect(values).toContain('invoice');
    expect(values).toContain('contract');
    expect(values).toContain('project');
    expect(values).toContain('reminder');
    expect(values).toContain('general');
  });

  it('each category has a value and label', () => {
    const categories = emailTemplateService.getCategories();
    for (const cat of categories) {
      expect(cat.value).toBeTruthy();
      expect(cat.label).toBeTruthy();
    }
  });
});
