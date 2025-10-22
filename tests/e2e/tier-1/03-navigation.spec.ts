import { test, expect } from '@playwright/test';

/**
 * Tier 1: Basic Navigation Tests
 * Tests core navigation works without authentication
 */

test.describe('Basic Navigation', () => {
  test('should load home/feed page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
  });

  test('should display navigation header', async ({ page }) => {
    await page.goto('/');

    // Logo should be visible
    await expect(page.getByAltText(/veritas logo/i)).toBeVisible();

    // Navigation links should be visible
    await expect(page.getByRole('link', { name: /home|feed/i })).toBeVisible();
  });

  test('should navigate to explore page', async ({ page }) => {
    await page.goto('/');

    // Click explore link
    const exploreLink = page.getByRole('link', { name: /explore/i });
    await exploreLink.click();

    // Should be on explore page
    await expect(page).toHaveURL(/\/explore/);
  });

  test.skip('should navigate to profile page when authenticated', async ({ page }) => {
    // SKIP: Requires authentication
    await page.goto('/');

    // Click profile link
    const profileLink = page.getByRole('link', { name: /profile/i });
    await profileLink.click();

    // Should be on profile page
    await expect(page).toHaveURL(/\/[a-zA-Z0-9_]+/);
  });

  test('should show sidebar on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    // Sidebar should be visible
    const sidebar = page.locator('[data-testid="sidebar"], aside, nav');
    await expect(sidebar).toBeVisible();
  });

  test('should show mobile nav on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
    await page.goto('/');

    // Mobile nav should be visible
    const mobileNav = page.locator('[data-testid="mobile-nav"], .mobile-nav');
    await expect(mobileNav).toBeVisible();
  });

  test('should toggle mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Click menu button
    const menuButton = page.getByRole('button', { name: /menu/i });
    if (await menuButton.isVisible()) {
      await menuButton.click();

      // Menu should expand
      await expect(page.locator('[data-testid="mobile-menu-expanded"]')).toBeVisible();
    }
  });
});

test.describe('Post Detail Panel', () => {
  test.skip('should open post detail panel when clicking post', async ({ page }) => {
    // SKIP: Requires posts in feed
    await page.goto('/');

    // Click first post
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Detail panel should open
    await expect(page.locator('[data-testid="post-detail-panel"]')).toBeVisible();
  });

  test.skip('should close post detail panel', async ({ page }) => {
    // SKIP: Requires posts in feed
    await page.goto('/');

    // Open post
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Close panel
    const closeButton = page.getByRole('button', { name: /close/i });
    await closeButton.click();

    // Panel should close
    await expect(page.locator('[data-testid="post-detail-panel"]')).not.toBeVisible();
  });
});
