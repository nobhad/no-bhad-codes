/**
 * ===============================================
 * PROPOSAL BUILDER MODULE
 * ===============================================
 * @file src/features/client/proposal-builder.ts
 *
 * Main module for the tiered proposal builder.
 * Handles step navigation, selection state, and submission.
 */

import { gsap } from 'gsap';
import type {
  TierId,
  ProjectType,
  ProposalSelection,
  ProposalStep,
  ProposalBuilderState,
  MaintenanceId,
  PriceBreakdown,
  ProposalCustomItem,
  DiscountType
} from './proposal-builder-types';
import {
  getTierConfiguration,
  calculatePriceBreakdown
} from './proposal-builder-data';
import { showToast } from '../../utils/toast-notifications';
import {
  renderProposalBuilderHTML,
  renderTierCards,
  renderFeatureChecklist,
  renderMaintenanceOptions,
  renderSummary,
  renderPriceBar,
  updateStepIndicators,
  animateContentTransition
} from './proposal-builder-ui';
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
      selectedTier: 'better', // Default to recommended tier
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

  /**
   * Initialize the proposal builder
   */
  async init(): Promise<void> {
    // Load configuration for project type
    this.state.configuration = getTierConfiguration(this.projectType);

    // Set default tier to the highlighted one (recommended)
    const recommendedTier = this.state.configuration.tiers.find(t => t.highlighted);
    if (recommendedTier) {
      this.state.selection.selectedTier = recommendedTier.id;
    }

    this.loadDraftIfAvailable();

    // Calculate initial price
    this.updateCalculatedPrice();

    // Render the builder
    this.render();
    this.bindEvents();

    // Animate in
    await this.animateIn();
  }

  /**
   * Render the proposal builder
   */
  private render(): void {
    this.container.innerHTML = renderProposalBuilderHTML();

    this.contentContainer = document.getElementById('proposalContent');
    this.priceBar = document.getElementById('proposalPriceBar');

    // Render current step content
    this.renderCurrentStep();

    // Update step indicators
    updateStepIndicators(this.state.currentStep);

    // Update price display
    this.updatePriceDisplay();

    // Update button states
    this.updateButtonStates();
  }

  /**
   * Render content for the current step
   */
  private renderCurrentStep(): void {
    if (!this.contentContainer || !this.state.configuration) return;

    const { tiers, features, maintenanceOptions } = this.state.configuration;
    const tier = tiers.find(t => t.id === this.state.selection.selectedTier);

    let content = '';

    switch (this.state.currentStep) {
    case 'tier-selection':
      content = renderTierCards(tiers, features, this.state.selection.selectedTier);
      break;

    case 'feature-customization':
      if (tier) {
        content = renderFeatureChecklist(tier, features, this.state.selection.addedFeatures);
      }
      break;

    case 'maintenance':
      content = renderMaintenanceOptions(
        maintenanceOptions,
        this.state.selection.maintenanceOption
      );
      break;

    case 'summary':
      if (tier) {
        content = renderSummary(
          this.state.selection,
          tier,
          features,
          maintenanceOptions
        );
      }
      break;
    }

    this.contentContainer.innerHTML = content;
  }

  /**
   * Bind event listeners
   */
  private bindEvents(): void {
    // Navigation buttons
    const backBtn = document.getElementById('proposalBack');
    const nextBtn = document.getElementById('proposalNext');
    const draftBtn = document.getElementById('proposalDraft');

    backBtn?.addEventListener('click', () => this.handleBack());
    nextBtn?.addEventListener('click', () => this.handleNext());
    draftBtn?.addEventListener('click', () => this.saveDraft());

    // Delegate events for dynamic content
    this.container.addEventListener('click', (e) => this.handleClick(e));
    this.container.addEventListener('change', (e) => this.handleChange(e));
  }

  /**
   * Handle click events (delegated)
   */
  private handleClick(e: Event): void {
    const target = e.target as HTMLElement;

    // Tier card selection
    const tierCard = target.closest('.tier-card');
    if (tierCard) {
      const tierId = tierCard.getAttribute('data-tier-id') as TierId;
      if (tierId) {
        this.selectTier(tierId);
      }
      return;
    }

    // Tier select button
    const tierBtn = target.closest('.tier-select-btn');
    if (tierBtn) {
      const tierId = tierBtn.getAttribute('data-tier-id') as TierId;
      if (tierId) {
        this.selectTier(tierId);
      }
      return;
    }

    // Maintenance card selection
    const maintenanceCard = target.closest('.maintenance-card');
    if (maintenanceCard) {
      const maintenanceId = maintenanceCard.getAttribute('data-maintenance-id') as MaintenanceId;
      if (maintenanceId) {
        this.selectMaintenance(maintenanceId);
      }
      return;
    }

    // Maintenance select button
    const maintenanceBtn = target.closest('.maintenance-select-btn');
    if (maintenanceBtn) {
      const maintenanceId = maintenanceBtn.getAttribute('data-maintenance-id') as MaintenanceId;
      if (maintenanceId) {
        this.selectMaintenance(maintenanceId);
      }

    }

    const addCustomItemBtn = target.closest('#add-custom-item-btn');
    if (addCustomItemBtn) {
      this.addCustomItem();
      return;
    }

    const removeCustomItemBtn = target.closest('.summary-remove-item') as HTMLElement | null;
    if (removeCustomItemBtn) {
      const itemId = removeCustomItemBtn.getAttribute('data-item-id');
      if (itemId) {
        this.removeCustomItem(itemId);
      }
    }
  }

  /**
   * Handle change events (delegated)
   */
  private handleChange(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLSelectElement;

    // Feature checkbox
    if (target.classList.contains('feature-checkbox') && target instanceof HTMLInputElement) {
      const featureId = target.getAttribute('data-feature-id');
      if (featureId) {
        this.toggleFeature(featureId, target.checked);
      }
    }

    // Notes textarea
    if (target.id === 'proposalNotes' && target.tagName === 'TEXTAREA') {
      this.state.selection.notes = (target as unknown as HTMLTextAreaElement).value;
    }

    if (target.id === 'proposalDiscountType' && target instanceof HTMLSelectElement) {
      const value = target.value as DiscountType | '';
      this.state.selection.discountType = value || null;
      this.updateCalculatedPrice();
      this.updatePriceDisplay();
      if (this.state.currentStep === 'summary') this.renderCurrentStep();
    }

    if (target.id === 'proposalDiscountValue') {
      this.state.selection.discountValue = Number(target.value || 0);
      this.updateCalculatedPrice();
      this.updatePriceDisplay();
      if (this.state.currentStep === 'summary') this.renderCurrentStep();
    }

    if (target.id === 'proposalTaxRate') {
      this.state.selection.taxRate = Number(target.value || 0);
      this.updateCalculatedPrice();
      this.updatePriceDisplay();
      if (this.state.currentStep === 'summary') this.renderCurrentStep();
    }

    if (target.id === 'proposalExpirationDate') {
      this.state.selection.expirationDate = target.value || null;
    }

    const itemId = target.getAttribute('data-item-id');
    const itemField = target.getAttribute('data-item-field');
    if (itemId && itemField && target instanceof HTMLInputElement) {
      this.updateCustomItem(itemId, itemField, target);
    }
  }

  /**
   * Select a tier
   */
  private selectTier(tierId: TierId): void {
    if (this.state.selection.selectedTier === tierId) return;

    this.state.selection.selectedTier = tierId;

    // Clear added features when changing tier (they may not be valid)
    this.state.selection.addedFeatures = [];

    this.updateCalculatedPrice();
    this.renderCurrentStep();
    this.updatePriceDisplay();

    // Animate selection
    this.animateTierSelection(tierId);
  }

  /**
   * Toggle a feature addon
   */
  private toggleFeature(featureId: string, isAdded: boolean): void {
    const { addedFeatures } = this.state.selection;

    if (isAdded && !addedFeatures.includes(featureId)) {
      addedFeatures.push(featureId);
    } else if (!isAdded) {
      const index = addedFeatures.indexOf(featureId);
      if (index > -1) {
        addedFeatures.splice(index, 1);
      }
    }

    this.updateCalculatedPrice();
    this.updatePriceDisplay();

    // Update feature item visual state
    const featureItem = this.contentContainer?.querySelector(
      `.feature-item--addon input[data-feature-id="${featureId}"]`
    )?.closest('.feature-item');

    if (featureItem) {
      featureItem.classList.toggle('feature-item--selected', isAdded);
    }
  }

  /**
   * Select a maintenance option
   */
  private selectMaintenance(maintenanceId: MaintenanceId): void {
    // Toggle off if already selected
    if (this.state.selection.maintenanceOption === maintenanceId) {
      this.state.selection.maintenanceOption = null;
    } else {
      this.state.selection.maintenanceOption = maintenanceId;
    }

    this.updateCalculatedPrice();
    this.renderCurrentStep();
    this.updatePriceDisplay();
  }

  /**
   * Handle back button
   */
  private async handleBack(): Promise<void> {
    const currentIndex = STEP_ORDER.indexOf(this.state.currentStep);

    if (currentIndex <= 0) {
      // At first step - cancel the builder
      if (this.onCancel) {
        this.onCancel();
      }
      return;
    }

    // Go to previous step
    this.state.currentStep = STEP_ORDER[currentIndex - 1];

    await animateContentTransition(
      this.contentContainer!,
      '',
      'back'
    );

    this.renderCurrentStep();
    updateStepIndicators(this.state.currentStep);
    this.updateButtonStates();
  }

  /**
   * Handle next/submit button
   */
  private async handleNext(): Promise<void> {
    const currentIndex = STEP_ORDER.indexOf(this.state.currentStep);

    if (currentIndex >= STEP_ORDER.length - 1) {
      // At last step - submit
      await this.submit();
      return;
    }

    // Validate current step before proceeding
    if (!this.validateCurrentStep()) {
      return;
    }

    // Go to next step
    this.state.currentStep = STEP_ORDER[currentIndex + 1];

    await animateContentTransition(
      this.contentContainer!,
      '',
      'forward'
    );

    this.renderCurrentStep();
    updateStepIndicators(this.state.currentStep);
    this.updateButtonStates();
  }

  /**
   * Validate the current step
   */
  private validateCurrentStep(): boolean {
    switch (this.state.currentStep) {
    case 'tier-selection':
      if (!this.state.selection.selectedTier) {
        this.showError('Please select a package tier');
        return false;
      }
      break;

      // Other steps have optional selections
    }

    return true;
  }

  /**
   * Update calculated price
   */
  private updateCalculatedPrice(): void {
    const breakdown = calculatePriceBreakdown(
      this.projectType,
      this.state.selection.selectedTier,
      this.state.selection.addedFeatures,
      this.state.selection.customItems,
      this.state.selection.discountType,
      this.state.selection.discountValue,
      this.state.selection.taxRate
    );

    this.state.selection.calculatedPrice = breakdown.total;
    this.state.selection.basePrice = breakdown.basePrice;
    this.state.selection.subtotal = breakdown.subtotal;
    this.state.selection.discountAmount = breakdown.discountAmount;
    this.state.selection.taxAmount = breakdown.taxAmount;
  }

  /**
   * Update price display
   */
  private updatePriceDisplay(): void {
    if (!this.priceBar || !this.state.configuration) return;

    const tier = this.state.configuration.tiers.find(
      t => t.id === this.state.selection.selectedTier
    );

    if (!tier) return;

    const addedFeatures = this.state.configuration.features.filter(
      f => this.state.selection.addedFeatures.includes(f.id)
    );

    const maintenance = this.state.configuration.maintenanceOptions.find(
      m => m.id === this.state.selection.maintenanceOption
    );

    const computed = calculatePriceBreakdown(
      this.projectType,
      this.state.selection.selectedTier,
      this.state.selection.addedFeatures,
      this.state.selection.customItems,
      this.state.selection.discountType,
      this.state.selection.discountValue,
      this.state.selection.taxRate
    );

    const breakdown: PriceBreakdown = {
      tierBasePrice: computed.basePrice,
      tierName: tier.name,
      addedFeatures: addedFeatures.map(f => ({
        id: f.id,
        name: f.name,
        price: f.price
      })),
      customItems: this.state.selection.customItems,
      maintenanceOption: maintenance
        ? {
          name: maintenance.name,
          price: maintenance.price,
          billingCycle: maintenance.billingCycle
        }
        : null,
      subtotal: computed.subtotal,
      discountType: this.state.selection.discountType,
      discountValue: this.state.selection.discountValue,
      discountAmount: computed.discountAmount,
      taxRate: this.state.selection.taxRate,
      taxAmount: computed.taxAmount,
      total: computed.total
    };

    this.priceBar.innerHTML = renderPriceBar(breakdown);
  }

  /**
   * Update button states based on current step
   */
  private updateButtonStates(): void {
    const backBtn = document.getElementById('proposalBack');
    const nextBtn = document.getElementById('proposalNext');
    const draftBtn = document.getElementById('proposalDraft');

    if (!backBtn || !nextBtn) return;

    const currentIndex = STEP_ORDER.indexOf(this.state.currentStep);
    const isFirstStep = currentIndex === 0;
    const isLastStep = currentIndex === STEP_ORDER.length - 1;

    // Back button
    backBtn.textContent = isFirstStep ? 'Cancel' : 'Back';

    // Next button
    nextBtn.textContent = isLastStep ? 'Submit Proposal' : 'Continue';
    nextBtn.classList.toggle('proposal-btn-submit', isLastStep);

    if (draftBtn) {
      draftBtn.style.display = isLastStep ? 'inline-flex' : 'none';
    }
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
    this.updateCalculatedPrice();
    this.renderCurrentStep();
    this.updatePriceDisplay();
  }

  private removeCustomItem(itemId: string): void {
    this.state.selection.customItems = this.state.selection.customItems.filter(item => item.id !== itemId);
    this.updateCalculatedPrice();
    this.renderCurrentStep();
    this.updatePriceDisplay();
  }

  private updateCustomItem(itemId: string, field: string, target: HTMLInputElement): void {
    const items = this.state.selection.customItems.map(item => ({ ...item }));
    const item = items.find(entry => entry.id === itemId);
    if (!item) return;

    if (field === 'itemType') item.itemType = target.value as ProposalCustomItem['itemType'];
    if (field === 'description') item.description = target.value;
    if (field === 'unitPrice') item.unitPrice = Number(target.value || 0);
    if (field === 'quantity') item.quantity = Math.max(1, Number(target.value || 1));
    if (field === 'unitLabel') item.unitLabel = target.value;
    if (field === 'isTaxable') item.isTaxable = target.checked;
    if (field === 'isOptional') item.isOptional = target.checked;

    this.state.selection.customItems = items;
    this.updateCalculatedPrice();
    this.updatePriceDisplay();
    if (this.state.currentStep === 'summary') this.renderCurrentStep();
  }

  private saveDraft(): void {
    const draftKey = `proposalBuilderDraft:${this.projectType}`;
    const draft = {
      projectType: this.projectType,
      selection: this.state.selection
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
    showToast('Draft saved', 'success');
  }

  private loadDraftIfAvailable(): void {
    const draftKey = `proposalBuilderDraft:${this.projectType}`;
    const rawDraft = localStorage.getItem(draftKey);
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as { projectType?: ProjectType; selection?: ProposalSelection };
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
      console.error('[ProposalBuilder] Failed to load draft:', error);
    }
  }

  /**
   * Animate tier selection
   */
  private animateTierSelection(tierId: TierId): void {
    // Remove selected class from all
    document.querySelectorAll('.tier-card').forEach(card => {
      card.classList.remove('tier-card--selected');
      const btn = card.querySelector('.tier-select-btn');
      if (btn) {
        btn.classList.remove('selected');
        btn.textContent = `Select ${card.querySelector('.tier-name')?.textContent || ''}`;
      }
    });

    // Add selected class to chosen tier
    const selectedCard = document.querySelector(`.tier-card[data-tier-id="${tierId}"]`);
    if (selectedCard) {
      selectedCard.classList.add('tier-card--selected');
      const btn = selectedCard.querySelector('.tier-select-btn');
      if (btn) {
        btn.classList.add('selected');
        btn.textContent = 'Selected';
      }

      // Animate the selection
      gsap.fromTo(selectedCard, {
        scale: 0.98
      }, {
        scale: 1,
        duration: 0.3,
        ease: 'back.out(1.5)'
      });
    }
  }

  /**
   * Animate the builder in
   */
  private async animateIn(): Promise<void> {
    const builder = this.container.querySelector('.proposal-builder');
    if (!builder) return;

    gsap.fromTo(builder, {
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
    // Could implement a toast notification here
    console.error('[ProposalBuilder]', message);
  }

  /**
   * Submit the proposal
   */
  private async submit(): Promise<void> {
    if (!this.state.configuration) return;

    // Capture notes from textarea
    const notesTextarea = document.getElementById('proposalNotes') as HTMLTextAreaElement;
    if (notesTextarea) {
      this.state.selection.notes = notesTextarea.value;
    }

    // Get all selected features (included in tier + addons)
    const tier = this.state.configuration.tiers.find(
      t => t.id === this.state.selection.selectedTier
    );

    if (!tier) {
      this.showError('Invalid tier selection');
      return;
    }

    const includedFeatures = this.state.configuration.features.filter(
      f => tier.baseFeatures.includes(f.id)
    );

    const addonFeatures = this.state.configuration.features.filter(
      f => this.state.selection.addedFeatures.includes(f.id)
    );

    // Build feature list for submission
    const features = [
      ...includedFeatures.map(f => ({
        featureId: f.id,
        featureName: f.name,
        featurePrice: 0, // Included in tier
        featureCategory: f.category,
        isIncludedInTier: true,
        isAddon: false
      })),
      ...addonFeatures.map(f => ({
        featureId: f.id,
        featureName: f.name,
        featurePrice: f.price,
        featureCategory: f.category,
        isIncludedInTier: false,
        isAddon: true
      }))
    ];

    const breakdown = calculatePriceBreakdown(
      this.projectType,
      this.state.selection.selectedTier,
      this.state.selection.addedFeatures,
      this.state.selection.customItems,
      this.state.selection.discountType,
      this.state.selection.discountValue,
      this.state.selection.taxRate
    );

    // Update selection with final values
    this.state.selection.calculatedPrice = breakdown.total;
    this.state.selection.basePrice = breakdown.basePrice;
    this.state.selection.subtotal = breakdown.subtotal;
    this.state.selection.discountAmount = breakdown.discountAmount;
    this.state.selection.taxAmount = breakdown.taxAmount;

    console.log('[ProposalBuilder] Submitting proposal:', {
      selection: this.state.selection,
      features,
      basePrice: breakdown.basePrice,
      finalPrice: breakdown.total,
      subtotal: breakdown.subtotal,
      discountAmount: breakdown.discountAmount,
      taxAmount: breakdown.taxAmount
    });

    // Call completion handler
    if (this.onComplete) {
      this.onComplete(this.state.selection);
    }
  }

  /**
   * Get the current selection state
   */
  getSelection(): ProposalSelection {
    return { ...this.state.selection };
  }

  /**
   * Wait for user to complete the builder and return their selection
   */
  async getSelectionAsync(): Promise<ProposalSelection | null> {
    return new Promise((resolve) => {
      this.onComplete = (selection) => resolve(selection);
      this.onCancel = () => resolve(null);
    });
  }

  /**
   * Destroy the module and clean up
   */
  destroy(): void {
    this.container.innerHTML = '';
    this.contentContainer = null;
    this.priceBar = null;
    this.onComplete = null;
    this.onCancel = null;
  }
}

export default ProposalBuilderModule;
