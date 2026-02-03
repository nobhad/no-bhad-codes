/**
 * Project Milestones Module
 * @file src/features/admin/project-details/milestones.ts
 *
 * Handles loading, creating, updating, and deleting project milestones.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { formatDate } from '../../../utils/format-utils';
import { AdminAuth } from '../admin-auth';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../../utils/api-client';
import { confirmDanger, alertError, multiPromptDialog } from '../../../utils/confirm-dialog';
import { domCache } from './dom-cache';
import type { ProjectMilestoneResponse } from '../../../types/api';

/**
 * Load milestones for the specified project
 */
export async function loadProjectMilestones(
  projectId: number,
  onProgressUpdate: (progress: number) => void
): Promise<void> {
  const milestonesList = domCache.get('milestonesList');
  if (!milestonesList) return;

  if (!AdminAuth.isAuthenticated()) {
    milestonesList.innerHTML = '<p class="empty-state">Authentication required.</p>';
    return;
  }

  try {
    const response = await apiFetch(`/api/projects/${projectId}/milestones`);

    if (response.ok) {
      const data = await response.json();
      const milestones = data.milestones || [];

      if (milestones.length === 0) {
        milestonesList.innerHTML =
          '<p class="empty-state">No milestones yet. Add milestones to track project progress.</p>';
      } else {
        milestonesList.innerHTML = milestones
          .map((m: ProjectMilestoneResponse) => {
            // Sanitize user data to prevent XSS
            const safeTitle = SanitizationUtils.escapeHtml(m.title || '');
            const safeDescription = SanitizationUtils.escapeHtml(m.description || '');
            const deliverablesArray = Array.isArray(m.deliverables)
              ? m.deliverables
              : (typeof m.deliverables === 'string' && m.deliverables.trim()
                ? [m.deliverables]
                : []);
            const safeDeliverables =
              deliverablesArray.length > 0
                ? deliverablesArray
                  .map((d: string) => `<li>${SanitizationUtils.escapeHtml(d)}</li>`)
                  .join('')
                : '';
            return `
            <div class="milestone-item ${m.is_completed ? 'completed' : ''}" data-milestone-id="${m.id}">
              <div class="milestone-checkbox">
                <input type="checkbox" ${m.is_completed ? 'checked' : ''}
                       onchange="window.adminDashboard?.toggleMilestone(${m.id}, this.checked)">
              </div>
              <div class="milestone-content">
                <div class="milestone-header">
                  <h4 class="milestone-title">${safeTitle}</h4>
                  ${m.due_date ? `<span class="milestone-due-date">${formatDate(m.due_date)}</span>` : ''}
                </div>
                ${safeDescription ? `<p class="milestone-description">${safeDescription}</p>` : ''}
                ${safeDeliverables ? `<ul class="milestone-deliverables">${safeDeliverables}</ul>` : ''}
              </div>
              <button class="btn btn-danger btn-sm" onclick="window.adminDashboard?.deleteMilestone(${m.id})">Delete</button>
            </div>
          `;
          })
          .join('');

        // Calculate and update progress based on completed milestones
        const completedCount = milestones.filter((m: ProjectMilestoneResponse) => m.is_completed).length;
        const totalCount = milestones.length;
        const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        onProgressUpdate(progress);
      }
    }
  } catch (error) {
    console.error('[ProjectMilestones] Error loading milestones:', error);
    milestonesList.innerHTML = '<p class="empty-state">Error loading milestones.</p>';
  }
}

/**
 * Update the progress bar display and save to database
 */
export function updateProgressBar(projectId: number, progress: number): void {
  const progressPercent = domCache.get('progressPercent');
  const progressBar = domCache.get('progressBar');
  const progressBarContainer = domCache.get('progressBarContainer');

  if (progressPercent) {
    progressPercent.textContent = `${progress}%`;
  }
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }
  // Update aria-valuenow for screen readers
  if (progressBarContainer) {
    progressBarContainer.setAttribute('aria-valuenow', progress.toString());
  }

  // Save progress to database
  apiPut(`/api/projects/${projectId}`, { progress })
    .catch(err => console.error('[ProjectMilestones] Error saving progress:', err));
}

/**
 * Show prompt to add a new milestone
 */
export async function showAddMilestonePrompt(
  projectId: number,
  onSuccess: () => void
): Promise<void> {
  const defaultDueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const result = await multiPromptDialog({
    title: 'Add Milestone',
    fields: [
      {
        name: 'title',
        label: 'Milestone Title',
        type: 'text',
        placeholder: 'Enter milestone title',
        required: true
      },
      {
        name: 'description',
        label: 'Description (optional)',
        type: 'textarea',
        placeholder: 'Enter milestone description'
      },
      {
        name: 'dueDate',
        label: 'Due Date (optional)',
        type: 'date',
        defaultValue: defaultDueDate
      }
    ],
    confirmText: 'Add Milestone',
    cancelText: 'Cancel'
  });

  if (!result) return;

  await addMilestone(projectId, result.title, result.description || '', result.dueDate || '', onSuccess);
}

/**
 * Add a new milestone to the specified project
 */
export async function addMilestone(
  projectId: number,
  title: string,
  description: string,
  dueDate: string,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiPost(`/api/projects/${projectId}/milestones`, {
      title,
      description: description || null,
      due_date: dueDate || null,
      deliverables: []
    });

    if (response.ok) {
      onSuccess();
    } else {
      alertError('Failed to add milestone. Please try again.');
    }
  } catch (error) {
    console.error('[ProjectMilestones] Error adding milestone:', error);
    alertError('Failed to add milestone. Please try again.');
  }
}

/**
 * Toggle milestone completion status
 */
export async function toggleMilestone(
  projectId: number,
  milestoneId: number,
  isCompleted: boolean,
  onSuccess: () => void
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiPut(
      `/api/projects/${projectId}/milestones/${milestoneId}`,
      { is_completed: isCompleted }
    );

    if (response.ok) {
      onSuccess();
    } else {
      alertError('Failed to update milestone. Please try again.');
    }
  } catch (error) {
    console.error('[ProjectMilestones] Error toggling milestone:', error);
    alertError('Failed to update milestone. Please try again.');
  }
}

/**
 * Delete a milestone
 */
export async function deleteMilestone(
  projectId: number,
  milestoneId: number,
  onSuccess: () => void
): Promise<void> {
  const confirmed = await confirmDanger(
    'Are you sure you want to delete this milestone?',
    'Delete Milestone'
  );
  if (!confirmed) return;

  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiDelete(
      `/api/projects/${projectId}/milestones/${milestoneId}`
    );

    if (response.ok) {
      onSuccess();
    } else {
      alertError('Failed to delete milestone. Please try again.');
    }
  } catch (error) {
    console.error('[ProjectMilestones] Error deleting milestone:', error);
    alertError('Failed to delete milestone. Please try again.');
  }
}
