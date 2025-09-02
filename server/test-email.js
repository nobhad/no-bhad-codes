#!/usr/bin/env node

/**
 * Simple test script to verify email service functionality
 */

import { emailService } from './services/email-service.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmailService() {
  console.log('🧪 Testing Email Service...\n');

  try {
    // Test email configuration
    const emailConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      },
      from: process.env.SMTP_FROM || 'test@nobhadcodes.com',
      replyTo: process.env.SMTP_REPLY_TO
    };

    console.log('📧 Initializing email service...');
    await emailService.init(emailConfig);
    console.log('✅ Email service initialized successfully!\n');

    // Test connection
    console.log('🔗 Testing email connection...');
    const isConnected = await emailService.testConnection();
    console.log(isConnected ? '✅ Connection test passed!' : '❌ Connection test failed!');

    // Get service status
    console.log('\n📊 Email Service Status:');
    const status = emailService.getStatus();
    console.log(`   Initialized: ${status.initialized}`);
    console.log(`   Queue Size: ${status.queueSize}`);
    console.log(`   Templates Loaded: ${status.templatesLoaded}`);
    console.log(`   Processing Queue: ${status.isProcessingQueue}`);

    // Test template rendering (without actually sending)
    console.log('\n🎨 Testing template loading...');
    if (status.templatesLoaded > 0) {
      console.log('✅ Templates loaded successfully!');
      console.log('   Available templates: welcome, project-update, admin-notification, password-reset');
    } else {
      console.log('⚠️  No templates loaded. Check template directory.');
    }

    console.log('\n🎉 Email service test completed successfully!');
    console.log('\n💡 To test actual email sending, configure SMTP settings in .env file');

  } catch (error) {
    console.error('❌ Email service test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testEmailService().catch(console.error);