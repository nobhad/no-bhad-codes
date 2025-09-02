/**
 * ===============================================
 * CONTACT FORM E2E TESTS
 * ===============================================
 * @file tests/e2e/contact-form.spec.ts
 * 
 * End-to-end tests for contact form functionality.
 */

import { test, expect } from '@playwright/test';

test.describe('Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#contact');
    await page.waitForSelector('.contact-form');
  });

  test('should display all form fields', async ({ page }) => {
    // Check all required form elements are present
    await expect(page.locator('#First-Name')).toBeVisible();
    await expect(page.locator('#Last-Name')).toBeVisible();
    await expect(page.locator('#Email')).toBeVisible();
    await expect(page.locator('#Company-Name')).toBeVisible();
    await expect(page.locator('#business-size')).toBeVisible();
    await expect(page.locator('[name="help-options"]').first()).toBeVisible();
    await expect(page.locator('#Message')).toBeVisible();
    await expect(page.locator('.form-button')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit empty form
    await page.click('.form-button');
    
    // Should show validation errors
    await expect(page.locator('.form-message')).toContainText('First name is required');
  });

  test('should validate email format', async ({ page }) => {
    // Fill in invalid email
    await page.fill('#Email', 'invalid-email');
    await page.blur('#Email');
    
    // Should show email validation error
    await expect(page.locator('.field-error')).toContainText('valid email');
  });

  test('should handle form submission', async ({ page }) => {
    // Mock form submission to prevent actual API calls
    await page.route('/', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      } else {
        await route.continue();
      }
    });

    // Fill out form with valid data
    await page.fill('#First-Name', 'John');
    await page.fill('#Last-Name', 'Doe');
    await page.fill('#Email', 'john@example.com');
    await page.selectOption('#business-size', 'Small / Particular');
    await page.check('[value="WEB_DEVELOPMENT"]');
    await page.fill('#Message', 'This is a test message with enough content to pass validation.');
    
    // Submit form
    await page.click('.form-button');
    
    // Should show success message
    await expect(page.locator('.form-message.success')).toContainText('Thank you');
    
    // Form should be reset
    await expect(page.locator('#First-Name')).toHaveValue('');
    await expect(page.locator('#Message')).toHaveValue('');
  });

  test('should handle form submission errors', async ({ page }) => {
    // Mock form submission error
    await page.route('/', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' })
        });
      } else {
        await route.continue();
      }
    });

    // Fill out form with valid data
    await page.fill('#First-Name', 'John');
    await page.fill('#Last-Name', 'Doe');
    await page.fill('#Email', 'john@example.com');
    await page.selectOption('#business-size', 'Small / Particular');
    await page.check('[value="WEB_DEVELOPMENT"]');
    await page.fill('#Message', 'This is a test message.');
    
    // Submit form
    await page.click('.form-button');
    
    // Should show error message
    await expect(page.locator('.form-message.error')).toContainText('error');
  });

  test('should disable submit button during submission', async ({ page }) => {
    // Mock slow form submission
    await page.route('/', async route => {
      if (route.request().method() === 'POST') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      } else {
        await route.continue();
      }
    });

    // Fill out form
    await page.fill('#First-Name', 'John');
    await page.fill('#Last-Name', 'Doe');
    await page.fill('#Email', 'john@example.com');
    await page.selectOption('#business-size', 'Small / Particular');
    await page.check('[value="WEB_DEVELOPMENT"]');
    await page.fill('#Message', 'Test message.');
    
    // Submit form
    await page.click('.form-button');
    
    // Button should be disabled and show loading state
    await expect(page.locator('.form-button')).toBeDisabled();
    await expect(page.locator('.form-button')).toContainText('Sending');
    
    // Wait for completion
    await page.waitForSelector('.form-message.success');
    
    // Button should be re-enabled
    await expect(page.locator('.form-button')).not.toBeDisabled();
    await expect(page.locator('.form-button')).toContainText("Let's Talk");
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Tab through all form elements
    const expectedTabOrder = [
      '#First-Name',
      '#Last-Name', 
      '#Email',
      '#Company-Name',
      '#business-size',
      '[value="WEB_DEVELOPMENT"]',
      '[value="MOBILE_DEVELOPMENT"]',
      '[value="DESIGN"]',
      '[value="SOFTWARE"]',
      '[value="OTHER"]',
      '#Message',
      '.form-button'
    ];
    
    await page.focus('#First-Name');
    
    for (let i = 0; i < expectedTabOrder.length - 1; i++) {
      await page.keyboard.press('Tab');
      // Allow some time for focus transition
      await page.waitForTimeout(100);
    }
    
    // Last element should be the submit button
    await expect(page.locator('.form-button')).toBeFocused();
  });

  test('should handle radio button selection', async ({ page }) => {
    // Select different help options
    await page.check('[value="WEB_DEVELOPMENT"]');
    await expect(page.locator('[value="WEB_DEVELOPMENT"]')).toBeChecked();
    
    // Select different option
    await page.check('[value="DESIGN"]');
    await expect(page.locator('[value="DESIGN"]')).toBeChecked();
    await expect(page.locator('[value="WEB_DEVELOPMENT"]')).not.toBeChecked();
  });

  test('should validate message length', async ({ page }) => {
    // Fill short message
    await page.fill('#Message', 'Short');
    await page.blur('#Message');
    
    // Should show length validation error
    await expect(page.locator('.field-error')).toContainText('at least 10 characters');
  });

  test('should handle business size selection', async ({ page }) => {
    // Should have default placeholder option
    await expect(page.locator('#business-size')).toHaveValue('Business Size');
    
    // Select actual option
    await page.selectOption('#business-size', 'Medium / Start-up');
    await expect(page.locator('#business-size')).toHaveValue('Medium / Start-up');
  });
});