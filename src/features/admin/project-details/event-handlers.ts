/**
 * Event handler setup for project detail view
 * @file src/features/admin/project-details/event-handlers.ts
 */

import { alertWarning } from '../../../utils/confirm-dialog';
import { showToast } from '../../../utils/toast-notifications';
import { domCache } from './dom-cache';
import {
  loadProjectMessages,
  sendProjectMessage
} from './messages';
import {
  loadProjectFiles,
  setupFileUploadHandlers
} from './files';
import {
  loadProjectMilestones,
  updateProgressBar,
  showAddMilestonePrompt
} from './milestones';
import { loadProjectInvoices } from './invoices';
import { showCreateInvoicePrompt } from './invoice-modals';
import {
  processLateFees,
  showScheduleInvoicePrompt,
  showSetupRecurringPrompt,
  loadScheduledInvoices,
  loadRecurringInvoices
} from './invoice-scheduling';
import {
  handleContractSign,
  handleContractCountersign,
  showContractBuilder,
  deleteProject,
  archiveProject,
  duplicateProject
} from './actions';
import { showDocumentGenerationModal } from './documents';
import type { ProjectResponse } from '../../../types/api';
import type { SecondarySidebarController } from '../../../components/secondary-sidebar';

export interface EventHandlerContext {
  currentProjectId: number | null;
  projectsData: ProjectResponse[];
  switchTabFn?: (tab: string) => void;
  loadProjectsFn?: () => Promise<void>;
  inviteLeadFn?: (leadId: number, email: string) => Promise<void>;
  secondarySidebar?: SecondarySidebarController;
  cleanupSecondarySidebar: () => void;
  showProjectDetail: (id: number) => void;
}

/**
 * Set up all event handlers for the project detail view
 */
export function setupEventHandlers(ctx: EventHandlerContext): void {
  const projectId = ctx.currentProjectId;
  if (!projectId) return;

  // Back button
  const backBtn = domCache.get('backBtn');
  if (backBtn && ctx.switchTabFn && !backBtn.dataset.listenerAdded) {
    backBtn.dataset.listenerAdded = 'true';
    const switchTab = ctx.switchTabFn;
    backBtn.addEventListener('click', () => {
      ctx.cleanupSecondarySidebar();
      ctx.currentProjectId = null;
      switchTab('projects');
    });
  }

  // Send message
  const sendMsgBtn = domCache.get('sendMsgBtn');
  if (sendMsgBtn && !sendMsgBtn.dataset.listenerAdded) {
    sendMsgBtn.dataset.listenerAdded = 'true';
    sendMsgBtn.addEventListener('click', async () => {
      const success = await sendProjectMessage(projectId, ctx.projectsData);
      if (success) {
        loadProjectMessages(projectId, ctx.projectsData);
      }
    });
  }

  // Resend invite
  const resendInviteBtn = domCache.get('resendInviteBtn');
  if (resendInviteBtn && ctx.inviteLeadFn && !resendInviteBtn.dataset.listenerAdded) {
    resendInviteBtn.dataset.listenerAdded = 'true';
    const inviteLead = ctx.inviteLeadFn;
    resendInviteBtn.addEventListener('click', () => {
      const project = ctx.projectsData.find((p) => p.id === projectId);
      if (project && project.email) {
        inviteLead(projectId, project.email);
      } else {
        alertWarning('No email address found for this project.');
      }
    });
  }

  // Manage deliverables
  const btnManageDeliverables = domCache.get('btnManageDeliverables');
  if (btnManageDeliverables) {
    btnManageDeliverables.setAttribute('data-project-id', projectId.toString());
  }

  // Add milestone
  const addMilestoneBtn = domCache.get('addMilestoneBtn');
  if (addMilestoneBtn && !addMilestoneBtn.dataset.listenerAdded) {
    addMilestoneBtn.dataset.listenerAdded = 'true';
    addMilestoneBtn.addEventListener('click', () => {
      showAddMilestonePrompt(projectId, () => {
        loadProjectMilestones(projectId, (progress) => updateProgressBar(projectId, progress));
      });
    });
  }

  // Create invoice
  const createInvoiceBtn = domCache.get('createInvoiceBtn');
  if (createInvoiceBtn && !createInvoiceBtn.dataset.listenerAdded) {
    createInvoiceBtn.dataset.listenerAdded = 'true';
    createInvoiceBtn.addEventListener('click', () => {
      const project = ctx.projectsData.find((p) => p.id === projectId);
      if (project) {
        showCreateInvoicePrompt(projectId, project, () => loadProjectInvoices(projectId));
      }
    });
  }

  // Add Task button
  const btnAddTask = domCache.get('btnAddTask', true);
  if (btnAddTask && !btnAddTask.dataset.listenerAdded) {
    btnAddTask.dataset.listenerAdded = 'true';
    btnAddTask.addEventListener('click', () => {
      if (ctx.secondarySidebar) {
        ctx.secondarySidebar.setActiveTab('tasks');
      }
      showToast('Use the Tasks tab to create new tasks', 'info');
    });
  }

  // Late fees, schedule, recurring buttons
  setupInvoiceSchedulingHandlers(projectId);

  // Contract sign
  const contractSignBtn = domCache.get('contractSignBtn');
  if (contractSignBtn && !contractSignBtn.dataset.listenerAdded) {
    contractSignBtn.dataset.listenerAdded = 'true';
    contractSignBtn.addEventListener('click', () =>
      handleContractSign(projectId, ctx.projectsData)
    );
  }

  const contractCountersignBtn = domCache.get('contractCountersignBtn');
  if (contractCountersignBtn && !contractCountersignBtn.dataset.listenerAdded) {
    contractCountersignBtn.dataset.listenerAdded = 'true';
    contractCountersignBtn.addEventListener('click', () =>
      handleContractCountersign(projectId, ctx.projectsData)
    );
  }

  const contractBuilderBtn = domCache.get('contractBuilderBtn');
  if (contractBuilderBtn && !contractBuilderBtn.dataset.listenerAdded) {
    contractBuilderBtn.dataset.listenerAdded = 'true';
    contractBuilderBtn.addEventListener('click', () =>
      showContractBuilder(projectId, ctx.projectsData)
    );
  }

  // File upload
  setupFileUploadHandlers(projectId, () => loadProjectFiles(projectId));
}

