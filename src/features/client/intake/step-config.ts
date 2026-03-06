/**
 * ===============================================
 * INTAKE - STEP CONFIGURATION & RESOLUTION
 * ===============================================
 * @file src/features/client/intake/step-config.ts
 *
 * Question resolution, dependency checking, and skip logic.
 */

import type { IntakeData, IntakeQuestion } from '../terminal-intake-types';
import { QUESTIONS, BUDGET_OPTIONS, FEATURE_OPTIONS } from '../terminal-intake-data';

/**
 * Check if a dependency condition is satisfied
 */
export function isDependencyMet(
  dependsOn: { field: string; value: string | string[] },
  intakeData: IntakeData
): boolean {
  const dependentValue = intakeData[dependsOn.field];
  const requiredValue = dependsOn.value;

  if (Array.isArray(dependentValue)) {
    return Array.isArray(requiredValue)
      ? requiredValue.some((v) => dependentValue.includes(v))
      : dependentValue.includes(requiredValue);
  }

  if (Array.isArray(requiredValue)) {
    return requiredValue.includes(dependentValue as string);
  }

  return dependentValue === requiredValue;
}

/**
 * Find the next valid question starting from a given index,
 * skipping questions whose dependencies are not met.
 * Returns [question, resolvedIndex] or [null, pastEndIndex].
 */
export function resolveCurrentQuestion(
  startIndex: number,
  intakeData: IntakeData
): [IntakeQuestion | null, number] {
  let searchIndex = startIndex;

  while (searchIndex < QUESTIONS.length) {
    const question = QUESTIONS[searchIndex];

    if (question.dependsOn && !isDependencyMet(question.dependsOn, intakeData)) {
      searchIndex++;
      continue;
    }

    return [question, searchIndex];
  }

  return [null, searchIndex];
}

/**
 * Determine the first relevant question index for an existing client,
 * skipping already-answered fields and unmet dependencies.
 */
export function findFirstRelevantQuestionIndex(intakeData: IntakeData): number {
  const fieldsToSkip = ['name', 'email'];
  let index = 0;

  while (index < QUESTIONS.length) {
    const question = QUESTIONS[index];

    if (question.id === 'greeting' && intakeData.name) {
      index++;
      continue;
    }

    if (question.id === 'email' && intakeData.email) {
      index++;
      continue;
    }

    if (question.field === 'companyName' && intakeData.companyName) {
      index++;
      continue;
    }

    if (question.id === 'budget' && intakeData.billingPreference === 'same-as-last') {
      index++;
      continue;
    }

    if (
      fieldsToSkip.includes(question.field) &&
      intakeData[question.field as keyof IntakeData]
    ) {
      index++;
      continue;
    }

    if (question.dependsOn && !isDependencyMet(question.dependsOn, intakeData)) {
      index++;
      continue;
    }

    break;
  }

  return index;
}

/**
 * Apply dynamic options to a question based on intake data
 * (e.g., budget and feature options depend on project type).
 */
export function applyDynamicOptions(question: IntakeQuestion, intakeData: IntakeData): void {
  if (question.id === 'budget') {
    const projectType = (intakeData.projectType as string) || 'other';
    question.options = BUDGET_OPTIONS[projectType] || BUDGET_OPTIONS.other;
  }

  if (question.id === 'features') {
    const projectType = (intakeData.projectType as string) || 'other';
    question.options = FEATURE_OPTIONS[projectType] || FEATURE_OPTIONS.other;
  }
}

/**
 * Interpolate template variables in question text
 */
export function interpolateQuestionText(text: string, intakeData: IntakeData): string {
  if (text.includes('{{name}}')) {
    return text.replace('{{name}}', (intakeData.name as string) || 'there');
  }
  return text;
}

/**
 * Find the index of the first question that depends on a given field
 */
export function findFirstDependentQuestionIndex(
  changedField: string,
  fromIndex: number
): number {
  for (let i = fromIndex + 1; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    if (q.dependsOn && q.dependsOn.field === changedField) {
      return i;
    }
  }
  return -1;
}
