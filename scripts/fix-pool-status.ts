/**
 * Fix pool deployment status by checking on-chain state
 *
 * This script:
 * 1. Fetches all pools with status 'pool_created'
 * 2. Checks on-chain to see if they have liquidity (vault_balance > 0)
 * 3. Updates status to 'market_deployed' if they're actually deployed
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { getSupabaseServiceRole } from '../src/lib/supabase-server';
import { getRpcEndpoint } from '../src/lib/solana/network-config';
import idl from '../src/lib/solana/target/idl/veritas_curation.json';
import { VeritasCuration } from '../src/lib/solana/target/types/veritas_curation';

const PROGRAM_ID = new PublicKey('D1tNYkzevBrxRM9XNALUVAHU4Lg7W7YQkK8eFTxuMhRC');

async function main() {
  console.log('🔍 Checking pool deployment statuses...\n');

  const supabase = getSupabaseServiceRole();

  // Fetch all pools with status 'pool_created'
  const { data: pools, error } = await supabase
    .from('pool_deployments')
    .select('id, pool_address, post_id, deployed_at')
    .eq('status', 'pool_created')
    .order('deployed_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching pools:', error);
    return;
  }

  if (!pools || pools.length === 0) {
    console.log('✅ No pools with status "pool_created" found.');
    return;
  }

  console.log(`📊 Found ${pools.length} pools with status "pool_created"\n`);

  // Set up Solana connection
  const connection = new Connection(getRpcEndpoint(), 'confirmed');
  const provider = new AnchorProvider(connection, {} as any, {});
  const program = new Program(idl as VeritasCuration, provider);

  let updatedCount = 0;
  let failedCount = 0;

  for (const pool of pools) {
    try {
      const poolPubkey = new PublicKey(pool.pool_address);

      // Fetch on-chain pool state
      const poolAccount = await program.account.contentPool.fetch(poolPubkey);

      const vaultBalance = poolAccount.vaultBalance.toNumber();
      const hasLiquidity = vaultBalance > 0;

      console.log(`\n📦 Pool: ${pool.pool_address.slice(0, 12)}...`);
      console.log(`   Vault Balance: ${vaultBalance} micro-USDC (${(vaultBalance / 1_000_000).toFixed(2)} USDC)`);
      console.log(`   Has Liquidity: ${hasLiquidity ? '✅ YES' : '❌ NO'}`);

      if (hasLiquidity) {
        // Pool is deployed - update status
        const { error: updateError } = await supabase
          .from('pool_deployments')
          .update({
            status: 'market_deployed',
            market_deployed_at: pool.deployed_at, // Use deployed_at as fallback since we don't have the exact market deployment time
            vault_balance: vaultBalance,
            s_long_supply: poolAccount.sLong.toString(),
            s_short_supply: poolAccount.sShort.toString(),
            sqrt_price_long_x96: poolAccount.sqrtPriceLongX96.toString(),
            sqrt_price_short_x96: poolAccount.sqrtPriceShortX96.toString(),
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', pool.id);

        if (updateError) {
          console.error(`   ❌ Error updating pool: ${updateError.message}`);
          failedCount++;
        } else {
          console.log(`   ✅ Updated to 'market_deployed'`);
          updatedCount++;
        }
      } else {
        console.log(`   ⏭️  Skipping (no liquidity)`);
      }
    } catch (err) {
      console.error(`   ❌ Error checking pool ${pool.pool_address}:`, err instanceof Error ? err.message : err);
      failedCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Updated: ${updatedCount} pools`);
  console.log(`❌ Failed: ${failedCount} pools`);
  console.log(`⏭️  Skipped: ${pools.length - updatedCount - failedCount} pools (no liquidity)`);
  console.log('='.repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
