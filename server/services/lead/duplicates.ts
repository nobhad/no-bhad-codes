/**
 * ===============================================
 * LEAD — DUPLICATE DETECTION
 * ===============================================
 * Find potential duplicate leads, resolve duplicates.
 */

import { getDatabase } from '../../database/init.js';
import {
  toLeadSummary,
  toDuplicateResult,
  type ProjectRow,
  type DuplicateRow
} from '../../database/entities/index.js';
import type { DuplicateResult } from './types.js';
import { LEAD_DUPLICATE_COLUMNS } from './types.js';

/**
 * Simple string similarity using Levenshtein distance
 */
function stringSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  return costs[s2.length];
}

type LeadMatchRow = ProjectRow & {
  contact_name?: string;
  company_name?: string;
  client_email?: string;
  email?: string;
};

export async function findDuplicates(projectId: number): Promise<DuplicateResult[]> {
  const db = getDatabase();

  const lead = (await db.get(
    `SELECT p.*, c.contact_name, c.company_name, c.email
     FROM active_projects p
     LEFT JOIN active_clients c ON p.client_id = c.id
     WHERE p.id = ?`,
    [projectId]
  )) as unknown as LeadMatchRow | undefined;

  if (!lead) {
    throw new Error('Lead not found');
  }

  const potentialMatches = (await db.all(
    `SELECT p.*, c.contact_name, c.company_name, c.email as client_email
     FROM active_projects p
     LEFT JOIN active_clients c ON p.client_id = c.id
     WHERE p.id != ? AND p.status = 'pending'`,
    [projectId]
  )) as unknown as LeadMatchRow[];

  const duplicates: DuplicateResult[] = [];

  for (const match of potentialMatches) {
    const matchFields: string[] = [];
    let score = 0;

    // Check email match (high weight)
    if (
      lead.client_email &&
      match.client_email &&
      lead.client_email.toLowerCase() === match.client_email.toLowerCase()
    ) {
      matchFields.push('email');
      score += 0.5;
    }

    // Check company name similarity
    if (lead.company_name && match.company_name) {
      const similarity = stringSimilarity(
        lead.company_name.toLowerCase(),
        match.company_name.toLowerCase()
      );
      if (similarity > 0.8) {
        matchFields.push('company_name');
        score += 0.3;
      }
    }

    // Check contact name similarity
    if (lead.contact_name && match.contact_name) {
      const similarity = stringSimilarity(
        lead.contact_name.toLowerCase(),
        match.contact_name.toLowerCase()
      );
      if (similarity > 0.8) {
        matchFields.push('contact_name');
        score += 0.2;
      }
    }

    // Only report if score is significant
    if (score >= 0.5) {
      const existing = await db.get(
        `SELECT ${LEAD_DUPLICATE_COLUMNS} FROM lead_duplicates
         WHERE (lead_id_1 = ? AND lead_id_2 = ?) OR (lead_id_1 = ? AND lead_id_2 = ?)`,
        [projectId, match.id, match.id, projectId]
      );

      if (!existing) {
        const result = await db.run(
          `INSERT INTO lead_duplicates (lead_id_1, lead_id_2, similarity_score, match_fields)
           VALUES (?, ?, ?, ?)`,
          [projectId, match.id, score, JSON.stringify(matchFields)]
        );

        duplicates.push({
          id: result.lastID as number,
          leadId1: projectId,
          leadId2: match.id,
          similarityScore: score,
          matchFields,
          status: 'pending',
          createdAt: new Date().toISOString(),
          lead2: toLeadSummary(match as unknown as ProjectRow)
        });
      } else if ((existing as { status: string }).status === 'pending') {
        duplicates.push({
          ...toDuplicateResult(existing as unknown as DuplicateRow),
          lead2: toLeadSummary(match as unknown as ProjectRow)
        });
      }
    }
  }

  return duplicates;
}

export async function getAllPendingDuplicates(): Promise<DuplicateResult[]> {
  const db = getDatabase();
  const rows = (await db.all(
    `SELECT ${LEAD_DUPLICATE_COLUMNS} FROM lead_duplicates WHERE status = 'pending' ORDER BY similarity_score DESC`
  )) as unknown as DuplicateRow[];
  return rows.map(toDuplicateResult);
}

export async function resolveDuplicate(
  duplicateId: number,
  status: 'merged' | 'not_duplicate' | 'dismissed',
  resolvedBy: string
): Promise<void> {
  const db = getDatabase();
  await db.run(
    `UPDATE lead_duplicates SET
      status = ?,
      resolved_at = CURRENT_TIMESTAMP,
      resolved_by = ?
     WHERE id = ?`,
    [status, resolvedBy, duplicateId]
  );
}
