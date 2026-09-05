/**
 * ===============================================
 * ADMIN FLOW E2E TESTS
 * ===============================================
 * @file tests/e2e/admin-flow.spec.ts
 *
 * Logs in through the portal page on the marketing site — the path a real
 * visitor takes — and checks the React admin dashboard comes up wired: the
 * server-rendered shell accepts the cookie, the app restores the session it
 * stored at login, and the dashboard data request succeeds.
 *
 * Needs the API running (npm run dev:server) and:
 *   E2E_ADMIN_EMAIL     (defaults to ADMIN_EMAIL)
 *   E2E_ADMIN_PASSWORD
 * Skips otherwise. Each test signs in once; the login limiter allows only a
 * handful of attempts per window, so keep the count here small.
 */

import { test, expect } from '@playwright/test';
import { introFinished } from './support/site';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe('Admin Flow', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'E2E_ADMIN_PASSWORD not set - skipping admin flow');

  test('signs in on the portal page and lands on the admin dashboard', async ({ page }) => {
    const dashboardData = page.waitForResponse(
      (res) => res.url().includes('/api/admin/dashboard') && res.request().method() === 'GET'
    );

    await page.goto('/#/portal');
    await introFinished(page);
    await page.fill('#portal-page-email', ADMIN_EMAIL!);
    await page.fill('#portal-page-password', ADMIN_PASSWORD!);
    await page.click('#portal-page-login-form button[type="submit"]');

    // The shell is served by the API host; a rejected cookie bounces back to
    // the login hash instead.
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    expect(page.url()).not.toContain('#/portal');

    const sidebar = page.getByRole('navigation').filter({ hasText: 'Sign Out' });
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    for (const item of ['Dashboard', 'Work', 'CRM', 'Documents', 'Settings']) {
      await expect(sidebar.getByText(item, { exact: true }).first()).toBeVisible();
    }

    expect((await dashboardData).status()).toBe(200);
  });
});
