/**
 * ===============================================
 * FEEDBACK & TESTIMONIAL SERVICE
 * ===============================================
 * @file server/services/feedback-service.ts
 *
 * Manages feedback surveys, response collection,
 * testimonial approval workflow, NPS analytics,
 * and scheduled reminders / expiration.
 */

import { randomUUID } from 'crypto';
import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';
import {
  SURVEY_EXPIRY_DAYS,
  REMINDER_DELAY_DAYS,
  MIN_NPS_SAMPLE_SIZE
} from './feedback-types.js';
import type {
  FeedbackSurveyRow,
  FeedbackResponseRow,
  FeedbackSurveyWithDetails,
  TestimonialRow,
  TestimonialWithDetails,
  SendSurveyParams,
  SubmitSurveyParams,
  CreateTestimonialParams,
  UpdateTestimonialParams,
  FeedbackAnalytics,
  NpsBreakdown,
  ReminderResult,
  ExpirationResult
} from './feedback-types.js';

// ============================================
// Date Helpers
// ============================================

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().replace('T', ' ').split('.')[0];
}

function subtractDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().replace('T', ' ').split('.')[0];
}

function nowIso(): string {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

// ============================================
// Survey Operations
// ============================================

/**
 * Create and send a feedback survey to a client.
 * Generates a unique token for email-link access.
 */
async function sendSurvey(params: SendSurveyParams): Promise<FeedbackSurveyRow> {
  const db = getDatabase();
  const token = randomUUID();
  const expiryDays = params.expiryDays ?? SURVEY_EXPIRY_DAYS;
  const expiresAt = addDays(expiryDays);
  const sentAt = nowIso();

  const result = await db.run(
    `INSERT INTO feedback_surveys
     (project_id, client_id, survey_type, status, token, sent_at, expires_at, created_at)
     VALUES (?, ?, ?, 'sent', ?, ?, ?, datetime('now'))`,
    [
      params.projectId ?? null,
      params.clientId,
      params.surveyType,
      token,
      sentAt,
      expiresAt
    ]
  );

  const surveyId = result.lastID!;

  // Send survey email to client
  try {
    const client = (await db.get(
      'SELECT email, contact_name, name FROM clients WHERE id = ?',
      [params.clientId]
    )) as { email: string | null; contact_name: string | null; name: string } | undefined;

    if (client?.email) {
      const { emailService } = await import('./email-service.js');
      const { getBaseUrl } = await import('../config/environment.js');
      const surveyUrl = `${getBaseUrl()}/feedback/${token}`;

      await emailService.sendEmail({
        to: client.email,
        subject: 'We\'d love your feedback',
        text: `Hi ${client.contact_name || client.name}, we'd love your feedback. Visit: ${surveyUrl}`,
        html: buildSurveyEmailHtml(client.contact_name || client.name, surveyUrl, params.surveyType)
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to send survey email', {
      category: 'feedback',
      metadata: { surveyId, error: message }
    });
  }

  logger.info('Created and sent feedback survey', {
    category: 'feedback',
    metadata: { surveyId, clientId: params.clientId, surveyType: params.surveyType }
  });

  const survey = (await db.get(
    'SELECT * FROM feedback_surveys WHERE id = ?',
    [surveyId]
  )) as FeedbackSurveyRow;

  return survey;
}

/**
 * List surveys with optional filters. Includes client/project names
 * and attached response.
 */
async function listSurveys(filters?: {
  status?: string;
  surveyType?: string;
  clientId?: number;
}): Promise<FeedbackSurveyWithDetails[]> {
  const db = getDatabase();

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (filters?.status) {
    whereClause += ' AND fs.status = ?';
    params.push(filters.status);
  }
  if (filters?.surveyType) {
    whereClause += ' AND fs.survey_type = ?';
    params.push(filters.surveyType);
  }
  if (filters?.clientId) {
    whereClause += ' AND fs.client_id = ?';
    params.push(filters.clientId);
  }

  const surveys = (await db.all(
    `SELECT fs.*,
            c.name AS client_name,
            c.email AS client_email,
            p.name AS project_name
     FROM feedback_surveys fs
     LEFT JOIN clients c ON fs.client_id = c.id
     LEFT JOIN projects p ON fs.project_id = p.id
     ${whereClause}
     ORDER BY fs.created_at DESC`,
    params
  )) as Array<FeedbackSurveyRow & { client_name: string; client_email: string; project_name: string | null }>;

  // Attach responses where they exist
  const surveyIds = surveys.map(s => s.id);
  let responses: FeedbackResponseRow[] = [];

  if (surveyIds.length > 0) {
    const placeholders = surveyIds.map(() => '?').join(',');
    responses = (await db.all(
      `SELECT * FROM feedback_responses WHERE survey_id IN (${placeholders})`,
      surveyIds
    )) as FeedbackResponseRow[];
  }

  const responseMap = new Map(responses.map(r => [r.survey_id, r]));

  return surveys.map(row => ({
    ...row,
    clientName: row.client_name,
    clientEmail: row.client_email,
    projectName: row.project_name,
    response: responseMap.get(row.id)
  }));
}

/**
 * Get a survey by its public token (for unauthenticated access).
 */
async function getSurveyByToken(token: string): Promise<FeedbackSurveyWithDetails | null> {
  const db = getDatabase();

  const row = (await db.get(
    `SELECT fs.*,
            c.name AS client_name,
            c.email AS client_email,
            p.name AS project_name
     FROM feedback_surveys fs
     LEFT JOIN clients c ON fs.client_id = c.id
     LEFT JOIN projects p ON fs.project_id = p.id
     WHERE fs.token = ?`,
    [token]
  )) as (FeedbackSurveyRow & { client_name: string; client_email: string; project_name: string | null }) | undefined;

  if (!row) return null;

  const response = (await db.get(
    'SELECT * FROM feedback_responses WHERE survey_id = ?',
    [row.id]
  )) as FeedbackResponseRow | undefined;

  return {
    ...row,
    clientName: row.client_name,
    clientEmail: row.client_email,
    projectName: row.project_name,
    response
  };
}

/**
 * Submit a response to a survey via its token.
 * Validates token, checks expiry, creates response,
 * and optionally creates a testimonial.
 */
async function submitResponse(token: string, data: SubmitSurveyParams): Promise<void> {
  const db = getDatabase();

  const survey = (await db.get(
    'SELECT * FROM feedback_surveys WHERE token = ?',
    [token]
  )) as FeedbackSurveyRow | undefined;

  if (!survey) throw new Error('Survey not found');
  if (survey.status === 'completed') throw new Error('Survey already completed');
  if (survey.status === 'expired') throw new Error('Survey has expired');
  if (survey.status !== 'sent') throw new Error('Survey is not available for submission');

  // Check expiry
  if (survey.expires_at && new Date(survey.expires_at) < new Date()) {
    await db.run('UPDATE feedback_surveys SET status = \'expired\' WHERE id = ?', [survey.id]);
    throw new Error('Survey has expired');
  }

  // Insert response
  const testimonialApproved = data.testimonialApproved ? 1 : 0;
  const allowNameUse = data.allowNameUse ? 1 : 0;

  await db.run(
    `INSERT INTO feedback_responses
     (survey_id, overall_rating, nps_score, communication_rating,
      quality_rating, timeliness_rating, highlights, improvements,
      testimonial_text, testimonial_approved, allow_name_use, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      survey.id,
      data.overallRating ?? null,
      data.npsScore ?? null,
      data.communicationRating ?? null,
      data.qualityRating ?? null,
      data.timelinessRating ?? null,
      data.highlights ?? null,
      data.improvements ?? null,
      data.testimonialText ?? null,
      testimonialApproved,
      allowNameUse
    ]
  );

  // Update survey status
  await db.run(
    'UPDATE feedback_surveys SET status = \'completed\', completed_at = datetime(\'now\') WHERE id = ?',
    [survey.id]
  );

  // Auto-create testimonial if client opted in
  if (data.testimonialText && data.testimonialApproved) {
    const client = (await db.get(
      'SELECT name, company FROM clients WHERE id = ?',
      [survey.client_id]
    )) as { name: string; company: string | null } | undefined;

    const responseRow = (await db.get(
      'SELECT id FROM feedback_responses WHERE survey_id = ?',
      [survey.id]
    )) as { id: number };

    await db.run(
      `INSERT INTO testimonials
       (feedback_response_id, client_id, project_id, text, client_name,
        company_name, rating, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_review', datetime('now'))`,
      [
        responseRow.id,
        survey.client_id,
        survey.project_id,
        data.testimonialText,
        data.allowNameUse ? (client?.name ?? 'Anonymous') : 'Anonymous',
        data.allowNameUse ? (client?.company ?? null) : null,
        data.overallRating ?? null
      ]
    );
  }

  // Notify admin
  try {
    const { emailService } = await import('./email-service.js');
    await emailService.sendAdminNotification('New Feedback Survey Response', {
      surveyId: survey.id,
      surveyType: survey.survey_type,
      overallRating: data.overallRating,
      npsScore: data.npsScore,
      hasTestimonial: !!(data.testimonialText && data.testimonialApproved)
    });
  } catch {
    // Non-blocking — response already saved
  }

  logger.info('Survey response submitted', {
    category: 'feedback',
    metadata: { surveyId: survey.id, clientId: survey.client_id }
  });
}

/**
 * Get surveys for a specific client (portal view).
 */
async function getClientSurveys(clientId: number): Promise<FeedbackSurveyWithDetails[]> {
  return listSurveys({ clientId });
}

// ============================================
// Analytics
// ============================================

/**
 * Calculate NPS score and aggregate feedback analytics.
 */
async function getAnalytics(): Promise<FeedbackAnalytics> {
  const db = getDatabase();

  // NPS breakdown
  const npsRows = (await db.all(
    `SELECT fr.nps_score
     FROM feedback_responses fr
     JOIN feedback_surveys fs ON fr.survey_id = fs.id
     WHERE fr.nps_score IS NOT NULL`
  )) as Array<{ nps_score: number }>;

  const nps = calculateNps(npsRows.map(r => r.nps_score));

  // Average ratings
  const ratings = (await db.get(
    `SELECT
       AVG(overall_rating) AS avg_overall,
       AVG(communication_rating) AS avg_communication,
       AVG(quality_rating) AS avg_quality,
       AVG(timeliness_rating) AS avg_timeliness
     FROM feedback_responses
     WHERE overall_rating IS NOT NULL`
  )) as {
    avg_overall: number | null;
    avg_communication: number | null;
    avg_quality: number | null;
    avg_timeliness: number | null;
  };

  // Survey counts
  const counts = (await db.get(
    `SELECT
       COUNT(*) AS total_sent,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS total_completed
     FROM feedback_surveys
     WHERE status IN ('sent', 'completed', 'expired')`
  )) as { total_sent: number; total_completed: number };

  const totalSent = counts.total_sent || 0;
  const totalCompleted = counts.total_completed || 0;
  const completionRate = totalSent > 0 ? totalCompleted / totalSent : 0;

  return {
    nps,
    averageRatings: {
      overall: ratings.avg_overall ?? 0,
      communication: ratings.avg_communication ?? 0,
      quality: ratings.avg_quality ?? 0,
      timeliness: ratings.avg_timeliness ?? 0
    },
    totalSurveysSent: totalSent,
    totalCompleted,
    completionRate,
    sampleSizeWarning: nps.total < MIN_NPS_SAMPLE_SIZE
  };
}

/**
 * Calculate NPS from an array of scores (0-10).
 * Promoters = 9-10, Passives = 7-8, Detractors = 0-6.
 * NPS = ((promoters / total) - (detractors / total)) * 100
 */
function calculateNps(scores: number[]): NpsBreakdown {
  if (scores.length === 0) {
    return { promoters: 0, passives: 0, detractors: 0, total: 0, score: 0 };
  }

  const promoters = scores.filter(s => s >= 9).length;
  const detractors = scores.filter(s => s <= 6).length;
  const passives = scores.length - promoters - detractors;
  const score = Math.round(((promoters - detractors) / scores.length) * 100);

  return { promoters, passives, detractors, total: scores.length, score };
}

// ============================================
// Testimonial Operations
// ============================================

/**
 * List testimonials with optional filters.
 */
async function listTestimonials(filters?: {
  status?: string;
  featured?: boolean;
}): Promise<TestimonialWithDetails[]> {
  const db = getDatabase();

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (filters?.status) {
    whereClause += ' AND t.status = ?';
    params.push(filters.status);
  }
  if (filters?.featured !== undefined) {
    whereClause += ' AND t.featured = ?';
    params.push(filters.featured ? 1 : 0);
  }

  const rows = (await db.all(
    `SELECT t.*, p.name AS project_name
     FROM testimonials t
     LEFT JOIN projects p ON t.project_id = p.id
     ${whereClause}
     ORDER BY t.created_at DESC`,
    params
  )) as Array<TestimonialRow & { project_name: string | null }>;

  return rows.map(row => ({
    ...row,
    projectName: row.project_name
  }));
}

/**
 * Create a testimonial manually (admin-created).
 */
async function createTestimonial(params: CreateTestimonialParams): Promise<number> {
  const db = getDatabase();

  const result = await db.run(
    `INSERT INTO testimonials
     (client_id, project_id, text, client_name, company_name, rating, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending_review', datetime('now'))`,
    [
      params.clientId,
      params.projectId ?? null,
      params.text,
      params.clientName,
      params.companyName ?? null,
      params.rating ?? null
    ]
  );

  logger.info('Created testimonial manually', {
    category: 'feedback',
    metadata: { testimonialId: result.lastID }
  });

  return result.lastID!;
}

/**
 * Update a testimonial.
 */
async function updateTestimonial(id: number, params: UpdateTestimonialParams): Promise<void> {
  const db = getDatabase();

  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  if (params.text !== undefined) {
    setClauses.push('text = ?');
    values.push(params.text);
  }
  if (params.clientName !== undefined) {
    setClauses.push('client_name = ?');
    values.push(params.clientName);
  }
  if (params.companyName !== undefined) {
    setClauses.push('company_name = ?');
    values.push(params.companyName ?? null);
  }
  if (params.rating !== undefined) {
    setClauses.push('rating = ?');
    values.push(params.rating);
  }
  if (params.status !== undefined) {
    setClauses.push('status = ?');
    values.push(params.status);
    if (params.status === 'published') {
      setClauses.push('published_at = datetime(\'now\')');
    }
  }

  if (setClauses.length === 0) return;

  values.push(id);
  await db.run(
    `UPDATE testimonials SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );

  logger.info('Updated testimonial', {
    category: 'feedback',
    metadata: { testimonialId: id }
  });
}

/**
 * Delete a testimonial.
 */
async function deleteTestimonial(id: number): Promise<void> {
  const db = getDatabase();
  await db.run('DELETE FROM testimonials WHERE id = ?', [id]);

  logger.info('Deleted testimonial', {
    category: 'feedback',
    metadata: { testimonialId: id }
  });
}

/**
 * Publish a testimonial (set status to 'published').
 */
async function publishTestimonial(id: number): Promise<void> {
  const db = getDatabase();
  await db.run(
    'UPDATE testimonials SET status = \'published\', published_at = datetime(\'now\') WHERE id = ?',
    [id]
  );

  logger.info('Published testimonial', {
    category: 'feedback',
    metadata: { testimonialId: id }
  });
}

/**
 * Toggle the featured flag on a testimonial.
 */
async function toggleFeatured(id: number): Promise<void> {
  const db = getDatabase();
  await db.run(
    'UPDATE testimonials SET featured = CASE WHEN featured = 1 THEN 0 ELSE 1 END WHERE id = ?',
    [id]
  );

  logger.info('Toggled testimonial featured', {
    category: 'feedback',
    metadata: { testimonialId: id }
  });
}

/**
 * Get published testimonials (public API).
 */
async function getPublicTestimonials(): Promise<TestimonialRow[]> {
  const db = getDatabase();
  return (await db.all(
    `SELECT * FROM testimonials
     WHERE status = 'published'
     ORDER BY published_at DESC`
  )) as TestimonialRow[];
}

/**
 * Get featured published testimonials (public API).
 */
async function getFeaturedTestimonials(): Promise<TestimonialRow[]> {
  const db = getDatabase();
  return (await db.all(
    `SELECT * FROM testimonials
     WHERE status = 'published' AND featured = 1
     ORDER BY published_at DESC`
  )) as TestimonialRow[];
}

// ============================================
// Scheduler Methods
// ============================================

/**
 * Send reminders for surveys that were sent more than
 * REMINDER_DELAY_DAYS ago and haven't been reminded yet.
 */
async function sendReminders(): Promise<ReminderResult> {
  const db = getDatabase();

  const cutoff = subtractDays(REMINDER_DELAY_DAYS);

  const pending = (await db.all(
    `SELECT fs.*, c.email, c.contact_name, c.name AS client_name
     FROM feedback_surveys fs
     LEFT JOIN clients c ON fs.client_id = c.id
     WHERE fs.status = 'sent'
       AND fs.reminder_sent = 0
       AND fs.sent_at <= ?`,
    [cutoff]
  )) as Array<FeedbackSurveyRow & { email: string | null; contact_name: string | null; client_name: string }>;

  let sent = 0;

  for (const survey of pending) {
    try {
      if (survey.email) {
        const { emailService } = await import('./email-service.js');
        const { getBaseUrl } = await import('../config/environment.js');
        const surveyUrl = `${getBaseUrl()}/feedback/${survey.token}`;

        await emailService.sendEmail({
          to: survey.email,
          subject: 'Reminder: We\'d love your feedback',
          text: `Hi ${survey.contact_name || survey.client_name}, just a reminder — we'd love your feedback. Visit: ${surveyUrl}`,
          html: buildSurveyEmailHtml(
            survey.contact_name || survey.client_name,
            surveyUrl,
            survey.survey_type,
            true
          )
        });
      }

      await db.run(
        'UPDATE feedback_surveys SET reminder_sent = 1 WHERE id = ?',
        [survey.id]
      );
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to send survey reminder', {
        category: 'feedback',
        metadata: { surveyId: survey.id, error: message }
      });
    }
  }

  return { sent };
}

