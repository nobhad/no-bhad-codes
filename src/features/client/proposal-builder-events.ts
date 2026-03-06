/**
 * ===============================================
 * PROPOSAL BUILDER - EVENT HANDLERS
 * ===============================================
 * @file src/features/client/proposal-builder-events.ts
 *
 * Click and change event delegation for the proposal builder.
 * Extracted from proposal-builder.ts for maintainability.
 */

import type {
  TierId,
  MaintenanceId,
  DiscountType,
  ProposalCustomItem
} from './proposal-builder-types';

/** Interface for the event handler callbacks */
export interface ProposalEventCallbacks {
  selectTier: (tierId: TierId) => void;
  selectMaintenance: (maintenanceId: MaintenanceId) => void;
  toggleFeature: (featureId: string, isAdded: boolean) => void;
  addCustomItem: () => void;
  removeCustomItem: (itemId: string) => void;
  updateCustomItem: (itemId: string, field: string, target: HTMLInputElement) => void;
  setNotes: (value: string) => void;
  setDiscountType: (value: DiscountType | null) => void;
  setDiscountValue: (value: number) => void;
  setTaxRate: (value: number) => void;
  setExpirationDate: (value: string | null) => void;
  refreshPricing: () => void;
}

/**
 * Handle delegated click events on the proposal builder container
 */
export function handleProposalClick(e: Event, callbacks: ProposalEventCallbacks): void {
  const target = e.target as HTMLElement;

  const tierCard = target.closest('.tier-card');
  if (tierCard) {
    const tierId = tierCard.getAttribute('data-tier-id') as TierId;
    if (tierId) callbacks.selectTier(tierId);
    return;
  }

  const tierBtn = target.closest('.tier-select-btn');
  if (tierBtn) {
    const tierId = tierBtn.getAttribute('data-tier-id') as TierId;
    if (tierId) callbacks.selectTier(tierId);
    return;
  }

  const maintenanceCard = target.closest('.maintenance-card');
  if (maintenanceCard) {
    const maintenanceId = maintenanceCard.getAttribute('data-maintenance-id') as MaintenanceId;
    if (maintenanceId) callbacks.selectMaintenance(maintenanceId);
    return;
  }

  const maintenanceBtn = target.closest('.maintenance-select-btn');
  if (maintenanceBtn) {
    const maintenanceId = maintenanceBtn.getAttribute('data-maintenance-id') as MaintenanceId;
    if (maintenanceId) callbacks.selectMaintenance(maintenanceId);
  }

  const addCustomItemBtn = target.closest('#add-custom-item-btn');
  if (addCustomItemBtn) {
    callbacks.addCustomItem();
    return;
  }

  const removeCustomItemBtn = target.closest('.summary-remove-item') as HTMLElement | null;
  if (removeCustomItemBtn) {
    const itemId = removeCustomItemBtn.getAttribute('data-item-id');
    if (itemId) callbacks.removeCustomItem(itemId);
  }
}

/**
 * Handle delegated change events on the proposal builder container
 */
export function handleProposalChange(e: Event, callbacks: ProposalEventCallbacks): void {
  const target = e.target as HTMLInputElement | HTMLSelectElement;

  if (target.classList.contains('feature-checkbox') && target instanceof HTMLInputElement) {
    const featureId = target.getAttribute('data-feature-id');
    if (featureId) callbacks.toggleFeature(featureId, target.checked);
  }

  if (target.id === 'proposalNotes' && target.tagName === 'TEXTAREA') {
    callbacks.setNotes((target as unknown as HTMLTextAreaElement).value);
  }

  if (target.id === 'proposalDiscountType' && target instanceof HTMLSelectElement) {
    const value = target.value as DiscountType | '';
    callbacks.setDiscountType(value || null);
    callbacks.refreshPricing();
  }

  if (target.id === 'proposalDiscountValue') {
    callbacks.setDiscountValue(Number(target.value || 0));
    callbacks.refreshPricing();
  }

  if (target.id === 'proposalTaxRate') {
    callbacks.setTaxRate(Number(target.value || 0));
    callbacks.refreshPricing();
  }

  if (target.id === 'proposalExpirationDate') {
    callbacks.setExpirationDate(target.value || null);
  }

  const itemId = target.getAttribute('data-item-id');
  const itemField = target.getAttribute('data-item-field');
  if (itemId && itemField && target instanceof HTMLInputElement) {
    callbacks.updateCustomItem(itemId, itemField, target);
  }
}

/**
 * Update a custom item field based on user input
 */
export function applyCustomItemUpdate(
  items: ProposalCustomItem[],
  itemId: string,
  field: string,
  target: HTMLInputElement
): ProposalCustomItem[] {
  const updated = items.map((item) => ({ ...item }));
  const item = updated.find((entry) => entry.id === itemId);
  if (!item) return updated;

  if (field === 'itemType') item.itemType = target.value as ProposalCustomItem['itemType'];
  if (field === 'description') item.description = target.value;
  if (field === 'unitPrice') item.unitPrice = Number(target.value || 0);
  if (field === 'quantity') item.quantity = Math.max(1, Number(target.value || 1));
  if (field === 'unitLabel') item.unitLabel = target.value;
  if (field === 'isTaxable') item.isTaxable = target.checked;
  if (field === 'isOptional') item.isOptional = target.checked;

  return updated;
}
