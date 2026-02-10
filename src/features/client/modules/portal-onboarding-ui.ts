/**
 * ===============================================
 * PORTAL ONBOARDING UI
 * ===============================================
 * @file src/features/client/modules/portal-onboarding-ui.ts
 *
 * UI rendering functions for the client onboarding wizard.
 * Follows proposal-builder-ui.ts pattern.
 */

import { gsap } from 'gsap';
import type { OnboardingStep, OnboardingStepData } from './portal-onboarding-wizard';
import { ICONS } from '../../../constants/icons';

// =====================================================
// MAIN WIZARD HTML
// =====================================================

export function renderOnboardingWizardHTML(stepTitles: Record<OnboardingStep, string>): string {
  return `
    <div class="onboarding-wizard">
      <div class="onboarding-header">
        <h2 class="onboarding-title">Welcome! Let's Get Started</h2>
        <p class="onboarding-subtitle">Complete this quick setup to help us understand your project needs.</p>
      </div>

      <div class="onboarding-steps-indicator">
        ${([1, 2, 3, 4, 5] as OnboardingStep[]).map(step => `
          <div class="onboarding-step-indicator" data-step="${step}">
            <div class="step-number">${step}</div>
            <div class="step-label">${stepTitles[step]}</div>
          </div>
        `).join('')}
      </div>

      <div class="onboarding-content" id="onboardingContent">
        <!-- Step content rendered dynamically -->
      </div>

      <div class="onboarding-footer">
        <button type="button" class="btn btn-secondary" id="onboardingBack">Cancel</button>
        <div class="onboarding-footer-right">
          <button type="button" class="btn btn-outline" id="onboardingSave">Save Draft</button>
          <button type="button" class="btn btn-primary" id="onboardingNext">Continue</button>
        </div>
      </div>
    </div>
  `;
}

// =====================================================
// STEP CONTENT
// =====================================================

export function renderStepContent(step: OnboardingStep, data: OnboardingStepData): string {
  switch (step) {
  case 1:
    return renderStep1(data);
  case 2:
    return renderStep2(data);
  case 3:
    return renderStep3(data);
  case 4:
    return renderStep4(data);
  case 5:
    return renderStep5(data);
  default:
    return '<p>Unknown step</p>';
  }
}

function renderStep1(data: OnboardingStepData): string {
  return `
    <div class="onboarding-step" data-step="1">
      <h3 class="step-heading">Basic Information</h3>
      <p class="step-description">Tell us about yourself and your business.</p>

      <form class="onboarding-form">
        <div class="form-group">
          <label for="company_name">Company / Business Name</label>
          <input type="text" id="company_name" name="company_name"
            value="${escapeHtml(data.company_name || '')}"
            placeholder="Your company name" />
        </div>

        <div class="form-group">
          <label for="contact_name">Your Name</label>
          <input type="text" id="contact_name" name="contact_name"
            value="${escapeHtml(data.contact_name || '')}"
            placeholder="Your full name" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="email">Email Address</label>
            <input type="email" id="email" name="email"
              value="${escapeHtml(data.email || '')}"
              placeholder="you@example.com" />
          </div>

          <div class="form-group">
            <label for="phone">Phone Number</label>
            <input type="tel" id="phone" name="phone"
              value="${escapeHtml(data.phone || '')}"
              placeholder="(555) 123-4567" />
          </div>
        </div>
      </form>
    </div>
  `;
}

