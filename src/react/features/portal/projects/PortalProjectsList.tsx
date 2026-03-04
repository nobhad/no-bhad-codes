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
import { PORTAL_PROJECT_STATUS_CONFIG } from '../types';
import { PORTAL_PROJECTS_FILTER_CONFIG } from '../shared/filterConfigs';
import type { PortalProject, PortalProjectStatus } from '../types';
import { decodeHtmlEntities } from '@react/utils/decodeText';
import { createLogger } from '../../../../utils/logger';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

const logger = createLogger('PortalProjectsList');

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

interface PortalProjectsListProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback when a project is selected */
  onSelectProject?: (projectId: string) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Filter project by search and status
 */
function filterProject(
  project: PortalProject,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const s = search.toLowerCase();
    const matchesSearch =
      project.name?.toLowerCase().includes(s) ||
      project.description?.toLowerCase().includes(s);
    if (!matchesSearch) return false;
  }

  if (filters.status && filters.status !== 'all') {
    if (project.status !== filters.status) return false;
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
export function PortalProjectsList({
  getAuthToken,
  onSelectProject,
  showNotification: _showNotification
}: PortalProjectsListProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const cardsRef = useStaggerChildren<HTMLDivElement>(0.08, 0.1);

  const [projects, setProjects] = React.useState<PortalProject[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // AbortController ref for cleanup on unmount
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Fetch projects from API
  const fetchProjects = React.useCallback(async () => {
    // Abort any in-flight request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const token = getAuthToken?.();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(API_ENDPOINTS.PORTAL.PROJECTS, {
        method: 'GET',
        headers,
        credentials: 'include',
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle various response formats and transform to PortalProject interface
      let rawProjects: Record<string, unknown>[] = [];

      if (data.projects && Array.isArray(data.projects)) {
        rawProjects = data.projects;
      } else if (data.success && data.data) {
        rawProjects = Array.isArray(data.data) ? data.data : (data.data.projects || []);
      } else if (Array.isArray(data)) {
        rawProjects = data;
      } else {
        throw new Error(data.error || 'Failed to load projects');
      }

      // Transform API response to match PortalProject interface (maps project_name to name)
      const transformedProjects = rawProjects.map(transformProject);
      setProjects(transformedProjects);
    } catch (err) {
      // Don't set error state if request was aborted (component unmounted)
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      logger.error('[PortalProjectsList] Error:', message);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  // Fetch on mount
  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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

  const filteredProjects = React.useMemo(() => applyFilters(projects), [applyFilters, projects]);

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

  // Group projects by status for summary
  const activeCount = projects.filter(p => p.status === 'active' || p.status === 'in-progress').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;

  return (
    <TableLayout
      containerRef={containerRef}
      title="PROJECTS"
      stats={
        <TableStats items={[
          { value: projects.length, label: 'total' },
          { value: activeCount, label: 'active', variant: 'active', hideIfZero: true },
          { value: completedCount, label: 'completed', variant: 'completed', hideIfZero: true }
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
          message={projects.length === 0
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

/**
 * ProjectCard Component
 */
interface ProjectCardProps {
  project: PortalProject;
  onClick: () => void;
  onPreviewClick: (e: React.MouseEvent) => void;
}

function ProjectCard({ project, onClick, onPreviewClick }: ProjectCardProps) {
  const statusConfig = PORTAL_PROJECT_STATUS_CONFIG[project.status as PortalProjectStatus];
  const statusLabel = statusConfig?.label || project.status;

  return (
    <div onClick={onClick} className="portal-card card-clickable">
      {/* Header: Name and Status */}
      <div className="portal-card-header">
        <div className="portal-card-title-group">
          <FolderOpen className="icon-xs" />
          <span className="tw-text-primary">
            {decodeHtmlEntities(project.name)}
          </span>
        </div>
        <div className="portal-card-status-group">
          <span className="tw-badge">{statusLabel}</span>
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
          <span className="label">Progress</span>
          <span className="tw-text-primary tw-text-sm">{project.progress}%</span>
        </div>
        <div className="tw-progress-track">
          <div
            className="tw-progress-bar"
            style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
          />
        </div>
      </div>

      {/* Footer: Date and Preview */}
      <div className="portal-card-footer">
        <span className="text-muted tw-text-xs">
          {project.start_date ? `Started ${formatDate(project.start_date)}` : 'Not started'}
        </span>
        {project.preview_url && (
          <IconButton action="external-link" onClick={onPreviewClick} title="View Preview" />
        )}
      </div>
    </div>
  );
}
