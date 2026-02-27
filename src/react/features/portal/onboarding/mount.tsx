/**
 * Portal Onboarding Mount
 * Island architecture mount function for OnboardingWizard
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { OnboardingWizard } from './OnboardingWizard';

// Store root for cleanup
const roots = new Map<HTMLElement, Root>();

export interface OnboardingMountOptions {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback when onboarding is completed */
  onComplete?: () => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Mount the OnboardingWizard component into a container element
 */
export function mountOnboardingWizard(
  container: HTMLElement,
  options: OnboardingMountOptions = {}
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
      <OnboardingWizard
        getAuthToken={options.getAuthToken}
        onComplete={options.onComplete}
        showNotification={options.showNotification}
      />
    </React.StrictMode>
  );

  // Return cleanup function
  return () => {
    unmountOnboardingWizard(container);
  };
}

/**
 * Unmount the OnboardingWizard component from a container element
 */
export function unmountOnboardingWizard(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

/**
 * Check if React onboarding wizard should be used
 */
export function shouldUseReactOnboarding(): boolean {
  // Check URL parameter for vanilla fallback
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('vanilla_onboarding') === 'true') return false;

  // Check feature flag in localStorage
  const flag = localStorage.getItem('feature_react_onboarding');
  if (flag === 'false') return false;
  if (flag === 'true') return true;

  // Default: enabled (React implementation)
  return true;
}
