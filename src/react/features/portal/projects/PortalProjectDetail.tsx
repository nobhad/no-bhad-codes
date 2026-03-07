/**
 * PortalProjectDetail
 * Client portal project detail view with milestones and updates timeline
 */

import * as React from 'react';
import {
  ExternalLink,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquare,
  Flag,
  FileText,
  ListTodo,
  Activity,
  Download,
  Receipt,
  DollarSign
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { IconButton, TabList, TabPanel, formatRelativeTime, formatCurrency } from '@react/factories';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { PORTAL_PROJECT_STATUS_CONFIG } from '../types';
import type {
  PortalProject,
  PortalProjectStatus,
  PortalProjectMilestone,
  PortalProjectUpdate,
  PortalViewProps
} from '../types';
import { createLogger } from '../../../../utils/logger';
import { buildEndpoint } from '../../../../constants/api-endpoints';

const logger = createLogger('PortalProjectDetail');

interface PortalProjectDetailProps extends PortalViewProps {
  /** Project ID to display */
  projectId: string;
  /** Callback to go back to projects list */
  onBack?: () => void;
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
 * Get update type icon
 */
function getUpdateIcon(type: PortalProjectUpdate['update_type']) {
  switch (type) {
  case 'milestone':
    return <Flag />;
  case 'status':
    return <CheckCircle2 />;
  case 'deliverable':
    return <FileText />;
  default:
    return <MessageSquare />;
  }
}

// Local interfaces for tab data
interface ProjectFile {
  id: number | string;
  original_name: string;
  file_size?: number;
  created_at: string;
  mime_type?: string;
}

interface ProjectThread {
  id: number | string;
  subject: string;
  last_message_at?: string;
  message_count?: number;
  is_read?: boolean;
}

interface TimeSummary {
  totalHours: number;
  entryCount: number;
  firstEntry: string | null;
  lastEntry: string | null;
}

interface ProjectInvoice {
  id: number | string;
  invoice_number?: string;
  status: string;
  amount: number;
  due_date?: string;
  created_at: string;
}

// Tab configuration
type PortalProjectTab = 'milestones' | 'updates' | 'files' | 'messages' | 'invoices' | 'time';

const TABS: Array<{ id: PortalProjectTab; label: string }> = [
  { id: 'milestones', label: 'Milestones' },
  { id: 'updates', label: 'Updates' },
  { id: 'files', label: 'Files' },
  { id: 'messages', label: 'Messages' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'time', label: 'Time' }
];

/**
 * PortalProjectDetail Component
 */
export function PortalProjectDetail({
  projectId,
  getAuthToken,
  onBack,
  showNotification: _showNotification
}: PortalProjectDetailProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const milestonesRef = useStaggerChildren<HTMLDivElement>(0.06, 0.15);
  const updatesRef = useStaggerChildren<HTMLDivElement>(0.06, 0.2);

  const [project, setProject] = React.useState<PortalProject | null>(null);
  const [milestones, setMilestones] = React.useState<PortalProjectMilestone[]>([]);
  const [updates, setUpdates] = React.useState<PortalProjectUpdate[]>([]);
  const [files, setFiles] = React.useState<ProjectFile[]>([]);
  const [threads, setThreads] = React.useState<ProjectThread[]>([]);
  const [invoices, setInvoices] = React.useState<ProjectInvoice[]>([]);
  const [timeSummary, setTimeSummary] = React.useState<TimeSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<PortalProjectTab>('milestones');

  // Build headers helper
  const getHeaders = React.useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  // Fetch project details
  const fetchProjectDetails = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch project
      const projectResponse = await fetch(buildEndpoint.project(projectId), {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!projectResponse.ok) {
        throw new Error(`Failed to fetch project: ${projectResponse.statusText}`);
      }

      const projectData = await projectResponse.json();

      // Handle various response formats
      let projectResult: PortalProject;
      if (projectData.project) {
        projectResult = projectData.project;
      } else if (projectData.success && projectData.data?.project) {
        projectResult = projectData.data.project;
      } else if (projectData.success && projectData.data) {
        projectResult = projectData.data;
      } else {
        throw new Error(projectData.error || 'Failed to load project');
      }

      setProject(projectResult);

      // Fetch milestones
      try {
        const milestonesResponse = await fetch(buildEndpoint.projectMilestones(projectId), {
          method: 'GET',
          headers: getHeaders(),
          credentials: 'include'
        });

        if (milestonesResponse.ok) {
          const milestonesData = await milestonesResponse.json();
          const milestonesArray = milestonesData.milestones
            || milestonesData.data?.milestones
            || (Array.isArray(milestonesData) ? milestonesData : []);
          setMilestones(milestonesArray);
        }
      } catch (err) {
        logger.warn('[PortalProjectDetail] Could not fetch milestones:', err);
      }

      // Fetch updates/activity
      try {
        const updatesResponse = await fetch(buildEndpoint.projectUpdates(projectId), {
          method: 'GET',
          headers: getHeaders(),
          credentials: 'include'
        });

        if (updatesResponse.ok) {
          const updatesData = await updatesResponse.json();
          const updatesArray = updatesData.updates
            || updatesData.data?.updates
            || (Array.isArray(updatesData) ? updatesData : []);
          setUpdates(updatesArray);
        }
      } catch (err) {
        logger.warn('[PortalProjectDetail] Could not fetch updates:', err);
      }

      // Fetch files
      try {
        const filesResponse = await fetch(buildEndpoint.projectFiles(projectId), {
          method: 'GET',
          headers: getHeaders(),
          credentials: 'include'
        });

        if (filesResponse.ok) {
          const filesData = await filesResponse.json();
          const filesArray = filesData.files
            || filesData.data?.files
            || (Array.isArray(filesData) ? filesData : []);
          setFiles(filesArray);
        }
      } catch (err) {
        logger.warn('[PortalProjectDetail] Could not fetch files:', err);
      }

      // Fetch message threads
      try {
        const threadsResponse = await fetch(buildEndpoint.projectMessages(projectId), {
          method: 'GET',
          headers: getHeaders(),
          credentials: 'include'
        });

        if (threadsResponse.ok) {
          const threadsData = await threadsResponse.json();
          const threadsArray = threadsData.threads
            || threadsData.data?.threads
            || (Array.isArray(threadsData) ? threadsData : []);
          setThreads(threadsArray);
        }
      } catch (err) {
        logger.warn('[PortalProjectDetail] Could not fetch threads:', err);
      }

      // Fetch invoices
      try {
        const invoicesResponse = await fetch(buildEndpoint.projectInvoices(projectId), {
          method: 'GET',
          headers: getHeaders(),
          credentials: 'include'
        });

        if (invoicesResponse.ok) {
          const invoicesData = await invoicesResponse.json();
          const invoicesArray = invoicesData.invoices
            || invoicesData.data?.invoices
            || (Array.isArray(invoicesData) ? invoicesData : []);
          setInvoices(invoicesArray);
        }
      } catch (err) {
        logger.warn('[PortalProjectDetail] Could not fetch invoices:', err);
      }

      // Fetch time summary
      try {
        const timeResponse = await fetch(buildEndpoint.projectTimeSummary(projectId), {
          method: 'GET',
          headers: getHeaders(),
          credentials: 'include'
        });

        if (timeResponse.ok) {
          const timeData = await timeResponse.json();
          const summary = timeData.data || timeData;
          setTimeSummary(summary);
        }
      } catch (err) {
        logger.warn('[PortalProjectDetail] Could not fetch time summary:', err);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      logger.error('[PortalProjectDetail] Error:', message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, getHeaders]);

  // Fetch on mount and when projectId changes
  React.useEffect(() => {
    if (projectId) {
      fetchProjectDetails();
    }
  }, [projectId, fetchProjectDetails]);

  // Handle preview click
  const handlePreviewClick = () => {
    if (project?.preview_url) {
      window.open(project.preview_url, '_blank', 'noopener,noreferrer');
    }
  };

  const statusConfig = project
    ? PORTAL_PROJECT_STATUS_CONFIG[project.status as PortalProjectStatus]
    : null;
  const statusLabel = statusConfig?.label || project?.status;
  const completedMilestones = milestones.filter(m => m.is_completed).length;
  const progress = milestones.length > 0
    ? Math.round((completedMilestones / milestones.length) * 100)
    : (project?.progress ?? 0);

  return (
    <div ref={containerRef} className="tw-section">
      {isLoading ? (
        <LoadingState message="Loading project..." />
      ) : error || !project ? (
        <ErrorState
          message={error ?? 'Project not found'}
          onRetry={fetchProjectDetails}
        />
      ) : (
        <>
          {/* Header */}
          <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
            <div className="tw-flex tw-items-center tw-gap-3">
              {/* Back Button */}
              {onBack && (
                <IconButton action="back" onClick={onBack} title="Back to projects" />
              )}

              {/* Project Info */}
              <div className="tw-flex tw-flex-col tw-gap-0.5">
                <div className="tw-flex tw-items-center tw-gap-2">
                  <h2 className="heading tw-text-lg tw-m-0">{project.name}</h2>
                  <span className="tw-badge">{statusLabel}</span>
                </div>
                {project.description && (
                  <p className="text-muted tw-text-sm tw-m-0">
                    {project.description}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            {project.preview_url && (
              <button className="btn-secondary" onClick={handlePreviewClick}>
                <ExternalLink className="icon-xs" />
                Preview
              </button>
            )}
          </div>

          {/* Progress Section */}
          <div className="tw-panel">
            <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
              <span className="label">Overall Progress</span>
              <span className="tw-text-primary">{progress}%</span>
            </div>
            <div className="tw-progress-track">
              <div
                className="tw-progress-bar"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <div className="tw-flex tw-items-center tw-justify-between tw-mt-2">
              <span className="text-muted tw-text-xs">
                {project.start_date ? `Started ${formatDate(project.start_date)}` : 'Not started'}
              </span>
              {milestones.length > 0 && (
                <span className="text-muted tw-text-xs">
                  {completedMilestones}/{milestones.length} milestones
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <TabList
            tabs={TABS}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            ariaLabel="Project detail tabs"
          />

          {/* Tab Content */}
          <TabPanel tabId="milestones" isActive={activeTab === 'milestones'}>
            <MilestonesList
              milestones={milestones}
              containerRef={milestonesRef}
            />
          </TabPanel>

          <TabPanel tabId="updates" isActive={activeTab === 'updates'}>
            <UpdatesTimeline
              updates={updates}
              containerRef={updatesRef}
            />
          </TabPanel>

          <TabPanel tabId="files" isActive={activeTab === 'files'}>
            <FilesList files={files} />
          </TabPanel>

          <TabPanel tabId="messages" isActive={activeTab === 'messages'}>
            <ThreadsList threads={threads} />
          </TabPanel>

          <TabPanel tabId="invoices" isActive={activeTab === 'invoices'}>
            <InvoicesList invoices={invoices} />
          </TabPanel>

          <TabPanel tabId="time" isActive={activeTab === 'time'}>
            <TimeSummaryTab summary={timeSummary} />
          </TabPanel>
        </>
      )}
    </div>
  );
}

/**
 * MilestonesList Component
 */
interface MilestonesListProps {
  milestones: PortalProjectMilestone[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function MilestonesList({ milestones, containerRef }: MilestonesListProps) {
  if (milestones.length === 0) {
    return (
      <EmptyState
        icon={<ListTodo className="icon-lg" />}
        message="No milestones defined yet. Milestones will appear here as your project is planned."
      />
    );
  }

  return (
    <div ref={containerRef} className="tw-flex tw-flex-col tw-gap-3">
      {milestones.map((milestone) => (
        <div key={milestone.id} className="portal-card">
          <div className="tw-flex tw-gap-3">
            {/* Status Icon */}
            <div className="tw-flex-shrink-0">
              {milestone.is_completed ? (
                <CheckCircle2 className="icon-sm text-status-completed" />
              ) : (
                <Circle className="icon-xs" />
              )}
            </div>

            {/* Content */}
            <div className="tw-flex-1">
              <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                <span
                  className={cn(
                    milestone.is_completed ? 'text-muted tw-line-through' : 'tw-text-primary'
                  )}
                >
                  {milestone.title}
                </span>
                {milestone.due_date && (
                  <div className="tw-flex tw-items-center tw-gap-1 text-muted">
                    <Clock className="icon-xs" />
                    <span className="tw-text-xs">{formatDate(milestone.due_date)}</span>
                  </div>
                )}
              </div>
              {milestone.description && (
                <p className="text-muted tw-text-sm tw-m-0 tw-mt-1">
                  {milestone.description}
                </p>
              )}
              {milestone.is_completed && milestone.completed_date && (
                <span className="tw-text-xs text-muted">
                  Completed {formatDate(milestone.completed_date)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * UpdatesTimeline Component
 */
interface UpdatesTimelineProps {
  updates: PortalProjectUpdate[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function UpdatesTimeline({ updates, containerRef }: UpdatesTimelineProps) {
  if (updates.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="icon-lg" />}
        message="No updates yet. Project updates will appear here as work progresses."
      />
    );
  }

  return (
    <div ref={containerRef} className="tw-relative">
      {/* Timeline line */}
      <div className="tw-absolute tw-left-2 tw-top-0 tw-bottom-0 tw-w-px tw-bg-[var(--portal-border)]" />

      {/* Updates */}
      <div className="tw-flex tw-flex-col tw-gap-3">
        {updates.map((update) => (
          <div key={update.id} className="tw-flex tw-gap-3 tw-relative">
            {/* Timeline dot */}
            <div className="tw-flex-shrink-0 tw-w-4 tw-h-4 tw-flex tw-items-center tw-justify-center tw-bg-[var(--portal-bg)] tw-z-10">
              <span className="text-muted">{getUpdateIcon(update.update_type)}</span>
            </div>

            {/* Content */}
            <div className="portal-card tw-flex-1">
              <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                <span className="tw-text-primary">{update.title}</span>
                <span className="text-muted tw-text-xs">{formatRelativeTime(update.created_at)}</span>
              </div>
              <p className="text-muted tw-text-sm tw-m-0 tw-mt-1">{update.content}</p>
              {update.created_by && (
                <span className="tw-text-xs text-muted">
                  by {update.created_by}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * FilesList Component
 */
function FilesList({ files }: { files: ProjectFile[] }) {
  if (files.length === 0) {
    return (
      <EmptyState
        icon={<Download className="icon-lg" />}
        message="No files shared yet. Files will appear here when they are uploaded to this project."
      />
    );
  }

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="tw-flex tw-flex-col tw-gap-2">
      {files.map((file) => (
        <div key={file.id} className="portal-card">
          <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
            <div className="tw-flex tw-items-center tw-gap-2 tw-flex-1 tw-min-w-0">
              <FileText className="icon-xs tw-flex-shrink-0 text-muted" />
              <div className="tw-flex tw-flex-col tw-min-w-0">
                <span className="tw-text-primary tw-text-sm tw-truncate">
                  {file.original_name}
                </span>
                <div className="tw-flex tw-items-center tw-gap-2 text-muted">
                  {file.file_size != null && (
                    <span className="tw-text-xs">{formatFileSize(file.file_size)}</span>
                  )}
                  <span className="tw-text-xs">{formatDate(file.created_at)}</span>
                </div>
              </div>
            </div>
            <a
              href={buildEndpoint.fileDownload(file.id)}
              className="btn-ghost tw-text-sm tw-flex-shrink-0"
              download
            >
              <Download className="icon-xs" />
              Download
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * ThreadsList Component
 */
function ThreadsList({ threads }: { threads: ProjectThread[] }) {
  if (threads.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="icon-lg" />}
        message="No messages yet. Messages for this project will appear here."
      />
    );
  }

  return (
    <div className="tw-flex tw-flex-col tw-gap-2">
      {threads.map((thread) => (
        <div key={thread.id} className="portal-card">
          <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
            <div className="tw-flex tw-items-center tw-gap-2 tw-flex-1 tw-min-w-0">
              <MessageSquare className={cn('icon-xs tw-flex-shrink-0', thread.is_read === false ? 'tw-text-primary' : 'text-muted')} />
              <div className="tw-flex tw-flex-col tw-min-w-0">
                <span className={cn('tw-text-sm tw-truncate', thread.is_read === false ? 'tw-text-primary tw-font-medium' : 'tw-text-primary')}>
                  {thread.subject}
                </span>
                <div className="tw-flex tw-items-center tw-gap-2 text-muted">
                  {thread.message_count != null && (
                    <span className="tw-text-xs">{thread.message_count} messages</span>
                  )}
                  {thread.last_message_at && (
                    <span className="tw-text-xs">{formatRelativeTime(thread.last_message_at)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * InvoicesList Component
 */
function InvoicesList({ invoices }: { invoices: ProjectInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="icon-lg" />}
        message="No invoices yet. Invoices for this project will appear here."
      />
    );
  }

  return (
    <div className="tw-flex tw-flex-col tw-gap-2">
      {invoices.map((invoice) => (
        <div key={invoice.id} className="portal-card">
          <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
            <div className="tw-flex tw-items-center tw-gap-2 tw-flex-1 tw-min-w-0">
              <DollarSign className="icon-xs tw-flex-shrink-0 text-muted" />
              <div className="tw-flex tw-flex-col tw-min-w-0">
                <span className="tw-text-primary tw-text-sm">
                  {invoice.invoice_number || `Invoice #${invoice.id}`}
                </span>
                <div className="tw-flex tw-items-center tw-gap-2 text-muted">
                  <span className="tw-text-xs">{formatCurrency(invoice.amount)}</span>
                  {invoice.due_date && (
                    <span className="tw-text-xs">Due {formatDate(invoice.due_date)}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="tw-flex tw-items-center tw-gap-2">
              <StatusBadge status={getStatusVariant(invoice.status)}>
                {invoice.status}
              </StatusBadge>
              <a
                href={buildEndpoint.invoicePdf(invoice.id)}
                className="btn-ghost tw-text-sm tw-flex-shrink-0"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="icon-xs" />
                PDF
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * TimeSummaryTab Component
 */
function TimeSummaryTab({ summary }: { summary: TimeSummary | null }) {
  if (!summary || summary.entryCount === 0) {
    return (
      <EmptyState
        icon={<Clock className="icon-lg" />}
        message="No time tracked yet. Time entries will appear here as work is logged."
      />
    );
  }

  const stats = [
    { label: 'Total Hours', value: summary.totalHours.toFixed(1) },
    { label: 'Time Entries', value: String(summary.entryCount) },
    { label: 'First Entry', value: summary.firstEntry ? formatDate(summary.firstEntry) : 'N/A' },
    { label: 'Last Entry', value: summary.lastEntry ? formatDate(summary.lastEntry) : 'N/A' }
  ];

  return (
    <div className="tw-grid tw-grid-cols-2 tw-gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="portal-card tw-text-center">
          <span className="tw-text-2xl tw-font-semibold tw-text-primary">{stat.value}</span>
          <span className="label tw-text-xs tw-block tw-mt-1">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
