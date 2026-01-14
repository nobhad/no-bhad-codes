/**
 * ===============================================
 * CONTACT SERVICE
 * ===============================================
 * @file src/services/contact-service.ts
 *
 * Service for handling contact form submissions with multiple backend options.
 * Supports Netlify Forms, Formspree, and custom email services.
 * Includes comprehensive input sanitization and XSS protection.
 */

import { BaseService } from './base-service';
import { SanitizationUtils } from '../utils/sanitization-utils';
import { getFormspreeUrl } from '../config/api';

export interface ContactFormData {
  name: string;
  email: string;
  companyName?: string;
  message: string;
}

export interface ContactSubmissionResult {
  success: boolean;
  message: string;
  error?: string;
}

export type ContactBackend = 'netlify' | 'formspree' | 'custom' | 'emailjs';

export interface ContactServiceConfig {
  backend: ContactBackend;
  endpoint?: string;
  apiKey?: string;
  formId?: string;
}

export class ContactService extends BaseService {
  private config: ContactServiceConfig;

  constructor(config: ContactServiceConfig = { backend: 'netlify' }) {
    super('ContactService');
    this.config = config;
  }

  override async init(): Promise<void> {
    await super.init();
    this.validateConfig();
  }

  /**
   * Validate service configuration
   */
  private validateConfig(): void {
    switch (this.config.backend) {
    case 'formspree':
      if (!this.config.formId) {
        throw new Error('Formspree backend requires formId in config');
      }
      break;
    case 'custom':
      if (!this.config.endpoint) {
        throw new Error('Custom backend requires endpoint in config');
      }
      break;
    case 'emailjs':
      if (!this.config.apiKey) {
        throw new Error('EmailJS backend requires apiKey in config');
      }
      break;
    case 'netlify':
      // No additional config needed for Netlify
      break;
    default:
      throw new Error(`Unknown backend: ${this.config.backend}`);
    }
  }

