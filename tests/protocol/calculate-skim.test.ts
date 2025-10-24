/// <reference lib="deno.ns" />
import { assertEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

let supabase: SupabaseClient;

function setup() {
  supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    realtime: {
      params: {
        eventsPerSecond: 0,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function teardown() {
  // Delete in correct order to handle foreign key constraints
  await supabase.from('user_pool_balances').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('pool_deployments').delete().neq('pool_address', '');
  await supabase.from('posts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('beliefs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('agents').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Close any realtime connections to prevent resource leaks
  try {
    // @ts-ignore - removeAllChannels is internal but needed to clean up
    if (supabase.realtime) {
      supabase.realtime.disconnect();
    }
  } catch (e) {
    // Ignore errors - this is best-effort cleanup
  }
}

/**
 * Setup new user with wallet and agent
 */
async function setupNewUser() {
  const userId = crypto.randomUUID();
  const agentId = crypto.randomUUID();
  const walletAddress = `Wallet${crypto.randomUUID().slice(0, 8)}`;

  const { error: agentError } = await supabase.from('agents').insert({
    id: agentId,
    solana_address: walletAddress,
    total_stake: 0
  });
  if (agentError) throw new Error(`Failed to create agent: ${JSON.stringify(agentError)}`);

  const username = `user${crypto.randomUUID().slice(0, 6)}`;
  const { error: userError } = await supabase.from('users').insert({
    id: userId,
    agent_id: agentId,
    username,
    display_name: username
  });
  if (userError) throw new Error(`Failed to create user: ${JSON.stringify(userError)}`);

  return {
    userId,
    agentId,
    walletAddress,
    poolAddress: `Pool${crypto.randomUUID().slice(0, 8)}`
  };
}

/**
 * Set agent's total stake
 */
async function setAgentStake(walletAddress: string, stakeMicro: number) {
  await supabase
    .from('agents')
    .update({ total_stake: stakeMicro })
    .eq('solana_address', walletAddress);
}

/**
 * Create a pool deployment record
 */
async function createPool(poolAddress: string, postId: string, beliefId: string) {
  return await supabase.from('pool_deployments').insert({
    pool_address: poolAddress,
    post_id: postId,
    belief_id: beliefId,
    long_mint_address: `LONG_${crypto.randomUUID().slice(0, 8)}`,
    short_mint_address: `SHORT_${crypto.randomUUID().slice(0, 8)}`,
    status: 'market_deployed',
    sqrt_price_long_x96: '1000000000000000',
    sqrt_price_short_x96: '1000000000000000'
  });
}

/**
 * Simulate a buy trade (insert balance record)
 */
async function simulateBuy(params: {
  userId: string;
  walletAddress: string;
  poolAddress: string;
  side: 'LONG' | 'SHORT';
  amount: number;
  beliefLock: number;
}) {
  const postId = crypto.randomUUID();
  const beliefId = crypto.randomUUID();

  // Get agent ID
  const agentId = await getAgentIdByWallet(params.walletAddress);

  // Create belief first
  const { error: beliefError } = await supabase.from('beliefs').insert({
    id: beliefId,
    creator_agent_id: agentId
  });
  if (beliefError) throw new Error(`Failed to create belief: ${JSON.stringify(beliefError)}`);

  // Create post
  const { error: postError } = await supabase.from('posts').insert({
    id: postId,
    user_id: params.userId,
    belief_id: beliefId,
    article_title: 'Test post',
    content_text: 'Test content'
  });
  if (postError) throw new Error(`Failed to create post: ${JSON.stringify(postError)}`);

  // Create pool first if it doesn't exist
  const { data: existingPool } = await supabase
    .from('pool_deployments')
    .select('pool_address')
    .eq('pool_address', params.poolAddress)
    .single();

  if (!existingPool) {
    const { error: poolError } = await createPool(params.poolAddress, postId, beliefId);
    if (poolError) throw new Error(`Failed to create pool: ${JSON.stringify(poolError)}`);
  }

  const { error: balanceError } = await supabase.from('user_pool_balances').insert({
    user_id: params.userId,
    pool_address: params.poolAddress,
    post_id: postId,
    token_type: params.side,
    token_balance: params.amount / 1000,  // Simplified
    belief_lock: params.beliefLock,
    last_buy_amount: params.amount,
    total_bought: params.amount / 1000,
    total_sold: 0,
    total_usdc_spent: params.amount,
    total_usdc_received: 0
  });
  if (balanceError) throw new Error(`Failed to create balance: ${JSON.stringify(balanceError)}`);
}

/**
 * Get agent ID by wallet address
 */
async function getAgentIdByWallet(walletAddress: string): Promise<string> {
  const { data } = await supabase
    .from('agents')
    .select('id')
    .eq('solana_address', walletAddress)
    .single();
  return data!.id;
}

/**
 * Assert no error
 */
function assertNoError(error: any) {
  if (error) {
    throw new Error(`Unexpected error: ${JSON.stringify(error)}`);
  }
}

// ========== TESTS ==========

setup();
await teardown(); // Clean up any leftover data from previous runs

Deno.test("calculates skim for first buy with no prior stake", async () => {
  await teardown();
  setup();
  const { userId, walletAddress, poolAddress } = await setupNewUser();

  // First buy: $100 → lock = $2
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 100_000_000  // $100
  });

  assertNoError(error);

  // Skim should be $2 (2% of $100)
  assertEquals(data[0].skim_amount, 2_000_000);

  await teardown();
});

Deno.test("calculates skim for first buy with existing stake", async () => {
  await teardown();
  setup();
  const { userId, walletAddress, poolAddress } = await setupNewUser();

  // User already has $5 stake
  await setAgentStake(walletAddress, 5_000_000);

  // Buy $100 → lock = $2, but already have $5 stake
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 100_000_000
  });

  assertNoError(error);

  // Skim should be 0 (already have enough stake)
  assertEquals(data[0].skim_amount, 0);

  await teardown();
});

Deno.test("calculates skim for second buy in different pool", async () => {
  await teardown();
  setup();
  const { userId, walletAddress } = await setupNewUser();
  const poolAddress1 = `Pool1${crypto.randomUUID().slice(0, 6)}`;
  const poolAddress2 = `Pool2${crypto.randomUUID().slice(0, 6)}`;

  // First buy: $100 in pool1 → stake = $2, lock1 = $2
  await simulateBuy({
    userId,
    walletAddress,
    poolAddress: poolAddress1,
    side: 'LONG',
    amount: 100_000_000,
    beliefLock: 2_000_000
  });

  const agentId = await getAgentIdByWallet(walletAddress);
  await supabase.rpc('update_stake_atomic', {
    p_agent_id: agentId,
    p_delta_micro: 2_000_000
  });

  // Second buy: $200 in pool2 → needs lock2 = $4
  // Total locks after = $2 + $4 = $6
  // Current stake = $2 → skim = $4
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress2,
    p_side: 'LONG',
    p_trade_amount_micro: 200_000_000
  });

  assertNoError(error);
  assertEquals(data[0].skim_amount, 4_000_000);

  await teardown();
});

Deno.test("replaces old lock when buying more in same pool/side", async () => {
  await teardown();
  setup();
  const { userId, walletAddress, poolAddress } = await setupNewUser();

  // First buy: $100 LONG → stake = $2, lock = $2
  await simulateBuy({
    userId,
    walletAddress,
    poolAddress,
    side: 'LONG',
    amount: 100_000_000,
    beliefLock: 2_000_000
  });

  const agentId = await getAgentIdByWallet(walletAddress);
  await supabase.rpc('update_stake_atomic', {
    p_agent_id: agentId,
    p_delta_micro: 2_000_000
  });

  // Second buy: $200 LONG (same pool, same side)
  // Old lock ($2) is freed → new lock = $4
  // existingLocks = 0, newLock = $4, currentStake = $2 → skim = $2
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 200_000_000
  });

  assertNoError(error);

  // Should only skim $2 (difference), not $4 (full lock)
  assertEquals(data[0].skim_amount, 2_000_000);

  await teardown();
});

Deno.test("replaces old lock when buying less in same pool/side", async () => {
  await teardown();
  setup();
  const { userId, walletAddress, poolAddress } = await setupNewUser();

  // First buy: $500 LONG → stake = $10, lock = $10
  await simulateBuy({
    userId,
    walletAddress,
    poolAddress,
    side: 'LONG',
    amount: 500_000_000,
    beliefLock: 10_000_000
  });

  const agentId = await getAgentIdByWallet(walletAddress);
  await supabase.rpc('update_stake_atomic', {
    p_agent_id: agentId,
    p_delta_micro: 10_000_000
  });

  // Second buy: $100 LONG (smaller position)
  // Old lock ($10) freed → new lock = $2
  // existingLocks = 0, newLock = $2, currentStake = $10 → skim = 0
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 100_000_000
  });

  assertNoError(error);

  // No skim needed (reducing lock amount)
  assertEquals(data[0].skim_amount, 0);

  await teardown();
});

