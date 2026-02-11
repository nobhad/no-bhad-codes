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
import { apiFetch, apiPut } from '../../../utils/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface ClientProfile {
  id: number;
  email: string;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  status: string;
  client_type: string;
  billing_name: string | null;
  billing_company: string | null;
  billing_address: string | null;
  billing_address2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  billing_country: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CACHED DOM REFERENCES
// ============================================================================

/** Cache for form elements */
const cachedForms: Map<string, HTMLElement | null> = new Map();

/** Cache for input elements */
const cachedInputs: Map<string, HTMLInputElement | HTMLSelectElement | null> = new Map();

/** Get cached form element - does not cache null values for dynamic views */
function getForm(formId: string): HTMLElement | null {
  // Check cache first
  if (cachedForms.has(formId)) {
    const cached = cachedForms.get(formId);
    if (cached) return cached;
  }
  // Look up element (may be dynamically rendered)
  const element = document.getElementById(formId);
  // Only cache if element exists (don't cache null for dynamic views)
  if (element) {
    cachedForms.set(formId, element);
  }
  return element;
}

/** Get cached input element - does not cache null values for dynamic views */
function getInput<T extends HTMLInputElement | HTMLSelectElement = HTMLInputElement>(inputId: string): T | null {
  // Check cache first
  if (cachedInputs.has(inputId)) {
    const cached = cachedInputs.get(inputId);
    if (cached) return cached as T;
  }
  // Look up element (may be dynamically rendered)
  const element = document.getElementById(inputId) as T | null;
  // Only cache if element exists (don't cache null for dynamic views)
  if (element) {
    cachedInputs.set(inputId, element);
  }
  return element;
}

/**
 * Setup settings forms
 */
export function setupSettingsForms(ctx: ClientPortalContext): void {
  // Profile/Account form (settings page)
  const profileForm = getForm('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveContactInfo(new FormData(profileForm as HTMLFormElement), ctx);
    });
  }

  // Email change link - pre-fill message when navigating to messages
  const emailChangeLink = document.querySelector('.email-change-link');
  if (emailChangeLink) {
    emailChangeLink.addEventListener('click', (e) => {
      // Get current email from the settings form
      const currentEmail = getInput('settings-email')?.value || '';
      // Store email change request in sessionStorage for messages page to pick up
      sessionStorage.setItem('pendingEmailChangeMessage', JSON.stringify({
        currentEmail,
        template: `Hi Noelle,\n\nI would like to update my email address.\n\nCurrent email: ${currentEmail}\nNew email: \n\nThank you!`
      }));
    });
  }

  // Billing form (settings page)
  const billingForm = getForm('billing-form');
  if (billingForm) {
    billingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveBillingAddress(new FormData(billingForm as HTMLFormElement), ctx);
    });
  }

  // Legacy form names for backwards compatibility
  const contactForm = getForm('contact-info-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveContactInfo(new FormData(contactForm as HTMLFormElement), ctx);
    });
  }

  const billingAddressForm = getForm('billing-address-form');
  if (billingAddressForm) {
    billingAddressForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveBillingAddress(new FormData(billingAddressForm as HTMLFormElement), ctx);
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
 * Fetch client profile from API
 */
export async function fetchClientProfile(): Promise<ClientProfile | null> {
  try {
    const response = await apiFetch('/api/clients/me');
    if (!response.ok) {
      console.error('[Settings] Failed to fetch client profile');
      return null;
    }
    const data = await response.json();
    return data.client || null;
  } catch (error) {
    console.error('[Settings] Error fetching client profile:', error);
    return null;
  }
}

/**
 * Load user settings from API and populate forms
 */
export async function loadUserSettings(_currentUser: string | null): Promise<void> {
  const profile = await fetchClientProfile();
  if (!profile) return;

  // Populate Account form (profile-form)
  const nameInput = getInput('settings-name');
  const emailInput = getInput('settings-email');
  const companyInput = getInput('settings-company');
  const phoneInput = getInput('settings-phone');

  if (nameInput) nameInput.value = profile.contact_name || '';
  if (emailInput) emailInput.value = profile.email || '';
  if (companyInput) companyInput.value = profile.company_name || '';
  if (phoneInput) phoneInput.value = profile.phone || '';

  // Populate Billing form (billing-form)
  const billingNameInput = getInput('billing-name');
  const billingCompanyInput = getInput('billing-company');
  const billingAddressInput = getInput('billing-address');
  const billingAddress2Input = getInput('billing-address2');
  const billingCityInput = getInput('billing-city');
  const billingStateInput = getInput('billing-state');
  const billingZipInput = getInput('billing-zip');
  const billingCountryInput = getInput('billing-country');

  if (billingNameInput) billingNameInput.value = profile.billing_name || profile.contact_name || '';
  if (billingCompanyInput) billingCompanyInput.value = profile.billing_company || profile.company_name || '';
  if (billingAddressInput) billingAddressInput.value = profile.billing_address || '';
  if (billingAddress2Input) billingAddress2Input.value = profile.billing_address2 || '';
  if (billingCityInput) billingCityInput.value = profile.billing_city || '';
  if (billingStateInput) billingStateInput.value = profile.billing_state || '';
  if (billingZipInput) billingZipInput.value = profile.billing_zip || '';
  if (billingCountryInput) billingCountryInput.value = profile.billing_country || '';
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

  try {
    const response = await apiPut('/api/clients/me', {
      contact_name: data.name || data['contact-name'],
      company_name: data.company || data['contact-company'],
      phone: data.phone || data['contact-phone']
    });

    if (!response.ok) {
      throw new Error('Failed to save contact info');
    }

    ctx.showNotification('Contact information saved successfully!', 'success');
  } catch (error) {
    console.error('[Settings] Error saving contact info:', error);
    ctx.showNotification('Failed to save contact information. Please try again.', 'error');
  }
}

async function saveBillingAddress(formData: FormData, ctx: ClientPortalContext): Promise<void> {
  const data = Object.fromEntries(formData);

  try {
    const response = await apiPut('/api/clients/me/billing', {
      billing_name: data.name || data['billing-name'],
      company: data.company || data['billing-company'],
      address: data.address || data['billing-address'],
      address2: data.address2 || data['billing-address2'],
      city: data.city || data['billing-city'],
      state: data.state || data['billing-state'],
      zip: data.zip || data['billing-zip'],
      country: data.country || data['billing-country']
    });

    if (!response.ok) {
      throw new Error('Failed to save billing address');
    }

    ctx.showNotification('Billing address saved successfully!', 'success');
  } catch (error) {
    console.error('[Settings] Error saving billing address:', error);
    ctx.showNotification('Failed to save billing address. Please try again.', 'error');
  }
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