/**
 * Set up the more menu via event delegation
 */
export function setupMoreMenuDelegation(ctx: EventHandlerContext): void {
  const moreMenu = document.getElementById('pd-more-menu');
  if (!moreMenu) return;

  const trigger = moreMenu.querySelector('.custom-dropdown-trigger') as HTMLElement;
  if (!trigger || trigger.dataset.listenerAdded === 'true') return;
  trigger.dataset.listenerAdded = 'true';

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    moreMenu.classList.toggle('open');
  });

  moreMenu.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const item = target.closest('.custom-dropdown-item') as HTMLElement | null;
    if (!item) return;

    e.preventDefault();
    e.stopPropagation();
    const action = item.dataset.action;
    moreMenu.classList.remove('open');

    if (!ctx.currentProjectId || !action) return;

    switch (action) {
    case 'duplicate':
      await duplicateProject(
        ctx.currentProjectId,
        ctx.projectsData,
          ctx.loadProjectsFn!,
          (id) => ctx.showProjectDetail(id)
      );
      break;
    case 'archive':
      await archiveProject(
        ctx.currentProjectId,
        ctx.projectsData,
          ctx.loadProjectsFn!,
          (id) => ctx.showProjectDetail(id)
      );
      break;
    case 'generate-docs':
      await showDocumentGenerationModal(ctx.currentProjectId, () => {
        loadProjectFiles(ctx.currentProjectId!);
      });
      break;
    case 'delete':
      await deleteProject(ctx.currentProjectId, ctx.projectsData, () => {
        ctx.cleanupSecondarySidebar();
        ctx.currentProjectId = null;
        ctx.switchTabFn?.('projects');
      });
      break;
    }
  });

  document.addEventListener('click', (e) => {
    if (!moreMenu.contains(e.target as Node)) {
      moreMenu.classList.remove('open');
    }
  });
}

/**
 * Set up invoice scheduling handlers
 */
function setupInvoiceSchedulingHandlers(projectId: number): void {
  const processLateFeesBtn = domCache.get('processLateFeesBtn');
  if (processLateFeesBtn && !processLateFeesBtn.dataset.listenerAdded) {
    processLateFeesBtn.dataset.listenerAdded = 'true';
    processLateFeesBtn.addEventListener('click', () => {
      processLateFees(projectId, () => loadProjectInvoices(projectId));
    });
  }

  const scheduleInvoiceBtn = domCache.get('scheduleInvoiceBtn');
  if (scheduleInvoiceBtn && !scheduleInvoiceBtn.dataset.listenerAdded) {
    scheduleInvoiceBtn.dataset.listenerAdded = 'true';
    scheduleInvoiceBtn.addEventListener('click', () => {
      showScheduleInvoicePrompt(projectId, () => loadScheduledInvoices(projectId));
    });
  }

  const setupRecurringBtn = domCache.get('setupRecurringBtn');
  if (setupRecurringBtn && !setupRecurringBtn.dataset.listenerAdded) {
    setupRecurringBtn.dataset.listenerAdded = 'true';
    setupRecurringBtn.addEventListener('click', () => {
      showSetupRecurringPrompt(projectId, () => loadRecurringInvoices(projectId));
    });
  }
}
