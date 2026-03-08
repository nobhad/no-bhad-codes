import * as React from 'react';
import { User, Building, Mail } from 'lucide-react';
import { StatCard, StatsRow } from '@react/components/portal/StatCard';
import type { Project, ProjectMilestone } from '../../../types';
import { formatCurrency, formatDate } from '@/utils/format-utils';

interface SidebarInfoProps {
  project: Project;
  milestones: ProjectMilestone[];
  outstandingBalance: number;
  totalPaid: number;
  onNavigate?: (tab: string, entityId?: string) => void;
}

/**
 * SidebarInfo
 * Right-column sidebar displaying client info, financial summary,
 * and quick stats for the project overview.
 */
export function SidebarInfo({
  project,
  milestones,
  outstandingBalance,
  totalPaid,
  onNavigate
}: SidebarInfoProps) {
  return (
    <div className="project-overview-sidebar">
      {/* Client Info Card */}
      <div className="panel">
        <h3 className="section-title">Client</h3>

        <div className="link-list">
          {project.contact_name && (
            <div className="project-info-field-value">
              <User className="icon-md" />
              {project.client_id && onNavigate ? (
                <button
                  className="client-nav-link"
                  onClick={() => onNavigate('client-detail', String(project.client_id))}
                >
                  {project.contact_name}
                </button>
              ) : (
                <span>{project.contact_name}</span>
              )}
            </div>
          )}

          {project.company_name && (
            <div className="project-info-field-value">
              <Building className="icon-md" />
              {project.client_id && onNavigate ? (
                <button
                  className="client-nav-link"
                  onClick={() => onNavigate('client-detail', String(project.client_id))}
                >
                  {project.company_name}
                </button>
              ) : (
                <span>{project.company_name}</span>
              )}
            </div>
          )}

          {project.email && (
            <div className="project-info-field-value">
              <Mail className="icon-md" />
              <a href={`mailto:${project.email}`} className="text-primary">
                {project.email}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Financial Summary Card */}
      <div className="panel">
        <h3 className="section-title">Financials</h3>

        <StatsRow>
          <StatCard label="Outstanding" value={formatCurrency(outstandingBalance)} />
          <StatCard label="Total Paid" value={formatCurrency(totalPaid)} />
          {project.deposit_amount !== undefined && project.deposit_amount > 0 && (
            <StatCard label="Deposit" value={formatCurrency(project.deposit_amount)} />
          )}
        </StatsRow>
      </div>

      {/* Quick Stats */}
      <div className="panel">
        <h3 className="section-title">Quick Stats</h3>

        <StatsRow className="quick-stats-grid">
          <StatCard
            label="Files"
            value={project.file_count ?? 0}
          />
          <StatCard
            label="Messages"
            value={project.message_count ?? 0}
            meta={(project.unread_count ?? 0) > 0 ? `${project.unread_count} new` : undefined}
          />
          <StatCard
            label="Milestones"
            value={`${milestones.filter((m) => m.is_completed).length}/${milestones.length}`}
          />
          <StatCard
            label="Created"
            value={formatDate(project.created_at)}
          />
        </StatsRow>
      </div>
    </div>
  );
}
