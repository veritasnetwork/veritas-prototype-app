import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loginWithPrivyTestAccount, isAuthenticated } from '../helpers/privy-test-auth';

/**
 * Test wallet funded by startup script
 */
export const TEST_WALLET_ADDRESS = '7gZWQiUr4bfJMHCSyXGfExQMsjVuy4bgHJowhgxwhkz9';

/**
 * Extended test fixture with authenticated state
 * Uses Privy test account for automatic authentication
 */

type AuthFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Check if already authenticated
    await page.goto('/');
    await page.waitForTimeout(1500);

    const alreadyAuth = await isAuthenticated(page);

    if (!alreadyAuth) {
      // Login with Privy test account
      await loginWithPrivyTestAccount(page);
    } else {
      console.log('✅ Already authenticated, skipping login');
    }

    // Use the authenticated page
    await use(page);

    // Cleanup: logout after test (optional)
    // await logout(page);
  },
});

export { expect };
