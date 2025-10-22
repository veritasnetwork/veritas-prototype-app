import { test, expect } from '@playwright/test';
import { connectWallet, signTransaction, waitForTransactionConfirmation } from '../helpers/wallet';
import { testPoolDeployment } from '../fixtures/testData';

/**
 * Tier 3: Pool Deployment Tests
 * Tests 2-step pool deployment flow
 */

test.describe('Pool Deployment - Step 1: Create Empty Pool', () => {
  test.skip('should show "No Pool Yet" card for post without pool', async ({ page }) => {
    // SKIP: Requires post without pool
    await page.goto('/');

    // Open post detail
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Should show no pool card
    await expect(page.getByText('No Pool Yet')).toBeVisible();
  });

  test.skip('should require wallet connection to deploy pool', async ({ page }) => {
    // SKIP: Requires post without pool and disconnected wallet
    await page.goto('/');

    // Open post detail
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Try to create pool without wallet
    const createPoolButton = page.getByRole('button', { name: /create pool/i });
    await createPoolButton.click();

    // Should show wallet connection prompt
    await expect(page.getByText(/connect wallet/i)).toBeVisible();
  });

  test.skip('should create empty pool successfully', async ({ page }) => {
    // SKIP: Requires post without pool, wallet with SOL
    await page.goto('/');
    await connectWallet(page);

    // Open post detail
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Click create pool
    const createPoolButton = page.getByRole('button', { name: /create pool/i });
    await createPoolButton.click();

    // Sign transaction
    await signTransaction(page);

    // Wait for confirmation
    await waitForTransactionConfirmation(page);

    // Should advance to step 2
    await expect(page.getByText(/add initial liquidity/i)).toBeVisible({ timeout: 30000 });
  });

  test.skip('should handle transaction rejection', async ({ page }) => {
    // SKIP: Requires post without pool
    await page.goto('/');
    await connectWallet(page);

    // Open post detail
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Click create pool
    const createPoolButton = page.getByRole('button', { name: /create pool/i });
    await createPoolButton.click();

    // Reject transaction (manual step)
    // Should show error
    await expect(page.getByText(/rejected|cancelled/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Pool Deployment - Step 2: Deploy Market', () => {
  test.skip('should show liquidity form after pool creation', async ({ page }) => {
    // SKIP: Requires pool in step 2 state
    await page.goto('/');

    // Open post with pool in step 2
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Should show liquidity form
    await expect(page.getByText(/add initial liquidity/i)).toBeVisible();
    await expect(page.getByLabel(/initial deposit/i)).toBeVisible();
    await expect(page.getByLabel(/long.*allocation/i)).toBeVisible();
  });

  test.skip('should set initial deposit amount', async ({ page }) => {
    // SKIP: Requires pool in step 2 state
    await page.goto('/');

    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Set deposit amount
    const depositInput = page.locator('input[type="number"]').first();
    await depositInput.fill(testPoolDeployment.initialDeposit.toString());

    // Value should be set
    await expect(depositInput).toHaveValue(testPoolDeployment.initialDeposit.toString());
  });

  test.skip('should adjust LONG/SHORT allocation with slider', async ({ page }) => {
    // SKIP: Requires pool in step 2 state
    await page.goto('/');

    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Adjust slider
    const slider = page.locator('input[type="range"]');
    await slider.fill('70');

    // Should show 70/30 split
    await expect(page.getByText(/long.*70%/i)).toBeVisible();
    await expect(page.getByText(/short.*30%/i)).toBeVisible();
  });

  test.skip('should show summary of allocation', async ({ page }) => {
    // SKIP: Requires pool in step 2 state
    await page.goto('/');

    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Set values
    await page.locator('input[type="number"]').first().fill('100');
    await page.locator('input[type="range"]').fill('50');

    // Should show summary
    await expect(page.getByText(/total deposit.*100/i)).toBeVisible();
    await expect(page.getByText(/long.*50/i)).toBeVisible();
    await expect(page.getByText(/short.*50/i)).toBeVisible();
  });

  test.skip('should deploy market successfully', async ({ page }) => {
    // SKIP: Requires pool in step 2 state, wallet with USDC
    await page.goto('/');
    await connectWallet(page);

    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Set deposit
    await page.locator('input[type="number"]').first().fill(testPoolDeployment.initialDeposit.toString());
    await page.locator('input[type="range"]').fill(testPoolDeployment.longAllocationPercent.toString());

    // Deploy market
    const deployButton = page.getByRole('button', { name: /deploy market/i });
    await deployButton.click();

    // Sign transaction
    await signTransaction(page);

    // Wait for confirmation
    await waitForTransactionConfirmation(page);

    // Should show success state
    await expect(page.getByText(/pool deployed|success/i)).toBeVisible({ timeout: 30000 });
  });

  test.skip('should reject deposit below minimum', async ({ page }) => {
    // SKIP: Requires pool in step 2 state
    await page.goto('/');

    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Try to deploy with low amount
    await page.locator('input[type="number"]').first().fill('5');

    const deployButton = page.getByRole('button', { name: /deploy market/i });
    await expect(deployButton).toBeDisabled();
  });

  test.skip('should require sufficient USDC balance', async ({ page }) => {
    // SKIP: Requires pool in step 2 state, wallet with insufficient USDC
    await page.goto('/');
    await connectWallet(page);

    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Try to deploy with more than balance
    await page.locator('input[type="number"]').first().fill('999999');

    const deployButton = page.getByRole('button', { name: /deploy market/i });
    await deployButton.click();

    // Should show error
    await expect(page.getByText(/insufficient.*balance/i)).toBeVisible();
  });
});

test.describe('Pool Deployment - Success State', () => {
  test.skip('should display pool metrics after deployment', async ({ page }) => {
    // SKIP: Requires newly deployed pool
    await page.goto('/');

    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Pool metrics should be visible
    await expect(page.locator('[data-testid="pool-metrics-card"]')).toBeVisible();
    await expect(page.getByText(/tvl|total value/i)).toBeVisible();
    await expect(page.getByText(/long.*price/i)).toBeVisible();
    await expect(page.getByText(/short.*price/i)).toBeVisible();
  });

  test.skip('should enable trading after deployment', async ({ page }) => {
    // SKIP: Requires newly deployed pool
    await page.goto('/');

    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Swap component should be visible
    await expect(page.locator('[data-testid="swap-component"], .swap-card')).toBeVisible();
    await expect(page.getByRole('button', { name: /buy|sell/i })).toBeEnabled();
  });
});

test.describe('Pool Deployment API', () => {
  test.skip('should prepare pool creation transaction', async ({ request }) => {
    // SKIP: Requires auth token and valid post ID
    const response = await request.post('/api/pools/deploy', {
      data: {
        postId: 'test-post-id',
        walletAddress: 'test-wallet-address',
      },
      headers: {
        'Authorization': 'Bearer TEST_JWT_TOKEN',
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.transaction).toBeDefined();
    expect(data.poolAddress).toBeDefined();
  });

  test.skip('should prepare market deployment transaction', async ({ request }) => {
    // SKIP: Requires auth token and pool address
    const response = await request.post('/api/pools/deploy-market', {
      data: {
        poolAddress: 'test-pool-address',
        walletAddress: 'test-wallet-address',
        initialDeposit: 100,
        longAllocationPercent: 50,
      },
      headers: {
        'Authorization': 'Bearer TEST_JWT_TOKEN',
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.transaction).toBeDefined();
  });
});
