/**
 * ===============================================
 * UNIT TESTS - SLACK/DISCORD SERVICE
 * ===============================================
 * @file tests/unit/services/slack-service.test.ts
 *
 * Tests for Slack and Discord notification service including:
 * - formatSlackMessage
 * - formatDiscordMessage
 * - sendSlackNotification
 * - sendDiscordNotification
 * - saveNotificationConfig (create + update)
 * - getNotificationConfigs
 * - deleteNotificationConfig
 * - testNotification
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

// ============================================
// MOCK SETUP
// ============================================

const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn()
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb)
}));

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

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock the global fetch used by sendSlackNotification / sendDiscordNotification
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ============================================
// IMPORTS (after mocks)
// ============================================

import {
  formatSlackMessage,
  formatDiscordMessage,
  sendSlackNotification,
  sendDiscordNotification,
  saveNotificationConfig,
  getNotificationConfigs,
  deleteNotificationConfig,
  testNotification,
  type NotificationConfig,
  type SlackMessage,
  type DiscordMessage
} from '../../../server/services/integrations/slack-service';

// ============================================
// HELPERS
// ============================================

function makeMockResponse(ok: boolean, body: unknown, status = 200): Response {
  return {
    ok,
    status,
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response;
}

const baseSlackConfig: NotificationConfig = {
  name: 'Test Slack',
  platform: 'slack',
  webhook_url: 'https://hooks.slack.com/test',
  channel: '#general',
  events: ['invoice.created', 'project.completed'],
  is_active: true
};

const baseDiscordConfig: NotificationConfig = {
  name: 'Test Discord',
  platform: 'discord',
  webhook_url: 'https://discord.com/api/webhooks/test',
  events: ['invoice.paid'],
  is_active: true
};

// ============================================
// TESTS: formatSlackMessage
// ============================================

describe('formatSlackMessage', () => {
  it('returns a message with text and blocks', () => {
    const result = formatSlackMessage('invoice.created', {
      invoice: { id: 1, number: 'INV-001', client_name: 'Acme', amount: 500 }
    });

    expect(result.text).toBeTruthy();
    expect(Array.isArray(result.blocks)).toBe(true);
    expect(result.blocks!.length).toBeGreaterThan(0);
  });

  it('first block is a header block', () => {
    const result = formatSlackMessage('invoice.created', {
      invoice: { number: 'INV-001', client_name: 'Test' }
    });

    expect(result.blocks![0].type).toBe('header');
    expect(result.blocks![0].text?.text).toContain('Invoice');
  });

  it('uses bell emoji for unknown event types', () => {
    const result = formatSlackMessage('unknown.event', {});
    expect(result.text).toContain(':bell:');
  });

  it('uses known emoji for invoice.paid', () => {
    const result = formatSlackMessage('invoice.paid', {
      invoice: { number: 'INV-001', amount_paid: 500 }
    });
    expect(result.text).toContain(':white_check_mark:');
  });

  it('adds a context block with timestamp', () => {
    const result = formatSlackMessage('task.completed', {
      task: { title: 'Write tests' }
    });

    const contextBlock = result.blocks!.find((b) => b.type === 'context');
    expect(contextBlock).toBeDefined();
    expect(contextBlock!.elements![0].text).toContain('No Bhad Codes');
  });

  it('adds actions block when includeLink is provided', () => {
    const result = formatSlackMessage(
      'project.completed',
      { project: { name: 'My Project' } },
      { includeLink: 'https://example.com/projects/1' }
    );

    const actionsBlock = result.blocks!.find((b) => b.type === 'actions');
    expect(actionsBlock).toBeDefined();
  });

  it('does not add actions block when no link is provided', () => {
    const result = formatSlackMessage('project.completed', { project: { name: 'My Project' } });

    const actionsBlock = result.blocks!.find((b) => b.type === 'actions');
    expect(actionsBlock).toBeUndefined();
  });

  it('passes channel through to result', () => {
    const result = formatSlackMessage('client.created', { client: { name: 'NewCo' } }, { channel: '#clients' });
    expect(result.channel).toBe('#clients');
  });

  it('builds fields section when entity has recognized keys', () => {
    const result = formatSlackMessage('invoice.created', {
      invoice: {
        number: 'INV-005',
        client_name: 'Acme',
        amount: 2500,
        status: 'pending'
      }
    });

    const sectionWithFields = result.blocks!.find((b) => b.type === 'section' && b.fields);
    expect(sectionWithFields).toBeDefined();
    expect(sectionWithFields!.fields!.length).toBeGreaterThan(0);
  });

  it('formats currency fields correctly in slack fields', () => {
    const result = formatSlackMessage('invoice.created', {
      invoice: { amount: 1234.56, client_name: 'Test' }
    });

    const sectionWithFields = result.blocks!.find((b) => b.fields);
    const amountField = sectionWithFields?.fields?.find((f) => f.text.includes('Amount'));
    expect(amountField?.text).toContain('$1,234.56');
  });

  it('generates correct summary for project.created event', () => {
    const result = formatSlackMessage('project.created', {
      project: { name: 'New Site', client_name: 'Acme' }
    });
    expect(result.text).toContain('New Site');
  });

  it('generates correct summary for contract.signed event', () => {
    const result = formatSlackMessage('contract.signed', {
      contract: { project_name: 'My Project', signer_name: 'Jane' }
    });
    expect(result.text).toContain('My Project');
  });

  it('generates correct summary for milestone.completed event', () => {
    const result = formatSlackMessage('milestone.completed', {
      milestone: { title: 'Phase 1', project_name: 'Big Project' }
    });
    expect(result.text).toContain('Phase 1');
  });

  it('falls back to generic summary for unmapped event', () => {
    const result = formatSlackMessage('widget.exploded', {});
    expect(result.text).toContain('widget.exploded');
  });
});

// ============================================
// TESTS: formatDiscordMessage
// ============================================

describe('formatDiscordMessage', () => {
  it('returns a message with content and embeds', () => {
    const result = formatDiscordMessage('invoice.paid', {
      invoice: { number: 'INV-001', amount_paid: 1000 }
    });

    expect(result.content).toBeTruthy();
    expect(Array.isArray(result.embeds)).toBe(true);
    expect(result.embeds!.length).toBe(1);
  });

  it('embed has title matching the event category and action', () => {
    const result = formatDiscordMessage('project.completed', {
      project: { name: 'Done Project' }
    });

    expect(result.embeds![0].title).toContain('Project');
    expect(result.embeds![0].title).toContain('Completed');
  });

  it('embed includes footer with brand name', () => {
    const result = formatDiscordMessage('client.created', { client: { name: 'NewCo' } });
    expect(result.embeds![0].footer?.text).toBe('No Bhad Codes');
  });

  it('embed includes timestamp', () => {
    const result = formatDiscordMessage('lead.created', { lead: { name: 'Prospect' } });
    expect(result.embeds![0].timestamp).toBeTruthy();
  });

  it('adds url to embed when includeLink is provided', () => {
    const result = formatDiscordMessage(
      'proposal.accepted',
      { proposal: { project_name: 'Design', total_price: 3000 } },
      { includeLink: 'https://example.com/proposals/5' }
    );
    expect(result.embeds![0].url).toBe('https://example.com/proposals/5');
  });

  it('does not set url on embed when no link provided', () => {
    const result = formatDiscordMessage('proposal.rejected', {
      proposal: { project_name: 'Design' }
    });
    expect(result.embeds![0].url).toBeUndefined();
  });

  it('uses success color for invoice.paid', () => {
    const result = formatDiscordMessage('invoice.paid', { invoice: { number: 'INV-001' } });
    expect(result.embeds![0].color).toBe(0x22c55e);
  });

  it('uses warning color for invoice.overdue', () => {
    const result = formatDiscordMessage('invoice.overdue', { invoice: { number: 'INV-001', amount: 500 } });
    expect(result.embeds![0].color).toBe(0xf59e0b);
  });

  it('uses error color for proposal.rejected', () => {
    const result = formatDiscordMessage('proposal.rejected', {
      proposal: { project_name: 'Design' }
    });
    expect(result.embeds![0].color).toBe(0xef4444);
  });

  it('uses info color for unknown event types', () => {
    const result = formatDiscordMessage('unknown.event', {});
    expect(result.embeds![0].color).toBe(0x3b82f6);
  });

  it('builds inline fields for recognized entity keys', () => {
    const result = formatDiscordMessage('invoice.created', {
      invoice: { client_name: 'Test', amount: 500 }
    });

    const fields = result.embeds![0].fields!;
    expect(fields.length).toBeGreaterThan(0);
    expect(fields[0].inline).toBe(true);
  });

  it('formats currency in discord fields', () => {
    const result = formatDiscordMessage('invoice.created', {
      invoice: { total_price: 9999.99 }
    });

    const fields = result.embeds![0].fields!;
    const totalField = fields.find((f) => f.name === 'Total');
    expect(totalField?.value).toContain('$9,999.99');
  });
});

// ============================================
// TESTS: sendSlackNotification
// ============================================

describe('sendSlackNotification', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns success when fetch succeeds with 200', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(true, 'ok'));

    const result = await sendSlackNotification('https://hooks.slack.com/test', {
      text: 'Hello Slack'
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('sends POST to the provided webhook URL', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(true, 'ok'));

    await sendSlackNotification('https://hooks.slack.com/abc', { text: 'Test' });

    expect(mockFetch).toHaveBeenCalledWith('https://hooks.slack.com/abc', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' })
    }));
  });

  it('returns failure with error message when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(false, 'invalid_payload', 400));

    const result = await sendSlackNotification('https://hooks.slack.com/test', { text: 'Bad' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('400');
  });

  it('returns failure when fetch throws a network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const result = await sendSlackNotification('https://hooks.slack.com/test', { text: 'Test' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network failure');
  });

  it('returns failure with "Unknown error" for non-Error throws', async () => {
    mockFetch.mockRejectedValueOnce('some string error');

    const result = await sendSlackNotification('https://hooks.slack.com/test', { text: 'Test' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
  });

  it('serializes the full message body as JSON', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(true, 'ok'));
    const message: SlackMessage = {
      text: 'Test',
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Hello' } }],
      channel: '#general'
    };

    await sendSlackNotification('https://hooks.slack.com/test', message);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.text).toBe('Test');
    expect(callBody.channel).toBe('#general');
  });
});

// ============================================
// TESTS: sendDiscordNotification
// ============================================

describe('sendDiscordNotification', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns success when fetch succeeds', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(true, {}));

    const result = await sendDiscordNotification('https://discord.com/api/webhooks/test', {
      content: 'Hello Discord'
    });

    expect(result.success).toBe(true);
  });

  it('sends POST to the provided Discord webhook URL', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(true, {}));

    await sendDiscordNotification('https://discord.com/api/webhooks/abc', { content: 'Test' });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/abc',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns failure when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(false, 'error', 401));

    const result = await sendDiscordNotification('https://discord.com/api/webhooks/test', {
      content: 'Test'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Discord API error');
    expect(result.error).toContain('401');
  });

  it('returns failure when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('DNS failed'));

    const result = await sendDiscordNotification('https://discord.com/api/webhooks/test', {
      content: 'Test'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('DNS failed');
  });

  it('serializes embeds correctly', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(true, {}));
    const message: DiscordMessage = {
      content: 'Test',
      embeds: [{ title: 'Test Embed', description: 'desc', color: 0x22c55e }]
    };

    await sendDiscordNotification('https://discord.com/api/webhooks/test', message);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.embeds[0].title).toBe('Test Embed');
  });
});

// ============================================
// TESTS: saveNotificationConfig
// ============================================

describe('saveNotificationConfig', () => {
  beforeEach(() => {
    mockDb.run.mockReset();
    mockDb.all.mockReset();
    mockDb.get.mockReset();
  });

  it('inserts new config and returns with generated id', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 7 });

    const result = await saveNotificationConfig(baseSlackConfig);

    expect(result.id).toBe(7);
    expect(result.name).toBe('Test Slack');
    expect(result.platform).toBe('slack');
  });

  it('calls INSERT when config has no id', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 3 });

    await saveNotificationConfig({ ...baseSlackConfig, id: undefined });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO'),
      expect.arrayContaining(['Test Slack', 'slack'])
    );
  });

  it('joins events array as comma-separated string on insert', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });

    await saveNotificationConfig(baseSlackConfig);

    const callArgs = mockDb.run.mock.calls[0][1] as unknown[];
    const eventsArg = callArgs.find((a) => typeof a === 'string' && a.includes('invoice'));
    expect(eventsArg).toBe('invoice.created,project.completed');
  });

  it('calls UPDATE when config has an id', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    const result = await saveNotificationConfig({ ...baseSlackConfig, id: 5 });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE'),
      expect.arrayContaining([5])
    );
    expect(result.id).toBe(5);
  });

  it('stores is_active as 1 for true', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });

    await saveNotificationConfig({ ...baseSlackConfig, is_active: true });

    const callArgs = mockDb.run.mock.calls[0][1] as unknown[];
    expect(callArgs).toContain(1);
  });

  it('stores is_active as 0 for false', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });

    await saveNotificationConfig({ ...baseSlackConfig, is_active: false });

    const callArgs = mockDb.run.mock.calls[0][1] as unknown[];
    expect(callArgs).toContain(0);
  });

  it('stores null for missing channel', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 2 });

    const configNoChannel = { ...baseSlackConfig, channel: undefined };
    await saveNotificationConfig(configNoChannel);

    const callArgs = mockDb.run.mock.calls[0][1] as unknown[];
    expect(callArgs).toContain(null);
  });
});

// ============================================
// TESTS: getNotificationConfigs
// ============================================

describe('getNotificationConfigs', () => {
  beforeEach(() => {
    mockDb.all.mockReset();
  });

  it('returns empty array when no configs exist', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    const result = await getNotificationConfigs();

    expect(result).toHaveLength(0);
  });

  it('maps database rows to NotificationConfig objects', async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Slack Alerts',
        platform: 'slack',
        webhook_url: 'https://hooks.slack.com/abc',
        channel: '#alerts',
        events: 'invoice.created,invoice.paid',
        is_active: 1,
        created_at: '2026-01-01',
        updated_at: '2026-01-02'
      }
    ]);

    const result = await getNotificationConfigs();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].name).toBe('Slack Alerts');
    expect(result[0].platform).toBe('slack');
    expect(result[0].events).toEqual(['invoice.created', 'invoice.paid']);
    expect(result[0].is_active).toBe(true);
  });

  it('converts is_active=0 to false', async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 2,
        name: 'Inactive',
        platform: 'discord',
        webhook_url: 'https://discord.com/test',
        channel: null,
        events: 'project.completed',
        is_active: 0,
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
      }
    ]);

    const result = await getNotificationConfigs();

    expect(result[0].is_active).toBe(false);
  });

  it('splits events string correctly', async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 3,
        name: 'Multi-event',
        platform: 'slack',
        webhook_url: 'https://hooks.slack.com/xyz',
        channel: null,
        events: 'invoice.created,invoice.paid,project.completed',
        is_active: 1,
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
      }
    ]);

    const result = await getNotificationConfigs();

    expect(result[0].events).toEqual(['invoice.created', 'invoice.paid', 'project.completed']);
  });

  it('filters empty strings when splitting events', async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 4,
        name: 'Empty events',
        platform: 'slack',
        webhook_url: 'https://hooks.slack.com/xyz',
        channel: null,
        events: '',
        is_active: 1,
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
      }
    ]);

    const result = await getNotificationConfigs();

    expect(result[0].events).toEqual([]);
  });
});

// ============================================
// TESTS: deleteNotificationConfig
// ============================================

describe('deleteNotificationConfig', () => {
  beforeEach(() => {
    mockDb.run.mockReset();
  });

  it('calls DELETE with the correct id', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    await deleteNotificationConfig(42);

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('DELETE'),
      [42]
    );
  });

  it('does not throw when id does not exist', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 0 });

    await expect(deleteNotificationConfig(999)).resolves.toBeUndefined();
  });
});

// ============================================
// TESTS: testNotification
// ============================================

describe('testNotification', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends a Slack test message for slack platform', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(true, 'ok'));

    const result = await testNotification(baseSlackConfig);

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      baseSlackConfig.webhook_url,
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('sends a Discord test message for discord platform', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(true, {}));

    const result = await testNotification(baseDiscordConfig);

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      baseDiscordConfig.webhook_url,
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns failure when Slack webhook fails', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(false, 'error', 500));

    const result = await testNotification(baseSlackConfig);

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns failure when Discord webhook fails', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(false, 'error', 403));

    const result = await testNotification(baseDiscordConfig);

    expect(result.success).toBe(false);
  });

  it('sends test data using invoice.created event type', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(true, 'ok'));

    await testNotification(baseSlackConfig);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    // The Slack message should contain text referencing the test event
    expect(callBody.text).toContain('Invoice');
  });
});
