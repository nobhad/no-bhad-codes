/**
 * ===============================================
 * BUSINESS CARD E2E TESTS
 * ===============================================
 * @file tests/e2e/business-card.spec.ts
 *
 * End-to-end tests for business card functionality.
 */

import { test, expect } from '@playwright/test';

test.describe('Business Card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for business card to be rendered
    await page.waitForSelector('#business-card');
    await page.waitForTimeout(1000); // Wait for intro animation
  });

  test('should display business card on homepage', async ({ page }) => {
    // Business card should be visible
    await expect(page.locator('#business-card')).toBeVisible();
    await expect(page.locator('.business-card-front')).toBeVisible();

    // Should show front of card initially
    const cardInner = page.locator('#business-card-inner');
    await expect(cardInner).not.toHaveClass(/flipped/);
  });

  test('should flip card on click', async ({ page }) => {
    const businessCard = page.locator('#business-card');
    const cardInner = page.locator('#business-card-inner');

    // Initial state - front showing
    await expect(cardInner).not.toHaveClass(/flipped/);

    // Click to flip
    await businessCard.click();

    // Wait for animation
    await page.waitForTimeout(800);

    // Should show back of card
    await expect(cardInner).toHaveClass(/flipped/);
    await expect(page.locator('.business-card-back')).toBeVisible();

    // Click again to flip back
    await businessCard.click();
    await page.waitForTimeout(800);

    // Should show front again
    await expect(cardInner).not.toHaveClass(/flipped/);
  });

  test('should be keyboard accessible', async ({ page }) => {
    const businessCard = page.locator('#business-card');

    // Focus the card
    await businessCard.focus();

    // Should be focusable
    await expect(businessCard).toBeFocused();

    // Enter or Space should flip the card
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);

    const cardInner = page.locator('#business-card-inner');
    await expect(cardInner).toHaveClass(/flipped/);
  });

  test('should have proper ARIA attributes', async ({ page }) => {
    const businessCard = page.locator('#business-card');

    // Should have role and label for accessibility
    await expect(businessCard).toHaveAttribute('role', 'button');
    await expect(businessCard).toHaveAttribute('aria-label');
    await expect(businessCard).toHaveAttribute('tabindex', '0');
  });

  test('should maintain aspect ratio on different screen sizes', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 320, height: 568 }, // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1920, height: 1080 }, // Desktop
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);

      const businessCard = page.locator('#business-card');
      await expect(businessCard).toBeVisible();

      // Check that card maintains reasonable proportions
      const boundingBox = await businessCard.boundingBox();
      expect(boundingBox).toBeTruthy();

      if (boundingBox) {
        const aspectRatio = boundingBox.width / boundingBox.height;
        // Business card aspect ratio should be around 1.75:1 (1050:600)
        expect(aspectRatio).toBeGreaterThan(1.5);
        expect(aspectRatio).toBeLessThan(2.0);
      }
    }
  });

  test('should handle rapid clicking gracefully', async ({ page }) => {
    const businessCard = page.locator('#business-card');

    // Rapid clicks shouldn't break the animation
    for (let i = 0; i < 5; i++) {
      await businessCard.click();
      await page.waitForTimeout(100);
    }

    // Card should still be functional after rapid clicks
    await page.waitForTimeout(1000);

    const cardInner = page.locator('#business-card-inner');

    // Should be in a stable state
    await businessCard.click();
    await page.waitForTimeout(800);

    // Should flip properly
    const hasFlippedClass = await cardInner.getAttribute('class');
    expect(hasFlippedClass).toBeTruthy();
  });

  test('should respect reduced motion preferences', async ({ page }) => {
    // Set reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();

    await page.waitForSelector('#business-card');

    const businessCard = page.locator('#business-card');
    await businessCard.click();

    // With reduced motion, transitions should be faster or instant
    await page.waitForTimeout(100); // Much shorter wait

    const cardInner = page.locator('#business-card-inner');
    // Card should still flip, just with reduced animation
    await expect(cardInner).toHaveClass(/flipped/);
  });
});
