import * as React from 'react';
import { useCallback } from 'react';
import type { Project, ProjectMilestone } from '../../types';
import { NOTIFICATIONS } from '@/constants/notifications';
import { ProjectDetailsCard } from './overview/ProjectDetailsCard';
import { ProjectLinksCard } from './overview/ProjectLinksCard';
import { MilestonesList } from './overview/MilestonesList';
import { SidebarInfo } from './overview/SidebarInfo';

interface OverviewTabProps {
  project: Project;
  milestones: ProjectMilestone[];
  progress: number;
  outstandingBalance: number;
  totalPaid: number;
  onUpdateProject: (updates: Partial<Project>) => Promise<boolean>;
  onAddMilestone: (milestone: Omit<ProjectMilestone, 'id' | 'project_id'>) => Promise<boolean>;
  onUpdateMilestone: (id: number, updates: Partial<ProjectMilestone>) => Promise<boolean>;
  onToggleMilestone: (id: number) => Promise<boolean>;
  onDeleteMilestone: (id: number) => Promise<boolean>;
  onNavigate?: (tab: string, entityId?: string) => void;
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
  progress,
  outstandingBalance,
  totalPaid,
  onUpdateProject,
  onAddMilestone,
  onUpdateMilestone,
  onToggleMilestone,
  onDeleteMilestone,
  onNavigate,
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
      <div className="project-overview-main">
        <ProjectDetailsCard project={project} onSaveField={handleSaveField} />
        <ProjectLinksCard project={project} onSaveField={handleSaveField} />
        <MilestonesList
          milestones={milestones}
          progress={progress}
          onAddMilestone={onAddMilestone}
          onUpdateMilestone={onUpdateMilestone}
          onToggleMilestone={onToggleMilestone}
          onDeleteMilestone={onDeleteMilestone}
          showNotification={showNotification}
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
