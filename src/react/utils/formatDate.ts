/**
 * Unified date formatting utilities
 * Use these functions across all React components for consistent date display
 * Standard format: MM/DD/YYYY
 *
 * Re-exports from canonical source for consistency.
 * Additional React-specific formatters maintained here.
 */

// Re-export core formatters from canonical source
export {
  formatDate,
  formatDateTime,
  formatDateForInput,
  formatRelativeTime
} from '../../utils/format-utils';

/**
 * Format date as "MM/DD" - for compact displays
 */
export function formatDateShort(date: string | Date | undefined | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

/**
 * Format date as "2026-02-11" (ISO format)
 */
export function formatDateISO(date: string | Date | undefined | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return d.toISOString().split('T')[0];
}

/**
 * Format relative date - "Today", "Yesterday", "Feb 11"
 */
export function formatDateRelative(date: string | Date | undefined | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (targetDate.getTime() === today.getTime()) {
    return 'Today';
  }
  if (targetDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  return formatDateShort(d);
}
