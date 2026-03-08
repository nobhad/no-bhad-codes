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
import { StatCard, StatsRow } from '@react/components/portal/StatCard';
import type { Client, ClientHealth, ClientDetailStats, ClientTag } from '../../types';
import { formatCurrency as formatCurrencyUtil, formatDate } from '../../../../../utils/format-utils';

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
    <div className="client-overview-grid">
      {/* Left Column - Health & Stats */}
      <div className="client-overview-main">
        {/* Health Score Card */}
        {health && (
          <div className="panel">
            <div className="panel-card-header">
              <div className="stat-card-header">
                <Heart className="icon-lg text-muted" />
                <h3 className="heading">
                  Health Score
                </h3>
              </div>
              <div className="stat-card-header">
                <span className="stat-value">
                  {health.score}
                </span>
                <span className="text-muted">
                  {getHealthStatusLabel(health.score)}
                </span>
              </div>
            </div>

            {/* Health Factors */}
            {health.factors && (
              <div className="health-factors-grid">
                {Object.entries(health.factors).map(([key, value]) => (
                  <div key={key} className="health-factor-item">
                    <div className="health-factor-header">
                      <span className="text-muted">
                        {key.replace('_', ' ')}
                      </span>
                      <span className="text-muted">{value}%</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-bar"
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
          <StatsRow className="client-stats-grid">
            <StatCard
              label="Projects"
              value={stats.totalProjects || 0}
              icon={<FolderKanban className="icon-md text-muted" />}
              meta={`${stats.activeProjects || 0} active, ${stats.completedProjects || 0} completed`}
            />
            <StatCard
              label="Revenue"
              value={formatCurrency(stats.totalPaid)}
              icon={<TrendingUp className="icon-md text-muted" />}
              meta={`${formatCurrency(stats.totalInvoiced)} invoiced`}
            />
            <StatCard
              label="Outstanding"
              value={formatCurrency(stats.totalOutstanding)}
              icon={<DollarSign className="icon-md text-muted" />}
            />
          </StatsRow>
        )}

        {/* Tags Section */}
        <div className="panel">
          <div className="panel-card-header">
            <div className="stat-card-header">
              <Tag className="icon-md text-muted" />
              <span className="heading">
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
                        className="tag-color-dot"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </PortalDropdownItem>
                  ))}
                </PortalDropdownContent>
              </PortalDropdown>
            )}
          </div>

          <div className="tags-list">
            {tags.length === 0 ? (
              <span className="text-muted text-italic">
                No tags assigned
              </span>
            ) : (
              tags.map((tag) => (
                <span
                  key={tag.id}
                  className="badge"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                  <button
                    onClick={() => handleRemoveTag(tag.id)}
                    className="tag-remove-btn"
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
      <div className="client-overview-sidebar">
        {/* Contact Info */}
        <div className="panel">
          <h3 className="section-title">
            Contact Information
          </h3>

          <div className="contact-info-list">
            {client.contact_name && (
              <div className="contact-info-item">
                <User className="icon-md text-muted" />
                <span className="text-muted">
                  {client.contact_name}
                </span>
              </div>
            )}

            {client.company_name && (
              <div className="contact-info-item">
                <Building2 className="icon-md text-muted" />
                <span className="text-muted">
                  {client.company_name}
                </span>
              </div>
            )}

            {client.email && (
              <div className="contact-info-item">
                <Mail className="icon-md text-muted" />
                <a
                  href={`mailto:${client.email}`}
                  className="text-primary"
                >
                  {client.email}
                </a>
              </div>
            )}

            {client.phone && (
              <div className="contact-info-item">
                <Phone className="icon-md text-muted" />
                <a
                  href={`tel:${client.phone}`}
                  className="text-muted"
                >
                  {client.phone}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Account Details */}
        <div className="panel">
          <h3 className="section-title">
            Account Details
          </h3>

          <div className="account-detail-list">
            <div className="account-detail-row">
              <span className="field-label">Created</span>
              <span className="text-muted">
                {formatDate(client.created_at, 'label')}
              </span>
            </div>

            {client.invitation_sent_at && (
              <div className="account-detail-row">
                <span className="field-label">Invited</span>
                <span className="text-muted">
                  {formatDate(client.invitation_sent_at, 'label')}
                </span>
              </div>
            )}

            <div className="account-detail-row">
              <span className="field-label">Portal Access</span>
              <span
                className={cn(
                  client.status === 'active'
                    ? 'text-primary'
                    : 'text-muted'
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
