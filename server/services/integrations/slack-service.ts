/**
 * ===============================================
 * SLACK/DISCORD NOTIFICATION SERVICE
 * ===============================================
 * @file server/services/integrations/slack-service.ts
 *
 * Provides Slack and Discord notification capabilities
 * using incoming webhooks.
 */

import { getDatabase } from '../../database/init';

// Slack message block types
export interface SlackBlock {
  type: 'section' | 'divider' | 'header' | 'context' | 'actions';
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: 'plain_text' | 'mrkdwn';
    text: string;
  }>;
  accessory?: {
    type: 'button' | 'image';
    text?: { type: 'plain_text'; text: string };
    url?: string;
    action_id?: string;
    image_url?: string;
    alt_text?: string;
  };
  elements?: Array<{
    type: 'plain_text' | 'mrkdwn' | 'image';
    text?: string;
    image_url?: string;
    alt_text?: string;
  }>;
}

export interface SlackMessage {
  text: string; // Fallback text
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  channel?: string;
  username?: string;
  icon_emoji?: string;
  icon_url?: string;
}

export interface SlackAttachment {
  color?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  footer?: string;
  ts?: number;
}

// Discord webhook format (compatible subset)
export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

export interface DiscordMessage {
  content: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

// Notification configuration
export interface NotificationConfig {
  id?: number;
  name: string;
  platform: 'slack' | 'discord';
  webhook_url: string;
  channel?: string;
  events: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Color mapping for notification types
const COLORS = {
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  primary: '#6366f1'
};

const DISCORD_COLORS = {
  success: 0x22c55e,
  warning: 0xf59e0b,
  error: 0xef4444,
  info: 0x3b82f6,
  primary: 0x6366f1
};

// Emoji mapping for event types
const EVENT_EMOJIS: Record<string, string> = {
  'invoice.created': ':receipt:',
  'invoice.sent': ':outbox_tray:',
  'invoice.paid': ':white_check_mark:',
  'invoice.overdue': ':warning:',
  'project.created': ':rocket:',
  'project.started': ':arrow_forward:',
  'project.completed': ':tada:',
  'contract.signed': ':memo:',
  'proposal.accepted': ':handshake:',
  'proposal.rejected': ':x:',
  'client.created': ':bust_in_silhouette:',
  'lead.created': ':sparkles:',
  'task.completed': ':ballot_box_with_check:',
  'task.overdue': ':alarm_clock:',
  'milestone.completed': ':trophy:'
};

/**
 * Format event data into Slack message
 */
export function formatSlackMessage(
  eventType: string,
  data: Record<string, unknown>,
  options: { includeLink?: string; channel?: string } = {}
): SlackMessage {
  const emoji = EVENT_EMOJIS[eventType] || ':bell:';
  const [category, action] = eventType.split('.');
  const title = `${emoji} ${capitalize(category)} ${capitalize(action)}`;

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: title,
        emoji: true
      }
    }
  ];

  // Add main content section based on event type
  const contentBlock = buildSlackContentBlock(eventType, data);
  if (contentBlock) {
    blocks.push(contentBlock);
  }

  // Add fields for key data
  const fields = buildSlackFields(eventType, data);
  if (fields.length > 0) {
    blocks.push({
      type: 'section',
      fields: fields.slice(0, 10) // Slack limit
    });
  }

  // Add action button if link provided
  if (options.includeLink) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Details'
          },
          url: options.includeLink,
          action_id: `view_${eventType}`
        }
      ]
    } as unknown as SlackBlock);
  }

  // Add timestamp footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Sent from No Bhad Codes • ${new Date().toLocaleString()}`
      }
    ]
  });

  return {
    text: `${title} - ${getEventSummary(eventType, data)}`,
    blocks,
    channel: options.channel
  };
}

/**
 * Format event data into Discord message
 */
