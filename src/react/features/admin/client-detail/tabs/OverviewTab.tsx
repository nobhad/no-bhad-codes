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
  Calendar,
  Tag,
  X,
  Plus
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import type { Client, ClientHealth, ClientDetailStats, ClientTag } from '../../types';

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
 * Format currency
 */
function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format date
 */
function formatDate(date: string | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Get health status class
 */
function getHealthStatusClass(score: number): string {
  if (score >= 70) return 'tw-text-[var(--status-completed)]';
  if (score >= 40) return 'tw-text-[var(--status-warning)]';
  return 'tw-text-[var(--status-cancelled)]';
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
 * Get factor bar color
 */
function getFactorColor(value: number): string {
  if (value >= 70) return 'tw-bg-[var(--status-completed)]';
  if (value >= 40) return 'tw-bg-[var(--status-warning)]';
  return 'tw-bg-[var(--status-cancelled)]';
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
          <div className="tw-panel" style={{ padding: '1.5rem' }}>
            <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
              <div className="tw-flex tw-items-center tw-gap-2">
                <Heart className="tw-h-5 tw-w-5 tw-text-muted" />
                <h3 className="tw-heading" style={{ fontSize: '14px' }}>
                  Health Score
                </h3>
              </div>
              <div className="tw-flex tw-items-center tw-gap-2">
                <span className="tw-stat-value">
                  {health.score}
                </span>
                <span className="tw-text-muted" style={{ fontSize: '14px' }}>
                  {getHealthStatusLabel(health.score)}
                </span>
              </div>
            </div>

            {/* Health Factors */}
            {health.factors && (
            <div className="tw-grid tw-grid-cols-2 tw-gap-4">
              {Object.entries(health.factors).map(([key, value]) => (
                <div key={key} className="tw-flex tw-flex-col tw-gap-1">
                  <div className="tw-flex tw-items-center tw-justify-between" style={{ fontSize: '12px' }}>
                    <span className="tw-text-muted tw-capitalize">
                      {key.replace('_', ' ')}
                    </span>
                    <span className="tw-text-muted">{value}%</span>
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
          <div className="tw-grid-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {/* Projects */}
            <div className="tw-stat-card">
              <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
                <FolderKanban className="tw-h-4 tw-w-4 tw-text-muted" />
                <span className="tw-stat-label">Projects</span>
              </div>
              <div className="tw-stat-value">
                {stats.totalProjects || 0}
              </div>
              <div className="tw-text-muted tw-mt-1" style={{ fontSize: '12px' }}>
                {stats.activeProjects || 0} active, {stats.completedProjects || 0} completed
              </div>
            </div>

            {/* Revenue */}
            <div className="tw-stat-card">
              <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
                <TrendingUp className="tw-h-4 tw-w-4 tw-text-muted" />
                <span className="tw-stat-label">Revenue</span>
              </div>
              <div className="tw-stat-value">
                {formatCurrency(stats.totalPaid)}
              </div>
              <div className="tw-text-muted tw-mt-1" style={{ fontSize: '12px' }}>
                {formatCurrency(stats.totalInvoiced)} invoiced
              </div>
            </div>

            {/* Outstanding */}
            <div className="tw-stat-card">
              <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
                <DollarSign className="tw-h-4 tw-w-4 tw-text-muted" />
                <span className="tw-stat-label">Outstanding</span>
              </div>
              <div className="tw-stat-value">
                {formatCurrency(stats.totalOutstanding)}
              </div>
            </div>
          </div>
        )}

        {/* Tags Section */}
        <div className="tw-panel">
          <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
            <div className="tw-flex tw-items-center tw-gap-2">
              <Tag className="tw-h-4 tw-w-4 tw-text-muted" />
              <span className="tw-heading" style={{ fontSize: '14px' }}>
                Tags
              </span>
            </div>

            {unassignedTags.length > 0 && (
              <PortalDropdown>
                <PortalDropdownTrigger asChild>
                  <button className="tw-btn-ghost">
                    <Plus className="tw-h-3 tw-w-3" />
                    Add Tag
                  </button>
                </PortalDropdownTrigger>
                <PortalDropdownContent>
                  {unassignedTags.map((tag) => (
                    <PortalDropdownItem key={tag.id} onClick={() => handleAddTag(tag.id)}>
                      <span
                        className="tw-w-3 tw-h-3 tw-mr-2"
                        style={{ backgroundColor: tag.color, borderRadius: 0 }}
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
              <span className="tw-text-muted" style={{ fontSize: '14px', fontStyle: 'italic' }}>
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
                    <X className="tw-h-3 tw-w-3" />
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
          <h3 className="tw-section-title" style={{ marginBottom: '1rem' }}>
            Contact Information
          </h3>

          <div className="tw-flex tw-flex-col tw-gap-3">
            {client.contact_name && (
              <div className="tw-flex tw-items-center tw-gap-3">
                <User className="tw-h-4 tw-w-4 tw-text-muted" />
                <span className="tw-text-muted" style={{ fontSize: '14px' }}>
                  {client.contact_name}
                </span>
              </div>
            )}

            {client.company_name && (
              <div className="tw-flex tw-items-center tw-gap-3">
                <Building2 className="tw-h-4 tw-w-4 tw-text-muted" />
                <span className="tw-text-muted" style={{ fontSize: '14px' }}>
                  {client.company_name}
                </span>
              </div>
            )}

            {client.email && (
              <div className="tw-flex tw-items-center tw-gap-3">
                <Mail className="tw-h-4 tw-w-4 tw-text-muted" />
                <a
                  href={`mailto:${client.email}`}
                  className="tw-text-primary"
                  style={{ fontSize: '14px' }}
                >
                  {client.email}
                </a>
              </div>
            )}

            {client.phone && (
              <div className="tw-flex tw-items-center tw-gap-3">
                <Phone className="tw-h-4 tw-w-4 tw-text-muted" />
                <a
                  href={`tel:${client.phone}`}
                  className="tw-text-muted"
                  style={{ fontSize: '14px' }}
                >
                  {client.phone}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Account Details */}
        <div className="tw-panel">
          <h3 className="tw-section-title" style={{ marginBottom: '1rem' }}>
            Account Details
          </h3>

          <div className="tw-flex tw-flex-col tw-gap-3">
            <div className="tw-flex tw-items-center tw-justify-between">
              <span className="tw-label">Created</span>
              <span className="tw-text-muted" style={{ fontSize: '14px' }}>
                {formatDate(client.created_at)}
              </span>
            </div>

            {client.invitation_sent_at && (
              <div className="tw-flex tw-items-center tw-justify-between">
                <span className="tw-label">Invited</span>
                <span className="tw-text-muted" style={{ fontSize: '14px' }}>
                  {formatDate(client.invitation_sent_at)}
                </span>
              </div>
            )}

            <div className="tw-flex tw-items-center tw-justify-between">
              <span className="tw-label">Portal Access</span>
              <span
                className={cn(
                  client.status === 'active'
                    ? 'tw-text-primary'
                    : 'tw-text-muted'
                )}
                style={{ fontSize: '14px' }}
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
