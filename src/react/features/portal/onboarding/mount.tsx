/**
 * Portal Onboarding Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { OnboardingWizard } from './OnboardingWizard';

export interface OnboardingMountOptions extends BaseMountOptions {
  /** Callback when onboarding is completed */
  onComplete?: () => void;
}

export const {
  mount: mountOnboardingWizard,
  unmount: unmountOnboardingWizard,
  shouldUseReact: shouldUseReactOnboarding
} = createMountWrapper<OnboardingMountOptions>({
  Component: OnboardingWizard,
  displayName: 'OnboardingWizard'
});
