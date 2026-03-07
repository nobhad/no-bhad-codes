import * as React from 'react';
import { useCallback } from 'react';
import {
  Heart,
  TrendingUp,
  DollarSign,
  FolderKanban,
  Mail,
  Phone,
  Building2,
  User,
  Tag,
  X,
  Plus
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import type { Client, ClientHealth, ClientDetailStats, ClientTag } from '../../types';
import { formatCurrency as formatCurrencyUtil } from '../../../../../utils/format-utils';

interface OverviewTabProps {
  client: Client;
  health: ClientHealth | null;
  stats: ClientDetailStats | null;
  tags: ClientTag[];
  availableTags: ClientTag[];
  onUpdateClient: (updates: Partial<Client>) => Promise<boolean>;
  onAddTag: (tagId: number) => Promise<boolean>;
  onRemoveTag: (tagId: number) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Format currency with $0 fallback for client stats
 */
function formatCurrency(amount: number | undefined): string {
  return formatCurrencyUtil(amount, { fallback: '$0' });
}

/**
 * Format date
 */
function formatDate(date: string | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Get health status label
 */
function getHealthStatusLabel(score: number): string {
  if (score >= 70) return 'Healthy';
  if (score >= 40) return 'At Risk';
  return 'Critical';
}

/**
 * OverviewTab
 * Client overview with health score, stats, and info
 */
export function OverviewTab({
  client,
  health,
  stats,
  tags,
  availableTags,
  onAddTag,
  onRemoveTag,
  showNotification
}: OverviewTabProps) {
  // Filter out already added tags
  const unassignedTags = availableTags.filter(
    (t) => !tags.some((ct) => ct.id === t.id)
  );

  // Handle add tag
  const handleAddTag = useCallback(
    async (tagId: number) => {
      const success = await onAddTag(tagId);
      if (success) {
        showNotification?.('Tag added', 'success');
      } else {
        showNotification?.('Failed to add tag', 'error');
      }
    },
    [onAddTag, showNotification]
  );

  // Handle remove tag
  const handleRemoveTag = useCallback(
    async (tagId: number) => {
      const success = await onRemoveTag(tagId);
      if (success) {
        showNotification?.('Tag removed', 'success');
      } else {
        showNotification?.('Failed to remove tag', 'error');
      }
    },
    [onRemoveTag, showNotification]
  );

  return (
    <div className="tw-grid tw-grid-cols-3 tw-gap-6">
      {/* Left Column - Health & Stats */}
      <div className="tw-col-span-2 tw-flex tw-flex-col tw-gap-6">
        {/* Health Score Card */}
        {health && (
          <div className="tw-panel ">
            <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
              <div className="tw-flex tw-items-center tw-gap-2">
                <Heart className="icon-lg text-muted" />
                <h3 className="heading ">
                  Health Score
                </h3>
              </div>
              <div className="tw-flex tw-items-center tw-gap-2">
                <span className="stat-value">
                  {health.score}
                </span>
                <span className="text-muted ">
                  {getHealthStatusLabel(health.score)}
                </span>
              </div>
            </div>

            {/* Health Factors */}
            {health.factors && (
              <div className="tw-grid tw-grid-cols-2 tw-gap-4">
                {Object.entries(health.factors).map(([key, value]) => (
                  <div key={key} className="tw-flex tw-flex-col tw-gap-1">
                    <div className="tw-flex tw-items-center tw-justify-between tw-text-sm">
                      <span className="text-muted tw-capitalize">
                        {key.replace('_', ' ')}
                      </span>
                      <span className="text-muted">{value}%</span>
                    </div>
                    <div className="tw-progress-track">
                      <div
                        className="tw-progress-bar"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats Grid */}
        {stats && (
          <div className="stats-grid tw-grid tw-grid-cols-3 tw-gap-4">
            {/* Projects */}
            <div className="stat-card">
              <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
                <FolderKanban className="icon-md text-muted" />
                <span className="stat-label">Projects</span>
              </div>
              <div className="stat-value">
                {stats.totalProjects || 0}
              </div>
              <div className="text-muted tw-mt-1 tw-text-sm">
                {stats.activeProjects || 0} active, {stats.completedProjects || 0} completed
              </div>
            </div>

            {/* Revenue */}
            <div className="stat-card">
              <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
                <TrendingUp className="icon-md text-muted" />
                <span className="stat-label">Revenue</span>
              </div>
              <div className="stat-value">
                {formatCurrency(stats.totalPaid)}
              </div>
              <div className="text-muted tw-mt-1 tw-text-sm">
                {formatCurrency(stats.totalInvoiced)} invoiced
              </div>
            </div>

            {/* Outstanding */}
            <div className="stat-card">
              <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
                <DollarSign className="icon-md text-muted" />
                <span className="stat-label">Outstanding</span>
              </div>
              <div className="stat-value">
                {formatCurrency(stats.totalOutstanding)}
              </div>
            </div>
          </div>
        )}

        {/* Tags Section */}
        <div className="tw-panel">
          <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
            <div className="tw-flex tw-items-center tw-gap-2">
              <Tag className="icon-md text-muted" />
              <span className="heading ">
                Tags
              </span>
            </div>

            {unassignedTags.length > 0 && (
              <PortalDropdown>
                <PortalDropdownTrigger asChild>
                  <button className="btn-ghost">
                    <Plus className="icon-xs" />
                    Add Tag
                  </button>
                </PortalDropdownTrigger>
                <PortalDropdownContent>
                  {unassignedTags.map((tag) => (
                    <PortalDropdownItem key={tag.id} onClick={() => handleAddTag(tag.id)}>
                      <span
                        className="tw-w-3 tw-h-3 tw-mr-2 tw-rounded-full tw-inline-block"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </PortalDropdownItem>
                  ))}
                </PortalDropdownContent>
              </PortalDropdown>
            )}
          </div>

          <div className="tw-flex tw-flex-wrap tw-gap-2">
            {tags.length === 0 ? (
              <span className="text-muted tw-italic">
                No tags assigned
              </span>
            ) : (
              tags.map((tag) => (
                <span
                  key={tag.id}
                  className="tw-badge tw-inline-flex tw-items-center tw-gap-1"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                  <button
                    onClick={() => handleRemoveTag(tag.id)}
                    className="tw-p-0.5 hover:tw-bg-white/20"
                  >
                    <X className="icon-xs" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Column - Client Info */}
      <div className="tw-flex tw-flex-col tw-gap-6">
        {/* Contact Info */}
        <div className="tw-panel">
          <h3 className="section-title ">
            Contact Information
          </h3>

          <div className="tw-flex tw-flex-col tw-gap-3">
            {client.contact_name && (
              <div className="tw-flex tw-items-center tw-gap-3">
                <User className="icon-md text-muted" />
                <span className="text-muted ">
                  {client.contact_name}
                </span>
              </div>
            )}

            {client.company_name && (
              <div className="tw-flex tw-items-center tw-gap-3">
                <Building2 className="icon-md text-muted" />
                <span className="text-muted ">
                  {client.company_name}
                </span>
              </div>
            )}

            {client.email && (
              <div className="tw-flex tw-items-center tw-gap-3">
                <Mail className="icon-md text-muted" />
                <a
                  href={`mailto:${client.email}`}
                  className="tw-text-primary "
                >
                  {client.email}
                </a>
              </div>
            )}

            {client.phone && (
              <div className="tw-flex tw-items-center tw-gap-3">
                <Phone className="icon-md text-muted" />
                <a
                  href={`tel:${client.phone}`}
                  className="text-muted "
                >
                  {client.phone}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Account Details */}
        <div className="tw-panel">
          <h3 className="section-title ">
            Account Details
          </h3>

          <div className="tw-flex tw-flex-col tw-gap-3">
            <div className="tw-flex tw-items-center tw-justify-between">
              <span className="field-label">Created</span>
              <span className="text-muted ">
                {formatDate(client.created_at)}
              </span>
            </div>

            {client.invitation_sent_at && (
              <div className="tw-flex tw-items-center tw-justify-between">
                <span className="field-label">Invited</span>
                <span className="text-muted ">
                  {formatDate(client.invitation_sent_at)}
                </span>
              </div>
            )}

            <div className="tw-flex tw-items-center tw-justify-between">
              <span className="field-label">Portal Access</span>
              <span
                className={cn(
                  client.status === 'active'
                    ? 'tw-text-primary'
                    : 'text-muted',
                  ''
                )}
              >
                {client.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
