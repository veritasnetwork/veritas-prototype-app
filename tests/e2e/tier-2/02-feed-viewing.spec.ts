import { test, expect } from '@playwright/test';

/**
 * Tier 2: Feed & Post Viewing Tests
 * Tests feed display and post detail viewing
 */

test.describe('Feed Display', () => {
  test('should load feed page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
  });

  test.skip('should display posts in feed', async ({ page }) => {
    // SKIP: Requires posts in database
    await page.goto('/');

    // Posts should be visible
    const posts = page.locator('[data-testid="post-card"], .post-card');
    await expect(posts.first()).toBeVisible({ timeout: 5000 });

    // Should have multiple posts
    const postCount = await posts.count();
    expect(postCount).toBeGreaterThan(0);
  });

  test.skip('should display post metadata', async ({ page }) => {
    // SKIP: Requires posts in database
    await page.goto('/');

    const firstPost = page.locator('[data-testid="post-card"]').first();

    // Should show author
    await expect(firstPost.locator('[data-testid="post-author"], .author')).toBeVisible();

    // Should show timestamp
    await expect(firstPost.locator('[data-testid="post-timestamp"], time')).toBeVisible();

    // Should show title
    await expect(firstPost.locator('h2, h3, [data-testid="post-title"]')).toBeVisible();
  });

  test.skip('should load more posts on scroll', async ({ page }) => {
    // SKIP: Requires many posts in database
    await page.goto('/');

    // Get initial post count
    const initialPosts = page.locator('[data-testid="post-card"]');
    const initialCount = await initialPosts.count();

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for new posts to load
    await page.waitForTimeout(2000);

    // Should have more posts
    const newCount = await initialPosts.count();
    expect(newCount).toBeGreaterThan(initialCount);
  });
});

test.describe('Post Detail Panel', () => {
  test.skip('should open post detail when clicking post', async ({ page }) => {
    // SKIP: Requires posts in feed
    await page.goto('/');

    // Click first post
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Detail panel should open
    const detailPanel = page.locator('[data-testid="post-detail-panel"], .post-detail');
    await expect(detailPanel).toBeVisible();
  });

  test.skip('should display full post content in detail panel', async ({ page }) => {
    // SKIP: Requires posts in feed
    await page.goto('/');

    // Open post
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Should show full content
    const content = page.locator('[data-testid="post-content"], .post-content');
    await expect(content).toBeVisible();
  });

  test.skip('should display author info in detail panel', async ({ page }) => {
    // SKIP: Requires posts in feed
    await page.goto('/');

    // Open post
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Should show author username and avatar
    await expect(page.locator('[data-testid="author-username"]')).toBeVisible();
    await expect(page.locator('[data-testid="author-avatar"], img[alt*="avatar"]')).toBeVisible();
  });

  test.skip('should display belief score card if available', async ({ page }) => {
    // SKIP: Requires post with belief submissions
    await page.goto('/');

    // Open post
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Belief score card should be visible
    const beliefCard = page.locator('[data-testid="belief-score-card"]');

    if (await beliefCard.isVisible()) {
      // Should show aggregated belief score
      await expect(beliefCard.getByText(/belief score|aggregate/i)).toBeVisible();
    }
  });

  test.skip('should display pool metrics if pool deployed', async ({ page }) => {
    // SKIP: Requires post with deployed pool
    await page.goto('/');

    // Open post
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Pool metrics card should be visible
    const poolCard = page.locator('[data-testid="pool-metrics-card"]');

    if (await poolCard.isVisible()) {
      // Should show TVL, prices, etc.
      await expect(poolCard.getByText(/tvl|total value/i)).toBeVisible();
      await expect(poolCard.getByText(/long|short/i)).toBeVisible();
    }
  });

  test.skip('should show "No Pool Yet" if pool not deployed', async ({ page }) => {
    // SKIP: Requires post without pool
    await page.goto('/');

    // Open post
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Should show no pool card
    const noPoolCard = page.locator('text=No Pool Yet');

    if (await noPoolCard.isVisible()) {
      // Should show deploy button
      await expect(page.getByRole('button', { name: /create pool|deploy/i })).toBeVisible();
    }
  });

  test.skip('should close detail panel', async ({ page }) => {
    // SKIP: Requires posts in feed
    await page.goto('/');

    // Open post
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await firstPost.click();

    // Close panel
    const closeButton = page.getByRole('button', { name: /close/i });
    await closeButton.click();

    // Panel should close
    const detailPanel = page.locator('[data-testid="post-detail-panel"]');
    await expect(detailPanel).not.toBeVisible();
  });
});

test.describe('Post Detail API', () => {
  test.skip('should fetch post by ID', async ({ request }) => {
    // SKIP: Requires known post ID
    const testPostId = 'test-post-id';

    const response = await request.get(`/api/posts/${testPostId}`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.id).toBe(testPostId);
    expect(data.title).toBeDefined();
    expect(data.content).toBeDefined();
  });
});
