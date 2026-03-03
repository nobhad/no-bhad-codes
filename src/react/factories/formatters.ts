/**
 * ===============================================
 * FORMAT FACTORY
 * ===============================================
 * @file src/react/factories/formatters.ts
 *
 * Centralized formatting utilities for consistent data display.
 * Eliminates duplicate formatting functions across components.
 */

// ============================================
// DATE FORMATTING
// ============================================

export interface DateFormatOptions {
  /** Include time in output */
  includeTime?: boolean;
  /** Use relative time (e.g., "2 hours ago") */
  relative?: boolean;
  /** Fallback for null/undefined dates */
  fallback?: string;
  /** Locale for formatting */
  locale?: string;
}

/**
 * Format a date value consistently across the app.
 *
 * @example
 * formatDate('2024-01-15') // 'Jan 15, 2024'
 * formatDate('2024-01-15', { includeTime: true }) // 'Jan 15, 2024, 2:30 PM'
 * formatDate('2024-01-15', { relative: true }) // '2 days ago'
 */
export function formatDate(
  date: string | Date | null | undefined,
  options: DateFormatOptions = {}
): string {
  const {
    includeTime = false,
    relative = false,
    fallback = '—',
    locale = 'en-US'
  } = options;

  if (!date) return fallback;

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return fallback;

  if (relative) {
    return formatRelativeTime(dateObj);
  }

  const dateOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  };

  if (includeTime) {
    dateOptions.hour = 'numeric';
    dateOptions.minute = '2-digit';
  }

  return dateObj.toLocaleDateString(locale, dateOptions);
}

/**
 * Format date as relative time (e.g., "2 hours ago", "in 3 days").
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  const isFuture = diffMs < 0;
  const abs = Math.abs;

  if (abs(diffSec) < 60) {
    return 'just now';
  }
  if (abs(diffMin) < 60) {
    const mins = abs(diffMin);
    return isFuture ? `in ${mins} min` : `${mins} min ago`;
  }
  if (abs(diffHour) < 24) {
    const hours = abs(diffHour);
    return isFuture ? `in ${hours}h` : `${hours}h ago`;
  }
  if (abs(diffDay) < 7) {
    const days = abs(diffDay);
    return isFuture ? `in ${days}d` : `${days}d ago`;
  }
  if (abs(diffWeek) < 4) {
    const weeks = abs(diffWeek);
    return isFuture ? `in ${weeks}w` : `${weeks}w ago`;
  }
  if (abs(diffMonth) < 12) {
    const months = abs(diffMonth);
    return isFuture ? `in ${months}mo` : `${months}mo ago`;
  }

  const years = abs(diffYear);
  return isFuture ? `in ${years}y` : `${years}y ago`;
}

/**
 * Format a date for message timestamps (smart formatting).
 * Today: "2:30 PM"
 * This week: "Mon 2:30 PM"
 * Older: "Jan 15, 2024"
 */
