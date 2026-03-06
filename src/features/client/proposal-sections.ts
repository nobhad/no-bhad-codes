/**
 * ===============================================
 * PROPOSAL BUILDER - SECTION RENDERERS
 * ===============================================
 * @file src/features/client/proposal-sections.ts
 *
 * Step rendering and tier/maintenance selection animations.
 * Extracted from proposal-builder.ts for maintainability.
 */

import { gsap } from 'gsap';
import type {
  TierId,
  ProposalStep,
  ProposalBuilderState
} from './proposal-builder-types';
import {
  renderTierCards,
  renderFeatureChecklist,
  renderMaintenanceOptions,
  updateStepIndicators
} from './proposal-builder-ui';
import { renderSummary } from './proposal-summary';

/**
 * Render content for the given step into the container
 */
export function renderStepContent(
  contentContainer: HTMLElement,
  state: ProposalBuilderState
): void {
  if (!state.configuration) return;

  const { tiers, features, maintenanceOptions } = state.configuration;
  const tier = tiers.find((t) => t.id === state.selection.selectedTier);

  let content = '';

  switch (state.currentStep) {
  case 'tier-selection':
    content = renderTierCards(tiers, features, state.selection.selectedTier);
    break;

  case 'feature-customization':
    if (tier) {
      content = renderFeatureChecklist(tier, features, state.selection.addedFeatures);
    }
    break;

  case 'maintenance':
    content = renderMaintenanceOptions(
      maintenanceOptions,
      state.selection.maintenanceOption
    );
    break;

  case 'summary':
    if (tier) {
      content = renderSummary(state.selection, tier, features, maintenanceOptions);
    }
    break;
  }

  contentContainer.innerHTML = content;
}

/**
 * Update navigation button states based on current step
 */
export function updateButtonStates(
  currentStep: ProposalStep,
  stepOrder: ProposalStep[]
): void {
  const backBtn = document.getElementById('proposalBack');
  const nextBtn = document.getElementById('proposalNext');
  const draftBtn = document.getElementById('proposalDraft');

  if (!backBtn || !nextBtn) return;

  const currentIndex = stepOrder.indexOf(currentStep);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === stepOrder.length - 1;

  backBtn.textContent = isFirstStep ? 'Cancel' : 'Back';
  nextBtn.textContent = isLastStep ? 'Submit Proposal' : 'Continue';
  nextBtn.classList.toggle('proposal-btn-submit', isLastStep);

  if (draftBtn) {
    draftBtn.style.display = isLastStep ? 'inline-flex' : 'none';
  }
}

/**
 * Animate tier card selection
 */
export function animateTierSelection(tierId: TierId): void {
  // Remove selected class from all
  document.querySelectorAll('.tier-card').forEach((card) => {
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

    gsap.fromTo(
      selectedCard,
      { scale: 0.98 },
      { scale: 1, duration: 0.3, ease: 'back.out(1.5)' }
    );
  }
}

/**
 * Animate the builder entrance
 */
export async function animateBuilderIn(container: HTMLElement): Promise<void> {
  const builder = container.querySelector('.proposal-builder');
  if (!builder) return;

  gsap.fromTo(
    builder,
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
  );
}

/**
 * Synchronize step indicators with current step
 */
export function syncStepIndicators(currentStep: ProposalStep): void {
  updateStepIndicators(currentStep);
}
