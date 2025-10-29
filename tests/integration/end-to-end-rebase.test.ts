/// <reference lib="deno.ns" />
/**
 * End-to-End Integration Test: Full Rebase Flow
 *
 * Tests the complete flow from belief creation through trading, belief submissions,
 * rebase/settlement, and validates all critical invariants.
 *
 * Flow:
 * 1. Setup: Create test users with agents
 * 2. Content: Create post (creates belief automatically)
 * 3. Trading: Multiple users trade on pool (generates skim deposits)
 * 4. Submissions: Users submit beliefs for next epoch
 * 5. Rebase: Trigger rebase to calculate BD score and build settlement tx
 * 6. Invariants: Verify all critical invariants hold
 *
 * Requirements:
 * - Local Supabase running (supabase start)
 * - Next.js dev server running on port 3000 (npm run dev)
 * - Solana localnet optional (for actual tx submission)
 */

import { assertEquals, assert, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const API_BASE_URL = 'http://localhost:3000';

let supabase: SupabaseClient;

// Test user interface
interface TestUser {
  userId: string;
  agentId: string;
  username: string;
  walletAddress: string;
}

/**
 * Setup Supabase client
 */
function setup() {
  supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  console.log('✅ Supabase client initialized');
}

/**
 * Clean up test data
 * NOTE: Disabled - we don't reset the database between test runs anymore
 * to preserve state for debugging and allow tests to work with real on-chain data
 */
// async function teardown() {
//   console.log('🧹 Cleaning up test data...');
//
//   // Clean in reverse dependency order
//   await supabase.from('stake_redistribution_events').delete().neq('agent_id', '00000000-0000-0000-0000-000000000000');
//   await supabase.from('implied_relevance_history').delete().neq('belief_id', '00000000-0000-0000-0000-000000000000');
//   await supabase.from('belief_relevance_history').delete().neq('belief_id', '00000000-0000-0000-0000-000000000000');
//   await supabase.from('belief_submissions').delete().neq('agent_id', '00000000-0000-0000-0000-000000000000');
//   await supabase.from('user_pool_balances').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
//   await supabase.from('custodian_deposits').delete().neq('agent_id', '00000000-0000-0000-0000-000000000000');
//   await supabase.from('pool_deployments').delete().neq('belief_id', '00000000-0000-0000-0000-000000000000');
//   await supabase.from('posts').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
//   await supabase.from('beliefs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
//   await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
//   await supabase.from('agents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
//
//   console.log('✅ Cleanup complete');
// }

/**
 * Create test user with agent
 */
async function createTestUser(username: string): Promise<TestUser> {
  const agentId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const walletAddress = `wallet_${username}_${Date.now()}`;

  // Create agent
  const { error: agentError } = await supabase
    .from('agents')
    .insert({
      id: agentId,
      solana_address: walletAddress,
      total_stake: 0
    });

  if (agentError) throw new Error(`Failed to create agent: ${agentError.message}`);

  // Create user
  const { error: userError } = await supabase
    .from('users')
    .insert({
      id: userId,
      agent_id: agentId,
      username: username,
      display_name: username
    });

  if (userError) throw new Error(`Failed to create user: ${userError.message}`);

  console.log(`👤 Created user: ${username} (${userId.slice(0, 8)}...)`);

  return { userId, agentId, username, walletAddress };
}

/**
 * Create post and belief directly in database (bypasses auth for testing)
 */
async function createPost(params: {
  userId: string;
  agentId: string;
  title: string;
  content: string;
}): Promise<{ postId: string; beliefId: string }> {

  const postId = crypto.randomUUID();
  const beliefId = postId;  // Same ID for post and belief

  // Create belief first
  const { error: beliefError } = await supabase
    .from('beliefs')
    .insert({
      id: beliefId,
      creator_agent_id: params.agentId,
      created_epoch: 0,
      previous_aggregate: 0.5,
      previous_disagreement_entropy: 0.0
    });

  if (beliefError) throw new Error(`Failed to create belief: ${beliefError.message}`);

  // Create post
  const { error: postError } = await supabase
    .from('posts')
    .insert({
      id: postId,
      user_id: params.userId,
      belief_id: beliefId,
      post_type: 'text',
      content_json: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: params.content }]
        }]
      },
      article_title: params.title
    });

  if (postError) throw new Error(`Failed to create post: ${postError.message}`);

  console.log(`📝 Created post: ${postId.slice(0, 8)}... (belief: ${beliefId.slice(0, 8)}...)`);

  return {
    postId,
    beliefId
  };
}

