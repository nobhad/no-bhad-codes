/**
 * ===============================================
 * TABLE CELL FACTORY
 * ===============================================
 * @file src/react/factories/createTableCells.tsx
 *
 * Reusable table cell components for common data types.
 * Provides consistent formatting and styling across tables.
 */

import * as React from 'react';
import { ExternalLink, Mail, Phone, Copy, Check } from 'lucide-react';
import { cn } from '@react/lib/utils';
import {
  formatDate,
  formatCurrency,
  formatFileSize,
  formatPhone,
  truncateText
} from './formatters';

// ============================================
// TABLE CELL WRAPPER
// ============================================

interface TableCellWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Simple table cell wrapper for consistent styling.
 */
function TableCellWrapper({ children, className }: TableCellWrapperProps) {
  return <span className={cn('table-cell-content', className)}>{children}</span>;
}

// ============================================
// DATE CELL
// ============================================

export interface DateCellProps {
  /** Date value */
  value: string | Date | null | undefined;
  /** Include time in display */
  includeTime?: boolean;
  /** Use relative time (e.g., "2 days ago") */
  relative?: boolean;
  /** Fallback text for null values */
  fallback?: string;
  /** Additional className */
  className?: string;
}

/**
 * Date cell with consistent formatting.
 *
 * @example
 * <DateCell value={project.created_at} />
 * <DateCell value={task.due_date} relative />
 */
export function DateCell({
  value,
  includeTime = false,
  relative = false,
  fallback = '—',
  className
}: DateCellProps) {
  const formatted = formatDate(value, { includeTime, relative, fallback });

  return (
    <TableCellWrapper className={cn('date-cell', className)}>
      <span title={value ? new Date(value).toLocaleString() : undefined}>
        {formatted}
      </span>
    </TableCellWrapper>
  );
}

// ============================================
// CURRENCY CELL
// ============================================

export interface CurrencyCellProps {
  /** Amount value */
  value: number | string | null | undefined;
  /** Currency code (default: USD) */
  currency?: string;
  /** Use compact notation for large numbers */
  compact?: boolean;
  /** Fallback text for null values */
  fallback?: string;
  /** Additional className */
  className?: string;
}

/**
 * Currency cell with consistent formatting.
 *
 * @example
 * <CurrencyCell value={invoice.amount} />
 * <CurrencyCell value={project.budget} compact />
 */
export function CurrencyCell({
  value,
  currency = 'USD',
  compact = false,
  fallback = '—',
  className
}: CurrencyCellProps) {
  const formatted = formatCurrency(value, { currency, compact, fallback });

  return (
    <TableCellWrapper className={cn('currency-cell', className)}>
      {formatted}
    </TableCellWrapper>
  );
}

// ============================================
// FILE SIZE CELL
// ============================================

export interface FileSizeCellProps {
  /** Size in bytes */
  value: number | null | undefined;
  /** Fallback text for null values */
  fallback?: string;
  /** Additional className */
  className?: string;
}

/**
 * File size cell with consistent formatting.
 *
 * @example
 * <FileSizeCell value={file.size} />
 */
export function FileSizeCell({
  value,
  fallback = '—',
  className
}: FileSizeCellProps) {
  const formatted = formatFileSize(value, fallback);

  return (
    <TableCellWrapper className={cn('file-size-cell', className)}>
      {formatted}
    </TableCellWrapper>
  );
}

// ============================================
// CONTACT CELL (Name + Email)
// ============================================

export interface ContactCellProps {
  /** Primary name/title */
  name: string | null | undefined;
  /** Secondary text (email, company, etc.) */
  secondary?: string | null;
  /** Tertiary text (type, role, etc.) */
  tertiary?: string | null;
  /** Show email link */
  emailLink?: boolean;
  /** Fallback for missing name */
  fallback?: string;
  /** Additional className */
  className?: string;
}

/**
 * Contact cell with name and secondary info.
 *
 * @example
 * <ContactCell
 *   name={client.name}
 *   secondary={client.email}
 *   tertiary={client.company}
 *   emailLink
 * />
 */
