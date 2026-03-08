/**
 * ===============================================
 * FORMAT UTILITIES
 * ===============================================
 * @file src/utils/format-utils.ts
 *
 * Shared formatting functions used across admin and client portals.
 */

import { CURRENCY_COMPACT } from '../constants/thresholds';
import { MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY } from './time-utils';

/**
 * Format bytes into human-readable file size
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format number as USD currency
 * @param amount - Number or string to format (handles null/undefined/NaN)
 * @param options - Formatting options
 * @param options.showCents - Whether to show decimal places (default: false)
 * @param options.fallback - Value to return for invalid input (default: '' empty)
 * @returns Formatted currency string (e.g., "$1,234" or "" for invalid)
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options: { showCents?: boolean; fallback?: string } = {}
): string {
  const { showCents = false, fallback = '' } = options;

  // Handle null/undefined
  if (amount === null || amount === undefined) return fallback;

  // Parse string to number if needed
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Handle NaN
  if (isNaN(num)) return fallback;

  const formatOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'USD'
  };

  if (!showCents) {
    formatOptions.minimumFractionDigits = 0;
    formatOptions.maximumFractionDigits = 0;
  }

  return new Intl.NumberFormat('en-US', formatOptions).format(num);
}

/**
 * Format currency in compact form for dashboards/analytics
 * Shows $1.5M for millions, $2.3K for thousands
 * @param amount - Number to format
 * @returns Compact currency string (e.g., "$1.5M", "$2.3K", "$500")
 */
export function formatCurrencyCompact(amount: number | null | undefined): string {
  const value = amount || 0;
  if (value >= CURRENCY_COMPACT.MILLION) {
    return `$${(value / CURRENCY_COMPACT.MILLION).toFixed(1)}M`;
  }
  if (value >= CURRENCY_COMPACT.THOUSAND) {
    return `$${(value / CURRENCY_COMPACT.THOUSAND).toFixed(1)}K`;
  }
  return `$${value.toLocaleString()}`;
}

/**
 * Normalize status value to hyphen format for database consistency.
 * Legacy data may have underscores, this converts them to hyphens.
 * @param status - Status value to normalize
 * @param defaultValue - Default value if status is undefined/empty (default: 'pending')
 * @returns Normalized status string with hyphens
 */
export function normalizeStatus(
  status: string | undefined | null,
  defaultValue: string = 'pending'
): string {
  if (!status) return defaultValue;
  return status.replace(/_/g, '-');
}

/**
 * Format display value for admin UI
 * Converts kebab-case to Title Case, handles budget ranges, timelines, etc.
 * Preserves hyphens between numbers (for ranges like "1000-2500", "2-4")
 * Formats currency values with $ and commas where appropriate
 * @param value - Raw value from database
 * @returns Formatted display string
 */
export function formatDisplayValue(value: string | undefined | null): string {
  if (!value || value === '-') return '';

  // Handle special cases first
  const lowerValue = value.toLowerCase();

  // ASAP should be all caps
  if (lowerValue === 'asap') return 'ASAP';

  // Budget ranges: "under-1k" -> "Under $1k"
  if (lowerValue.includes('under')) {
    return value.replace(/under-?/gi, 'Under $');
  }

  // Check if this looks like a pure numeric budget range (e.g., "1000-2500")
  const numericRangeMatch = value.match(/^(\d+)-(\d+)$/);
  if (numericRangeMatch) {
    const min = parseInt(numericRangeMatch[1], 10);
    const max = parseInt(numericRangeMatch[2], 10);
    return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  }

  // Budget with "k" notation: "1k-2.5k" -> "$1k–$2.5k", "5k-10k" -> "$5k–$10k"
  // Handles decimals like 2.5k, and also space-separated (corrupted data) like "2.5k 5k"
  const kRangeMatch = value.match(/^([\d.]+)k[-\s]+([\d.]+)k$/i);
  if (kRangeMatch) {
    return `$${kRangeMatch[1]}k–$${kRangeMatch[2]}k`;
  }

  // Single k value with plus: "10k+" -> "$10k+", "35k-plus" -> "$35k+"
  const kPlusMatch = value.match(/^([\d.]+)k[+-]?(plus)?$/i);
  if (kPlusMatch) {
    return `$${kPlusMatch[1]}k+`;
  }

  // Replace hyphens with spaces EXCEPT when between numbers (for ranges)
  // e.g., "1-3-months" -> "1–3 Months", "simple-site" -> "Simple Site"
  let formatted = value
    .replace(/(\d+)-(\d+)/g, '$1–$2') // Convert number ranges to en-dash
    .replace(/-/g, ' '); // Replace remaining hyphens with spaces
  formatted = formatted.replace(/\b\w/g, (char) => char.toUpperCase());

  return formatted;
}

