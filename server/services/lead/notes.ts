/**
 * ===============================================
 * LEAD — NOTES
 * ===============================================
 * Lead note CRUD and pin/unpin.
 */

import { getDatabase } from '../../database/init.js';
import { userService } from '../user-service.js';
import {
  toLeadNote as toNote,
  type LeadNoteRow as NoteRow
} from '../../database/entities/index.js';
import type { LeadNote } from './types.js';

export async function addNote(projectId: number, author: string, content: string): Promise<LeadNote> {
  const db = getDatabase();

  const authorUserId = await userService.getUserIdByEmailOrName(author);

  const result = await db.run(
    'INSERT INTO lead_notes (project_id, author_user_id, content) VALUES (?, ?, ?)',
    [projectId, authorUserId, content]
  );

  // Update project's last activity
  await db.run('UPDATE projects SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?', [
    projectId
  ]);

  const note = await db.get(
    `SELECT ln.*, u.display_name as author_name
     FROM lead_notes ln
     LEFT JOIN users u ON ln.author_user_id = u.id
     WHERE ln.id = ?`,
    [result.lastID]
  );

  if (!note) {
    throw new Error('Failed to create note');
  }

  return toNote(note as unknown as NoteRow);
}

export async function getNotes(projectId: number): Promise<LeadNote[]> {
  const db = getDatabase();
  const rows = (await db.all(
    `SELECT ln.*, u.display_name as author_name
     FROM lead_notes ln
     LEFT JOIN users u ON ln.author_user_id = u.id
     WHERE ln.project_id = ?
     ORDER BY ln.is_pinned DESC, ln.created_at DESC`,
    [projectId]
  )) as unknown as NoteRow[];
  return rows.map(toNote);
}

export async function togglePinNote(noteId: number): Promise<LeadNote> {
  const db = getDatabase();

  await db.run(
    `UPDATE lead_notes SET
      is_pinned = NOT is_pinned,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [noteId]
  );

  const note = (await db.get(
    `SELECT ln.*, u.display_name as author_name
     FROM lead_notes ln
     LEFT JOIN users u ON ln.author_user_id = u.id
     WHERE ln.id = ?`,
    [noteId]
  )) as unknown as NoteRow | undefined;

  if (!note) {
    throw new Error('Note not found');
  }

  return toNote(note);
}

export async function deleteNote(noteId: number): Promise<void> {
  const db = getDatabase();
  await db.run('DELETE FROM lead_notes WHERE id = ?', [noteId]);
}
