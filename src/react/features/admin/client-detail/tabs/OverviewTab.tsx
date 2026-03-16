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
  Plus,
  ArrowRight,
  CreditCard,
  MapPin,
  Globe,
  ContactRound,
  ShieldCheck
} from 'lucide-react';
import { CopyEmailButton, ProgressBar } from '@react/components/portal';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import { StatCard, StatsRow } from '@react/components/portal/StatCard';
import type { Client, ClientHealth, ClientDetailStats, ClientTag, ClientDetailTab } from '../../types';
import { formatCurrency as formatCurrencyUtil, formatDate } from '@/utils/format-utils';
import { HEALTH_SCORE } from '@/constants/thresholds';

interface OverviewTabProps {
  client: Client;
  health: ClientHealth | null;
  stats: ClientDetailStats | null;
  tags: ClientTag[];
  availableTags: ClientTag[];
  onUpdateClient: (updates: Partial<Client>) => Promise<boolean>;
  onAddTag: (tagId: number) => Promise<boolean>;
  onRemoveTag: (tagId: number) => Promise<boolean>;
  onNavigate?: (tab: string, entityId?: string) => void;
  onSwitchTab?: (tab: ClientDetailTab) => void;
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
  if (score >= HEALTH_SCORE.HEALTHY) return 'Healthy';
  if (score >= HEALTH_SCORE.AT_RISK) return 'At Risk';
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
  onNavigate,
  onSwitchTab,
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
      <div className="layout-stack">
        {/* Health Score Card */}
        {health && (
          <div className="panel">
            <div className="data-table-header">
              <h3>
                <Heart className="icon-sm" />
                <span className="title-full">Health Score</span>
              </h3>
              <div className="stat-card-header">
                <span className="stat-value">
                  {health.score}
                </span>
                <span>
                  {getHealthStatusLabel(health.score)}
                </span>
              </div>
            </div>

            {/* Health Factors */}
            {health.factors && (
              <div className="grid-2col">
                {Object.entries(health.factors).map(([key, value]) => (
                  <div key={key} className="layout-form-field">
                    <ProgressBar value={value} label={key.replace('_', ' ')} />
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
              icon={<FolderKanban className="icon-md" />}
              meta={`${stats.activeProjects || 0} active, ${stats.completedProjects || 0} completed`}
              onClick={onSwitchTab ? () => onSwitchTab('projects') : undefined}
            />
            <StatCard
              label="Revenue"
              value={formatCurrency(stats.totalPaid)}
              icon={<TrendingUp className="icon-md" />}
              meta={`${formatCurrency(stats.totalInvoiced)} invoiced`}
              onClick={onNavigate ? () => onNavigate('invoices') : undefined}
            />
            <StatCard
              label="Outstanding"
              value={formatCurrency(stats.totalOutstanding)}
              icon={<DollarSign className="icon-md" />}
              onClick={onNavigate ? () => onNavigate('invoices') : undefined}
            />
          </StatsRow>
        )}

        {/* Tags Section */}
        <div className="panel">
          <div className="data-table-header">
            <h3>
              <Tag className="icon-sm" />
              <span className="title-full">Tags</span>
            </h3>

            {unassignedTags.length > 0 && (
              <div className="data-table-actions">
                <PortalDropdown>
                  <PortalDropdownTrigger asChild>
                    <button className="icon-btn" title="Add Tag" aria-label="Add Tag">
                      <Plus className="icon-md" />
                    </button>
                  </PortalDropdownTrigger>
                  <PortalDropdownContent>
                    {unassignedTags.map((tag) => (
                      <PortalDropdownItem key={tag.id} onClick={() => handleAddTag(tag.id)}>
                        <span
                          className="tag-color-dot"
                          aria-hidden="true"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </PortalDropdownItem>
                    ))}
                  </PortalDropdownContent>
                </PortalDropdown>
              </div>
            )}
          </div>

          <div className="layout-row-wrap">
            {tags.length === 0 ? (
              <span className="text-italic">
                No tags assigned
              </span>
            ) : (
              tags.map((tag) => (
                <span
                  key={tag.id}
                  className="tag-badge"
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
      <div className="layout-stack">
        {/* Contact Info */}
        <div className="panel">
          <div className="data-table-header">
            <h3><ContactRound className="icon-sm" /><span className="title-full">Contact Information</span></h3>
            {onSwitchTab && (
              <button
                className="panel-action"
                onClick={() => onSwitchTab('contacts')}
              >
                View All <ArrowRight className="panel-icon" />
              </button>
            )}
          </div>

          <div className="layout-stack">
            {client.contact_name && (
              <div className="layout-row">
                <User className="icon-md" />
                <span>
                  {client.contact_name}
                </span>
              </div>
            )}

            {client.company_name && (
              <div className="layout-row">
                <Building2 className="icon-md" />
                <span>
                  {client.company_name}
                </span>
              </div>
            )}

            {client.email && (
              <div className="layout-row">
                <Mail className="icon-md" />
                <span className="meta-value meta-value-with-copy">
                  <a
                    href={`mailto:${client.email}`}
                    className="link-btn"
                  >
                    {client.email}
                  </a>
                  <CopyEmailButton email={client.email} showNotification={showNotification} />
                </span>
              </div>
            )}

            {client.phone && (
              <div className="layout-row">
                <Phone className="icon-md" />
                <a
                  href={`tel:${client.phone}`}
                >
                  {client.phone}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Account Details */}
        <div className="panel">
          <div className="data-table-header">
            <h3><ShieldCheck className="icon-sm" /><span className="title-full">Account Details</span></h3>
          </div>

          <div className="layout-stack">
            <div className="layout-row-between">
              <span className="field-label">Created</span>
              <span>
                {formatDate(client.created_at, 'label')}
              </span>
            </div>

            {client.invitation_sent_at && (
              <div className="layout-row-between">
                <span className="field-label">Invited</span>
                <span>
                  {formatDate(client.invitation_sent_at, 'label')}
                </span>
              </div>
            )}

            <div className="layout-row-between">
              <span className="field-label">Portal Access</span>
              <span>
                {client.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Billing Information */}
        <div className="panel">
          <div className="data-table-header">
            <h3>
              <CreditCard className="icon-sm" />
              <span className="title-full">Billing Information</span>
            </h3>
          </div>

          {(() => {
            // Billing defaults: fall back to client contact info
            const billingName = client.billing_name || client.contact_name;
            const billingPhone = client.billing_phone || client.phone;
            const billingEmail = client.billing_email || client.email;
            const hasAddress = client.billing_address || client.billing_city;

            return (
              <div className="layout-stack">
                {(billingName || billingPhone || billingEmail || hasAddress) ? (
                  <>
                    {client.billing_company && (
                      <div className="layout-row">
                        <Building2 className="icon-md" />
                        <span>{client.billing_company}</span>
                      </div>
                    )}

                    {billingName && (
                      <div className="layout-row">
                        <User className="icon-md" />
                        <span>{billingName}</span>
                      </div>
                    )}

                    {billingPhone && (
                      <div className="layout-row">
                        <Phone className="icon-md" />
                        <a href={`tel:${billingPhone}`}>{billingPhone}</a>
                      </div>
                    )}

                    {billingEmail && (
                      <div className="layout-row">
                        <Mail className="icon-md" />
                        <span className="meta-value meta-value-with-copy">
                          <a href={`mailto:${billingEmail}`} className="link-btn">
                            {billingEmail}
                          </a>
                          <CopyEmailButton email={billingEmail} showNotification={showNotification} />
                        </span>
                      </div>
                    )}

                    {hasAddress && (
                      <div className="layout-row">
                        <MapPin className="icon-md" style={{ alignSelf: 'flex-start', marginTop: '2px' }} />
                        <div>
                          <div>{client.billing_address}{client.billing_address2 && ` ${client.billing_address2}`}</div>
                          {(client.billing_city || client.billing_state || client.billing_zip) && (
                            <div>
                              {client.billing_city}
                              {client.billing_city && client.billing_state && ', '}
                              {client.billing_state}
                              {client.billing_zip && ` ${client.billing_zip}`}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {client.billing_country && (
                      <div className="layout-row">
                        <Globe className="icon-md" />
                        <span>{client.billing_country}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-muted">No billing information on file</span>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