/**
 * Expire surveys that have passed their expires_at date.
 */
async function expireOverdue(): Promise<ExpirationResult> {
  const db = getDatabase();

  const now = nowIso();

  const result = await db.run(
    `UPDATE feedback_surveys
     SET status = 'expired'
     WHERE status = 'sent'
       AND expires_at IS NOT NULL
       AND expires_at <= ?`,
    [now]
  );

  const expired = result.changes ?? 0;

  if (expired > 0) {
    logger.info('Expired overdue surveys', {
      category: 'feedback',
      metadata: { expired }
    });
  }

  return { expired };
}

// ============================================
// Email Template Helper
// ============================================

function buildSurveyEmailHtml(
  clientName: string,
  surveyUrl: string,
  surveyType: string,
  isReminder = false
): string {
  const surveyTypeLabel = surveyType === 'nps_quarterly'
    ? 'quarterly satisfaction'
    : surveyType === 'milestone_check_in'
      ? 'milestone check-in'
      : 'project completion';

  const subject = isReminder
    ? 'Reminder: We\'d still love to hear from you'
    : 'We\'d love your feedback';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <h2 style="margin-bottom: 16px;">${subject}</h2>
      <p>Hi ${clientName},</p>
      <p>${isReminder
    ? `Just a friendly reminder — we'd love to hear your thoughts on your recent ${surveyTypeLabel} experience.`
    : `Thank you for working with us. We'd love to hear about your ${surveyTypeLabel} experience.`
}</p>
      <p>Your feedback helps us improve and takes just a couple of minutes.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${surveyUrl}"
           style="display: inline-block; padding: 12px 32px; background-color: #1a1a2e; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Share Your Feedback
        </a>
      </div>
      <p style="color: #666; font-size: 13px;">This link will expire in 30 days.</p>
    </div>
  `;
}

// ============================================
// Singleton Export
// ============================================

export const feedbackService = {
  sendSurvey,
  listSurveys,
  getSurveyByToken,
  submitResponse,
  getClientSurveys,
  getAnalytics,
  listTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  publishTestimonial,
  toggleFeatured,
  getPublicTestimonials,
  getFeaturedTestimonials,
  sendReminders,
  expireOverdue
};