export function ContactCell({
  name,
  secondary,
  tertiary,
  emailLink = false,
  fallback = '—',
  className
}: ContactCellProps) {
  const displayName = name?.trim() || fallback;

  return (
    <TableCellWrapper className={cn('contact-cell primary-cell', className)}>
      <div className="cell-content">
        <span className="cell-title">{displayName}</span>
        {secondary && (
          <span className="cell-subtitle">
            {emailLink && secondary.includes('@') ? (
              <a
                href={`mailto:${secondary}`}
                className="cell-link"
                onClick={(e) => e.stopPropagation()}
              >
                {secondary}
              </a>
            ) : (
              secondary
            )}
          </span>
        )}
        {tertiary && <span className="cell-subtitle type-stacked">{tertiary}</span>}
      </div>
    </TableCellWrapper>
  );
}

// ============================================
// PHONE CELL
// ============================================

export interface PhoneCellProps {
  /** Phone number */
  value: string | null | undefined;
  /** Show call link */
  callLink?: boolean;
  /** Fallback for null values */
  fallback?: string;
  /** Additional className */
  className?: string;
}

/**
 * Phone cell with formatted number.
 *
 * @example
 * <PhoneCell value={contact.phone} callLink />
 */
export function PhoneCell({
  value,
  callLink = false,
  fallback = '—',
  className
}: PhoneCellProps) {
  const formatted = formatPhone(value, fallback);

  return (
    <TableCellWrapper className={cn('phone-cell', className)}>
      {callLink && value ? (
        <a
          href={`tel:${value.replace(/\D/g, '')}`}
          className="cell-link"
          onClick={(e) => e.stopPropagation()}
        >
          <Phone className="cell-icon" aria-hidden="true" />
          {formatted}
        </a>
      ) : (
        formatted
      )}
    </TableCellWrapper>
  );
}

// ============================================
// EMAIL CELL
// ============================================

export interface EmailCellProps {
  /** Email address */
  value: string | null | undefined;
  /** Show mail link */
  mailLink?: boolean;
  /** Truncate long emails */
  maxLength?: number;
  /** Fallback for null values */
  fallback?: string;
  /** Additional className */
  className?: string;
}

/**
 * Email cell with optional link.
 *
 * @example
 * <EmailCell value={user.email} mailLink />
 */
export function EmailCell({
  value,
  mailLink = true,
  maxLength,
  fallback = '—',
  className
}: EmailCellProps) {
  if (!value) {
    return (
      <TableCellWrapper className={cn('email-cell', className)}>
        {fallback}
      </TableCellWrapper>
    );
  }

  const displayValue = maxLength ? truncateText(value, maxLength) : value;

  return (
    <TableCellWrapper className={cn('email-cell', className)}>
      {mailLink ? (
        <a
          href={`mailto:${value}`}
          className="cell-link"
          title={value}
          onClick={(e) => e.stopPropagation()}
        >
          <Mail className="cell-icon" aria-hidden="true" />
          {displayValue}
        </a>
      ) : (
        <span title={value}>{displayValue}</span>
      )}
    </TableCellWrapper>
  );
}

// ============================================
// LINK CELL
// ============================================

export interface LinkCellProps {
  /** URL to link to */
  href: string | null | undefined;
  /** Display text (defaults to URL) */
  label?: string;
  /** Open in new tab */
  external?: boolean;
  /** Truncate long URLs */
  maxLength?: number;
  /** Fallback for null values */
  fallback?: string;
  /** Additional className */
  className?: string;
}

/**
 * Link cell with external link icon.
 *
 * @example
 * <LinkCell href={project.website} external />
 */
