/**
 * ===============================================
 * ARROW COPY TESTS
 * ===============================================
 * @file tests/unit/constants/arrow-copy.test.ts
 *
 * Arrow's wording is the only form feedback a visitor gets — the raw service
 * strings are logged, not shown — so the mapping from validator output to what
 * she says is load-bearing UI, not decoration.
 */

import { describe, it, expect } from 'vitest';
import {
  ARROW_SUCCESS,
  ARROW_SIZE_STEPS,
  arrowSayValidation,
  arrowSayFailure
} from '../../../src/constants/arrow-copy';

describe('arrowSayValidation', () => {
  it('gives the full instruction when only one thing is wrong', () => {
    expect(arrowSayValidation(['Name is required'])).toBe(
      'Add your name for me and we’re good.'
    );
  });

  it('does not tell someone with an untouched form that they are almost there', () => {
    const said = arrowSayValidation([
      'Name is required',
      'Email is required',
      'Message is required'
    ]);
    // Every required field empty is a form that has not been STARTED, not one
    // that is nearly done. "Almost there!" on a blank form reads as a joke at
    // the visitor's expense.
    expect(said).not.toContain('Almost there');
    expect(said).toBe('Nothing to send yet — give me your name, an email, and a message.');
  });

  it('strings several problems into one action-first sentence', () => {
    // Two of three, so the form HAS been started — "almost there" is true here.
    const said = arrowSayValidation(['Email is required', 'Message is required']);
    expect(said).toBe('Almost there! Add your email, and write me a message.');
  });

  it('never gives two contradictory instructions for the same field', () => {
    // "write me a message" + "trim that message down" in one breath.
    const said = arrowSayValidation([
      'Message is required',
      'Message must be at least 10 characters long',
      'Input too long. Please shorten your message.'
    ]);
    expect(said).toBe('Tell me what you’re after in the message box.');
    expect(said).not.toContain('trim');
  });

  it('keeps the more fundamental problem when a field has several', () => {
    const said = arrowSayValidation(['Message must be at least 10 characters long', 'Input too long']);
    expect(said).toBe('Use a few more words and I’ll take it.');
  });

  it('still collapses per field when several fields are wrong', () => {
    const said = arrowSayValidation([
      'Name is required',
      'Message is required',
      'Message must be at least 10 characters long'
    ]);
    expect(said).toBe('Almost there! Add your name, and write me a message.');
  });

  it('falls back rather than leaking developer copy for an unknown error', () => {
    const said = arrowSayValidation(['Some new validator rule nobody mapped']);
    expect(said).toBe('Have a look at the fields in red and try again?');
  });

  it('falls back on an empty error list', () => {
    expect(arrowSayValidation([])).toBe('Have a look at the fields in red and try again?');
  });

  it('never shows a visitor a raw validator string', () => {
    const raws = [
      'Name is required',
      'Email is required',
      'Please enter a valid email address',
      'Message is required',
      'Message must be at least 10 characters long'
    ];
    for (const raw of raws) {
      expect(arrowSayValidation([raw])).not.toBe(raw);
    }
  });
});

describe('arrowSayFailure', () => {
  it('tells a rate-limited visitor to wait, not to retry immediately', () => {
    const said = arrowSayFailure(429);
    expect(said).toMatch(/little while/i);
    expect(said).not.toMatch(/429/);
  });

  it('tells a stale-session visitor to refresh', () => {
    expect(arrowSayFailure(403)).toMatch(/refresh/i);
  });

  it('takes the blame for a server error instead of blaming the visitor', () => {
    const said = arrowSayFailure(500);
    expect(said).toMatch(/on me, not you/i);
  });

  it('treats every 5xx the same way', () => {
    expect(arrowSayFailure(503)).toBe(arrowSayFailure(500));
  });

  it('reads a network failure off the message when there is no status', () => {
    expect(arrowSayFailure(null, 'Failed to fetch')).toMatch(/connection/i);
  });

  it('has a usable answer when nothing at all is known', () => {
    const said = arrowSayFailure(null, '');
    expect(said).toMatch(/one more try/i);
  });

  it('never leaks a status code or mechanism to the visitor', () => {
    const cases: Array<[number | null, string]> = [
      [429, 'Too many contact form submissions'],
      [403, 'CSRF_TOKEN_INVALID'],
      [500, 'Internal Server Error'],
      [null, 'Failed to fetch'],
      [null, '']
    ];
    for (const [status, raw] of cases) {
      const said = arrowSayFailure(status, raw);
      expect(said).not.toMatch(/csrf|token|\b4\d\d\b|\b5\d\d\b|xss|fetch\(/i);
    }
  });
});

describe('Arrow sizing', () => {
  it('has ordered, non-overlapping size thresholds', () => {
    expect(ARROW_SIZE_STEPS.SHORT_MAX_CHARS).toBeLessThan(ARROW_SIZE_STEPS.MEDIUM_MAX_CHARS);
  });

  it('keeps the success line within the medium bubble', () => {
    expect(ARROW_SUCCESS.length).toBeLessThanOrEqual(ARROW_SIZE_STEPS.MEDIUM_MAX_CHARS);
  });
});
