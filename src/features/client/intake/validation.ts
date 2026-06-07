/**
 * ===============================================
 * INTAKE - VALIDATION & INPUT PARSING
 * ===============================================
 * @file src/features/client/intake/validation.ts
 *
 * Input validation and parsing logic for form responses.
 */

import type { IntakeQuestion } from '../terminal-intake-types';
import { sanitizeInput } from '../terminal-intake-ui';

/**
 * Result of parsing user input for a given question
 */
export interface ParsedInput {
  value: string | string[];
  displayValue: string;
}

/**
 * Validate a string value against a question's validation function.
 * Returns the error message if invalid, or null if valid.
 */
export function validateAnswer(
  question: IntakeQuestion,
  value: string
): string | null {
  if (question.validation) {
    return question.validation(value);
  }
  return null;
}

/**
 * Parse user text input for a select-type question.
 * Accepts numeric input (1-based) or text matching.
 * Returns the matched option or null if no match.
 */
export function parseSelectInput(
  inputText: string,
  options: { value: string; label: string }[]
): { value: string; label: string } | null {
  if (!inputText || !options) return null;

  const numericInput = parseInt(inputText, 10);

  if (!isNaN(numericInput) && numericInput >= 1 && numericInput <= options.length) {
    return options[numericInput - 1];
  }

  const lowerInput = inputText.toLowerCase();
  return (
    options.find(
      (opt) =>
        opt.label.toLowerCase().includes(lowerInput) ||
        opt.value.toLowerCase().includes(lowerInput)
    ) || null
  );
}

/**
 * Parse raw user input into a structured value based on the question type.
 * Returns the parsed input or null if the input is invalid/empty.
 */
export function parseUserInput(
  rawInput: string,
  question: IntakeQuestion,
  selectedOptions: string[]
): ParsedInput | null {
  if (question.type === 'multiselect' && selectedOptions.length > 0) {
    const displayValue = selectedOptions
      .map((v) => question.options?.find((o) => o.value === v)?.label || v)
      .join(', ');
    return { value: selectedOptions, displayValue };
  }

  if (question.type === 'select') {
    const trimmed = rawInput.trim();
    if (!trimmed || !question.options) return null;

    const matched = parseSelectInput(trimmed, question.options);
    if (!matched) return null;

    return { value: matched.value, displayValue: matched.label };
  }

  // Text-based input
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const sanitized = sanitizeInput(trimmed);
  return { value: sanitized, displayValue: sanitized };
}

/**
 * Generate an error message for invalid select input
 */
export function getInvalidSelectMessage(optionCount: number): string {
  return `Invalid selection. Please enter a number (1-${optionCount}) or click an option.`;
}