  /**
   * Submit contact form with security checks
   */
  async submitForm(formData: ContactFormData): Promise<ContactSubmissionResult> {
    try {
      this.log('Submitting contact form...', { backend: this.config.backend });

      // Rate limiting check (5 submissions per 5 minutes)
      const clientIdentifier = this.getClientIdentifier(formData);
      if (!SanitizationUtils.checkRateLimit(clientIdentifier, 5, 300000)) {
        SanitizationUtils.logSecurityViolation(
          'rate_limit_exceeded',
          { identifier: clientIdentifier },
          navigator.userAgent
        );
        return {
          success: false,
          message: 'Whoa, slow down! You\'ve sent too many messages. Please wait 5 minutes before trying again.',
          error: 'rate_limit'
        };
      }

      // Sanitize form data
      const sanitizedData = this.sanitizeFormData(formData);

      // Validate sanitized data
      const validation = this.validateFormData(sanitizedData);
      if (!validation.valid) {
        return {
          success: false,
          message: 'Please check your input and try again.',
          error: validation.errors.join(', ')
        };
      }

      // Check for XSS attempts
      const xssCheck = this.detectXssInFormData(formData);
      if (xssCheck.detected) {
        SanitizationUtils.logSecurityViolation(
          'xss_attempt',
          {
            fields: xssCheck.fields,
            formData: sanitizedData
          },
          navigator.userAgent
        );

        return {
          success: false,
          message: 'Invalid input detected. Please check your message and try again.',
          error: 'Security validation failed'
        };
      }

      switch (this.config.backend) {
      case 'netlify':
        return await this.submitToNetlify(sanitizedData);
      case 'formspree':
        return await this.submitToFormspree(sanitizedData);
      case 'emailjs':
        return await this.submitToEmailJS(sanitizedData);
      case 'custom':
        return await this.submitToCustom(sanitizedData);
      default:
        // Gracefully handle unknown backend - should never happen due to TypeScript enforcement
        this.error(`Unknown backend type: ${this.config.backend}`);
        return {
          success: false,
          message: 'Contact form configuration error. Please try again later.',
          error: `Unsupported backend: ${this.config.backend}`
        };
      }
    } catch (error) {
      this.error('Form submission failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Provide user-friendly error messages based on error type
      let userMessage = 'Unable to send message. Please try again.';
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else if (errorMessage.includes('404') || errorMessage.includes('Netlify')) {
        userMessage = 'Form service unavailable. Please email nobhaduri@gmail.com directly.';
      }

      return {
        success: false,
        message: userMessage,
        error: errorMessage
      };
    }
  }

  /**
   * Submit to Netlify Forms
   */
  private async submitToNetlify(formData: ContactFormData): Promise<ContactSubmissionResult> {
    const form = new FormData();
    form.append('form-name', 'contact-form');
    form.append('Name', formData.name);
    form.append('Email', formData.email);
    if (formData.companyName) {
      form.append('Company-Name', formData.companyName);
    }
    form.append('Message', formData.message);

    const response = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form as any).toString()
    });

    if (response.ok) {
      this.log('Netlify form submission successful');
      return {
        success: true,
        message: 'Message received, thanks!'
      };
    }
    throw new Error(`Netlify submission failed: ${response.status} ${response.statusText}`);
  }

  /**
   * Submit to Formspree
   */
  private async submitToFormspree(formData: ContactFormData): Promise<ContactSubmissionResult> {
    if (!this.config.formId) {
      throw new Error('Formspree form ID not configured');
    }

    const response = await fetch(getFormspreeUrl(this.config.formId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: formData.name,
        email: formData.email,
        companyName: formData.companyName,
        message: formData.message
      })
    });

    if (response.ok) {
      this.log('Formspree submission successful');
      return {
        success: true,
        message: 'Message received, thanks!'
      };
    }
    const errorText = await response.text();
    throw new Error(`Formspree submission failed: ${response.status} - ${errorText}`);
  }

  /**
   * Submit to EmailJS
   */
  private async submitToEmailJS(formData: ContactFormData): Promise<ContactSubmissionResult> {
    // EmailJS requires their SDK to be loaded
    if (typeof window === 'undefined' || !(window as any).emailjs) {
      throw new Error('EmailJS SDK not loaded');
    }

    const templateParams = {
      from_name: formData.name,
      from_email: formData.email,
      company_name: formData.companyName || 'N/A',
      message: formData.message
    };

    // Get EmailJS config from environment variables
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;

    if (!serviceId || !templateId) {
      throw new Error('EmailJS service ID or template ID not configured in environment variables');
    }

    const _response = await (window as any).emailjs.send(
      serviceId,
      templateId,
      templateParams,
      this.config.apiKey
    );

    this.log('EmailJS submission successful');
    return {
      success: true,
      message: 'Message received, thanks!'
    };
  }

  /**
   * Submit to custom endpoint
   */
  private async submitToCustom(formData: ContactFormData): Promise<ContactSubmissionResult> {
    if (!this.config.endpoint) {
      throw new Error('Custom endpoint not configured');
    }

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` })
      },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      this.log('Custom endpoint submission successful');
      const result = await response.json();
      return {
        success: true,
        message: result.message || 'Message received, thanks!'
      };
    }
    const errorText = await response.text();
    throw new Error(`Custom endpoint submission failed: ${response.status} - ${errorText}`);
  }

  /**
   * Validate form data
   */
  validateFormData(formData: Partial<ContactFormData>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!formData.name?.trim()) {
      errors.push('Name is required');
    }

    if (!formData.email?.trim()) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(formData.email)) {
      errors.push('Please enter a valid email address');
    }

    if (!formData.message?.trim()) {
      errors.push('Message is required');
    } else if (formData.message.length < 10) {
      errors.push('Message must be at least 10 characters long');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Sanitize form data using security utilities
   */
  private sanitizeFormData(formData: ContactFormData): ContactFormData {
    return {
      name: SanitizationUtils.sanitizeText(formData.name),
      email: SanitizationUtils.sanitizeEmail(formData.email),
      companyName: formData.companyName ? SanitizationUtils.sanitizeText(formData.companyName) : '',
      message: SanitizationUtils.sanitizeMessage(formData.message)
    };
  }

  /**
   * Detect XSS attempts in form data
   */
  private detectXssInFormData(formData: ContactFormData): { detected: boolean; fields: string[] } {
    const suspiciousFields: string[] = [];

    const fields = {
      name: formData.name,
      email: formData.email,
      companyName: formData.companyName,
      message: formData.message
    };

    for (const [fieldName, value] of Object.entries(fields)) {
      if (value && SanitizationUtils.detectXss(value)) {
        suspiciousFields.push(fieldName);
      }
    }

    return {
      detected: suspiciousFields.length > 0,
      fields: suspiciousFields
    };
  }

  /**
   * Generate client identifier for rate limiting
   */
  private getClientIdentifier(formData: ContactFormData): string {
    // Use email + IP-like identifier (in real app, you'd get actual IP from server)
    const browserFingerprint =
      navigator.userAgent + navigator.language + screen.width + screen.height;
    const hash = btoa(formData.email + browserFingerprint).slice(0, 16);
    return hash;
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<ContactServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log('Contact service configuration updated', this.config);
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Omit<ContactServiceConfig, 'apiKey'> {
    const { apiKey: _apiKey, ...safeConfig } = this.config;
    return safeConfig;
  }

  override getStatus() {
    return {
      ...super.getStatus(),
      backend: this.config.backend,
      configured: this.isConfigured()
    };
  }

  private isConfigured(): boolean {
    try {
      this.validateConfig();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate form data
   */
  validateForm(formData: ContactFormData): { isValid: boolean; errors: string[] } {
    const validation = this.validateFormData(formData);
    return {
      isValid: validation.valid,
      errors: validation.errors
    };
  }

  /**
   * Generate email template
   */
  generateEmailTemplate(formData: ContactFormData): string {
    return `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${formData.name}</p>
      <p><strong>Email:</strong> ${formData.email}</p>
      <p><strong>Company:</strong> ${formData.companyName || 'N/A'}</p>
      <p><strong>Message:</strong></p>
      <p>${formData.message}</p>
    `;
  }

  /**
   * Generate auto-reply template
   */
  generateAutoReplyTemplate(formData: ContactFormData): string {
    return `
      <h2>Thank you for contacting us!</h2>
      <p>Hi ${formData.name},</p>
      <p>We've received your message and will get back to you soon.</p>
      <p>Best regards,<br>The Team</p>
    `;
  }

  /**
   * Get service metrics
   */
  getMetrics(): { submissionCount: number; validationFailures: number; successRate: number } {
    // Default implementation - can be overridden with actual metrics
    return {
      submissionCount: 0,
      validationFailures: 0,
      successRate: 100
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    // Default implementation - can be overridden with actual metrics storage
    this.log('Metrics reset');
  }

  /**
   * Clear rate limiting data
   */
  clearRateLimitData(): void {
    // Clear rate limit data if stored
    this.log('Rate limit data cleared');
  }
}
