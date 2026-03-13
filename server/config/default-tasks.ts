/**
 * ===============================================
 * DEFAULT TASKS CONFIGURATION
 * ===============================================
 * @file server/config/default-tasks.ts
 *
 * Defines default task templates per milestone type.
 * These are auto-generated when milestones are created for a project.
 *
 * Task data lives in default-tasks.json. This module provides
 * the TypeScript interface and lookup functions.
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

/**
 * Task template interface
 */
export interface TaskTemplate {
  /** Display name for the task */
  title: string;
  /** Brief description of task scope (optional) */
  description?: string;
  /** Display order within milestone (1-based) */
  order: number;
  /** Optional estimated hours to complete */
  estimatedHours?: number;
}

// Load task data from JSON (once at startup)
// Resolves relative to this file's location — works with tsx (dev) and tsc (build)
const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = resolve(__dirname, 'default-tasks.json');

export const DEFAULT_TASKS: Record<string, Record<string, TaskTemplate[]>> = JSON.parse(
  readFileSync(jsonPath, 'utf-8')
);

/**
 * Milestone title normalizer for matching
 *
 * Converts milestone titles to lowercase and removes special characters
 * to enable fuzzy matching with task templates.
 *
 * @param milestoneTitle - Original milestone title
 * @returns Normalized title for matching
 */
export function normalizeMilestoneTitle(milestoneTitle: string): string {
  return milestoneTitle
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Get task templates for a specific milestone
 *
 * @param milestoneTitle - Title of the milestone (will be normalized)
 * @param projectType - Type of project (will be normalized)
 * @returns Array of task templates, or empty array if no match
 */
export function getTaskTemplatesForMilestone(
  milestoneTitle: string,
  projectType: string
): TaskTemplate[] {
  // Normalize project type (use same normalization as milestone-generator)
  const normalizedProjectType = projectType
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  // Get tasks for this project type, fallback to 'other'
  const projectTasks = DEFAULT_TASKS[normalizedProjectType] || DEFAULT_TASKS['other'];

  // Normalize milestone title for matching
  const normalizedTitle = normalizeMilestoneTitle(milestoneTitle);

  // Look up tasks by normalized milestone title
  return projectTasks[normalizedTitle] || [];
}
