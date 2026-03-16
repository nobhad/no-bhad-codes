/**
 * ===============================================
 * TIER-AWARE MILESTONE GENERATOR SERVICE
 * ===============================================
 * @file server/services/tier-milestone-generator.ts
 *
 * Generates milestones and tasks based on project type AND proposal tier.
 * Falls back to default milestone generation if no tier config exists.
 */

import { getDatabase } from '../database/init.js';
import {
  normalizeProjectType,
  getMilestoneTemplates,
  MilestoneTemplate
} from '../config/default-milestones.js';
import { getTierMilestoneTemplates } from '../config/tier-milestones.js';
import { generateMilestoneTasks } from './task-generator.js';
import { logger } from './logger.js';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { TaskTemplate } from '../config/default-tasks.js';

// Load tier task data from JSON
const __dirname = dirname(fileURLToPath(import.meta.url));
const tierTasksPath = resolve(__dirname, '../config/tier-tasks.json');

let TIER_TASKS: Record<string, Record<string, Record<string, TaskTemplate[]>>> = {};
try {
  TIER_TASKS = JSON.parse(readFileSync(tierTasksPath, 'utf-8'));
} catch {
  logger.warn('[TierMilestoneGenerator] tier-tasks.json not found, will use default tasks');
}

/** Proposal feature selection shape */
interface ProposalFeature {
  feature_id?: string;
  feature_name: string;
  feature_price?: number;
  feature_category?: string | null;
  is_included_in_tier?: number | boolean;
  is_addon?: number | boolean;
}

/**
 * Get tier-specific task templates for a milestone
 */
function getTierTaskTemplates(
  milestoneTitle: string,
  projectType: string,
  tier: string
): TaskTemplate[] {
  const normalizedType = normalizeProjectType(projectType);
  const normalizedTier = (tier || 'good').toLowerCase().trim();
  const normalizedTitle = milestoneTitle
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');

  const projectTasks = TIER_TASKS[normalizedType]?.[normalizedTier];
  if (projectTasks && projectTasks[normalizedTitle]) {
    return projectTasks[normalizedTitle];
  }

  // No tier-specific tasks found
  return [];
}

/**
 * Generate tier-aware milestones and tasks for a project
 *
 * @param projectId - Project ID
 * @param projectType - Project type (e.g., 'simple-site')
 * @param tier - Proposal tier ('good' | 'better' | 'best')
 * @param proposalFeatures - Optional features from proposal_feature_selections
 * @param options - Generation options
 */
