/**
 * ===============================================
 * PROJECT — TEMPLATES
 * ===============================================
 * Template CRUD and project creation from templates.
 */

import { getDatabase } from '../../database/init.js';
import {
  toProjectTemplate as toTemplate,
  type TemplateRow
} from '../../database/entities/index.js';
import type {
  SqlValue,
  ProjectTemplate,
  TemplateData
} from './types.js';
import { PROJECT_TEMPLATE_COLUMNS } from './types.js';

export async function createTemplate(data: TemplateData): Promise<ProjectTemplate> {
  const db = getDatabase();

  const result = await db.run(
    `INSERT INTO project_templates (
      name, description, project_type, default_milestones, default_tasks,
      estimated_duration_days, default_hourly_rate
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.description || null,
      data.projectType || null,
      data.defaultMilestones ? JSON.stringify(data.defaultMilestones) : null,
      data.defaultTasks ? JSON.stringify(data.defaultTasks) : null,
      data.estimatedDurationDays || null,
      data.defaultHourlyRate || null
    ]
  );

  const template = await db.get(`SELECT ${PROJECT_TEMPLATE_COLUMNS} FROM project_templates WHERE id = ?`, [result.lastID]);

  if (!template) {
    throw new Error('Failed to create template');
  }

  return toTemplate(template as unknown as TemplateRow);
}

export async function getTemplates(projectType?: string, includeInactive = false): Promise<ProjectTemplate[]> {
  const db = getDatabase();

  let query = `SELECT ${PROJECT_TEMPLATE_COLUMNS} FROM project_templates`;
  const params: SqlValue[] = [];
  const conditions: string[] = [];

  if (!includeInactive) {
    conditions.push('is_active = 1');
  }

  if (projectType) {
    conditions.push('project_type = ?');
    params.push(projectType);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY name ASC';

  const rows = await db.all(query, params);
  return (rows as unknown as TemplateRow[]).map(toTemplate);
}

export async function getTemplate(templateId: number): Promise<ProjectTemplate | null> {
  const db = getDatabase();
  const row = await db.get(`SELECT ${PROJECT_TEMPLATE_COLUMNS} FROM project_templates WHERE id = ?`, [templateId]);
  return row ? toTemplate(row as unknown as TemplateRow) : null;
}

export async function updateTemplate(templateId: number, data: Partial<TemplateData>): Promise<ProjectTemplate> {
  const db = getDatabase();

  const fields: string[] = [];
  const values: SqlValue[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description || null); }
  if (data.projectType !== undefined) { fields.push('project_type = ?'); values.push(data.projectType || null); }
  if (data.defaultMilestones !== undefined) {
    fields.push('default_milestones = ?');
    values.push(data.defaultMilestones ? JSON.stringify(data.defaultMilestones) : null);
  }
  if (data.defaultTasks !== undefined) {
    fields.push('default_tasks = ?');
    values.push(data.defaultTasks ? JSON.stringify(data.defaultTasks) : null);
  }
  if (data.estimatedDurationDays !== undefined) {
    fields.push('estimated_duration_days = ?');
    values.push(data.estimatedDurationDays || null);
  }
  if (data.defaultHourlyRate !== undefined) {
    fields.push('default_hourly_rate = ?');
    values.push(data.defaultHourlyRate || null);
  }
  if ((data as Record<string, unknown>).isActive !== undefined) {
    fields.push('is_active = ?');
    values.push((data as Record<string, unknown>).isActive ? 1 : 0);
  }

  if (fields.length > 0) {
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(templateId);
    await db.run(`UPDATE project_templates SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  const row = await db.get(`SELECT ${PROJECT_TEMPLATE_COLUMNS} FROM project_templates WHERE id = ?`, [templateId]);
  if (!row) throw new Error('Template not found after update');
  return toTemplate(row as unknown as TemplateRow);
}

export async function deleteTemplate(templateId: number): Promise<void> {
  const db = getDatabase();
  await db.run('DELETE FROM project_templates WHERE id = ?', [templateId]);
}

export async function createProjectFromTemplate(
  templateId: number,
  clientId: number,
  projectName: string,
  startDate: string
): Promise<{ projectId: number; milestoneIds: number[]; taskIds: number[] }> {
  const db = getDatabase();

  const template = await getTemplate(templateId);
  if (!template) {
    throw new Error('Template not found');
  }

  const projectResult = await db.run(
    `INSERT INTO projects (
      client_id, project_name, project_type, status, template_id,
      hourly_rate, estimated_hours, start_date, created_at, updated_at
    ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      clientId,
      projectName,
      template.projectType,
      templateId,
      template.defaultHourlyRate,
      template.defaultTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
      startDate
    ]
  );
  const projectId = projectResult.lastID as number;

  const milestoneIds: number[] = [];
  let currentDate = new Date(startDate);

  for (const milestone of template.defaultMilestones) {
    const dueDate = new Date(currentDate);
    dueDate.setDate(dueDate.getDate() + (milestone.estimatedDays || 7));

    const milestoneResult = await db.run(
      `INSERT INTO milestones (
        project_id, title, description, deliverables, due_date, sort_order, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [
        projectId,
        milestone.name,
        milestone.description,
        milestone.deliverables,
        dueDate.toISOString().split('T')[0],
        milestone.order
      ]
    );
    milestoneIds.push(milestoneResult.lastID as number);
    currentDate = dueDate;
  }

  const taskIds: number[] = [];
  let taskOrder = 0;

  for (const task of template.defaultTasks) {
    const milestoneId = milestoneIds[task.milestoneIndex] || null;

    const taskResult = await db.run(
      `INSERT INTO project_tasks (
        project_id, milestone_id, title, description, priority, estimated_hours, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        milestoneId,
        task.title,
        task.description,
        task.priority || 'medium',
        task.estimatedHours,
        taskOrder++
      ]
    );
    taskIds.push(taskResult.lastID as number);
  }

  return { projectId, milestoneIds, taskIds };
}
