/**
 * ===============================================
 * PORTAL SETTINGS HANDLER
 * ===============================================
 * @file src/features/client/portal-settings-handler.ts
 *
 * Extracted from client-portal.ts
 * Handles all settings form submissions: profile, password,
 * notifications, billing, and new project requests.
 */

import type { ClientPortalContext } from './portal-types';
import { loadSettingsModule } from './modules';
import { createDOMCache } from '../../utils/dom-cache';
import { showToast } from '../../utils/toast-notifications';
import { withButtonLoading } from '../../utils/button-loading';
import { apiFetch, unwrapApiData } from '../../utils/api-client';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalSettings');

/** API base URLs */
const CLIENTS_API_BASE = '/api/clients';
const PROJECTS_API_BASE = '/api/projects';

/** Dependencies injected from the main portal module */
export interface SettingsHandlerDeps {
  domCache: ReturnType<typeof createDOMCache>;
  getCurrentUser: () => string | null;
  getCurrentUserData: () => { id: number; email: string; name: string } | null;
  loadRealUserProjects: (user: { id: number; email: string; name: string }) => Promise<void>;
  switchTab: (tabName: string) => Promise<void>;
  moduleContext: ClientPortalContext;
}

/**
 * Setup settings form handlers (profile, notifications, billing, new project)
 */
export function setupSettingsFormHandlers(deps: SettingsHandlerDeps): void {
  const { domCache } = deps;

  // Profile form
  const profileForm = domCache.getAs<HTMLFormElement>('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = profileForm.querySelector('button[type="submit"]') as HTMLButtonElement;
      await withButtonLoading(submitBtn, () => saveProfileSettings(deps), 'Saving...');
    });
  }

  // NOTE: Password form is now part of the React PortalSettings component
  // and is initialized via initializePasswordForm() when settings tab is loaded.
  // This prevents browser password save prompts on dashboard load since the form
  // doesn't exist in the DOM until the user navigates to settings.

  // Notifications form
  const notificationsForm = domCache.getAs<HTMLFormElement>('notificationsForm');
  if (notificationsForm) {
    notificationsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = notificationsForm.querySelector(
        'button[type="submit"]'
      ) as HTMLButtonElement;
      await withButtonLoading(submitBtn, () => saveNotificationSettings(deps), 'Saving...');
    });
  }

  // Billing form
  const billingForm = domCache.getAs<HTMLFormElement>('billingForm');
  if (billingForm) {
    billingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = billingForm.querySelector('button[type="submit"]') as HTMLButtonElement;
      await withButtonLoading(submitBtn, () => saveBillingSettings(deps), 'Saving...');
    });
  }

  // New project form
  const newProjectForm = domCache.getAs<HTMLFormElement>('newProjectForm');
  if (newProjectForm) {
    newProjectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = newProjectForm.querySelector(
        'button[type="submit"]'
      ) as HTMLButtonElement;
      await withButtonLoading(submitBtn, () => submitProjectRequest(deps), 'Submitting...');
    });
  }
}

/**
 * Submit new project request
 */