function renderStep2(data: OnboardingStepData): string {
  const projectTypes = [
    { value: 'website', label: 'Website Design & Development' },
    { value: 'branding', label: 'Branding & Identity' },
    { value: 'ecommerce', label: 'E-commerce Store' },
    { value: 'marketing', label: 'Marketing & SEO' },
    { value: 'other', label: 'Other' }
  ];

  const goals = [
    { value: 'increase_sales', label: 'Increase Sales' },
    { value: 'generate_leads', label: 'Generate Leads' },
    { value: 'build_awareness', label: 'Build Brand Awareness' },
    { value: 'improve_online_presence', label: 'Improve Online Presence' },
    { value: 'launch_new_product', label: 'Launch New Product/Service' },
    { value: 'modernize_existing', label: 'Modernize Existing Assets' }
  ];

  const selectedGoals = data.project_goals || [];

  return `
    <div class="onboarding-step" data-step="2">
      <h3 class="step-heading">Project Overview</h3>
      <p class="step-description">What type of project are you looking for?</p>

      <form class="onboarding-form">
        <div class="form-group">
          <label for="project_type">Project Type</label>
          <select id="project_type" name="project_type" required>
            <option value="">Select a project type...</option>
            ${projectTypes.map(pt => `
              <option value="${pt.value}" ${data.project_type === pt.value ? 'selected' : ''}>
                ${pt.label}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="project_description">Brief Project Description</label>
          <textarea id="project_description" name="project_description" rows="3"
            placeholder="Tell us about your project in a few sentences...">${escapeHtml(data.project_description || '')}</textarea>
        </div>

        <div class="form-group">
          <label>Project Goals (select all that apply)</label>
          <div class="checkbox-group">
            ${goals.map(g => `
              <label class="checkbox-item">
                <input type="checkbox" name="project_goals" value="${g.value}"
                  ${selectedGoals.includes(g.value) ? 'checked' : ''} />
                <span>${g.label}</span>
              </label>
            `).join('')}
          </div>
        </div>
      </form>
    </div>
  `;
}

function renderStep3(data: OnboardingStepData): string {
  const features = [
    { value: 'responsive_design', label: 'Responsive Design (Mobile-Friendly)' },
    { value: 'contact_form', label: 'Contact Form' },
    { value: 'blog', label: 'Blog / News Section' },
    { value: 'gallery', label: 'Photo / Portfolio Gallery' },
    { value: 'ecommerce', label: 'Online Store / Payments' },
    { value: 'booking', label: 'Booking / Scheduling' },
    { value: 'user_accounts', label: 'User Accounts / Login' },
    { value: 'social_integration', label: 'Social Media Integration' },
    { value: 'seo', label: 'Search Engine Optimization' },
    { value: 'analytics', label: 'Analytics / Tracking' }
  ];

  const budgetRanges = [
    { value: 'under_5k', label: 'Under $5,000' },
    { value: '5k_10k', label: '$5,000 - $10,000' },
    { value: '10k_25k', label: '$10,000 - $25,000' },
    { value: '25k_50k', label: '$25,000 - $50,000' },
    { value: 'over_50k', label: 'Over $50,000' },
    { value: 'not_sure', label: 'Not sure yet' }
  ];

  const timelines = [
    { value: 'asap', label: 'ASAP (Rush Project)' },
    { value: '1_month', label: 'Within 1 month' },
    { value: '2_3_months', label: '2-3 months' },
    { value: '3_6_months', label: '3-6 months' },
    { value: 'flexible', label: 'Flexible / No rush' }
  ];

  const selectedFeatures = data.features || [];

  return `
    <div class="onboarding-step" data-step="3">
      <h3 class="step-heading">Requirements</h3>
      <p class="step-description">Help us understand what you need.</p>

      <form class="onboarding-form">
        <div class="form-group">
          <label>Desired Features (select all that apply)</label>
          <div class="checkbox-group checkbox-group--columns">
            ${features.map(f => `
              <label class="checkbox-item">
                <input type="checkbox" name="features" value="${f.value}"
                  ${selectedFeatures.includes(f.value) ? 'checked' : ''} />
                <span>${f.label}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="budget_range">Budget Range</label>
            <select id="budget_range" name="budget_range">
              <option value="">Select budget range...</option>
              ${budgetRanges.map(b => `
                <option value="${b.value}" ${data.budget_range === b.value ? 'selected' : ''}>
                  ${b.label}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="timeline">Timeline</label>
            <select id="timeline" name="timeline">
              <option value="">Select timeline...</option>
              ${timelines.map(t => `
                <option value="${t.value}" ${data.timeline === t.value ? 'selected' : ''}>
                  ${t.label}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      </form>
    </div>
  `;
}

function renderStep4(data: OnboardingStepData): string {
  const helpOptions = [
    { value: 'logo_design', label: 'Logo Design' },
    { value: 'brand_colors', label: 'Color Palette Selection' },
    { value: 'copywriting', label: 'Copywriting / Content Creation' },
    { value: 'photography', label: 'Photography / Image Sourcing' },
    { value: 'strategy', label: 'Brand Strategy' }
  ];

  const needsHelp = data.needs_help_with || [];

  return `
    <div class="onboarding-step" data-step="4">
      <h3 class="step-heading">Assets Checklist</h3>
      <p class="step-description">What materials do you already have?</p>

      <form class="onboarding-form">
        <div class="assets-checklist">
          <div class="asset-item">
            <label class="asset-checkbox">
              <input type="checkbox" name="has_logo" ${data.has_logo ? 'checked' : ''} />
              <div class="asset-content">
                <span class="asset-icon">${ICONS.IMAGE || '🖼️'}</span>
                <div class="asset-text">
                  <span class="asset-title">Logo Files</span>
                  <span class="asset-desc">PNG, SVG, or vector formats</span>
                </div>
              </div>
            </label>
          </div>

          <div class="asset-item">
            <label class="asset-checkbox">
              <input type="checkbox" name="has_brand_colors" ${data.has_brand_colors ? 'checked' : ''} />
              <div class="asset-content">
                <span class="asset-icon">${ICONS.PALETTE || '🎨'}</span>
                <div class="asset-text">
                  <span class="asset-title">Brand Colors</span>
                  <span class="asset-desc">Color codes or style guide</span>
                </div>
              </div>
            </label>
          </div>

          <div class="asset-item">
            <label class="asset-checkbox">
              <input type="checkbox" name="has_content" ${data.has_content ? 'checked' : ''} />
              <div class="asset-content">
                <span class="asset-icon">${ICONS.FILE_TEXT || '📝'}</span>
                <div class="asset-text">
                  <span class="asset-title">Written Content</span>
                  <span class="asset-desc">Text for pages, descriptions</span>
                </div>
              </div>
            </label>
          </div>

          <div class="asset-item">
            <label class="asset-checkbox">
              <input type="checkbox" name="has_photos" ${data.has_photos ? 'checked' : ''} />
              <div class="asset-content">
                <span class="asset-icon">${ICONS.CAMERA || '📷'}</span>
                <div class="asset-text">
                  <span class="asset-title">Photos / Images</span>
                  <span class="asset-desc">Product photos, team photos, etc.</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div class="form-group" style="margin-top: var(--space-lg);">
          <label>Need help with any of these?</label>
          <div class="checkbox-group">
            ${helpOptions.map(h => `
              <label class="checkbox-item">
                <input type="checkbox" name="needs_help_with" value="${h.value}"
                  ${needsHelp.includes(h.value) ? 'checked' : ''} />
                <span>${h.label}</span>
              </label>
            `).join('')}
          </div>
        </div>
      </form>
    </div>
  `;
}

function renderStep5(data: OnboardingStepData): string {
  const projectTypeLabels: Record<string, string> = {
    website: 'Website Design & Development',
    branding: 'Branding & Identity',
    ecommerce: 'E-commerce Store',
    marketing: 'Marketing & SEO',
    other: 'Other'
  };

  return `
    <div class="onboarding-step" data-step="5">
      <h3 class="step-heading">Review & Submit</h3>
      <p class="step-description">Please review the information you've provided.</p>

      <div class="review-sections">
        <div class="review-section">
          <h4>Basic Information</h4>
          <dl class="review-list">
            <dt>Company</dt>
            <dd>${escapeHtml(data.company_name || '—')}</dd>
            <dt>Contact</dt>
            <dd>${escapeHtml(data.contact_name || '—')}</dd>
            <dt>Email</dt>
            <dd>${escapeHtml(data.email || '—')}</dd>
            <dt>Phone</dt>
            <dd>${escapeHtml(data.phone || '—')}</dd>
          </dl>
        </div>

        <div class="review-section">
          <h4>Project Details</h4>
          <dl class="review-list">
            <dt>Project Type</dt>
            <dd>${data.project_type ? projectTypeLabels[data.project_type] || data.project_type : '—'}</dd>
            <dt>Description</dt>
            <dd>${escapeHtml(data.project_description || '—')}</dd>
            <dt>Goals</dt>
            <dd>${(data.project_goals || []).join(', ') || '—'}</dd>
          </dl>
        </div>

        <div class="review-section">
          <h4>Requirements</h4>
          <dl class="review-list">
            <dt>Features</dt>
            <dd>${(data.features || []).join(', ') || '—'}</dd>
            <dt>Budget</dt>
            <dd>${data.budget_range || '—'}</dd>
            <dt>Timeline</dt>
            <dd>${data.timeline || '—'}</dd>
          </dl>
        </div>

        <div class="review-section">
          <h4>Assets</h4>
          <ul class="assets-summary">
            <li class="${data.has_logo ? 'has-asset' : 'missing-asset'}">
              ${data.has_logo ? '✓' : '○'} Logo
            </li>
            <li class="${data.has_brand_colors ? 'has-asset' : 'missing-asset'}">
              ${data.has_brand_colors ? '✓' : '○'} Brand Colors
            </li>
            <li class="${data.has_content ? 'has-asset' : 'missing-asset'}">
              ${data.has_content ? '✓' : '○'} Written Content
            </li>
            <li class="${data.has_photos ? 'has-asset' : 'missing-asset'}">
              ${data.has_photos ? '✓' : '○'} Photos / Images
            </li>
          </ul>
          ${(data.needs_help_with || []).length > 0 ? `
            <p class="needs-help-note">Need help with: ${(data.needs_help_with || []).join(', ')}</p>
          ` : ''}
        </div>
      </div>

      <form class="onboarding-form">
        <div class="confirmation-checkbox">
          <label class="checkbox-item checkbox-item--prominent">
            <input type="checkbox" name="confirmed" ${data.confirmed ? 'checked' : ''} required />
            <span>I confirm that the information above is accurate</span>
          </label>
        </div>
      </form>
    </div>
  `;
}

// =====================================================
// STEP INDICATORS
// =====================================================

export function updateStepIndicators(currentStep: OnboardingStep): void {
  const indicators = document.querySelectorAll('.onboarding-step-indicator');

  indicators.forEach(indicator => {
    const stepAttr = indicator.getAttribute('data-step');
    if (!stepAttr) return;

    const step = parseInt(stepAttr, 10) as OnboardingStep;

    indicator.classList.remove('active', 'completed', 'future');

    if (step < currentStep) {
      indicator.classList.add('completed');
    } else if (step === currentStep) {
      indicator.classList.add('active');
    } else {
      indicator.classList.add('future');
    }
  });
}

// =====================================================
// ANIMATIONS
// =====================================================

export async function animateStepTransition(
  container: HTMLElement,
  direction: 'forward' | 'back'
): Promise<void> {
  const xOffset = direction === 'forward' ? 30 : -30;

  // Fade out current content
  await gsap.to(container, {
    opacity: 0,
    x: -xOffset,
    duration: 0.2,
    ease: 'power2.in'
  });

  // Reset position for incoming content
  gsap.set(container, { x: xOffset });

  // Fade in new content
  await gsap.to(container, {
    opacity: 1,
    x: 0,
    duration: 0.3,
    ease: 'power2.out'
  });
}

// =====================================================
// HELPERS
// =====================================================

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
