import { test, expect } from '@playwright/test';
import { testPosts } from '../fixtures/testData';

/**
 * Tier 2: Post Creation Tests
 * Tests user ability to create and publish posts
 */

test.describe('Create Post Modal', () => {
  test.skip('should open create post modal', async ({ page }) => {
    // SKIP: Requires authentication
    await page.goto('/');

    // Click create post button
    const createButton = page.getByRole('button', { name: /create post|new post/i });
    await createButton.click();

    // Modal should open
    await expect(page.getByText(/create post/i)).toBeVisible();
  });

  test.skip('should close create post modal', async ({ page }) => {
    // SKIP: Requires authentication
    await page.goto('/');

    // Open modal
    const createButton = page.getByRole('button', { name: /create post|new post/i });
    await createButton.click();

    // Close modal
    const closeButton = page.getByRole('button', { name: /close|cancel/i });
    await closeButton.click();

    // Modal should close
    await expect(page.getByText(/create post/i)).not.toBeVisible();
  });
});

test.describe('Post Creation - Text Only', () => {
  test.skip('should create simple text post', async ({ page }) => {
    // SKIP: Requires authentication
    await page.goto('/');

    // Open create modal
    const createButton = page.getByRole('button', { name: /create post|new post/i });
    await createButton.click();

    // Fill in post details
    await page.locator('input[placeholder*="title"], input[name="title"]').fill(testPosts.simple.title);

    // Fill content in TipTap editor
    await page.locator('[contenteditable="true"], .ProseMirror').fill(testPosts.simple.content);

    // Select belief category
    const beliefSelect = page.locator('select[name="belief"], select[id="belief"]');
    await beliefSelect.selectOption(testPosts.simple.beliefCategory);

    // Submit
    const submitButton = page.getByRole('button', { name: /publish|create|post/i });
    await submitButton.click();

    // Should show success message or redirect
    await expect(page.getByText(/post created|success/i)).toBeVisible({ timeout: 10000 });
  });

  test.skip('should reject empty title', async ({ page }) => {
    // SKIP: Requires authentication
    await page.goto('/');

    // Open create modal
    const createButton = page.getByRole('button', { name: /create post|new post/i });
    await createButton.click();

    // Fill content but not title
    await page.locator('[contenteditable="true"]').fill(testPosts.simple.content);

    // Try to submit
    const submitButton = page.getByRole('button', { name: /publish|create|post/i });
    await submitButton.click();

    // Should show error
    await expect(page.getByText(/title.*required/i)).toBeVisible();
  });

  test.skip('should reject empty content', async ({ page }) => {
    // SKIP: Requires authentication
    await page.goto('/');

    // Open create modal
    const createButton = page.getByRole('button', { name: /create post|new post/i });
    await createButton.click();

    // Fill title but not content
    await page.locator('input[placeholder*="title"]').fill(testPosts.simple.title);

    // Try to submit
    const submitButton = page.getByRole('button', { name: /publish|create|post/i });
    await submitButton.click();

    // Should show error
    await expect(page.getByText(/content.*required/i)).toBeVisible();
  });

  test.skip('should reject post without belief category', async ({ page }) => {
    // SKIP: Requires authentication
    await page.goto('/');

    // Open create modal
    const createButton = page.getByRole('button', { name: /create post|new post/i });
    await createButton.click();

    // Fill title and content
    await page.locator('input[placeholder*="title"]').fill(testPosts.simple.title);
    await page.locator('[contenteditable="true"]').fill(testPosts.simple.content);

    // Don't select belief category
    // Try to submit
    const submitButton = page.getByRole('button', { name: /publish|create|post/i });
    await submitButton.click();

    // Should show error
    await expect(page.getByText(/belief.*required/i)).toBeVisible();
  });
});

test.describe('Post Creation - With Media', () => {
  test.skip('should upload and attach image', async ({ page }) => {
    // SKIP: Requires authentication and test image file
    await page.goto('/');

    // Open create modal
    const createButton = page.getByRole('button', { name: /create post|new post/i });
    await createButton.click();

    // Upload image
    const imageInput = page.locator('input[type="file"][accept*="image"]');
    await imageInput.setInputFiles(testPosts.withImage.image);

    // Image preview should appear
    await expect(page.locator('img[alt*="upload"], img[alt*="preview"]')).toBeVisible();

    // Fill rest of form
    await page.locator('input[placeholder*="title"]').fill(testPosts.withImage.title);
    await page.locator('[contenteditable="true"]').fill(testPosts.withImage.content);
    await page.locator('select[name="belief"]').selectOption(testPosts.withImage.beliefCategory);

    // Submit
    const submitButton = page.getByRole('button', { name: /publish/i });
    await submitButton.click();

    // Should succeed
    await expect(page.getByText(/post created|success/i)).toBeVisible({ timeout: 10000 });
  });

  test.skip('should upload and attach video', async ({ page }) => {
    // SKIP: Requires authentication and test video file
    await page.goto('/');

    // Open create modal
    const createButton = page.getByRole('button', { name: /create post|new post/i });
    await createButton.click();

    // Upload video
    const videoInput = page.locator('input[type="file"][accept*="video"]');
    await videoInput.setInputFiles(testPosts.withVideo.video);

    // Video preview should appear
    await expect(page.locator('video, [data-testid="video-preview"]')).toBeVisible();

    // Fill rest of form
    await page.locator('input[placeholder*="title"]').fill(testPosts.withVideo.title);
    await page.locator('[contenteditable="true"]').fill(testPosts.withVideo.content);
    await page.locator('select[name="belief"]').selectOption(testPosts.withVideo.beliefCategory);

    // Submit
    const submitButton = page.getByRole('button', { name: /publish/i });
    await submitButton.click();

    // Should succeed
    await expect(page.getByText(/post created|success/i)).toBeVisible({ timeout: 15000 });
  });

  test.skip('should reject oversized image', async ({ page }) => {
    // SKIP: Requires authentication and large test image
    await page.goto('/');

    // Open create modal
    const createButton = page.getByRole('button', { name: /create post|new post/i });
    await createButton.click();

    // Try to upload large image
    const imageInput = page.locator('input[type="file"][accept*="image"]');
    await imageInput.setInputFiles('./tests/e2e/fixtures/large-image.jpg');

    // Should show error
    await expect(page.getByText(/too large|size limit/i)).toBeVisible();
  });
});

test.describe('Post Creation API', () => {
  test.skip('should create post via API', async ({ request }) => {
    // SKIP: Requires authentication token
    const response = await request.post('/api/posts/create', {
      data: {
        title: testPosts.simple.title,
        content: testPosts.simple.content,
        belief_id: 'test-belief-id',
      },
      headers: {
        'Authorization': 'Bearer TEST_JWT_TOKEN',
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.title).toBe(testPosts.simple.title);
  });
});
