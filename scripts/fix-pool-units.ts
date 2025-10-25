/**
 * Fix pool units in database
 * Converts on-chain display units to database atomic units
 */

import { createClient } from '@supabase/supabase-js';
import { Connection, PublicKey } from '@solana/web3.js';
import { formatPoolAccountData } from '../src/lib/solana/sqrt-price-helpers';
import * as anchor from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import idl from '../src/lib/solana/target/idl/veritas_curation.json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const connection = new Connection('http://127.0.0.1:8899', 'confirmed');

async function fixPoolUnits() {
  // Get all pools
  const { data: pools, error } = await supabase
    .from('pool_deployments')
    .select('pool_address')
    .order('deployed_at', { ascending: false });

  if (error) {
    console.error('Error fetching pools:', error);
    return;
  }

  console.log(`Found ${pools?.length || 0} pools to fix\n`);

  for (const pool of pools || []) {
    console.log(`\nFixing pool: ${pool.pool_address}`);

    try {
      // Fetch from chain
      const poolPubkey = new PublicKey(pool.pool_address);

      const dummyKeypair = Keypair.generate();
      const wallet = {
        publicKey: dummyKeypair.publicKey,
        signTransaction: async (tx: any) => { tx.sign([dummyKeypair]); return tx; },
        signAllTransactions: async (txs: any[]) => txs.map(tx => { tx.sign([dummyKeypair]); return tx; }),
      };

      const provider = new anchor.AnchorProvider(connection, wallet as any, {});
      const program = new anchor.Program(idl as any, provider);

      const poolData = await program.account.contentPool.fetch(poolPubkey);
      const formatted = formatPoolAccountData(poolData);

      console.log('On-chain data (display units):');
      console.log(`  s_long: ${formatted._raw.sLong}`);
      console.log(`  s_short: ${formatted._raw.sShort}`);
      console.log(`  vault_balance: ${formatted.vaultBalance} USDC`);

      console.log('\nConverted to database format (atomic units):');
      console.log(`  s_long_supply: ${formatted._raw.sLongAtomic}`);
      console.log(`  s_short_supply: ${formatted._raw.sShortAtomic}`);
      console.log(`  vault_balance: ${formatted._raw.vaultBalanceMicro}`);

      // Update database
      const { error: updateError } = await supabase
        .from('pool_deployments')
        .update({
          s_long_supply: formatted._raw.sLongAtomic,
          s_short_supply: formatted._raw.sShortAtomic,
          vault_balance: formatted._raw.vaultBalanceMicro,
          sqrt_price_long_x96: formatted._raw.sqrtPriceLongX96,
          sqrt_price_short_x96: formatted._raw.sqrtPriceShortX96,
          f: formatted.f,
          beta_num: formatted.betaNum,
          beta_den: formatted.betaDen,
          last_synced_at: new Date().toISOString(),
        })
        .eq('pool_address', pool.pool_address);

      if (updateError) {
        console.error('  ❌ Update failed:', updateError);
      } else {
        console.log('  ✅ Pool updated successfully');

        // Calculate expected metrics
        console.log('\nExpected UI metrics:');
        console.log(`  Supply: ${formatted.totalSupply} tokens`);
        console.log(`  Price Long: $${formatted.priceLong.toFixed(6)}`);
        console.log(`  Price Short: $${formatted.priceShort.toFixed(6)}`);
        console.log(`  Market Cap: $${formatted.totalMarketCap.toFixed(2)}`);
      }
    } catch (error) {
      console.error('  ❌ Error:', error);
    }
  }
}

fixPoolUnits().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
