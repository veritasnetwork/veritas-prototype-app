import { Page } from '@playwright/test';

/**
 * Helper functions for authentication in E2E tests
 */

export async function loginWithPrivy(page: Page, email: string) {
  // Navigate to home page
  await page.goto('/');

  // Wait for Privy auth to load
  await page.waitForTimeout(2000);

  // Click login/connect button
  const loginButton = page.getByRole('button', { name: /connect|login/i });
  await loginButton.click();

  // Wait for Privy modal
  await page.waitForSelector('[data-testid="privy-modal"], .privy-modal, iframe[title*="Privy"]', { timeout: 10000 });

  // Enter email
  const emailInput = page.getByPlaceholder(/email/i);
  await emailInput.fill(email);

  // Click continue
  const continueButton = page.getByRole('button', { name: /continue|log in/i });
  await continueButton.click();

  // Wait for email code input (Privy sends verification code)
  await page.waitForSelector('input[type="text"], input[placeholder*="code"]', { timeout: 10000 });

  // In test environment, we'd need to:
  // 1. Use a test email that auto-verifies
  // 2. Or mock the Privy API
  // 3. Or manually enter code during test development

  console.log('⚠️ Manual step required: Enter email verification code');
  await page.pause(); // Pause for manual code entry during development
}

export async function completeOnboarding(page: Page, username: string, displayName?: string) {
  // Wait for onboarding modal
  await page.waitForSelector('text=Complete Your Profile', { timeout: 10000 });

  // Fill username
  const usernameInput = page.locator('input[id="username"], input[placeholder*="username"]');
  await usernameInput.fill(username);

  // Fill display name if provided
  if (displayName) {
    const displayNameInput = page.locator('input[id="displayName"], input[placeholder*="display"]');
    await displayNameInput.fill(displayName);
  }

  // Submit
  const submitButton = page.getByRole('button', { name: /complete profile/i });
  await submitButton.click();

  // Wait for redirect to home
  await page.waitForURL('/', { timeout: 10000 });
}

export async function isAuthenticated(page: Page): Promise<boolean> {
  // Check if user is authenticated by looking for user-specific elements
  const userMenu = page.locator('[data-testid="user-menu"], .user-avatar, button:has-text("Profile")');
  return await userMenu.isVisible();
}

export async function logout(page: Page) {
  // Click user menu/avatar
  const userMenu = page.locator('[data-testid="user-menu"], .user-avatar');
  await userMenu.click();

  // Click logout
  const logoutButton = page.getByRole('button', { name: /logout|disconnect/i });
  await logoutButton.click();

  // Wait for redirect to logged-out state
  await page.waitForTimeout(1000);
}
