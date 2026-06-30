/**
 * ===============================================
 * OBFUSCATION PLUGIN OPTIONS TESTS
 * ===============================================
 * @file tests/unit/utils/obfuscation-plugin.test.ts
 *
 * Regression guard for a production-only crash: javascript-obfuscator's
 * `controlFlowFlattening` transform miscompiles optional-call expressions.
 * It rewrites `fn?.(args)` into an unconditional wrapped call that drops the
 * `?.` nullish guard, so any optional callback that is undefined at runtime
 * (`onSuccess?.()`, `showNotification?.()`, `transform?.()`, …) throws
 * "X is not a function". This silently broke the entire admin dashboard in the
 * obfuscated production build while dev (unobfuscated) worked fine.
 *
 * The fix is to keep `controlFlowFlattening` disabled at every level. These
 * tests fail if anyone re-enables it.
 */

import { describe, it, expect } from 'vitest';
import { getObfuscatorOptions } from '../../../src/utils/obfuscation-plugin';

const FEATURES = {
  minifyHTML: false,
  obfuscateJS: true,
  obfuscateCSS: false,
  encryptStrings: false,
  antiDebugTraps: false,
  fakeSourceMaps: false,
  polymorphicCode: false
} as const;

const LEVELS = ['basic', 'standard', 'advanced', 'maximum'] as const;

describe('obfuscation plugin options', () => {
  it.each(LEVELS)('keeps controlFlowFlattening disabled at "%s" level', (level) => {
    const opts = getObfuscatorOptions(level, FEATURES);
    // truthy controlFlowFlattening is the regression — undefined/false are both safe
    expect(opts.controlFlowFlattening ?? false).toBe(false);
  });

  it('still obfuscates (identifier renaming stays on) so disabling CFF is not "off"', () => {
    const opts = getObfuscatorOptions('standard', FEATURES);
    expect(opts.compact).toBe(true);
    expect(opts.identifierNamesGenerator).toBe('hexadecimal');
  });
});
