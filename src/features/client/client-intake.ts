/**
 * ===============================================
 * CLIENT INTAKE MODULE
 * ===============================================
 * @file src/features/client/client-intake.ts
 *
 * Handles the client intake form functionality including:
 * - Progressive form sections
 * - Dynamic budget options based on project type
 * - Form validation and submission
 * - Integration with GSAP animations
 * - Auto-save functionality
 */

import { BaseModule } from '../../modules/base.js';
import { gsap } from 'gsap';

interface IntakeModuleOptions {
  autoSave?: boolean;
  progressTracking?: boolean;
  animationsEnabled?: boolean;
}

export class ClientIntakeModule extends BaseModule {
  private container: HTMLElement;
  private form: HTMLFormElement;
  private progressFill: HTMLElement;
  private submitBtn: HTMLButtonElement;
  private loadingDiv: HTMLElement;
  private currentSection = 1;
  private totalSections = 6;
  private autoSaveEnabled: boolean;
  private progressTrackingEnabled: boolean;
  private animationsEnabled: boolean;
  private autoSaveIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(container: HTMLElement, options: IntakeModuleOptions = {}) {
    super('client-intake', {
      debug: options.animationsEnabled ?? true
    });

    this.container = container;
    this.autoSaveEnabled = options.autoSave ?? true;
    this.progressTrackingEnabled = options.progressTracking ?? true;
    this.animationsEnabled = options.animationsEnabled ?? true;

    this.form = container.querySelector('#intakeForm') as HTMLFormElement;
    this.progressFill = container.querySelector('#progressFill') as HTMLElement;
    this.submitBtn = container.querySelector('#submitBtn') as HTMLButtonElement;
    this.loadingDiv = container.querySelector('#loadingDiv') as HTMLElement;

    if (!this.form) {
      throw new Error('Intake form not found in container');
    }
  }

  override async init(): Promise<void> {
    try {
      this.log('Initializing client intake form...');

      // Initialize form animations
      if (this.animationsEnabled) {
        this.initializeAnimations();
      }

      // Set up form functionality
      this.setupFormLogic();
      this.setupProjectTypeHandling();
      this.setupProgressTracking();
      this.setupFormValidation();
      this.setupAutoSave();
      this.setupFormSubmission();

      // Load any saved data
      this.loadSavedData();

      this.log('Client intake form initialized successfully');
    } catch (error) {
      this.error('Failed to initialize client intake form:', error);
      throw error;
    }
  }

