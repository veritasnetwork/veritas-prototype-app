import { Page } from '@playwright/test';

/**
 * Helper functions for wallet interactions in E2E tests
 */

export async function connectWallet(page: Page) {
  // Look for wallet connect button
  const connectButton = page.getByRole('button', { name: /connect wallet|link wallet/i });

  if (await connectButton.isVisible()) {
    await connectButton.click();

    // Wait for Privy wallet selection modal
    await page.waitForTimeout(1000);

    // Select embedded wallet or Solana wallet
    const walletOption = page.getByText(/embedded wallet|solana/i);
    await walletOption.click();

    // Wait for wallet to connect
    await page.waitForTimeout(2000);
  }
}

export async function getWalletAddress(page: Page): Promise<string | null> {
  // Try to extract wallet address from UI
  const walletAddress = page.locator('[data-testid="wallet-address"], .wallet-address, code:has-text("...")');

  if (await walletAddress.isVisible()) {
    return await walletAddress.textContent();
  }

  return null;
}

export async function getUSDCBalance(page: Page): Promise<number | null> {
  // Look for USDC balance display
  const balanceElement = page.locator('[data-testid="usdc-balance"], text=/\\$\\d+\\.\\d{2}/');

  if (await balanceElement.isVisible()) {
    const balanceText = await balanceElement.textContent();
    const match = balanceText?.match(/\$?([\d,]+\.?\d*)/);
    return match ? parseFloat(match[1].replace(/,/g, '')) : null;
  }

  return null;
}

export async function waitForTransactionConfirmation(page: Page, timeout = 30000) {
  // Wait for transaction to be confirmed (look for success message or spinner to disappear)
  await page.waitForSelector('text=/transaction confirmed|success/i, [data-testid="tx-success"]', {
    timeout,
    state: 'visible'
  }).catch(() => {
    // If no success message, wait for loading spinner to disappear
    return page.waitForSelector('.animate-spin, [data-testid="loading"]', {
      timeout,
      state: 'detached'
    });
  });
}

export async function signTransaction(page: Page) {
  // Wait for wallet signature prompt
  await page.waitForTimeout(1000);

  // Look for approve/sign button in Privy modal
  const approveButton = page.getByRole('button', { name: /approve|sign|confirm/i });

  if (await approveButton.isVisible({ timeout: 5000 })) {
    await approveButton.click();
  }

  // Wait for signature to complete
  await page.waitForTimeout(2000);
}
