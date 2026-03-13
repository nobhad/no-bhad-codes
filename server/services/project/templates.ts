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

export async function getTemplates(projectType?: string): Promise<ProjectTemplate[]> {
  const db = getDatabase();

  let query = `SELECT ${PROJECT_TEMPLATE_COLUMNS} FROM project_templates WHERE is_active = 1`;
  const params: SqlValue[] = [];

  if (projectType) {
    query += ' AND project_type = ?';
    params.push(projectType);
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
