/**
 * ===============================================
 * PORTAL ONBOARDING WIZARD MODULE
 * ===============================================
 * @file src/features/client/modules/portal-onboarding-wizard.ts
 *
 * Client onboarding wizard with 5 steps:
 * 1. Basic Info - Company, contact, email, phone
 * 2. Project Overview - Type, description, goals
 * 3. Requirements - Features, budget, timeline
 * 4. Assets Checklist - What they have/need
 * 5. Review - Summary and submit
 *
 * Follows proposal-builder.ts pattern for step navigation and GSAP animations.
 */

import { gsap } from 'gsap';
import type { ClientPortalContext } from '../portal-types';
import {
  renderOnboardingWizardHTML,
  renderStepContent,
  updateStepIndicators,
  animateStepTransition
} from './portal-onboarding-ui';

// =====================================================
// TYPES
// =====================================================

export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export interface OnboardingStepData {
  // Step 1: Basic Info
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;

  // Step 2: Project Overview
  project_type?: string;
  project_description?: string;
  project_goals?: string[];

  // Step 3: Requirements
  features?: string[];
  budget_range?: string;
  timeline?: string;

  // Step 4: Assets Checklist
  has_logo?: boolean;
  has_brand_colors?: boolean;
  has_content?: boolean;
  has_photos?: boolean;
  needs_help_with?: string[];

  // Step 5: Review confirmation
  confirmed?: boolean;
}

interface OnboardingWizardState {
  currentStep: OnboardingStep;
  stepData: OnboardingStepData;
  isLoading: boolean;
  error: string | null;
}

// =====================================================
// CONSTANTS
// =====================================================

const STEP_ORDER: OnboardingStep[] = [1, 2, 3, 4, 5];
const STORAGE_KEY = 'clientOnboardingDraft';
const API_BASE = '/api/client-info';

const STEP_TITLES: Record<OnboardingStep, string> = {
  1: 'Basic Information',
  2: 'Project Overview',
  3: 'Requirements',
  4: 'Assets Checklist',
  5: 'Review & Submit'
};

// =====================================================
// MODULE CLASS
// =====================================================

export class OnboardingWizardModule {
  private container: HTMLElement;
  private contentContainer: HTMLElement | null = null;
  private ctx: ClientPortalContext;
  private onComplete: (() => void) | null = null;
  private onCancel: (() => void) | null = null;

  private state: OnboardingWizardState = {
    currentStep: 1,
    stepData: {},
    isLoading: false,
    error: null
  };

  constructor(
    container: HTMLElement,
    ctx: ClientPortalContext,
    options?: {
      onComplete?: () => void;
      onCancel?: () => void;
    }
  ) {
    this.container = container;
    this.ctx = ctx;
    this.onComplete = options?.onComplete || null;
    this.onCancel = options?.onCancel || null;
  }

  /**
   * Initialize the onboarding wizard
   */
  async init(): Promise<void> {
    // Load existing progress from server
    await this.loadProgress();

    // Load draft from localStorage if available
    this.loadDraftIfAvailable();

    // Render the wizard
    this.render();
    this.bindEvents();

    // Animate in
    await this.animateIn();
  }

