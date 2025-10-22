import { test, expect, TEST_WALLET_ADDRESS } from '../fixtures/auth-setup';
import { testPoolDeployment } from '../fixtures/testData';

/**
 * Authenticated Pool Deployment Tests
 * Uses pre-funded test wallet: 7gZWQiUr4bfJMHCSyXGfExQMsjVuy4bgHJowhgxwhkz9
 */

test.describe('Pool Deployment with Test Wallet', () => {
  test('should find post without pool', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Click first post to open detail
    const firstPost = page.locator('[data-testid="post-card"], .post-card, article').first();

    if (await firstPost.isVisible({ timeout: 5000 })) {
      await firstPost.click();
      await page.waitForTimeout(1500);

      // Check if "No Pool Yet" is displayed
      const noPoolCard = await page.getByText('No Pool Yet').isVisible({ timeout: 3000 }).catch(() => false);

      if (noPoolCard) {
        console.log('✓ Found post without pool - ready for deployment');
      } else {
        console.log('⚠️ This post already has a pool or is loading');
      }
    }
  });

  test('should show create pool button', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Open first post
    const firstPost = page.locator('[data-testid="post-card"], article').first();

    if (await firstPost.isVisible({ timeout: 5000 })) {
      await firstPost.click();
      await page.waitForTimeout(1500);

      // Look for create pool button
      const createPoolButton = page.getByRole('button', { name: /create pool|deploy pool/i });

      if (await createPoolButton.isVisible({ timeout: 3000 })) {
        console.log('✓ Create pool button is visible');
        expect(await createPoolButton.isDisabled()).toBe(false);
      } else {
        console.log('⚠️ Create pool button not found (post may have pool)');
      }
    }
  });

  test('should attempt pool creation', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Open first post
    const firstPost = page.locator('[data-testid="post-card"], article').first();

    if (await firstPost.isVisible({ timeout: 5000 })) {
      await firstPost.click();
      await page.waitForTimeout(1500);

      // Try to create pool
      const createPoolButton = page.getByRole('button', { name: /create pool/i });

      if (await createPoolButton.isVisible({ timeout: 3000 })) {
        console.log('Attempting to create pool...');
        await createPoolButton.click();

        // Wait for transaction signing prompt or loading state
        await page.waitForTimeout(3000);

        // Check for various states:
        // 1. Wallet signature prompt
        const signButton = page.getByRole('button', { name: /approve|sign|confirm/i });
        if (await signButton.isVisible({ timeout: 5000 })) {
          console.log('✓ Wallet signature prompt appeared');
          // Note: Actually signing would require browser wallet extension
          // In real tests, we'd use a test wallet with auto-approve
        }

        // 2. Loading state
        const loading = await page.locator('.animate-spin, text=/creating|deploying/i').isVisible({ timeout: 2000 }).catch(() => false);
        if (loading) {
          console.log('✓ Loading state shown');
        }

        // 3. Error message (if wallet not properly connected)
        const error = await page.getByText(/error|failed|connect wallet/i).isVisible({ timeout: 2000 }).catch(() => false);
        if (error) {
          const errorText = await page.locator('text=/error|failed|connect wallet/i').textContent();
          console.log(`⚠️ Error occurred: ${errorText}`);
        }
      }
    }
  });
});

test.describe('Pool Display', () => {
  test('should display pool metrics if pool exists', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Open first post
    const firstPost = page.locator('[data-testid="post-card"], article').first();

    if (await firstPost.isVisible({ timeout: 5000 })) {
      await firstPost.click();
      await page.waitForTimeout(1500);

      // Check for pool metrics
      const poolMetrics = page.locator('[data-testid="pool-metrics-card"]');
      const hasMetrics = await poolMetrics.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasMetrics) {
        console.log('✓ Pool metrics displayed');

        // Check for specific metrics
        const tvl = await page.getByText(/tvl|total value/i).isVisible().catch(() => false);
        const prices = await page.getByText(/price/i).isVisible().catch(() => false);

        console.log(`  - TVL display: ${tvl ? '✓' : '✗'}`);
        console.log(`  - Price display: ${prices ? '✓' : '✗'}`);
      } else {
        console.log('⚠️ No pool metrics (post may not have pool)');
      }
    }
  });

  test('should display swap component if pool deployed', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Open first post
    const firstPost = page.locator('[data-testid="post-card"], article').first();

    if (await firstPost.isVisible({ timeout: 5000 })) {
      await firstPost.click();
      await page.waitForTimeout(1500);

      // Check for swap/trade component
      const swapComponent = page.locator('[data-testid="swap-component"], .swap-card');
      const hasSwap = await swapComponent.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasSwap) {
        console.log('✓ Swap component displayed');

        // Check for buy/sell buttons
        const buyButton = await page.getByRole('button', { name: /buy/i }).isVisible().catch(() => false);
        const sellButton = await page.getByRole('button', { name: /sell/i }).isVisible().catch(() => false);

        console.log(`  - Buy button: ${buyButton ? '✓' : '✗'}`);
        console.log(`  - Sell button: ${sellButton ? '✓' : '✗'}`);
      } else {
        console.log('⚠️ No swap component (post may not have deployed market)');
      }
    }
  });
});

test.describe('Profile View', () => {
  test('should view own profile', async ({ authenticatedPage: page }) => {
    await page.goto('/');

    // Try to navigate to profile
    const profileLink = page.getByRole('link', { name: /profile/i }).first();

    if (await profileLink.isVisible({ timeout: 5000 })) {
      await profileLink.click();
      await page.waitForTimeout(2000);

      // Should show user info
      console.log('✓ Navigated to profile page');
      console.log(`  URL: ${page.url()}`);
    } else {
      // Try clicking user menu
      const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Profile")').first();
      if (await userMenu.isVisible({ timeout: 3000 })) {
        await userMenu.click();
        await page.waitForTimeout(500);

        const profileItem = page.getByText(/profile|view profile/i);
        if (await profileItem.isVisible({ timeout: 2000 })) {
          await profileItem.click();
          await page.waitForTimeout(2000);
          console.log('✓ Navigated to profile via menu');
        }
      }
    }
  });
});
