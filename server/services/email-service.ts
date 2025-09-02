/**
 * ===============================================
 * EMAIL NOTIFICATION SERVICE
 * ===============================================
 * @file server/services/email-service.ts
 *
 * Comprehensive email service with templates, queuing, and delivery tracking
 */

import * as nodemailer from 'nodemailer';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as Handlebars from 'handlebars';

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer | string;
    contentType?: string;
  }>;
  priority?: 'high' | 'normal' | 'low';
  template?: string;
  templateData?: Record<string, any>;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  replyTo?: string;
}

export interface EmailResult {
  messageId: string;
  response: string;
  accepted: string[];
  rejected: string[];
  pending?: string[];
}

export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter | null = null;
  private templates: Map<string, EmailTemplate> = new Map();
  private config: EmailConfig | null = null;
  private isInitialized = false;
  private emailQueue: Array<{ options: EmailOptions; resolve: Function; reject: Function }> = [];
  private isProcessingQueue = false;

  private constructor() {}

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Initialize email service with configuration
   */
  async init(config: EmailConfig): Promise<void> {
    try {
      this.config = config;
      
      // Create nodemailer transporter
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.auth.user,
          pass: config.auth.pass,
        },
      });

      // Verify connection
      await this.transporter.verify();
      console.log('✅ Email service initialized successfully');

      // Load email templates
      await this.loadTemplates();

      this.isInitialized = true;
      
      // Start processing queued emails
      this.processQueue();

    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
      throw new Error(`Email service initialization failed: ${error}`);
    }
  }

  /**
   * Send email using template or direct content
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    if (!this.isInitialized || !this.transporter || !this.config) {
      // Queue email if service not ready
      return new Promise((resolve, reject) => {
        this.emailQueue.push({ options, resolve, reject });
      });
    }

    try {
      let htmlContent = options.html;
      let textContent = options.text;
      let subject = options.subject;

      // Use template if specified
      if (options.template && options.templateData) {
        const rendered = await this.renderTemplate(options.template, options.templateData);
        htmlContent = rendered.html;
        textContent = rendered.text || textContent;
        subject = rendered.subject;
      }

      // Validate that we have required fields
      if (!subject) {
        throw new Error('Email subject is required');
      }

      const mailOptions = {
        from: this.config.from,
        replyTo: this.config.replyTo || this.config.from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: Array.isArray(options.cc) ? options.cc.join(', ') : options.cc,
        bcc: Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc,
        subject,
        html: htmlContent,
        text: textContent,
        attachments: options.attachments,
        priority: options.priority || 'normal',
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully: ${result.messageId}`);
      
      return {
        messageId: result.messageId,
        response: result.response,
        accepted: result.accepted || [],
        rejected: result.rejected || [],
        pending: result.pending || [],
      };

    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw new Error(`Failed to send email: ${error}`);
    }
  }

  /**
   * Send welcome email to new clients
   */
  async sendWelcomeEmail(clientEmail: string, clientData: {
    name: string;
    companyName?: string;
    loginUrl: string;
    supportEmail: string;
  }): Promise<EmailResult> {
    return this.sendEmail({
      to: clientEmail,
      template: 'welcome',
      templateData: clientData,
      priority: 'high',
    });
  }

  /**
   * Send project status update email
   */
  async sendProjectUpdateEmail(clientEmail: string, projectData: {
    projectName: string;
    status: string;
    description: string;
    clientName: string;
    portalUrl: string;
    nextSteps?: string[];
  }): Promise<EmailResult> {
    return this.sendEmail({
      to: clientEmail,
      template: 'project-update',
      templateData: projectData,
      priority: 'normal',
    });
  }

  /**
   * Send admin notification email (supports both old and new formats)
   */
  async sendAdminNotification(
    subjectOrData: string | {
      subject: string;
      intakeId: string;
      clientName: string;
      companyName: string;
      projectType: string;
      budget: string;
      timeline: string;
    },
    legacyData?: {
      type: 'new-client' | 'project-milestone' | 'system-alert' | 'error';
      message: string;
      details?: Record<string, any>;
      timestamp: Date;
    }
  ): Promise<EmailResult> {
    const adminEmail = process.env.ADMIN_EMAIL || this.config?.from;
    if (!adminEmail) {
      throw new Error('Admin email not configured');
    }

    // Handle new intake notification format
    if (typeof subjectOrData === 'object' && 'intakeId' in subjectOrData) {
      return this.sendEmail({
        to: adminEmail,
        template: 'admin-notification',
        templateData: {
          ...subjectOrData,
          type: 'new-intake',
          timestamp: new Date()
        },
        priority: 'normal',
      });
    }

    // Handle legacy notification format
    const subject = subjectOrData as string;
    const data = legacyData!;
    
    return this.sendEmail({
      to: adminEmail,
      template: 'admin-notification',
      templateData: {
        subject,
        ...data,
      },
      priority: data.type === 'error' ? 'high' : 'normal',
    });
  }

  /**
   * Send intake confirmation email to client
   */
  async sendIntakeConfirmation(data: {
    to: string;
    name: string;
    intakeId: string;
    estimatedResponseTime: string;
  }): Promise<EmailResult> {
    return this.sendEmail({
      to: data.to,
      template: 'intake-confirmation',
      templateData: {
        clientName: data.name,
        intakeId: data.intakeId,
        estimatedResponseTime: data.estimatedResponseTime,
        supportEmail: process.env.ADMIN_EMAIL || this.config?.from
      },
      priority: 'normal',
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(clientEmail: string, resetData: {
    name: string;
    resetToken: string;
    resetUrl: string;
    expirationTime: string;
  }): Promise<EmailResult> {
    return this.sendEmail({
      to: clientEmail,
      template: 'password-reset',
      templateData: resetData,
      priority: 'high',
    });
  }

  /**
   * Send message notification email
   */
  async sendMessageNotification(clientEmail: string, messageData: {
    recipientName: string;
    senderName: string;
    subject: string;
    message: string;
    threadId: number;
    portalUrl: string;
    hasAttachments?: boolean;
  }): Promise<EmailResult> {
    return this.sendEmail({
      to: clientEmail,
      template: 'message-notification',
      templateData: messageData,
      priority: 'normal',
    });
  }

  /**
   * Send bulk emails (with rate limiting)
   */
  async sendBulkEmails(emails: EmailOptions[], batchSize: number = 10, delayMs: number = 1000): Promise<EmailResult[]> {
    const results: EmailResult[] = [];
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchPromises = batch.map(email => this.sendEmail(email));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error(`Failed to send email ${i + index}:`, result.reason);
          }
        });
      } catch (error) {
        console.error('Batch email error:', error);
      }

      // Rate limiting delay
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Load and compile email templates
   */
  private async loadTemplates(): Promise<void> {
    const templatesDir = resolve(__dirname, '../templates/email');
    
    const templateFiles = [
      'welcome',
      'project-update', 
      'admin-notification',
      'password-reset'
    ];

    for (const templateName of templateFiles) {
      try {
        const htmlPath = resolve(templatesDir, `${templateName}.html`);
        const textPath = resolve(templatesDir, `${templateName}.txt`);
        const subjectPath = resolve(templatesDir, `${templateName}.subject.txt`);

        if (existsSync(htmlPath)) {
          const htmlContent = readFileSync(htmlPath, 'utf-8');
          const textContent = existsSync(textPath) ? readFileSync(textPath, 'utf-8') : undefined;
          const subjectContent = existsSync(subjectPath) ? readFileSync(subjectPath, 'utf-8') : `No Bhad Codes - ${templateName}`;

          this.templates.set(templateName, {
            subject: subjectContent.trim(),
            html: htmlContent,
            text: textContent,
          });

          console.log(`📧 Loaded email template: ${templateName}`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not load template ${templateName}:`, error);
      }
    }
  }

  /**
   * Render template with data
   */
  private async renderTemplate(templateName: string, data: Record<string, any>): Promise<EmailTemplate> {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Email template not found: ${templateName}`);
    }

    try {
      // Add common template data
      const templateData = {
        ...data,
        currentYear: new Date().getFullYear(),
        companyName: 'No Bhad Codes',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@nobhadcodes.com',
        websiteUrl: process.env.WEBSITE_URL || 'https://nobhadcodes.com',
      };

      const subjectTemplate = Handlebars.compile(template.subject);
      const htmlTemplate = Handlebars.compile(template.html);
      const textTemplate = template.text ? Handlebars.compile(template.text) : null;

      return {
        subject: subjectTemplate(templateData),
        html: htmlTemplate(templateData),
        text: textTemplate ? textTemplate(templateData) : undefined,
      };

    } catch (error) {
      console.error(`Failed to render template ${templateName}:`, error);
      throw new Error(`Template rendering failed: ${error}`);
    }
  }

  /**
   * Process queued emails
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.emailQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.emailQueue.length > 0) {
      const { options, resolve, reject } = this.emailQueue.shift()!;
      
      try {
        const result = await this.sendEmail(options);
        resolve(result);
      } catch (error) {
        reject(error);
      }

      // Small delay between emails
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessingQueue = false;
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email connection test failed:', error);
      return false;
    }
  }

  /**
   * Get email service status
   */
  getStatus(): {
    initialized: boolean;
    queueSize: number;
    templatesLoaded: number;
    isProcessingQueue: boolean;
  } {
    return {
      initialized: this.isInitialized,
      queueSize: this.emailQueue.length,
      templatesLoaded: this.templates.size,
      isProcessingQueue: this.isProcessingQueue,
    };
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance();