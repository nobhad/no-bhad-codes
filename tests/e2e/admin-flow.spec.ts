/**
 * ===============================================
 * ADMIN FLOW E2E TESTS
 * ===============================================
 * @file tests/e2e/admin-flow.spec.ts
 *
 * Admin login and view project flow.
 *
 * Prerequisites:
 * - ADMIN_PASSWORD must be set in .env (backend)
 * - E2E_ADMIN_PASSWORD must match ADMIN_PASSWORD (for test to run)
 * - Use `npm run dev:full` so both frontend and backend run
 *
 * To run: E2E_ADMIN_PASSWORD=your_admin_password npx playwright test admin-flow
 */

import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe('Admin Flow', () => {
  test.skip(!ADMIN_PASSWORD, 'E2E_ADMIN_PASSWORD not set - skipping admin flow tests');

  test('login and view projects', async ({ page }) => {
    // 1. Navigate to admin page
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // 2. Wait for login form and sign in
    await expect(page.locator('#admin-login-form')).toBeVisible();
    await page.fill('#admin-password', ADMIN_PASSWORD!);
    await page.click('.auth-submit');

    // 3. Wait for dashboard to appear (auth gate hidden, dashboard visible)
    await expect(page.locator('#admin-dashboard')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#auth-gate')).toBeHidden();

    // 4. Click Projects tab
    await page.click('#btn-projects');
    await expect(page.locator('#tab-projects')).toBeVisible();

    // 5. Wait for projects content (table or empty state)
    await expect(page.locator('#tab-projects')).toBeVisible();
    await expect(
      page.locator('#projects-table-body, .empty-state, .loading-row')
    ).toBeVisible({ timeout: 10000 });

    // 6. Projects section loaded - wait for loading to complete
    await expect(page.getByText('Loading projects...')).not.toBeVisible({ timeout: 15000 });
  });

  test('login and view dashboard overview', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#admin-login-form')).toBeVisible();
    await page.fill('#admin-password', ADMIN_PASSWORD!);
    await page.click('.auth-submit');

    await expect(page.locator('#admin-dashboard')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#tab-overview')).toBeVisible();
    await expect(page.locator('.quick-stats')).toBeVisible();
  });
});
