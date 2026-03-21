import * as React from 'react';
import { useCallback } from 'react';
import type { Project, ProjectMilestone } from '../../types';
import type { ProjectTaskResponse } from '@/types/api';
import { NOTIFICATIONS } from '@/constants/notifications';
import { ProjectDetailsCard } from './overview/ProjectDetailsCard';
import { ProjectLinksCard } from './overview/ProjectLinksCard';
import { ServiceCredentialsCard } from './overview/ServiceCredentialsCard';
import { MilestonesList } from './overview/MilestonesList';
import { SidebarInfo } from './overview/SidebarInfo';

interface OverviewTabProps {
  project: Project;
  milestones: ProjectMilestone[];
  tasks?: ProjectTaskResponse[];
  progress: number;
  outstandingBalance: number;
  totalPaid: number;
  onUpdateProject: (updates: Partial<Project>) => Promise<boolean>;
  onNavigate?: (tab: string, entityId?: string) => void;
  onSwitchTab?: (tab: string) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * OverviewTab
 * Project overview orchestrator that composes sub-components:
 * ProjectDetailsCard, ProjectLinksCard, MilestonesList, and SidebarInfo.
 */
export function OverviewTab({
  project,
  milestones,
  tasks = [],
  progress,
  outstandingBalance,
  totalPaid,
  onUpdateProject,
  onNavigate,
  onSwitchTab,
  showNotification
}: OverviewTabProps) {
  const handleSaveField = useCallback(
    async (field: keyof Project, value: string): Promise<boolean> => {
      const success = await onUpdateProject({ [field]: value });
      if (success) {
        showNotification?.(NOTIFICATIONS.project.UPDATED, 'success');
      } else {
        showNotification?.(NOTIFICATIONS.project.UPDATE_FAILED, 'error');
      }
      return success;
    },
    [onUpdateProject, showNotification]
  );

  return (
    <div className="project-overview-grid">
      {/* Left Column - Project Info */}
      <div className="layout-stack">
        <ProjectDetailsCard project={project} onSaveField={handleSaveField} />
        <ProjectLinksCard project={project} onSaveField={handleSaveField} />
        <ServiceCredentialsCard project={project} onSaveField={handleSaveField} />
        <MilestonesList
          milestones={milestones}
          tasks={tasks}
          progress={progress}
          onNavigateToDeliverables={onSwitchTab ? () => onSwitchTab('deliverables') : undefined}
        />
      </div>

      {/* Right Column - Sidebar */}
      <SidebarInfo
        project={project}
        milestones={milestones}
        outstandingBalance={outstandingBalance}
        totalPaid={totalPaid}
        onNavigate={onNavigate}
      />
    </div>
  );
}