  /**
   * Load progress from server
   */
  private async loadProgress(): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/onboarding`, { credentials: 'include' });
      if (!res.ok) return;

      const data = await res.json() as { progress?: { current_step: number; step_data: OnboardingStepData; status: string } };
      if (data.progress && data.progress.status !== 'completed') {
        this.state.currentStep = data.progress.current_step as OnboardingStep;
        this.state.stepData = data.progress.step_data || {};
      }
    } catch {
      // Ignore errors, will start fresh
    }
  }

  /**
   * Render the wizard
   */
  private render(): void {
    this.container.innerHTML = renderOnboardingWizardHTML(STEP_TITLES);

    this.contentContainer = document.getElementById('onboardingContent');

    // Render current step content
    this.renderCurrentStep();

    // Update step indicators
    updateStepIndicators(this.state.currentStep);

    // Update button states
    this.updateButtonStates();
  }

  /**
   * Render content for the current step
   */
  private renderCurrentStep(): void {
    if (!this.contentContainer) return;

    this.contentContainer.innerHTML = renderStepContent(
      this.state.currentStep,
      this.state.stepData
    );
  }

  /**
   * Bind event listeners
   */
  private bindEvents(): void {
    // Navigation buttons
    const backBtn = document.getElementById('onboardingBack');
    const nextBtn = document.getElementById('onboardingNext');
    const saveBtn = document.getElementById('onboardingSave');

    backBtn?.addEventListener('click', () => this.handleBack());
    nextBtn?.addEventListener('click', () => this.handleNext());
    saveBtn?.addEventListener('click', () => this.saveDraft());

    // Delegate events for dynamic content
    this.container.addEventListener('change', (e) => this.handleChange(e));
    this.container.addEventListener('click', (e) => this.handleClick(e));
  }

  /**
   * Handle input changes
   */
  private handleChange(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const fieldName = target.name;

    if (!fieldName) return;

    if (target.type === 'checkbox') {
      const checkbox = target as HTMLInputElement;

      // Handle multi-select checkboxes (arrays)
      if (['project_goals', 'features', 'needs_help_with'].includes(fieldName)) {
        const currentArray = (this.state.stepData[fieldName as keyof OnboardingStepData] as string[]) || [];
        const value = checkbox.value;

        if (checkbox.checked) {
          if (!currentArray.includes(value)) {
            (this.state.stepData as Record<string, unknown>)[fieldName] = [...currentArray, value];
          }
        } else {
          (this.state.stepData as Record<string, unknown>)[fieldName] = currentArray.filter(v => v !== value);
        }
      } else {
        // Handle boolean checkboxes
        (this.state.stepData as Record<string, unknown>)[fieldName] = checkbox.checked;
      }
    } else {
      // Handle text/select inputs
      (this.state.stepData as Record<string, unknown>)[fieldName] = target.value;
    }
  }

  /**
   * Handle click events
   */
  private handleClick(e: Event): void {
    const target = e.target as HTMLElement;

    // Step indicator clicks
    const stepIndicator = target.closest('.onboarding-step-indicator');
    if (stepIndicator) {
      const stepAttr = stepIndicator.getAttribute('data-step');
      if (stepAttr) {
        const step = parseInt(stepAttr, 10) as OnboardingStep;
        if (step < this.state.currentStep) {
          // Only allow going back
          this.goToStep(step);
        }
      }
    }
  }

  /**
   * Handle back button
   */
  private async handleBack(): Promise<void> {
    const currentIndex = STEP_ORDER.indexOf(this.state.currentStep);

    if (currentIndex <= 0) {
      // At first step - cancel the wizard
      if (this.onCancel) {
        this.onCancel();
      }
      return;
    }

    // Save current step data before going back
    this.collectCurrentStepData();
    await this.saveProgressToServer();

    // Go to previous step
    const prevStep = STEP_ORDER[currentIndex - 1];
    await this.goToStep(prevStep, 'back');
  }

  /**
   * Handle next/submit button
   */
  private async handleNext(): Promise<void> {
    // Collect current step data
    this.collectCurrentStepData();

    // Validate current step
    if (!this.validateCurrentStep()) {
      return;
    }

    const currentIndex = STEP_ORDER.indexOf(this.state.currentStep);

    if (currentIndex >= STEP_ORDER.length - 1) {
      // At last step - submit
      await this.submit();
      return;
    }

    // Save progress to server
    await this.saveProgressToServer();

    // Go to next step
    const nextStep = STEP_ORDER[currentIndex + 1];
    await this.goToStep(nextStep, 'forward');
  }

  /**
   * Go to a specific step
   */
  private async goToStep(step: OnboardingStep, direction: 'forward' | 'back' = 'forward'): Promise<void> {
    this.state.currentStep = step;

    await animateStepTransition(
      this.contentContainer!,
      direction
    );

    this.renderCurrentStep();
    updateStepIndicators(this.state.currentStep);
    this.updateButtonStates();
  }

  /**
   * Collect data from current step form fields
   */
  private collectCurrentStepData(): void {
    const form = this.contentContainer?.querySelector('form');
    if (!form) return;

    const formData = new FormData(form);

    // Handle checkbox groups specially
    const checkboxGroups = ['project_goals', 'features', 'needs_help_with'];

    for (const [key, value] of formData.entries()) {
      if (!checkboxGroups.includes(key)) {
        (this.state.stepData as Record<string, unknown>)[key] = value as string;
      }
    }

    // Handle boolean checkboxes
    const booleanCheckboxes = ['has_logo', 'has_brand_colors', 'has_content', 'has_photos', 'confirmed'];
    booleanCheckboxes.forEach(name => {
      const checkbox = form.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
      if (checkbox) {
        (this.state.stepData as Record<string, unknown>)[name] = checkbox.checked;
      }
    });
  }

  /**
   * Validate the current step
   */
  private validateCurrentStep(): boolean {
    switch (this.state.currentStep) {
    case 1:
      if (!this.state.stepData.company_name?.trim() && !this.state.stepData.contact_name?.trim()) {
        this.showError('Please enter either a company name or contact name');
        return false;
      }
      break;

    case 2:
      if (!this.state.stepData.project_type) {
        this.showError('Please select a project type');
        return false;
      }
      break;

    case 5:
      if (!this.state.stepData.confirmed) {
        this.showError('Please confirm the information is accurate');
        return false;
      }
      break;
    }

    return true;
  }

  /**
   * Save progress to server
   */
  private async saveProgressToServer(): Promise<void> {
    try {
      await fetch(`${API_BASE}/onboarding/save`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: this.state.currentStep,
          stepData: this.state.stepData
        })
      });
    } catch (err) {
      console.error('[OnboardingWizard] Failed to save progress:', err);
    }
  }

  /**
   * Save draft to localStorage
   */
  private saveDraft(): void {
    this.collectCurrentStepData();

    const draft = {
      currentStep: this.state.currentStep,
      stepData: this.state.stepData
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    this.ctx.showNotification('Draft saved', 'success');
  }

  /**
   * Load draft from localStorage
   */
  private loadDraftIfAvailable(): void {
    const rawDraft = localStorage.getItem(STORAGE_KEY);
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as { currentStep?: OnboardingStep; stepData?: OnboardingStepData };

      // Only use draft if it has more progress than server data
      if (draft?.stepData) {
        const shouldLoad = window.confirm('We found a saved draft. Load it now?');
        if (shouldLoad) {
          if (draft.currentStep && draft.currentStep >= this.state.currentStep) {
            this.state.currentStep = draft.currentStep;
          }
          this.state.stepData = {
            ...this.state.stepData,
            ...draft.stepData
          };
        }
      }
    } catch (error) {
      console.error('[OnboardingWizard] Failed to load draft:', error);
    }
  }

  /**
   * Update button states based on current step
   */
  private updateButtonStates(): void {
    const backBtn = document.getElementById('onboardingBack');
    const nextBtn = document.getElementById('onboardingNext');
    const saveBtn = document.getElementById('onboardingSave');

    if (!backBtn || !nextBtn) return;

    const currentIndex = STEP_ORDER.indexOf(this.state.currentStep);
    const isFirstStep = currentIndex === 0;
    const isLastStep = currentIndex === STEP_ORDER.length - 1;

    // Back button
    backBtn.textContent = isFirstStep ? 'Cancel' : 'Back';

    // Next button
    nextBtn.textContent = isLastStep ? 'Complete Setup' : 'Continue';
    nextBtn.classList.toggle('btn-primary', !isLastStep);
    nextBtn.classList.toggle('btn-success', isLastStep);

    // Save draft button
    if (saveBtn) {
      saveBtn.style.display = isLastStep ? 'none' : 'inline-flex';
    }
  }

  /**
   * Animate the wizard in
   */
  private async animateIn(): Promise<void> {
    const wizard = this.container.querySelector('.onboarding-wizard');
    if (!wizard) return;

    gsap.fromTo(wizard, {
      opacity: 0,
      y: 20
    }, {
      opacity: 1,
      y: 0,
      duration: 0.4,
      ease: 'power2.out'
    });
  }

  /**
   * Show an error message
   */
  private showError(message: string): void {
    this.state.error = message;
    this.ctx.showNotification(message, 'error');
  }

  /**
   * Submit the onboarding
   */
  private async submit(): Promise<void> {
    this.collectCurrentStepData();

    if (!this.state.stepData.confirmed) {
      this.showError('Please confirm the information is accurate');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/onboarding/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalData: this.state.stepData
        })
      });

      if (!res.ok) {
        throw new Error('Failed to complete onboarding');
      }

      // Clear draft
      localStorage.removeItem(STORAGE_KEY);

      this.ctx.showNotification('Onboarding completed successfully!', 'success');

      // Call completion handler
      if (this.onComplete) {
        this.onComplete();
      }
    } catch (err) {
      this.showError((err as Error).message);
    }
  }

  /**
   * Get the current step data
   */
  getStepData(): OnboardingStepData {
    return { ...this.state.stepData };
  }

  /**
   * Destroy the module and clean up
   */
  destroy(): void {
    this.container.innerHTML = '';
    this.contentContainer = null;
    this.onComplete = null;
    this.onCancel = null;
  }
}

export default OnboardingWizardModule;
