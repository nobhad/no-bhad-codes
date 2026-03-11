/**
 * PortalProjectsList
 * Client portal projects list with project cards showing status and progress
 */

import * as React from 'react';
import { FolderOpen, ChevronRight } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { IconButton } from '@react/factories';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { GSAP } from '@react/config/portal-constants';
import { PORTAL_PROJECT_STATUS_CONFIG } from '../types';
import { PORTAL_PROJECTS_FILTER_CONFIG } from '../shared/filterConfigs';
import type { PortalProject, PortalProjectStatus, PortalViewProps } from '../types';
import { decodeHtmlEntities } from '@react/utils/decodeText';
import { formatCardDate } from '@react/utils/cardFormatters';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { KEYS } from '@/constants/keyboard';

/**
 * Transform API response to PortalProject interface
 * Maps project_name to name for compatibility
 */
function transformProject(apiProject: Record<string, unknown>): PortalProject {
  return {
    id: apiProject.id as number,
    name: (apiProject.name || apiProject.project_name || 'Untitled Project') as string,
    description: apiProject.description as string | undefined,
    status: (apiProject.status || 'pending') as PortalProjectStatus,
    progress: (apiProject.progress || 0) as number,
    start_date: apiProject.start_date as string | undefined,
    end_date: (apiProject.end_date || apiProject.estimated_end_date) as string | undefined,
    preview_url: apiProject.preview_url as string | undefined,
    client_id: apiProject.client_id as number | undefined,
    created_at: apiProject.created_at as string | undefined,
    updated_at: apiProject.updated_at as string | undefined
  };
}

/**
 * ProjectCard Component
 */
interface ProjectCardProps {
  project: PortalProject;
  onClick: () => void;
  onPreviewClick: (e: React.MouseEvent) => void;
}

const ProjectCard = React.memo(({ project, onClick, onPreviewClick }: ProjectCardProps) => {
  const statusConfig = PORTAL_PROJECT_STATUS_CONFIG[project.status as PortalProjectStatus];
  const statusLabel = statusConfig?.label || project.status;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === KEYS.ENTER || e.key === KEYS.SPACE) { e.preventDefault(); onClick(); } }}
      className="portal-card card-clickable"
    >
      {/* Header: Name and Status */}
      <div className="portal-card-header">
        <div className="portal-card-title-group">
          <FolderOpen className="icon-xs" />
          <span className="text-primary">
            {decodeHtmlEntities(project.name)}
          </span>
        </div>
        <div className="portal-card-status-group">
          <span className="badge">{statusLabel}</span>
          <ChevronRight className="icon-xs" />
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className="portal-card-description">
          {decodeHtmlEntities(project.description)}
        </p>
      )}

      {/* Progress Bar */}
      <div className="portal-card-progress">
        <div className="portal-card-header">
          <span className="field-label">Progress</span>
          <span className="text-primary text-sm">{project.progress}%</span>
        </div>
        <div className="progress-bar-sm">
          <div
            className="progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
          />
        </div>
      </div>

      {/* Footer: Date and Preview */}
      <div className="layout-row-between">
        <span className="text-muted text-xs">
          {project.start_date ? `Started ${formatCardDate(project.start_date)}` : 'Not started'}
        </span>
        {project.preview_url && (
          <IconButton action="external-link" onClick={onPreviewClick} title="View Preview" />
        )}
      </div>
    </div>
  );
});

interface PortalProjectsListProps extends PortalViewProps {
  /** Callback when a project is selected */
  onSelectProject?: (projectId: string) => void;
}

/**
 * Filter project by search and status
 */
function filterProject(
  project: PortalProject,
  filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const s = search.toLowerCase();
    const matchesSearch =
      project.name?.toLowerCase().includes(s) ||
      project.description?.toLowerCase().includes(s);
    if (!matchesSearch) return false;
  }

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    if (!statusFilter.includes(project.status)) return false;
  }

  return true;
}

/**
 * Sort projects by column
 */
