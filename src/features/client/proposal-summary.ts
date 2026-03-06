/**
 * ===============================================
 * PROPOSAL BUILDER - SUMMARY RENDERER
 * ===============================================
 * @file src/features/client/proposal-summary.ts
 *
 * Renders the final summary/review step of the proposal builder.
 * Extracted from proposal-builder-ui.ts for maintainability.
 */

import type {
  ProposalTier,
  ProposalFeature,
  ProposalSelection,
  MaintenanceOption
} from './proposal-builder-types';
import { formatPrice } from './proposal-builder-data';
import { createCheckIcon, createPlusIcon, createDashIcon } from './proposal-ui-helpers';

/**
 * Render the final summary view
 */
export function renderSummary(
  selection: ProposalSelection,
  tier: ProposalTier,
  features: ProposalFeature[],
  maintenanceOptions: MaintenanceOption[]
): string {
  const includedFeatures = features.filter((f) => tier.baseFeatures.includes(f.id));
  const addedFeatures = features.filter((f) => selection.addedFeatures.includes(f.id));
  const maintenance = maintenanceOptions.find((m) => m.id === selection.maintenanceOption);
  const customItems = selection.customItems || [];

  // Calculate base price (midpoint of range)
  const basePrice = Math.round((tier.priceRange.min + tier.priceRange.max) / 2);
  const addonsTotal = addedFeatures.reduce((sum, f) => sum + f.price, 0);
  const customItemsTotal = customItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const subtotal = basePrice + addonsTotal + customItemsTotal;
  const discountType = selection.discountType;
  const discountValue = selection.discountValue || 0;
  const discountAmount =
    discountType === 'percentage'
      ? Math.min(subtotal, (subtotal * discountValue) / 100)
      : Math.min(subtotal, discountValue);
  const taxableTotal = Math.max(0, subtotal - discountAmount);
  const taxRate = selection.taxRate || 0;
  const taxAmount = (taxableTotal * taxRate) / 100;
  const projectTotal = Math.max(0, taxableTotal + taxAmount);

  return renderSummaryHTML({
    tier,
    includedFeatures,
    addedFeatures,
    maintenance,
    customItems,
    selection,
    basePrice,
    addonsTotal,
    customItemsTotal,
    discountType,
    discountValue,
    discountAmount,
    taxRate,
    taxAmount,
    projectTotal
  });
}

// ---------------------------------------------------------------------------
// Summary HTML template
// ---------------------------------------------------------------------------

interface SummaryTemplateData {
  tier: ProposalTier;
  includedFeatures: ProposalFeature[];
  addedFeatures: ProposalFeature[];
  maintenance: MaintenanceOption | undefined;
  customItems: ProposalSelection['customItems'];
  selection: ProposalSelection;
  basePrice: number;
  addonsTotal: number;
  customItemsTotal: number;
  discountType: ProposalSelection['discountType'];
  discountValue: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  projectTotal: number;
}

