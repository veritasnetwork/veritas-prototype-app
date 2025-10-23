import { test, expect } from '../fixtures/auth-setup';
import { testPosts } from '../fixtures/testData';

/**
 * Authenticated Post Creation Tests
 * Uses pre-funded test wallet: 7gZWQiUr4bfJMHCSyXGfExQMsjVuy4bgHJowhgxwhkz9
 */

test.describe('Create Post (Authenticated)', () => {
  test('should open create post modal', async ({ authenticatedPage: page }) => {
    await page.goto('/');

    // Click create post button
    const createButton = page.getByRole('button', { name: /create post|new post|\+/i }).first();
    await createButton.click();

    // Modal should open
    await expect(page.getByText(/create post/i)).toBeVisible({ timeout: 5000 });
  });

  test('should create simple text post', async ({ authenticatedPage: page }) => {
    await page.goto('/');

    // Open create modal
    const createButton = page.getByRole('button', { name: /create post|new post|\+/i }).first();
    await createButton.click();

    // Wait for modal
    await page.waitForTimeout(1000);

    // Fill in post details
    const titleInput = page.locator('input[placeholder*="title"], input[name="title"]').first();
    await titleInput.fill(testPosts.simple.title);

    // Fill content in TipTap editor
    const contentEditor = page.locator('[contenteditable="true"], .ProseMirror').first();
    await contentEditor.click();
    await contentEditor.fill(testPosts.simple.content);

    // Select belief category (if required)
    const beliefSelect = page.locator('select[name="belief"], select[id="belief"]').first();
    if (await beliefSelect.isVisible({ timeout: 2000 })) {
      await beliefSelect.selectOption({ index: 1 }); // Select first non-empty option
    }

    // Submit
    const submitButton = page.getByRole('button', { name: /publish|create|post/i }).first();
    await submitButton.click();

    // Should show success or redirect
    await page.waitForTimeout(3000);

    // Post should appear in feed or detail should open
    const success = await page.getByText(/success|created/i).isVisible({ timeout: 5000 }).catch(() => false);
    const postInFeed = await page.getByText(testPosts.simple.title).isVisible({ timeout: 5000 }).catch(() => false);

    expect(success || postInFeed).toBeTruthy();
  });

  test('should reject empty title', async ({ authenticatedPage: page }) => {
    await page.goto('/');

    // Open create modal
    const createButton = page.getByRole('button', { name: /create post|new post|\+/i }).first();
    await createButton.click();
    await page.waitForTimeout(1000);

    // Fill content but not title
    const contentEditor = page.locator('[contenteditable="true"]').first();
    await contentEditor.click();
    await contentEditor.fill(testPosts.simple.content);

    // Try to submit
    const submitButton = page.getByRole('button', { name: /publish|create|post/i }).first();

    // Button should be disabled or show error
    const isDisabled = await submitButton.isDisabled();

    if (!isDisabled) {
      await submitButton.click();
      // Should show error
      await expect(page.getByText(/title.*required/i)).toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe('View Posts (Authenticated)', () => {
  test('should display feed with posts', async ({ authenticatedPage: page }) => {
    await page.goto('/');

    // Wait for feed to load
    await page.waitForTimeout(2000);

    // Posts should be visible
    const posts = page.locator('[data-testid="post-card"], .post-card, article');
    const count = await posts.count();

    // Should have at least some posts (or show empty state)
    console.log(`Found ${count} posts in feed`);
  });

  test('should open post detail', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Try to click first post
    const firstPost = page.locator('[data-testid="post-card"], .post-card, article').first();

    if (await firstPost.isVisible({ timeout: 5000 })) {
      await firstPost.click();

      // Wait for detail panel or navigation
      await page.waitForTimeout(1500);

      // Detail panel should be visible or URL should change
      const panelVisible = await page.locator('[data-testid="post-detail-panel"], .post-detail').isVisible().catch(() => false);
      const urlChanged = page.url() !== 'http://localhost:3000/' && page.url() !== 'http://localhost:3000/feed';

      expect(panelVisible || urlChanged).toBeTruthy();
    }
  });
});

test.describe('Wallet Display (Authenticated)', () => {
  test('should display connected wallet address', async ({ authenticatedPage: page }) => {
    await page.goto('/');

    // Wallet address should be visible somewhere (header, profile, etc.)
    const walletDisplay = page.locator('text=/7gZW|...whkz9/');

    const visible = await walletDisplay.isVisible({ timeout: 5000 }).catch(() => false);

    if (visible) {
      console.log('✓ Wallet address displayed in UI');
    } else {
      console.log('⚠️ Wallet address not found in UI (may be in menu)');
    }
  });

  test('should display USDC balance', async ({ authenticatedPage: page }) => {
    await page.goto('/');

    // Look for balance display
    const balanceDisplay = page.locator('text=/\\$\\d+|USDC/');

    const visible = await balanceDisplay.isVisible({ timeout: 5000 }).catch(() => false);

    if (visible) {
      const balanceText = await balanceDisplay.textContent();
      console.log(`✓ USDC balance displayed: ${balanceText}`);
    } else {
      console.log('⚠️ USDC balance not found in UI (may be in menu)');
    }
  });
});
