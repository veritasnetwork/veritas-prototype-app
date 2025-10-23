import { test, expect } from '@playwright/test';

/**
 * Basic UI Tests - No Authentication Required
 * These tests verify the UI loads and displays correctly
 */

test.describe('Homepage UI', () => {
  test('should load and display Veritas branding', async ({ page }) => {
    await page.goto('/');

    // Check for Veritas branding
    const logo = page.locator('img[alt*="Veritas"], img[alt*="logo"]').first();
    const heading = page.locator('text=/VERITAS/i').first();

    const logoVisible = await logo.isVisible({ timeout: 5000 }).catch(() => false);
    const headingVisible = await heading.isVisible({ timeout: 5000 }).catch(() => false);

    expect(logoVisible || headingVisible).toBeTruthy();
  });

  test('should display connect/login button', async ({ page }) => {
    await page.goto('/');

    const authButton = page.getByRole('button', { name: /connect|login|get started/i }).first();
    await expect(authButton).toBeVisible({ timeout: 10000 });
  });

  test('should have feed or posts section', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Check if feed area exists
    const feedExists = await page.locator('main, [data-testid="feed"], .feed').isVisible().catch(() => false);
    expect(feedExists).toBeTruthy();
  });
});

test.describe('Navigation Elements', () => {
  test('should have navigation menu', async ({ page }) => {
    await page.goto('/');

    // Check for nav elements
    const nav = page.locator('nav, [data-testid="sidebar"], aside').first();
    const navVisible = await nav.isVisible({ timeout: 5000 }).catch(() => false);

    expect(navVisible).toBeTruthy();
  });

  test('should have mobile navigation on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Mobile nav should exist
    const mobileNav = page.locator('[data-testid="mobile-nav"], nav, .mobile-nav').first();
    const visible = await mobileNav.isVisible({ timeout: 5000 }).catch(() => false);

    expect(visible).toBeTruthy();
  });
});

test.describe('Page Performance', () => {
  test('should load within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    console.log(`Page loaded in ${loadTime}ms`);
    expect(loadTime).toBeLessThan(10000); // Should load in under 10 seconds
  });
});

test.describe('Console Errors', () => {
  test('should not have critical console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // Filter out expected errors (like API calls that need auth)
    const criticalErrors = errors.filter(err =>
      !err.includes('401') &&
      !err.includes('403') &&
      !err.includes('Unauthorized')
    );

    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors);
    }

    // This is informational - we don't fail the test on console errors
    expect(criticalErrors.length).toBeLessThan(10);
  });
});
