/**
 * Fix Pool Prices - Force sync sqrt prices from chain to database
 *
 * After a database flush, pool sqrt prices may be null or stale.
 * This script fetches fresh data from Solana and updates the database.
 */

import { createClient } from '@supabase/supabase-js';
import { fetchPoolData } from '../src/lib/solana/fetch-pool-data.ts';
import { getRpcEndpoint } from '../src/lib/solana/network-config.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY!);
  const rpcEndpoint = getRpcEndpoint();

  // Get all deployed pools
  const { data: pools, error } = await supabase
    .from('pool_deployments')
    .select('pool_address, sqrt_price_long_x96, sqrt_price_short_x96')
    .not('pool_address', 'is', null);

  if (error) {
    console.error('❌ Error fetching pools:', error);
    process.exit(1);
  }

  if (!pools || pools.length === 0) {
    console.log('ℹ️  No pools to sync');
    return;
  }

  console.log(`\n📊 Found ${pools.length} pool(s) to check\n`);

  for (const pool of pools) {
    console.log(`Checking pool: ${pool.pool_address}`);
    console.log(`  Current sqrt_price_long_x96:  ${pool.sqrt_price_long_x96 || 'NULL'}`);
    console.log(`  Current sqrt_price_short_x96: ${pool.sqrt_price_short_x96 || 'NULL'}`);

    try {
      // Fetch fresh data from chain
      const chainData = await fetchPoolData(pool.pool_address, rpcEndpoint);

      console.log(`  Chain sqrt_price_long_x96:  ${chainData._raw.sqrtPriceLongX96}`);
      console.log(`  Chain sqrt_price_short_x96: ${chainData._raw.sqrtPriceShortX96}`);
      console.log(`  Chain price_long:  $${chainData.priceLong.toFixed(6)}`);
      console.log(`  Chain price_short: $${chainData.priceShort.toFixed(6)}`);

      // Force update regardless of current value
      const { error: updateError } = await supabase
        .from('pool_deployments')
        .update({
          sqrt_price_long_x96: chainData._raw.sqrtPriceLongX96,
          sqrt_price_short_x96: chainData._raw.sqrtPriceShortX96,
          s_long_supply: chainData._raw.sLongAtomic,
          s_short_supply: chainData._raw.sShortAtomic,
          vault_balance: chainData._raw.vaultBalanceMicro,
          last_synced_at: new Date().toISOString(),
        })
        .eq('pool_address', pool.pool_address);

      if (updateError) {
        console.error(`  ❌ Error updating: ${updateError.message}`);
      } else {
        console.log(`  ✅ Updated successfully\n`);
      }
    } catch (error) {
      console.error(`  ❌ Error fetching from chain: ${error}\n`);
    }
  }

  console.log('✨ Done!');
}

main().catch(console.error);
