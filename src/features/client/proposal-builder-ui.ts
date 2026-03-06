/**
 * ===============================================
 * PROPOSAL BUILDER - UI RENDERING
 * ===============================================
 * @file src/features/client/proposal-builder-ui.ts
 *
 * Main proposal builder container and price bar rendering.
 * Delegates component rendering to proposal-ui-helpers.ts.
 */

import type { PriceBreakdown } from './proposal-builder-types';
import { formatPrice } from './proposal-builder-data';

// Re-export all component renderers and utilities for external consumers
export {
  renderFeatureTable,
  renderFeatureChecklist,
  renderTierCard,
  renderMaintenanceCard,
  renderSummary,
  renderTierCards,
  renderMaintenanceOptions,
  animateContentTransition,
  animatePriceUpdate,
  updateStepIndicators,
  scrollToElement,
  createCheckIcon,
  createPlusIcon,
  createDashIcon
} from './proposal-ui-helpers';

/**
 * Render the main proposal builder container
 */
export function renderProposalBuilderHTML(): string {
  return `
    <div class="proposal-builder">
      <div class="proposal-header">
        <h2 class="proposal-title">Customize Your Project Package</h2>
        <p class="proposal-subtitle">Select a tier and customize features to match your needs</p>
      </div>
      <div class="proposal-steps">
        <div class="step-indicator" data-step="tier-selection">
          <span class="step-number">1</span>
          <span class="step-label">Select Tier</span>
        </div>
        <div class="step-divider"></div>
        <div class="step-indicator" data-step="feature-customization">
          <span class="step-number">2</span>
          <span class="step-label">Customize Features</span>
        </div>
        <div class="step-divider"></div>
        <div class="step-indicator" data-step="maintenance">
          <span class="step-number">3</span>
          <span class="step-label">Maintenance</span>
        </div>
        <div class="step-divider"></div>
        <div class="step-indicator" data-step="summary">
          <span class="step-number">4</span>
          <span class="step-label">Review</span>
        </div>
      </div>
      <div class="proposal-content" id="proposalContent">
        <!-- Content rendered dynamically -->
      </div>
      <div class="proposal-price-bar" id="proposalPriceBar">
        <div class="price-breakdown">
          <span class="price-label">Estimated Total:</span>
          <span class="price-value" id="priceValue">$0</span>
        </div>
      </div>
      <div class="proposal-actions">
        <button class="proposal-btn proposal-btn-secondary" id="proposalBack">Back</button>
        <button class="proposal-btn proposal-btn-secondary" id="proposalDraft" type="button">Save Draft</button>
        <button class="proposal-btn proposal-btn-primary" id="proposalNext">Continue</button>
      </div>
    </div>
  `;
}

/**
 * Render price breakdown in the sticky bar
 */
export function renderPriceBar(breakdown: PriceBreakdown): string {
  return `
    <div class="price-breakdown">
      <div class="price-details">
        <span class="price-tier">${breakdown.tierName}</span>
        ${
  breakdown.addedFeatures.length > 0
    ? `<span class="price-addons">+${breakdown.addedFeatures.length} add-on${breakdown.addedFeatures.length > 1 ? 's' : ''}</span>`
    : ''
}
        ${
  breakdown.customItems.length > 0
    ? `<span class="price-addons">+${breakdown.customItems.length} custom</span>`
    : ''
}
      </div>
      <div class="price-total">
        <span class="price-label">Estimated:</span>
        <span class="price-value">${formatPrice(breakdown.total)}</span>
      </div>
    </div>
  `;
}
