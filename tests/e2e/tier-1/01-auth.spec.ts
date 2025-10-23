import { test, expect } from '@playwright/test';
import { loginWithPrivy, completeOnboarding, isAuthenticated, logout } from '../helpers/auth';
import { testUsers } from '../fixtures/testData';

/**
 * Tier 1: Authentication & Onboarding Tests
 * CRITICAL - These must pass for all other tests to work
 */

test.describe('Authentication Flow', () => {
  test('should load home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Veritas/i);
  });

  test('should show login/connect button when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Look for login or connect button
    const authButton = page.getByRole('button', { name: /connect|login/i });
    await expect(authButton).toBeVisible();
  });

  test.skip('should authenticate with Privy email', async ({ page }) => {
    // SKIP: Requires manual email verification code entry
    // To run: Use Privy test mode or mock API
    await loginWithPrivy(page, testUsers.alice.email);
    expect(await isAuthenticated(page)).toBe(true);
  });

  test.skip('should logout successfully', async ({ page }) => {
    // SKIP: Requires authentication first
    await loginWithPrivy(page, testUsers.alice.email);
    await logout(page);
    expect(await isAuthenticated(page)).toBe(false);
  });
});

test.describe('Profile Creation (Onboarding)', () => {
  test.skip('should show onboarding modal for new users', async ({ page }) => {
    // SKIP: Requires fresh authenticated user
    await loginWithPrivy(page, `new-user-${Date.now()}@veritas.local`);

    // Onboarding modal should appear
    await expect(page.getByText('Complete Your Profile')).toBeVisible();
  });

  test.skip('should complete profile with username only', async ({ page }) => {
    // SKIP: Requires fresh authenticated user
    await loginWithPrivy(page, `new-user-${Date.now()}@veritas.local`);
    await completeOnboarding(page, `testuser_${Date.now()}`);

    // Should redirect to home page
    await expect(page).toHaveURL('/');
    expect(await isAuthenticated(page)).toBe(true);
  });

  test.skip('should complete profile with username and display name', async ({ page }) => {
    // SKIP: Requires fresh authenticated user
    const username = `testuser_${Date.now()}`;
    const displayName = `Test User ${Date.now()}`;

    await loginWithPrivy(page, `new-user-${Date.now()}@veritas.local`);
    await completeOnboarding(page, username, displayName);

    // Should redirect to home page
    await expect(page).toHaveURL('/');
  });

  test.skip('should reject invalid usernames', async ({ page }) => {
    // SKIP: Requires fresh authenticated user
    await loginWithPrivy(page, `new-user-${Date.now()}@veritas.local`);

    // Wait for onboarding modal
    await page.waitForSelector('text=Complete Your Profile');

    // Try invalid username (too short)
    const usernameInput = page.locator('input[id="username"]');
    await usernameInput.fill('ab');

    const submitButton = page.getByRole('button', { name: /complete profile/i });
    await submitButton.click();

    // Should show error
    await expect(page.getByText(/must be 3-20 characters/i)).toBeVisible();
  });

  test.skip('should upload profile photo during onboarding', async ({ page }) => {
    // SKIP: Requires fresh authenticated user and test image file
    await loginWithPrivy(page, `new-user-${Date.now()}@veritas.local`);

    // Wait for onboarding modal
    await page.waitForSelector('text=Complete Your Profile');

    // Upload photo
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./tests/e2e/fixtures/test-avatar.jpg');

    // Complete profile
    const username = `testuser_${Date.now()}`;
    await completeOnboarding(page, username);

    // Profile photo should be visible
    await expect(page.locator('img[alt*="avatar"], img[alt*="profile"]')).toBeVisible();
  });
});

test.describe('Auth Status API', () => {
  test('should return unauthenticated status when not logged in', async ({ request }) => {
    const response = await request.get('/api/auth/status');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.authenticated).toBe(false);
  });

  test.skip('should return authenticated status when logged in', async ({ page, request }) => {
    // SKIP: Requires authentication
    await loginWithPrivy(page, testUsers.alice.email);

    // Get auth status
    const response = await page.request.get('/api/auth/status');
    const data = await response.json();

    expect(data.authenticated).toBe(true);
    expect(data.user).toBeDefined();
  });
});
