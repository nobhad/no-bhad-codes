/**
 * ===============================================
 * PROJECT — TIME TRACKING
 * ===============================================
 * Time entries, project time stats, and team time reports.
 */

import { getDatabase } from '../../database/init.js';
import { userService } from '../user-service.js';
import {
  toTimeEntry,
  type TimeEntryRow
} from '../../database/entities/index.js';
import type {
  SqlValue,
  TimeEntry,
  TimeEntryData,
  TimeStats,
  TeamTimeReport
} from './types.js';

export async function logTime(projectId: number, data: TimeEntryData): Promise<TimeEntry> {
  const db = getDatabase();

  const userId = await userService.getUserIdByEmailOrName(data.userName);

  const result = await db.run(
    `INSERT INTO time_entries (
      project_id, task_id, user_id, description, hours, date, billable, hourly_rate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      data.taskId || null,
      userId,
      data.description || null,
      data.hours,
      data.date,
      data.billable !== false ? 1 : 0,
      data.hourlyRate || null
    ]
  );

  if (data.taskId) {
    await db.run(
      `UPDATE project_tasks SET
        actual_hours = COALESCE(actual_hours, 0) + ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [data.hours, data.taskId]
    );
  }

  await db.run(
    `UPDATE projects SET
      actual_hours = COALESCE(actual_hours, 0) + ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [data.hours, projectId]
  );

  const entry = await db.get(
    `SELECT te.*, u.display_name as user_name
     FROM time_entries te
     LEFT JOIN users u ON te.user_id = u.id
     WHERE te.id = ?`,
    [result.lastID]
  );

  if (!entry) {
    throw new Error('Failed to log time');
  }

  return toTimeEntry(entry as unknown as TimeEntryRow);
}

export async function getTimeEntries(
  projectId: number,
  options?: {
    startDate?: string;
    endDate?: string;
    userName?: string;
    taskId?: number;
  }
): Promise<TimeEntry[]> {
  const db = getDatabase();

  let query = `SELECT te.*, u.display_name as user_name, pt.title as task_title
               FROM time_entries te
               LEFT JOIN users u ON te.user_id = u.id
               LEFT JOIN project_tasks pt ON te.task_id = pt.id
               WHERE te.project_id = ?`;
  const params: SqlValue[] = [projectId];

  if (options?.startDate) {
    query += ' AND te.date >= ?';
    params.push(options.startDate);
  }
  if (options?.endDate) {
    query += ' AND te.date <= ?';
    params.push(options.endDate);
  }
  if (options?.userName) {
    query += ' AND (u.display_name = ? OR u.email = ?)';
    params.push(options.userName);
    params.push(options.userName);
  }
  if (options?.taskId) {
    query += ' AND te.task_id = ?';
    params.push(options.taskId);
  }

  query += ' ORDER BY te.date DESC, te.created_at DESC';

  const rows = await db.all(query, params);
  return (rows as unknown as TimeEntryRow[]).map(toTimeEntry);
}

export async function updateTimeEntry(entryId: number, data: Partial<TimeEntryData>): Promise<TimeEntry> {
  const db = getDatabase();

  const updates: string[] = [];
  const values: SqlValue[] = [];

  if (data.description !== undefined) {
    updates.push('description = ?');
    values.push(data.description || null);
  }
  if (data.hours !== undefined) {
    updates.push('hours = ?');
    values.push(data.hours);
  }
  if (data.date !== undefined) {
    updates.push('date = ?');
    values.push(data.date);
  }
  if (data.billable !== undefined) {
    updates.push('billable = ?');
    values.push(data.billable ? 1 : 0);
  }
  if (data.hourlyRate !== undefined) {
    updates.push('hourly_rate = ?');
    values.push(data.hourlyRate || null);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(entryId);
    await db.run(`UPDATE time_entries SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  const entry = await db.get(
    `SELECT te.*, u.display_name as user_name
     FROM time_entries te
     LEFT JOIN users u ON te.user_id = u.id
     WHERE te.id = ?`,
    [entryId]
  );

  if (!entry) {
    throw new Error('Time entry not found');
  }

  return toTimeEntry(entry as unknown as TimeEntryRow);
}

export async function deleteTimeEntry(entryId: number): Promise<void> {
  const db = getDatabase();
  await db.run('DELETE FROM time_entries WHERE id = ?', [entryId]);
}