export function formatMessageTime(date: string | Date | null | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Today: show time only
  if (diffDays === 0 && dateObj.getDate() === now.getDate()) {
    return dateObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  // This week: show day and time
  if (diffDays < 7) {
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  // Older: show full date
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// ============================================
// CURRENCY FORMATTING
// ============================================

export interface CurrencyFormatOptions {
  /** Currency code (default: USD) */
  currency?: string;
  /** Locale for formatting */
  locale?: string;
  /** Show cents for whole numbers */
  showCents?: boolean;
  /** Compact notation for large numbers */
  compact?: boolean;
  /** Fallback for null/undefined values */
  fallback?: string;
}

/**
 * Format a number as currency.
 *
 * @example
 * formatCurrency(1234.56) // '$1,234.56'
 * formatCurrency(1000, { showCents: false }) // '$1,000'
 * formatCurrency(1500000, { compact: true }) // '$1.5M'
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options: CurrencyFormatOptions = {}
): string {
  const {
    currency = 'USD',
    locale = 'en-US',
    showCents = true,
    compact = false,
    fallback = '—'
  } = options;

  if (value === null || value === undefined) return fallback;

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return fallback;

  if (compact && Math.abs(numValue) >= 1000) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(numValue);
  }

  const formatOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency
  };

  if (!showCents && numValue % 1 === 0) {
    formatOptions.minimumFractionDigits = 0;
    formatOptions.maximumFractionDigits = 0;
  }

  return new Intl.NumberFormat(locale, formatOptions).format(numValue);
}

// ============================================
// NUMBER FORMATTING
// ============================================

export interface NumberFormatOptions {
  /** Locale for formatting */
  locale?: string;
  /** Minimum fraction digits */
  minDecimals?: number;
  /** Maximum fraction digits */
  maxDecimals?: number;
  /** Use compact notation */
  compact?: boolean;
  /** Fallback for null/undefined values */
  fallback?: string;
}

/**
 * Format a number with locale-aware separators.
 *
 * @example
 * formatNumber(1234567) // '1,234,567'
 * formatNumber(1234567, { compact: true }) // '1.2M'
 */
export function formatNumber(
  value: number | string | null | undefined,
  options: NumberFormatOptions = {}
): string {
  const {
    locale = 'en-US',
    minDecimals,
    maxDecimals,
    compact = false,
    fallback = '—'
  } = options;

  if (value === null || value === undefined) return fallback;

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return fallback;

  const formatOptions: Intl.NumberFormatOptions = {};

  if (compact) {
    formatOptions.notation = 'compact';
    formatOptions.maximumFractionDigits = 1;
  } else {
    if (minDecimals !== undefined) formatOptions.minimumFractionDigits = minDecimals;
    if (maxDecimals !== undefined) formatOptions.maximumFractionDigits = maxDecimals;
  }

  return new Intl.NumberFormat(locale, formatOptions).format(numValue);
}

/**
 * Format a number as a percentage.
 *
 * @example
 * formatPercent(0.75) // '75%'
 * formatPercent(0.756, { maxDecimals: 1 }) // '75.6%'
 */
export function formatPercent(
  value: number | null | undefined,
  options: { maxDecimals?: number; fallback?: string } = {}
): string {
  const { maxDecimals = 0, fallback = '—' } = options;

  if (value === null || value === undefined) return fallback;
  if (isNaN(value)) return fallback;

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: maxDecimals
  }).format(value);
}

// ============================================
// FILE SIZE FORMATTING
// ============================================

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/**
 * Format bytes as human-readable file size.
 *
 * @example
 * formatFileSize(1024) // '1 KB'
 * formatFileSize(1536000) // '1.46 MB'
 */
export function formatFileSize(
  bytes: number | null | undefined,
  fallback = '—'
): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return fallback;
  if (bytes === 0) return '0 B';

  const k = 1024;
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(i > 0 ? 2 : 0)} ${FILE_SIZE_UNITS[i]}`;
}

// ============================================
// TEXT FORMATTING
// ============================================

/**
 * Truncate text with ellipsis.
 *
 * @example
 * truncateText('Hello World', 5) // 'Hello...'
 */
export function truncateText(
  text: string | null | undefined,
  maxLength: number,
  ellipsis = '...'
): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + ellipsis;
}

/**
 * Capitalize first letter of string.
 */
export function capitalize(text: string | null | undefined): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Convert string to title case.
 */
export function titleCase(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format a name (handles null, trims, title-cases).
 */
export function formatName(
  firstName?: string | null,
  lastName?: string | null,
  fallback = '—'
): string {
  const first = firstName?.trim();
  const last = lastName?.trim();

  if (!first && !last) return fallback;
  if (!first) return last || fallback;
  if (!last) return first;

  return `${first} ${last}`;
}

/**
 * Pluralize a word based on count.
 *
 * @example
 * pluralize(1, 'item') // '1 item'
 * pluralize(5, 'item') // '5 items'
 * pluralize(0, 'child', 'children') // '0 children'
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  const word = count === 1 ? singular : (plural || `${singular}s`);
  return `${count} ${word}`;
}

// ============================================
// PHONE FORMATTING
// ============================================

/**
 * Format a phone number for display.
 *
 * @example
 * formatPhone('5551234567') // '(555) 123-4567'
 * formatPhone('+15551234567') // '+1 (555) 123-4567'
 */
export function formatPhone(
  phone: string | null | undefined,
  fallback = '—'
): string {
  if (!phone) return fallback;

  // Remove all non-digits except leading +
  const hasPlus = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 0) return fallback;

  // Handle 10-digit US numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Handle 11-digit numbers (with country code)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Return original with + if it had one
  return hasPlus ? `+${digits}` : digits;
}

// ============================================
// EXPORTS
// ============================================

export const Formatters = {
  date: formatDate,
  relativeTime: formatRelativeTime,
  messageTime: formatMessageTime,
  currency: formatCurrency,
  number: formatNumber,
  percent: formatPercent,
  fileSize: formatFileSize,
  truncate: truncateText,
  capitalize,
  titleCase,
  name: formatName,
  pluralize,
  phone: formatPhone
};

export default Formatters;
