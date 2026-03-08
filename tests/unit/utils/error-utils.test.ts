/**
 * ===============================================
 * ERROR UTILITIES TESTS
 * ===============================================
 * @file tests/unit/utils/error-utils.test.ts
 *
 * Full coverage for src/utils/error-utils.ts.
 * Covers every exported function across all branches.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getTableErrorRow,
  getContainerErrorHTML,
  getInlineErrorHTML,
  showTableError,
  showContainerError,
  createErrorNotification,
  formatErrorMessage
} from '../../../src/utils/error-utils';

// ---------------------------------------------------------------------------
// Mock SanitizationUtils — simply returns the input so HTML assertions
// match exactly the value passed in (real sanitization is tested separately).
// ---------------------------------------------------------------------------
vi.mock('../../../src/utils/sanitization-utils', () => ({
  SanitizationUtils: {
    escapeHtml: vi.fn((input: string) => input ?? '')
  }
}));

// ---------------------------------------------------------------------------
// getTableErrorRow
// ---------------------------------------------------------------------------
describe('getTableErrorRow', () => {
  it('renders a <tr> with the correct colspan', () => {
    const html = getTableErrorRow(5, { message: 'Load failed' });
    expect(html).toContain('colspan="5"');
  });

  it('includes the error message text', () => {
    const html = getTableErrorRow(3, { message: 'Something went wrong' });
    expect(html).toContain('Something went wrong');
  });

  it('includes error-row class on <td>', () => {
    const html = getTableErrorRow(3, { message: 'Err' });
    expect(html).toContain('class="error-row"');
  });

  it('includes warning icon by default (showIcon defaults to true)', () => {
    const html = getTableErrorRow(3, { message: 'Err' });
    expect(html).toContain('error-icon');
    expect(html).toContain('⚠');
  });

  it('omits icon when showIcon is false', () => {
    const html = getTableErrorRow(3, { message: 'Err', showIcon: false });
    expect(html).not.toContain('error-icon');
  });

  it('includes retry button when onRetry is provided', () => {
    const html = getTableErrorRow(3, { message: 'Err', onRetry: vi.fn() });
    expect(html).toContain('btn-retry');
    expect(html).toContain('Try Again');
  });

  it('uses custom retryLabel when provided', () => {
    const html = getTableErrorRow(3, { message: 'Err', onRetry: vi.fn(), retryLabel: 'Reload' });
    expect(html).toContain('Reload');
    expect(html).not.toContain('Try Again');
  });

  it('omits retry button when onRetry is not provided', () => {
    const html = getTableErrorRow(3, { message: 'Err' });
    expect(html).not.toContain('btn-retry');
  });

  it('renders colspan="1" when colspan is 1', () => {
    const html = getTableErrorRow(1, { message: 'Err' });
    expect(html).toContain('colspan="1"');
  });
});

// ---------------------------------------------------------------------------
// getContainerErrorHTML
// ---------------------------------------------------------------------------
describe('getContainerErrorHTML', () => {
  it('wraps output in a div with error-container class', () => {
    const html = getContainerErrorHTML({ message: 'Oops' });
    expect(html).toContain('class="error-container"');
  });

  it('has role="alert" for accessibility', () => {
    const html = getContainerErrorHTML({ message: 'Oops' });
    expect(html).toContain('role="alert"');
  });

  it('includes the error message', () => {
    const html = getContainerErrorHTML({ message: 'Network down' });
    expect(html).toContain('Network down');
  });

  it('includes large icon by default', () => {
    const html = getContainerErrorHTML({ message: 'Err' });
    expect(html).toContain('error-icon--large');
  });

  it('omits icon when showIcon is false', () => {
    const html = getContainerErrorHTML({ message: 'Err', showIcon: false });
    expect(html).not.toContain('error-icon--large');
  });

  it('includes retry button when onRetry is provided', () => {
    const html = getContainerErrorHTML({ message: 'Err', onRetry: vi.fn() });
    expect(html).toContain('btn-retry');
    expect(html).toContain('Try Again');
  });

  it('uses custom retryLabel', () => {
    const html = getContainerErrorHTML({ message: 'Err', onRetry: vi.fn(), retryLabel: 'Retry now' });
    expect(html).toContain('Retry now');
  });

  it('omits retry button when onRetry is absent', () => {
    const html = getContainerErrorHTML({ message: 'Err' });
    expect(html).not.toContain('btn-retry');
  });
});

// ---------------------------------------------------------------------------
// getInlineErrorHTML
// ---------------------------------------------------------------------------
describe('getInlineErrorHTML', () => {
  it('wraps the message in a span with class error-inline', () => {
    const html = getInlineErrorHTML('Field is required');
    expect(html).toContain('class="error-inline"');
    expect(html).toContain('Field is required');
  });

  it('has role="alert" for accessibility', () => {
    const html = getInlineErrorHTML('Bad input');
    expect(html).toContain('role="alert"');
  });

  it('sanitizes the message via escapeHtml', async () => {
    // The mock returns the input unchanged — we just verify escapeHtml is called.
    const { SanitizationUtils } = vi.mocked(
      await import('../../../src/utils/sanitization-utils')
    );
    getInlineErrorHTML('test message');
    expect(SanitizationUtils.escapeHtml).toHaveBeenCalledWith('test message');
  });
});

// ---------------------------------------------------------------------------
// showTableError
// ---------------------------------------------------------------------------
describe('showTableError', () => {
  let tableBody: HTMLElement;

  beforeEach(() => {
    tableBody = document.createElement('tbody');
    document.body.appendChild(tableBody);
  });

  afterEach(() => {
    document.body.removeChild(tableBody);
  });

  it('sets innerHTML of the table body element', () => {
    showTableError(tableBody, 4, 'Fetch error');
    expect(tableBody.innerHTML).toContain('Fetch error');
  });

  it('includes the correct colspan', () => {
    showTableError(tableBody, 6, 'Error');
    expect(tableBody.innerHTML).toContain('colspan="6"');
  });

  it('wires up click listener on retry button when onRetry provided', () => {
    const onRetry = vi.fn();
    showTableError(tableBody, 3, 'Error', onRetry);

    const btn = tableBody.querySelector('.btn-retry') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not crash and has no retry button when onRetry is omitted', () => {
    showTableError(tableBody, 3, 'Error');
    const btn = tableBody.querySelector('.btn-retry');
    expect(btn).toBeNull();
  });

  it('allows multiple clicks on the retry button', () => {
    const onRetry = vi.fn();
    showTableError(tableBody, 3, 'Error', onRetry);
    const btn = tableBody.querySelector('.btn-retry') as HTMLButtonElement;
    btn.click();
    btn.click();
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// showContainerError
// ---------------------------------------------------------------------------
describe('showContainerError', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('sets innerHTML of the container element', () => {
    showContainerError(container, 'Something failed');
    expect(container.innerHTML).toContain('Something failed');
  });

  it('includes error-container class', () => {
    showContainerError(container, 'Err');
    expect(container.innerHTML).toContain('error-container');
  });

  it('wires up retry button click listener', () => {
    const onRetry = vi.fn();
    showContainerError(container, 'Error', onRetry);

    const btn = container.querySelector('.btn-retry') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('no retry button when onRetry is omitted', () => {
    showContainerError(container, 'Error');
    expect(container.querySelector('.btn-retry')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createErrorNotification
// ---------------------------------------------------------------------------
describe('createErrorNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Clean up any notifications appended to body during tests
    document.querySelectorAll('.error-notification').forEach((el) => el.remove());
  });

  it('returns an HTMLElement with class error-notification', () => {
    const el = createErrorNotification('Something broke');
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.className).toBe('error-notification');
  });

  it('has role="alert"', () => {
    const el = createErrorNotification('Error');
    expect(el.getAttribute('role')).toBe('alert');
  });

  it('contains the error message', () => {
    const el = createErrorNotification('Connection timeout');
    expect(el.innerHTML).toContain('Connection timeout');
  });

  it('contains a dismiss button', () => {
    const el = createErrorNotification('Err');
    const dismissBtn = el.querySelector('.error-dismiss');
    expect(dismissBtn).not.toBeNull();
  });

  it('clicking dismiss button removes the element from the DOM', () => {
    const el = createErrorNotification('Err');
    document.body.appendChild(el);

    const dismissBtn = el.querySelector('.error-dismiss') as HTMLButtonElement;
    dismissBtn.click();

    expect(document.body.contains(el)).toBe(false);
  });

  it('auto-removes after the specified duration', () => {
    const el = createErrorNotification('Err', 3000);
    document.body.appendChild(el);

    vi.advanceTimersByTime(3000);

    expect(document.body.contains(el)).toBe(false);
  });

  it('uses default duration of 5000 ms', () => {
    const el = createErrorNotification('Err');
    document.body.appendChild(el);

    vi.advanceTimersByTime(4999);
    expect(document.body.contains(el)).toBe(true);

    vi.advanceTimersByTime(1);
    expect(document.body.contains(el)).toBe(false);
  });

  it('does NOT auto-remove when duration is 0', () => {
    const el = createErrorNotification('Err', 0);
    document.body.appendChild(el);

    vi.advanceTimersByTime(60000);
    expect(document.body.contains(el)).toBe(true);
  });

  it('contains the warning icon', () => {
    const el = createErrorNotification('Err');
    expect(el.innerHTML).toContain('⚠');
  });
});

// ---------------------------------------------------------------------------
// formatErrorMessage
// ---------------------------------------------------------------------------
describe('formatErrorMessage', () => {
  it('returns string input as-is', () => {
    expect(formatErrorMessage('plain string error')).toBe('plain string error');
  });

  it('returns message property of an Error instance', () => {
    const err = new Error('something went wrong');
    expect(formatErrorMessage(err)).toBe('something went wrong');
  });

  it('returns message property from plain error object', () => {
    const obj = { message: 'Custom object error' };
    expect(formatErrorMessage(obj)).toBe('Custom object error');
  });

  it('returns error property when message is absent from plain object', () => {
    const obj = { error: 'Error string field' };
    expect(formatErrorMessage(obj)).toBe('Error string field');
  });

  it('returns default fallback for unrecognised error shapes', () => {
    expect(formatErrorMessage(42)).toBe('An error occurred');
  });

  it('returns default fallback for null', () => {
    expect(formatErrorMessage(null)).toBe('An error occurred');
  });

  it('returns default fallback for undefined', () => {
    expect(formatErrorMessage(undefined)).toBe('An error occurred');
  });

  it('uses custom fallback message when provided', () => {
    expect(formatErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
  });

  it('prefers message over error in plain objects', () => {
    const obj = { message: 'message field', error: 'error field' };
    expect(formatErrorMessage(obj)).toBe('message field');
  });

  it('returns fallback for plain object with non-string message', () => {
    const obj = { message: 123 };
    expect(formatErrorMessage(obj)).toBe('An error occurred');
  });

  it('returns error string field when message is non-string', () => {
    const obj = { message: 99, error: 'error text' };
    expect(formatErrorMessage(obj)).toBe('error text');
  });

  it('returns empty string error as-is', () => {
    expect(formatErrorMessage('')).toBe('');
  });
});
