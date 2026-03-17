/**
 * ===============================================
 * EMAIL SEQUENCE SERVICE
 * ===============================================
 * @file server/services/sequence-service.ts
 *
 * Manages email drip sequences: CRUD for sequences
 * and steps, enrollment lifecycle, queue processing,
 * event-driven auto-enrollment, and analytics.
 */

import { getDatabase } from '../database/init.js';
import { emailService } from './email-service.js';
import { emailTemplateService } from './email-template-service.js';
import { logger } from './logger.js';
import type {
  EmailSequenceRow,
  SequenceStepRow,
  SequenceEnrollmentRow,
  // SequenceSendLogRow used in future send log queries
  CreateSequenceParams,
  CreateStepParams,
  EnrollEntityParams,
  SequenceWithSteps,
  SequenceAnalytics,
  StepMetric,
  ProcessQueueResult
} from './sequence-types.js';

// ============================================
// Constants
// ============================================

const SEQUENCE_COLUMNS = `
  id, name, description, trigger_event, trigger_conditions,
  is_active, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const STEP_COLUMNS = `
  id, sequence_id, step_order, delay_hours, email_template_id,
  subject_override, body_override, stop_conditions, created_at
`.replace(/\s+/g, ' ').trim();

const ENROLLMENT_COLUMNS = `
  id, sequence_id, entity_type, entity_id, entity_email, entity_name,
  current_step_order, status, next_send_at, enrolled_at,
  completed_at, stopped_at, stopped_reason
`.replace(/\s+/g, ' ').trim();

const _SEND_LOG_COLUMNS = `
  id, enrollment_id, step_id, sent_at, email_status, error_message
`.replace(/\s+/g, ' ').trim();

const PROCESS_BATCH_SIZE = 50;
const MAX_FAILURES_BEFORE_BOUNCE = 3;
const LOG_CATEGORY = 'email-sequences';

// ============================================
// CRUD — Sequences
// ============================================

/**
 * Create a new email sequence with its steps.
 */
async function create(params: CreateSequenceParams): Promise<number> {
  const db = getDatabase();
  const triggerConditionsJson = JSON.stringify(params.triggerConditions || {});

  const result = await db.run(
    `INSERT INTO email_sequences (name, description, trigger_event, trigger_conditions, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [
      params.name,
      params.description || null,
      params.triggerEvent,
      triggerConditionsJson
    ]
  );

  const sequenceId = result.lastID!;

  for (let i = 0; i < params.steps.length; i++) {
    const step = params.steps[i];
    await insertStep(db, sequenceId, i + 1, step);
  }

  logger.info('Created email sequence', {
    category: LOG_CATEGORY,
    metadata: { sequenceId, name: params.name, stepCount: params.steps.length }
  });

  return sequenceId;
}

/**
 * Update sequence metadata (does not modify steps).
 */
