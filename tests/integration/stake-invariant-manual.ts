/**
 * Manual integration test for stake invariant
 * Run with: npx tsx tests/integration/stake-invariant-manual.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

async function testStakeInvariant() {
  console.log('🧪 Starting stake invariant integration tests...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Test 1: Check system health dashboard
    console.log('Test 1: System Health Dashboard');
    const { data: health, error: healthError } = await supabase
      .from('system_health_dashboard')
      .select('*')
      .single();

    if (healthError) {
      console.error('❌ Failed:', healthError.message);
      return;
    }

    console.log('✅ Dashboard loaded successfully');
    console.log('   Total agents:', health.total_agents);
    console.log('   Agents underwater:', health.agents_underwater);
    console.log('   Total deficit:', health.total_deficit_usdc);
    console.log('   Bad locks:', health.bad_locks_count);
    console.log('   Balance status:', health.balance_status);
    console.log('');

    // Test 2: Check all agents solvency
    console.log('Test 2: Agent Solvency Check');
    const { data: solvency, error: solvencyError } = await supabase
      .rpc('check_all_agents_solvency');

    if (solvencyError) {
      console.error('❌ Failed:', solvencyError.message);
      return;
    }

    console.log(`✅ Found ${solvency.length} agent(s)`);
    solvency.forEach((agent: any) => {
      console.log(`   ${agent.status} Agent: stake=$${agent.stake_usdc} locks=$${agent.locks_usdc} withdrawable=$${agent.withdrawable_usdc}`);
      if (agent.status === '❌ UNDERWATER') {
        console.log(`      Deficit: $${agent.deficit_usdc}`);
      }
    });
    console.log('');

    // Test 3: Check belief lock units
    console.log('Test 3: Belief Lock Units Check');
    const { data: locks, error: locksError } = await supabase
      .rpc('check_belief_lock_units');

    if (locksError) {
      console.error('❌ Failed:', locksError.message);
      return;
    }

    console.log(`✅ Found ${locks.length} lock(s)`);
    const badLocks = locks.filter((l: any) => l.status === '❌ FAIL');
    if (badLocks.length > 0) {
      console.log('   ⚠️  Found bad locks:');
      badLocks.forEach((l: any) => {
        console.log(`      ${l.token_type}: ${l.lock_usdc} USDC - ${l.issue}`);
      });
    } else {
      console.log('   All locks are in correct units ✓');
    }
    console.log('');

    // Test 4: Balance sheet reconciliation
    console.log('Test 4: Balance Sheet Reconciliation');
    const { data: reconcile, error: reconcileError } = await supabase
      .rpc('reconcile_balance_sheet');

    if (reconcileError) {
      console.error('❌ Failed:', reconcileError.message);
      return;
    }

    console.log('✅ Reconciliation complete:');
    reconcile.forEach((row: any) => {
      console.log(`   ${row.status_icon} ${row.metric}: $${row.value_usdc}`);
      if (row.note && row.note !== row.metric) {
        console.log(`      ${row.note}`);
      }
    });
    console.log('');

    // Test 5: Validate invariant on actual agent
    console.log('Test 5: Invariant Validation');
    const { data: agents } = await supabase
      .from('agents')
      .select('id')
      .limit(1);

    if (!agents || agents.length === 0) {
      console.log('⚠️  No agents found to test');
    } else {
      const testAgentId = agents[0].id;
      const { error: validateError } = await supabase
        .rpc('validate_stake_invariant', {
          p_agent_id: testAgentId,
          p_trade_context: 'manual_test',
        });

      if (validateError) {
        if (validateError.message.includes('INVARIANT VIOLATION')) {
          console.log('✅ Validation correctly detected underwater position');
          console.log('   Error:', validateError.message);
        } else {
          console.error('❌ Unexpected error:', validateError.message);
        }
      } else {
        console.log('✅ Agent is solvent (invariant holds)');
      }
    }
    console.log('');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total Agents: ${health.total_agents}`);
    console.log(`Underwater: ${health.agents_underwater} (deficit: $${health.total_deficit_usdc || 0})`);
    console.log(`Bad Locks: ${health.bad_locks_count}`);
    console.log(`Balance Sheet: ${health.balance_status}`);
    console.log('');

    if (health.agents_underwater === 0 && health.bad_locks_count === 0 && health.balance_status === '✅') {
      console.log('🎉 All tests passed! System is healthy.');
    } else {
      console.log('⚠️  System has issues that need attention:');
      if (health.agents_underwater > 0) {
        console.log(`   - ${health.agents_underwater} agent(s) underwater`);
      }
      if (health.bad_locks_count > 0) {
        console.log(`   - ${health.bad_locks_count} lock(s) in wrong units`);
      }
      if (health.balance_status !== '✅') {
        console.log('   - Balance sheet mismatch');
      }
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
testStakeInvariant()
  .then(() => {
    console.log('\n✅ Test suite completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite crashed:', error);
    process.exit(1);
  });
