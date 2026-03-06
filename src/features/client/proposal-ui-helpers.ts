/**
 * ===============================================
 * PROPOSAL BUILDER - UI HELPER UTILITIES
 * ===============================================
 * @file src/features/client/proposal-ui-helpers.ts
 *
 * SVG icon creation, animation helpers, rendering functions for
 * tier cards, maintenance cards, feature table/checklist, and summary.
 * Extracted from proposal-builder-ui.ts for maintainability.
 */

import { gsap } from 'gsap';
import type {
  ProposalTier,
  ProposalFeature,
  ProposalSelection,
  MaintenanceOption,
  ProposalStep
} from './proposal-builder-types';
import type { TierId } from './proposal-builder-types';
import { formatPrice, formatPriceRange } from './proposal-builder-data';

// ---------------------------------------------------------------------------
// SVG Icon Creators
// ---------------------------------------------------------------------------

export function createCheckIcon(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
}

export function createPlusIcon(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
}

export function createDashIcon(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>';
}

// ---------------------------------------------------------------------------
// Feature comparison table
// ---------------------------------------------------------------------------

export function renderFeatureTable(tiers: ProposalTier[], features: ProposalFeature[]): string {
  const groupedFeatures = features.reduce(
    (acc, feature) => {
      if (!acc[feature.category]) {
        acc[feature.category] = [];
      }
      acc[feature.category].push(feature);
      return acc;
    },
    {} as Record<string, ProposalFeature[]>
  );

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
              ${tiers.map((t) => `<th class="tier-column ${t.highlighted ? 'highlighted' : ''}">${t.name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${Object.entries(groupedFeatures)
    .map(
      ([category, categoryFeatures]) => `
              <tr class="category-row">
                <td colspan="${tiers.length + 1}" class="category-label">${categoryLabels[category] || category}</td>
              </tr>
              ${categoryFeatures
    .map(
      (feature) => `
                <tr class="feature-row">
                  <td class="feature-name-cell">
                    <span class="feature-name">${feature.name}</span>
                    <span class="feature-description">${feature.description}</span>
                  </td>
                  ${tiers
    .map(
      (tier) => `
                    <td class="feature-check-cell ${tier.highlighted ? 'highlighted' : ''}">
                      ${
  tier.baseFeatures.includes(feature.id)
    ? `<span class="check-included">${createCheckIcon()}</span>`
    : feature.price > 0
      ? `<span class="check-addon">+${formatPrice(feature.price)}</span>`
      : `<span class="check-none">${createDashIcon()}</span>`
}
                    </td>
                  `
    )
    .join('')}
                </tr>
              `
    )
    .join('')}
            `
    )
    .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Tier card rendering
// ---------------------------------------------------------------------------

export function renderTierCard(
  tier: ProposalTier,
  allFeatures: ProposalFeature[],
  isSelected: boolean
): string {
  const tierFeatures = allFeatures.filter((f) => tier.baseFeatures.includes(f.id));
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
        ${tierFeatures
    .map(
      (f) => `
          <li class="tier-feature">
            <span class="feature-check">${createCheckIcon()}</span>
            <span class="feature-name">${f.name}</span>
          </li>
        `
    )
    .join('')}
      </ul>
      <button class="tier-select-btn ${isSelected ? 'selected' : ''}" data-tier-id="${tier.id}">
        ${isSelected ? 'Selected' : `Select ${tier.name}`}
      </button>
    </div>
  `;
}

/**
 * Render tier selection cards grid
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
        ${tiers.map((tier) => renderTierCard(tier, features, selectedTierId === tier.id)).join('')}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Maintenance card rendering
// ---------------------------------------------------------------------------

/**
 * Render maintenance options grid
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
        ${options.map((option) => renderMaintenanceCard(option, selectedId === option.id)).join('')}
      </div>
    </div>
  `;
}

export function renderMaintenanceCard(option: MaintenanceOption, isSelected: boolean): string {
  const highlightClass = option.highlighted ? 'maintenance-card--recommended' : '';
  const selectedClass = isSelected ? 'maintenance-card--selected' : '';
  const priceDisplay =
    option.price === 0
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
        ${option.features
    .map(
      (f) => `
          <li class="maintenance-feature">
            <span class="feature-check">${createCheckIcon()}</span>
            <span>${f}</span>
          </li>
        `
    )
    .join('')}
      </ul>
      <button class="maintenance-select-btn ${isSelected ? 'selected' : ''}" data-maintenance-id="${option.id}">
        ${isSelected ? 'Selected' : 'Select Plan'}
      </button>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Feature customization checklist
// ---------------------------------------------------------------------------

export function renderFeatureChecklist(
  selectedTier: ProposalTier,
  allFeatures: ProposalFeature[],
  addedFeatures: string[]
): string {
  const includedFeatures = allFeatures.filter((f) => selectedTier.baseFeatures.includes(f.id));
  const availableAddons = allFeatures.filter(
    (f) => !selectedTier.baseFeatures.includes(f.id) && !f.isRequired && f.price > 0
  );

  return `
    <div class="feature-customization">
      <h3 class="section-title">Customize Your Package</h3>
      <p class="section-description">Your ${selectedTier.name} package includes the features below. Add extras to enhance your project.</p>

      <div class="feature-section">
        <h4 class="feature-section-title">Included in ${selectedTier.name}</h4>
        <div class="feature-list feature-list--included">
          ${includedFeatures
    .map(
      (feature) => `
            <div class="feature-item feature-item--included">
              <span class="feature-check">${createCheckIcon()}</span>
              <div class="feature-info">
                <span class="feature-name">${feature.name}</span>
                <span class="feature-description">${feature.description}</span>
              </div>
              <span class="feature-price">Included</span>
            </div>
          `
    )
    .join('')}
        </div>
      </div>

      ${
  availableAddons.length > 0
    ? `
        <div class="feature-section">
          <h4 class="feature-section-title">Available Add-ons</h4>
          <div class="feature-list feature-list--addons">
            ${availableAddons
    .map(
      (feature) => `
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
            `
    )
    .join('')}
          </div>
        </div>
      `
    : ''
}
    </div>
  `;
}

// Summary rendering extracted to proposal-summary.ts to keep this file manageable
export { renderSummary } from './proposal-summary';

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

export async function animateContentTransition(
  container: HTMLElement,
  newContent: string,
  direction: 'forward' | 'back' = 'forward'
): Promise<void> {
  const xOffset = direction === 'forward' ? 30 : -30;

  await gsap.to(container, {
    opacity: 0,
    x: -xOffset,
    duration: 0.2,
    ease: 'power2.in'
  });

  container.innerHTML = newContent;

  gsap.set(container, { x: xOffset });
  await gsap.to(container, {
    opacity: 1,
    x: 0,
    duration: 0.3,
    ease: 'power2.out'
  });
}

export function animatePriceUpdate(element: HTMLElement, newPrice: number): void {
  const currentValue = parseInt(element.textContent?.replace(/[^0-9]/g, '') || '0', 10);

  gsap.to(
    { value: currentValue },
    {
      value: newPrice,
      duration: 0.5,
      ease: 'power2.out',
      onUpdate: function () {
        element.textContent = formatPrice(Math.round(this.targets()[0].value));
      }
    }
  );
}

export function updateStepIndicators(currentStep: ProposalStep): void {
  const steps: ProposalStep[] = [
    'tier-selection',
    'feature-customization',
    'maintenance',
    'summary'
  ];
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
