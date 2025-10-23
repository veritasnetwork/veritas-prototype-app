/**
 * Test data fixtures for E2E tests
 */

export const testUsers = {
  alice: {
    email: 'alice-test@veritas.local',
    username: 'alice_test',
    displayName: 'Alice Test',
  },
  bob: {
    email: 'bob-test@veritas.local',
    username: 'bob_test',
    displayName: 'Bob Test',
  },
  charlie: {
    email: 'charlie-test@veritas.local',
    username: 'charlie_test',
    displayName: 'Charlie Test',
  },
};

export const testPosts = {
  simple: {
    title: 'Test Post - Simple',
    content: 'This is a simple test post with plain text content.',
    beliefCategory: 'technology',
  },
  withImage: {
    title: 'Test Post - With Image',
    content: 'This post includes an image attachment.',
    beliefCategory: 'science',
    image: './tests/e2e/fixtures/test-image.jpg',
  },
  withVideo: {
    title: 'Test Post - With Video',
    content: 'This post includes a video attachment.',
    beliefCategory: 'politics',
    video: './tests/e2e/fixtures/test-video.mp4',
  },
  long: {
    title: 'Test Post - Long Content',
    content: 'This is a long test post. '.repeat(50),
    beliefCategory: 'economics',
  },
};

export const testPoolDeployment = {
  initialDeposit: 100,
  longAllocationPercent: 50,
};

export const testTrade = {
  buyAmount: 10,
  sellAmount: 5,
};

export const testBelief = {
  value: 0.75,
  confidence: 0.8,
};

// Environment config
export const testConfig = {
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  supabaseURL: process.env.SUPABASE_URL || 'http://localhost:54321',
  solanaRPC: process.env.SOLANA_RPC || 'http://localhost:8899',
  testWalletPrivateKey: process.env.TEST_WALLET_PRIVATE_KEY || '',
};
