/**
 * ===============================================
 * DUPLICATE DETECTION SERVICE
 * ===============================================
 * @file server/services/duplicate-detection-service.ts
 *
 * Provides automatic duplicate detection for leads/intakes
 * with similarity scoring and merge capabilities.
 */

import { getDatabase } from '../database/init';

// Similarity thresholds
const EXACT_MATCH_THRESHOLD = 1.0;
const HIGH_SIMILARITY_THRESHOLD = 0.85;
const MEDIUM_SIMILARITY_THRESHOLD = 0.7;
const LOW_SIMILARITY_THRESHOLD = 0.5;

// Field weights for similarity scoring
const FIELD_WEIGHTS = {
  email: 0.35,      // Email is most reliable identifier
  company: 0.25,    // Company name is important
  name: 0.20,       // Full name matters
  phone: 0.15,      // Phone can be secondary contact
  domain: 0.05     // Website domain as tie-breaker
};

// Duplicate detection result
export interface DuplicateMatch {
  id: number;
  type: 'intake' | 'lead' | 'client';
  name: string;
  email: string;
  company: string | null;
  similarityScore: number;
  matchedFields: string[];
  confidence: 'exact' | 'high' | 'medium' | 'low';
  createdAt: string;
}

// Duplicate check request
export interface DuplicateCheckRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  website?: string;
}

// Merge request
export interface MergeRequest {
  keepId: number;
  keepType: 'intake' | 'lead' | 'client';
  mergeIds: Array<{ id: number; type: 'intake' | 'lead' | 'client' }>;
  fieldSelections?: Record<string, 'keep' | 'merge'>;
}

/**
 * Check for duplicates before creating a new lead/intake
 */
export async function checkForDuplicates(
  data: DuplicateCheckRequest,
  excludeId?: number,
  excludeType?: 'intake' | 'lead' | 'client'
): Promise<DuplicateMatch[]> {
  const db = getDatabase();
  const matches: DuplicateMatch[] = [];

  // Normalize input data
  const normalizedEmail = normalizeEmail(data.email);
  const normalizedName = normalizeName(`${data.firstName || ''} ${data.lastName || ''}`);
  const normalizedCompany = normalizeCompany(data.company);
  const normalizedPhone = normalizePhone(data.phone);
  const domain = extractDomain(data.email || data.website);

  // 1. Check existing intakes
  const intakes = await db.all(
    `SELECT id, first_name, last_name, email, company_name, phone, created_at
     FROM client_intakes
     WHERE status != 'rejected'
     ORDER BY created_at DESC`
  ) as Array<{
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    company_name: string | null;
    phone: string | null;
    created_at: string;
  }>;

  for (const intake of intakes) {
    if (excludeType === 'intake' && excludeId === intake.id) continue;

    const score = calculateSimilarity(
      {
        email: normalizedEmail,
        name: normalizedName,
        company: normalizedCompany,
        phone: normalizedPhone,
        domain
      },
      {
        email: normalizeEmail(intake.email),
        name: normalizeName(`${intake.first_name} ${intake.last_name}`),
        company: normalizeCompany(intake.company_name),
        phone: normalizePhone(intake.phone),
        domain: extractDomain(intake.email)
      }
    );

    if (score.total >= LOW_SIMILARITY_THRESHOLD) {
      matches.push({
        id: intake.id,
        type: 'intake',
        name: `${intake.first_name} ${intake.last_name}`,
        email: intake.email,
        company: intake.company_name,
        similarityScore: score.total,
        matchedFields: score.matchedFields,
        confidence: getConfidenceLevel(score.total),
        createdAt: intake.created_at
      });
    }
  }

  // 2. Check existing clients
  const clients = await db.all(
    `SELECT id, name, email, company, phone, created_at
     FROM clients
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC`
  ) as Array<{
    id: number;
    name: string;
    email: string;
    company: string | null;
    phone: string | null;
    created_at: string;
  }>;

  for (const client of clients) {
    if (excludeType === 'client' && excludeId === client.id) continue;

    const score = calculateSimilarity(
      {
        email: normalizedEmail,
        name: normalizedName,
        company: normalizedCompany,
        phone: normalizedPhone,
        domain
      },
      {
        email: normalizeEmail(client.email),
        name: normalizeName(client.name),
        company: normalizeCompany(client.company),
        phone: normalizePhone(client.phone),
        domain: extractDomain(client.email)
      }
    );

    if (score.total >= LOW_SIMILARITY_THRESHOLD) {
      matches.push({
        id: client.id,
        type: 'client',
        name: client.name,
        email: client.email,
        company: client.company,
        similarityScore: score.total,
        matchedFields: score.matchedFields,
        confidence: getConfidenceLevel(score.total),
        createdAt: client.created_at
      });
    }
  }

  // 3. Check leads (projects with pending/lead status)
  const leads = await db.all(
    `SELECT p.id, p.name as project_name, c.name as client_name, c.email, c.company,
            p.created_at
     FROM projects p
     LEFT JOIN clients c ON p.client_id = c.id
     WHERE p.status IN ('pending', 'lead', 'prospect')
     AND p.deleted_at IS NULL
     ORDER BY p.created_at DESC`
  ) as Array<{
    id: number;
    project_name: string;
    client_name: string | null;
    email: string | null;
    company: string | null;
    created_at: string;
  }>;

  for (const lead of leads) {
    if (excludeType === 'lead' && excludeId === lead.id) continue;
    if (!lead.email) continue;

    const score = calculateSimilarity(
      {
        email: normalizedEmail,
        name: normalizedName,
        company: normalizedCompany,
        phone: normalizedPhone,
        domain
      },
      {
        email: normalizeEmail(lead.email),
        name: normalizeName(lead.client_name || ''),
        company: normalizeCompany(lead.company),
        phone: '',
        domain: extractDomain(lead.email)
      }
    );

    if (score.total >= LOW_SIMILARITY_THRESHOLD) {
      matches.push({
        id: lead.id,
        type: 'lead',
        name: lead.client_name || lead.project_name,
        email: lead.email,
        company: lead.company,
        similarityScore: score.total,
        matchedFields: score.matchedFields,
        confidence: getConfidenceLevel(score.total),
        createdAt: lead.created_at
      });
    }
  }

  // Sort by similarity score descending
  return matches.sort((a, b) => b.similarityScore - a.similarityScore);
}