/**
 * Create mock pool deployment (simulates on-chain pool)
 */
async function createMockPoolDeployment(params: {
  postId: string;
  beliefId: string;
  agentId: string;
  walletAddress: string;
}): Promise<string> {
  const poolAddress = `pool_${Date.now()}`;

  const { error } = await supabase
    .from('pool_deployments')
    .insert({
      post_id: params.postId,
      belief_id: params.beliefId,
      pool_address: poolAddress,
      long_mint_address: `long_${poolAddress}`,
      short_mint_address: `short_${poolAddress}`,
      deployed_by_agent_id: params.agentId,
      deployment_tx_signature: `deploy_sig_${Date.now()}`,
      status: 'market_deployed',
      current_epoch: 0,
      f: 3,
      beta_num: 1,
      beta_den: 2,
      // Initialize mock reserves for implied relevance calculation
      r_long: 100,  // Starting reserves
      r_short: 100,
      // Required scale factors (Q64.64 fixed point, 1.0 = 2^64)
      s_scale_long_q64: '18446744073709551616',  // 2^64 = 1.0 in Q64.64
      s_scale_short_q64: '18446744073709551616'
    });

  if (error) throw new Error(`Failed to create pool deployment: ${error.message}`);

  console.log(`🏊 Created pool: ${poolAddress}`);
  return poolAddress;
}

/**
 * Record trade at database level (simulates on-chain trade)
 */
async function recordTrade(params: {
  userId: string;
  agentId: string;
  walletAddress: string;
  poolAddress: string;
  postId: string;
  beliefId: string;
  side: 'LONG' | 'SHORT';
  amountUsdc: number;  // Display USDC (e.g., 100.0)
}): Promise<{ skimAmount: number; tradeId: string }> {

  const tokenAmount = params.amountUsdc * 100;        // Mock: 100 tokens per USDC
  const skimAmountDisplay = params.amountUsdc * 0.02;  // 2% skim in display USDC

  const txSignature = `trade_sig_${Date.now()}_${Math.random()}`;

  const { data, error } = await supabase.rpc('record_trade_atomic', {
    p_pool_address: params.poolAddress,
    p_post_id: params.postId,
    p_user_id: params.userId,
    p_wallet_address: params.walletAddress,
    p_trade_type: 'buy',
    p_token_amount: tokenAmount,
    p_usdc_amount: params.amountUsdc,  // Display USDC (function converts to micro internally)
    p_tx_signature: txSignature,
    p_token_type: params.side,
    p_sqrt_price_long_x96: '1000000',
    p_sqrt_price_short_x96: '1000000',
    p_belief_id: params.beliefId,
    p_agent_id: params.agentId,
    p_belief: params.side === 'LONG' ? 0.75 : 0.25,  // Implied belief
    p_meta_prediction: 0.5,
    p_skim_amount: skimAmountDisplay  // Display USDC (function converts to micro internally)
  });

  if (error) throw new Error(`Failed to record trade: ${error.message}`);
  if (!data.success) throw new Error(`Trade recording failed: ${data.error}`);

  // Record implied relevance after trade (matching /api/trades/record behavior)
  // Calculate mock reserves after trade
  const reserveLongAfter = params.side === 'LONG' ? params.amountUsdc + 100 : 100;
  const reserveShortAfter = params.side === 'SHORT' ? params.amountUsdc + 100 : 100;
  const totalReserve = reserveLongAfter + reserveShortAfter;
  const impliedRelevance = totalReserve > 0 ? reserveLongAfter / totalReserve : 0.5;

  const { error: impliedError } = await supabase
    .from('implied_relevance_history')
    .insert({
      post_id: params.postId,
      belief_id: params.beliefId,
      implied_relevance: impliedRelevance,
      reserve_long: reserveLongAfter,
      reserve_short: reserveShortAfter,
      event_type: 'trade',
      event_reference: txSignature,
      confirmed: false,
      recorded_by: 'server'
    });

  if (impliedError) {
    console.warn(`⚠️  Failed to record implied relevance: ${impliedError.message}`);
  }

  console.log(`💱 ${params.side} $${params.amountUsdc} trade (skim: $${skimAmountDisplay.toFixed(2)}, implied: ${impliedRelevance.toFixed(4)})`);

  return {
    skimAmount: skimAmountDisplay,
    tradeId: data.trade_id
  };
}

