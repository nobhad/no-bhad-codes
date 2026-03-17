/**
 * ===============================================
 * DETAIL HEADER
 * ===============================================
 * @file src/react/components/portal/DetailHeader.tsx
 *
 * Reusable header for detail pages and panels.
 * Renders: title + status + subtitle + meta items + actions.
 *
 * Used by: ClientDetail, ProjectDetail, LeadDetailPanel,
 *          ProjectSnapshot (client portal), createDetailPanel factory.
 */

import * as React from 'react';
import type { ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface MetaField {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}

export interface DetailHeaderProps {
  /** Primary title text */
  title: string;
  /** Status indicator — StatusDropdown, StatusBadge, or any ReactNode */
  status?: ReactNode;
  /** Secondary line below title (e.g., contact name under company) */
  subtitle?: string;
  /** Label/value metadata items rendered below the title row */
  meta?: MetaField[];
  /** Action buttons rendered on the right side */
  actions?: ReactNode;
  /** Additional children rendered inside detail-info after meta */
  children?: ReactNode;
}

// ============================================================================
// Component
// ============================================================================

/**
 * DetailHeader
 *
 * Renders the standard detail-title-row structure used across
 * all detail pages and panels:
 *
 * ```
 * [title + status]              [actions]
 * [subtitle]
 * [meta: label: value, ...]
 * ```
 */
export const DetailHeader = React.memo(({
  title,
  status,
  subtitle,
  meta,
  actions,
  children
}: DetailHeaderProps) => {
  const visibleMeta = meta?.filter((f) => f.value != null && f.value !== '') ?? [];

  return (
    <div className="detail-title-row">
      <div className="detail-title-group">
        <div className="detail-info">
          <div className="detail-name-row">
            <h1 className="detail-title">{title}</h1>
            {status}
          </div>

          {subtitle && (
            <div className="detail-subtitle">{subtitle}</div>
          )}

          {visibleMeta.length > 0 && (
            <div className="detail-meta">
              {visibleMeta.map((field) => (
                <span key={field.label} className="meta-item">
                  {field.icon}
                  <span className="field-label">{field.label}:</span>{' '}
                  <span className="meta-value">{field.value}</span>
                </span>
              ))}
            </div>
          )}

          {children}
        </div>
      </div>

      {actions && (
        <div className="detail-actions">
          {actions}
        </div>
      )}
    </div>
  );
});
