/**
 * PROPOSAL BUILDER MODULE
 * @file src/features/client/proposal-builder.ts
 *
 * Main module: step navigation, selection state, and submission.
 * Delegates to: proposal-sections, proposal-calculations,
 * proposal-builder-events, proposal-builder-ui.
 */

import type {
  TierId,
  ProjectType,
  ProposalSelection,
  ProposalStep,
  ProposalBuilderState,
  MaintenanceId,
  ProposalCustomItem
} from './proposal-builder-types';
import { getTierConfiguration } from './proposal-builder-data';
import { showToast } from '../../utils/toast-notifications';
import { createLogger } from '../../utils/logger';
import { renderProposalBuilderHTML, animateContentTransition } from './proposal-builder-ui';

const logger = createLogger('ProposalBuilder');
import {
  renderStepContent,
  updateButtonStates,
  animateTierSelection,
  animateBuilderIn,
  syncStepIndicators
} from './proposal-sections';
import {
  updateCalculatedPrice,
  updatePriceDisplay,
  buildSubmissionBreakdown
} from './proposal-calculations';
import {
  handleProposalClick,
  handleProposalChange,
  applyCustomItemUpdate,
  type ProposalEventCallbacks
} from './proposal-builder-events';
import type { IntakeData } from './terminal-intake-types';

/**
 * Step order for navigation
 */
const STEP_ORDER: ProposalStep[] = [
  'tier-selection',
  'feature-customization',
  'maintenance',
  'summary'
];

/**
 * ProposalBuilderModule
 *
 * Manages the proposal builder flow after terminal intake.
 * Allows users to select tiers, customize features, and submit proposals.
 */
export class ProposalBuilderModule {
  private container: HTMLElement;
  private contentContainer: HTMLElement | null = null;
  private priceBar: HTMLElement | null = null;
  private intakeData: IntakeData;
  private projectType: ProjectType;
  private onComplete: ((selection: ProposalSelection) => void) | null = null;
  private onCancel: (() => void) | null = null;

  private state: ProposalBuilderState = {
    currentStep: 'tier-selection',
    selection: {
      selectedTier: 'better',
      addedFeatures: [],
      removedFeatures: [],
      maintenanceOption: null,
      calculatedPrice: 0,
      basePrice: 0,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      notes: '',
      customItems: [],
      discountType: null,
      discountValue: 0,
      taxRate: 0,
      expirationDate: null
    },
    configuration: null,
    isLoading: false,
    error: null
  };

  constructor(
    container: HTMLElement,
    intakeData: IntakeData,
    options?: {
      onComplete?: (selection: ProposalSelection) => void;
      onCancel?: () => void;
    }
  ) {
    this.container = container;
    this.intakeData = intakeData;
    this.projectType = (intakeData.projectType as ProjectType) || 'other';
    this.onComplete = options?.onComplete || null;
    this.onCancel = options?.onCancel || null;
  }

  async init(): Promise<void> {
    this.state.configuration = getTierConfiguration(this.projectType);

    const recommendedTier = this.state.configuration.tiers.find((t) => t.highlighted);
    if (recommendedTier) {
      this.state.selection.selectedTier = recommendedTier.id;
    }

    this.loadDraftIfAvailable();
    this.doUpdateCalculatedPrice();
    this.render();
    this.bindEvents();
    await animateBuilderIn(this.container);
  }

  private render(): void {
    this.container.innerHTML = renderProposalBuilderHTML();
    this.contentContainer = document.getElementById('proposalContent');
    this.priceBar = document.getElementById('proposalPriceBar');

    this.renderCurrentStep();
    syncStepIndicators(this.state.currentStep);
    this.doUpdatePriceDisplay();
    updateButtonStates(this.state.currentStep, STEP_ORDER);
  }

  private renderCurrentStep(): void {
    if (!this.contentContainer) return;
    renderStepContent(this.contentContainer, this.state);
  }

