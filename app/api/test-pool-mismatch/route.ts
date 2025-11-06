import { NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export async function GET() {
  const supabase = getSupabaseServiceRole();

  // Get joshvc's user ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('username', 'joshvc')
    .single();

  if (!user) {
    return NextResponse.json({ error: 'User not found' });
  }

  // Get pool addresses from user_pool_balances
  const { data: balances } = await supabase
    .from('user_pool_balances')
    .select('pool_address, token_type, token_balance')
    .eq('user_id', user.id)
    .gt('token_balance', 0);

  const balancePoolAddresses = [...new Set(balances?.map(b => b.pool_address).filter(Boolean))];

  // Try to fetch those exact addresses from pool_deployments
  const { data: pools, error: poolsError } = await supabase
    .from('pool_deployments')
    .select('pool_address')
    .in('pool_address', balancePoolAddresses);

  // Also get ALL pool deployments to see what's there
  const { data: allPools } = await supabase
    .from('pool_deployments')
    .select('pool_address')
    .limit(10);

  return NextResponse.json({
    user_balances: {
      count: balances?.length || 0,
      pool_addresses: balancePoolAddresses,
      sample: balances?.slice(0, 3).map(b => ({
        pool: b.pool_address,
        type: b.token_type,
        balance: b.token_balance
      }))
    },
    matching_pools: {
      found: pools?.length || 0,
      addresses: pools?.map(p => p.pool_address) || [],
      error: poolsError?.message
    },
    all_pools_sample: {
      count: allPools?.length || 0,
      addresses: allPools?.map(p => p.pool_address) || []
    },
    mismatch_analysis: {
      addresses_in_balances_not_in_pools: balancePoolAddresses.filter(
        addr => !pools?.some(p => p.pool_address === addr)
      ),
      issue: pools?.length === 0 ? "NO POOLS FOUND - pool_deployments might be empty or addresses don't match" : "Some pools found"
    }
  });
}