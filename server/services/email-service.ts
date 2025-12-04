/**
 * ===============================================
 * EMAIL SERVICE
 * ===============================================
 * @file server/services/email-service.ts
 *
 * Handles sending email notifications for client intake
 * and project management.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailContent {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailResult {
  success: boolean;
  message: string;
}

export interface IntakeData {
  name: string;
  company: string;
  email: string;
  phone: string;
  projectType: string;
  budget: string;
  timeline: string;
  projectDescription: string;
  features?: string | string[];
  addons?: string | string[];
  designLevel?: string;
  contentStatus?: string;
  techComfort?: string;
  hosting?: string;
  pages?: string;
  integrations?: string;
  challenges?: string;
}

interface EmailServiceStatus {
  initialized: boolean;
  queueSize: number;
  templatesLoaded: number;
  isProcessingQueue: boolean;
}

interface EmailConfig {
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

// Nodemailer transporter instance
let transporter: Transporter | null = null;
let emailConfig: EmailConfig | null = null;

/**
 * Send email using configured transporter
 * @param emailContent - Email content to send
 * @returns Promise<EmailResult>
 */
async function sendEmail(emailContent: EmailContent): Promise<EmailResult> {
  // If transporter is not initialized, log and return
  if (!transporter || !emailConfig) {
    console.log('[EMAIL] Transporter not initialized. Email logged to console:');
    console.log(`To: ${emailContent.to}`);
    console.log(`Subject: ${emailContent.subject}`);
    console.log(`Text: ${emailContent.text}`);
    return { success: true, message: 'Email logged to console (transporter not configured)' };
  }

  try {
    const info = await transporter.sendMail({
      from: emailConfig.from,
      to: emailContent.to,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
      replyTo: emailConfig.replyTo,
    });

    console.log('[EMAIL] Message sent successfully:', info.messageId);
    return { success: true, message: `Email sent: ${info.messageId}` };
  } catch (error) {
    console.error('[EMAIL] Failed to send email:', error);
    // Fall back to logging if send fails
    console.log('[EMAIL] Email content (send failed):');
    console.log(`To: ${emailContent.to}`);
    console.log(`Subject: ${emailContent.subject}`);
    return {
      success: false,
      message: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Send welcome email to new client
 * @param {string} email - Client email address
 * @param {string} name - Client name
 * @param {string} accessToken - Client portal access token
 */
export async function sendWelcomeEmail(
  email: string,
  name: string,
  accessToken: string
): Promise<EmailResult> {
  console.log('[EMAIL] Preparing welcome email for:', email);

  const portalUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/client/portal?token=${accessToken}`;

  const emailContent: EmailContent = {
    to: email,
    subject: 'Welcome to No Bhad Codes - Your Project Portal is Ready!',
    text: `
      Hi ${name},

      Thank you for choosing No Bhad Codes for your project! We're excited to work with you.

      Your project details have been received and we're already reviewing your requirements.
      You'll receive a detailed proposal within 24-48 hours.

      In the meantime, you can access your project portal here:
      ${portalUrl}

      What happens next:
      1. We'll review your project requirements
      2. You'll receive a detailed proposal and timeline
      3. We'll schedule a discovery call to discuss details
      4. Upon agreement, we'll begin development

      If you have any questions, feel free to reply to this email.

      Best regards,
      No Bhad Codes Team
    `,
    html: generateWelcomeEmailHTML(name, portalUrl),
  };

  return sendEmail(emailContent);
}

/**
 * Send new intake notification to admin
 * @param {IntakeData} intakeData - Client intake form data
 * @param {number} projectId - Created project ID
 */
export async function sendNewIntakeNotification(
  intakeData: IntakeData,
  projectId: number
): Promise<EmailResult> {
  console.log('[EMAIL] Preparing intake notification for project:', projectId);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@nobhadcodes.com';

  const emailContent: EmailContent = {
    to: adminEmail,
    subject: `New Project Intake: ${intakeData.company} - ${intakeData.projectType}`,
    text: `
      New project intake received!

      Client Details:
      - Name: ${intakeData.name}
      - Company: ${intakeData.company}
      - Email: ${intakeData.email}
      - Phone: ${intakeData.phone}

      Project Details:
      - Type: ${intakeData.projectType}
      - Budget: ${intakeData.budget}
      - Timeline: ${intakeData.timeline}
      - Description: ${intakeData.projectDescription}

      Features: ${Array.isArray(intakeData.features) ? intakeData.features.join(', ') : intakeData.features || 'None specified'}

      Project ID: ${projectId}

      Review the full details in the admin dashboard.
    `,
    html: generateIntakeNotificationHTML(intakeData, projectId),
  };

  return sendEmail(emailContent);
}

function generateWelcomeEmailHTML(name: string, portalUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to No Bhad Codes</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #00ff41; color: #000; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { 
          display: inline-block; 
          background: #00ff41; 
          color: #000; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 5px;
          font-weight: bold;
        }
        .footer { padding: 20px; text-align: center; font-size: 0.9em; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to No Bhad Codes!</h1>
        </div>
        
        <div class="content">
          <h2>Hi ${name},</h2>
          
          <p>Thank you for choosing <strong>No Bhad Codes</strong> for your project! We're excited to work with you.</p>
          
          <p>Your project details have been received and we're already reviewing your requirements. You'll receive a detailed proposal within <strong>24-48 hours</strong>.</p>
          
          <p>You can access your project portal anytime:</p>
          
          <p style="text-align: center;">
            <a href="${portalUrl}" class="button">Access Your Portal</a>
          </p>
          
          <h3>What happens next:</h3>
          <ol>
            <li>We'll review your project requirements</li>
            <li>You'll receive a detailed proposal and timeline</li>
            <li>We'll schedule a discovery call to discuss details</li>
            <li>Upon agreement, we'll begin development</li>
          </ol>
          
          <p>If you have any questions, feel free to reply to this email.</p>
          
          <p>Best regards,<br>
          <strong>No Bhad Codes Team</strong></p>
        </div>
        
        <div class="footer">
          <p>&copy; 2025 No Bhad Codes. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateIntakeNotificationHTML(intakeData: IntakeData, projectId: number): string {
  const features = Array.isArray(intakeData.features)
    ? intakeData.features
    : [intakeData.features].filter(Boolean);
  const addons = Array.isArray(intakeData.addons)
    ? intakeData.addons
    : [intakeData.addons].filter(Boolean);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Project Intake</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background: #00ff41; color: #000; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .section { margin-bottom: 20px; }
        .section h3 { color: #00ff41; border-bottom: 2px solid #00ff41; padding-bottom: 5px; }
        .info-grid { display: grid; grid-template-columns: 200px 1fr; gap: 10px; margin-bottom: 15px; }
        .info-label { font-weight: bold; }
        .features-list { background: #fff; padding: 15px; border-left: 4px solid #00ff41; }
        .project-id { 
          background: #333; 
          color: #00ff41; 
          padding: 10px; 
          text-align: center; 
          font-size: 1.2em; 
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Project Intake Received!</h1>
        </div>
        
        <div class="project-id">
          Project ID: ${projectId}
        </div>
        
        <div class="content">
          <div class="section">
            <h3>Client Information</h3>
            <div class="info-grid">
              <div class="info-label">Name:</div>
              <div>${intakeData.name}</div>
              <div class="info-label">Company:</div>
              <div>${intakeData.company}</div>
              <div class="info-label">Email:</div>
              <div>${intakeData.email}</div>
              <div class="info-label">Phone:</div>
              <div>${intakeData.phone}</div>
            </div>
          </div>
          
          <div class="section">
            <h3>Project Details</h3>
            <div class="info-grid">
              <div class="info-label">Type:</div>
              <div>${intakeData.projectType}</div>
              <div class="info-label">Budget:</div>
              <div>${intakeData.budget}</div>
              <div class="info-label">Timeline:</div>
              <div>${intakeData.timeline}</div>
              <div class="info-label">Pages:</div>
              <div>${intakeData.pages || 'Not specified'}</div>
            </div>
            
            <div style="margin-top: 15px;">
              <div class="info-label">Description:</div>
              <div style="background: #fff; padding: 10px; border-left: 4px solid #00ff41; margin-top: 5px;">
                ${intakeData.projectDescription}
              </div>
            </div>
          </div>
          
          ${
            features.length > 0
              ? `
          <div class="section">
            <h3>Requested Features</h3>
            <div class="features-list">
              ${features.map((feature) => `<div>• ${feature}</div>`).join('')}
            </div>
          </div>
          `
              : ''
          }
          
          ${
            addons.length > 0
              ? `
          <div class="section">
            <h3>Additional Services</h3>
            <div class="features-list">
              ${addons.map((addon) => `<div>• ${addon}</div>`).join('')}
            </div>
          </div>
          `
              : ''
          }
          
          <div class="section">
            <h3>Additional Information</h3>
            <div class="info-grid">
              <div class="info-label">Design Level:</div>
              <div>${intakeData.designLevel || 'Not specified'}</div>
              <div class="info-label">Content Status:</div>
              <div>${intakeData.contentStatus || 'Not specified'}</div>
              <div class="info-label">Tech Comfort:</div>
              <div>${intakeData.techComfort || 'Not specified'}</div>
              <div class="info-label">Hosting:</div>
              <div>${intakeData.hosting || 'Not specified'}</div>
            </div>
            
            ${
              intakeData.integrations
                ? `
            <div style="margin-top: 15px;">
              <div class="info-label">Integrations:</div>
              <div style="background: #fff; padding: 10px; border-left: 4px solid #00ff41; margin-top: 5px;">
                ${intakeData.integrations}
              </div>
            </div>
            `
                : ''
            }
            
            ${
              intakeData.challenges
                ? `
            <div style="margin-top: 15px;">
              <div class="info-label">Challenges/Concerns:</div>
              <div style="background: #fff; padding: 10px; border-left: 4px solid #00ff41; margin-top: 5px;">
                ${intakeData.challenges}
              </div>
            </div>
            `
                : ''
            }
          </div>
          
          <p style="text-align: center; margin-top: 30px;">
            <strong>Next Step:</strong> Review the intake details and prepare a proposal within 24-48 hours.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Email service object for backwards compatibility
export const emailService = {
  async init(config: EmailConfig): Promise<void> {
    console.log('[EMAIL] Initializing email service...');

    // Store config
    emailConfig = config;

    // Create nodemailer transporter
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
    });

    console.log('[EMAIL] Email service initialized successfully');
  },

  async testConnection(): Promise<boolean> {
    console.log('[EMAIL] Testing email connection...');

    if (!transporter) {
      console.warn('[EMAIL] Transporter not initialized. Skipping connection test.');
      return false;
    }

    try {
      await transporter.verify();
      console.log('[EMAIL] ✅ Email connection test successful');
      return true;
    } catch (error) {
      console.error('[EMAIL] ❌ Email connection test failed:', error);
      return false;
    }
  },

  getStatus(): EmailServiceStatus {
    return {
      initialized: transporter !== null,
      queueSize: 0,
      templatesLoaded: 4,
      isProcessingQueue: false,
    };
  },

  async sendWelcomeEmail(
    email: string,
    nameOrData: string | any,
    accessTokenOrOptions?: string | any
  ): Promise<EmailResult> {
    if (typeof nameOrData === 'string' && typeof accessTokenOrOptions === 'string') {
      // Original function signature
      return sendWelcomeEmail(email, nameOrData, accessTokenOrOptions);
    }
    // Object-based signature for compatibility
    const data = nameOrData;
    return sendWelcomeEmail(email, data.name || 'Valued Client', data.accessToken || '');
  },

  async sendNewIntakeNotification(intakeData: IntakeData, projectId: number): Promise<EmailResult> {
    return sendNewIntakeNotification(intakeData, projectId);
  },

  async sendPasswordResetEmail(
    email: string,
    data: { resetToken: string; name?: string }
  ): Promise<EmailResult> {
    console.log('[EMAIL] Preparing password reset email for:', email);

    const resetUrl = `${process.env.WEBSITE_URL || 'http://localhost:3000'}/reset-password?token=${data.resetToken}`;
    const name = data.name || 'User';

    const emailContent: EmailContent = {
      to: email,
      subject: 'Password Reset Request - No Bhad Codes',
      text: `
        Hi ${name},

        We received a request to reset your password for your No Bhad Codes account.

        Click the link below to reset your password:
        ${resetUrl}

        This link will expire in 1 hour.

        If you didn't request this password reset, please ignore this email or contact support if you have concerns.

        Best regards,
        No Bhad Codes Team
      `,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background: #00ff41; color: #000; text-decoration: none; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Password Reset Request</h2>
            <p>Hi ${name},</p>
            <p>We received a request to reset your password for your No Bhad Codes account.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f5f5f5; padding: 10px;">${resetUrl}</p>
            <p><small>This link will expire in 1 hour.</small></p>
            <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
            <p>Best regards,<br>No Bhad Codes Team</p>
          </div>
        </body>
        </html>
      `,
    };

    return sendEmail(emailContent);
  },

  async sendAdminNotification(title: string | any, data?: any): Promise<EmailResult> {
    if (typeof title === 'string') {
      console.log('Sending admin notification:', title, data);
    } else {
      console.log('Sending admin notification:', title);
    }
    return { success: true, message: 'Admin notification logged for development' };
  },

  async sendMessageNotification(email: string, data: any): Promise<EmailResult> {
    console.log('Sending message notification to:', email, data);
    return { success: true, message: 'Message notification logged for development' };
  },

  async sendProjectUpdateEmail(email: string, data: any): Promise<EmailResult> {
    console.log('Sending project update email to:', email, data);
    return { success: true, message: 'Project update email logged for development' };
  },

  async sendIntakeConfirmation(data: any): Promise<EmailResult> {
    console.log('Sending intake confirmation:', data);
    return { success: true, message: 'Intake confirmation logged for development' };
  },

  async sendEmail(data: any): Promise<EmailResult> {
    console.log('Sending email:', data);
    return { success: true, message: 'Email logged for development' };
  },
};
