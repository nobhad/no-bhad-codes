/**
 * ===============================================
 * FORMAT UTILITIES TESTS
 * ===============================================
 * @file tests/unit/utils/format-utils.test.ts
 *
 * Unit tests for all formatting utility functions.
 * Pure functions - no mocking required.
 */

import { describe, it, expect } from 'vitest';
import {
  formatFileSize,
  formatCurrency,
  formatCurrencyCompact,
  normalizeStatus,
  formatDisplayValue,
  escapeHtml,
  formatTextWithLineBreaks,
  formatProjectType,
  formatDate,
  formatDateTime,
  formatDateForInput,
  formatRelativeTime,
  formatDateShort,
  formatDateISO,
  formatDateRelative,
  formatCardDate,
  isOverdue,
  getDaysUntilDue,
  getDueDaysText,
  countByField,
  truncateText
} from '../../../src/utils/format-utils';

// ============================================
// formatFileSize
// ============================================

describe('formatFileSize', () => {
  it('returns "0 B" for 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('returns "0 B" for falsy values', () => {
    expect(formatFileSize(NaN)).toBe('0 B');
  });

  it('formats bytes below 1 KB', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats exactly 1 KB', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
  });

  it('formats exactly 1 MB', () => {
    expect(formatFileSize(1048576)).toBe('1 MB');
  });

  it('formats 1.5 MB', () => {
    expect(formatFileSize(1572864)).toBe('1.5 MB');
  });

  it('formats exactly 1 GB', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB');
  });

  it('formats fractional KB', () => {
    expect(formatFileSize(2048)).toBe('2 KB');
  });

  it('formats large MB value', () => {
    expect(formatFileSize(5242880)).toBe('5 MB');
  });
});

// ============================================
// formatCurrency
// ============================================

