/**
 * ===============================================
 * CLIENT PORTAL FLOW E2E TESTS
 * ===============================================
 * @file tests/e2e/portal-flow.spec.ts
 *
 * Signs a client in through the portal page on the marketing site and checks
 * the React client portal comes up wired: shell served, session restored,
 * the client's dashboard request answered, sign-out working.
 *
 * Needs the API running (npm run dev:server) and a client with a password:
 *   E2E_CLIENT_EMAIL
 *   E2E_CLIENT_PASSWORD
 * Skips otherwise. A client is created by inviting one from the admin
 * dashboard and following the set-password link.
 */

import { test, expect } from '@playwright/test';
import { introFinished } from './support/site';

const CLIENT_EMAIL = process.env.E2E_CLIENT_EMAIL;
const CLIENT_PASSWORD = process.env.E2E_CLIENT_PASSWORD;

test.describe('Client Portal Flow', () => {
  test.skip(
    !CLIENT_EMAIL || !CLIENT_PASSWORD,
    'E2E_CLIENT_EMAIL / E2E_CLIENT_PASSWORD not set - skipping portal flow'
  );

  test('signs in on the portal page, sees the client dashboard, signs out', async ({ page }) => {
    const dashboardData = page.waitForResponse(
      (res) => res.url().includes('/api/clients/me/dashboard') && res.request().method() === 'GET'
    );

    await page.goto('/#/portal');
    await introFinished(page);
    await page.fill('#portal-page-email', CLIENT_EMAIL!);
    await page.fill('#portal-page-password', CLIENT_PASSWORD!);
    await page.click('#portal-page-login-form button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    expect(page.url()).not.toContain('#/portal');

    const sidebar = page.getByRole('navigation').filter({ hasText: 'Sign Out' });
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    for (const item of ['Dashboard', 'Messages', 'Files', 'Payments', 'Settings']) {
      await expect(sidebar.getByText(item, { exact: true }).first()).toBeVisible();
    }
    // A client never sees the admin groupings.
    await expect(sidebar.getByText('CRM', { exact: true })).toHaveCount(0);

    expect((await dashboardData).status()).toBe(200);

    // A first visit shows the cookie banner over the bottom of the viewport.
    // Answer it the way a person would before reaching for the footer.
    const decline = page.getByRole('button', { name: /decline/i });
    if (await decline.isVisible().catch(() => false)) {
      await decline.click();
    }
    const signOut = page.getByRole('button', { name: /sign out/i });
    await signOut.scrollIntoViewIfNeeded();
    await signOut.click();
    await page.waitForURL(/#\/portal|\/$/, { timeout: 15000 });
    const validate = await page.request.get('/api/auth/validate', { failOnStatusCode: false });
    expect(validate.status()).toBe(401);
  });
});