async function update(
  id: number,
  params: Partial<Pick<CreateSequenceParams, 'name' | 'description' | 'triggerEvent' | 'triggerConditions'>> & { isActive?: boolean }
): Promise<void> {
  const db = getDatabase();

  const updates: string[] = [];
  const values: (string | number | boolean | null)[] = [];

  if (params.name !== undefined) {
    updates.push('name = ?');
    values.push(params.name);
  }
  if (params.description !== undefined) {
    updates.push('description = ?');
    values.push(params.description);
  }
  if (params.triggerEvent !== undefined) {
    updates.push('trigger_event = ?');
    values.push(params.triggerEvent);
  }
  if (params.triggerConditions !== undefined) {
    updates.push('trigger_conditions = ?');
    values.push(JSON.stringify(params.triggerConditions));
  }
  if (params.isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(params.isActive ? 1 : 0);
  }

  if (updates.length === 0) return;

  updates.push('updated_at = datetime(\'now\')');
  values.push(id);

  await db.run(
    `UPDATE email_sequences SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  logger.info('Updated email sequence', {
    category: LOG_CATEGORY,
    metadata: { sequenceId: id }
  });
}

/**
 * Delete a sequence. Stops all active enrollments first.
 */
async function deleteSequence(id: number): Promise<void> {
  const db = getDatabase();

  // Stop all active enrollments before deleting
  await db.run(
    `UPDATE sequence_enrollments
     SET status = 'stopped', stopped_at = datetime('now'), stopped_reason = 'Sequence deleted'
     WHERE sequence_id = ? AND status IN ('active', 'paused')`,
    [id]
  );

  await db.run('DELETE FROM email_sequences WHERE id = ?', [id]);

  logger.info('Deleted email sequence', {
    category: LOG_CATEGORY,
    metadata: { sequenceId: id }
  });
}

/**
 * List all sequences with step counts and enrollment statistics.
 */
async function list(): Promise<SequenceWithSteps[]> {
  const db = getDatabase();

  const sequences = await db.all<EmailSequenceRow>(
    `SELECT ${SEQUENCE_COLUMNS} FROM email_sequences ORDER BY created_at DESC`
  );

  const enriched: SequenceWithSteps[] = [];

  for (const seq of sequences) {
    const steps = await db.all<SequenceStepRow>(
      `SELECT ${STEP_COLUMNS} FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order`,
      [seq.id]
    );

    const enrollmentStats = await db.get<{ total: number; completed: number }>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM sequence_enrollments
       WHERE sequence_id = ?`,
      [seq.id]
    );

    const totalEnrollments = enrollmentStats?.total || 0;
    const completedCount = enrollmentStats?.completed || 0;
    const completionRate = totalEnrollments > 0
      ? Math.round((completedCount / totalEnrollments) * 100) / 100
      : 0;

    enriched.push({
      ...seq,
      steps,
      enrollmentCount: totalEnrollments,
      completionRate
    });
  }

  return enriched;
}

/**
 * Get a single sequence by ID with full steps.
 */
async function getById(id: number): Promise<SequenceWithSteps | null> {
  const db = getDatabase();

  const seq = await db.get<EmailSequenceRow>(
    `SELECT ${SEQUENCE_COLUMNS} FROM email_sequences WHERE id = ?`,
    [id]
  );

  if (!seq) return null;

  const steps = await db.all<SequenceStepRow>(
    `SELECT ${STEP_COLUMNS} FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order`,
    [id]
  );

  const enrollmentStats = await db.get<{ total: number; completed: number }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM sequence_enrollments
     WHERE sequence_id = ?`,
    [id]
  );

  const totalEnrollments = enrollmentStats?.total || 0;
  const completedCount = enrollmentStats?.completed || 0;
  const completionRate = totalEnrollments > 0
    ? Math.round((completedCount / totalEnrollments) * 100) / 100
    : 0;

  return {
    ...seq,
    steps,
    enrollmentCount: totalEnrollments,
    completionRate
  };
}

// ============================================
// Steps
// ============================================

/**
 * Add a step to a sequence.
 */
async function addStep(sequenceId: number, params: CreateStepParams): Promise<number> {
  const db = getDatabase();

  // Determine next step_order
  const maxOrderRow = await db.get<{ max_order: number | null }>(
    'SELECT MAX(step_order) as max_order FROM sequence_steps WHERE sequence_id = ?',
    [sequenceId]
  );
  const nextOrder = (maxOrderRow?.max_order || 0) + 1;

  const result = await db.run(
    `INSERT INTO sequence_steps (sequence_id, step_order, delay_hours, email_template_id, subject_override, body_override, stop_conditions)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      sequenceId,
      nextOrder,
      params.delayHours,
      params.emailTemplateId || null,
      params.subjectOverride || null,
      params.bodyOverride || null,
      JSON.stringify(params.stopConditions || {})
    ]
  );

  await touchSequenceUpdatedAt(sequenceId);

  return result.lastID!;
}