/**
 * Escape HTML entities to prevent XSS
 * @param text - Raw text that may contain HTML characters
 * @returns Escaped text safe for innerHTML
 */
export function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#x27;',
    '`': '&#96;'
  };
  return text.replace(/[&<>"'`]/g, (match) => htmlEntities[match] || match);
}

/**
 * Format text with line breaks for HTML display
 * Safely escapes HTML and converts newlines to <br> tags
 * @param text - Raw text that may contain newlines
 * @returns HTML-safe string with <br> tags for line breaks
 */
export function formatTextWithLineBreaks(text: string | undefined | null): string {
  if (!text) return '';
  // Escape HTML first to prevent XSS, then convert newlines to <br>
  return escapeHtml(text).replace(/\n/g, '<br>');
}

// ============================================
// PROJECT TYPE FORMATTING
// ============================================

/**
 * Project type display labels - single source of truth
 * Keys match the values stored in database and used in intake/validation
 */
export const PROJECT_TYPE_LABELS: Record<string, string> = {
  'simple-site': 'Simple Website',
  'business-site': 'Business Website',
  portfolio: 'Portfolio',
  'e-commerce': 'E-Commerce',
  ecommerce: 'E-Commerce', // Legacy support
  'web-app': 'Web Application',
  'browser-extension': 'Browser Extension',
  website: 'Website',
  'mobile-app': 'Mobile App',
  branding: 'Branding',
  other: 'Other'
};

/**
 * Format project type for display
 * Uses consistent labels across admin and client portals
 * @param type - Project type value from database
 * @returns Formatted display label
 */
export function formatProjectType(type: string | undefined | null): string {
  if (!type) return '';
  return PROJECT_TYPE_LABELS[type] || type;
}

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Format date for display with optional format specification
 * @param dateString - ISO date string or Date object
 * @param format - 'short' (MM/DD/YYYY), 'label' (Jan 1, 2026), 'datetime' (MM/DD/YYYY, h:mm AM/PM), or undefined (defaults to 'short')
 * @returns Formatted date string
 */
export function formatDate(
  dateString: string | Date | undefined | null,
  format?: 'short' | 'label' | 'datetime'
): string {
  if (!dateString) return '';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '';

    if (format === 'label') {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const datePart = `${month}/${day}/${year}`;

    if (format === 'datetime') {
      const timePart = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `${datePart}, ${timePart}`;
    }

    return datePart;
  } catch {
    return '';
  }
}

/**
 * Format date and time for display in MM/DD/YYYY, h:mm AM/PM format
 * @param dateString - ISO date string or Date object
 * @returns Formatted date and time string (e.g., "01/28/2026, 2:30 PM")
 */
export function formatDateTime(dateString: string | Date | undefined | null): string {
  if (!dateString) return '';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '';

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const datePart = `${month}/${day}/${year}`;

    const timePart = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${datePart}, ${timePart}`;
  } catch {
    return '';
  }
}

/**
 * Format date for input fields (YYYY-MM-DD)
 * Handles timezone issues by parsing date components directly
 * @param dateString - ISO date string
 * @returns Date in YYYY-MM-DD format
 */
export function formatDateForInput(dateString: string | undefined | null): string {
  if (!dateString) return '';

  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Handle ISO strings with time component
  const datePart = dateString.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }

  // Fallback: try to parse and format
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 * @param dateString - ISO date string or Date object
 * @returns Relative time string
 */
export function formatRelativeTime(dateString: string | Date | undefined | null): string {
  if (!dateString) return '';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / MS_PER_MINUTE);
    const diffHours = Math.floor(diffMs / MS_PER_HOUR);
    const diffDays = Math.floor(diffMs / MS_PER_DAY);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    // More than a week, show actual date
    return formatDate(date);
  } catch {
    return '';
  }
}

// ============================================
// DATE ALIASES & VARIANTS
// ============================================

/**
 * Alias for formatDate() with no format arg - returns MM/DD/YYYY
 * Kept for backward compatibility with existing imports
 * @param date - ISO date string or Date object
 * @returns Formatted date string in MM/DD/YYYY format
 */
export function formatDateShort(date: string | Date | undefined | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 * @param date - ISO date string or Date object
 * @returns Date in YYYY-MM-DD format, empty string for null/invalid
 */
export function formatDateISO(date: string | Date | undefined | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

/**
 * Format relative date - "Today", "Yesterday", or MM/DD/YYYY
 * @param date - ISO date string or Date object
 * @returns Relative date label or formatted date string
 */
export function formatDateRelative(date: string | Date | undefined | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

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

/**
 * Format date for card displays (e.g., "Feb 27, 2026")
 * Equivalent to formatDate(date, 'label') but accepts only strings
 * @param dateString - ISO date string to format
 * @returns Formatted date string
 */
export function formatCardDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// ============================================
// DUE DATE UTILITIES
// ============================================

/**
 * Check if a due date is in the past (overdue)
 * @param dueDate - ISO date string or undefined
 * @returns true if the date is in the past, false otherwise
 */
export function isOverdue(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

/**
 * Get the number of days until a due date
 * @param dueDate - ISO date string or undefined
 * @returns Number of days until due (negative if overdue), or null if no due date
 */
export function getDaysUntilDue(dueDate: string | undefined): number | null {
  if (!dueDate) return null;
  // Parse due date parts to avoid UTC vs local timezone mismatch
  // new Date('YYYY-MM-DD') parses as UTC, but we need local dates for comparison
  const [year, month, day] = dueDate.split('T')[0].split('-').map(Number);
  const due = new Date(year, month - 1, day);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  return Math.round(diffTime / MS_PER_DAY);
}

/**
 * Get human readable text for days until due date
 * @param dueDate - ISO date string or undefined
 * @returns Human readable string like "3 days left", "2 days overdue", "Due today", etc.
 */
export function getDueDaysText(dueDate: string | undefined): string {
  if (!dueDate) return '';

  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
  }
  if (diffDays === 0) {
    return 'Due today';
  }
  if (diffDays === 1) {
    return 'Due tomorrow';
  }
  return `Due in ${diffDays} days`;
}

// ============================================
// DATA UTILITIES
// ============================================

/**
 * Count items grouped by a status field
 * @param items - Array of objects with a status-like field
 * @param key - The field name to group by (default: 'status')
 * @returns Record mapping each status value to its count
 */
export function countByField<T extends object>(
  items: T[],
  key: keyof T = 'status' as keyof T
): Record<string, number> {
  return items.reduce(
    (acc, item) => {
      const value = String(item[key] ?? 'unknown');
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}

// ============================================
// TEXT UTILITIES
// ============================================

/**
 * Truncate text to a maximum length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation (default: 50)
 * @param suffix - Suffix to append when truncated (default: '...')
 * @returns Truncated text with suffix, or original if shorter than maxLength
 */
export function truncateText(
  text: string | null | undefined,
  maxLength: number = 50,
  suffix: string = '...'
): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}
