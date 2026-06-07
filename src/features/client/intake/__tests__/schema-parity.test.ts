/**
 * ===============================================
 * GUARD TEST — Terminal intake question flow vs. server schema
 * ===============================================
 * @file src/features/client/intake/__tests__/schema-parity.test.ts
 *
 * Ensures every option VALUE in the terminal-intake question flow
 * is accepted by ValidationSchemas.intakeSubmission. Fails fast
 * if restored question data drifts from the current server schema.
 *
 * Server schema is the source of truth. If this test fails for a
 * field value, fix terminal-intake-data.ts, NOT schemas.ts.
 */

import { describe, it, expect } from 'vitest';
import { QUESTIONS } from '../../terminal-intake-data';
import { ValidationSchemas } from '../../../../../server/middleware/validation/schemas';

/**
 * Extract allowedValues for a given field from intakeSubmission.
 * Handles both single-rule objects and arrays of rule objects.
 */
function allowedValues(field: string): string[] {
  const rule = (ValidationSchemas.intakeSubmission as Record<string, unknown>)[field];
  const rules = Array.isArray(rule) ? rule : [rule];
  for (const r of rules) {
    if (r && typeof r === 'object' && 'allowedValues' in r) {
      return (r as { allowedValues: string[] }).allowedValues;
    }
  }
  return [];
}

describe('terminal intake question flow matches server schema', () => {
  // These are the enum fields the server validates strictly.
  // All three fields have static options in the lean question flow and must be checked.
  const enumFields = ['projectType', 'timeline', 'budget'];

  for (const field of enumFields) {
    it(`every '${field}' option value is accepted by the server schema`, () => {
      const server = allowedValues(field);

      // Sanity: the server schema must actually define allowed values for this field
      expect(server.length, `No allowedValues found on server schema for field '${field}'`).toBeGreaterThan(0);

      const question = QUESTIONS.find((q) => q.field === field);

      // If the question has no static options (e.g. dynamically populated), skip value checks
      if (!question || !question.options || question.options.length === 0) return;

      for (const opt of question.options) {
        expect(
          server,
          `Option value '${opt.value}' (label: '${opt.label}') for field '${field}' is not in server allowedValues: [${server.join(', ')}]`
        ).toContain(opt.value);
      }
    });
  }
});