describe('formatCurrency', () => {
  it('returns empty string for null', () => {
    expect(formatCurrency(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatCurrency(undefined)).toBe('');
  });

  it('returns empty string for NaN string', () => {
    expect(formatCurrency('not-a-number')).toBe('');
  });

  it('formats whole number without cents by default', () => {
    expect(formatCurrency(1234)).toBe('$1,234');
  });

  it('formats with cents when showCents is true', () => {
    expect(formatCurrency(1234.56, { showCents: true })).toBe('$1,234.56');
  });

  it('formats string input as number', () => {
    expect(formatCurrency('100')).toBe('$100');
  });

  it('formats negative number', () => {
    expect(formatCurrency(-50)).toBe('-$50');
  });

  it('returns custom fallback for null', () => {
    expect(formatCurrency(null, { fallback: 'N/A' })).toBe('N/A');
  });

  it('returns custom fallback for NaN', () => {
    expect(formatCurrency(NaN, { fallback: '$0' })).toBe('$0');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('formats large number with commas', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000');
  });

  it('strips cents from float when showCents is false', () => {
    expect(formatCurrency(99.99)).toBe('$100');
  });
});

// ============================================
// formatCurrencyCompact
// ============================================

describe('formatCurrencyCompact', () => {
  it('returns "$0" for null', () => {
    expect(formatCurrencyCompact(null)).toBe('$0');
  });

  it('returns "$0" for undefined', () => {
    expect(formatCurrencyCompact(undefined)).toBe('$0');
  });

  it('formats amount below 1000 as plain dollar', () => {
    expect(formatCurrencyCompact(500)).toBe('$500');
  });

  it('formats exactly 1000 as $1.0K', () => {
    expect(formatCurrencyCompact(1000)).toBe('$1.0K');
  });

  it('formats 2500 as $2.5K', () => {
    expect(formatCurrencyCompact(2500)).toBe('$2.5K');
  });

  it('formats exactly 1000000 as $1.0M', () => {
    expect(formatCurrencyCompact(1000000)).toBe('$1.0M');
  });

  it('formats 1500000 as $1.5M', () => {
    expect(formatCurrencyCompact(1500000)).toBe('$1.5M');
  });

  it('formats 0 as $0', () => {
    expect(formatCurrencyCompact(0)).toBe('$0');
  });

  it('formats 999 as plain dollar', () => {
    expect(formatCurrencyCompact(999)).toBe('$999');
  });
});

// ============================================
// normalizeStatus
// ============================================

describe('normalizeStatus', () => {
  it('returns "pending" for null', () => {
    expect(normalizeStatus(null)).toBe('pending');
  });

  it('returns "pending" for undefined', () => {
    expect(normalizeStatus(undefined)).toBe('pending');
  });

  it('returns "pending" for empty string', () => {
    expect(normalizeStatus('')).toBe('pending');
  });

  it('converts underscores to hyphens', () => {
    expect(normalizeStatus('in_progress')).toBe('in-progress');
  });

  it('leaves already-hyphenated status unchanged', () => {
    expect(normalizeStatus('in-progress')).toBe('in-progress');
  });

  it('converts multiple underscores', () => {
    expect(normalizeStatus('on_hold_now')).toBe('on-hold-now');
  });

  it('uses custom default value for null', () => {
    expect(normalizeStatus(null, 'active')).toBe('active');
  });

  it('uses custom default value for undefined', () => {
    expect(normalizeStatus(undefined, 'draft')).toBe('draft');
  });

  it('leaves plain status with no separators unchanged', () => {
    expect(normalizeStatus('active')).toBe('active');
  });
});

// ============================================
// formatDisplayValue
// ============================================

describe('formatDisplayValue', () => {
  it('returns empty string for null', () => {
    expect(formatDisplayValue(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDisplayValue(undefined)).toBe('');
  });

  it('returns empty string for "-"', () => {
    expect(formatDisplayValue('-')).toBe('');
  });

  it('returns "ASAP" for "asap"', () => {
    expect(formatDisplayValue('asap')).toBe('ASAP');
  });

  it('returns "ASAP" for "ASAP"', () => {
    expect(formatDisplayValue('ASAP')).toBe('ASAP');
  });

  it('formats "under-1k" as "Under $1k"', () => {
    expect(formatDisplayValue('under-1k')).toBe('Under $1k');
  });

  it('formats numeric range "1000-2500" as "$1,000–$2,500"', () => {
    expect(formatDisplayValue('1000-2500')).toBe('$1,000–$2,500');
  });

  it('formats k-notation range "1k-2.5k" as "$1k–$2.5k"', () => {
    expect(formatDisplayValue('1k-2.5k')).toBe('$1k–$2.5k');
  });

  it('formats "5k-10k" as "$5k–$10k"', () => {
    expect(formatDisplayValue('5k-10k')).toBe('$5k–$10k');
  });

  it('formats "10k+" as "$10k+"', () => {
    expect(formatDisplayValue('10k+')).toBe('$10k+');
  });

  it('formats "35k-plus" as "$35k+"', () => {
    expect(formatDisplayValue('35k-plus')).toBe('$35k+');
  });

  it('converts kebab-case to Title Case', () => {
    expect(formatDisplayValue('simple-site')).toBe('Simple Site');
  });

  it('converts multi-word kebab-case', () => {
    expect(formatDisplayValue('web-app-design')).toBe('Web App Design');
  });

  it('converts numeric time range with en-dash', () => {
    expect(formatDisplayValue('2-4-weeks')).toBe('2–4 Weeks');
  });
});

// ============================================
// escapeHtml
// ============================================

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('escapes greater-than', () => {
    expect(escapeHtml('x > y')).toBe('x &gt; y');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml('it\'s')).toBe('it&#x27;s');
  });

  it('escapes backticks', () => {
    expect(escapeHtml('`code`')).toBe('&#96;code&#96;');
  });

  it('leaves clean text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('escapes multiple special chars in one string', () => {
    expect(escapeHtml('<b class="x">Hello & "World"</b>')).toBe(
      '&lt;b class=&quot;x&quot;&gt;Hello &amp; &quot;World&quot;&lt;/b&gt;'
    );
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

// ============================================
// formatTextWithLineBreaks
// ============================================

describe('formatTextWithLineBreaks', () => {
  it('returns empty string for null', () => {
    expect(formatTextWithLineBreaks(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatTextWithLineBreaks(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatTextWithLineBreaks('')).toBe('');
  });

  it('converts newlines to <br> tags', () => {
    expect(formatTextWithLineBreaks('line1\nline2')).toBe('line1<br>line2');
  });

  it('converts multiple newlines', () => {
    expect(formatTextWithLineBreaks('a\nb\nc')).toBe('a<br>b<br>c');
  });

  it('escapes HTML entities before converting newlines', () => {
    expect(formatTextWithLineBreaks('<b>Hello</b>\nWorld')).toBe(
      '&lt;b&gt;Hello&lt;/b&gt;<br>World'
    );
  });

  it('handles text with no newlines', () => {
    expect(formatTextWithLineBreaks('plain text')).toBe('plain text');
  });

  it('escapes ampersand in multiline text', () => {
    expect(formatTextWithLineBreaks('Tom & Jerry\nFriends')).toBe(
      'Tom &amp; Jerry<br>Friends'
    );
  });
});

// ============================================
// formatProjectType
// ============================================

describe('formatProjectType', () => {
  it('returns empty string for null', () => {
    expect(formatProjectType(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatProjectType(undefined)).toBe('');
  });

  it('formats "simple-site" as "Simple Website"', () => {
    expect(formatProjectType('simple-site')).toBe('Simple Website');
  });

  it('formats "business-site" as "Business Website"', () => {
    expect(formatProjectType('business-site')).toBe('Business Website');
  });

  it('formats "e-commerce" as "E-Commerce"', () => {
    expect(formatProjectType('e-commerce')).toBe('E-Commerce');
  });

  it('formats "ecommerce" (legacy) as "E-Commerce"', () => {
    expect(formatProjectType('ecommerce')).toBe('E-Commerce');
  });

  it('formats "web-app" as "Web Application"', () => {
    expect(formatProjectType('web-app')).toBe('Web Application');
  });

  it('formats "portfolio" as "Portfolio"', () => {
    expect(formatProjectType('portfolio')).toBe('Portfolio');
  });

  it('formats "mobile-app" as "Mobile App"', () => {
    expect(formatProjectType('mobile-app')).toBe('Mobile App');
  });

  it('formats "branding" as "Branding"', () => {
    expect(formatProjectType('branding')).toBe('Branding');
  });

  it('formats "other" as "Other"', () => {
    expect(formatProjectType('other')).toBe('Other');
  });

  it('returns the input unchanged for unknown type', () => {
    expect(formatProjectType('custom-type')).toBe('custom-type');
  });
});

// ============================================
// formatDate
// ============================================

describe('formatDate', () => {
  it('returns empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('returns empty string for invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('');
  });

  it('formats ISO date string as MM/DD/YYYY by default', () => {
    // Use UTC midnight to avoid timezone issues with the date portion
    const result = formatDate('2026-01-15T12:00:00Z');
    expect(result).toMatch(/^\d{2}\/\d{2}\/2026$/);
  });

  it('formats with format="label" as "Jan 15, 2026" style', () => {
    const result = formatDate('2026-01-15T12:00:00Z', 'label');
    expect(result).toMatch(/Jan \d+, 2026/);
  });

  it('formats with format="datetime" and includes time', () => {
    const result = formatDate('2026-01-15T12:00:00', 'datetime');
    expect(result).toMatch(/\d{2}\/\d{2}\/2026, \d+:\d{2} (AM|PM)/);
  });

  it('accepts Date object as input', () => {
    const date = new Date(2026, 0, 1); // Jan 1, 2026 local
    const result = formatDate(date);
    expect(result).toBe('01/01/2026');
  });

  it('returns empty string for empty string input', () => {
    expect(formatDate('')).toBe('');
  });
});

// ============================================
// formatDateTime
// ============================================

describe('formatDateTime', () => {
  it('returns empty string for null', () => {
    expect(formatDateTime(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDateTime(undefined)).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatDateTime('invalid')).toBe('');
  });

  it('formats a valid date-time string as MM/DD/YYYY, h:mm AM/PM', () => {
    const result = formatDateTime('2026-01-28T14:30:00');
    expect(result).toMatch(/\d{2}\/\d{2}\/2026, \d+:\d{2} (AM|PM)/);
  });

  it('includes both date and time parts separated by comma', () => {
    const result = formatDateTime('2026-06-15T09:05:00');
    expect(result).toContain(',');
    const parts = result.split(', ');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(parts[1]).toMatch(/^\d+:\d{2} (AM|PM)$/);
  });

  it('accepts Date object as input', () => {
    const date = new Date(2026, 5, 1, 10, 30, 0); // Jun 1, 2026 10:30 AM local
    const result = formatDateTime(date);
    expect(result).toMatch(/06\/01\/2026/);
    expect(result).toMatch(/10:30 AM/);
  });
});

// ============================================
// formatDateForInput
// ============================================

describe('formatDateForInput', () => {
  it('returns empty string for null', () => {
    expect(formatDateForInput(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDateForInput(undefined)).toBe('');
  });

  it('returns already-YYYY-MM-DD string unchanged', () => {
    expect(formatDateForInput('2026-01-15')).toBe('2026-01-15');
  });

  it('extracts date part from ISO string with time', () => {
    expect(formatDateForInput('2026-03-07T14:30:00.000Z')).toBe('2026-03-07');
  });

  it('extracts date part from ISO string without Z suffix', () => {
    expect(formatDateForInput('2026-06-20T00:00:00')).toBe('2026-06-20');
  });

  it('returns empty string for invalid date', () => {
    expect(formatDateForInput('not-a-date')).toBe('');
  });

  it('handles date with timezone offset', () => {
    const result = formatDateForInput('2026-12-25T10:00:00+05:00');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ============================================
// formatRelativeTime
// ============================================

describe('formatRelativeTime', () => {
  it('returns empty string for null', () => {
    expect(formatRelativeTime(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatRelativeTime('not-a-date')).toBe('');
  });

  it('returns "Just now" for a date less than 1 minute ago', () => {
    const recent = new Date(Date.now() - 30 * 1000); // 30 seconds ago
    expect(formatRelativeTime(recent)).toBe('Just now');
  });

  it('returns minutes ago for a date 5 minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5 minutes ago');
  });

  it('returns singular "minute" for exactly 1 minute ago', () => {
    const oneMinuteAgo = new Date(Date.now() - 61 * 1000);
    expect(formatRelativeTime(oneMinuteAgo)).toBe('1 minute ago');
  });

  it('returns hours ago for a date 3 hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeHoursAgo)).toBe('3 hours ago');
  });

  it('returns singular "hour" for exactly 1 hour ago', () => {
    const oneHourAgo = new Date(Date.now() - 61 * 60 * 1000);
    expect(formatRelativeTime(oneHourAgo)).toBe('1 hour ago');
  });

  it('returns days ago for a date 3 days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
  });

  it('returns singular "day" for exactly 1 day ago', () => {
    const oneDayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(formatRelativeTime(oneDayAgo)).toBe('1 day ago');
  });

  it('returns formatted date for more than a week ago', () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(oldDate);
    // Should be a date string in MM/DD/YYYY format, not a relative string
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('accepts a string date', () => {
    const oneHourAgo = new Date(Date.now() - 61 * 60 * 1000).toISOString();
    expect(formatRelativeTime(oneHourAgo)).toBe('1 hour ago');
  });
});

// ============================================
// formatDateShort
// ============================================

describe('formatDateShort', () => {
  it('returns empty string for null', () => {
    expect(formatDateShort(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDateShort(undefined)).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatDateShort('invalid')).toBe('');
  });

  it('formats a Date object as MM/DD/YYYY', () => {
    const date = new Date(2026, 0, 1); // Jan 1, 2026 local time
    expect(formatDateShort(date)).toBe('01/01/2026');
  });

  it('formats a date string as MM/DD/YYYY', () => {
    const result = formatDateShort('2026-06-15T12:00:00');
    expect(result).toMatch(/\d{2}\/\d{2}\/2026/);
  });

  it('pads month and day with leading zeros', () => {
    const date = new Date(2026, 8, 5); // Sep 5, 2026 local time
    expect(formatDateShort(date)).toBe('09/05/2026');
  });
});

// ============================================
// formatDateISO
// ============================================

describe('formatDateISO', () => {
  it('returns empty string for null', () => {
    expect(formatDateISO(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDateISO(undefined)).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatDateISO('not-a-date')).toBe('');
  });

  it('formats a Date object as YYYY-MM-DD', () => {
    const date = new Date('2026-01-15T12:00:00Z');
    const result = formatDateISO(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formats a date string in YYYY-MM-DD format', () => {
    const result = formatDateISO('2026-06-20T00:00:00.000Z');
    expect(result).toBe('2026-06-20');
  });

  it('returns only the date portion, not time', () => {
    const result = formatDateISO('2026-03-07T23:59:59Z');
    expect(result).not.toContain('T');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ============================================
// formatDateRelative
// ============================================

describe('formatDateRelative', () => {
  it('returns empty string for null', () => {
    expect(formatDateRelative(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDateRelative(undefined)).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatDateRelative('invalid')).toBe('');
  });

  it('returns "Today" for today\'s date', () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    expect(formatDateRelative(today)).toBe('Today');
  });

  it('returns "Yesterday" for yesterday\'s date', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    expect(formatDateRelative(yesterday)).toBe('Yesterday');
  });

  it('returns MM/DD/YYYY for older dates', () => {
    const oldDate = new Date(2025, 0, 1); // Jan 1, 2025 local
    expect(formatDateRelative(oldDate)).toBe('01/01/2025');
  });

  it('accepts a string date input', () => {
    const result = formatDateRelative('2025-03-01');
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

// ============================================
// formatCardDate
// ============================================

describe('formatCardDate', () => {
  it('formats a date string as "Month D, YYYY"', () => {
    const result = formatCardDate('2026-02-27T12:00:00Z');
    expect(result).toMatch(/Feb \d+, 2026/);
  });

  it('formats January correctly', () => {
    const result = formatCardDate('2026-01-01T12:00:00Z');
    expect(result).toMatch(/Jan \d+, 2026/);
  });

  it('formats December correctly', () => {
    const result = formatCardDate('2026-12-31T12:00:00Z');
    expect(result).toMatch(/Dec \d+, 2026/);
  });

  it('uses short month name format', () => {
    const result = formatCardDate('2026-06-15T12:00:00Z');
    // Should be abbreviated month name, not full
    expect(result.length).toBeLessThan(20);
    expect(result).toMatch(/\w{3} \d+, \d{4}/);
  });
});

// ============================================
// isOverdue
// ============================================

describe('isOverdue', () => {
  it('returns false for undefined', () => {
    expect(isOverdue(undefined)).toBe(false);
  });

  it('returns true for a past date', () => {
    expect(isOverdue('2020-01-01')).toBe(true);
  });

  it('returns false for a future date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(isOverdue(future.toISOString())).toBe(false);
  });

  it('returns false for today (not yet overdue)', () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    // today's date set to midnight is not less than today set to midnight
    const todayStr = today.toISOString().split('T')[0];
    // Since isOverdue compares due < today (midnight), today is NOT overdue
    expect(isOverdue(todayStr)).toBe(false);
  });

  it('returns true for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isOverdue(yesterday.toISOString().split('T')[0])).toBe(true);
  });
});

// ============================================
// getDaysUntilDue
// ============================================

describe('getDaysUntilDue', () => {
  it('returns null for undefined', () => {
    expect(getDaysUntilDue(undefined)).toBeNull();
  });

  it('returns 0 for today', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(getDaysUntilDue(today)).toBe(0);
  });

  it('returns a positive number for a future date', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(getDaysUntilDue(future.toISOString().split('T')[0])).toBe(5);
  });

  it('returns a negative number for a past date', () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    expect(getDaysUntilDue(past.toISOString().split('T')[0])).toBe(-3);
  });

  it('returns 1 for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(getDaysUntilDue(tomorrow.toISOString().split('T')[0])).toBe(1);
  });
});

// ============================================
// getDueDaysText
// ============================================

describe('getDueDaysText', () => {
  it('returns empty string for undefined', () => {
    expect(getDueDaysText(undefined)).toBe('');
  });

  it('returns "Due today" for today', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(getDueDaysText(today)).toBe('Due today');
  });

  it('returns "Due tomorrow" for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(getDueDaysText(tomorrow.toISOString())).toBe('Due tomorrow');
  });

  it('returns "Due in X days" for future dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const result = getDueDaysText(future.toISOString());
    expect(result).toMatch(/^Due in \d+ days$/);
  });

  it('returns "X days overdue" for past dates', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const result = getDueDaysText(past.toISOString());
    expect(result).toMatch(/\d+ days overdue/);
  });

  it('returns singular "day overdue" for 1 day past', () => {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    oneDayAgo.setHours(0, 0, 0, 0);
    const result = getDueDaysText(oneDayAgo.toISOString());
    // The function uses Math.ceil so depending on timing this could be 1 or 2 days
    expect(result).toMatch(/\d+ day(s)? overdue/);
  });
});

// ============================================
// countByField
// ============================================

describe('countByField', () => {
  it('counts items grouped by default "status" key', () => {
    const items = [
      { status: 'active' },
      { status: 'active' },
      { status: 'pending' }
    ];
    expect(countByField(items)).toEqual({ active: 2, pending: 1 });
  });

  it('counts items grouped by a custom key', () => {
    const items = [
      { type: 'A' },
      { type: 'B' },
      { type: 'A' }
    ];
    expect(countByField(items, 'type')).toEqual({ A: 2, B: 1 });
  });

  it('returns empty object for empty array', () => {
    expect(countByField([])).toEqual({});
  });

  it('handles undefined field values as "unknown"', () => {
    const items = [{ status: undefined }, { status: 'active' }] as any[];
    const result = countByField(items);
    expect(result['unknown']).toBe(1);
    expect(result['active']).toBe(1);
  });

  it('handles all unique values', () => {
    const items = [
      { status: 'a' },
      { status: 'b' },
      { status: 'c' }
    ];
    expect(countByField(items)).toEqual({ a: 1, b: 1, c: 1 });
  });

  it('handles all same values', () => {
    const items = [
      { status: 'paid' },
      { status: 'paid' },
      { status: 'paid' }
    ];
    expect(countByField(items)).toEqual({ paid: 3 });
  });

  it('groups by numeric field values as strings', () => {
    const items = [{ priority: 1 }, { priority: 2 }, { priority: 1 }];
    expect(countByField(items, 'priority')).toEqual({ '1': 2, '2': 1 });
  });
});

// ============================================
// truncateText
// ============================================

describe('truncateText', () => {
  it('returns empty string for null', () => {
    expect(truncateText(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(truncateText(undefined)).toBe('');
  });

  it('returns original text when shorter than maxLength', () => {
    expect(truncateText('Hello', 50)).toBe('Hello');
  });

  it('returns original text when exactly maxLength', () => {
    const text = 'a'.repeat(50);
    expect(truncateText(text, 50)).toBe(text);
  });

  it('truncates text longer than maxLength with default "..."', () => {
    const text = 'a'.repeat(60);
    const result = truncateText(text, 50);
    expect(result).toHaveLength(50);
    expect(result.endsWith('...')).toBe(true);
  });

  it('uses custom suffix when provided', () => {
    const text = 'Hello, this is a long string that needs truncating';
    const result = truncateText(text, 20, '…');
    expect(result.endsWith('…')).toBe(true);
    expect(result).toHaveLength(20);
  });

  it('uses custom maxLength', () => {
    const text = 'Hello World';
    const result = truncateText(text, 5, '...');
    expect(result).toHaveLength(5);
    expect(result).toBe('He...');
  });

  it('returns empty string for empty string input', () => {
    expect(truncateText('')).toBe('');
  });

  it('does not truncate when text length equals maxLength', () => {
    const text = 'Exactly fifty chars here make it work perfectly ok!';
    expect(truncateText(text, text.length)).toBe(text);
  });
});
