/**
 * ===============================================
 * TERMINAL INTAKE - TYPE DEFINITIONS
 * ===============================================
 * @file src/features/client/terminal-intake-types.ts
 *
 * Type definitions for the terminal intake module.
 */

export interface IntakeQuestion {
  id: string;
  field: string;
  question: string;
  type: 'text' | 'email' | 'tel' | 'url' | 'select' | 'multiselect' | 'textarea';
  options?: { value: string; label: string }[];
  required: boolean;
  validation?: (value: string) => string | null;
  dependsOn?: { field: string; value: string | string[] };
  placeholder?: string;
}

export interface IntakeData {
  [key: string]: string | string[];
}

export interface ChatMessage {
  type: 'ai' | 'user' | 'system' | 'error' | 'success';
  content: string;
  options?: { value: string; label: string }[];
  multiSelect?: boolean;
  questionIndex?: number;
}

export interface TerminalIntakeOptions {
  isModal?: boolean;
  clientData?: {
    name?: string;
    email?: string;
    company?: string;
  };
}

export interface SavedProgress {
  currentQuestionIndex: number;
  intakeData: IntakeData;
  timestamp: number;
}
