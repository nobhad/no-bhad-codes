/**
 * ===============================================
 * PROPOSAL BUILDER - CALCULATION LOGIC
 * ===============================================
 * @file src/features/client/proposal-calculations.ts
 *
 * Price calculation and price bar rendering logic.
 * Extracted from proposal-builder.ts for maintainability.
 */

import type {
  ProjectType,
  ProposalSelection,
  PriceBreakdown,
  ProposalBuilderState
} from './proposal-builder-types';
import { calculatePriceBreakdown } from './proposal-builder-data';
import { renderPriceBar } from './proposal-builder-ui';

/**
 * Update the calculated price on the selection state.
 * Mutates selection in place.
 */
export function updateCalculatedPrice(
  projectType: ProjectType,
  selection: ProposalSelection
): void {
  const breakdown = calculatePriceBreakdown(
    projectType,
    selection.selectedTier,
    selection.addedFeatures,
    selection.customItems,
    selection.discountType,
    selection.discountValue,
    selection.taxRate
  );

  selection.calculatedPrice = breakdown.total;
  selection.basePrice = breakdown.basePrice;
  selection.subtotal = breakdown.subtotal;
  selection.discountAmount = breakdown.discountAmount;
  selection.taxAmount = breakdown.taxAmount;
}

/**
 * Update the price bar display element
 */
export function updatePriceDisplay(
  priceBar: HTMLElement,
  state: ProposalBuilderState,
  projectType: ProjectType
): void {
  if (!state.configuration) return;

  const tier = state.configuration.tiers.find(
    (t) => t.id === state.selection.selectedTier
  );

  if (!tier) return;

  const addedFeatures = state.configuration.features.filter((f) =>
    state.selection.addedFeatures.includes(f.id)
  );

  const maintenance = state.configuration.maintenanceOptions.find(
    (m) => m.id === state.selection.maintenanceOption
  );

  const computed = calculatePriceBreakdown(
    projectType,
    state.selection.selectedTier,
    state.selection.addedFeatures,
    state.selection.customItems,
    state.selection.discountType,
    state.selection.discountValue,
    state.selection.taxRate
  );

  const breakdown: PriceBreakdown = {
    tierBasePrice: computed.basePrice,
    tierName: tier.name,
    addedFeatures: addedFeatures.map((f) => ({
      id: f.id,
      name: f.name,
      price: f.price
    })),
    customItems: state.selection.customItems,
    maintenanceOption: maintenance
      ? {
        name: maintenance.name,
        price: maintenance.price,
        billingCycle: maintenance.billingCycle
      }
      : null,
    subtotal: computed.subtotal,
    discountType: state.selection.discountType,
    discountValue: state.selection.discountValue,
    discountAmount: computed.discountAmount,
    taxRate: state.selection.taxRate,
    taxAmount: computed.taxAmount,
    total: computed.total
  };

  priceBar.innerHTML = renderPriceBar(breakdown);
}

/**
 * Build the final price breakdown for submission
 */
export function buildSubmissionBreakdown(
  projectType: ProjectType,
  selection: ProposalSelection
): {
  total: number;
  basePrice: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
} {
  return calculatePriceBreakdown(
    projectType,
    selection.selectedTier,
    selection.addedFeatures,
    selection.customItems,
    selection.discountType,
    selection.discountValue,
    selection.taxRate
  );
}
