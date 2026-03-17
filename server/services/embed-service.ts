/**
 * ===============================================
 * EMBED WIDGET SERVICE
 * ===============================================
 * @file server/services/embed-service.ts
 *
 * Manages embeddable widget configurations, token
 * generation, and public data resolution for
 * contact forms, testimonial carousels, and
 * project status badges.
 */

import { randomUUID } from 'crypto';
import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';
import type {
  EmbedConfigRow,
  EmbedConfiguration,
  ProjectStatusTokenRow,
  ProjectStatusInfo,
  CreateEmbedParams,
  UpdateEmbedParams,
  WidgetType
} from './embed-types.js';

// ============================================
// Helpers
// ============================================

function parseRow(row: EmbedConfigRow): EmbedConfiguration {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(row.config || '{}');
  } catch {
    config = {};
  }

  return {
    id: row.id,
    widgetType: row.widget_type as WidgetType,
    name: row.name,
    token: row.token,
    config,
    allowedDomains: row.allowed_domains
      ? row.allowed_domains.split(',').map(d => d.trim()).filter(Boolean)
      : [],
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ============================================
// Admin CRUD
// ============================================

/**
 * Create a new embed widget configuration.
 */
async function create(params: CreateEmbedParams): Promise<EmbedConfiguration> {
  const db = getDatabase();
  const token = randomUUID();

  const result = await db.run(
    `INSERT INTO embed_configurations
     (widget_type, name, token, config, allowed_domains, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
    [
      params.widgetType,
      params.name,
      token,
      JSON.stringify(params.config || {}),
      params.allowedDomains || null
    ]
  );

  logger.info('Created embed configuration', {
    category: 'embed',
    metadata: { id: result.lastID, widgetType: params.widgetType }
  });

  const row = (await db.get(
    'SELECT * FROM embed_configurations WHERE id = ?',
    [result.lastID]
  )) as EmbedConfigRow;

  return parseRow(row);
}

/**
 * List all embed configurations.
 */
async function list(): Promise<EmbedConfiguration[]> {
  const db = getDatabase();

  const rows = (await db.all(
    'SELECT * FROM embed_configurations ORDER BY created_at DESC'
  )) as EmbedConfigRow[];

  return rows.map(parseRow);
}

/**
 * Get a single embed configuration by ID.
 */
async function getById(id: number): Promise<EmbedConfiguration | null> {
  const db = getDatabase();

  const row = (await db.get(
    'SELECT * FROM embed_configurations WHERE id = ?',
    [id]
  )) as EmbedConfigRow | undefined;

  return row ? parseRow(row) : null;
}

/**
 * Update an embed configuration.
 */
async function update(id: number, params: UpdateEmbedParams): Promise<void> {
  const db = getDatabase();

  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  if (params.name !== undefined) {
    setClauses.push('name = ?');
    values.push(params.name);
  }
  if (params.config !== undefined) {
    setClauses.push('config = ?');
    values.push(JSON.stringify(params.config));
  }
  if (params.allowedDomains !== undefined) {
    setClauses.push('allowed_domains = ?');
    values.push(params.allowedDomains || null);
  }
  if (params.isActive !== undefined) {
    setClauses.push('is_active = ?');
    values.push(params.isActive ? 1 : 0);
  }

  if (setClauses.length === 0) return;

  setClauses.push('updated_at = datetime(\'now\')');
  values.push(id);

  await db.run(
    `UPDATE embed_configurations SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );

  logger.info('Updated embed configuration', {
    category: 'embed',
    metadata: { id }
  });
}

/**
 * Deactivate an embed configuration (soft delete).
 */
async function deactivate(id: number): Promise<void> {
  const db = getDatabase();

  await db.run(
    'UPDATE embed_configurations SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?',
    [id]
  );

  logger.info('Deactivated embed configuration', {
    category: 'embed',
    metadata: { id }
  });
}

/**
 * Regenerate the public token for a configuration.
 */
async function regenerateToken(id: number): Promise<string> {
  const db = getDatabase();
  const newToken = randomUUID();

  await db.run(
    'UPDATE embed_configurations SET token = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [newToken, id]
  );

  logger.info('Regenerated embed token', {
    category: 'embed',
    metadata: { id }
  });

  return newToken;
}

// ============================================
// Public Resolution
// ============================================

/**
 * Resolve an embed configuration by its public token.
 * Only returns active configurations.
 */
async function getByToken(token: string): Promise<EmbedConfiguration | null> {
  const db = getDatabase();

  const row = (await db.get(
    'SELECT * FROM embed_configurations WHERE token = ? AND is_active = 1',
    [token]
  )) as EmbedConfigRow | undefined;

  return row ? parseRow(row) : null;
}

/**
 * Get project status info for a status badge widget.
 */
async function getProjectStatus(token: string): Promise<ProjectStatusInfo | null> {
  const db = getDatabase();

  const statusToken = (await db.get(
    `SELECT pst.*, p.name AS project_name, p.status AS project_status
     FROM project_status_tokens pst
     JOIN projects p ON pst.project_id = p.id
     WHERE pst.token = ? AND pst.is_active = 1`,
    [token]
  )) as (ProjectStatusTokenRow & { project_name: string; project_status: string }) | undefined;

  if (!statusToken) return null;

  // Calculate completion from milestones
  const milestones = (await db.all(
    'SELECT status FROM milestones WHERE project_id = ?',
    [statusToken.project_id]
  )) as Array<{ status: string }>;

  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter(m =>
    m.status === 'completed' || m.status === 'done'
  ).length;
  const completionPercent = totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : 0;

  const milestonesSummary = totalMilestones > 0
    ? `${completedMilestones} of ${totalMilestones} milestones complete`
    : 'No milestones';

  return {
    projectName: statusToken.project_name,
    status: statusToken.project_status,
    completionPercent,
    milestonesSummary
  };
}

/**
 * Create a project status token for public access.
 */
async function createProjectStatusToken(projectId: number): Promise<string> {
  const db = getDatabase();
  const token = randomUUID();

  await db.run(
    `INSERT INTO project_status_tokens
     (project_id, token, is_active, created_at)
     VALUES (?, ?, 1, datetime('now'))`,
    [projectId, token]
  );

  logger.info('Created project status token', {
    category: 'embed',
    metadata: { projectId }
  });

  return token;
}

// ============================================
// Embed Code Generation
// ============================================

/**
 * Generate the embed script tag HTML for a widget.
 */
function generateEmbedCode(config: EmbedConfiguration, baseUrl: string): string {
  const { widgetType, token } = config;

  switch (widgetType) {
  case 'contact_form':
    return `<script src="${baseUrl}/api/embed/contact-form.js?token=${token}" defer></script>`;
  case 'testimonials':
    return `<script src="${baseUrl}/api/embed/testimonials.js?token=${token}" defer></script>`;
  case 'status_badge':
    return `<script src="${baseUrl}/api/embed/status-badge.js?token=${token}" defer></script>`;
  default:
    return '';
  }
}

// ============================================
// Singleton Export
// ============================================

export const embedService = {
  create,
  list,
  getById,
  update,
  deactivate,
  regenerateToken,
  getByToken,
  getProjectStatus,
  createProjectStatusToken,
  generateEmbedCode
};