  private buildEventCallbacks(): ProposalEventCallbacks {
    return {
      selectTier: (tierId) => this.selectTier(tierId),
      selectMaintenance: (maintenanceId) => this.selectMaintenance(maintenanceId),
      toggleFeature: (featureId, isAdded) => this.toggleFeature(featureId, isAdded),
      addCustomItem: () => this.addCustomItem(),
      removeCustomItem: (itemId) => this.removeCustomItem(itemId),
      updateCustomItem: (itemId, field, target) => this.updateCustomItem(itemId, field, target),
      setNotes: (value) => { this.state.selection.notes = value; },
      setDiscountType: (value) => { this.state.selection.discountType = value; },
      setDiscountValue: (value) => { this.state.selection.discountValue = value; },
      setTaxRate: (value) => { this.state.selection.taxRate = value; },
      setExpirationDate: (value) => { this.state.selection.expirationDate = value; },
      refreshPricing: () => this.refreshPricing()
    };
  }

  private bindEvents(): void {
    const backBtn = document.getElementById('proposalBack');
    const nextBtn = document.getElementById('proposalNext');
    const draftBtn = document.getElementById('proposalDraft');

    backBtn?.addEventListener('click', () => this.handleBack());
    nextBtn?.addEventListener('click', () => this.handleNext());
    draftBtn?.addEventListener('click', () => this.saveDraft());

    const callbacks = this.buildEventCallbacks();
    this.container.addEventListener('click', (e) => handleProposalClick(e, callbacks));
    this.container.addEventListener('change', (e) => handleProposalChange(e, callbacks));
  }

  private refreshPricing(): void {
    this.doUpdateCalculatedPrice();
    this.doUpdatePriceDisplay();
    if (this.state.currentStep === 'summary') this.renderCurrentStep();
  }

  private selectTier(tierId: TierId): void {
    if (this.state.selection.selectedTier === tierId) return;
    this.state.selection.selectedTier = tierId;
    this.state.selection.addedFeatures = [];
    this.doUpdateCalculatedPrice();
    this.renderCurrentStep();
    this.doUpdatePriceDisplay();
    animateTierSelection(tierId);
  }

  private toggleFeature(featureId: string, isAdded: boolean): void {
    const { addedFeatures } = this.state.selection;

    if (isAdded && !addedFeatures.includes(featureId)) {
      addedFeatures.push(featureId);
    } else if (!isAdded) {
      const index = addedFeatures.indexOf(featureId);
      if (index > -1) addedFeatures.splice(index, 1);
    }

    this.doUpdateCalculatedPrice();
    this.doUpdatePriceDisplay();

    const featureItem = this.contentContainer
      ?.querySelector(`.feature-item--addon input[data-feature-id="${featureId}"]`)
      ?.closest('.feature-item');
    if (featureItem) {
      featureItem.classList.toggle('feature-item--selected', isAdded);
    }
  }

  private selectMaintenance(maintenanceId: MaintenanceId): void {
    if (this.state.selection.maintenanceOption === maintenanceId) {
      this.state.selection.maintenanceOption = null;
    } else {
      this.state.selection.maintenanceOption = maintenanceId;
    }
    this.doUpdateCalculatedPrice();
    this.renderCurrentStep();
    this.doUpdatePriceDisplay();
  }

  private async handleBack(): Promise<void> {
    const currentIndex = STEP_ORDER.indexOf(this.state.currentStep);
    if (currentIndex <= 0) {
      if (this.onCancel) this.onCancel();
      return;
    }

    this.state.currentStep = STEP_ORDER[currentIndex - 1];
    await animateContentTransition(this.contentContainer!, '', 'back');
    this.renderCurrentStep();
    syncStepIndicators(this.state.currentStep);
    updateButtonStates(this.state.currentStep, STEP_ORDER);
  }

  private async handleNext(): Promise<void> {
    const currentIndex = STEP_ORDER.indexOf(this.state.currentStep);
    if (currentIndex >= STEP_ORDER.length - 1) {
      await this.submit();
      return;
    }

    if (!this.validateCurrentStep()) return;

    this.state.currentStep = STEP_ORDER[currentIndex + 1];
    await animateContentTransition(this.contentContainer!, '', 'forward');
    this.renderCurrentStep();
    syncStepIndicators(this.state.currentStep);
    updateButtonStates(this.state.currentStep, STEP_ORDER);
  }

  private validateCurrentStep(): boolean {
    switch (this.state.currentStep) {
    case 'tier-selection':
      if (!this.state.selection.selectedTier) {
        this.showError('Please select a package tier');
        return false;
      }
      break;
    }
    return true;
  }

