/**
 * ===============================================
 * CLIENT INFO SERVICE
 * ===============================================
 * @file server/services/client-info-service.ts
 *
 * Service for managing client onboarding progress and
 * information completeness tracking.
 */

import { getDatabase } from '../database/init.js';

// =====================================================
// TYPES
// =====================================================

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';

export interface OnboardingProgress {
  id: number;
  client_id: number;
  project_id?: number;
  current_step: number;
  step_data: Record<string, unknown>;
  status: OnboardingStatus;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientInfoCompleteness {
  id: number;
  client_id: number;
  overall_percentage: number;
  profile_complete: boolean;
  documents_pending: number;
  documents_approved: number;
  documents_total: number;
  questionnaires_pending: number;
  questionnaires_completed: number;
  questionnaires_total: number;
  onboarding_complete: boolean;
  last_calculated_at: string;
}

export interface ClientInfoStatus {
  client_id: number;
  client_name: string;
  client_email: string;
  completeness: ClientInfoCompleteness;
  onboarding: OnboardingProgress | null;
}

export interface MissingItem {
  type: 'document' | 'questionnaire' | 'profile' | 'onboarding';
  id?: number;
  title: string;
  description?: string;
  due_date?: string;
  priority?: string;
}

interface OnboardingStepData {
  // Step 1: Basic Info
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;

  // Step 2: Project Overview
  project_type?: string;
  project_description?: string;
  project_goals?: string[];

  // Step 3: Requirements
  features?: string[];
  budget_range?: string;
  timeline?: string;

  // Step 4: Assets Checklist
  has_logo?: boolean;
  has_brand_colors?: boolean;
  has_content?: boolean;
  has_photos?: boolean;
  needs_help_with?: string[];

  // Step 5: Review
  confirmed?: boolean;
}

// =====================================================
// SERVICE CLASS
// =====================================================

class ClientInfoService {
  // =====================================================
  // COMPLETENESS CALCULATION
  // =====================================================

