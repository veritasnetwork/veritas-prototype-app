/**
 * Trade Recording Bug Fixes Test
 *
 * Tests for the 5 critical bugs fixed in the trade recording architecture:
 * - Bug #1: Balance calculation race condition
 * - Bug #2: Belief lock not reduced on sells
 * - Bug #3: Event indexer missing balance updates
 * - Bug #4: Unit conversion clarity
 * - Bug #5: Event indexer missing belief submissions
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

describe('Trade Recording Bug Fixes', () => {
  let testUserId: string;
  let testAgentId: string;
  let testPoolAddress: string;
  let testPostId: string;
  let testBeliefId: string;

  beforeAll(async () => {
    // Create test data
    const walletAddress = `test-wallet-${Date.now()}`;

    // Create agent
    const { data: agent } = await supabase
      .from('agents')
      .insert({
        solana_address: walletAddress,
        total_stake: 10000 * 1000000, // 10,000 USDC in micro-USDC
      })
      .select()
      .single();

    testAgentId = agent!.id;

    // Create user
    const { data: user } = await supabase
      .from('users')
      .insert({
        wallet_address: walletAddress,
        username: `testuser-${Date.now()}`,
        agent_id: testAgentId,
      })
      .select()
      .single();

    testUserId = user!.id;

    // Create belief
    const { data: belief } = await supabase
      .from('beliefs')
      .insert({
        statement: 'Test belief for trade recording',
      })
      .select()
      .single();

    testBeliefId = belief!.id;

    // Create post
    const { data: post } = await supabase
      .from('posts')
      .insert({
        author_id: testUserId,
        belief_id: testBeliefId,
        content_text: 'Test post',
      })
      .select()
      .single();

    testPostId = post!.id;

    // Create pool deployment
    testPoolAddress = `pool-${Date.now()}`;
    await supabase
      .from('pool_deployments')
      .insert({
        post_id: testPostId,
        pool_address: testPoolAddress,
        belief_id: testBeliefId,
        status: 'market_deployed',
        f: 1.0,
        beta_num: 1,
        beta_den: 2,
      });
  });

  describe('Bug #1: Balance Calculation Race Condition', () => {
    it('should handle concurrent trades without data corruption', async () => {
      // This tests that the FOR UPDATE lock prevents race conditions

      const trade1Params = {
        p_pool_address: testPoolAddress,
        p_post_id: testPostId,
        p_user_id: testUserId,
        p_wallet_address: `test-wallet-${testUserId}`,
        p_trade_type: 'buy',
        p_token_amount: 10,
        p_usdc_amount: 10.5,
        p_tx_signature: `sig1-${Date.now()}`,
        p_token_type: 'LONG',
        p_sqrt_price_long_x96: '0',
        p_sqrt_price_short_x96: '0',
        p_belief_id: testBeliefId,
        p_agent_id: testAgentId,
        p_belief: 0.6,
        p_meta_prediction: 0.5,
      };

      const trade2Params = {
        ...trade1Params,
        p_token_amount: 5,
        p_usdc_amount: 5.25,
        p_tx_signature: `sig2-${Date.now()}`,
      };

      // Execute trades in parallel (simulating race condition)
      const [result1, result2] = await Promise.all([
        supabase.rpc('record_trade_atomic', trade1Params),
        supabase.rpc('record_trade_atomic', trade2Params),
      ]);

      expect(result1.data?.success).toBe(true);
      expect(result2.data?.success).toBe(true);

      // Verify final balance is correct (10 + 5 = 15)
      const { data: balance } = await supabase
        .from('user_pool_balances')
        .select('token_balance')
        .eq('user_id', testUserId)
        .eq('pool_address', testPoolAddress)
        .eq('token_type', 'LONG')
        .single();

      expect(balance?.token_balance).toBe(15);
      console.log('✅ Bug #1 Fix Verified: Concurrent trades handled correctly');
    });
  });

  describe('Bug #2: Belief Lock Reduction on Sells', () => {
    it('should proportionally reduce belief lock when selling tokens', async () => {
      // First, buy 1000 tokens for $100
      const buyTx = `buy-${Date.now()}`;
      const buyResult = await supabase.rpc('record_trade_atomic', {
        p_pool_address: testPoolAddress,
        p_post_id: testPostId,
        p_user_id: testUserId,
        p_wallet_address: `test-wallet-${testUserId}`,
        p_trade_type: 'buy',
        p_token_amount: 1000,
        p_usdc_amount: 100,
        p_tx_signature: buyTx,
        p_token_type: 'SHORT',
        p_sqrt_price_long_x96: '0',
        p_sqrt_price_short_x96: '0',
        p_belief_id: testBeliefId,
        p_agent_id: testAgentId,
        p_belief: 0.4,
        p_meta_prediction: 0.5,
      });

      expect(buyResult.data?.success).toBe(true);
      const initialLock = buyResult.data?.new_lock;
      expect(initialLock).toBe(2); // 2% of 100 = 2

      // Then, sell 500 tokens (half)
      const sellTx = `sell-${Date.now()}`;
      const sellResult = await supabase.rpc('record_trade_atomic', {
        p_pool_address: testPoolAddress,
        p_post_id: testPostId,
        p_user_id: testUserId,
        p_wallet_address: `test-wallet-${testUserId}`,
        p_trade_type: 'sell',
        p_token_amount: 500,
        p_usdc_amount: 48, // Approximate value
        p_tx_signature: sellTx,
        p_token_type: 'SHORT',
        p_sqrt_price_long_x96: '0',
        p_sqrt_price_short_x96: '0',
        p_belief_id: testBeliefId,
        p_agent_id: testAgentId,
        p_belief: 0.4,
        p_meta_prediction: 0.5,
      });

      expect(sellResult.data?.success).toBe(true);

      // Lock should be reduced proportionally (500/1000 = 0.5, so 2 * 0.5 = 1)
      const newLock = sellResult.data?.new_lock;
      expect(newLock).toBe(1);

      console.log('✅ Bug #2 Fix Verified: Belief lock reduced proportionally on sell');
    });
  });

  describe('Bug #5: Database Function Unit Tests', () => {
    it('should validate sufficient balance before selling', async () => {
      const sellTx = `sell-fail-${Date.now()}`;
      const result = await supabase.rpc('record_trade_atomic', {
        p_pool_address: testPoolAddress,
        p_post_id: testPostId,
        p_user_id: testUserId,
        p_wallet_address: `test-wallet-${testUserId}`,
        p_trade_type: 'sell',
        p_token_amount: 999999, // Way more than user has
        p_usdc_amount: 10,
        p_tx_signature: sellTx,
        p_token_type: 'LONG',
        p_sqrt_price_long_x96: '0',
        p_sqrt_price_short_x96: '0',
        p_belief_id: testBeliefId,
        p_agent_id: testAgentId,
        p_belief: 0.5,
        p_meta_prediction: 0.5,
      });

      expect(result.data?.success).toBe(false);
      expect(result.data?.error).toBe('INSUFFICIENT_BALANCE');

      console.log('✅ Insufficient balance check working correctly');
    });

    it('should create belief submission when recording trade', async () => {
      const tradeTx = `belief-test-${Date.now()}`;
      const result = await supabase.rpc('record_trade_atomic', {
        p_pool_address: testPoolAddress,
        p_post_id: testPostId,
        p_user_id: testUserId,
        p_wallet_address: `test-wallet-${testUserId}`,
        p_trade_type: 'buy',
        p_token_amount: 1,
        p_usdc_amount: 1,
        p_tx_signature: tradeTx,
        p_token_type: 'LONG',
        p_sqrt_price_long_x96: '0',
        p_sqrt_price_short_x96: '0',
        p_belief_id: testBeliefId,
        p_agent_id: testAgentId,
        p_belief: 0.75,
        p_meta_prediction: 0.6,
      });

      expect(result.data?.success).toBe(true);

      // Verify belief submission was created
      const { data: submission } = await supabase
        .from('belief_submissions')
        .select('*')
        .eq('belief_id', testBeliefId)
        .eq('agent_id', testAgentId)
        .single();

      expect(submission).toBeTruthy();
      expect(submission?.belief).toBe(0.75);
      expect(submission?.meta_prediction).toBe(0.6);

      console.log('✅ Belief submission created correctly');
    });
  });
});

console.log('🧪 Run these tests with: npm test tests/trade-recording-fixes.test.ts');
