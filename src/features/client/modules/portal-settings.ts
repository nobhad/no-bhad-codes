/**
 * ===============================================
 * PORTAL SETTINGS MODULE
 * ===============================================
 * @file src/features/client/modules/portal-settings.ts
 *
 * Settings management functionality for client portal.
 * Dynamically imported for code splitting.
 */

import type { ClientPortalContext } from '../portal-types';

// ============================================================================
// CACHED DOM REFERENCES
// ============================================================================

/** Cache for form elements */
const cachedForms: Map<string, HTMLElement | null> = new Map();

/** Cache for input elements */
const cachedInputs: Map<string, HTMLInputElement | HTMLSelectElement | null> = new Map();

/** Get cached form element */
function getForm(formId: string): HTMLElement | null {
  if (!cachedForms.has(formId)) {
    cachedForms.set(formId, document.getElementById(formId));
  }
  return cachedForms.get(formId) ?? null;
}

/** Get cached input element */
function getInput<T extends HTMLInputElement | HTMLSelectElement = HTMLInputElement>(inputId: string): T | null {
  if (!cachedInputs.has(inputId)) {
    cachedInputs.set(inputId, document.getElementById(inputId) as T | null);
  }
  return cachedInputs.get(inputId) as T | null;
}

/**
 * Setup settings forms
 */
export function setupSettingsForms(ctx: ClientPortalContext): void {
  const contactForm = getForm('contact-info-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveContactInfo(new FormData(contactForm as HTMLFormElement), ctx);
    });
  }

  const billingForm = getForm('billing-address-form');
  if (billingForm) {
    billingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveBillingAddress(new FormData(billingForm as HTMLFormElement), ctx);
    });
  }

  const notificationForm = getForm('notification-prefs-form');
  if (notificationForm) {
    notificationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveNotificationPrefs(new FormData(notificationForm as HTMLFormElement), ctx);
    });
  }

  const billingViewForm = getForm('billing-view-form');
  if (billingViewForm) {
    billingViewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveBillingViewAddress(new FormData(billingViewForm as HTMLFormElement), ctx);
    });
  }

  const taxInfoForm = getForm('tax-info-form');
  if (taxInfoForm) {
    taxInfoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveTaxInfo(new FormData(taxInfoForm as HTMLFormElement), ctx);
    });
  }
}

/**
 * Load user settings
 */
export function loadUserSettings(currentUser: string | null): void {
  const userData = {
    name: currentUser || 'User',
    email: currentUser || '',
    company: 'Company Name',
    phone: '',
    secondaryEmail: '',
    billing: {
      address1: '',
      address2: '',
      city: '',
      state: '',
      zip: '',
      country: ''
    }
  };

  const nameInput = getInput('contact-name');
  const emailInput = getInput('contact-email');
  const companyInput = getInput('contact-company');
  const phoneInput = getInput('contact-phone');
  const secondaryEmailInput = getInput('contact-secondary-email');

  if (nameInput) nameInput.value = userData.name;
  if (emailInput) emailInput.value = userData.email;
  if (companyInput) companyInput.value = userData.company;
  if (phoneInput) phoneInput.value = userData.phone;
  if (secondaryEmailInput) secondaryEmailInput.value = userData.secondaryEmail;

  const address1Input = getInput('billing-address1');
  const address2Input = getInput('billing-address2');
  const cityInput = getInput('billing-city');
  const stateInput = getInput('billing-state');
  const zipInput = getInput('billing-zip');
  const countryInput = getInput('billing-country');

  if (address1Input) address1Input.value = userData.billing.address1;
  if (address2Input) address2Input.value = userData.billing.address2;
  if (cityInput) cityInput.value = userData.billing.city;
  if (stateInput) stateInput.value = userData.billing.state;
  if (zipInput) zipInput.value = userData.billing.zip;
  if (countryInput) countryInput.value = userData.billing.country;
}

/**
 * Load billing settings
 */
export function loadBillingSettings(): void {
  const savedBillingData = sessionStorage.getItem('client_billing_address');
  const savedTaxData = sessionStorage.getItem('client_tax_info');

  const billingData = savedBillingData
    ? JSON.parse(savedBillingData)
    : {
      address1: '',
      address2: '',
      city: '',
      state: '',
      zip: '',
      country: ''
    };

  const taxData = savedTaxData
    ? JSON.parse(savedTaxData)
    : {
      taxId: '',
      businessName: ''
    };

  const address1Input = getInput('billing-view-address1');
  const address2Input = getInput('billing-view-address2');
  const cityInput = getInput('billing-view-city');
  const stateInput = getInput('billing-view-state');
  const zipInput = getInput('billing-view-zip');
  const countryInput = getInput('billing-view-country');

  if (address1Input) address1Input.value = billingData.address1;
  if (address2Input) address2Input.value = billingData.address2;
  if (cityInput) cityInput.value = billingData.city;
  if (stateInput) stateInput.value = billingData.state;
  if (zipInput) zipInput.value = billingData.zip;
  if (countryInput) countryInput.value = billingData.country;

  const taxIdInput = getInput('tax-id');
  const businessNameInput = getInput('business-name');

  if (taxIdInput) taxIdInput.value = taxData.taxId;
  if (businessNameInput) businessNameInput.value = taxData.businessName;
}