async function submitProjectRequest(deps: SettingsHandlerDeps): Promise<void> {
  const { domCache } = deps;
  const authMode = sessionStorage.getItem('client_auth_mode');

  if (!authMode) {
    showToast('Please log in to submit a project request.', 'error');
    return;
  }

  const name = domCache.getAs<HTMLInputElement>('projectName')?.value;
  const projectType = domCache.getAs<HTMLSelectElement>('projectType')?.value;
  const budget = domCache.getAs<HTMLSelectElement>('projectBudget')?.value;
  const timeline = domCache.getAs<HTMLSelectElement>('projectTimeline')?.value;
  const description = domCache.getAs<HTMLTextAreaElement>('projectDescription')?.value;

  if (!name || !projectType || !description) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  try {
    const response = await apiFetch(`${PROJECTS_API_BASE}/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        projectType,
        budget,
        timeline,
        description
      })
    });

    const raw = await response.json();

    if (!response.ok) {
      throw new Error(raw.error || 'Failed to submit project request');
    }

    const data = unwrapApiData<Record<string, unknown>>(raw);
    showToast((data.message as string) || 'Project request submitted successfully!', 'success');

    // Clear the form
    const form = document.getElementById('new-project-form') as HTMLFormElement;
    if (form) form.reset();

    // Reload projects list to show the new project
    const currentUserData = deps.getCurrentUserData();
    if (currentUserData) {
      await deps.loadRealUserProjects(currentUserData);
    }

    // Switch to dashboard tab
    await deps.switchTab('dashboard');
  } catch (error) {
    logger.error('Error submitting project request:', error);
    showToast('Failed to submit project request. Please try again.', 'error');
  }
}

/**
 * Save profile settings
 */
async function saveProfileSettings(deps: SettingsHandlerDeps): Promise<void> {
  const { domCache } = deps;
  const authMode = sessionStorage.getItem('client_auth_mode');

  if (!authMode) {
    showToast('Please log in to save settings.', 'error');
    return;
  }

  const contactName = domCache.getAs<HTMLInputElement>('settingsName')?.value;
  const companyName = domCache.getAs<HTMLInputElement>('settingsCompany')?.value;
  const phone = domCache.getAs<HTMLInputElement>('settingsPhone')?.value;
  // Password fields are rendered dynamically, so access directly from DOM
  const currentPassword = (document.getElementById('current-password') as HTMLInputElement | null)
    ?.value;
  const newPassword = (document.getElementById('new-password') as HTMLInputElement | null)?.value;
  const confirmPassword = (document.getElementById('confirm-password') as HTMLInputElement | null)
    ?.value;

  try {
    // Update profile info
    const profileResponse = await apiFetch(`${CLIENTS_API_BASE}/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contact_name: contactName,
        company_name: companyName,
        phone: phone
      })
    });

    if (!profileResponse.ok) {
      const error = await profileResponse.json();
      throw new Error(error.error || 'Failed to update profile');
    }

    // If password fields are filled, update password
    if (currentPassword && newPassword) {
      if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        return;
      }

      if (newPassword.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
      }

      const passwordResponse = await apiFetch(`${CLIENTS_API_BASE}/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (!passwordResponse.ok) {
        const error = await passwordResponse.json();
        throw new Error(error.error || 'Failed to update password');
      }

      // Clear password fields (rendered dynamically)
      const currPassEl = document.getElementById('current-password') as HTMLInputElement | null;
      const newPassEl = document.getElementById('new-password') as HTMLInputElement | null;
      const confPassEl = document.getElementById('confirm-password') as HTMLInputElement | null;
      if (currPassEl) currPassEl.value = '';
      if (newPassEl) newPassEl.value = '';
      if (confPassEl) confPassEl.value = '';
    }

    showToast('Profile updated successfully!', 'success');

    // Refresh displayed profile data
    await loadUserSettings(deps.getCurrentUser(), deps.moduleContext);
  } catch (error) {
    logger.error('Error saving profile:', error);
    showToast('Failed to save profile. Please try again.', 'error');
  }
}

/**
 * Initialize password form event handlers (form HTML is now in React PortalSettings)
 * Sets up password toggle buttons and form submission
 */
export function initializePasswordForm(): void {
  const passwordForm = document.getElementById('password-form') as HTMLFormElement | null;
  if (!passwordForm || passwordForm.dataset.initialized === 'true') return;

  passwordForm.dataset.initialized = 'true';

  // Initialize password toggles
  const toggles = passwordForm.querySelectorAll<HTMLButtonElement>('[data-password-toggle]');
  toggles.forEach((toggle) => {
    const inputId = toggle.dataset.passwordToggle;
    if (!inputId) return;
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const input = document.getElementById(inputId) as HTMLInputElement | null;
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
        // Update icon
        const isVisible = input.type === 'text';
        toggle.innerHTML = isVisible
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
      }
    });
  });

  // Attach form submit handler
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = passwordForm.querySelector('button[type="submit"]') as HTMLButtonElement;
    await withButtonLoading(submitBtn, () => savePasswordSettings(), 'Updating...');
  });
}

/**
 * Save password settings
 */
async function savePasswordSettings(): Promise<void> {
  const authMode = sessionStorage.getItem('client_auth_mode');

  if (!authMode) {
    showToast('Please log in to change your password.', 'error');
    return;
  }

  // Get password values directly from DOM (elements are rendered dynamically)
  const currentPassword = (document.getElementById('current-password') as HTMLInputElement | null)
    ?.value;
  const newPassword = (document.getElementById('new-password') as HTMLInputElement | null)?.value;
  const confirmPassword = (document.getElementById('confirm-password') as HTMLInputElement | null)
    ?.value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('Please fill in all password fields', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match', 'error');
    return;
  }

  if (newPassword.length < 8) {
    showToast('Password must be at least 8 characters', 'error');
    return;
  }

  try {
    const response = await apiFetch(`${CLIENTS_API_BASE}/me/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update password');
    }

    // Clear password fields (rendered dynamically)
    const currPassEl2 = document.getElementById('current-password') as HTMLInputElement | null;
    const newPassEl2 = document.getElementById('new-password') as HTMLInputElement | null;
    const confPassEl2 = document.getElementById('confirm-password') as HTMLInputElement | null;
    if (currPassEl2) currPassEl2.value = '';
    if (newPassEl2) newPassEl2.value = '';
    if (confPassEl2) confPassEl2.value = '';

    showToast('Password updated successfully!', 'success');
  } catch (error) {
    logger.error('Error updating password:', error);
    showToast('Failed to update password. Please try again.', 'error');
  }
}

