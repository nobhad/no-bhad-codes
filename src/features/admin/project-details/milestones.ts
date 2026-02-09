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

            // Task progress data
            const taskCount = (m as any).task_count || 0;
            const completedTaskCount = (m as any).completed_task_count || 0;
            const progressPercentage = (m as any).progress_percentage || 0;

            return `
            <div class="milestone-item ${m.is_completed ? 'completed' : ''}" data-milestone-id="${m.id}">
              <div class="milestone-checkbox">
                <input type="checkbox" ${m.is_completed ? 'checked' : ''}
                       onchange="window.adminDashboard?.toggleMilestone(${m.id}, this.checked)">
              </div>
              <div class="milestone-content">
                <div class="milestone-header">
                  <h4 class="milestone-title">${safeTitle}</h4>
                  <div class="milestone-meta">
                    ${m.due_date ? `<span class="milestone-due-date">Due: ${formatDate(m.due_date)}</span>` : ''}
                    ${taskCount > 0 ? `
                      <span class="milestone-task-count">${completedTaskCount}/${taskCount} tasks</span>
                      <span class="milestone-progress-text">${progressPercentage}%</span>
                    ` : ''}
                  </div>
                </div>
                ${taskCount > 0 ? `
                  <div class="milestone-progress-bar">
                    <div class="milestone-progress-fill" style="width: ${progressPercentage}%"></div>
                  </div>
                ` : ''}
                ${safeDescription ? `<p class="milestone-description">${safeDescription}</p>` : ''}
                ${safeDeliverables ? `<ul class="milestone-deliverables">${safeDeliverables}</ul>` : ''}
                ${taskCount > 0 ? `
                  <button class="btn-milestone-tasks" onclick="window.adminDashboard?.toggleMilestoneTasks(${m.id}, ${projectId})">
                    <svg class="icon-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>Show Tasks (${taskCount})</span>
                  </button>
                  <div class="milestone-tasks-container" id="milestone-tasks-${m.id}" style="display: none;"></div>
                ` : ''}
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

/**
 * Toggle visibility of tasks for a milestone
 */
export async function toggleMilestoneTasks(
  milestoneId: number,
  projectId: number
): Promise<void> {
  const container = document.getElementById(`milestone-tasks-${milestoneId}`);
  const button = document.querySelector(
    `.milestone-item[data-milestone-id="${milestoneId}"] .btn-milestone-tasks`
  ) as HTMLButtonElement;

  if (!container || !button) return;

  const isVisible = container.style.display !== 'none';

  if (isVisible) {
    // Hide tasks
    container.style.display = 'none';
    button.innerHTML = `
      <svg class="icon-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Show Tasks</span>
    `;
  } else {
    // Show tasks - load if empty
    if (!container.hasAttribute('data-loaded')) {
      try {
        const response = await apiFetch(
          `/api/projects/${projectId}/tasks?milestoneId=${milestoneId}`
        );

        if (response.ok) {
          const data = await response.json();
          const tasks = data.tasks || [];

          if (tasks.length === 0) {
            container.innerHTML = '<p class="milestone-tasks-empty">No tasks for this milestone yet.</p>';
          } else {
            container.innerHTML = `
              <ul class="milestone-task-list">
                ${tasks
    .map(
      (task: any) => `
                  <li class="milestone-task-item ${task.status}" data-task-id="${task.id}">
                    <input
                      type="checkbox"
                      ${task.status === 'completed' ? 'checked' : ''}
                      onchange="window.adminDashboard?.toggleTaskCompletion(${task.id}, this.checked, ${projectId})"
                    >
                    <span class="milestone-task-title">${SanitizationUtils.escapeHtml(task.title)}</span>
                    <div class="milestone-task-meta">
                      ${task.due_date ? `<span class="task-due">${formatDate(task.due_date)}</span>` : ''}
                      ${task.assigned_to ? `<span class="task-assigned">${SanitizationUtils.escapeHtml(task.assigned_to)}</span>` : ''}
                    </div>
                  </li>
                `
    )
    .join('')}
              </ul>
            `;
          }

          container.setAttribute('data-loaded', 'true');
        } else {
          container.innerHTML = '<p class="milestone-tasks-error">Failed to load tasks.</p>';
        }
      } catch (error) {
        console.error('[ProjectMilestones] Error loading milestone tasks:', error);
        container.innerHTML = '<p class="milestone-tasks-error">Error loading tasks.</p>';
      }
    }

    container.style.display = 'block';
    button.innerHTML = `
      <svg class="icon-chevron icon-chevron-up" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M12 10L8 6L4 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Hide Tasks</span>
    `;
  }
}

/**
 * Toggle task completion status
 */
export async function toggleTaskCompletion(
  taskId: number,
  isCompleted: boolean,
  projectId: number
): Promise<void> {
  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiPut(`/api/projects/tasks/${taskId}`, {
      status: isCompleted ? 'completed' : 'pending'
    });

    if (response.ok) {
      // Update task UI
      const taskElement = document.querySelector(`.milestone-task-item[data-task-id="${taskId}"]`);
      if (taskElement) {
        if (isCompleted) {
          taskElement.classList.add('completed');
        } else {
          taskElement.classList.remove('completed');
        }
      }

      // Reload milestones to update progress
      await loadProjectMilestones(projectId, (progress) => {
        updateProgressBar(projectId, progress);
      });
    } else {
      alertError('Failed to update task. Please try again.');
      // Revert checkbox
      const checkbox = document.querySelector(
        `.milestone-task-item[data-task-id="${taskId}"] input[type="checkbox"]`
      ) as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = !isCompleted;
      }
    }
  } catch (error) {
    console.error('[ProjectMilestones] Error toggling task:', error);
    alertError('Failed to update task. Please try again.');
  }
}
