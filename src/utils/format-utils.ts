/**
 * ===============================================
 * FORMAT UTILITIES
 * ===============================================
 * @file src/utils/format-utils.ts
 *
 * Shared formatting functions used across admin and client portals.
 */

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
 * @param amount - Number to format
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount || 0);
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
function escapeHtml(text: string): string {
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
  if (!text) return '-';
  // Escape HTML first to prevent XSS, then convert newlines to <br>
  return escapeHtml(text).replace(/\n/g, '<br>');
}

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Format date for display (e.g., "Jan 28, 2026")
 * Uses consistent formatting across the application
 * @param dateString - ISO date string or Date object
 * @returns Formatted date string
 */
export function formatDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return '-';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return '-';
  }
}

/**
 * Format date and time for display (e.g., "Jan 28, 2026, 2:30 PM")
 * @param dateString - ISO date string or Date object
 * @returns Formatted date and time string
 */
export function formatDateTime(dateString: string | Date | undefined | null): string {
  if (!dateString) return '-';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '-';

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '-';
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
  if (!dateString) return '-';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '-';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    // More than a week, show actual date
    return formatDate(date);
  } catch {
    return '-';
  }
}