/**
 * Save notification settings
 */
async function saveNotificationSettings(deps: SettingsHandlerDeps): Promise<void> {
  const authMode = sessionStorage.getItem('client_auth_mode');

  if (!authMode) {
    showToast('Please log in to save settings.', 'error');
    return;
  }

  const form = deps.domCache.get('notificationsForm');
  if (!form) return;

  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  const settings = {
    messages: (checkboxes[0] as HTMLInputElement)?.checked || false,
    status: (checkboxes[1] as HTMLInputElement)?.checked || false,
    invoices: (checkboxes[2] as HTMLInputElement)?.checked || false,
    weekly: (checkboxes[3] as HTMLInputElement)?.checked || false
  };

  try {
    const response = await apiFetch(`${CLIENTS_API_BASE}/me/notifications`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update notification preferences');
    }

    showToast('Notification preferences saved!', 'success');
  } catch (error) {
    logger.error('Error saving notifications:', error);
    showToast('Failed to save preferences. Please try again.', 'error');
  }
}

/**
 * Save billing settings
 */
async function saveBillingSettings(deps: SettingsHandlerDeps): Promise<void> {
  const { domCache } = deps;
  const authMode = sessionStorage.getItem('client_auth_mode');

  if (!authMode) {
    showToast('Please log in to save settings.', 'error');
    return;
  }

  const billing = {
    company: domCache.getAs<HTMLInputElement>('billingCompany')?.value,
    address: domCache.getAs<HTMLInputElement>('billingAddress')?.value,
    address2: domCache.getAs<HTMLInputElement>('billingAddress2')?.value,
    city: domCache.getAs<HTMLInputElement>('billingCity')?.value,
    state: domCache.getAs<HTMLInputElement>('billingState')?.value,
    zip: domCache.getAs<HTMLInputElement>('billingZip')?.value,
    country: domCache.getAs<HTMLInputElement>('billingCountry')?.value
  };

  try {
    const response = await apiFetch(`${CLIENTS_API_BASE}/me/billing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(billing)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update billing information');
    }

    showToast('Billing information saved!', 'success');
  } catch (error) {
    logger.error('Error saving billing:', error);
    showToast('Failed to save billing info. Please try again.', 'error');
  }
}

/**
 * Load user settings - delegates to settings module
 * Also initializes form handlers after view is available
 */
export async function loadUserSettings(
  currentUser: string | null,
  moduleContext: ClientPortalContext
): Promise<void> {
  const settingsModule = await loadSettingsModule();
  await settingsModule.loadUserSettings(currentUser);
  // Setup form event handlers after settings view is rendered
  settingsModule.setupSettingsForms(moduleContext);
  // Initialize password form event handlers after settings view is loaded
  initializePasswordForm();
}