function sortProjects(
  a: PortalProject,
  b: PortalProject,
  sort: { column: string; direction: 'asc' | 'desc' }
): number {
  const m = sort.direction === 'asc' ? 1 : -1;
  switch (sort.column) {
  case 'name':
    return m * (a.name || '').localeCompare(b.name || '');
  case 'status':
    return m * (a.status || '').localeCompare(b.status || '');
  case 'progress':
    return m * ((a.progress || 0) - (b.progress || 0));
  case 'date':
    return m * (new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime());
  default:
    return 0;
  }
}

/**
 * PortalProjectsList Component
 */
/**
 * Transform raw API response to PortalProject array.
 * Handles { projects: [...] } and bare array responses.
 */
function transformProjectsResponse(raw: unknown): PortalProject[] {
  const data = raw as Record<string, unknown>;

  let rawProjects: Record<string, unknown>[] = [];

  if (data.projects && Array.isArray(data.projects)) {
    rawProjects = data.projects;
  } else if (Array.isArray(data)) {
    rawProjects = data as Record<string, unknown>[];
  }

  return rawProjects.map(transformProject);
}

export function PortalProjectsList({
  getAuthToken,
  onSelectProject,
  showNotification: _showNotification
}: PortalProjectsListProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const cardsRef = useStaggerChildren<HTMLDivElement>(GSAP.STAGGER_SLOW, GSAP.STAGGER_DELAY_SHORT);

  // Fetch projects via shared hook (handles auth, abort, error/loading state)
  const {
    data: projects,
    isLoading,
    error,
    refetch: fetchProjects
  } = usePortalData<PortalProject[]>({
    getAuthToken,
    url: API_ENDPOINTS.PORTAL.PROJECTS,
    transform: transformProjectsResponse
  });

  const items = React.useMemo(() => projects ?? [], [projects]);

  // Table filters
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort: _sort,
    toggleSort: _toggleSort,
    applyFilters
  } = useTableFilters<PortalProject>({
    storageKey: 'portal_projects',
    filters: PORTAL_PROJECTS_FILTER_CONFIG,
    filterFn: filterProject,
    sortFn: sortProjects,
    defaultSort: { column: 'name', direction: 'asc' }
  });

  const filteredProjects = React.useMemo(() => applyFilters(items), [applyFilters, items]);

  // Handle project selection
  const handleProjectClick = (project: PortalProject) => {
    onSelectProject?.(String(project.id));
  };

  // Handle preview link click
  const handlePreviewClick = (e: React.MouseEvent, project: PortalProject) => {
    e.stopPropagation();
    if (project.preview_url) {
      window.open(project.preview_url, '_blank', 'noopener,noreferrer');
    }
  };

  // Group projects by status for summary - single pass
  const { activeCount, completedCount } = React.useMemo(() => {
    let active = 0;
    let completed = 0;
    for (const p of items) {
      if (p.status === 'active' || p.status === 'in-progress') active++;
      else if (p.status === 'completed') completed++;
    }
    return { activeCount: active, completedCount: completed };
  }, [items]);

  return (
    <TableLayout
      containerRef={containerRef}
      title="PROJECTS"
      stats={
        <TableStats items={[
          { value: items.length, label: 'total' },
          { value: activeCount, label: 'active', variant: 'active' },
          { value: completedCount, label: 'completed', variant: 'completed' }
        ]} />
      }
      actions={
        <>
          <SearchFilter value={search} onChange={setSearch} placeholder="Search projects..." />
          <FilterDropdown
            sections={PORTAL_PROJECTS_FILTER_CONFIG}
            values={filterValues}
            onChange={(key, value) => setFilter(key, value)}
          />
          <IconButton action="refresh" onClick={fetchProjects} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading projects..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchProjects} />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="icon-lg" />}
          message={items.length === 0
            ? 'No projects yet. Your projects will appear here once they begin.'
            : 'No projects match the current filters.'
          }
        />
      ) : (
        <div ref={cardsRef} className="portal-cards-list">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => handleProjectClick(project)}
              onPreviewClick={(e) => handlePreviewClick(e, project)}
            />
          ))}
        </div>
      )}
    </TableLayout>
  );
}