/**
 * Calculate similarity score between two records
 */
function calculateSimilarity(
  record1: { email: string; name: string; company: string; phone: string; domain: string },
  record2: { email: string; name: string; company: string; phone: string; domain: string }
): { total: number; matchedFields: string[] } {
  let totalScore = 0;
  const matchedFields: string[] = [];

  // Email comparison (exact match or normalized match)
  if (record1.email && record2.email) {
    if (record1.email === record2.email) {
      totalScore += FIELD_WEIGHTS.email;
      matchedFields.push('email');
    } else {
      // Check for similar emails (typos, aliases)
      const emailSim = stringSimilarity(record1.email, record2.email);
      if (emailSim > 0.9) {
        totalScore += FIELD_WEIGHTS.email * emailSim;
        matchedFields.push('email (similar)');
      }
    }
  }

  // Company comparison
  if (record1.company && record2.company) {
    const companySim = stringSimilarity(record1.company, record2.company);
    if (companySim > 0.7) {
      totalScore += FIELD_WEIGHTS.company * companySim;
      matchedFields.push('company');
    }
  }

  // Name comparison
  if (record1.name && record2.name) {
    const nameSim = nameSimilarity(record1.name, record2.name);
    if (nameSim > 0.7) {
      totalScore += FIELD_WEIGHTS.name * nameSim;
      matchedFields.push('name');
    }
  }

  // Phone comparison
  if (record1.phone && record2.phone) {
    if (record1.phone === record2.phone) {
      totalScore += FIELD_WEIGHTS.phone;
      matchedFields.push('phone');
    }
  }

  // Domain comparison
  if (record1.domain && record2.domain) {
    if (record1.domain === record2.domain) {
      totalScore += FIELD_WEIGHTS.domain;
      matchedFields.push('domain');
    }
  }

  return { total: totalScore, matchedFields };
}

/**
 * Levenshtein distance-based string similarity
 */
function stringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Name similarity with handling for different name orders
 */
function nameSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;

  const parts1 = name1.split(/\s+/).filter(Boolean);
  const parts2 = name2.split(/\s+/).filter(Boolean);

  // Check if all parts match (in any order)
  const matchedParts = parts1.filter(p1 =>
    parts2.some(p2 => stringSimilarity(p1, p2) > 0.8)
  );

  const matchRatio = (2 * matchedParts.length) / (parts1.length + parts2.length);

  // Also check direct string similarity
  const directSim = stringSimilarity(name1, name2);

  return Math.max(matchRatio, directSim);
}

/**
 * Normalize email for comparison
 */
function normalizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

/**
 * Normalize name for comparison
 */
function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

/**
 * Normalize company name for comparison
 */
function normalizeCompany(company: string | null | undefined): string {
  if (!company) return '';
  return company
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    // Remove common suffixes
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co|limited)\b\.?/gi, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  // Remove all non-digits
  return phone.replace(/\D/g, '');
}

/**
 * Extract domain from email or website
 */
