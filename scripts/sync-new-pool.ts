import { Connection } from '@solana/web3.js';
import { syncPoolFromChain } from '../src/lib/solana/sync-pool-from-chain';

async function syncNewPool() {
  const poolAddress = 'Ck5gGkp4s9KdDkauLJwZZyZah8FdQ79sXnXpJLeJ63EG';
  const connection = new Connection('http://localhost:8899', 'confirmed');

  console.log(`Syncing pool ${poolAddress}...`);

  // Set environment variables
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

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
      .select('pool_address, r_long, r_short, s_long_supply, s_short_supply')
      .eq('pool_address', poolAddress)
      .single();

    if (data) {
      console.log('\n📊 Database values after sync:');
      console.log(data);
    }
  } else {
    console.log('❌ Sync failed');
  }
}

syncNewPool();