  private initializeAnimations(): void {
    // Animate form sections on load
    const sections = this.form.querySelectorAll('.form-section');
    sections.forEach((section, index) => {
      gsap.set(section, { opacity: 0, y: 20 });
      gsap.to(section, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        delay: index * 0.1,
        ease: 'power2.out'
      });
    });
  }

  private setupFormLogic(): void {
    // Handle referral source visibility
    const referralRadios = this.form.querySelectorAll(
      'input[name="wasReferred"]'
    ) as NodeListOf<HTMLInputElement>;
    const referralSection = this.form.querySelector('#referralSource') as HTMLElement;
    const referralNameField = this.form.querySelector('#referralName') as HTMLInputElement;

    referralRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.value === 'yes') {
          referralSection.style.display = 'block';
          referralSection.classList.add('active');
          referralNameField.required = true;
          if (this.animationsEnabled) {
            gsap.fromTo(
              referralSection,
              { opacity: 0, height: 0 },
              { opacity: 1, height: 'auto', duration: 0.3 }
            );
          }
        } else {
          referralNameField.required = false;
          referralNameField.value = '';
          if (this.animationsEnabled) {
            gsap.to(referralSection, {
              opacity: 0,
              height: 0,
              duration: 0.3,
              onComplete: () => {
                referralSection.style.display = 'none';
                referralSection.classList.remove('active');
              }
            });
          } else {
            referralSection.style.display = 'none';
            referralSection.classList.remove('active');
          }
        }
      });
    });
  }

  private setupProjectTypeHandling(): void {
    const projectTypeSelect = this.form.querySelector('#projectType') as HTMLSelectElement;
    const budgetSelect = this.form.querySelector('#budget') as HTMLSelectElement;

    // Feature sections mapping
    const featureSections = {
      'simple-site': 'simpleSiteFeatures',
      'business-site': 'businessSiteFeatures',
      portfolio: 'portfolioFeatures',
      ecommerce: 'ecommerceFeatures',
      'web-app': 'webAppFeatures',
      'browser-extension': 'extensionFeatures'
    };

    // Budget options mapping
    const budgetOptions = {
      'simple-site': [
        { value: 'under-1k', text: 'Under $1,000' },
        { value: '1k-2k', text: '$1,000 - $2,000' },
        { value: '2k-3k', text: '$2,000 - $3,000' },
        { value: 'discuss', text: 'Let\'s discuss' }
      ],
      'business-site': [
        { value: '2k-5k', text: '$2,000 - $5,000' },
        { value: '5k-8k', text: '$5,000 - $8,000' },
        { value: '8k-12k', text: '$8,000 - $12,000' },
        { value: 'discuss', text: 'Let\'s discuss' }
      ],
      portfolio: [
        { value: '1k-3k', text: '$1,000 - $3,000' },
        { value: '3k-6k', text: '$3,000 - $6,000' },
        { value: '6k-10k', text: '$6,000 - $10,000' },
        { value: 'discuss', text: 'Let\'s discuss' }
      ],
      ecommerce: [
        { value: '5k-10k', text: '$5,000 - $10,000' },
        { value: '10k-20k', text: '$10,000 - $20,000' },
        { value: '20k-35k', text: '$20,000 - $35,000' },
        { value: '35k-plus', text: '$35,000+' },
        { value: 'discuss', text: 'Let\'s discuss' }
      ],
      'web-app': [
        { value: '10k-25k', text: '$10,000 - $25,000' },
        { value: '25k-50k', text: '$25,000 - $50,000' },
        { value: '50k-100k', text: '$50,000 - $100,000' },
        { value: '100k-plus', text: '$100,000+' },
        { value: 'discuss', text: 'Let\'s discuss' }
      ],
      'browser-extension': [
        { value: '3k-8k', text: '$3,000 - $8,000' },
        { value: '8k-15k', text: '$8,000 - $15,000' },
        { value: '15k-25k', text: '$15,000 - $25,000' },
        { value: 'discuss', text: 'Let\'s discuss' }
      ],
      other: [
        { value: 'under-5k', text: 'Under $5,000' },
        { value: '5k-15k', text: '$5,000 - $15,000' },
        { value: '15k-35k', text: '$15,000 - $35,000' },
        { value: '35k-plus', text: '$35,000+' },
        { value: 'discuss', text: 'Let\'s discuss' }
      ]
    };

    projectTypeSelect.addEventListener('change', () => {
      const selectedType = projectTypeSelect.value as keyof typeof featureSections;

      // Hide all feature sections
      Object.values(featureSections).forEach((sectionId) => {
        const section = this.form.querySelector(`#${sectionId}`) as HTMLElement;
        if (section) {
          section.style.display = 'none';
          section.classList.remove('active');
          // Clear checkboxes in hidden sections
          const checkboxes = section.querySelectorAll(
            'input[type="checkbox"]'
          ) as NodeListOf<HTMLInputElement>;
          checkboxes.forEach((checkbox) => {
            checkbox.checked = false;
            checkbox.required = false;
          });
        }
      });

      // Update budget options
      budgetSelect.innerHTML = '<option value="">Select budget range...</option>';
      const options = budgetOptions[selectedType] || budgetOptions.other;
      options.forEach((option) => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        budgetSelect.appendChild(optionElement);
      });

      // Show relevant feature section
      if (selectedType && featureSections[selectedType]) {
        const sectionToShow = this.form.querySelector(
          `#${featureSections[selectedType]}`
        ) as HTMLElement;
        if (sectionToShow) {
          sectionToShow.style.display = 'block';
          sectionToShow.classList.add('active');

          // Make at least one checkbox required
          const firstCheckbox = sectionToShow.querySelector(
            'input[type="checkbox"]'
          ) as HTMLInputElement;
          if (firstCheckbox) {
            firstCheckbox.required = true;
          }

          // Animate section in
          if (this.animationsEnabled) {
            gsap.fromTo(sectionToShow, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 });
          }
        }
      }

      this.updateProgress();
    });
  }

  private setupProgressTracking(): void {
    if (!this.progressTrackingEnabled || !this.progressFill) return;

    const inputs = this.form.querySelectorAll('input, select, textarea') as NodeListOf<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >;

    inputs.forEach((input) => {
      input.addEventListener('input', () => this.updateProgress());
      input.addEventListener('change', () => this.updateProgress());
    });

    // Initial progress update
    this.updateProgress();
  }

  private updateProgress(): void {
    if (!this.progressFill) return;

    const formData = new FormData(this.form);
    const totalFields = this.form.querySelectorAll(
      'input:not([type="hidden"]), select, textarea'
    ).length;
    let filledFields = 0;

    // Count filled text inputs, selects, and textareas
    for (const [_key, value] of formData.entries()) {
      if (typeof value === 'string' && value.trim() !== '') {
        filledFields++;
      }
    }

    // Count checked checkboxes and radios separately
    const checkedInputs = this.form.querySelectorAll('input:checked').length;
    filledFields += checkedInputs;

    const progress = Math.min((filledFields / totalFields) * 100, 100);

    if (this.animationsEnabled) {
      gsap.to(this.progressFill, {
        width: `${progress}%`,
        duration: 0.3,
        ease: 'power2.out'
      });
    } else {
      this.progressFill.style.width = `${progress}%`;
    }
  }

  private setupFormValidation(): void {
    // Real-time validation for required fields
    const requiredFields = this.form.querySelectorAll('[required]') as NodeListOf<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >;

    requiredFields.forEach((field) => {
      field.addEventListener('blur', () => this.validateField(field));
      field.addEventListener('input', () => this.clearFieldError(field));
    });
  }

  private validateField(
    field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  ): boolean {
    const isValid = field.checkValidity();
    const fieldGroup = field.closest('.form-group') as HTMLElement;

    if (!isValid) {
      field.style.borderColor = '#ef4444';
      this.showFieldError(fieldGroup, field.validationMessage);
    } else {
      field.style.borderColor = '';
      this.clearFieldError(field);
    }

    return isValid;
  }

  private showFieldError(fieldGroup: HTMLElement, message: string): void {
    let errorElement = fieldGroup.querySelector('.error-message') as HTMLElement;
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'error-message';
      fieldGroup.appendChild(errorElement);
    }
    errorElement.textContent = message;
    errorElement.classList.add('show');
  }

  private clearFieldError(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
    field.style.borderColor = '';
    const fieldGroup = field.closest('.form-group') as HTMLElement;
    const errorElement = fieldGroup?.querySelector('.error-message') as HTMLElement;
    if (errorElement) {
      errorElement.classList.remove('show');
    }
  }

  private setupAutoSave(): void {
    if (!this.autoSaveEnabled) return;

    const inputs = this.form.querySelectorAll('input, select, textarea') as NodeListOf<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >;

    inputs.forEach((input) => {
      input.addEventListener('change', () => this.saveFormData());
    });

    // Auto-save every 30 seconds - store interval ID for cleanup
    this.autoSaveIntervalId = setInterval(() => this.saveFormData(), 30000);
  }

  private saveFormData(): void {
    try {
      const formData = new FormData(this.form);
      const data: Record<string, any> = {};

      for (const [key, value] of formData.entries()) {
        if (data[key]) {
          if (Array.isArray(data[key])) {
            data[key].push(value);
          } else {
            data[key] = [data[key], value];
          }
        } else {
          data[key] = value;
        }
      }

      localStorage.setItem(
        'intakeFormData',
        JSON.stringify({
          data,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      this.warn('Failed to save form data:', error);
    }
  }

  private loadSavedData(): void {
    try {
      const savedData = localStorage.getItem('intakeFormData');
      if (!savedData) return;

      const { data, timestamp } = JSON.parse(savedData);

      // Only load data that's less than 24 hours old
      if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('intakeFormData');
        return;
      }

      // Populate form fields
      Object.entries(data).forEach(([key, value]) => {
        const field = this.form.querySelector(`[name="${key}"]`) as
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement;
        if (field) {
          if (field.type === 'checkbox' || field.type === 'radio') {
            if (Array.isArray(value)) {
              value.forEach((v: string) => {
                const specificField = this.form.querySelector(
                  `[name="${key}"][value="${v}"]`
                ) as HTMLInputElement;
                if (specificField) specificField.checked = true;
              });
            } else {
              (field as HTMLInputElement).checked = field.value === value;
            }
          } else {
            field.value = Array.isArray(value) ? value[0] : value;
          }
        }
      });

      // Trigger project type change to show relevant sections
      const projectTypeField = this.form.querySelector('#projectType') as HTMLSelectElement;
      if (projectTypeField && projectTypeField.value) {
        projectTypeField.dispatchEvent(new Event('change'));
      }

      this.updateProgress();
    } catch (error) {
      this.warn('Failed to load saved form data:', error);
    }
  }

  private setupFormSubmission(): void {
    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.submitForm();
    });
  }

  private async submitForm(): Promise<void> {
    try {
      // Validate all required fields
      const requiredFields = this.form.querySelectorAll('[required]') as NodeListOf<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >;
      let isFormValid = true;

      requiredFields.forEach((field) => {
        if (!this.validateField(field)) {
          isFormValid = false;
        }
      });

      if (!isFormValid) {
        this.showError('Please fill in all required fields.');
        return;
      }

      // Show loading state
      this.setLoadingState(true);

      // Collect form data
      const formData = new FormData(this.form);
      const intakeData: Record<string, any> = {};

      // Convert FormData to structured object and map fields
      for (const [key, value] of formData.entries()) {
        // Map frontend field names to backend field names
        let mappedKey = key;
        if (key === 'projectDescription') {
          mappedKey = 'description';
        }

        if (intakeData[mappedKey]) {
          if (Array.isArray(intakeData[mappedKey])) {
            intakeData[mappedKey].push(value);
          } else {
            intakeData[mappedKey] = [intakeData[mappedKey], value];
          }
        } else {
          intakeData[mappedKey] = value;
        }
      }

      // Add submission timestamp (not needed for our backend, but keep for compatibility)
      intakeData.submittedAt = new Date().toISOString();

      // Submit to API
      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(intakeData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Success - clear saved data and show success message
      localStorage.removeItem('intakeFormData');

      this.log('Form submitted successfully:', result);

      // Show success message instead of redirect for now
      if (this.animationsEnabled) {
        gsap.to(this.container, {
          opacity: 0,
          y: -30,
          duration: 0.5,
          onComplete: () => {
            this.showSuccessMessage(result);
          }
        });
      } else {
        this.showSuccessMessage(result);
      }
    } catch (error) {
      this.error('Form submission failed:', error);
      this.showError('There was an error submitting your form. Please try again.');
      this.setLoadingState(false);
    }
  }

  private setLoadingState(loading: boolean): void {
    if (loading) {
      this.submitBtn.disabled = true;
      this.submitBtn.style.display = 'none';
      this.loadingDiv.style.display = 'flex';
      this.loadingDiv.classList.add('active');
    } else {
      this.submitBtn.disabled = false;
      this.submitBtn.style.display = 'inline-block';
      this.loadingDiv.style.display = 'none';
      this.loadingDiv.classList.remove('active');
    }
  }

  private showError(message: string): void {
    // Create or update error message
    let errorDiv = document.querySelector('.intake-container .form-error') as HTMLElement;
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'form-error error-message show';
      errorDiv.style.textAlign = 'center';
      errorDiv.style.marginBottom = '1rem';
      this.form.prepend(errorDiv);
    }
    errorDiv.textContent = message;
    errorDiv.classList.add('show');

    // Scroll to top of form
    this.form.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Hide error after 5 seconds
    setTimeout(() => {
      errorDiv.classList.remove('show');
    }, 5000);
  }

  private showSuccessMessage(result: any): void {
    // Replace form content with success message
    this.container.innerHTML = `
      <div class="success-container" style="text-align: center; padding: 2rem;">
        <div class="success-icon" style="font-size: 4rem; color: #22c55e; margin-bottom: 1rem;">✅</div>
        <h2 style="color: #22c55e; margin-bottom: 1rem;">Thank You!</h2>
        <p style="font-size: 1.1rem; margin-bottom: 1rem;">
          Your project intake has been submitted successfully.
        </p>
        <p style="color: #6b7280; margin-bottom: 2rem;">
          Intake ID: ${result.intake?.id || 'N/A'}<br>
          Project Type: ${result.intake?.projectType || 'N/A'}
        </p>
        <p style="color: #374151;">
          I'll review your submission and get back to you within 24 hours to discuss your project in detail.
        </p>
      </div>
    `;
  }

  override async destroy(): Promise<void> {
    try {
      // Save current form state before destroying
      if (this.autoSaveEnabled) {
        this.saveFormData();
      }

      // Clear autosave interval
      if (this.autoSaveIntervalId) {
        clearInterval(this.autoSaveIntervalId);
        this.autoSaveIntervalId = null;
      }

      // Remove event listeners
      this.form?.removeEventListener('submit', this.submitForm);

      await super.destroy();
    } catch (error) {
      this.error('Failed to destroy client intake module:', error);
    }
  }
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const intakeContainer = document.querySelector('.intake-container') as HTMLElement;
  if (intakeContainer) {
    const module = new ClientIntakeModule(intakeContainer, {
      autoSave: true,
      progressTracking: true,
      animationsEnabled: true
    });

    module.init().catch((error) => {
      console.error('Failed to initialize intake form:', error);
    });
  }
});
