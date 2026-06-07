/**
 * ===============================================
 * INTAKE - API SUBMISSION HANDLER
 * ===============================================
 * @file src/features/client/intake/api-handler.ts
 *
 * Handles intake form submission to the server API.
 */

import { apiFetch } from '../../../utils/api-client';
import { getContactEmail } from '../../../config/branding';
import type { IntakeData } from '../terminal-intake-types';

/**
 * Result of an intake submission attempt
 */
export interface SubmissionResult {
  success: boolean;
  errorMessage?: string;
}

/**
 * Build the payload for intake submission
 */
export function buildSubmitPayload(
  intakeData: IntakeData
): Record<string, unknown> {
  return {
    ...intakeData,
    submittedAt: new Date().toISOString()
  };
}

/**
 * Submit intake data to the server.
 * Returns a result object indicating success or failure.
 */
export async function submitIntakeData(
  intakeData: IntakeData
): Promise<SubmissionResult> {
  try {
    const submitData = buildSubmitPayload(intakeData);

    const response = await apiFetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    await response.json();

    return { success: true };
  } catch {
    return {
      success: false,
      errorMessage: `Failed to submit your request. Please try again or contact ${getContactEmail('fallback')}`
    };
  }
}

/**
 * Build the success message shown after a successful submission
 */
export function buildSuccessMessage(): string {
  return `PROJECT REQUEST SUBMITTED SUCCESSFULLY!

Your request has been received.

What happens next:
1. You'll receive a confirmation email shortly
2. I'll review your request within 24-48 hours
3. You'll get a finalized quote and timeline
4. We'll schedule a call to discuss the details

Thank you for choosing No Bhad Codes!`;
}