function extractDomain(input: string | null | undefined): string {
  if (!input) return '';

  // If it's an email, extract domain
  if (input.includes('@')) {
    const domain = input.split('@')[1];
    // Skip common email providers
    const commonProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
    if (commonProviders.includes(domain?.toLowerCase())) {
      return '';
    }
    return domain?.toLowerCase() || '';
  }

  // If it's a URL, extract domain
  try {
    const url = input.startsWith('http') ? input : `https://${input}`;
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return domain.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Get confidence level from similarity score
 */
function getConfidenceLevel(score: number): 'exact' | 'high' | 'medium' | 'low' {
  if (score >= EXACT_MATCH_THRESHOLD) return 'exact';
  if (score >= HIGH_SIMILARITY_THRESHOLD) return 'high';
  if (score >= MEDIUM_SIMILARITY_THRESHOLD) return 'medium';
  return 'low';
}

/**
 * Log duplicate detection result
 */
export async function logDuplicateCheck(
  sourceType: 'intake' | 'lead',
  sourceData: DuplicateCheckRequest,
  matches: DuplicateMatch[],
  action: 'allowed' | 'blocked' | 'merged' | 'ignored'
): Promise<void> {
  const db = getDatabase();

  await db.run(
    `INSERT INTO duplicate_detection_log
     (source_type, source_data, matches_found, top_match_score, action, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [
      sourceType,
      JSON.stringify(sourceData),
      matches.length,
      matches[0]?.similarityScore || 0,
      action
    ]
  );
}

/**
 * Get duplicate detection statistics
 */
export async function getDuplicateStats(): Promise<{
  totalChecks: number;
  duplicatesFound: number;
  duplicatesBlocked: number;
  duplicatesMerged: number;
  averageMatchScore: number;
}> {
  const db = getDatabase();

  const stats = await db.get(`
    SELECT
      COUNT(*) as total_checks,
      SUM(CASE WHEN matches_found > 0 THEN 1 ELSE 0 END) as duplicates_found,
      SUM(CASE WHEN action = 'blocked' THEN 1 ELSE 0 END) as duplicates_blocked,
      SUM(CASE WHEN action = 'merged' THEN 1 ELSE 0 END) as duplicates_merged,
      AVG(CASE WHEN top_match_score > 0 THEN top_match_score ELSE NULL END) as avg_score
    FROM duplicate_detection_log
  `) as {
    total_checks: number;
    duplicates_found: number;
    duplicates_blocked: number;
    duplicates_merged: number;
    avg_score: number | null;
  };

  return {
    totalChecks: stats.total_checks || 0,
    duplicatesFound: stats.duplicates_found || 0,
    duplicatesBlocked: stats.duplicates_blocked || 0,
    duplicatesMerged: stats.duplicates_merged || 0,
    averageMatchScore: stats.avg_score || 0
  };
}

/**
 * Merge duplicate records
 */
export async function mergeDuplicates(request: MergeRequest): Promise<{ success: boolean; message: string }> {
  const db = getDatabase();

  try {
    // Start transaction
    await db.run('BEGIN TRANSACTION');

    // For each record to merge
    for (const mergeItem of request.mergeIds) {
      if (mergeItem.type === 'intake') {
        // Mark intake as merged/rejected
        await db.run(
          `UPDATE client_intakes SET status = 'merged', merged_into_id = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [request.keepId, mergeItem.id]
        );
      } else if (mergeItem.type === 'client') {
        // Soft delete duplicate client, reassign relationships
        await db.run(
          `UPDATE projects SET client_id = ? WHERE client_id = ?`,
          [request.keepId, mergeItem.id]
        );
        await db.run(
          `UPDATE invoices SET client_id = ? WHERE client_id = ?`,
          [request.keepId, mergeItem.id]
        );
        await db.run(
          `UPDATE clients SET deleted_at = datetime('now'), deleted_by = 'duplicate_merge'
           WHERE id = ?`,
          [mergeItem.id]
        );
      }
    }

    await db.run('COMMIT');

    // Log the merge
    await logDuplicateCheck(
      request.keepType === 'client' ? 'lead' : 'intake',
      { email: '' },
      [],
      'merged'
    );

    return { success: true, message: `Merged ${request.mergeIds.length} duplicate(s) into record ${request.keepId}` };
  } catch (error) {
    await db.run('ROLLBACK');
    return { success: false, message: error instanceof Error ? error.message : 'Merge failed' };
  }
}

export default {
  checkForDuplicates,
  logDuplicateCheck,
  getDuplicateStats,
  mergeDuplicates,
  // Export thresholds for UI
  thresholds: {
    exact: EXACT_MATCH_THRESHOLD,
    high: HIGH_SIMILARITY_THRESHOLD,
    medium: MEDIUM_SIMILARITY_THRESHOLD,
    low: LOW_SIMILARITY_THRESHOLD
  }
};
