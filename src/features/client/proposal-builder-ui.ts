/**
 * ===============================================
 * PROPOSAL BUILDER - UI UTILITIES
 * ===============================================
 * @file src/features/client/proposal-builder-ui.ts
 *
 * UI rendering functions for the tiered proposal builder.
 * Renders tier cards, feature tables, maintenance options, and price summary.
 */

import { gsap } from 'gsap';
import type {
  TierId,
  ProposalTier,
  ProposalFeature,
  MaintenanceOption,
  ProposalSelection,
  PriceBreakdown,
  ProposalStep
} from './proposal-builder-types';
import { formatPrice, formatPriceRange } from './proposal-builder-data';

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
        <button class="proposal-btn proposal-btn-primary" id="proposalNext">Continue</button>
      </div>
    </div>
  `;
}

/**
 * Render tier selection cards
 */
export function renderTierCards(
  tiers: ProposalTier[],
  features: ProposalFeature[],
  selectedTierId: TierId | null
): string {
  return `
    <div class="tier-selection">
      <h3 class="section-title">Choose Your Package</h3>
      <div class="tier-grid">
        ${tiers.map(tier => renderTierCard(tier, features, selectedTierId === tier.id)).join('')}
      </div>
    </div>
  `;
}

/**
 * Render a single tier card
 */
function renderTierCard(
  tier: ProposalTier,
  allFeatures: ProposalFeature[],
  isSelected: boolean
): string {
  const tierFeatures = allFeatures.filter(f => tier.baseFeatures.includes(f.id));
  const highlightClass = tier.highlighted ? 'tier-card--recommended' : '';
  const selectedClass = isSelected ? 'tier-card--selected' : '';

  return `
    <div class="tier-card ${highlightClass} ${selectedClass}" data-tier-id="${tier.id}">
      ${tier.highlighted ? '<div class="tier-badge">Recommended</div>' : ''}
      <div class="tier-header">
        <h4 class="tier-name">${tier.name}</h4>
        <p class="tier-tagline">${tier.tagline}</p>
      </div>
      <div class="tier-price">
        <span class="price-range">${formatPriceRange(tier.priceRange.min, tier.priceRange.max)}</span>
      </div>
      <div class="tier-description">
        <p>${tier.description || ''}</p>
      </div>
      <ul class="tier-features">
        ${tierFeatures.map(f => `
          <li class="tier-feature">
            <span class="feature-check">${createCheckIcon()}</span>
            <span class="feature-name">${f.name}</span>
          </li>
        `).join('')}
      </ul>
      <button class="tier-select-btn ${isSelected ? 'selected' : ''}" data-tier-id="${tier.id}">
        ${isSelected ? 'Selected' : `Select ${tier.name}`}
      </button>
    </div>
  `;
}

/**
 * Render feature comparison table
 */
export function renderFeatureTable(
  tiers: ProposalTier[],
  features: ProposalFeature[]
): string {
  // Group features by category
  const groupedFeatures = features.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, ProposalFeature[]>);

  const categoryLabels: Record<string, string> = {
    design: 'Design',
    development: 'Development',
    support: 'Support',
    marketing: 'Marketing'
  };

  return `
    <div class="feature-comparison">
      <h3 class="section-title">Feature Comparison</h3>
      <div class="comparison-table-wrapper">
        <table class="comparison-table">
          <thead>
            <tr>
              <th class="feature-column">Feature</th>
              ${tiers.map(t => `<th class="tier-column ${t.highlighted ? 'highlighted' : ''}">${t.name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${Object.entries(groupedFeatures).map(([category, categoryFeatures]) => `
              <tr class="category-row">
                <td colspan="${tiers.length + 1}" class="category-label">${categoryLabels[category] || category}</td>
              </tr>
              ${categoryFeatures.map(feature => `
                <tr class="feature-row">
                  <td class="feature-name-cell">
                    <span class="feature-name">${feature.name}</span>
                    <span class="feature-description">${feature.description}</span>
                  </td>
                  ${tiers.map(tier => `
                    <td class="feature-check-cell ${tier.highlighted ? 'highlighted' : ''}">
                      ${tier.baseFeatures.includes(feature.id)
    ? `<span class="check-included">${createCheckIcon()}</span>`
    : feature.price > 0
      ? `<span class="check-addon">+${formatPrice(feature.price)}</span>`
      : `<span class="check-none">${createDashIcon()}</span>`
}
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Render feature customization checklist
 */
export function renderFeatureChecklist(
  selectedTier: ProposalTier,
  allFeatures: ProposalFeature[],
  addedFeatures: string[]
): string {
  const includedFeatures = allFeatures.filter(f => selectedTier.baseFeatures.includes(f.id));
  const availableAddons = allFeatures.filter(
    f => !selectedTier.baseFeatures.includes(f.id) && !f.isRequired && f.price > 0
  );

  return `
    <div class="feature-customization">
      <h3 class="section-title">Customize Your Package</h3>
      <p class="section-description">Your ${selectedTier.name} package includes the features below. Add extras to enhance your project.</p>

      <div class="feature-section">
        <h4 class="feature-section-title">Included in ${selectedTier.name}</h4>
        <div class="feature-list feature-list--included">
          ${includedFeatures.map(feature => `
            <div class="feature-item feature-item--included">
              <span class="feature-check">${createCheckIcon()}</span>
              <div class="feature-info">
                <span class="feature-name">${feature.name}</span>
                <span class="feature-description">${feature.description}</span>
              </div>
              <span class="feature-price">Included</span>
            </div>
          `).join('')}
        </div>
      </div>

      ${availableAddons.length > 0 ? `
        <div class="feature-section">
          <h4 class="feature-section-title">Available Add-ons</h4>
          <div class="feature-list feature-list--addons">
            ${availableAddons.map(feature => `
              <label class="feature-item feature-item--addon ${addedFeatures.includes(feature.id) ? 'feature-item--selected' : ''}">
                <input type="checkbox"
                       class="feature-checkbox"
                       data-feature-id="${feature.id}"
                       ${addedFeatures.includes(feature.id) ? 'checked' : ''}>
                <span class="feature-checkbox-custom"></span>
                <div class="feature-info">
                  <span class="feature-name">${feature.name}</span>
                  <span class="feature-description">${feature.description}</span>
                </div>
                <span class="feature-price">+${formatPrice(feature.price)}</span>
              </label>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render maintenance options
 */
export function renderMaintenanceOptions(
  options: MaintenanceOption[],
  selectedId: string | null
): string {
  return `
    <div class="maintenance-selection">
      <h3 class="section-title">Choose a Maintenance Plan</h3>
      <p class="section-description">Keep your site secure, updated, and running smoothly with our maintenance plans.</p>

      <div class="maintenance-grid">
        ${options.map(option => renderMaintenanceCard(option, selectedId === option.id)).join('')}
      </div>
    </div>
  `;
}

/**
 * Render a single maintenance option card
 */
function renderMaintenanceCard(option: MaintenanceOption, isSelected: boolean): string {
  const highlightClass = option.highlighted ? 'maintenance-card--recommended' : '';
  const selectedClass = isSelected ? 'maintenance-card--selected' : '';
  const priceDisplay = option.price === 0
    ? 'Free'
    : `${formatPrice(option.price)}<span class="billing-cycle">/${option.billingCycle === 'monthly' ? 'mo' : 'yr'}</span>`;

  return `
    <div class="maintenance-card ${highlightClass} ${selectedClass}" data-maintenance-id="${option.id}">
      ${option.highlighted ? '<div class="maintenance-badge">Recommended</div>' : ''}
      <div class="maintenance-header">
        <h4 class="maintenance-name">${option.name}</h4>
        <div class="maintenance-price">${priceDisplay}</div>
      </div>
      ${option.description ? `<p class="maintenance-description">${option.description}</p>` : ''}
      <ul class="maintenance-features">
        ${option.features.map(f => `
          <li class="maintenance-feature">
            <span class="feature-check">${createCheckIcon()}</span>
            <span>${f}</span>
          </li>
        `).join('')}
      </ul>
      <button class="maintenance-select-btn ${isSelected ? 'selected' : ''}" data-maintenance-id="${option.id}">
        ${isSelected ? 'Selected' : 'Select Plan'}
      </button>
    </div>
  `;
}

/**
 * Render the final summary view
 */
export function renderSummary(
  selection: ProposalSelection,
  tier: ProposalTier,
  features: ProposalFeature[],
  maintenanceOptions: MaintenanceOption[]
): string {
  const includedFeatures = features.filter(f => tier.baseFeatures.includes(f.id));
  const addedFeatures = features.filter(f => selection.addedFeatures.includes(f.id));
  const maintenance = maintenanceOptions.find(m => m.id === selection.maintenanceOption);

  // Calculate base price (midpoint of range)
  const basePrice = Math.round((tier.priceRange.min + tier.priceRange.max) / 2);
  const addonsTotal = addedFeatures.reduce((sum, f) => sum + f.price, 0);
  const projectTotal = basePrice + addonsTotal;

  return `
    <div class="proposal-summary">
      <h3 class="section-title">Review Your Proposal</h3>
      <p class="section-description">Please review your selections before submitting.</p>

      <div class="summary-section">
        <div class="summary-tier">
          <div class="summary-tier-header">
            <h4>${tier.name} Package</h4>
            <span class="summary-tier-price">${formatPrice(basePrice)}</span>
          </div>
          <p class="summary-tier-description">${tier.description || tier.tagline}</p>
        </div>
      </div>

      <div class="summary-section">
        <h4 class="summary-section-title">Included Features</h4>
        <ul class="summary-feature-list">
          ${includedFeatures.map(f => `
            <li class="summary-feature">
              <span class="feature-check">${createCheckIcon()}</span>
              <span>${f.name}</span>
            </li>
          `).join('')}
        </ul>
      </div>

      ${addedFeatures.length > 0 ? `
        <div class="summary-section">
          <h4 class="summary-section-title">Add-ons Selected</h4>
          <ul class="summary-feature-list summary-addons">
            ${addedFeatures.map(f => `
              <li class="summary-feature summary-addon">
                <span class="feature-check">${createPlusIcon()}</span>
                <span>${f.name}</span>
                <span class="addon-price">+${formatPrice(f.price)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      ${maintenance ? `
        <div class="summary-section">
          <h4 class="summary-section-title">Maintenance Plan</h4>
          <div class="summary-maintenance">
            <span class="maintenance-name">${maintenance.name}</span>
            <span class="maintenance-price">
              ${maintenance.price === 0 ? 'Free' : `${formatPrice(maintenance.price)}/mo`}
            </span>
          </div>
        </div>
      ` : ''}

      <div class="summary-section summary-notes">
        <h4 class="summary-section-title">Additional Notes (Optional)</h4>
        <textarea
          class="summary-notes-input"
          id="proposalNotes"
          placeholder="Any special requirements, questions, or details you'd like to share..."
          rows="4"
        >${selection.notes || ''}</textarea>
      </div>

      <div class="summary-total">
        <div class="total-breakdown">
          <div class="total-row">
            <span>Base Package</span>
            <span>${formatPrice(basePrice)}</span>
          </div>
          ${addonsTotal > 0 ? `
            <div class="total-row">
              <span>Add-ons</span>
              <span>+${formatPrice(addonsTotal)}</span>
            </div>
          ` : ''}
          <div class="total-row total-row--final">
            <span>One-time Total</span>
            <span>${formatPrice(projectTotal)}</span>
          </div>
          ${maintenance && maintenance.price > 0 ? `
            <div class="total-row total-row--recurring">
              <span>Monthly Maintenance</span>
              <span>${formatPrice(maintenance.price)}/mo</span>
            </div>
          ` : ''}
        </div>
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
        ${breakdown.addedFeatures.length > 0
    ? `<span class="price-addons">+${breakdown.addedFeatures.length} add-on${breakdown.addedFeatures.length > 1 ? 's' : ''}</span>`
    : ''}
      </div>
      <div class="price-total">
        <span class="price-label">Estimated:</span>
        <span class="price-value">${formatPrice(breakdown.total)}</span>
      </div>
    </div>
  `;
}

/**
 * Update step indicators
 */
export function updateStepIndicators(currentStep: ProposalStep): void {
  const steps: ProposalStep[] = ['tier-selection', 'feature-customization', 'maintenance', 'summary'];
  const currentIndex = steps.indexOf(currentStep);

  document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
    indicator.classList.remove('step--active', 'step--completed');
    if (index < currentIndex) {
      indicator.classList.add('step--completed');
    } else if (index === currentIndex) {
      indicator.classList.add('step--active');
    }
  });
}

/**
 * Animate content transition
 */
export async function animateContentTransition(
  container: HTMLElement,
  newContent: string,
  direction: 'forward' | 'back' = 'forward'
): Promise<void> {
  const xOffset = direction === 'forward' ? 30 : -30;

  // Fade out current content
  await gsap.to(container, {
    opacity: 0,
    x: -xOffset,
    duration: 0.2,
    ease: 'power2.in'
  });

  // Update content
  container.innerHTML = newContent;

  // Fade in new content
  gsap.set(container, { x: xOffset });
  await gsap.to(container, {
    opacity: 1,
    x: 0,
    duration: 0.3,
    ease: 'power2.out'
  });
}

/**
 * Animate price update
 */
export function animatePriceUpdate(element: HTMLElement, newPrice: number): void {
  const currentValue = parseInt(element.textContent?.replace(/[^0-9]/g, '') || '0', 10);

  gsap.to({ value: currentValue }, {
    value: newPrice,
    duration: 0.5,
    ease: 'power2.out',
    onUpdate: function () {
      element.textContent = formatPrice(Math.round(this.targets()[0].value));
    }
  });
}

/**
 * Create check icon SVG
 */
function createCheckIcon(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
}

/**
 * Create plus icon SVG
 */
function createPlusIcon(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
}

/**
 * Create dash icon SVG
 */
function createDashIcon(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>';
}

/**
 * Scroll container to show element
 */
export function scrollToElement(element: HTMLElement, container?: HTMLElement): void {
  const scrollContainer = container || element.closest('.proposal-content');
  if (scrollContainer) {
    gsap.to(scrollContainer, {
      scrollTop: element.offsetTop - 20,
      duration: 0.3,
      ease: 'power2.out'
    });
  }
}
