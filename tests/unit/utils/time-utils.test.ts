/**
 * ===============================================
 * TIME UTILS TESTS
 * ===============================================
 * @file tests/unit/utils/time-utils.test.ts
 *
 * Unit tests for time constants and formatting utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  MS_PER_WEEK,
  POLL_INTERVAL_DEFAULT,
  URL_REVOKE_DELAY,
  AUTOSAVE_INTERVAL,
  TOAST_DURATION,
  SEARCH_DEBOUNCE,
  formatTimeAgo,
  formatTimeAgoFull,
  formatDuration,
  isToday,
  isPast
} from '../../../src/utils/time-utils';

// ============================================
// Time Constants
// ============================================

describe('Time constants', () => {
  it('MS_PER_SECOND is 1000', () => {
    expect(MS_PER_SECOND).toBe(1000);
  });

  it('MS_PER_MINUTE is 60000', () => {
    expect(MS_PER_MINUTE).toBe(60000);
  });

  it('MS_PER_HOUR is 3600000', () => {
    expect(MS_PER_HOUR).toBe(3600000);
  });

  it('MS_PER_DAY is 86400000', () => {
    expect(MS_PER_DAY).toBe(86400000);
  });

  it('MS_PER_WEEK is 604800000', () => {
    expect(MS_PER_WEEK).toBe(604800000);
  });

  it('POLL_INTERVAL_DEFAULT equals MS_PER_MINUTE (60000)', () => {
    expect(POLL_INTERVAL_DEFAULT).toBe(60000);
  });

  it('URL_REVOKE_DELAY equals MS_PER_MINUTE (60000)', () => {
    expect(URL_REVOKE_DELAY).toBe(60000);
  });

  it('AUTOSAVE_INTERVAL is 30000', () => {
    expect(AUTOSAVE_INTERVAL).toBe(30000);
  });

  it('TOAST_DURATION is 3000', () => {
    expect(TOAST_DURATION).toBe(3000);
  });

  it('SEARCH_DEBOUNCE is 300', () => {
    expect(SEARCH_DEBOUNCE).toBe(300);
  });
});

// ============================================
// formatTimeAgo
// ============================================

describe('formatTimeAgo', () => {
  it('returns "Just now" for a date 30 seconds ago', () => {
    const date = new Date(Date.now() - 30 * MS_PER_SECOND);
    expect(formatTimeAgo(date)).toBe('Just now');
  });

  it('returns "Xm ago" for a date 30 minutes ago', () => {
    const date = new Date(Date.now() - 30 * MS_PER_MINUTE);
    expect(formatTimeAgo(date)).toBe('30m ago');
  });

  it('returns "Xh ago" for a date 2 hours ago', () => {
    const date = new Date(Date.now() - 2 * MS_PER_HOUR);
    expect(formatTimeAgo(date)).toBe('2h ago');
  });

  it('returns "Xd ago" for a date 3 days ago', () => {
    const date = new Date(Date.now() - 3 * MS_PER_DAY);
    expect(formatTimeAgo(date)).toBe('3d ago');
  });

  it('returns a date string (not relative) for a date 14 days ago', () => {
    const date = new Date(Date.now() - 14 * MS_PER_DAY);
    const result = formatTimeAgo(date);
    // Should not be a relative "ago" format
    expect(result).not.toMatch(/ago$/);
    // Should be a locale date string produced by toLocaleDateString()
    expect(result.length).toBeGreaterThan(0);
  });

  it('accepts a Date object', () => {
    const date = new Date(Date.now() - 5 * MS_PER_MINUTE);
    expect(formatTimeAgo(date)).toBe('5m ago');
  });

  it('accepts a string date', () => {
    const date = new Date(Date.now() - 5 * MS_PER_MINUTE);
    expect(formatTimeAgo(date.toISOString())).toBe('5m ago');
  });

  it('returns "Just now" for exactly 0 minutes difference', () => {
    const date = new Date(Date.now() - 30 * 1000); // 30 seconds = 0 full minutes
    expect(formatTimeAgo(date)).toBe('Just now');
  });
});

// ============================================
// formatTimeAgoFull
// ============================================

describe('formatTimeAgoFull', () => {
  it('returns "Just now" for a date 30 seconds ago', () => {
    const date = new Date(Date.now() - 30 * MS_PER_SECOND);
    expect(formatTimeAgoFull(date)).toBe('Just now');
  });

  it('returns "1 minute ago" for exactly 1 minute ago', () => {
    const date = new Date(Date.now() - 1 * MS_PER_MINUTE - 1000);
    expect(formatTimeAgoFull(date)).toBe('1 minute ago');
  });

  it('returns "30 minutes ago" for 30 minutes ago', () => {
    const date = new Date(Date.now() - 30 * MS_PER_MINUTE);
    expect(formatTimeAgoFull(date)).toBe('30 minutes ago');
  });

  it('returns "1 hour ago" for exactly 1 hour ago', () => {
    const date = new Date(Date.now() - 1 * MS_PER_HOUR - 1000);
    expect(formatTimeAgoFull(date)).toBe('1 hour ago');
  });

  it('returns "5 hours ago" for 5 hours ago', () => {
    const date = new Date(Date.now() - 5 * MS_PER_HOUR);
    expect(formatTimeAgoFull(date)).toBe('5 hours ago');
  });

  it('returns "Yesterday" for exactly 1 day ago', () => {
    const date = new Date(Date.now() - 1 * MS_PER_DAY - 1000);
    expect(formatTimeAgoFull(date)).toBe('Yesterday');
  });

  it('returns "X days ago" for 5 days ago', () => {
    const date = new Date(Date.now() - 5 * MS_PER_DAY);
    expect(formatTimeAgoFull(date)).toBe('5 days ago');
  });

  it('returns "2 weeks ago" for 14 days ago', () => {
    const date = new Date(Date.now() - 14 * MS_PER_DAY);
    expect(formatTimeAgoFull(date)).toBe('2 weeks ago');
  });

  it('returns a locale date string for dates 35+ days ago', () => {
    const date = new Date(Date.now() - 35 * MS_PER_DAY);
    const result = formatTimeAgoFull(date);
    // Not a relative format
    expect(result).not.toMatch(/ago$/);
    expect(result.length).toBeGreaterThan(0);
  });

  it('accepts a string date', () => {
    const date = new Date(Date.now() - 2 * MS_PER_HOUR);
    expect(formatTimeAgoFull(date.toISOString())).toBe('2 hours ago');
  });

  it('accepts a Date object', () => {
    const date = new Date(Date.now() - 10 * MS_PER_MINUTE);
    expect(formatTimeAgoFull(date)).toBe('10 minutes ago');
  });
});

// ============================================
// formatDuration
// ============================================

describe('formatDuration', () => {
  it('returns "0s" for 0 ms', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('returns "30s" for 30000 ms', () => {
    expect(formatDuration(30000)).toBe('30s');
  });

  it('returns "1m 30s" for 90000 ms', () => {
    expect(formatDuration(90000)).toBe('1m 30s');
  });

  it('returns "60m 0s" for 3600000 ms (1 hour expressed as minutes)', () => {
    expect(formatDuration(3600000)).toBe('60m 0s');
  });

  it('returns "2m 0s" for exactly 2 minutes', () => {
    expect(formatDuration(2 * MS_PER_MINUTE)).toBe('2m 0s');
  });

  it('returns "0s" for less than 1 second', () => {
    expect(formatDuration(500)).toBe('0s');
  });
});

// ============================================
// isToday
// ============================================

describe('isToday', () => {
  it('returns true for today\'s date', () => {
    expect(isToday(new Date())).toBe(true);
  });

  it('returns false for yesterday', () => {
    const yesterday = new Date(Date.now() - MS_PER_DAY);
    expect(isToday(yesterday)).toBe(false);
  });

  it('returns false for tomorrow', () => {
    const tomorrow = new Date(Date.now() + MS_PER_DAY);
    expect(isToday(tomorrow)).toBe(false);
  });

  it('accepts a string date for today', () => {
    const todayString = new Date().toISOString();
    expect(isToday(todayString)).toBe(true);
  });

  it('accepts a Date object', () => {
    expect(isToday(new Date())).toBe(true);
  });

  it('returns false for a date one year ago', () => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    expect(isToday(oneYearAgo)).toBe(false);
  });
});

// ============================================
// isPast
// ============================================

describe('isPast', () => {
  it('returns true for yesterday', () => {
    const yesterday = new Date(Date.now() - MS_PER_DAY);
    expect(isPast(yesterday)).toBe(true);
  });

  it('returns false for tomorrow', () => {
    const tomorrow = new Date(Date.now() + MS_PER_DAY);
    expect(isPast(tomorrow)).toBe(false);
  });

  it('returns true for a date 1 year ago', () => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    expect(isPast(oneYearAgo)).toBe(true);
  });

  it('accepts a string date in the past', () => {
    const yesterday = new Date(Date.now() - MS_PER_DAY);
    expect(isPast(yesterday.toISOString())).toBe(true);
  });

  it('accepts a string date in the future', () => {
    const tomorrow = new Date(Date.now() + MS_PER_DAY);
    expect(isPast(tomorrow.toISOString())).toBe(false);
  });

  it('accepts a Date object', () => {
    const past = new Date(Date.now() - 1000);
    expect(isPast(past)).toBe(true);
  });
});
