/**
 * Integration tests for stake invariant enforcement
 *
 * Tests that the stake invariant (total_stake >= total_locks) is maintained
 * across multiple trades and that violations are caught before corrupting data.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

describe('Stake Invariant Integration Tests', () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let testAgentId: string;
  let testPoolAddress: string;

  beforeAll(async () => {
    // Connect to local Supabase
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
    );

    // Create test user and agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .insert({
        solana_address: 'TestAddress123456789012345678901234',
        total_stake: 0,
        total_deposited: 0,
      })
      .select()
      .single();

    if (agentError) throw agentError;
    testAgentId = agent.id;

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        agent_id: testAgentId,
        username: 'test_stake_user',
        wallet_address: 'TestAddress123456789012345678901234',
      })
      .select()
      .single();

    if (userError) throw userError;
    testUserId = user.id;

    // Create test pool
    testPoolAddress = 'TestPool123456789012345678901234567';
  });

  afterAll(async () => {
    // Cleanup
    await supabase.from('user_pool_balances').delete().eq('user_id', testUserId);
    await supabase.from('trades').delete().eq('user_id', testUserId);
    await supabase.from('custodian_deposits').delete().eq('agent_id', testAgentId);
    await supabase.from('users').delete().eq('id', testUserId);
    await supabase.from('agents').delete().eq('id', testAgentId);
  });

  describe('Belief Lock Replacement', () => {
    it('should correctly replace LONG lock on subsequent buys', async () => {
      // Trade 1: Buy LONG $100 (lock should be $2)
      const { data: trade1, error: error1 } = await supabase.rpc('record_trade_atomic', {
        p_pool_address: testPoolAddress,
        p_post_id: '00000000-0000-0000-0000-000000000001',
        p_user_id: testUserId,
        p_wallet_address: 'TestAddress123456789012345678901234',
        p_trade_type: 'buy',
        p_token_amount: 100,
        p_usdc_amount: 100,
        p_tx_signature: 'test_trade_1',
        p_token_type: 'LONG',
        p_sqrt_price_long_x96: '0',
        p_sqrt_price_short_x96: '0',
        p_belief_id: '00000000-0000-0000-0000-000000000001',
        p_agent_id: testAgentId,
        p_belief: 0.7,
        p_meta_prediction: 0.6,
        p_skim_amount: 2, // 2% of $100
      });

      expect(error1).toBeNull();
      expect(trade1.success).toBe(true);
      expect(trade1.belief_lock).toBe(2_000_000); // $2 in micro-USDC

      // Check agent stake
      const { data: agent1 } = await supabase
        .from('agents')
        .select('total_stake')
        .eq('id', testAgentId)
        .single();
      expect(agent1?.total_stake).toBe(2_000_000); // $2

      // Trade 2: Buy LONG $500 (lock should REPLACE to $10, not add)
      const { data: trade2, error: error2 } = await supabase.rpc('record_trade_atomic', {
        p_pool_address: testPoolAddress,
        p_post_id: '00000000-0000-0000-0000-000000000001',
        p_user_id: testUserId,
        p_wallet_address: 'TestAddress123456789012345678901234',
        p_trade_type: 'buy',
        p_token_amount: 500,
        p_usdc_amount: 500,
        p_tx_signature: 'test_trade_2',
        p_token_type: 'LONG',
        p_sqrt_price_long_x96: '0',
        p_sqrt_price_short_x96: '0',
        p_belief_id: '00000000-0000-0000-0000-000000000001',
        p_agent_id: testAgentId,
        p_belief: 0.8,
        p_meta_prediction: 0.7,
        p_skim_amount: 8, // Skim should be $10 (new lock) - $2 (existing stake) = $8
      });

      expect(error2).toBeNull();
      expect(trade2.success).toBe(true);
      expect(trade2.belief_lock).toBe(10_000_000); // $10 in micro-USDC (REPLACED, not $12)

      // Check agent stake increased by $8
      const { data: agent2 } = await supabase
        .from('agents')
        .select('total_stake')
        .eq('id', testAgentId)
        .single();
      expect(agent2?.total_stake).toBe(10_000_000); // $2 + $8 = $10

      // Verify only ONE lock exists for LONG
      const { data: locks } = await supabase
        .from('user_pool_balances')
        .select('belief_lock, token_type')
        .eq('user_id', testUserId)
        .eq('pool_address', testPoolAddress)
        .eq('token_type', 'LONG');

      expect(locks).toHaveLength(1);
      expect(locks![0].belief_lock).toBe(10_000_000); // $10, not $12
    });

    it('should handle LONG and SHORT locks separately (gross sum)', async () => {
      // Start fresh
      await supabase.from('user_pool_balances').delete().eq('user_id', testUserId);
      await supabase.from('agents').update({ total_stake: 0 }).eq('id', testAgentId);

      // Trade 1: Buy LONG $100 (lock $2)
      await supabase.rpc('record_trade_atomic', {
        p_pool_address: testPoolAddress,
        p_post_id: '00000000-0000-0000-0000-000000000001',
        p_user_id: testUserId,
        p_wallet_address: 'TestAddress123456789012345678901234',
        p_trade_type: 'buy',
        p_token_amount: 100,
        p_usdc_amount: 100,
        p_tx_signature: 'test_trade_3',
        p_token_type: 'LONG',
        p_sqrt_price_long_x96: '0',
        p_sqrt_price_short_x96: '0',
        p_belief_id: '00000000-0000-0000-0000-000000000001',
        p_agent_id: testAgentId,
        p_belief: 0.7,
        p_meta_prediction: 0.6,
        p_skim_amount: 2,
      });

      // Trade 2: Buy SHORT $300 (lock $6, total locks now $2 + $6 = $8)
      await supabase.rpc('record_trade_atomic', {
        p_pool_address: testPoolAddress,
        p_post_id: '00000000-0000-0000-0000-000000000001',
        p_user_id: testUserId,
        p_wallet_address: 'TestAddress123456789012345678901234',
        p_trade_type: 'buy',
        p_token_amount: 300,
        p_usdc_amount: 300,
        p_tx_signature: 'test_trade_4',
        p_token_type: 'SHORT',
        p_sqrt_price_long_x96: '0',
        p_sqrt_price_short_x96: '0',
        p_belief_id: '00000000-0000-0000-0000-000000000001',
        p_agent_id: testAgentId,
        p_belief: 0.3,
        p_meta_prediction: 0.4,
        p_skim_amount: 6,
      });

      // Check we have both locks
      const { data: locks } = await supabase
        .from('user_pool_balances')
        .select('belief_lock, token_type')
        .eq('user_id', testUserId)
        .eq('pool_address', testPoolAddress);

      expect(locks).toHaveLength(2);

      const longLock = locks!.find((l) => l.token_type === 'LONG');
      const shortLock = locks!.find((l) => l.token_type === 'SHORT');

      expect(longLock?.belief_lock).toBe(2_000_000); // $2
      expect(shortLock?.belief_lock).toBe(6_000_000); // $6

      // Check total stake covers both locks (gross sum)
      const { data: agent } = await supabase
        .from('agents')
        .select('total_stake')
        .eq('id', testAgentId)
        .single();

      expect(agent?.total_stake).toBe(8_000_000); // $2 + $6 = $8
    });
  });

  describe('Invariant Validation', () => {
    it('should pass validation when stake >= locks', async () => {
      // Setup: Create agent with sufficient stake
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .insert({
          solana_address: 'TestValidAgent12345678901234567890',
          total_stake: 10_000_000, // $10
          total_deposited: 10,
        })
        .select()
        .single();

      expect(agentError).toBeNull();

      // Validate - should NOT throw
      const { data, error } = await supabase.rpc('validate_stake_invariant', {
        p_agent_id: agent!.id,
        p_trade_context: 'test_validation_pass',
      });

      expect(error).toBeNull();

      // Cleanup
      await supabase.from('agents').delete().eq('id', agent!.id);
    });

    it('should fail validation when stake < locks', async () => {
      // Setup: Create agent with insufficient stake
      const { data: agent } = await supabase
        .from('agents')
        .insert({
          solana_address: 'TestInvalidAgent1234567890123456789',
          total_stake: 5_000_000, // $5
          total_deposited: 5,
        })
        .select()
        .single();

      const { data: user } = await supabase
        .from('users')
        .insert({
          agent_id: agent!.id,
          username: 'test_invalid_user',
          wallet_address: 'TestInvalidAgent1234567890123456789',
        })
        .select()
        .single();

      // Create a lock larger than stake
      await supabase.from('user_pool_balances').insert({
        user_id: user!.id,
        pool_address: 'TestInvalidPool123456789012345678901',
        post_id: '00000000-0000-0000-0000-000000000002',
        token_type: 'LONG',
        token_balance: 100,
        belief_lock: 10_000_000, // $10 (exceeds $5 stake)
        total_bought: 100,
        total_sold: 0,
        net_bought: 100,
      });

      // Validate - SHOULD throw
      const { error } = await supabase.rpc('validate_stake_invariant', {
        p_agent_id: agent!.id,
        p_trade_context: 'test_validation_fail',
      });

      expect(error).not.toBeNull();
      expect(error!.message).toContain('INVARIANT VIOLATION');
      expect(error!.message).toContain('total_stake');
      expect(error!.message).toContain('total_locks');

      // Cleanup
      await supabase.from('user_pool_balances').delete().eq('user_id', user!.id);
      await supabase.from('users').delete().eq('id', user!.id);
      await supabase.from('agents').delete().eq('id', agent!.id);
    });
  });

  describe('Balance Sheet Reconciliation', () => {
    it('should correctly calculate balance sheet totals', async () => {
      const { data, error } = await supabase.rpc('reconcile_balance_sheet');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(6);

      // Check structure
      const deposits = data.find((row: any) => row.metric === 'Total Deposits');
      const withdrawals = data.find((row: any) => row.metric === 'Total Withdrawals');
      const netCustodian = data.find((row: any) => row.metric === 'Net Custodian Balance');
      const stakes = data.find((row: any) => row.metric === 'Total Agent Stakes');
      const locks = data.find((row: any) => row.metric === 'Total Locks');
      const difference = data.find((row: any) => row.metric === 'Difference (Custodian - Stakes)');

      expect(deposits).toBeDefined();
      expect(withdrawals).toBeDefined();
      expect(netCustodian).toBeDefined();
      expect(stakes).toBeDefined();
      expect(locks).toBeDefined();
      expect(difference).toBeDefined();

      // Verify math
      expect(netCustodian!.value_usdc).toBeCloseTo(
        deposits!.value_usdc - withdrawals!.value_usdc,
        6
      );
    });
  });

  describe('System Health Dashboard', () => {
    it('should provide accurate system health overview', async () => {
      const { data, error } = await supabase
        .from('system_health_dashboard')
        .select('*')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toHaveProperty('total_agents');
      expect(data).toHaveProperty('agents_underwater');
      expect(data).toHaveProperty('total_deficit_usdc');
      expect(data).toHaveProperty('bad_locks_count');
      expect(data).toHaveProperty('custodian_balance_usdc');
      expect(data).toHaveProperty('total_stakes_usdc');
      expect(data).toHaveProperty('total_locks_usdc');
      expect(data).toHaveProperty('balance_difference_usdc');
      expect(data).toHaveProperty('balance_status');

      // Verify counts are reasonable
      expect(data.total_agents).toBeGreaterThanOrEqual(0);
      expect(data.agents_underwater).toBeGreaterThanOrEqual(0);
      expect(data.bad_locks_count).toBeGreaterThanOrEqual(0);
    });
  });
});