/**
 * Update an existing step.
 */
async function updateStep(stepId: number, params: Partial<CreateStepParams>): Promise<void> {
  const db = getDatabase();

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (params.delayHours !== undefined) {
    updates.push('delay_hours = ?');
    values.push(params.delayHours);
  }
  if (params.emailTemplateId !== undefined) {
    updates.push('email_template_id = ?');
    values.push(params.emailTemplateId || null);
  }
  if (params.subjectOverride !== undefined) {
    updates.push('subject_override = ?');
    values.push(params.subjectOverride || null);
  }
  if (params.bodyOverride !== undefined) {
    updates.push('body_override = ?');
    values.push(params.bodyOverride || null);
  }
  if (params.stopConditions !== undefined) {
    updates.push('stop_conditions = ?');
    values.push(JSON.stringify(params.stopConditions));
  }

  if (updates.length === 0) return;

  values.push(stepId);

  await db.run(
    `UPDATE sequence_steps SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  // Touch parent sequence
  const step = await db.get<SequenceStepRow>(
    'SELECT sequence_id FROM sequence_steps WHERE id = ?',
    [stepId]
  );
  if (step) {
    await touchSequenceUpdatedAt(step.sequence_id);
  }
}

/**
 * Delete a step.
 */
async function deleteStep(stepId: number): Promise<void> {
  const db = getDatabase();

  const step = await db.get<SequenceStepRow>(
    'SELECT sequence_id FROM sequence_steps WHERE id = ?',
    [stepId]
  );

  await db.run('DELETE FROM sequence_steps WHERE id = ?', [stepId]);

  if (step) {
    await touchSequenceUpdatedAt(step.sequence_id);
  }
}

/**
 * Reorder steps by providing an array of step IDs in desired order.
 */
async function reorderSteps(sequenceId: number, stepIds: number[]): Promise<void> {
  const db = getDatabase();

  for (let i = 0; i < stepIds.length; i++) {
    await db.run(
      'UPDATE sequence_steps SET step_order = ? WHERE id = ? AND sequence_id = ?',
      [i + 1, stepIds[i], sequenceId]
    );
  }

  await touchSequenceUpdatedAt(sequenceId);
}

// ============================================
// Enrollment
// ============================================

/**
 * Enroll an entity in a sequence.
 * Sets next_send_at based on the first step's delay.
 */
async function enrollEntity(params: EnrollEntityParams): Promise<number> {
  const db = getDatabase();

  // Check if entity is already actively enrolled in this sequence
  const existingEnrollment = await db.get<SequenceEnrollmentRow>(
    `SELECT id FROM sequence_enrollments
     WHERE sequence_id = ? AND entity_type = ? AND entity_id = ? AND status IN ('active', 'paused')`,
    [params.sequenceId, params.entityType, params.entityId]
  );

  if (existingEnrollment) {
    logger.info('Entity already enrolled in sequence, skipping', {
      category: LOG_CATEGORY,
      metadata: {
        sequenceId: params.sequenceId,
        entityType: params.entityType,
        entityId: params.entityId,
        existingEnrollmentId: existingEnrollment.id
      }
    });
    return existingEnrollment.id;
  }

  // Get first step to calculate initial next_send_at
  const firstStep = await db.get<SequenceStepRow>(
    'SELECT delay_hours FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order ASC LIMIT 1',
    [params.sequenceId]
  );

  const nextSendAt = calculateNextSendTime(firstStep?.delay_hours || 0);

  const result = await db.run(
    `INSERT INTO sequence_enrollments
     (sequence_id, entity_type, entity_id, entity_email, entity_name, current_step_order, status, next_send_at)
     VALUES (?, ?, ?, ?, ?, 0, 'active', ?)`,
    [
      params.sequenceId,
      params.entityType,
      params.entityId,
      params.entityEmail,
      params.entityName || null,
      nextSendAt
    ]
  );

  logger.info('Enrolled entity in sequence', {
    category: LOG_CATEGORY,
    metadata: {
      enrollmentId: result.lastID,
      sequenceId: params.sequenceId,
      entityType: params.entityType,
      entityId: params.entityId
    }
  });

  return result.lastID!;
}

/**
 * Stop an enrollment with a reason.
 */
async function stopEnrollment(enrollmentId: number, reason: string): Promise<void> {
  const db = getDatabase();

  await db.run(
    `UPDATE sequence_enrollments
     SET status = 'stopped', stopped_at = datetime('now'), stopped_reason = ?, next_send_at = NULL
     WHERE id = ? AND status IN ('active', 'paused')`,
    [reason, enrollmentId]
  );

  logger.info('Stopped enrollment', {
    category: LOG_CATEGORY,
    metadata: { enrollmentId, reason }
  });
}

/**
 * Pause an enrollment. Preserves position but halts processing.
 */
async function pauseEnrollment(enrollmentId: number): Promise<void> {
  const db = getDatabase();

  await db.run(
    `UPDATE sequence_enrollments
     SET status = 'paused', next_send_at = NULL
     WHERE id = ? AND status = 'active'`,
    [enrollmentId]
  );

  logger.info('Paused enrollment', {
    category: LOG_CATEGORY,
    metadata: { enrollmentId }
  });
}

/**
 * Resume a paused enrollment. Recalculates next_send_at for the current step.
 */
async function resumeEnrollment(enrollmentId: number): Promise<void> {
  const db = getDatabase();

  const enrollment = await db.get<SequenceEnrollmentRow>(
    `SELECT ${ENROLLMENT_COLUMNS} FROM sequence_enrollments WHERE id = ? AND status = 'paused'`,
    [enrollmentId]
  );

  if (!enrollment) return;

  // Get the next step to send
  const nextStep = await db.get<SequenceStepRow>(
    `SELECT delay_hours FROM sequence_steps
     WHERE sequence_id = ? AND step_order > ?
     ORDER BY step_order ASC LIMIT 1`,
    [enrollment.sequence_id, enrollment.current_step_order]
  );

  // If no next step, mark completed
  if (!nextStep) {
    await db.run(
      `UPDATE sequence_enrollments
       SET status = 'completed', completed_at = datetime('now'), next_send_at = NULL
       WHERE id = ?`,
      [enrollmentId]
    );
    return;
  }

  // Resume with a small delay to allow immediate processing
  const RESUME_DELAY_HOURS = 0;
  const nextSendAt = calculateNextSendTime(RESUME_DELAY_HOURS);

  await db.run(
    `UPDATE sequence_enrollments
     SET status = 'active', next_send_at = ?
     WHERE id = ?`,
    [nextSendAt, enrollmentId]
  );

  logger.info('Resumed enrollment', {
    category: LOG_CATEGORY,
    metadata: { enrollmentId }
  });
}

/**
 * Stop all active/paused enrollments for a specific entity.
 * Returns the number of enrollments stopped.
 */
async function stopByEntity(entityType: string, entityId: number, reason?: string): Promise<number> {
  const db = getDatabase();
  const stopReason = reason || 'Stopped by entity action';

  const result = await db.run(
    `UPDATE sequence_enrollments
     SET status = 'stopped', stopped_at = datetime('now'), stopped_reason = ?, next_send_at = NULL
     WHERE entity_type = ? AND entity_id = ? AND status IN ('active', 'paused')`,
    [stopReason, entityType, entityId]
  );

  const stoppedCount = result.changes || 0;

  if (stoppedCount > 0) {
    logger.info('Stopped enrollments by entity', {
      category: LOG_CATEGORY,
      metadata: { entityType, entityId, stoppedCount, reason: stopReason }
    });
  }

  return stoppedCount;
}

// ============================================
// Queue Processing
// ============================================

/**
 * Process the enrollment queue. Called by the scheduler cron.
 * Finds enrollments where next_send_at <= now and processes them.
 */
async function processQueue(): Promise<ProcessQueueResult> {
  const db = getDatabase();
  const nowIso = new Date().toISOString();

  const result: ProcessQueueResult = {
    sent: 0,
    failed: 0,
    stopped: 0,
    completed: 0
  };

  // Get enrollments ready to process
  const readyEnrollments = await db.all<SequenceEnrollmentRow>(
    `SELECT ${ENROLLMENT_COLUMNS} FROM sequence_enrollments
     WHERE status = 'active' AND next_send_at <= ?
     ORDER BY next_send_at ASC
     LIMIT ?`,
    [nowIso, PROCESS_BATCH_SIZE]
  );

  if (readyEnrollments.length === 0) return result;

  logger.info('Processing sequence queue', {
    category: LOG_CATEGORY,
    metadata: { enrollmentCount: readyEnrollments.length }
  });

  for (const enrollment of readyEnrollments) {
    try {
      const stepResult = await processEnrollmentStep(db, enrollment);

      if (stepResult === 'sent') result.sent++;
      else if (stepResult === 'failed') result.failed++;
      else if (stepResult === 'stopped') result.stopped++;
      else if (stepResult === 'completed') result.completed++;
    } catch (processingError) {
      logger.error('Error processing enrollment step', {
        category: LOG_CATEGORY,
        metadata: {
          enrollmentId: enrollment.id,
          error: processingError instanceof Error ? processingError.message : String(processingError)
        }
      });
      result.failed++;
    }
  }

  logger.info('Sequence queue processing complete', {
    category: LOG_CATEGORY,
    metadata: { sent: result.sent, failed: result.failed, stopped: result.stopped, completed: result.completed }
  });

  return result;
}

/**
 * Process a single enrollment step.
 * Returns the outcome: 'sent', 'failed', 'stopped', or 'completed'.
 */
async function processEnrollmentStep(
  db: ReturnType<typeof getDatabase>,
  enrollment: SequenceEnrollmentRow
): Promise<'sent' | 'failed' | 'stopped' | 'completed'> {
  // Get the next step for this enrollment
  const nextStep = await db.get<SequenceStepRow>(
    `SELECT ${STEP_COLUMNS} FROM sequence_steps
     WHERE sequence_id = ? AND step_order > ?
     ORDER BY step_order ASC LIMIT 1`,
    [enrollment.sequence_id, enrollment.current_step_order]
  );

  // No more steps — mark enrollment as completed
  if (!nextStep) {
    await db.run(
      `UPDATE sequence_enrollments
       SET status = 'completed', completed_at = datetime('now'), next_send_at = NULL
       WHERE id = ?`,
      [enrollment.id]
    );
    return 'completed';
  }

  // Evaluate stop conditions
  const shouldStop = await evaluateStopConditions(nextStep.stop_conditions, enrollment);
  if (shouldStop) {
    await db.run(
      `UPDATE sequence_enrollments
       SET status = 'stopped', stopped_at = datetime('now'), stopped_reason = 'Stop condition met', next_send_at = NULL
       WHERE id = ?`,
      [enrollment.id]
    );
    return 'stopped';
  }

  // Build the email content
  const emailContent = await buildEmailContent(nextStep, enrollment);

  if (!emailContent) {
    await logSend(db, enrollment.id, nextStep.id, 'failed', 'Could not build email content');
    return 'failed';
  }

  // Check failure count for this step to detect bounce threshold
  const failureCount = await getStepFailureCount(db, enrollment.id, nextStep.id);
  if (failureCount >= MAX_FAILURES_BEFORE_BOUNCE) {
    await logSend(db, enrollment.id, nextStep.id, 'bounced', 'Max retries exceeded');
    await db.run(
      `UPDATE sequence_enrollments
       SET status = 'stopped', stopped_at = datetime('now'), stopped_reason = 'Bounced after max retries', next_send_at = NULL
       WHERE id = ?`,
      [enrollment.id]
    );
    return 'stopped';
  }

  // Send the email
  const sendResult = await emailService.sendEmail({
    to: enrollment.entity_email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html
  });

  if (sendResult.success) {
    await logSend(db, enrollment.id, nextStep.id, 'sent', null);

    // Advance to next step
    const followingStep = await db.get<SequenceStepRow>(
      `SELECT delay_hours FROM sequence_steps
       WHERE sequence_id = ? AND step_order > ?
       ORDER BY step_order ASC LIMIT 1`,
      [enrollment.sequence_id, nextStep.step_order]
    );

    if (followingStep) {
      const nextSendAt = calculateNextSendTime(followingStep.delay_hours);
      await db.run(
        `UPDATE sequence_enrollments
         SET current_step_order = ?, next_send_at = ?
         WHERE id = ?`,
        [nextStep.step_order, nextSendAt, enrollment.id]
      );
    } else {
      // This was the last step
      await db.run(
        `UPDATE sequence_enrollments
         SET current_step_order = ?, status = 'completed', completed_at = datetime('now'), next_send_at = NULL
         WHERE id = ?`,
        [nextStep.step_order, enrollment.id]
      );
      return 'completed';
    }

    return 'sent';
  }
  await logSend(db, enrollment.id, nextStep.id, 'failed', sendResult.message);
  return 'failed';

}

// ============================================
// Event Handling
// ============================================

/**
 * Handle an application event by finding matching active sequences
 * and auto-enrolling the entity.
 */
async function handleEvent(
  eventType: string,
  context: { entityType: string; entityId: number; entityEmail: string; entityName?: string; data?: Record<string, unknown> }
): Promise<void> {
  const db = getDatabase();

  const matchingSequences = await db.all<EmailSequenceRow>(
    `SELECT ${SEQUENCE_COLUMNS} FROM email_sequences
     WHERE trigger_event = ? AND is_active = 1`,
    [eventType]
  );

  for (const sequence of matchingSequences) {
    const conditionsMatch = evaluateTriggerConditions(
      sequence.trigger_conditions,
      context.data || {}
    );

    if (!conditionsMatch) continue;

    try {
      await enrollEntity({
        sequenceId: sequence.id,
        entityType: context.entityType,
        entityId: context.entityId,
        entityEmail: context.entityEmail,
        entityName: context.entityName
      });
    } catch (enrollError) {
      logger.error('Failed to auto-enroll entity in sequence', {
        category: LOG_CATEGORY,
        metadata: {
          sequenceId: sequence.id,
          entityType: context.entityType,
          entityId: context.entityId,
          error: enrollError instanceof Error ? enrollError.message : String(enrollError)
        }
      });
    }
  }
}

// ============================================
// Analytics
// ============================================

/**
 * Get analytics for a sequence including per-step metrics.
 */
async function getAnalytics(sequenceId: number): Promise<SequenceAnalytics> {
  const db = getDatabase();

  const enrollmentCounts = await db.get<{
    total: number;
    active: number;
    completed: number;
    stopped: number;
  }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status = 'stopped' THEN 1 ELSE 0 END) as stopped
     FROM sequence_enrollments
     WHERE sequence_id = ?`,
    [sequenceId]
  );

  const steps = await db.all<SequenceStepRow>(
    'SELECT id, step_order FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order',
    [sequenceId]
  );

  const stepMetrics: StepMetric[] = [];

  for (const step of steps) {
    const metrics = await db.get<{
      total_sent: number;
      total_failed: number;
      total_bounced: number;
      total_opened: number;
      total_clicked: number;
    }>(
      `SELECT
         SUM(CASE WHEN email_status = 'sent' THEN 1 ELSE 0 END) as total_sent,
         SUM(CASE WHEN email_status = 'failed' THEN 1 ELSE 0 END) as total_failed,
         SUM(CASE WHEN email_status = 'bounced' THEN 1 ELSE 0 END) as total_bounced,
         SUM(CASE WHEN email_status = 'opened' THEN 1 ELSE 0 END) as total_opened,
         SUM(CASE WHEN email_status = 'clicked' THEN 1 ELSE 0 END) as total_clicked
       FROM sequence_send_logs
       WHERE step_id = ?`,
      [step.id]
    );

    stepMetrics.push({
      stepId: step.id,
      stepOrder: step.step_order,
      totalSent: metrics?.total_sent || 0,
      totalFailed: metrics?.total_failed || 0,
      totalBounced: metrics?.total_bounced || 0,
      totalOpened: metrics?.total_opened || 0,
      totalClicked: metrics?.total_clicked || 0
    });
  }

  return {
    totalEnrollments: enrollmentCounts?.total || 0,
    activeEnrollments: enrollmentCounts?.active || 0,
    completedEnrollments: enrollmentCounts?.completed || 0,
    stoppedEnrollments: enrollmentCounts?.stopped || 0,
    stepMetrics
  };
}

