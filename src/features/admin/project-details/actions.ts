/**
 * Project Actions Module
 * @file src/features/admin/project-details/actions.ts
 *
 * Handles project-level actions: delete, archive, duplicate.
 * Contract actions extracted to: ./actions-contracts.ts
 */

import { AdminAuth } from '../admin-auth';
import { apiPost, apiPut, apiDelete, parseApiResponse } from '../../../utils/api-client';
import { showToast } from '../../../utils/toast-notifications';
import {
  confirmDialog,
  confirmDanger,
  alertError
} from '../../../utils/confirm-dialog';
import type { ProjectResponse } from '../../../types/api';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('ProjectActions');

// Re-export contract actions for backward compatibility
export {
  handleContractSign,
  handleContractCountersign,
  showContractBuilder
} from './actions-contracts';

/** Base project type for action functions - compatible with both LeadProject and ProjectResponse */
interface ProjectBase {
  id: number;
  project_name?: string;
  client_id?: number;
  client_name?: string;
  contact_name?: string;
  company_name?: string;
  email?: string;
  project_type?: string;
  budget_range?: string;
  budget?: number;
  timeline?: string;
  description?: string;
  notes?: string;
}

/**
 * Delete a project
 */
export async function deleteProject(
  projectId: number,
  projectsData: ProjectBase[],
  onSuccess: () => void
): Promise<void> {
  const project = projectsData.find((p) => p.id === projectId);
  const projectName = project?.project_name || 'this project';

  const confirmed = await confirmDanger(
    `Are you sure you want to delete "${projectName}"? This action cannot be undone. All associated files, milestones, and invoices will also be deleted.`,
    'Delete',
    'Delete Project'
  );
  if (!confirmed) return;

  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiDelete(`/api/projects/${projectId}`);

    if (response.ok) {
      showToast('Project deleted successfully', 'success');
      onSuccess();
    } else {
      const errorData = await response.json().catch(() => ({}));
      alertError(errorData.error || 'Failed to delete project. Please try again.');
    }
  } catch (error) {
    logger.error(' Error deleting project:', error);
    alertError('Failed to delete project. Please try again.');
  }
}

/**
 * Archive a project
 */
export async function archiveProject(
  projectId: number,
  projectsData: ProjectBase[],
  loadProjects: () => Promise<void>,
  showProjectDetail: (id: number) => void
): Promise<void> {
  const project = projectsData.find((p) => p.id === projectId);
  const projectName = project?.project_name || 'this project';

  const confirmed = await confirmDialog({
    title: 'Archive Project',
    message: `Archive "${projectName}"? The project will be moved to archived status and can be restored later.`,
    confirmText: 'Archive',
    cancelText: 'Cancel'
  });
  if (!confirmed) return;

  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiPut(`/api/projects/${projectId}`, {
      status: 'archived'
    });

    if (response.ok) {
      showToast('Project archived successfully', 'success');
      await loadProjects();
      showProjectDetail(projectId);
    } else {
      const errorData = await response.json().catch(() => ({}));
      alertError(errorData.error || 'Failed to archive project. Please try again.');
    }
  } catch (error) {
    logger.error(' Error archiving project:', error);
    alertError('Failed to archive project. Please try again.');
  }
}

/**
 * Duplicate a project
 */
export async function duplicateProject(
  projectId: number,
  projectsData: ProjectBase[],
  loadProjects: () => Promise<void>,
  showProjectDetail: (id: number) => void
): Promise<void> {
  const project = projectsData.find((p) => p.id === projectId);
  if (!project) return;

  const confirmed = await confirmDialog({
    title: 'Duplicate Project',
    message: `Create a copy of "${project.project_name}"? This will create a new project with the same settings but no files or invoices.`,
    confirmText: 'Duplicate',
    cancelText: 'Cancel'
  });
  if (!confirmed) return;

  if (!AdminAuth.isAuthenticated()) return;

  try {
    const response = await apiPost('/api/projects', {
      project_name: `${project.project_name} (Copy)`,
      client_id: project.client_id,
      contact_name: project.contact_name,
      email: project.email,
      company_name: project.company_name,
      project_type: project.project_type,
      budget: project.budget,
      timeline: project.timeline,
      description: project.description,
      notes: project.notes,
      status: 'pending'
    });

    if (response.ok) {
      const result = await parseApiResponse<{ project: ProjectResponse }>(response);
      showToast('Project duplicated successfully', 'success');
      await loadProjects();
      if (result.project?.id) {
        showProjectDetail(result.project.id);
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      alertError(errorData.error || 'Failed to duplicate project. Please try again.');
    }
  } catch (error) {
    logger.error(' Error duplicating project:', error);
    alertError('Failed to duplicate project. Please try again.');
  }
}