export function LinkCell({
  href,
  label,
  external = true,
  maxLength = 30,
  fallback = '—',
  className
}: LinkCellProps) {
  if (!href) {
    return (
      <TableCellWrapper className={cn('link-cell', className)}>
        {fallback}
      </TableCellWrapper>
    );
  }

  const displayText = label || truncateText(href.replace(/^https?:\/\//, ''), maxLength);

  return (
    <TableCellWrapper className={cn('link-cell', className)}>
      <a
        href={href}
        className="cell-link"
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        title={href}
        onClick={(e) => e.stopPropagation()}
      >
        {displayText}
        {external && <ExternalLink className="cell-icon" aria-hidden="true" />}
      </a>
    </TableCellWrapper>
  );
}

// ============================================
// COUNT CELL
// ============================================

export interface CountCellProps {
  /** Count value */
  value: number | null | undefined;
  /** Label for the count (e.g., "items", "tasks") */
  label?: string;
  /** Show zero values */
  showZero?: boolean;
  /** Fallback for null values */
  fallback?: string;
  /** Additional className */
  className?: string;
}

/**
 * Count cell with optional label.
 *
 * @example
 * <CountCell value={project.task_count} label="tasks" />
 */
export function CountCell({
  value,
  label,
  showZero = true,
  fallback = '—',
  className
}: CountCellProps) {
  if (value === null || value === undefined) {
    return (
      <TableCellWrapper className={cn('count-cell', className)}>
        {fallback}
      </TableCellWrapper>
    );
  }

  if (value === 0 && !showZero) {
    return (
      <TableCellWrapper className={cn('count-cell', className)}>
        {fallback}
      </TableCellWrapper>
    );
  }

  return (
    <TableCellWrapper className={cn('count-cell', className)}>
      {value.toLocaleString()}
      {label && <span className="count-label"> {label}</span>}
    </TableCellWrapper>
  );
}

// ============================================
// COPY CELL
// ============================================

export interface CopyCellProps {
  /** Value to copy */
  value: string | null | undefined;
  /** Display text (defaults to value) */
  displayValue?: string;
  /** Truncate display */
  maxLength?: number;
  /** Fallback for null values */
  fallback?: string;
  /** Additional className */
  className?: string;
}

/**
 * Cell with copy-to-clipboard button.
 *
 * @example
 * <CopyCell value={apiKey} maxLength={20} />
 */
export function CopyCell({
  value,
  displayValue,
  maxLength,
  fallback = '—',
  className
}: CopyCellProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (value) {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    },
    [value]
  );

  if (!value) {
    return (
      <TableCellWrapper className={cn('copy-cell', className)}>
        {fallback}
      </TableCellWrapper>
    );
  }

  const display = displayValue || (maxLength ? truncateText(value, maxLength) : value);

  return (
    <TableCellWrapper className={cn('copy-cell', className)}>
      <span className="copy-cell-value" title={value}>
        {display}
      </span>
      <button
        type="button"
        className="copy-cell-button"
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy to clipboard'}
        aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
      >
        {copied ? (
          <Check className="copy-cell-icon copy-cell-icon--success" aria-hidden="true" />
        ) : (
          <Copy className="copy-cell-icon" aria-hidden="true" />
        )}
      </button>
    </TableCellWrapper>
  );
}

// ============================================
// TEXT CELL
// ============================================

export interface TextCellProps {
  /** Text value */
  value: string | null | undefined;
  /** Truncate long text */
  maxLength?: number;
  /** Fallback for null values */
  fallback?: string;
  /** Additional className */
  className?: string;
  /** Make cell primary (bold) */
  primary?: boolean;
}

/**
 * Simple text cell with optional truncation.
 *
 * @example
 * <TextCell value={project.name} primary />
 * <TextCell value={project.description} maxLength={50} />
 */
export function TextCell({
  value,
  maxLength,
  fallback = '—',
  className,
  primary = false
}: TextCellProps) {
  if (!value) {
    return (
      <TableCellWrapper className={cn('text-cell', className)}>
        {fallback}
      </TableCellWrapper>
    );
  }

  const display = maxLength ? truncateText(value, maxLength) : value;
  const needsTooltip = maxLength && value.length > maxLength;

  return (
    <TableCellWrapper
      className={cn('text-cell', primary && 'primary-cell', className)}
    >
      <span title={needsTooltip ? value : undefined}>{display}</span>
    </TableCellWrapper>
  );
}

// ============================================
// EXPORTS
// ============================================

export const TableCells = {
  Date: DateCell,
  Currency: CurrencyCell,
  FileSize: FileSizeCell,
  Contact: ContactCell,
  Phone: PhoneCell,
  Email: EmailCell,
  Link: LinkCell,
  Count: CountCell,
  Copy: CopyCell,
  Text: TextCell
};

export default TableCells;
