/**
 * ===============================================
 * CLIENT PORTAL FLOW E2E TESTS
 * ===============================================
 * @file tests/e2e/portal-flow.spec.ts
 *
 * Client portal login and dashboard flow.
 *
 * Prerequisites:
 * - Demo user exists (demo@example.com / demo123 from seed migration 024)
 * - E2E_CLIENT_EMAIL and E2E_CLIENT_PASSWORD must be set (or uses demo defaults)
 * - Use `npm run dev:full` so both frontend and backend run
 *
 * To run: E2E_CLIENT_EMAIL=demo@example.com E2E_CLIENT_PASSWORD=demo123 npx playwright test portal-flow
 */

import { test, expect } from '@playwright/test';

const CLIENT_EMAIL = process.env.E2E_CLIENT_EMAIL || 'demo@example.com';
const CLIENT_PASSWORD = process.env.E2E_CLIENT_PASSWORD || 'demo123';

test.describe('Client Portal Flow', () => {
  test('login via API and view dashboard', async ({ page }) => {
    // 1. Login via API to set HttpOnly cookie (use page context so cookies are shared)
    const loginRes = await page.request.post('/api/auth/login', {
      data: { email: CLIENT_EMAIL, password: CLIENT_PASSWORD },
      failOnStatusCode: false
    });

    if (!loginRes.ok) {
      test.skip(true, `Login failed (${loginRes.status}) - ensure demo user exists and credentials match`);
    }

    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.data?.user) {
      test.skip(true, 'Login returned unsuccessful - check E2E_CLIENT_EMAIL and E2E_CLIENT_PASSWORD');
    }

    // 2. Navigate to portal (cookie will be sent)
    await page.goto('/client/portal');
    await page.waitForLoadState('networkidle');

    // 3. Dashboard should be visible
    await expect(page.locator('.dashboard-container')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#dashboard-content')).toBeVisible();
    await expect(page.locator('#tab-dashboard')).toBeVisible();

    // 4. Dashboard tab content
    await expect(page.locator('.portal-project-cards, .quick-stats, #client-name')).toBeVisible();
  });

  test('portal dashboard shows welcome and navigation', async ({ page }) => {
    const loginRes = await page.request.post('/api/auth/login', {
      data: { email: CLIENT_EMAIL, password: CLIENT_PASSWORD },
      failOnStatusCode: false
    });

    if (!loginRes.ok) {
      test.skip(true, `Login failed (${loginRes.status}) - ensure demo user exists`);
    }

    await page.goto('/client/portal');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#btn-dashboard')).toBeVisible();
    await expect(page.locator('#btn-files')).toBeVisible();
    await expect(page.locator('#btn-invoices')).toBeVisible();
    await expect(page.locator('#btn-logout')).toBeVisible();
  });
});
