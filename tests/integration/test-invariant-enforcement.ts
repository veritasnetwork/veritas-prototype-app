/**
 * Test that record_trade_atomic properly enforces invariant
 * This test attempts to create an underwater position and verifies it's blocked
 *
 * Run with: npx tsx tests/integration/test-invariant-enforcement.ts
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

async function testInvariantEnforcement() {
  console.log('🧪 Testing invariant enforcement in record_trade_atomic\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Generate unique IDs for test
  const testId = randomBytes(4).toString('hex');
  const testAddress = `Test${testId}${'0'.repeat(32 - 4 - testId.length)}`;

  let testAgentId: string;
  let testUserId: string;
  let testBeliefId: string = `00000000-0000-0000-0000-00000000${testId.slice(0, 4)}`;
  let testPoolAddress: string = `Pool${testId}${'0'.repeat(36 - 4 - testId.length)}`;

  try {
    // Setup: Create test agent with ZERO stake
    console.log('Setup: Creating test agent with $0 stake...');
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .insert({
        solana_address: testAddress,
        total_stake: 0,
        total_deposited: 0,
      })
      .select()
      .single();

    if (agentError) throw new Error(`Failed to create agent: ${agentError.message}`);
    testAgentId = agent.id;
    console.log('✅ Created agent:', testAgentId);

    // Create test user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        agent_id: testAgentId,
        username: `test_user_${testId}`,
        display_name: `Test User ${testId}`,
      })
      .select()
      .single();

    if (userError) throw new Error(`Failed to create user: ${userError.message}`);
    testUserId = user.id;
    console.log('✅ Created user:', testUserId);
    console.log('');

    // Test 1: Attempt trade with ZERO skim (should fail)
    console.log('Test 1: Attempt $100 LONG buy with $0 skim (should FAIL)');
    const { data: trade1, error: error1 } = await supabase.rpc('record_trade_atomic', {
      p_pool_address: testPoolAddress,
      p_post_id: testBeliefId,
      p_user_id: testUserId,
      p_wallet_address: testAddress,
      p_trade_type: 'buy',
      p_token_amount: 100,
      p_usdc_amount: 100,
      p_tx_signature: `test_tx_1_${testId}`,
      p_token_type: 'LONG',
      p_sqrt_price_long_x96: '0',
      p_sqrt_price_short_x96: '0',
      p_belief_id: testBeliefId,
      p_agent_id: testAgentId,
      p_belief: 0.7,
      p_meta_prediction: 0.6,
      p_skim_amount: 0, // ❌ ZERO skim - should fail validation
    });

    if (error1) {
      if (error1.message.includes('INVARIANT VIOLATION')) {
        console.log('✅ Trade correctly REJECTED with invariant violation');
        console.log('   Error message:', error1.message.substring(0, 100) + '...');
      } else {
        console.log('❌ UNEXPECTED ERROR:', error1.message);
        throw new Error('Trade failed but not due to invariant violation');
      }
    } else {
      console.log('❌ CRITICAL BUG: Trade succeeded with insufficient skim!');
      console.log('   Result:', trade1);
      throw new Error('Invariant enforcement FAILED - trade should have been blocked');
    }
    console.log('');

    // Test 2: Attempt trade with INSUFFICIENT skim (should fail)
    console.log('Test 2: Attempt $100 LONG buy with $1 skim (should FAIL - need $2)');
    const { data: trade2, error: error2 } = await supabase.rpc('record_trade_atomic', {
      p_pool_address: testPoolAddress,
      p_post_id: testBeliefId,
      p_user_id: testUserId,
      p_wallet_address: testAddress,
      p_trade_type: 'buy',
      p_token_amount: 100,
      p_usdc_amount: 100,
      p_tx_signature: `test_tx_2_${testId}`,
      p_token_type: 'LONG',
      p_sqrt_price_long_x96: '0',
      p_sqrt_price_short_x96: '0',
      p_belief_id: testBeliefId,
      p_agent_id: testAgentId,
      p_belief: 0.7,
      p_meta_prediction: 0.6,
      p_skim_amount: 1, // ❌ Only $1 skim - need $2 (2% of $100)
    });

    if (error2) {
      if (error2.message.includes('INVARIANT VIOLATION')) {
        console.log('✅ Trade correctly REJECTED with invariant violation');
        console.log('   Error message:', error2.message.substring(0, 100) + '...');
      } else {
        console.log('❌ UNEXPECTED ERROR:', error2.message);
        throw new Error('Trade failed but not due to invariant violation');
      }
    } else {
      console.log('❌ CRITICAL BUG: Trade succeeded with insufficient skim!');
      throw new Error('Invariant enforcement FAILED');
    }
    console.log('');

    // Test 3: Trade with CORRECT skim (should succeed)
    console.log('Test 3: Attempt $100 LONG buy with $2 skim (should SUCCEED)');
    const { data: trade3, error: error3 } = await supabase.rpc('record_trade_atomic', {
      p_pool_address: testPoolAddress,
      p_post_id: testBeliefId,
      p_user_id: testUserId,
      p_wallet_address: testAddress,
      p_trade_type: 'buy',
      p_token_amount: 100,
      p_usdc_amount: 100,
      p_tx_signature: `test_tx_3_${testId}`,
      p_token_type: 'LONG',
      p_sqrt_price_long_x96: '0',
      p_sqrt_price_short_x96: '0',
      p_belief_id: testBeliefId,
      p_agent_id: testAgentId,
      p_belief: 0.7,
      p_meta_prediction: 0.6,
      p_skim_amount: 2, // ✅ Correct skim (2% of $100)
    });

    if (error3) {
      console.log('❌ Trade FAILED unexpectedly:', error3.message);
      throw new Error('Trade should have succeeded with correct skim');
    } else {
      console.log('✅ Trade SUCCEEDED with correct skim');
      console.log('   Trade ID:', trade3.trade_id);
      console.log('   Belief lock:', trade3.belief_lock / 1_000_000, 'USDC');
    }
    console.log('');

    // Verify stake was updated
    const { data: agent2 } = await supabase
      .from('agents')
      .select('total_stake')
      .eq('id', testAgentId)
      .single();

    console.log('✅ Agent stake after trade:', agent2!.total_stake / 1_000_000, 'USDC');
    console.log('');

    // Test 4: Try to replace lock with SMALLER skim (should fail)
    console.log('Test 4: Replace $2 lock with $10 lock using only $7 skim (should FAIL - need $8)');
    const { data: trade4, error: error4 } = await supabase.rpc('record_trade_atomic', {
      p_pool_address: testPoolAddress,
      p_post_id: testBeliefId,
      p_user_id: testUserId,
      p_wallet_address: testAddress,
      p_trade_type: 'buy',
      p_token_amount: 500,
      p_usdc_amount: 500,
      p_tx_signature: `test_tx_4_${testId}`,
      p_token_type: 'LONG',
      p_sqrt_price_long_x96: '0',
      p_sqrt_price_short_x96: '0',
      p_belief_id: testBeliefId,
      p_agent_id: testAgentId,
      p_belief: 0.8,
      p_meta_prediction: 0.7,
      p_skim_amount: 7, // ❌ Need $8 (new $10 lock - existing $2 stake)
    });

    if (error4) {
      if (error4.message.includes('INVARIANT VIOLATION')) {
        console.log('✅ Trade correctly REJECTED with invariant violation');
        console.log('   Error message:', error4.message.substring(0, 100) + '...');
      } else {
        console.log('❌ UNEXPECTED ERROR:', error4.message);
      }
    } else {
      console.log('❌ CRITICAL BUG: Trade succeeded with insufficient skim!');
      throw new Error('Invariant enforcement FAILED');
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Invariant enforcement is working correctly');
    console.log('✅ Trades with insufficient skim are blocked');
    console.log('✅ Trades with correct skim succeed');
    console.log('✅ System is protected against underwater positions');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    if (testUserId) {
      await supabase.from('user_pool_balances').delete().eq('user_id', testUserId);
      await supabase.from('trades').delete().eq('user_id', testUserId);
      await supabase.from('belief_submissions').delete().eq('agent_id', testAgentId);
      await supabase.from('users').delete().eq('id', testUserId);
    }
    if (testAgentId) {
      await supabase.from('custodian_deposits').delete().eq('agent_id', testAgentId);
      await supabase.from('agents').delete().eq('id', testAgentId);
    }
    console.log('✅ Cleanup complete');
  }
}

// Run test
testInvariantEnforcement()
  .then(() => {
    console.log('\n✅ Test suite completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed');
    process.exit(1);
  });
