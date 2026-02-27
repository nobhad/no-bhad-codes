/**
 * Portal Onboarding Feature
 * React components for the client portal onboarding wizard
 */

export { OnboardingWizard } from './OnboardingWizard';
export { StepIndicator, StepIndicatorDetailed } from './StepIndicator';
export {
  BasicInfoStep,
  ProjectOverviewStep,
  RequirementsStep,
  AssetsStep,
  ConfirmationStep
} from './steps';
export {
  mountOnboardingWizard,
  unmountOnboardingWizard,
  shouldUseReactOnboarding
} from './mount';
export * from './types';