/**
 * Get all enrollments for a sequence.
 */
async function getEnrollments(sequenceId: number): Promise<SequenceEnrollmentRow[]> {
  const db = getDatabase();

  return db.all<SequenceEnrollmentRow>(
    `SELECT ${ENROLLMENT_COLUMNS} FROM sequence_enrollments
     WHERE sequence_id = ?
     ORDER BY enrolled_at DESC`,
    [sequenceId]
  );
}

// ============================================
// Internal Helpers
// ============================================

/**
 * Insert a step row into the database.
 */
async function insertStep(
  db: ReturnType<typeof getDatabase>,
  sequenceId: number,
  stepOrder: number,
  params: CreateStepParams
): Promise<void> {
  await db.run(
    `INSERT INTO sequence_steps (sequence_id, step_order, delay_hours, email_template_id, subject_override, body_override, stop_conditions)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      sequenceId,
      stepOrder,
      params.delayHours,
      params.emailTemplateId || null,
      params.subjectOverride || null,
      params.bodyOverride || null,
      JSON.stringify(params.stopConditions || {})
    ]
  );
}

/**
 * Update the updated_at timestamp on a sequence.
 */
async function touchSequenceUpdatedAt(sequenceId: number): Promise<void> {
  const db = getDatabase();
  await db.run(
    'UPDATE email_sequences SET updated_at = datetime(\'now\') WHERE id = ?',
    [sequenceId]
  );
}

/**
 * Calculate the ISO timestamp for next_send_at given a delay in hours.
 */
function calculateNextSendTime(delayHours: number): string {
  const sendTime = new Date();
  const MILLISECONDS_PER_HOUR = 3600000;
  sendTime.setTime(sendTime.getTime() + delayHours * MILLISECONDS_PER_HOUR);
  return sendTime.toISOString();
}

/**
 * Log a send attempt to the sequence_send_logs table.
 */
async function logSend(
  db: ReturnType<typeof getDatabase>,
  enrollmentId: number,
  stepId: number,
  emailStatus: string,
  errorMessage: string | null
): Promise<void> {
  await db.run(
    `INSERT INTO sequence_send_logs (enrollment_id, step_id, email_status, error_message)
     VALUES (?, ?, ?, ?)`,
    [enrollmentId, stepId, emailStatus, errorMessage]
  );
}

/**
 * Count failures for a specific enrollment + step combination.
 */
async function getStepFailureCount(
  db: ReturnType<typeof getDatabase>,
  enrollmentId: number,
  stepId: number
): Promise<number> {
  const row = await db.get<{ failure_count: number }>(
    `SELECT COUNT(*) as failure_count FROM sequence_send_logs
     WHERE enrollment_id = ? AND step_id = ? AND email_status = 'failed'`,
    [enrollmentId, stepId]
  );
  return row?.failure_count || 0;
}

/**
 * Build email content from a step, using either the linked template or overrides.
 */
async function buildEmailContent(
  step: SequenceStepRow,
  enrollment: SequenceEnrollmentRow
): Promise<{ subject: string; html: string; text: string } | null> {
  const templateVariables: Record<string, unknown> = {
    entity: {
      name: enrollment.entity_name || enrollment.entity_email,
      email: enrollment.entity_email,
      type: enrollment.entity_type,
      id: enrollment.entity_id
    }
  };

  // If a template is linked, use it
  if (step.email_template_id) {
    const template = await emailTemplateService.getTemplate(step.email_template_id);
    if (!template) {
      logger.warn('Email template not found for sequence step', {
        category: LOG_CATEGORY,
        metadata: { stepId: step.id, templateId: step.email_template_id }
      });
      return null;
    }

    const subject = step.subject_override
      ? emailTemplateService.interpolate(step.subject_override, templateVariables)
      : emailTemplateService.interpolate(template.subject, templateVariables);

    const html = step.body_override
      ? emailTemplateService.interpolate(step.body_override, templateVariables)
      : emailTemplateService.interpolate(template.body_html, templateVariables);

    const text = template.body_text
      ? emailTemplateService.interpolate(template.body_text, templateVariables)
      : stripHtml(html);

    return { subject, html, text };
  }

  // Use overrides directly
  if (step.subject_override && step.body_override) {
    const subject = emailTemplateService.interpolate(step.subject_override, templateVariables);
    const html = emailTemplateService.interpolate(step.body_override, templateVariables);
    const text = stripHtml(html);

    return { subject, html, text };
  }

  // Neither template nor overrides — cannot build
  return null;
}

/**
 * Strip HTML tags for plain-text fallback.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, '\'')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Evaluate stop conditions for a step against enrollment data.
 * Returns true if the enrollment should be stopped.
 */
async function evaluateStopConditions(
  stopConditionsJson: string,
  enrollment: SequenceEnrollmentRow
): Promise<boolean> {
  try {
    const conditions = JSON.parse(stopConditionsJson);

    // Empty conditions means no stop
    if (!conditions || Object.keys(conditions).length === 0) {
      return false;
    }

    // Check entity-level stop conditions (e.g., lead converted)
    if (conditions.entity_status) {
      const db = getDatabase();
      const entityTable = getEntityTable(enrollment.entity_type);
      if (entityTable) {
        const entity = await db.get<{ status: string }>(
          `SELECT status FROM ${entityTable} WHERE id = ?`,
          [enrollment.entity_id]
        );
        if (entity && entity.status === conditions.entity_status) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Evaluate trigger conditions to determine if a sequence should auto-enroll.
 * Compares each condition key/value against the event data.
 */
function evaluateTriggerConditions(
  triggerConditionsJson: string,
  eventData: Record<string, unknown>
): boolean {
  try {
    const conditions = JSON.parse(triggerConditionsJson);

    // Empty conditions always match
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    // All conditions must match
    for (const [key, expectedValue] of Object.entries(conditions)) {
      if (eventData[key] !== expectedValue) {
        return false;
      }
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Map entity type to its database table name.
 */
function getEntityTable(entityType: string): string | null {
  const entityTableMap: Record<string, string> = {
    lead: 'leads',
    client: 'clients',
    contact: 'contact_submissions',
    project: 'projects'
  };

  return entityTableMap[entityType] || null;
}

// ============================================
// Singleton Export
// ============================================

export const sequenceService = {
  // CRUD
  create,
  update,
  deleteSequence,
  list,
  getById,

  // Steps
  addStep,
  updateStep,
  deleteStep,
  reorderSteps,

  // Enrollment
  enrollEntity,
  stopEnrollment,
  pauseEnrollment,
  resumeEnrollment,
  stopByEntity,

  // Processing
  processQueue,

  // Events
  handleEvent,

  // Analytics
  getAnalytics,
  getEnrollments
};
