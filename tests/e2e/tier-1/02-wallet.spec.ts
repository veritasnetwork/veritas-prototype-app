import { test, expect } from '@playwright/test';
import { connectWallet, getWalletAddress, getUSDCBalance } from '../helpers/wallet';

/**
 * Tier 1: Wallet Integration Tests
 * Tests Solana wallet connection and balance display
 */

test.describe('Wallet Connection', () => {
  test.skip('should connect Solana wallet via Privy', async ({ page }) => {
    // SKIP: Requires authentication
    await page.goto('/');

    await connectWallet(page);

    // Wallet address should be visible
    const address = await getWalletAddress(page);
    expect(address).toBeTruthy();
    expect(address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/); // Base58 format
  });

  test.skip('should display USDC balance', async ({ page }) => {
    // SKIP: Requires wallet connection
    await page.goto('/');
    await connectWallet(page);

    // USDC balance should be visible
    const balance = await getUSDCBalance(page);
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  test.skip('should show fund wallet button when balance is low', async ({ page }) => {
    // SKIP: Requires wallet with low/zero balance
    await page.goto('/');
    await connectWallet(page);

    const balance = await getUSDCBalance(page);

    if (balance !== null && balance < 10) {
      // Fund wallet button should be visible
      const fundButton = page.getByRole('button', { name: /fund wallet/i });
      await expect(fundButton).toBeVisible();
    }
  });

  test.skip('should disconnect wallet', async ({ page }) => {
    // SKIP: Requires wallet connection
    await page.goto('/');
    await connectWallet(page);

    // Click disconnect
    const userMenu = page.locator('[data-testid="user-menu"]');
    await userMenu.click();

    const disconnectButton = page.getByRole('button', { name: /disconnect/i });
    await disconnectButton.click();

    // Wallet should be disconnected
    const address = await getWalletAddress(page);
    expect(address).toBeNull();
  });
});

test.describe('Onboarding Wallet Display', () => {
  test.skip('should show wallet info in onboarding modal', async ({ page }) => {
    // SKIP: Requires fresh user with connected wallet
    await page.goto('/');
    await connectWallet(page);

    // Should show wallet address in onboarding
    await expect(page.getByText(/wallet/i)).toBeVisible();
    await expect(page.getByText(/usdc balance/i)).toBeVisible();
  });
});