  private doUpdateCalculatedPrice(): void {
    updateCalculatedPrice(this.projectType, this.state.selection);
  }

  private doUpdatePriceDisplay(): void {
    if (!this.priceBar) return;
    updatePriceDisplay(this.priceBar, this.state, this.projectType);
  }

  private addCustomItem(): void {
    const newItem: ProposalCustomItem = {
      id: `item-${Date.now()}`,
      itemType: 'service',
      description: '',
      quantity: 1,
      unitPrice: 0,
      unitLabel: '',
      isTaxable: true,
      isOptional: false
    };

    this.state.selection.customItems = [...this.state.selection.customItems, newItem];
    this.doUpdateCalculatedPrice();
    this.renderCurrentStep();
    this.doUpdatePriceDisplay();
  }

  private removeCustomItem(itemId: string): void {
    this.state.selection.customItems = this.state.selection.customItems.filter(
      (item) => item.id !== itemId
    );
    this.doUpdateCalculatedPrice();
    this.renderCurrentStep();
    this.doUpdatePriceDisplay();
  }

  private updateCustomItem(itemId: string, field: string, target: HTMLInputElement): void {
    this.state.selection.customItems = applyCustomItemUpdate(
      this.state.selection.customItems,
      itemId,
      field,
      target
    );
    this.doUpdateCalculatedPrice();
    this.doUpdatePriceDisplay();
    if (this.state.currentStep === 'summary') this.renderCurrentStep();
  }

  private saveDraft(): void {
    const draftKey = `proposalBuilderDraft:${this.projectType}`;
    const draft = { projectType: this.projectType, selection: this.state.selection };
    localStorage.setItem(draftKey, JSON.stringify(draft));
    showToast('Draft saved', 'success');
  }

  private loadDraftIfAvailable(): void {
    const draftKey = `proposalBuilderDraft:${this.projectType}`;
    const rawDraft = localStorage.getItem(draftKey);
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as {
        projectType?: ProjectType;
        selection?: ProposalSelection;
      };
      if (!draft?.selection) return;
      const shouldLoad = window.confirm('We found a saved proposal draft. Load it now?');
      if (!shouldLoad) return;

      this.state.selection = {
        ...this.state.selection,
        ...draft.selection,
        customItems: draft.selection.customItems || [],
        discountType: draft.selection.discountType || null,
        discountValue: draft.selection.discountValue || 0,
        taxRate: draft.selection.taxRate || 0,
        expirationDate: draft.selection.expirationDate || null
      };
    } catch (error) {
      logger.error('Failed to load draft:', error);
    }
  }

  private showError(message: string): void {
    this.state.error = message;
    logger.error(message);
  }

  private async submit(): Promise<void> {
    if (!this.state.configuration) return;

    const notesTextarea = document.getElementById('proposalNotes') as HTMLTextAreaElement;
    if (notesTextarea) {
      this.state.selection.notes = notesTextarea.value;
    }

    const tier = this.state.configuration.tiers.find(
      (t) => t.id === this.state.selection.selectedTier
    );
    if (!tier) {
      this.showError('Invalid tier selection');
      return;
    }

    const breakdown = buildSubmissionBreakdown(this.projectType, this.state.selection);

    this.state.selection.calculatedPrice = breakdown.total;
    this.state.selection.basePrice = breakdown.basePrice;
    this.state.selection.subtotal = breakdown.subtotal;
    this.state.selection.discountAmount = breakdown.discountAmount;
    this.state.selection.taxAmount = breakdown.taxAmount;

    if (this.onComplete) {
      this.onComplete(this.state.selection);
    }
  }

  getSelection(): ProposalSelection {
    return { ...this.state.selection };
  }

  async getSelectionAsync(): Promise<ProposalSelection | null> {
    return new Promise((resolve) => {
      this.onComplete = (selection) => resolve(selection);
      this.onCancel = () => resolve(null);
    });
  }

  destroy(): void {
    this.container.innerHTML = '';
    this.contentContainer = null;
    this.priceBar = null;
    this.onComplete = null;
    this.onCancel = null;
  }
}

export default ProposalBuilderModule;