export function formatDiscordMessage(
  eventType: string,
  data: Record<string, unknown>,
  options: { includeLink?: string } = {}
): DiscordMessage {
  const [category, action] = eventType.split('.');
  const title = `${capitalize(category)} ${capitalize(action)}`;
  const color = getColorForEvent(eventType);

  const fields = buildDiscordFields(eventType, data);

  const embed: DiscordEmbed = {
    title,
    description: getEventSummary(eventType, data),
    color: DISCORD_COLORS[color as keyof typeof DISCORD_COLORS] || DISCORD_COLORS.info,
    fields: fields.slice(0, 25), // Discord limit
    footer: {
      text: 'No Bhad Codes'
    },
    timestamp: new Date().toISOString()
  };

  if (options.includeLink) {
    embed.url = options.includeLink;
  }

  return {
    content: `**${title}**`,
    embeds: [embed]
  };
}

/**
 * Build Slack content block based on event type
 */
function buildSlackContentBlock(eventType: string, data: Record<string, unknown>): SlackBlock | null {
  const summary = getEventSummary(eventType, data);

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: summary
    }
  };
}

/**
 * Build Slack fields from event data
 */
function buildSlackFields(eventType: string, data: Record<string, unknown>): Array<{ type: 'mrkdwn'; text: string }> {
  const fields: Array<{ type: 'mrkdwn'; text: string }> = [];

  // Extract relevant fields based on event type
  const entityData = data[eventType.split('.')[0]] as Record<string, unknown> || data;

  const fieldMappings: Record<string, string> = {
    client_name: 'Client',
    client_email: 'Email',
    project_name: 'Project',
    amount: 'Amount',
    total_price: 'Total',
    status: 'Status',
    due_date: 'Due Date',
    assigned_to: 'Assigned To',
    number: 'Number',
    title: 'Title'
  };

  for (const [key, label] of Object.entries(fieldMappings)) {
    if (entityData[key] !== undefined && entityData[key] !== null) {
      let value = String(entityData[key]);

      // Format currency values
      if (key === 'amount' || key === 'total_price') {
        value = formatCurrency(Number(entityData[key]));
      }

      fields.push({
        type: 'mrkdwn',
        text: `*${label}:*\n${value}`
      });
    }
  }

  return fields;
}

/**
 * Build Discord fields from event data
 */
function buildDiscordFields(eventType: string, data: Record<string, unknown>): Array<{ name: string; value: string; inline: boolean }> {
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];

  const entityData = data[eventType.split('.')[0]] as Record<string, unknown> || data;

  const fieldMappings: Record<string, string> = {
    client_name: 'Client',
    client_email: 'Email',
    project_name: 'Project',
    amount: 'Amount',
    total_price: 'Total',
    status: 'Status',
    due_date: 'Due Date',
    assigned_to: 'Assigned To',
    number: 'Number',
    title: 'Title'
  };

  for (const [key, label] of Object.entries(fieldMappings)) {
    if (entityData[key] !== undefined && entityData[key] !== null) {
      let value = String(entityData[key]);

      if (key === 'amount' || key === 'total_price') {
        value = formatCurrency(Number(entityData[key]));
      }

      fields.push({
        name: label,
        value,
        inline: true
      });
    }
  }

  return fields;
}

/**
 * Get event summary text
 */
function getEventSummary(eventType: string, data: Record<string, unknown>): string {
  const entityData = data[eventType.split('.')[0]] as Record<string, unknown> || data;

  const summaries: Record<string, () => string> = {
    'invoice.created': () => `Invoice ${entityData.number || `#${  entityData.id}`} created for ${entityData.client_name || 'client'} - ${formatCurrency(Number(entityData.amount) || 0)}`,
    'invoice.sent': () => `Invoice ${entityData.number || `#${  entityData.id}`} sent to ${entityData.client_email || entityData.client_name}`,
    'invoice.paid': () => `Invoice ${entityData.number || `#${  entityData.id}`} has been paid - ${formatCurrency(Number(entityData.amount_paid || entityData.amount) || 0)}`,
    'invoice.overdue': () => `Invoice ${entityData.number || `#${  entityData.id}`} is overdue - ${formatCurrency(Number(entityData.amount) || 0)}`,
    'project.created': () => `New project "${entityData.name}" created for ${entityData.client_name || 'client'}`,
    'project.started': () => `Project "${entityData.name}" has started`,
    'project.completed': () => `Project "${entityData.name}" has been completed`,
    'contract.signed': () => `Contract for "${entityData.project_name}" signed by ${entityData.signer_name}`,
    'proposal.accepted': () => `Proposal for "${entityData.project_name}" accepted - ${formatCurrency(Number(entityData.total_price) || 0)}`,
    'proposal.rejected': () => `Proposal for "${entityData.project_name}" was rejected`,
    'client.created': () => `New client "${entityData.name}" added`,
    'lead.created': () => `New lead from ${entityData.name || entityData.email}`,
    'task.completed': () => `Task "${entityData.title}" completed`,
    'task.overdue': () => `Task "${entityData.title}" is overdue`,
    'milestone.completed': () => `Milestone "${entityData.title}" completed for ${entityData.project_name}`
  };

  return summaries[eventType]?.() || `${eventType} event occurred`;
}

