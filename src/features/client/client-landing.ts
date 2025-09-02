/**
 * ===============================================
 * CLIENT LANDING MODULE
 * ===============================================
 * @file src/features/client/client-landing.ts
 *
 * Handles client landing page functionality with GSAP animations.
 */

import { BaseModule } from '../../modules/base';
import { gsap } from 'gsap';
import { initFormValidation } from '../../utils/form-validation';
import { APP_CONSTANTS } from '../../config/constants';

export class ClientLandingModule extends BaseModule {
  private contentContainer: HTMLElement | null = null;
  private buttonsContainer: HTMLElement | null = null;
  private newButton: HTMLElement | null = null;
  private existingButton: HTMLElement | null = null;
  private titleElement: HTMLElement | null = null;

  constructor() {
    super('client-landing');
  }

  protected override async onInit(): Promise<void> {
    this.cacheElements();
    this.setupButtonAnimations();
    this.setupButtonHandlers();
    this.setupTitleHandler();
  }

  protected override onDestroy(): void {
    // Cleanup animations if needed
  }

  private setupFormSubmission(form: HTMLFormElement): void {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const submitBtn = form.querySelector('input[type="submit"]') as HTMLInputElement;
      const originalText = submitBtn.value;
      
      // Show loading state
      submitBtn.value = 'Submitting...';
      submitBtn.disabled = true;
      
      try {
        // Convert FormData to regular object for JSON submission
        const data: Record<string, string> = {};
        formData.forEach((value, key) => {
          data[key] = value as string;
        });

        const response = await fetch('/api/intake', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-request-id': `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Show success message
          this.showSuccessMessage(result.intakeId, result.estimatedResponseTime);
        } else {
          // Show error message
          this.showErrorMessage(result.error || 'Failed to submit intake form');
        }

      } catch (error) {
        console.error('Form submission error:', error);
        this.showErrorMessage('Network error. Please check your connection and try again.');
      } finally {
        // Reset button state
        submitBtn.value = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  private showSuccessMessage(intakeId: string, estimatedResponseTime: string): void {
    const successContent = `
      <div class="success-message" style="text-align: center; padding: 2rem; color: var(--fg);">
        <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
        <h3 style="color: var(--color-primary); margin-bottom: 1rem;">Intake Form Submitted Successfully!</h3>
        <p style="margin-bottom: 1rem;">Your intake form has been received and we're excited to work with you.</p>
        <div style="background: rgba(0, 255, 65, 0.1); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0;">
          <p style="margin: 0.5rem 0;"><strong>Intake ID:</strong> <code style="background: rgba(0, 255, 65, 0.2); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">${intakeId}</code></p>
          <p style="margin: 0.5rem 0;"><strong>Estimated Response Time:</strong> ${estimatedResponseTime}</p>
        </div>
        <p style="font-size: 0.9rem; opacity: 0.8;">We'll review your requirements and get back to you soon with a detailed proposal.</p>
        <button type="button" class="form-button" onclick="location.reload()" style="margin-top: 1rem;">Close</button>
      </div>
    `;
    
    this.showContent(successContent, 'SUBMISSION SUCCESSFUL');
  }

  private showErrorMessage(errorMessage: string): void {
    const errorContent = `
      <div class="error-message" style="text-align: center; padding: 2rem; color: var(--fg);">
        <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
        <h3 style="color: #ff4444; margin-bottom: 1rem;">Submission Failed</h3>
        <p style="margin-bottom: 1rem;">${errorMessage}</p>
        <p style="font-size: 0.9rem; opacity: 0.8; margin-bottom: 1rem;">Please try again or contact us directly if the problem persists.</p>
        <button type="button" class="form-button" onclick="history.back()" style="margin-top: 1rem;">Try Again</button>
      </div>
    `;
    
    this.showContent(errorContent, 'SUBMISSION ERROR');
  }

  private cacheElements(): void {
    this.contentContainer = document.querySelector('.client-content') as HTMLElement;
    this.buttonsContainer = document.querySelector('.client-buttons') as HTMLElement;
    this.newButton = document.querySelector('.client-buttons .btn[href*="intake"]') as HTMLElement;
    this.existingButton = document.querySelector('.client-buttons .btn[href*="portal"]') as HTMLElement;
    this.titleElement = document.querySelector('.login-title') as HTMLElement;
  }

  private hideTitle(): void {
    if (this.titleElement) {
      gsap.set(this.titleElement, { opacity: 0, display: 'none' });
    }
  }

  private showTitle(): void {
    if (this.titleElement) {
      gsap.set(this.titleElement, { display: 'block' });
      gsap.to(this.titleElement, {
        opacity: 1,
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      });
    }
  }

  private setupTitleHandler(): void {
    if (this.titleElement) {
      this.titleElement.style.cursor = 'pointer';
      this.titleElement.addEventListener('click', () => {
        this.resetToInitialState();
      });
    }
  }

  private resetToInitialState(): void {
    // Remove any existing dynamic content
    const existingContent = this.buttonsContainer?.querySelector('.dynamic-content');
    if (existingContent) {
      gsap.to(existingContent, {
        opacity: 0,
        y: 20,
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
        onComplete: () => {
          existingContent.remove();
        }
      });
    }

    // Reset buttons to inactive state
    this.setActiveButton(null);
    // Remove class for CSS fallback
    this.buttonsContainer?.classList.remove('has-dynamic-content');
  }

  private setupButtonHandlers(): void {
    if (this.newButton) {
      this.newButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.setActiveButton(this.newButton);
        this.showIntakeForm();
      });
    }

    if (this.existingButton) {
      this.existingButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.setActiveButton(this.existingButton);
        this.showLoginPortal();
      });
    }
  }

  private setActiveButton(activeButton: HTMLElement | null): void {
    // Reset all buttons to inactive state
    [this.newButton, this.existingButton].forEach(button => {
      if (button) {
        const fillElement = button.querySelector('.button-fill') as HTMLElement;
        if (fillElement) {
          gsap.set(fillElement, { width: '0%' });
        }
        gsap.set(button, { color: 'inherit' });
        button.classList.remove('active');
      }
    });

    // Set active button to filled state
    if (activeButton) {
      const fillElement = activeButton.querySelector('.button-fill') as HTMLElement;
      if (fillElement) {
        gsap.set(fillElement, {
          width: '100%',
          left: '0',
          right: 'auto',
          transformOrigin: 'left center'
        });
      }
      gsap.set(activeButton, { color: APP_CONSTANTS.THEME.DARK });
      activeButton.classList.add('active');
    }
  }

  private showIntakeForm(): void {
    const formContent = this.createIntakeForm();
    this.showContent(formContent, 'NEW CLIENT INTAKE');
  }

  private showLoginPortal(): void {
    const portalContent = this.createLoginPortal();
    this.showContent(portalContent, 'CLIENT LOGIN');
  }

  private showContent(content: string, title: string): void {
    if (!this.buttonsContainer) return;

    // Remove any existing dynamic content
    const existingContent = this.buttonsContainer.querySelector('.dynamic-content');
    if (existingContent) {
      existingContent.remove();
    }

    // Create new content container
    const dynamicContent = document.createElement('div');
    dynamicContent.className = 'dynamic-content';
    dynamicContent.innerHTML = `
      <div class="content-body">
        ${content}
      </div>
    `;

    // Append content to buttons container
    this.buttonsContainer.appendChild(dynamicContent);

    // Add class for CSS fallback (browsers without :has() support)
    this.buttonsContainer.classList.add('has-dynamic-content');

    // Setup close functionality - click outside to close
    dynamicContent.addEventListener('click', (e) => {
      if (e.target === dynamicContent) {
        this.closeContent(dynamicContent);
      }
    });

    // Animate in and initialize form validation
    gsap.set(dynamicContent, { opacity: 0, y: 20 });
    gsap.to(dynamicContent, {
      opacity: 1,
      y: 0,
      duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
      ease: APP_CONSTANTS.EASING.SMOOTH,
      onComplete: () => {
        // Initialize form validation after animation completes
        const form = dynamicContent.querySelector('form') as HTMLFormElement;
        if (form) {
          initFormValidation(form);
          this.setupFormSubmission(form);
        }
      }
    });
  }

  private closeContent(dynamicContent: HTMLElement): void {
    gsap.to(dynamicContent, {
      opacity: 0,
      y: 20,
      duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
      onComplete: () => {
        dynamicContent.remove();
        // Reset all buttons to inactive state
        this.setActiveButton(null);
        // Remove class for CSS fallback
        this.buttonsContainer?.classList.remove('has-dynamic-content');
      }
    });
  }

  private createIntakeForm(): string {
    return `
      <form class="contact-form" id="client-intake-form">
        <h2 style="grid-column: 1 / -1; grid-row: 1; margin: 0; text-align: center; color: var(--fg);">CLIENT INTAKE FORM</h2>
        
        <p class="form-intro" style="grid-column: 1 / -1; grid-row: 2; margin: 0 0 clamp(8px, 2vw, 16px) 0; text-align: center; color: var(--fg);">Please fill out this intake form to get started with your project.</p>
        
        <input class="form-input" type="text" id="company-name" name="company-name" placeholder="Company Name *" required style="grid-column: 1 / -1; grid-row: 3;">
        
        <input class="form-input" type="text" id="first-name" name="first-name" placeholder="First Name *" required style="grid-column: 1 / 2; grid-row: 4;">
        <input class="form-input" type="text" id="last-name" name="last-name" placeholder="Last Name *" required style="grid-column: 2 / 3; grid-row: 4;">
        
        <input class="form-input" type="email" id="email" name="email" placeholder="Email Address *" required style="grid-column: 1 / 2; grid-row: 5;">
        <input class="form-input" type="tel" id="phone" name="phone" placeholder="Phone Number" style="grid-column: 2 / 3; grid-row: 5;">
        
        <select class="form-select" id="project-type" name="project-type" required style="grid-column: 1 / -1; grid-row: 6;">
          <option value="">Project Type *</option>
          <option value="website">Website Development</option>
          <option value="webapp">Web Application</option>
          <option value="ecommerce">E-commerce Platform</option>
          <option value="mobile">Mobile App</option>
          <option value="other">Other</option>
        </select>
        
        <select class="form-select" id="budget" name="budget" style="grid-column: 1 / 2; grid-row: 7;">
          <option value="">Budget Range</option>
          <option value="under-5k">Under $5,000</option>
          <option value="5k-10k">$5,000 - $10,000</option>
          <option value="10k-25k">$10,000 - $25,000</option>
          <option value="25k-50k">$25,000 - $50,000</option>
          <option value="50k-plus">$50,000+</option>
        </select>
        
        <select class="form-select" id="timeline" name="timeline" style="grid-column: 2 / 3; grid-row: 7;">
          <option value="">Desired Timeline</option>
          <option value="asap">ASAP</option>
          <option value="1-2months">1-2 Months</option>
          <option value="3-6months">3-6 Months</option>
          <option value="6months-plus">6+ Months</option>
          <option value="flexible">Flexible</option>
        </select>
        
        <textarea class="form-textarea" id="project-description" name="project-description" placeholder="Project Description - Please describe your project requirements, goals, and any specific features you need..." required style="grid-column: 1 / -1; grid-row: 8;"></textarea>
        
        <textarea class="form-textarea" id="additional-info" name="additional-info" placeholder="Additional Information - Any additional details, questions, or requirements..." style="grid-column: 1 / -1; grid-row: 9;"></textarea>
        
        <div class="form-actions" style="grid-column: 1 / -1; grid-row: 10;">
          <input class="form-button" type="submit" value="Submit Intake Form">
        </div>
      </form>
    `;
  }

  private createLoginPortal(): string {
    return `
      <form class="contact-form" id="client-login-form">
        <h2 style="grid-column: 1 / -1; margin: 0; text-align: center; color: var(--fg);">LOGIN</h2>
        
        <input class="form-input" type="email" id="client-email" name="email" placeholder="Email Address *" required style="grid-column: 1 / -1;">
        <div class="error-message" id="email-error" style="grid-column: 1 / -1;"></div>
        
        <div class="password-input-wrapper" style="grid-column: 1 / -1;">
          <input class="form-input" type="password" id="client-password" name="password" placeholder="Password *" required>
          <button type="button" class="password-toggle" aria-label="Toggle password visibility">👁️</button>
        </div>
        
        <input class="form-button" type="submit" value="Access Dashboard" id="login-btn" style="grid-column: 1 / -1; width: 100%; padding: 0.75rem 1.5rem; margin-top: 1rem;">
        <div class="btn-loader" style="display: none; grid-column: 1 / -1;"></div>
        
        <p style="grid-column: 1 / -1; text-align: center; margin: 0.5rem 0; color: var(--fg);">Forgot your password? <button type="button" class="link-btn">Reset Password</button></p>
        
        <p style="grid-column: 1 / -1; text-align: center; margin: 0; color: var(--fg); opacity: 0.8;">Demo credentials: demo@example.com / password123</p>
        
        <div class="error-message" id="login-error" style="grid-column: 1 / -1;"></div>
      </form>
    `;
  }

  private setupButtonAnimations(): void {
    const buttons = document.querySelectorAll('.client-buttons .btn');
    buttons.forEach(button => {
      this.animateButton(button as HTMLElement);
    });
  }

  private animateButton(button: HTMLElement): void {
    // Get button text and wrap it
    const buttonText = button.textContent?.trim() || '';
    button.innerHTML = `<span style="position: relative; z-index: 2;">${buttonText}</span>`;

    // Create fill element for hover effect
    const fillElement = document.createElement('div');
    fillElement.className = 'button-fill';
    fillElement.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 0%;
      height: 100%;
      background-color: ${APP_CONSTANTS.THEME.PRIMARY};
      z-index: 0;
      pointer-events: none;
      border-radius: inherit;
      transform-origin: left center;
    `;
    button.appendChild(fillElement);

    // Add hover animations - only if not active
    button.addEventListener('mouseenter', (e: MouseEvent) => {
      // Skip hover animation if button is active
      if (button.classList.contains('active')) return;

      const rect = button.getBoundingClientRect();
      const mouseX = e.clientX;
      const buttonCenter = rect.left + rect.width / 2;
      const enteredFromLeft = mouseX < buttonCenter;

      gsap.set(fillElement, {
        left: enteredFromLeft ? '0' : 'auto',
        right: enteredFromLeft ? 'auto' : '0',
        transformOrigin: enteredFromLeft ? 'left center' : 'right center'
      });

      gsap.to(fillElement, {
        width: '100%',
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      });

      gsap.to(button, {
        color: APP_CONSTANTS.THEME.DARK,
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      });
    });

    button.addEventListener('mouseleave', (e: MouseEvent) => {
      // Skip hover exit animation if button is active
      if (button.classList.contains('active')) return;

      const rect = button.getBoundingClientRect();
      const mouseX = e.clientX;
      const buttonCenter = rect.left + rect.width / 2;
      const exitingFromLeft = mouseX < buttonCenter;

      gsap.set(fillElement, {
        left: exitingFromLeft ? '0' : 'auto',
        right: exitingFromLeft ? 'auto' : '0',
        transformOrigin: exitingFromLeft ? 'left center' : 'right center'
      });

      gsap.to(fillElement, {
        width: '0%',
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      });

      gsap.to(button, {
        color: 'inherit',
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      });
    });
  }
}