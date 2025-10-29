import { Connection, PublicKey } from '@solana/web3.js';
import { syncPoolFromChain } from '../src/lib/solana/sync-pool-from-chain';

async function forceSyncPool() {
  const poolAddress = 'CmpMo4z4iT5ZNx7trB5kt34wKZym6K8DyiMjrtfT6qWK';
  const connection = new Connection('http://localhost:8899', 'confirmed');

  console.log(`Force syncing pool ${poolAddress}...`);

  const result = await syncPoolFromChain(poolAddress, connection, 10000, true);

  if (result) {
    console.log('✅ Sync successful!');
    console.log('r_long:', result.r_long);
    console.log('r_short:', result.r_short);

    // Check database
    const { getSupabaseServiceRole } = await import('../src/lib/supabase-server');
    const supabase = getSupabaseServiceRole();

    const { data, error } = await supabase
      .from('pool_deployments')
      .select('r_long, r_short, sqrt_price_long_x96, sqrt_price_short_x96')
      .eq('pool_address', poolAddress)
      .single();

    if (data) {
      console.log('\n📊 Database values after sync:');
      console.log('r_long:', data.r_long);
      console.log('r_short:', data.r_short);
    }
  } else {
    console.log('❌ Sync failed');
  }
}

forceSyncPool();