/**
 * Load contact settings
 */
export function loadContactSettings(currentUser: string | null): void {
  const savedContactData = sessionStorage.getItem('client_contact_info');

  const contactData = savedContactData
    ? JSON.parse(savedContactData)
    : {
      name: currentUser || 'User',
      email: currentUser || '',
      company: '',
      phone: '',
      secondaryEmail: ''
    };

  const nameInput = getInput('contact-view-name');
  const emailInput = getInput('contact-view-email');
  const companyInput = getInput('contact-view-company');
  const phoneInput = getInput('contact-view-phone');
  const secondaryEmailInput = getInput('contact-view-secondary-email');

  if (nameInput) nameInput.value = contactData.name;
  if (emailInput) emailInput.value = contactData.email;
  if (companyInput) companyInput.value = contactData.company;
  if (phoneInput) phoneInput.value = contactData.phone;
  if (secondaryEmailInput) secondaryEmailInput.value = contactData.secondaryEmail;
}

/**
 * Load notification settings
 */
export function loadNotificationSettings(): void {
  const savedNotifications = sessionStorage.getItem('client_notification_prefs');
  const savedFrequency = sessionStorage.getItem('client_notification_frequency');

  const notificationPrefs = savedNotifications
    ? JSON.parse(savedNotifications)
    : ['project-updates', 'invoices', 'messages', 'milestones'];

  const frequencyData = savedFrequency
    ? JSON.parse(savedFrequency)
    : {
      frequency: 'immediate',
      quietStart: '',
      quietEnd: ''
    };

  // Use cached form reference for checkbox query
  const notificationForm = getForm('email-notifications-form');
  if (notificationForm) {
    const checkboxes = notificationForm.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
      const cb = checkbox as HTMLInputElement;
      cb.checked = notificationPrefs.includes(cb.value);
    });
  }

  const frequencySelect = getInput<HTMLSelectElement>('notification-frequency');
  const quietStartInput = getInput('quiet-hours-start');
  const quietEndInput = getInput('quiet-hours-end');

  if (frequencySelect) frequencySelect.value = frequencyData.frequency;
  if (quietStartInput) quietStartInput.value = frequencyData.quietStart;
  if (quietEndInput) quietEndInput.value = frequencyData.quietEnd;
}

async function saveContactInfo(formData: FormData, ctx: ClientPortalContext): Promise<void> {
  const data = Object.fromEntries(formData);

  sessionStorage.setItem('client_contact_info', JSON.stringify(data));
  ctx.showNotification('Contact information saved successfully!', 'success');
}

async function saveBillingAddress(formData: FormData, ctx: ClientPortalContext): Promise<void> {
  const data = Object.fromEntries(formData);

  sessionStorage.setItem('client_billing_address', JSON.stringify(data));
  ctx.showNotification('Billing address saved successfully!', 'success');
}

async function saveNotificationPrefs(formData: FormData, ctx: ClientPortalContext): Promise<void> {
  const checkboxes = formData.getAll('notifications');
  const prefs = {
    projectUpdates: checkboxes.includes('project-updates'),
    invoices: checkboxes.includes('invoices'),
    messages: checkboxes.includes('messages'),
    milestones: checkboxes.includes('milestones')
  };

  sessionStorage.setItem('client_notification_prefs', JSON.stringify(prefs));
  ctx.showNotification('Notification preferences saved successfully!', 'success');
}

async function saveBillingViewAddress(formData: FormData, ctx: ClientPortalContext): Promise<void> {
  const data = Object.fromEntries(formData);

  sessionStorage.setItem('client_billing_view_address', JSON.stringify(data));
  ctx.showNotification('Billing address updated successfully!', 'success');
}

async function saveTaxInfo(formData: FormData, ctx: ClientPortalContext): Promise<void> {
  const data = Object.fromEntries(formData);

  sessionStorage.setItem('client_tax_info', JSON.stringify(data));
  ctx.showNotification('Tax information saved successfully!', 'success');
}