/**
 * Get color for event type
 */
function getColorForEvent(eventType: string): string {
  const colorMap: Record<string, string> = {
    'invoice.paid': 'success',
    'project.completed': 'success',
    'contract.signed': 'success',
    'proposal.accepted': 'success',
    'task.completed': 'success',
    'milestone.completed': 'success',
    'invoice.overdue': 'warning',
    'task.overdue': 'warning',
    'proposal.rejected': 'error'
  };

  return colorMap[eventType] || 'info';
}

/**
 * Send notification to Slack webhook
 */
export async function sendSlackNotification(
  webhookUrl: string,
  message: SlackMessage
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Slack API error: ${response.status} - ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send notification to Discord webhook
 */
export async function sendDiscordNotification(
  webhookUrl: string,
  message: DiscordMessage
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Discord API error: ${response.status} - ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Save notification configuration
 */
export async function saveNotificationConfig(config: NotificationConfig): Promise<NotificationConfig> {
  const db = getDatabase();

  if (config.id) {
    // Update existing
    await db.run(
      `UPDATE notification_integrations
       SET name = ?, platform = ?, webhook_url = ?, channel = ?, events = ?, is_active = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [config.name, config.platform, config.webhook_url, config.channel || null, config.events.join(','), config.is_active ? 1 : 0, config.id]
    );
    return config;
  }
  // Create new
  const result = await db.run(
    `INSERT INTO notification_integrations (name, platform, webhook_url, channel, events, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [config.name, config.platform, config.webhook_url, config.channel || null, config.events.join(','), config.is_active ? 1 : 0]
  );
  return { ...config, id: result.lastID };

}

/**
 * Get all notification configurations
 */
export async function getNotificationConfigs(): Promise<NotificationConfig[]> {
  const db = getDatabase();
  const rows = await db.all('SELECT * FROM notification_integrations ORDER BY created_at DESC');

  return rows.map((row: Record<string, unknown>) => ({
    id: row.id as number,
    name: row.name as string,
    platform: row.platform as 'slack' | 'discord',
    webhook_url: row.webhook_url as string,
    channel: row.channel as string | undefined,
    events: (row.events as string).split(',').filter(Boolean),
    is_active: Boolean(row.is_active),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }));
}

/**
 * Delete notification configuration
 */
export async function deleteNotificationConfig(id: number): Promise<void> {
  const db = getDatabase();
  await db.run('DELETE FROM notification_integrations WHERE id = ?', [id]);
}

/**
 * Test notification configuration
 */
export async function testNotification(config: NotificationConfig): Promise<{ success: boolean; error?: string }> {
  const testData = {
    invoice: {
      id: 1,
      number: 'INV-TEST-001',
      client_name: 'Test Client',
      client_email: 'test@example.com',
      amount: 1000.00
    }
  };

  if (config.platform === 'slack') {
    const message = formatSlackMessage('invoice.created', testData, { channel: config.channel });
    return sendSlackNotification(config.webhook_url, message);
  }
  const message = formatDiscordMessage('invoice.created', testData);
  return sendDiscordNotification(config.webhook_url, message);

}

// Helper functions
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

export default {
  formatSlackMessage,
  formatDiscordMessage,
  sendSlackNotification,
  sendDiscordNotification,
  saveNotificationConfig,
  getNotificationConfigs,
  deleteNotificationConfig,
  testNotification
};
