/**
 * Portal Questionnaires Mount
 * Island architecture mount function for PortalQuestionnairesView
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PortalQuestionnairesView } from './PortalQuestionnairesView';

// Store root for cleanup
const roots = new Map<HTMLElement, Root>();

export interface PortalQuestionnairesMountOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the PortalQuestionnairesView component into a container element
 */
export function mountPortalQuestionnaires(
  container: HTMLElement,
  options: PortalQuestionnairesMountOptions = {}
): () => void {
  // Clean up existing root if present
  const existingRoot = roots.get(container);
  if (existingRoot) {
    existingRoot.unmount();
    roots.delete(container);
  }

  const root = createRoot(container);
  roots.set(container, root);

  root.render(
    <React.StrictMode>
      <PortalQuestionnairesView
        getAuthToken={options.getAuthToken}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );

  // Return cleanup function
  return () => {
    unmountPortalQuestionnaires(container);
  };
}

/**
 * Unmount the PortalQuestionnairesView component from a container element
 */
export function unmountPortalQuestionnaires(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

/**
 * Check if React portal questionnaires should be used
 */
export function shouldUseReactPortalQuestionnaires(): boolean {
  // Check URL parameter for vanilla fallback
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('vanilla_portal_questionnaires') === 'true') return false;

  // Check feature flag in localStorage
  const flag = localStorage.getItem('feature_react_portal_questionnaires');
  if (flag === 'false') return false;
  if (flag === 'true') return true;

  // Default: enabled (React implementation)
  return true;
}