function renderSummaryHTML(data: SummaryTemplateData): string {
  const {
    tier, includedFeatures, addedFeatures, maintenance, customItems,
    selection, basePrice, addonsTotal, customItemsTotal,
    discountType, discountValue, discountAmount, taxRate, taxAmount, projectTotal
  } = data;

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
          ${includedFeatures
    .map(
      (f) => `
            <li class="summary-feature">
              <span class="feature-check">${createCheckIcon()}</span>
              <span>${f.name}</span>
            </li>
          `
    )
    .join('')}
        </ul>
      </div>

      ${
  addedFeatures.length > 0
    ? `
        <div class="summary-section">
          <h4 class="summary-section-title">Add-ons Selected</h4>
          <ul class="summary-feature-list summary-addons">
            ${addedFeatures
    .map(
      (f) => `
              <li class="summary-feature summary-addon">
                <span class="feature-check">${createPlusIcon()}</span>
                <span>${f.name}</span>
                <span class="addon-price">+${formatPrice(f.price)}</span>
              </li>
            `
    )
    .join('')}
          </ul>
        </div>
      `
    : ''
}

      ${
  maintenance
    ? `
        <div class="summary-section">
          <h4 class="summary-section-title">Maintenance Plan</h4>
          <div class="summary-maintenance">
            <span class="maintenance-name">${maintenance.name}</span>
            <span class="maintenance-price">
              ${maintenance.price === 0 ? 'Free' : `${formatPrice(maintenance.price)}/mo`}
            </span>
          </div>
        </div>
      `
    : ''
}

      <div class="summary-section">
        <h4 class="summary-section-title">Custom Line Items</h4>
        <div class="summary-line-items">
          ${
  customItems.length
    ? customItems
      .map(
        (item) => `
            <div class="summary-line-item" data-item-id="${item.id}">
              <select class="summary-input" data-item-id="${item.id}" data-item-field="itemType">
                ${['service', 'product', 'fee', 'hourly']
    .map(
      (option) => `
                  <option value="${option}" ${item.itemType === option ? 'selected' : ''}>${option.replace('-', ' ')}</option>
                `
    )
    .join('')}
              </select>
              <input class="summary-input" data-item-id="${item.id}" data-item-field="description" value="${item.description}" placeholder="Description">
              <input class="summary-input" type="number" min="0" step="0.01" data-item-id="${item.id}" data-item-field="unitPrice" value="${item.unitPrice}">
              <input class="summary-input" type="number" min="1" step="1" data-item-id="${item.id}" data-item-field="quantity" value="${item.quantity}">
              <input class="summary-input" data-item-id="${item.id}" data-item-field="unitLabel" value="${item.unitLabel || ''}" placeholder="Unit">
              <label class="summary-toggle">
                <input type="checkbox" data-item-id="${item.id}" data-item-field="isTaxable" ${item.isTaxable ? 'checked' : ''}>
                <span>Taxable</span>
              </label>
              <label class="summary-toggle">
                <input type="checkbox" data-item-id="${item.id}" data-item-field="isOptional" ${item.isOptional ? 'checked' : ''}>
                <span>Optional</span>
              </label>
              <button class="icon-btn summary-remove-item" data-item-id="${item.id}" title="Remove line item" aria-label="Remove line item">
                ${createDashIcon()}
              </button>
            </div>
          `
      )
      .join('')
    : '<div class="summary-empty">No custom items yet.</div>'
}
        </div>
        <button class="proposal-btn proposal-btn-secondary summary-add-btn" id="add-custom-item-btn" type="button">Add Line Item</button>
      </div>

      <div class="summary-section">
        <h4 class="summary-section-title">Pricing Adjustments</h4>
        <div class="summary-adjustments">
          <div class="summary-adjustment">
            <label class="summary-label" for="proposalDiscountType">Discount Type</label>
            <select id="proposalDiscountType" class="summary-input">
              <option value="">None</option>
              <option value="percentage" ${discountType === 'percentage' ? 'selected' : ''}>Percentage</option>
              <option value="fixed" ${discountType === 'fixed' ? 'selected' : ''}>Fixed Amount</option>
            </select>
          </div>
          <div class="summary-adjustment">
            <label class="summary-label" for="proposalDiscountValue">Discount Value</label>
            <input id="proposalDiscountValue" class="summary-input" type="number" min="0" step="0.01" value="${discountValue}">
          </div>
          <div class="summary-adjustment">
            <label class="summary-label" for="proposalTaxRate">Tax Rate (%)</label>
            <input id="proposalTaxRate" class="summary-input" type="number" min="0" max="100" step="0.01" value="${taxRate}">
          </div>
        </div>
      </div>

      <div class="summary-section">
        <h4 class="summary-section-title">Validity / Expiration</h4>
        <div class="summary-adjustments">
          <div class="summary-adjustment">
            <label class="summary-label" for="proposalExpirationDate">Expiration Date</label>
            <input id="proposalExpirationDate" class="summary-input" type="date" value="${selection.expirationDate || ''}">
          </div>
        </div>
      </div>

      <div class="summary-section summary-notes">
        <h4 class="summary-section-title">Notes / Special Terms (Optional)</h4>
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
          ${
  addonsTotal > 0
    ? `
            <div class="total-row">
              <span>Add-ons</span>
              <span>+${formatPrice(addonsTotal)}</span>
            </div>
          `
    : ''
}
          ${
  customItemsTotal > 0
    ? `
            <div class="total-row">
              <span>Custom Items</span>
              <span>+${formatPrice(customItemsTotal)}</span>
            </div>
          `
    : ''
}
          ${
  discountAmount > 0
    ? `
            <div class="total-row">
              <span>Discount</span>
              <span>-${formatPrice(discountAmount)}</span>
            </div>
          `
    : ''
}
          ${
  taxAmount > 0
    ? `
            <div class="total-row">
              <span>Tax</span>
              <span>+${formatPrice(taxAmount)}</span>
            </div>
          `
    : ''
}
          <div class="total-row total-row--final">
            <span>One-time Total</span>
            <span>${formatPrice(projectTotal)}</span>
          </div>
          ${
  maintenance && maintenance.price > 0
    ? `
            <div class="total-row total-row--recurring">
              <span>Monthly Maintenance</span>
              <span>${formatPrice(maintenance.price)}/mo</span>
            </div>
          `
    : ''
}
        </div>
      </div>
    </div>
  `;
}
