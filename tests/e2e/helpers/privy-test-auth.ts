import { Page } from '@playwright/test';

/**
 * Privy Test Account Configuration
 * Get these from: Privy Dashboard > User management > Authentication > Advanced
 * Enable "Test accounts" to see credentials
 */

// TODO: Replace with actual test credentials from Privy Dashboard
export const PRIVY_TEST_EMAIL = process.env.PRIVY_TEST_EMAIL || 'test-XXXX@privy.io';
export const PRIVY_TEST_OTP = process.env.PRIVY_TEST_OTP || 'XXXXXX';

/**
 * Authenticate with Privy using test account
 * This uses the official Privy test account credentials
 */
export async function loginWithPrivyTestAccount(page: Page) {
  console.log('🔐 Logging in with Privy test account...');

  // Navigate to home page
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Click login/connect button
  const loginButton = page.getByRole('button', { name: /connect|login|sign in/i }).first();

  if (await loginButton.isVisible({ timeout: 5000 })) {
    await loginButton.click();
    console.log('  ✓ Clicked login button');
    await page.waitForTimeout(2000);

    // Look for email login button (use force click to bypass overlay)
    const emailButton = page.locator('button:has-text("Email"), button.login-method-button:has-text("email")').first();
    if (await emailButton.isVisible({ timeout: 3000 })) {
      await emailButton.click({ force: true });
      console.log('  ✓ Selected email login');
      await page.waitForTimeout(1000);
    }

    // Enter test email
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    if (await emailInput.isVisible({ timeout: 5000 })) {
      await emailInput.fill(PRIVY_TEST_EMAIL);
      console.log(`  ✓ Entered email: ${PRIVY_TEST_EMAIL}`);

      // Click continue/submit
      const continueButton = page.getByRole('button', { name: /continue|submit|log in/i }).first();
      if (await continueButton.isVisible({ timeout: 3000 })) {
        await continueButton.click();
        console.log('  ✓ Clicked continue');
        await page.waitForTimeout(2000);
      }
    }

    // Enter OTP code
    const otpInput = page.locator('input[type="text"], input[placeholder*="code" i], input[name="code"]').first();
    if (await otpInput.isVisible({ timeout: 5000 })) {
      await otpInput.fill(PRIVY_TEST_OTP);
      console.log(`  ✓ Entered OTP: ${PRIVY_TEST_OTP}`);

      // Submit OTP
      const submitButton = page.getByRole('button', { name: /verify|submit|continue/i }).first();
      if (await submitButton.isVisible({ timeout: 3000 })) {
        await submitButton.click();
        console.log('  ✓ Submitted OTP');
      } else {
        // OTP might auto-submit
        console.log('  ℹ OTP auto-submitted');
      }

      // Wait for authentication to complete
      await page.waitForTimeout(3000);
    }

    // Check for onboarding/profile creation
    const onboardingHeading = page.getByText(/complete.*profile|create.*profile|set up.*profile/i);
    if (await onboardingHeading.isVisible({ timeout: 3000 })) {
      console.log('  ⚠️ Onboarding required - creating test profile');

      // Generate unique username
      const timestamp = Date.now();
      const username = `testuser_${timestamp}`;

      const usernameInput = page.locator('input[id="username"], input[name="username"]').first();
      if (await usernameInput.isVisible({ timeout: 3000 })) {
        await usernameInput.fill(username);
        console.log(`  ✓ Created username: ${username}`);

        // Submit profile
        const profileButton = page.getByRole('button', { name: /complete|create|continue/i }).first();
        if (await profileButton.isVisible({ timeout: 3000 })) {
          await profileButton.click();
          console.log('  ✓ Submitted profile');
          await page.waitForTimeout(2000);
        }
      }
    }

    console.log('✅ Login complete!');
  } else {
    console.log('⚠️ Login button not found - may already be authenticated');
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Look for user-specific elements
  const userIndicators = [
    '[data-testid="user-menu"]',
    'button:has-text("Profile")',
    'img[alt*="avatar"]',
    'text=/Welcome/',
  ];

  for (const selector of userIndicators) {
    if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
      return true;
    }
  }

  return false;
}

/**
 * Logout user
 */
export async function logout(page: Page) {
  console.log('🚪 Logging out...');

  // Try to find and click user menu
  const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Profile")').first();
  if (await userMenu.isVisible({ timeout: 3000 })) {
    await userMenu.click();
    await page.waitForTimeout(500);

    // Look for logout button
    const logoutButton = page.getByRole('button', { name: /log out|disconnect|sign out/i });
    if (await logoutButton.isVisible({ timeout: 3000 })) {
      await logoutButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ Logged out');
    }
  }
}