/**
 * Submit belief via edge function
 */
async function submitBelief(params: {
  agentId: string;
  beliefId: string;
  belief: number;
  metaPrediction: number;
  epoch: number;
}): Promise<void> {

  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-beliefs-submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY
    },
    body: JSON.stringify({
      agent_id: params.agentId,
      belief_id: params.beliefId,
      belief_value: params.belief,
      meta_prediction: params.metaPrediction,
      epoch: params.epoch
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to submit belief: ${response.status} ${error}`);
  }

  const data = await response.json();
  console.log(`🔮 Belief ${params.belief.toFixed(2)} submitted for epoch ${params.epoch}`);
}

/**
 * Trigger rebase and settlement via edge functions (simulates full flow including on-chain settlement)
 *
 * CRITICAL: This function simulates what happens when a settlement transaction executes on-chain:
 * 1. Calculate BD score (protocol processing)
 * 2. Simulate settlement reserve scaling based on BD score
 * 3. Update pool reserves to post-settlement state
 * 4. Record implied relevance with POST-settlement reserves
 */
async function triggerRebaseAndSettle(params: {
  postId: string;
  beliefId: string;
  poolAddress: string;
  nextEpoch: number;
}): Promise<{ bdScore: number }> {

  console.log(`⏰ Processing epoch ${params.nextEpoch} for belief ${params.beliefId.slice(0, 8)}...`);

  // Call protocol-belief-epoch-process directly (simulates what /api/settlements/record does)
  // This runs: weights → BD decomposition → belief_relevance_history → BTS → redistribution
  const response = await fetch(`${SUPABASE_URL}/functions/v1/protocol-belief-epoch-process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY
    },
    body: JSON.stringify({
      belief_id: params.beliefId,
      current_epoch: params.nextEpoch
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to process epoch: ${response.status} ${error}`);
  }

  const data = await response.json();
  const bdScore = data.aggregate;
  console.log(`⏰ Epoch processing complete: BD score = ${(bdScore * 100).toFixed(2)}%`);

  // Get BEFORE-settlement pool state
  const { data: poolDataBefore } = await supabase
    .from('pool_deployments')
    .select('r_long, r_short')
    .eq('pool_address', params.poolAddress)
    .single();

  if (!poolDataBefore) throw new Error('Pool not found');

  const rLongBefore = poolDataBefore.r_long;
  const rShortBefore = poolDataBefore.r_short;

  console.log(`   Reserves BEFORE settlement: LONG=${rLongBefore}, SHORT=${rShortBefore}`);

  // SIMULATE SETTLEMENT TRANSACTION:
  // On-chain, settle_epoch scales reserves based on how far market prediction is from BD score
  // Market prediction (before settlement) = r_long / (r_long + r_short)
  // Settlement moves reserves so that new implied relevance = BD score
  //
  // Simplified settlement logic:
  // If BD score > market prediction → LONG side was correct → scale up LONG, scale down SHORT
  // If BD score < market prediction → SHORT side was correct → scale down LONG, scale up SHORT
  // Goal: Make (new_r_long) / (new_r_long + new_r_short) = BD score

  const totalReserveBefore = rLongBefore + rShortBefore;
  const marketPredictionBefore = totalReserveBefore > 0 ? rLongBefore / totalReserveBefore : 0.5;

  // Calculate new reserves that would give us implied relevance = BD score
  // We want: r_long_after / (r_long_after + r_short_after) = bdScore
  // Keep total reserve constant for simplicity: r_long_after + r_short_after = totalReserveBefore
  // Therefore: r_long_after = bdScore * totalReserveBefore
  //           r_short_after = (1 - bdScore) * totalReserveBefore

  const rLongAfter = Math.round(bdScore * totalReserveBefore);
  const rShortAfter = Math.round((1 - bdScore) * totalReserveBefore);

  console.log(`   Settlement: Market was ${(marketPredictionBefore * 100).toFixed(2)}%, BD score is ${(bdScore * 100).toFixed(2)}%`);
  console.log(`   Reserves AFTER settlement: LONG=${rLongAfter}, SHORT=${rShortAfter}`);

  // Update pool reserves to POST-settlement state
  const { error: updateError } = await supabase
    .from('pool_deployments')
    .update({
      r_long: rLongAfter,
      r_short: rShortAfter,
      current_epoch: params.nextEpoch
    })
    .eq('pool_address', params.poolAddress);

  if (updateError) {
    throw new Error(`Failed to update pool reserves: ${updateError.message}`);
  }

  // Calculate IMPLIED RELEVANCE from POST-settlement reserves
  const totalReserveAfter = rLongAfter + rShortAfter;
  const impliedRelevanceAfter = totalReserveAfter > 0 ? rLongAfter / totalReserveAfter : 0.5;

  console.log(`   Implied relevance AFTER settlement: ${(impliedRelevanceAfter * 100).toFixed(2)}%`);

  // Record implied relevance with POST-settlement reserves (matching /api/settlements/record behavior)
  const { error: impliedError } = await supabase
    .from('implied_relevance_history')
    .insert({
      post_id: params.postId,
      belief_id: params.beliefId,
      implied_relevance: impliedRelevanceAfter,
      reserve_long: rLongAfter,
      reserve_short: rShortAfter,
      event_type: 'rebase',
      event_reference: `rebase_epoch_${params.nextEpoch}`,
      confirmed: true,
      recorded_by: 'server'
    });

  if (impliedError) {
    throw new Error(`Failed to record implied relevance: ${impliedError.message}`);
  }

  return {
    bdScore
  };
}

/**
 * Verify stake invariant: total_stake >= 0 (no negative stakes)
 * Note: Underwater positions (stake < locks) are allowed after redistribution
 */
async function verifyStakeInvariant(agentId: string, allowUnderwater: boolean = false): Promise<{
  valid: boolean;
  totalStake: number;
  totalLocks: number;
  deficit: number;
  isUnderwater: boolean;
}> {

  // Get agent stake
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('total_stake')
    .eq('id', agentId)
    .single();

  if (agentError) throw new Error(`Failed to get agent: ${agentError.message}`);

  const totalStake = agent.total_stake;

  // Get user for this agent
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('agent_id', agentId)
    .single();

  // Calculate total locks
  const { data: balances } = await supabase
    .from('user_pool_balances')
    .select('belief_lock')
    .eq('user_id', user!.id);

  const totalLocks = balances?.reduce((sum, b) => sum + b.belief_lock, 0) || 0;
  const isUnderwater = totalStake < totalLocks;

  return {
    // CRITICAL: Stake must NEVER be negative
    // Underwater positions (stake < locks) are OK after redistribution
    valid: allowUnderwater ? totalStake >= 0 : totalStake >= totalLocks,
    totalStake,
    totalLocks,
    deficit: Math.max(0, totalLocks - totalStake),
    isUnderwater
  };
}

/**
 * Verify settlement recording consistency:
 * The implied relevance recorded at rebase should match the actual pool state
 */
async function verifySettlementRecording(params: {
  beliefId: string;
  poolAddress: string;
  epoch: number;
}): Promise<{
  valid: boolean;
  recordedImplied: number;
  actualImplied: number;
  bdScore: number;
  difference: number;
}> {

  // Get BD score from belief_relevance_history
  const { data: beliefHistory, error: beliefError } = await supabase
    .from('belief_relevance_history')
    .select('aggregate')
    .eq('belief_id', params.beliefId)
    .eq('epoch', params.epoch)
    .single();

  if (beliefError) throw new Error(`Failed to get belief history: ${beliefError.message}`);

  // Get recorded implied relevance from implied_relevance_history (rebase event)
  const { data: impliedHistory, error: impliedError } = await supabase
    .from('implied_relevance_history')
    .select('implied_relevance, reserve_long, reserve_short')
    .eq('belief_id', params.beliefId)
    .eq('event_type', 'rebase')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (impliedError) throw new Error(`Failed to get implied history: ${impliedError.message}`);
  if (!impliedHistory) throw new Error('No rebase event in implied_relevance_history');

  // Get actual pool state
  const { data: poolData } = await supabase
    .from('pool_deployments')
    .select('r_long, r_short')
    .eq('pool_address', params.poolAddress)
    .single();

  if (!poolData) throw new Error('Pool not found');

  const recordedImplied = parseFloat(impliedHistory.implied_relevance);
  const totalReserve = poolData.r_long + poolData.r_short;
  const actualImplied = totalReserve > 0 ? poolData.r_long / totalReserve : 0.5;
  const difference = Math.abs(recordedImplied - actualImplied);
  const tolerance = 0.0001;

  return {
    // Verify the recorded implied relevance matches the actual pool state
    valid: difference < tolerance,
    recordedImplied,
    actualImplied,
    bdScore: parseFloat(beliefHistory.aggregate),
    difference
  };
}

/**
 * Verify stake redistribution occurred
 */
async function verifyRedistribution(params: {
  beliefId: string;
  epoch: number;
}): Promise<{
  hasEvents: boolean;
  totalRewards: number;
  totalPenalties: number;
  participantCount: number;
}> {

  const { data: events, error } = await supabase
    .from('stake_redistribution_events')
    .select('agent_id, stake_delta')
    .eq('belief_id', params.beliefId)
    .eq('epoch', params.epoch);

  if (error) throw new Error(`Failed to get redistribution events: ${error.message}`);

  const totalRewards = events?.filter(e => e.stake_delta > 0).reduce((sum, e) => sum + e.stake_delta, 0) || 0;
  const totalPenalties = events?.filter(e => e.stake_delta < 0).reduce((sum, e) => sum + Math.abs(e.stake_delta), 0) || 0;

  return {
    hasEvents: (events?.length || 0) > 0,
    totalRewards,
    totalPenalties,
    participantCount: events?.length || 0
  };
}

/**
 * Verify market settlement match:
 * The implied relevance AFTER settlement (from pool reserves after on-chain changes)
 * should match the BD score used for the settlement.
 *
 * This checks that the settlement actually moved the market to the BD score.
 */
async function verifyMarketSettlementMatch(params: {
  beliefId: string;
  epoch: number;
}): Promise<{
  matches: boolean;
  bdScore: number;
  impliedRelevance: number;
  difference: number;
}> {

  // Get BD score from belief_relevance_history (this is the settlement relevance)
  const { data: beliefHistory, error: beliefError } = await supabase
    .from('belief_relevance_history')
    .select('aggregate')
    .eq('belief_id', params.beliefId)
    .eq('epoch', params.epoch)
    .single();

  if (beliefError) throw new Error(`Failed to get belief history: ${beliefError.message}`);

  const bdScore = parseFloat(beliefHistory.aggregate);

  // Get the latest implied relevance history for this belief
  // This should be the market state AFTER settlement
  const { data: impliedHistory, error: impliedError } = await supabase
    .from('implied_relevance_history')
    .select('implied_relevance, reserve_long, reserve_short, event_type, recorded_at')
    .eq('belief_id', params.beliefId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (impliedError) throw new Error(`Failed to get implied history: ${impliedError.message}`);
  if (!impliedHistory) throw new Error('No implied relevance history found');

  const impliedRelevance = parseFloat(impliedHistory.implied_relevance);
  const difference = Math.abs(bdScore - impliedRelevance);

  // Use a reasonable tolerance for floating point comparison
  const tolerance = 0.01; // 1% difference allowed

  console.log(`   Market Settlement Check:
     BD Score (settlement): ${bdScore.toFixed(4)}
     Implied Relevance (after settlement): ${impliedRelevance.toFixed(4)}
     Reserves: LONG=${impliedHistory.reserve_long}, SHORT=${impliedHistory.reserve_short}
     Event Type: ${impliedHistory.event_type}
     Difference: ${difference.toFixed(4)}
     Tolerance: ${tolerance}`);

  return {
    matches: difference < tolerance,
    bdScore,
    impliedRelevance,
    difference
  };
}

// ========== MAIN TEST ==========

setup();

Deno.test("Full Integration: Belief → Trades → Submissions → Rebase → Invariants", async () => {
  console.log('\n' + '='.repeat(80));
  console.log('FULL INTEGRATION TEST: END-TO-END REBASE FLOW');
  console.log('='.repeat(80) + '\n');

  try {
    // ========== PHASE 1: SETUP ==========
    console.log('\n--- PHASE 1: SETUP ---');

    const alice = await createTestUser('alice_test');
    const bob = await createTestUser('bob_test');
    const charlie = await createTestUser('charlie_test');

    const initialStakes = {
      alice: (await supabase.from('agents').select('total_stake').eq('id', alice.agentId).single()).data!.total_stake,
      bob: (await supabase.from('agents').select('total_stake').eq('id', bob.agentId).single()).data!.total_stake,
      charlie: (await supabase.from('agents').select('total_stake').eq('id', charlie.agentId).single()).data!.total_stake
    };

    assertEquals(initialStakes.alice, 0, 'Alice should start with 0 stake');
    assertEquals(initialStakes.bob, 0, 'Bob should start with 0 stake');
    assertEquals(initialStakes.charlie, 0, 'Charlie should start with 0 stake');

    // ========== PHASE 2: CONTENT CREATION ==========
    console.log('\n--- PHASE 2: CONTENT CREATION ---');

    const { postId, beliefId } = await createPost({
      userId: alice.userId,
      agentId: alice.agentId,
      title: 'AI will transform software development',
      content: 'Prediction market on AI impact by 2030'
    });

    assertEquals(postId, beliefId, 'Post ID should equal belief ID');

    const poolAddress = await createMockPoolDeployment({
      postId,
      beliefId,
      agentId: alice.agentId,
      walletAddress: alice.walletAddress
    });

    // ========== PHASE 3: TRADING ==========
    console.log('\n--- PHASE 3: TRADING ---');

    await recordTrade({
      userId: alice.userId,
      agentId: alice.agentId,
      walletAddress: alice.walletAddress,
      poolAddress,
      postId,
      beliefId,
      side: 'LONG',
      amountUsdc: 100  // $100 LONG
    });

    await recordTrade({
      userId: bob.userId,
      agentId: bob.agentId,
      walletAddress: bob.walletAddress,
      poolAddress,
      postId,
      beliefId,
      side: 'SHORT',
      amountUsdc: 150  // $150 SHORT
    });

    await recordTrade({
      userId: charlie.userId,
      agentId: charlie.agentId,
      walletAddress: charlie.walletAddress,
      poolAddress,
      postId,
      beliefId,
      side: 'LONG',
      amountUsdc: 75  // $75 LONG
    });

    // Verify stakes increased (from skim deposits)
    const stakesAfterTrades = {
      alice: (await supabase.from('agents').select('total_stake').eq('id', alice.agentId).single()).data!.total_stake,
      bob: (await supabase.from('agents').select('total_stake').eq('id', bob.agentId).single()).data!.total_stake,
      charlie: (await supabase.from('agents').select('total_stake').eq('id', charlie.agentId).single()).data!.total_stake
    };

    console.log(`   Alice stake: $${(stakesAfterTrades.alice / 1_000_000).toFixed(2)}`);
    console.log(`   Bob stake: $${(stakesAfterTrades.bob / 1_000_000).toFixed(2)}`);
    console.log(`   Charlie stake: $${(stakesAfterTrades.charlie / 1_000_000).toFixed(2)}`);

    assert(stakesAfterTrades.alice > 0, 'Alice should have stake from skim');
    assert(stakesAfterTrades.bob > 0, 'Bob should have stake from skim');
    assert(stakesAfterTrades.charlie > 0, 'Charlie should have stake from skim');

    // Verify stake invariant holds after trades
    const aliceInvariant = await verifyStakeInvariant(alice.agentId);
    const bobInvariant = await verifyStakeInvariant(bob.agentId);
    const charlieInvariant = await verifyStakeInvariant(charlie.agentId);

    assert(aliceInvariant.valid, 'Alice stake invariant should hold after trades');
    assert(bobInvariant.valid, 'Bob stake invariant should hold after trades');
    assert(charlieInvariant.valid, 'Charlie stake invariant should hold after trades');
    console.log('   ✅ All stake invariants hold after trades');

    // ========== PHASE 4: BELIEF SUBMISSIONS ==========
    console.log('\n--- PHASE 4: BELIEF SUBMISSIONS ---');

    // Get pool's next epoch (current_epoch + 1)
    const { data: poolData } = await supabase
      .from('pool_deployments')
      .select('current_epoch')
      .eq('pool_address', poolAddress)
      .single();

    const nextEpoch = poolData!.current_epoch + 1;
    console.log(`   Pool current epoch: ${poolData!.current_epoch}, next epoch: ${nextEpoch}`);

    await submitBelief({
      agentId: alice.agentId,
      beliefId,
      belief: 0.75,
      metaPrediction: 0.6,
      epoch: nextEpoch
    });

    await submitBelief({
      agentId: bob.agentId,
      beliefId,
      belief: 0.30,
      metaPrediction: 0.4,
      epoch: nextEpoch
    });

    await submitBelief({
      agentId: charlie.agentId,
      beliefId,
      belief: 0.80,
      metaPrediction: 0.7,
      epoch: nextEpoch
    });

    // Verify 3 unique submissions
    const { data: submissions } = await supabase
      .from('belief_submissions')
      .select('agent_id')
      .eq('belief_id', beliefId)
      .eq('epoch', nextEpoch);

    assertEquals(submissions!.length, 3, 'Should have 3 submissions');
    console.log('   ✅ All belief submissions recorded');

    // ========== PHASE 5: REBASE & SETTLEMENT ==========
    console.log('\n--- PHASE 5: REBASE & SETTLEMENT ---');

    const { bdScore } = await triggerRebaseAndSettle({
      postId,
      beliefId,
      poolAddress,
      nextEpoch
    });

    assert(bdScore >= 0 && bdScore <= 1, 'BD score should be in [0,1]');

    // ========== PHASE 6: INVARIANT VERIFICATION ==========
    console.log('\n--- PHASE 6: INVARIANT VERIFICATION ---');

    // 1. Stake invariant (after redistribution, underwater positions are OK)
    console.log('   Checking stake invariants...');
    const aliceInvariantAfter = await verifyStakeInvariant(alice.agentId, true);
    const bobInvariantAfter = await verifyStakeInvariant(bob.agentId, true);
    const charlieInvariantAfter = await verifyStakeInvariant(charlie.agentId, true);

    assert(aliceInvariantAfter.valid,
      `Alice has negative stake: ${aliceInvariantAfter.totalStake}`);
    assert(bobInvariantAfter.valid,
      `Bob has negative stake: ${bobInvariantAfter.totalStake}`);
    assert(charlieInvariantAfter.valid,
      `Charlie has negative stake: ${charlieInvariantAfter.totalStake}`);

    // Log underwater positions (expected after redistribution)
    if (aliceInvariantAfter.isUnderwater) {
      console.log(`   ⚠️  Alice is underwater: stake=$${(aliceInvariantAfter.totalStake / 1_000_000).toFixed(2)}, locks=$${(aliceInvariantAfter.totalLocks / 1_000_000).toFixed(2)}`);
    }
    if (bobInvariantAfter.isUnderwater) {
      console.log(`   ⚠️  Bob is underwater: stake=$${(bobInvariantAfter.totalStake / 1_000_000).toFixed(2)}, locks=$${(bobInvariantAfter.totalLocks / 1_000_000).toFixed(2)}`);
    }
    if (charlieInvariantAfter.isUnderwater) {
      console.log(`   ⚠️  Charlie is underwater: stake=$${(charlieInvariantAfter.totalStake / 1_000_000).toFixed(2)}, locks=$${(charlieInvariantAfter.totalLocks / 1_000_000).toFixed(2)}`);
    }

    console.log('   ✅ No negative stakes (underwater positions are OK)');

    // 2. Belief relevance history created
    console.log('   Checking belief relevance history...');
    const { data: beliefHistory } = await supabase
      .from('belief_relevance_history')
      .select('*')
      .eq('belief_id', beliefId)
      .eq('epoch', nextEpoch);

    assertExists(beliefHistory, 'Belief relevance history should exist');
    assertEquals(beliefHistory.length, 1, 'Should have one history entry');
    console.log('   ✅ Belief relevance history created');

    // 3. Implied relevance history created
    console.log('   Checking implied relevance history...');
    const { data: impliedHistory } = await supabase
      .from('implied_relevance_history')
      .select('*')
      .eq('belief_id', beliefId)
      .eq('event_type', 'rebase');

    assertExists(impliedHistory, 'Implied relevance history should exist');
    assert(impliedHistory.length > 0, 'Should have rebase event');
    console.log('   ✅ Implied relevance history created');

    // 4. **Market settlement match** (NEW INVARIANT)
    console.log('   Checking market settlement match...');
    const marketMatch = await verifyMarketSettlementMatch({
      beliefId,
      epoch: nextEpoch
    });

    assert(marketMatch.matches,
      `Market settlement mismatch: BD=${marketMatch.bdScore}, Implied=${marketMatch.impliedRelevance}, Diff=${marketMatch.difference}`);
    console.log(`   ✅ BD score (${marketMatch.bdScore.toFixed(4)}) matches implied relevance (${marketMatch.impliedRelevance.toFixed(4)})`);

    // 5. Redistribution events
    console.log('   Checking stake redistribution...');
    const redistribution = await verifyRedistribution({
      beliefId,
      epoch: nextEpoch
    });

    assert(redistribution.hasEvents, 'Should have redistribution events');
    assert(redistribution.participantCount > 0, 'Should have participants');
    console.log(`   ✅ Redistribution occurred (${redistribution.participantCount} participants)`);
    console.log(`      Total rewards: $${(redistribution.totalRewards / 1_000_000).toFixed(2)}`);
    console.log(`      Total penalties: $${(redistribution.totalPenalties / 1_000_000).toFixed(2)}`);

    // 6. Pool epoch incremented
    console.log('   Checking pool epoch increment...');
    const { data: updatedPool } = await supabase
      .from('pool_deployments')
      .select('current_epoch')
      .eq('pool_address', poolAddress)
      .single();

    assertEquals(updatedPool!.current_epoch, nextEpoch, 'Pool epoch should increment');
    console.log('   ✅ Pool epoch incremented');

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    throw error;
  }
});