export async function generateTierMilestones(
  projectId: number,
  projectType: string,
  tier: string,
  proposalFeatures?: ProposalFeature[],
  options: { startDate?: Date; skipIfExists?: boolean } = {}
): Promise<{ milestonesCreated: number; tasksCreated: number }> {
  const db = getDatabase();
  const startDate = options.startDate || new Date();
  const milestoneIds: number[] = [];
  let totalTasksCreated = 0;

  try {
    // Check if milestones already exist
    if (options.skipIfExists !== false) {
      const existingCount = (await db.get(
        'SELECT COUNT(*) as count FROM milestones WHERE project_id = ?',
        [projectId]
      )) as { count: number };

      if (existingCount && existingCount.count > 0) {
        logger.info(
          `[TierMilestoneGenerator] Skipping project ${projectId}: ${existingCount.count} milestones already exist`
        );
        return { milestonesCreated: 0, tasksCreated: 0 };
      }
    }

    // Get tier-specific templates, fall back to defaults
    let templates = getTierMilestoneTemplates(projectType, tier);
    if (templates.length === 0) {
      templates = getMilestoneTemplates(projectType);
    }

    const normalizedType = normalizeProjectType(projectType);
    const normalizedTier = (tier || 'good').toLowerCase().trim();

    logger.info(
      `[TierMilestoneGenerator] Generating ${templates.length} milestones for project ${projectId} (type: ${normalizedType}, tier: ${normalizedTier})`
    );

    // Generate each milestone
    for (const template of templates) {
      const dueDate = calculateDueDate(startDate, template.estimatedDays);
      const deliverables = template.deliverables ? JSON.stringify(template.deliverables) : null;

      const result = await db.run(
        `INSERT INTO milestones (
          project_id, title, description, due_date, deliverables,
          is_completed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, FALSE, datetime('now'), datetime('now'))`,
        [projectId, template.name, template.description, dueDate, deliverables]
      );

      if (result?.lastID) {
        const milestoneId = result.lastID;
        milestoneIds.push(milestoneId);

        // Try tier-specific tasks first, fall back to default task generator
        try {
          const tierTasks = getTierTaskTemplates(template.name, projectType, tier);

          if (tierTasks.length > 0) {
            // Use tier-specific tasks
            const taskIds = await insertTasks(
              db,
              projectId,
              milestoneId,
              tierTasks,
              dueDate,
              startDate
            );
            totalTasksCreated += taskIds.length;
          } else {
            // Fall back to default task generator
            const taskIds = await generateMilestoneTasks(
              projectId,
              milestoneId,
              template.name,
              dueDate,
              projectType,
              { skipIfExists: false }
            );
            totalTasksCreated += taskIds.length;
          }
        } catch (taskError) {
          logger.error(
            `[TierMilestoneGenerator] Error generating tasks for milestone ${milestoneId}:`,
            { error: taskError instanceof Error ? taskError : undefined }
          );
        }
      }
    }

    // Generate addon feature tasks
    if (proposalFeatures && proposalFeatures.length > 0) {
      const addonFeatures = proposalFeatures.filter((f) => Boolean(f.is_addon));

      if (addonFeatures.length > 0 && milestoneIds.length > 0) {
        // Add addon tasks to the best development/execution milestone
        const targetMilestoneId = findBestMilestoneForAddons(templates, milestoneIds);

        for (const feature of addonFeatures) {
          try {
            const addonSortOrder = 900 + totalTasksCreated;
            const addonDescription = `Addon feature from proposal: ${feature.feature_name}${feature.feature_category ? ` (${feature.feature_category})` : ''}`;

            const addonTaskResult = await db.run(
              `INSERT INTO project_tasks (
                project_id, milestone_id, title, description,
                status, priority, sort_order, created_at, updated_at
              ) VALUES (?, ?, ?, ?, 'pending', 'medium', ?, datetime('now'), datetime('now'))`,
              [
                projectId,
                targetMilestoneId,
                `Implement: ${feature.feature_name}`,
                addonDescription,
                addonSortOrder
              ]
            );

            if (addonTaskResult?.lastID) {
              totalTasksCreated++;
            }
          } catch (addonError) {
            logger.error(
              `[TierMilestoneGenerator] Error creating addon task for feature "${feature.feature_name}":`,
              { error: addonError instanceof Error ? addonError : undefined }
            );
          }
        }
      }
    }

    logger.info(
      `[TierMilestoneGenerator] Created ${milestoneIds.length} milestones and ${totalTasksCreated} tasks for project ${projectId}`
    );
    return { milestonesCreated: milestoneIds.length, tasksCreated: totalTasksCreated };
  } catch (error) {
    logger.error(`[TierMilestoneGenerator] Error for project ${projectId}:`, {
      error: error instanceof Error ? error : undefined
    });
    throw error;
  }
}

/** Calculate due date from start date and days offset */
function calculateDueDate(startDate: Date, daysOffset: number): string {
  const dueDate = new Date(startDate);
  dueDate.setDate(dueDate.getDate() + daysOffset);
  return dueDate.toISOString().split('T')[0];
}

/** Insert tasks directly from templates */
async function insertTasks(
  db: Awaited<ReturnType<typeof getDatabase>>,
  projectId: number,
  milestoneId: number,
  templates: TaskTemplate[],
  milestoneDueDate: string,
  startDate: Date
): Promise<number[]> {
  const taskIds: number[] = [];
  const taskCount = templates.length;

  // Calculate distributed due dates
  const milestoneDate = new Date(milestoneDueDate);
  const daysUntilMilestone = Math.max(
    1,
    Math.ceil((milestoneDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const interval = daysUntilMilestone / taskCount;

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    const daysOffset = Math.floor(interval * (i + 1));
    const taskDueDate = new Date(startDate);
    taskDueDate.setDate(taskDueDate.getDate() + daysOffset);
    const dueDateStr = taskDueDate.toISOString().split('T')[0];

    const result = await db.run(
      `INSERT INTO project_tasks (
        project_id, milestone_id, title, description,
        status, priority, due_date, estimated_hours,
        sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', 'medium', ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        projectId,
        milestoneId,
        template.title,
        template.description || null,
        dueDateStr,
        template.estimatedHours || null,
        template.order
      ]
    );

    if (result?.lastID) {
      taskIds.push(result.lastID);
    }
  }

  return taskIds;
}

/** Find the best milestone to attach addon feature tasks to */
function findBestMilestoneForAddons(
  templates: MilestoneTemplate[],
  milestoneIds: number[]
): number {
  // Look for a development-related milestone
  const devKeywords = ['development', 'dev', 'build', 'execution', 'core'];
  for (let i = 0; i < templates.length; i++) {
    const name = templates[i].name.toLowerCase();
    if (devKeywords.some((kw) => name.includes(kw))) {
      return milestoneIds[i];
    }
  }

  // Fall back to the second-to-last milestone (usually the main work phase)
  if (milestoneIds.length >= 2) {
    return milestoneIds[milestoneIds.length - 2];
  }

  // Last resort: use the last milestone
  return milestoneIds[milestoneIds.length - 1];
}