export async function getProjectTimeStats(projectId: number): Promise<TimeStats> {
  const db = getDatabase();

  const totals = await db.get(
    `SELECT
      SUM(hours) as total,
      SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END) as billable,
      SUM(CASE WHEN billable = 0 THEN hours ELSE 0 END) as non_billable,
      SUM(CASE WHEN billable = 1 THEN hours * COALESCE(hourly_rate, 0) ELSE 0 END) as amount
     FROM time_entries
     WHERE project_id = ?`,
    [projectId]
  );

  const byUser = await db.all(
    `SELECT u.display_name as user_name, SUM(te.hours) as hours,
      SUM(CASE WHEN te.billable = 1 THEN te.hours * COALESCE(te.hourly_rate, 0) ELSE 0 END) as amount
     FROM time_entries te
     LEFT JOIN users u ON te.user_id = u.id
     WHERE te.project_id = ?
     GROUP BY te.user_id, u.display_name
     ORDER BY hours DESC`,
    [projectId]
  );

  const byTask = await db.all(
    `SELECT te.task_id, COALESCE(pt.title, 'No Task') as task_title, SUM(te.hours) as hours
     FROM time_entries te
     LEFT JOIN project_tasks pt ON te.task_id = pt.id
     WHERE te.project_id = ?
     GROUP BY te.task_id
     ORDER BY hours DESC`,
    [projectId]
  );

  const byWeek = await db.all(
    `SELECT DATE(date, 'weekday 0', '-6 days') as week_start, SUM(hours) as hours
     FROM time_entries
     WHERE project_id = ?
     GROUP BY week_start
     ORDER BY week_start DESC
     LIMIT 12`,
    [projectId]
  );

  return {
    totalHours: parseFloat(String(totals?.total ?? 0)),
    billableHours: parseFloat(String(totals?.billable ?? 0)),
    nonBillableHours: parseFloat(String(totals?.non_billable ?? 0)),
    totalAmount: parseFloat(String(totals?.amount ?? 0)),
    byUser: byUser.map((u) => ({
      userName: String(u.user_name),
      hours: parseFloat(String(u.hours)),
      amount: parseFloat(String(u.amount))
    })),
    byTask: byTask.map((t) => ({
      taskId: Number(t.task_id),
      taskTitle: String(t.task_title),
      hours: parseFloat(String(t.hours))
    })),
    byWeek: byWeek.map((w) => ({
      weekStart: String(w.week_start),
      hours: parseFloat(String(w.hours))
    }))
  };
}

export async function getTeamTimeReport(startDate: string, endDate: string): Promise<TeamTimeReport> {
  const db = getDatabase();

  const byUser = await db.all(
    `SELECT te.user_id, u.display_name as user_name,
      SUM(te.hours) as total_hours,
      SUM(CASE WHEN te.billable = 1 THEN te.hours ELSE 0 END) as billable_hours,
      SUM(CASE WHEN te.billable = 1 THEN te.hours * COALESCE(te.hourly_rate, 0) ELSE 0 END) as total_amount
     FROM time_entries te
     LEFT JOIN users u ON te.user_id = u.id
     WHERE te.date >= ? AND te.date <= ?
     GROUP BY te.user_id, u.display_name
     ORDER BY total_hours DESC`,
    [startDate, endDate]
  );

  const report: TeamTimeReport = {
    startDate,
    endDate,
    totalHours: 0,
    totalAmount: 0,
    byUser: []
  };

  for (const user of byUser) {
    const userId = Number(user.user_id);
    const userProjects = await db.all(
      `SELECT te.project_id, p.project_name, SUM(te.hours) as hours
       FROM time_entries te
       JOIN projects p ON te.project_id = p.id
       WHERE te.user_id = ? AND te.date >= ? AND te.date <= ?
       GROUP BY te.project_id
       ORDER BY hours DESC`,
      [userId, startDate, endDate]
    );

    const totalHours = parseFloat(String(user.total_hours));
    const totalAmount = parseFloat(String(user.total_amount));

    report.totalHours += totalHours;
    report.totalAmount += totalAmount;

    report.byUser.push({
      userName: String(user.user_name),
      totalHours,
      billableHours: parseFloat(String(user.billable_hours)),
      totalAmount,
      projects: userProjects.map((p) => ({
        projectId: Number(p.project_id),
        projectName: String(p.project_name),
        hours: parseFloat(String(p.hours))
      }))
    });
  }

  return report;
}
