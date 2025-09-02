/**
 * ===============================================
 * NAVIGATION E2E TESTS
 * ===============================================
 * @file tests/e2e/navigation.spec.ts
 * 
 * End-to-end tests for navigation functionality.
 */

import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app initialization
    await page.waitForSelector('[data-nav]');
  });

  test('should open and close menu', async ({ page }) => {
    // Open menu
    await page.click('[data-menu-toggle]');
    await expect(page.locator('[data-nav]')).toHaveAttribute('data-nav', 'open');
    
    // Menu should be visible
    await expect(page.locator('.menu')).toBeVisible();
    await expect(page.locator('.menu-link')).toHaveCount(3);
    
    // Close menu by clicking overlay
    await page.click('.overlay');
    await expect(page.locator('[data-nav]')).toHaveAttribute('data-nav', 'closed');
  });

  test('should navigate between sections', async ({ page }) => {
    // Open menu
    await page.click('[data-menu-toggle]');
    
    // Click about link
    await page.click('a[href="#about"]');
    
    // Should navigate to about section
    await expect(page).toHaveURL('/#about');
    await expect(page.locator('.about-section')).toBeInViewport();
    
    // Open menu again
    await page.click('[data-menu-toggle]');
    
    // Navigate to contact
    await page.click('a[href="#contact"]');
    
    await expect(page).toHaveURL('/#contact');
    await expect(page.locator('.contact-section')).toBeInViewport();
  });

  test('should close menu on escape key', async ({ page }) => {
    // Open menu
    await page.click('[data-menu-toggle]');
    await expect(page.locator('[data-nav]')).toHaveAttribute('data-nav', 'open');
    
    // Press escape
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-nav]')).toHaveAttribute('data-nav', 'closed');
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Navigate to about
    await page.goto('/#about');
    await expect(page.locator('.about-section')).toBeInViewport();
    
    // Navigate to contact
    await page.goto('/#contact');
    await expect(page.locator('.contact-section')).toBeInViewport();
    
    // Go back
    await page.goBack();
    await expect(page).toHaveURL('/#about');
    await expect(page.locator('.about-section')).toBeInViewport();
    
    // Go forward
    await page.goForward();
    await expect(page).toHaveURL('/#contact');
    await expect(page.locator('.contact-section')).toBeInViewport();
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Open menu with keyboard
    await page.focus('[data-menu-toggle]');
    await page.keyboard.press('Enter');
    
    await expect(page.locator('[data-nav]')).toHaveAttribute('data-nav', 'open');
    
    // Navigate menu items with arrow keys
    await page.keyboard.press('Tab'); // Focus first menu item
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    
    // Activate contact link with Enter
    await page.keyboard.press('Enter');
    
    await expect(page).toHaveURL('/#contact');
  });

  test('should show active menu item', async ({ page }) => {
    // Navigate to about section
    await page.goto('/#about');
    
    // Open menu
    await page.click('[data-menu-toggle]');
    
    // About link should be active
    const aboutLink = page.locator('a[href="#about"]');
    await expect(aboutLink).toHaveClass(/active/);
  });
});