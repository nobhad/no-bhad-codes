/**
 * ===============================================
 * DETAIL PANEL FACTORY
 * ===============================================
 * @file src/react/factories/createDetailPanel.tsx
 *
 * Reusable slide-in detail panel for any entity.
 * Renders via createPortal into document.body with overlay backdrop.
 *
 * @see LeadDetailPanel.tsx for the original reference implementation
 * @see ContractsTable, ProposalsTable, etc. for usage
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useState, useEffect, useCallback as _useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { DetailHeader } from '@react/components/portal/DetailHeader';
import { StatusDropdown } from '@react/components/portal/StatusDropdownCell';
import { KEYS } from '@/constants/keyboard';

// ============================================
// TYPES
// ============================================

/** Status config entry for the status dropdown */
export interface PanelStatusOption {
  label: string;
  icon?: React.ReactNode;
  [key: string]: unknown;
}

/** A single metadata field displayed in the overview */
export interface PanelMetaField {
  label: string;
  value?: string;
  onClick?: () => void;
  /** Custom render — overrides value/onClick */
  render?: React.ReactNode;
  /** Only show this field when truthy */
  visible?: boolean;
}

/** A single description/long-text block below the meta grid */
export interface PanelDescriptionField {
  label: string;
  value?: string;
  visible?: boolean;
}

/** Tab definition for the panel */
export interface PanelTab {
  id: string;
  label: string;
  badge?: number;
  render: () => React.ReactNode;
}

/** Configuration passed by each entity to define its panel */
export interface DetailPanelConfig<T> {
  /** Entity type label shown in the header (e.g. "Contract", "Proposal") */
  entityLabel: string;
  /** Panel DOM id for CSS targeting */
  panelId: string;
  /** Primary title (h1) */
  title: (entity: T) => string;
  /** Optional subtitle below title */
  subtitle?: (entity: T) => string | undefined;
  /** Status dropdown config — omit to hide status */
  status?: {
    current: (entity: T) => string;
    config: Record<string, PanelStatusOption>;
    onChange: (entity: T, newStatus: string) => void;
  };
  /** Inline meta fields shown below the title row */
  meta?: (entity: T) => PanelMetaField[];
  /** Action buttons in the title row (right-aligned) */
  actions?: (entity: T) => React.ReactNode;
  /** Tab definitions — at minimum an Overview tab */
  tabs: (entity: T) => PanelTab[];
}

/** Props for the DetailPanel component */
export interface DetailPanelProps<T> {
  /** The entity to display — null means closed */
  entity: T | null;
  /** Close handler */
  onClose: () => void;
  /** Panel configuration */
  config: DetailPanelConfig<T>;
}

// ============================================
// DETAIL PANEL COMPONENT
// ============================================

export function DetailPanel<T>({
  entity,
  onClose,
  config
}: DetailPanelProps<T>) {
  const [activeTab, setActiveTab] = useState<string>('');
  const panelRef = useRef<HTMLDivElement>(null);

  const isOpen = entity !== null;

  // Reset to first tab when entity changes
  useEffect(() => {
    if (entity) {
      const tabs = config.tabs(entity);
      setActiveTab(tabs[0]?.id ?? '');
    }
  }, [entity, config]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === KEYS.ESCAPE) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !entity) return null;

  const tabs = config.tabs(entity);
  const meta = config.meta?.(entity) ?? [];
  const visibleMeta = meta
    .filter((m) => m.visible !== false && m.value != null && m.value !== '')
    .map(({ label, value }) => ({ label, value: value! }));
  const titleText = config.title(entity);
  const subtitleText = config.subtitle?.(entity);
  const actionsNode = config.actions?.(entity);

  return createPortal(
    <>
      {/* Overlay backdrop */}
      <div
        className="details-overlay"
        onClick={onClose}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === KEYS.ENTER || e.key === KEYS.SPACE) {
            e.preventDefault();
            onClose();
          }
        }}
        aria-label="Close panel"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        id={config.panelId}
        className="details-panel"
        role="dialog"
        aria-label={`${config.entityLabel} details`}
      >
        {/* Header */}
        <div className="details-header">
          <h3>{config.entityLabel}</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close panel">
            <X />
          </button>
        </div>

        {/* Title row */}
        <DetailHeader
          title={titleText}
          status={config.status ? (
            <StatusDropdown
              status={config.status.current(entity)}
              statusConfig={config.status.config}
              onStatusChange={(newStatus) => config.status!.onChange(entity, newStatus)}
              ariaLabel={`Change ${config.entityLabel.toLowerCase()} status`}
            />
          ) : undefined}
          subtitle={subtitleText || undefined}
          meta={visibleMeta}
          actions={actionsNode}
        />

        {/* Tabbed content */}
        <div className="details-content">
          {tabs.length > 1 && (
            <div className="lead-details-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={cn('lead-tab', activeTab === tab.id && 'is-active')}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && ` (${tab.badge})`}
                </button>
              ))}
            </div>
          )}

          {tabs.map((tab) =>
            activeTab === tab.id ? (
              <div key={tab.id} className="lead-tab-content is-active">
                {tab.render()}
              </div>
            ) : null
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

// ============================================
// META ITEM — Reusable helper for overview tabs
// ============================================

export function MetaItem({
  label,
  value,
  onClick,
  children
}: {
  label: string;
  value?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="meta-item">
      <span className="field-label">{label}</span>
      {children || (
        onClick ? (
          <a href="#" className="meta-value panel-link" onClick={(e) => { e.preventDefault(); onClick(); }}>
            {value}
          </a>
        ) : (
          <span className="meta-value">{value}</span>
        )
      )}
    </div>
  );
}

// ============================================
// OVERVIEW META GRID — Common overview layout
// ============================================

export function MetaGrid({
  fields,
  descriptions
}: {
  fields: PanelMetaField[];
  descriptions?: PanelDescriptionField[];
}) {
  const visibleFields = fields.filter((f) => f.visible !== false);
  const visibleDescriptions = descriptions?.filter((d) => d.visible !== false) ?? [];

  return (
    <>
      <div className="project-detail-meta">
        {visibleFields.map((field) => (
          <MetaItem key={field.label} label={field.label} value={field.value} onClick={field.onClick}>
            {field.render}
          </MetaItem>
        ))}
      </div>
      {visibleDescriptions.map((desc) => (
        <div key={desc.label} className="project-description-row">
          <div className="meta-item description-item">
            <span className="field-label">{desc.label}</span>
            <span className="meta-value">{desc.value}</span>
          </div>
        </div>
      ))}
    </>
  );
}

// ============================================
// TIMELINE — Reusable date timeline for panels
// ============================================

export interface TimelineEvent {
  label: string;
  date?: string | null;
  /** Format callback — defaults to raw string */
  formatDate?: (date: string) => string;
}

export function Timeline({
  events,
  formatDate: defaultFormat
}: {
  events: TimelineEvent[];
  formatDate?: (date: string) => string;
}) {
  return (
    <ul className="activity-feed">
      {events.map((event) => {
        const formatter = event.formatDate ?? defaultFormat ?? ((d: string) => d);
        return (
          <li key={event.label} className="activity-feed-item">
            <div className="activity-body">
              <span className="activity-text">{event.label}</span>
              <span className="activity-time">
                {event.date ? formatter(event.date) : 'Pending'}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
