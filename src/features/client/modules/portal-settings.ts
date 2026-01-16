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

/**
 * Setup settings forms
 */
export function setupSettingsForms(ctx: ClientPortalContext): void {
  const contactForm = document.getElementById('contact-info-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveContactInfo(new FormData(contactForm as HTMLFormElement), ctx);
    });
  }

  const billingForm = document.getElementById('billing-address-form');
  if (billingForm) {
    billingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveBillingAddress(new FormData(billingForm as HTMLFormElement), ctx);
    });
  }

  const notificationForm = document.getElementById('notification-prefs-form');
  if (notificationForm) {
    notificationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveNotificationPrefs(new FormData(notificationForm as HTMLFormElement), ctx);
    });
  }

  const billingViewForm = document.getElementById('billing-view-form');
  if (billingViewForm) {
    billingViewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveBillingViewAddress(new FormData(billingViewForm as HTMLFormElement), ctx);
    });
  }

  const taxInfoForm = document.getElementById('tax-info-form');
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

  const nameInput = document.getElementById('contact-name') as HTMLInputElement;
  const emailInput = document.getElementById('contact-email') as HTMLInputElement;
  const companyInput = document.getElementById('contact-company') as HTMLInputElement;
  const phoneInput = document.getElementById('contact-phone') as HTMLInputElement;
  const secondaryEmailInput = document.getElementById('contact-secondary-email') as HTMLInputElement;

  if (nameInput) nameInput.value = userData.name;
  if (emailInput) emailInput.value = userData.email;
  if (companyInput) companyInput.value = userData.company;
  if (phoneInput) phoneInput.value = userData.phone;
  if (secondaryEmailInput) secondaryEmailInput.value = userData.secondaryEmail;

  const address1Input = document.getElementById('billing-address1') as HTMLInputElement;
  const address2Input = document.getElementById('billing-address2') as HTMLInputElement;
  const cityInput = document.getElementById('billing-city') as HTMLInputElement;
  const stateInput = document.getElementById('billing-state') as HTMLInputElement;
  const zipInput = document.getElementById('billing-zip') as HTMLInputElement;
  const countryInput = document.getElementById('billing-country') as HTMLInputElement;

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

  const address1Input = document.getElementById('billing-view-address1') as HTMLInputElement;
  const address2Input = document.getElementById('billing-view-address2') as HTMLInputElement;
  const cityInput = document.getElementById('billing-view-city') as HTMLInputElement;
  const stateInput = document.getElementById('billing-view-state') as HTMLInputElement;
  const zipInput = document.getElementById('billing-view-zip') as HTMLInputElement;
  const countryInput = document.getElementById('billing-view-country') as HTMLInputElement;

  if (address1Input) address1Input.value = billingData.address1;
  if (address2Input) address2Input.value = billingData.address2;
  if (cityInput) cityInput.value = billingData.city;
  if (stateInput) stateInput.value = billingData.state;
  if (zipInput) zipInput.value = billingData.zip;
  if (countryInput) countryInput.value = billingData.country;

  const taxIdInput = document.getElementById('tax-id') as HTMLInputElement;
  const businessNameInput = document.getElementById('business-name') as HTMLInputElement;

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

  const nameInput = document.getElementById('contact-view-name') as HTMLInputElement;
  const emailInput = document.getElementById('contact-view-email') as HTMLInputElement;
  const companyInput = document.getElementById('contact-view-company') as HTMLInputElement;
  const phoneInput = document.getElementById('contact-view-phone') as HTMLInputElement;
  const secondaryEmailInput = document.getElementById(
    'contact-view-secondary-email'
  ) as HTMLInputElement;

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

  const checkboxes = document.querySelectorAll('#email-notifications-form input[type="checkbox"]');
  checkboxes.forEach((checkbox) => {
    const cb = checkbox as HTMLInputElement;
    cb.checked = notificationPrefs.includes(cb.value);
  });

  const frequencySelect = document.getElementById('notification-frequency') as HTMLSelectElement;
  const quietStartInput = document.getElementById('quiet-hours-start') as HTMLInputElement;
  const quietEndInput = document.getElementById('quiet-hours-end') as HTMLInputElement;

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
