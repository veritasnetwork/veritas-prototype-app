# Veritas E2E Tests

End-to-end tests for the Veritas application using Playwright.

## Setup

```bash
npm install -D @playwright/test --legacy-peer-deps
npx playwright install chromium
```

## Running Tests

```bash
# Run all tests
npm run test:e2e

# Run authenticated tests (uses test wallet 7gZWQiUr4bfJMHCSyXGfExQMsjVuy4bgHJowhgxwhkz9)
npm run test:e2e:auth

# Run authenticated tests in headed mode (see browser)
npm run test:e2e:auth:headed

# Run specific tier
npm run test:e2e:tier1
npm run test:e2e:tier2
npm run test:e2e:tier3

# Run in UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run only non-skipped tests
npx playwright test --grep-invert "skip"
```

## Test Organization

Tests are organized in tiers based on dependencies:

### Tier 1: Foundation (CRITICAL)
- `01-auth.spec.ts` - Authentication and onboarding
- `02-wallet.spec.ts` - Wallet connection and balance
- `03-navigation.spec.ts` - Basic navigation

### Tier 2: Core App Features
- `01-post-creation.spec.ts` - Creating posts
- `02-feed-viewing.spec.ts` - Feed and post detail viewing
- `03-profile.spec.ts` - Profile viewing and editing (TODO)

### Tier 3: Solana Integration
- `01-pool-deployment.spec.ts` - 2-step pool deployment

### Tier 4: Trading (TODO)
- `01-trading.spec.ts` - Buy/sell tokens
- `02-trade-history.spec.ts` - Trade history display
- `03-holdings.spec.ts` - User holdings

### Tier 5: Protocol (TODO)
- `01-belief-submission.spec.ts` - Submit beliefs
- `02-epoch-processing.spec.ts` - Epoch lifecycle
- `03-settlement.spec.ts` - Pool settlement

## Test Status

Many tests are marked with `test.skip()` because they require:
- User authentication (Privy email verification)
- Funded test wallets (SOL + USDC)
- Existing posts in database
- Deployed pools

## Running Authenticated Tests

To run tests that require authentication:

1. **Use Privy Test Mode**:
   - Configure Privy with test mode enabled
   - Use auto-verify email addresses

2. **Or manually authenticate**:
   - Uncomment `await page.pause()` in auth helpers
   - Run tests in headed mode
   - Manually enter email verification codes

3. **Or mock Privy API**:
   - Intercept Privy API calls
   - Return test tokens

## Environment Setup

Create `.env.test` file:

```env
BASE_URL=http://localhost:3000
SUPABASE_URL=http://localhost:54321
SOLANA_RPC=http://localhost:8899
TEST_WALLET_PRIVATE_KEY=your-test-wallet-key
```

## Debugging

```bash
# Generate trace
npx playwright test --trace on

# Open trace viewer
npx playwright show-trace trace.zip

# Debug mode (step through)
npx playwright test --debug

# View test report
npx playwright show-report
```

## Adding New Tests

1. Create test file in appropriate tier directory
2. Import helpers from `../helpers/`
3. Import test data from `../fixtures/testData.ts`
4. Use `test.skip()` if test requires manual setup
5. Add clear comments explaining why test is skipped

## Helper Functions

### Auth Helpers (`helpers/auth.ts`)
- `loginWithPrivy(page, email)` - Authenticate user
- `completeOnboarding(page, username, displayName?)` - Complete profile
- `isAuthenticated(page)` - Check auth status
- `logout(page)` - Sign out

### Wallet Helpers (`helpers/wallet.ts`)
- `connectWallet(page)` - Connect Solana wallet
- `getWalletAddress(page)` - Get connected address
- `getUSDCBalance(page)` - Get USDC balance
- `signTransaction(page)` - Approve wallet signature
- `waitForTransactionConfirmation(page)` - Wait for tx

## CI/CD

Tests can run in CI with:
- Headless mode (default)
- Retries on failure
- HTML report generation
- Screenshots/videos on failure

See `playwright.config.ts` for configuration.
