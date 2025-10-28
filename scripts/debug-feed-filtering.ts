import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all posts
  const { data: allPosts, error } = await supabase
    .from('posts')
    .select('id, content_text, belief_id')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching posts:', error);
    return;
  }

  console.log(`\n=== Total posts in database: ${allPosts?.length || 0} ===\n`);

  // Get pool deployments to check which posts have pools
  const { data: allPools } = await supabase
    .from('pool_deployments')
    .select('belief_id, pool_address');

  const beliefIdsWithPools = new Set(allPools?.map(p => p.belief_id) || []);

  // Get posts with pools
  const postsWithPools = allPosts?.filter(p => beliefIdsWithPools.has(p.belief_id)) || [];
  console.log(`Posts with deployed pools: ${postsWithPools.length}`);

  // Get posts without pools
  const postsWithoutPools = allPosts?.filter(p => !beliefIdsWithPools.has(p.belief_id)) || [];
  console.log(`Posts without deployed pools: ${postsWithoutPools.length}\n`);

  // Check pool deployment statuses
  const { data: pools } = await supabase
    .from('pool_deployments')
    .select('pool_address, status, s_long_supply, s_short_supply, vault_balance, sqrt_price_long_x96, sqrt_price_short_x96');

  console.log(`\n=== Pool Deployments (${pools?.length || 0}) ===\n`);

  const poolsByStatus: Record<string, number> = {};
  const poolsWithZeroSupply: number[] = [];
  const poolsWithNullPrices: number[] = [];

  for (const pool of pools || []) {
    poolsByStatus[pool.status] = (poolsByStatus[pool.status] || 0) + 1;

    if (pool.s_long_supply === 0 && pool.s_short_supply === 0) {
      poolsWithZeroSupply.push(pool);
    }

    if (!pool.sqrt_price_long_x96 || !pool.sqrt_price_short_x96) {
      poolsWithNullPrices.push(pool);
    }
  }

  console.log('Pools by status:');
  for (const [status, count] of Object.entries(poolsByStatus)) {
    console.log(`  ${status}: ${count}`);
  }

  console.log(`\nPools with 0 LONG and SHORT supply: ${poolsWithZeroSupply.length}`);
  console.log(`Pools with NULL sqrt prices: ${poolsWithNullPrices.length}`);

  console.log(`\nDetailed pool info:`);
  for (const pool of pools || []) {
    console.log(`  Pool ${pool.pool_address}:`);
    console.log(`    Status: ${pool.status}`);
    console.log(`    LONG supply: ${pool.s_long_supply}`);
    console.log(`    SHORT supply: ${pool.s_short_supply}`);
    console.log(`    Vault: $${(pool.vault_balance / 1_000_000).toFixed(2)}`);
    console.log(`    Has prices: ${!!pool.sqrt_price_long_x96 && !!pool.sqrt_price_short_x96}`);
  }

  // Check vault balances
  const poolsWithLowVault = pools?.filter(p => (p.vault_balance || 0) < 1_000_000) || [];
  console.log(`Pools with < $1 vault balance: ${poolsWithLowVault.length}`);

  // Simulate feed filtering
  console.log(`\n=== Simulating Feed Filtering ===\n`);

  const postsWithoutPoolsCount = postsWithoutPools.length;
  const postsWithPoolsCount = postsWithPools.length;

  console.log(`Step 1: Initial posts`);
  console.log(`  - Posts without pools (should show): ${postsWithoutPoolsCount}`);
  console.log(`  - Posts with pools (need enrichment): ${postsWithPoolsCount}`);

  console.log(`\nStep 2: After enrichment (simulated)`);
  console.log(`  - Posts with NULL decayedPoolState (will be filtered): ${poolsWithNullPrices.length}`);
  console.log(`  - Posts that would pass enrichment: ${postsWithPoolsCount - poolsWithNullPrices.length}`);

  console.log(`\nStep 3: After filtering`);
  const wouldPassVaultFilter = pools?.filter(p =>
    p.sqrt_price_long_x96 &&
    p.sqrt_price_short_x96 &&
    (p.vault_balance || 0) >= 1_000_000
  ).length || 0;

  const wouldPassSupplyFilter = pools?.filter(p =>
    p.sqrt_price_long_x96 &&
    p.sqrt_price_short_x96 &&
    (p.vault_balance || 0) >= 1_000_000 &&
    (p.s_long_supply > 0 || p.s_short_supply > 0)
  ).length || 0;

  console.log(`  - After vault balance filter (>= $1): ${wouldPassVaultFilter}`);
  console.log(`  - After supply filter (> 0): ${wouldPassSupplyFilter}`);
  console.log(`\nExpected total posts in feed: ${postsWithoutPoolsCount + wouldPassSupplyFilter}`);
}

main().catch(console.error);
