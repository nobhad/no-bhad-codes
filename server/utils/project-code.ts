/**
 * ===============================================
 * PROJECT CODE GENERATOR
 * ===============================================
 * @file server/utils/project-code.ts
 *
 * Generates unique project codes in the format:
 *   NBC-YYYY-NNN-slug
 *
 * Example: NBC-2026-001-hedgewitch
 *
 * - NBC = No Bhad Codes brand prefix
 * - YYYY = year project was created
 * - NNN = sequential number within that year (zero-padded)
 * - slug = kebab-case client/project identifier
 */

import { getDatabase } from '../database/init.js';

const BRAND_PREFIX = 'NBC';

/**
 * Convert a name to a URL-safe slug.
 * Uses company name if available, otherwise contact name.
 */
export function toProjectSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
}

/**
 * Get the next sequential number for a given year.
 * Queries existing project codes to find the highest number used.
 */
export async function getNextSequenceNumber(year: number): Promise<number> {
  const db = getDatabase();
  const pattern = `${BRAND_PREFIX}-${year}-%`;

  const result = await db.get<{ max_seq: number | null }>(
    `SELECT MAX(CAST(SUBSTR(project_code, ${BRAND_PREFIX.length + 6}, 3) AS INTEGER)) as max_seq
     FROM projects
     WHERE project_code LIKE ?`,
    [pattern]
  );

  return (result?.max_seq ?? 0) + 1;
}

/**
 * Generate a project code for a new project.
 *
 * @param clientName - Company name or contact name to derive the slug from
 * @param year - Optional year override (defaults to current year)
 * @returns Project code string like "NBC-2026-001-hedgewitch"
 */
export async function generateProjectCode(
  clientName: string,
  year?: number
): Promise<string> {
  const projectYear = year ?? new Date().getFullYear();
  const seq = await getNextSequenceNumber(projectYear);
  const paddedSeq = String(seq).padStart(3, '0');
  const slug = toProjectSlug(clientName);

  return `${BRAND_PREFIX}-${projectYear}-${paddedSeq}-${slug}`;
}
