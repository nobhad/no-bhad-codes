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
  email: string;
  projectType: string;
  projectDescription: string;
  timeline: string;
  budget: string;
  techComfort?: string;
  domainHosting?: string;
  features?: string | string[];
  designLevel?: string;
  additionalInfo?: string;
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
      replyTo: emailConfig.replyTo
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
      message: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    html: generateWelcomeEmailHTML(name, portalUrl)
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

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn('[EMAIL] ADMIN_EMAIL not configured - skipping intake notification');
    return { success: false, message: 'Admin email not configured' };
  }

  const emailContent: EmailContent = {
    to: adminEmail,
    subject: `New Project Intake: ${intakeData.name} - ${intakeData.projectType}`,
    text: `
      New project intake received!

      Client Details:
      - Name: ${intakeData.name}
      - Email: ${intakeData.email}

      Project Details:
      - Type: ${intakeData.projectType}
      - Budget: ${intakeData.budget}
      - Timeline: ${intakeData.timeline}
      - Description: ${intakeData.projectDescription}

      Technical:
      - Tech Comfort: ${intakeData.techComfort || 'Not specified'}
      - Domain/Hosting: ${intakeData.domainHosting || 'Not specified'}

      Features: ${Array.isArray(intakeData.features) ? intakeData.features.join(', ') : intakeData.features || 'None specified'}
      Design Level: ${intakeData.designLevel || 'Not specified'}
      ${intakeData.additionalInfo ? `Additional Info: ${intakeData.additionalInfo}` : ''}

      Project ID: ${projectId}

      Review the full details in the admin dashboard.
    `,
    html: generateIntakeNotificationHTML(intakeData, projectId)
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

  const infoRow = (label: string, value: string | undefined) => `
    <tr>
      <td style="padding: 8px 12px; font-weight: 600; color: #555; width: 140px; vertical-align: top;">${label}</td>
      <td style="padding: 8px 12px; color: #222;">${value || 'Not specified'}</td>
    </tr>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Project Intake</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px 20px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">New Project Intake</h1>
                  <p style="margin: 10px 0 0; color: #7ff709; font-size: 16px;">Project #${projectId}</p>
                </td>
              </tr>

              <!-- Client Info -->
              <tr>
                <td style="padding: 25px 20px 15px;">
                  <h2 style="margin: 0 0 15px; font-size: 16px; color: #1a1a2e; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #7ff709; padding-bottom: 8px;">Client</h2>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${infoRow('Name', intakeData.name)}
                    ${infoRow('Email', `<a href="mailto:${intakeData.email}" style="color: #0066cc;">${intakeData.email}</a>`)}
                  </table>
                </td>
              </tr>

              <!-- Project Details -->
              <tr>
                <td style="padding: 15px 20px;">
                  <h2 style="margin: 0 0 15px; font-size: 16px; color: #1a1a2e; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #7ff709; padding-bottom: 8px;">Project</h2>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${infoRow('Type', intakeData.projectType)}
                    ${infoRow('Budget', intakeData.budget)}
                    ${infoRow('Timeline', intakeData.timeline)}
                  </table>
                  <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #7ff709;">
                    <strong style="display: block; margin-bottom: 8px; color: #555;">Description:</strong>
                    <span style="color: #222;">${intakeData.projectDescription}</span>
                  </div>
                </td>
              </tr>

              <!-- Technical -->
              <tr>
                <td style="padding: 15px 20px;">
                  <h2 style="margin: 0 0 15px; font-size: 16px; color: #1a1a2e; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #7ff709; padding-bottom: 8px;">Technical</h2>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${infoRow('Tech Comfort', intakeData.techComfort)}
                    ${infoRow('Domain/Hosting', intakeData.domainHosting)}
                  </table>
                </td>
              </tr>

              ${features.length > 0 ? `
              <!-- Features -->
              <tr>
                <td style="padding: 15px 20px;">
                  <h2 style="margin: 0 0 15px; font-size: 16px; color: #1a1a2e; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #7ff709; padding-bottom: 8px;">Features</h2>
                  <div style="padding: 15px; background: #f8f9fa; border-radius: 6px;">
                    ${features.map((f) => `<span style="display: inline-block; margin: 4px; padding: 6px 12px; background: #e8f5e9; color: #2e7d32; border-radius: 20px; font-size: 14px;">${f}</span>`).join('')}
                  </div>
                </td>
              </tr>
              ` : ''}

              <!-- Design & Notes -->
              <tr>
                <td style="padding: 15px 20px;">
                  <h2 style="margin: 0 0 15px; font-size: 16px; color: #1a1a2e; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #7ff709; padding-bottom: 8px;">Design & Notes</h2>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${infoRow('Design Level', intakeData.designLevel)}
                  </table>
                  ${intakeData.additionalInfo ? `
                  <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #7ff709;">
                    <strong style="display: block; margin-bottom: 8px; color: #555;">Additional Info:</strong>
                    <span style="color: #222;">${intakeData.additionalInfo}</span>
                  </div>
                  ` : ''}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 20px; background: #f8f9fa; text-align: center; border-top: 1px solid #eee;">
                  <p style="margin: 0; color: #666; font-size: 14px;">Review and prepare proposal within 24-48 hours</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
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
        pass: config.auth.pass
      }
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
      isProcessingQueue: false
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
      `
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

  async sendEmail(data: EmailContent): Promise<EmailResult> {
    return sendEmail(data);
  },

  /**
   * Send magic link (passwordless login) email
   * @param email - Recipient email address
   * @param data - Magic link data including token and optional name
   */
  /**
   * Send account activation welcome email with billing CTA
   * @param email - Recipient email address
   * @param data - Activation data including name and portal URL
   */
  async sendAccountActivationEmail(
    email: string,
    data: { name?: string; portalUrl?: string }
  ): Promise<EmailResult> {
    console.log('[EMAIL] Preparing account activation welcome email for:', email);

    const portalUrl = data.portalUrl || `${process.env.WEBSITE_URL || 'http://localhost:3000'}/client/portal`;
    const settingsUrl = `${portalUrl}#settings`;
    const name = data.name || 'there';

    const emailContent: EmailContent = {
      to: email,
      subject: 'Welcome to Your Client Portal - No Bhad Codes',
      text: `
        Hi ${name},

        Your account is now active! Welcome to your No Bhad Codes client portal.

        Here's what you can do in your portal:
        - View your project status and milestones
        - Send and receive messages
        - Upload and download files
        - View and pay invoices

        IMPORTANT: Please add your billing information
        To ensure smooth invoicing and payments, please add your billing details:
        ${settingsUrl}

        Access your portal anytime:
        ${portalUrl}

        If you have any questions, feel free to reach out through the portal messaging system.

        Best regards,
        No Bhad Codes Team
      `,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a1a2e; color: #fff; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0; color: #7ff709; }
            .content { padding: 30px 20px; background: #f9f9f9; }
            .button {
              display: inline-block;
              padding: 14px 28px;
              background: #7ff709;
              color: #000;
              text-decoration: none;
              border-radius: 4px;
              font-weight: bold;
              margin: 10px 5px;
            }
            .button-secondary {
              background: #1a1a2e;
              color: #fff;
            }
            .highlight-box {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px 20px;
              margin: 20px 0;
              border-radius: 0 4px 4px 0;
            }
            .feature-list {
              background: #fff;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .feature-list li {
              margin: 10px 0;
              padding-left: 10px;
            }
            .footer { padding: 20px; text-align: center; font-size: 0.9em; color: #666; background: #f0f0f0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to No Bhad Codes!</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">Your account is now active</p>
            </div>

            <div class="content">
              <p>Hi ${name},</p>

              <p>Your client portal account has been successfully activated. You now have access to all the tools you need to collaborate with us on your project.</p>

              <div class="feature-list">
                <strong>Here's what you can do in your portal:</strong>
                <ul>
                  <li>View your project status and milestones</li>
                  <li>Send and receive messages</li>
                  <li>Upload and download files</li>
                  <li>View and pay invoices</li>
                </ul>
              </div>

              <div class="highlight-box">
                <strong>Action Required: Add Your Billing Information</strong>
                <p style="margin: 10px 0 0;">To ensure smooth invoicing and payments, please take a moment to add your billing details in your portal settings.</p>
              </div>

              <p style="text-align: center; margin: 30px 0;">
                <a href="${settingsUrl}" class="button">Add Billing Info</a>
                <a href="${portalUrl}" class="button button-secondary">Go to Portal</a>
              </p>

              <p>If you have any questions, feel free to reach out through the portal messaging system.</p>
            </div>

            <div class="footer">
              <p>Best regards,<br><strong>No Bhad Codes Team</strong></p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    return sendEmail(emailContent);
  },

  async sendMagicLinkEmail(
    email: string,
    data: { magicLinkToken: string; name?: string }
  ): Promise<EmailResult> {
    console.log('[EMAIL] Preparing magic link email for:', email);

    const loginUrl = `${process.env.WEBSITE_URL || 'http://localhost:3000'}/auth/magic-link?token=${data.magicLinkToken}`;
    const name = data.name || 'there';

    const emailContent: EmailContent = {
      to: email,
      subject: 'Your Login Link - No Bhad Codes',
      text: `
        Hi ${name},

        Click the link below to sign in to your No Bhad Codes account:
        ${loginUrl}

        This link will expire in 15 minutes for security.

        If you didn't request this login link, please ignore this email.

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
            .header { background: #00ff41; color: #000; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .button {
              display: inline-block;
              padding: 14px 28px;
              background: #00ff41;
              color: #000;
              text-decoration: none;
              border-radius: 4px;
              font-weight: bold;
            }
            .footer { padding: 20px; text-align: center; font-size: 0.9em; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Sign In to No Bhad Codes</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Click the button below to sign in to your account. No password needed!</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" class="button">Sign In</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #fff; padding: 10px; border: 1px solid #ddd;">${loginUrl}</p>
              <p><small>This link will expire in 15 minutes for security.</small></p>
              <p>If you didn't request this login link, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>Best regards,<br>No Bhad Codes Team</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    return sendEmail(emailContent);
  }
};