Deno.test("does not replace LONG lock when buying SHORT", async () => {
  await teardown();
  setup();
  const { userId, walletAddress, poolAddress } = await setupNewUser();

  // First buy: $100 LONG → stake = $2, lockLONG = $2
  await simulateBuy({
    userId,
    walletAddress,
    poolAddress,
    side: 'LONG',
    amount: 100_000_000,
    beliefLock: 2_000_000
  });

  const agentId = await getAgentIdByWallet(walletAddress);
  await supabase.rpc('update_stake_atomic', {
    p_agent_id: agentId,
    p_delta_micro: 2_000_000
  });

  // Second buy: $100 SHORT (same pool, different side)
  // LONG lock ($2) stays → new SHORT lock = $2
  // existingLocks = $2, newLock = $2, currentStake = $2 → skim = $2
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'SHORT',
    p_trade_amount_micro: 100_000_000
  });

  assertNoError(error);

  // Should skim full $2 (not replacing LONG lock)
  assertEquals(data[0].skim_amount, 2_000_000);

  await teardown();
});

Deno.test("replaces SHORT lock when buying SHORT again", async () => {
  await teardown();
  setup();
  const { userId, walletAddress, poolAddress } = await setupNewUser();

  // First buy: $100 LONG, $100 SHORT → stake = $4, locks = $2 + $2
  await simulateBuy({
    userId, walletAddress, poolAddress,
    side: 'LONG', amount: 100_000_000, beliefLock: 2_000_000
  });
  await simulateBuy({
    userId, walletAddress, poolAddress,
    side: 'SHORT', amount: 100_000_000, beliefLock: 2_000_000
  });

  const agentId = await getAgentIdByWallet(walletAddress);
  await supabase.rpc('update_stake_atomic', {
    p_agent_id: agentId,
    p_delta_micro: 4_000_000
  });

  // Third buy: $200 SHORT (replaces SHORT lock)
  // LONG lock ($2) stays, SHORT lock ($2) freed, new SHORT lock = $4
  // existingLocks = $2, newLock = $4, currentStake = $4 → skim = $2
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'SHORT',
    p_trade_amount_micro: 200_000_000
  });

  assertNoError(error);
  assertEquals(data[0].skim_amount, 2_000_000);

  await teardown();
});

Deno.test("handles micro-USDC precision correctly", async () => {
  await teardown();
  setup();
  const { userId, walletAddress, poolAddress } = await setupNewUser();

  // Buy $0.50 → lock = $0.01 = 10,000 μUSDC
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 500_000  // $0.50
  });

  assertNoError(error);

  // 2% of 500,000 = 10,000
  assertEquals(data[0].skim_amount, 10_000);

  await teardown();
});

Deno.test("applies FLOOR to lock calculation", async () => {
  await teardown();
  setup();
  const { userId, walletAddress, poolAddress } = await setupNewUser();

  // Buy $0.51 → lock = FLOOR(510,000 × 0.02) = FLOOR(10,200) = 10,200
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 510_000
  });

  assertNoError(error);
  assertEquals(data[0].skim_amount, 10_200);

  await teardown();
});

Deno.test("returns zero skim when trade amount is zero", async () => {
  await teardown();
  setup();
  const { userId, walletAddress, poolAddress } = await setupNewUser();

  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 0
  });

  assertNoError(error);
  assertEquals(data[0].skim_amount, 0);

  await teardown();
});

Deno.test("never returns negative skim (GREATEST ensures non-negative)", async () => {
  await teardown();
  setup();
  const { userId, walletAddress, poolAddress } = await setupNewUser();

  // User has excess stake
  await setAgentStake(walletAddress, 1_000_000_000);  // $1000

  // Buy $1 → lock = $0.02
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: poolAddress,
    p_side: 'LONG',
    p_trade_amount_micro: 1_000_000
  });

  assertNoError(error);

  // Should be 0, not negative
  assertEquals(data[0].skim_amount, 0);
  assert(data[0].skim_amount >= 0);

  await teardown();
});

Deno.test("calculates skim when user is underwater", async () => {
  await teardown();
  setup();
  const { userId, walletAddress } = await setupNewUser();
  const poolAddress = `Pool${crypto.randomUUID().slice(0, 8)}`;

  // User had $30 stake, $20 lock, then lost $10 in BTS
  // Now: stake = $20, lock = $20 (underwater: withdrawable = 0)
  await setAgentStake(walletAddress, 20_000_000);
  await simulateBuy({
    userId, walletAddress, poolAddress,
    side: 'LONG', amount: 1_000_000_000, beliefLock: 20_000_000
  });

  // New buy: $100 in different pool → lock = $2
  // existingLocks = $20, newLock = $2, currentStake = $20 → skim = $2
  const { data, error } = await supabase.rpc('calculate_skim_with_lock', {
    p_user_id: userId,
    p_wallet_address: walletAddress,
    p_pool_address: 'PoolB',
    p_side: 'LONG',
    p_trade_amount_micro: 100_000_000
  });

  assertNoError(error);
  assertEquals(data[0].skim_amount, 2_000_000);

  await teardown();
});

console.log("✅ All calculate-skim tests completed");