  /**
   * Calculate and update completeness for a client
   */
  async calculateCompleteness(clientId: number): Promise<ClientInfoCompleteness> {
    const db = await getDatabase();

    // Get document request stats
    const docStats = await db.get(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status IN ('requested', 'viewed') THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
       FROM document_requests
       WHERE client_id = ?`,
      [clientId]
    ) as { total: number; pending: number; approved: number } | undefined;

    // Get questionnaire response stats
    const qStats = await db.get(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status IN ('pending', 'in_progress') THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM questionnaire_responses
       WHERE client_id = ?`,
      [clientId]
    ) as { total: number; pending: number; completed: number } | undefined;

    // Get onboarding status
    const onboarding = await this.getOnboardingProgress(clientId);

    // Get client profile to check completeness
    const client = await db.get(
      `SELECT company_name, contact_name, email, phone, address
       FROM clients WHERE id = ?`,
      [clientId]
    ) as { company_name?: string; contact_name?: string; email?: string; phone?: string; address?: string } | undefined;

    // Calculate profile completeness
    const profileFields = ['company_name', 'contact_name', 'email', 'phone', 'address'];
    const filledFields = profileFields.filter(
      field => client && client[field as keyof typeof client]
    );
    const profileComplete = filledFields.length >= 4; // At least 4 of 5 fields

    // Calculate overall percentage
    let totalWeight = 0;
    let completedWeight = 0;

    // Profile: 20% weight
    totalWeight += 20;
    completedWeight += profileComplete ? 20 : (filledFields.length / profileFields.length) * 20;

    // Onboarding: 20% weight
    totalWeight += 20;
    if (onboarding?.status === 'completed') {
      completedWeight += 20;
    } else if (onboarding?.current_step) {
      completedWeight += (onboarding.current_step / 5) * 20;
    }

    // Documents: 30% weight (if any exist)
    if (docStats && docStats.total > 0) {
      totalWeight += 30;
      completedWeight += (docStats.approved / docStats.total) * 30;
    }

    // Questionnaires: 30% weight (if any exist)
    if (qStats && qStats.total > 0) {
      totalWeight += 30;
      completedWeight += (qStats.completed / qStats.total) * 30;
    }

    // Normalize percentage
    const overallPercentage = totalWeight > 0
      ? Math.round((completedWeight / totalWeight) * 100)
      : 0;

    // Upsert completeness record
    const existing = await db.get(
      'SELECT id FROM client_info_completeness WHERE client_id = ?',
      [clientId]
    );

    if (existing) {
      await db.run(
        `UPDATE client_info_completeness
         SET overall_percentage = ?,
             profile_complete = ?,
             documents_pending = ?,
             documents_approved = ?,
             documents_total = ?,
             questionnaires_pending = ?,
             questionnaires_completed = ?,
             questionnaires_total = ?,
             onboarding_complete = ?,
             last_calculated_at = CURRENT_TIMESTAMP
         WHERE client_id = ?`,
        [
          overallPercentage,
          profileComplete ? 1 : 0,
          docStats?.pending || 0,
          docStats?.approved || 0,
          docStats?.total || 0,
          qStats?.pending || 0,
          qStats?.completed || 0,
          qStats?.total || 0,
          onboarding?.status === 'completed' ? 1 : 0,
          clientId
        ]
      );
    } else {
      await db.run(
        `INSERT INTO client_info_completeness
         (client_id, overall_percentage, profile_complete,
          documents_pending, documents_approved, documents_total,
          questionnaires_pending, questionnaires_completed, questionnaires_total,
          onboarding_complete)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clientId,
          overallPercentage,
          profileComplete ? 1 : 0,
          docStats?.pending || 0,
          docStats?.approved || 0,
          docStats?.total || 0,
          qStats?.pending || 0,
          qStats?.completed || 0,
          qStats?.total || 0,
          onboarding?.status === 'completed' ? 1 : 0
        ]
      );
    }

    return this.getCompleteness(clientId) as Promise<ClientInfoCompleteness>;
  }

  /**
   * Get completeness record for a client
   */
  async getCompleteness(clientId: number): Promise<ClientInfoCompleteness | null> {
    const db = await getDatabase();

    const row = await db.get(
      'SELECT * FROM client_info_completeness WHERE client_id = ?',
      [clientId]
    );

    if (!row) return null;

    return this.mapCompletenessRow(row);
  }

  /**
   * Get full client info status
   */
  async getClientInfoStatus(clientId: number): Promise<ClientInfoStatus | null> {
    const db = await getDatabase();

    const client = await db.get(
      `SELECT id, company_name, contact_name, email
       FROM clients WHERE id = ?`,
      [clientId]
    ) as { id: number; company_name?: string; contact_name?: string; email: string } | undefined;

    if (!client) return null;

    // Calculate and get completeness
    const completeness = await this.calculateCompleteness(clientId);
    const onboarding = await this.getOnboardingProgress(clientId);

    return {
      client_id: client.id,
      client_name: client.company_name || client.contact_name || 'Unknown',
      client_email: client.email,
      completeness,
      onboarding
    };
  }

  /**
   * Get info status for all clients (admin dashboard)
   */
  async getAllClientsInfoStatus(filters?: {
    minCompleteness?: number;
    maxCompleteness?: number;
    onboardingStatus?: OnboardingStatus;
  }): Promise<ClientInfoStatus[]> {
    const db = await getDatabase();

    // Get all clients
    const clients = await db.all(
      `SELECT id, company_name, contact_name, email
       FROM clients
       WHERE deleted_at IS NULL
       ORDER BY COALESCE(company_name, contact_name) ASC`
    ) as Array<{ id: number; company_name?: string; contact_name?: string; email: string }>;

    const results: ClientInfoStatus[] = [];

    for (const client of clients) {
      const status = await this.getClientInfoStatus(client.id);
      if (!status) continue;

      // Apply filters
      if (filters?.minCompleteness !== undefined &&
          status.completeness.overall_percentage < filters.minCompleteness) {
        continue;
      }
      if (filters?.maxCompleteness !== undefined &&
          status.completeness.overall_percentage > filters.maxCompleteness) {
        continue;
      }
      if (filters?.onboardingStatus !== undefined &&
          status.onboarding?.status !== filters.onboardingStatus) {
        continue;
      }

      results.push(status);
    }

    return results;
  }

  /**
   * Get list of missing items for a client
   */
  async getMissingItems(clientId: number): Promise<MissingItem[]> {
    const db = await getDatabase();
    const items: MissingItem[] = [];

    // Check profile completeness
    const client = await db.get(
      `SELECT company_name, contact_name, email, phone, address
       FROM clients WHERE id = ?`,
      [clientId]
    ) as { company_name?: string; contact_name?: string; email?: string; phone?: string; address?: string } | undefined;

    if (client) {
      if (!client.company_name) {
        items.push({
          type: 'profile',
          title: 'Company Name',
          description: 'Please add your company or business name'
        });
      }
      if (!client.phone) {
        items.push({
          type: 'profile',
          title: 'Phone Number',
          description: 'Please add a contact phone number'
        });
      }
      if (!client.address) {
        items.push({
          type: 'profile',
          title: 'Business Address',
          description: 'Please add your business address'
        });
      }
    }

    // Check onboarding
    const onboarding = await this.getOnboardingProgress(clientId);
    if (!onboarding || onboarding.status !== 'completed') {
      items.push({
        type: 'onboarding',
        title: 'Complete Onboarding Wizard',
        description: 'Complete the onboarding wizard to help us understand your project needs'
      });
    }

    // Check pending document requests
    const pendingDocs = await db.all(
      `SELECT id, title, description, due_date, priority
       FROM document_requests
       WHERE client_id = ? AND status IN ('requested', 'viewed')
       ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC`,
      [clientId]
    ) as Array<{ id: number; title: string; description?: string; due_date?: string; priority?: string }>;

    for (const doc of pendingDocs) {
      items.push({
        type: 'document',
        id: doc.id,
        title: doc.title,
        description: doc.description,
        due_date: doc.due_date,
        priority: doc.priority
      });
    }

    // Check pending questionnaires
    const pendingQuestionnaires = await db.all(
      `SELECT qr.id, q.name as title, q.description, qr.due_date
       FROM questionnaire_responses qr
       JOIN questionnaires q ON qr.questionnaire_id = q.id
       WHERE qr.client_id = ? AND qr.status IN ('pending', 'in_progress')
       ORDER BY CASE WHEN qr.due_date IS NULL THEN 1 ELSE 0 END, qr.due_date ASC`,
      [clientId]
    ) as Array<{ id: number; title: string; description?: string; due_date?: string }>;

    for (const q of pendingQuestionnaires) {
      items.push({
        type: 'questionnaire',
        id: q.id,
        title: q.title,
        description: q.description,
        due_date: q.due_date
      });
    }

    return items;
  }

  // =====================================================
  // ONBOARDING MANAGEMENT
  // =====================================================

  /**
   * Get onboarding progress for a client
   */
  async getOnboardingProgress(clientId: number): Promise<OnboardingProgress | null> {
    const db = await getDatabase();

    const row = await db.get(
      'SELECT * FROM client_onboarding WHERE client_id = ?',
      [clientId]
    );

    if (!row) return null;

    return this.mapOnboardingRow(row);
  }

  /**
   * Save onboarding progress
   */
  async saveOnboardingProgress(
    clientId: number,
    step: number,
    stepData: OnboardingStepData,
    projectId?: number
  ): Promise<OnboardingProgress> {
    const db = await getDatabase();

    const existing = await this.getOnboardingProgress(clientId);

    if (existing) {
      // Merge step data
      const mergedData = { ...existing.step_data, ...stepData };

      await db.run(
        `UPDATE client_onboarding
         SET current_step = ?,
             step_data = ?,
             project_id = COALESCE(?, project_id),
             status = 'in_progress',
             updated_at = CURRENT_TIMESTAMP
         WHERE client_id = ?`,
        [step, JSON.stringify(mergedData), projectId, clientId]
      );
    } else {
      await db.run(
        `INSERT INTO client_onboarding
         (client_id, project_id, current_step, step_data, status)
         VALUES (?, ?, ?, ?, 'in_progress')`,
        [clientId, projectId || null, step, JSON.stringify(stepData)]
      );
    }

    return this.getOnboardingProgress(clientId) as Promise<OnboardingProgress>;
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding(
    clientId: number,
    finalData?: OnboardingStepData
  ): Promise<OnboardingProgress> {
    const db = await getDatabase();

    const existing = await this.getOnboardingProgress(clientId);

    if (!existing) {
      // Create new completed record
      await db.run(
        `INSERT INTO client_onboarding
         (client_id, current_step, step_data, status, completed_at)
         VALUES (?, 5, ?, 'completed', CURRENT_TIMESTAMP)`,
        [clientId, JSON.stringify(finalData || {})]
      );
    } else {
      // Update existing record
      const mergedData = finalData
        ? { ...existing.step_data, ...finalData }
        : existing.step_data;

      await db.run(
        `UPDATE client_onboarding
         SET current_step = 5,
             step_data = ?,
             status = 'completed',
             completed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE client_id = ?`,
        [JSON.stringify(mergedData), clientId]
      );
    }

    // Recalculate completeness
    await this.calculateCompleteness(clientId);

    return this.getOnboardingProgress(clientId) as Promise<OnboardingProgress>;
  }

  /**
   * Reset onboarding (start over)
   */
  async resetOnboarding(clientId: number): Promise<void> {
    const db = await getDatabase();
    await db.run('DELETE FROM client_onboarding WHERE client_id = ?', [clientId]);
    await this.calculateCompleteness(clientId);
  }

  // =====================================================
  // HELPERS
  // =====================================================

  /**
   * Map completeness database row to typed object
   */
  private mapCompletenessRow(row: Record<string, unknown>): ClientInfoCompleteness {
    return {
      id: row.id as number,
      client_id: row.client_id as number,
      overall_percentage: row.overall_percentage as number,
      profile_complete: Boolean(row.profile_complete),
      documents_pending: row.documents_pending as number,
      documents_approved: row.documents_approved as number,
      documents_total: row.documents_total as number,
      questionnaires_pending: row.questionnaires_pending as number,
      questionnaires_completed: row.questionnaires_completed as number,
      questionnaires_total: row.questionnaires_total as number,
      onboarding_complete: Boolean(row.onboarding_complete),
      last_calculated_at: row.last_calculated_at as string
    };
  }

  /**
   * Map onboarding database row to typed object
   */
  private mapOnboardingRow(row: Record<string, unknown>): OnboardingProgress {
    return {
      id: row.id as number,
      client_id: row.client_id as number,
      project_id: row.project_id as number | undefined,
      current_step: row.current_step as number,
      step_data: typeof row.step_data === 'string'
        ? JSON.parse(row.step_data)
        : row.step_data as Record<string, unknown>,
      status: row.status as OnboardingStatus,
      completed_at: row.completed_at as string | undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string
    };
  }
}

// Export singleton instance
export const clientInfoService = new ClientInfoService();
