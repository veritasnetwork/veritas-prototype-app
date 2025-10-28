import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find posts with 0 supplies
  const { data: pools, error } = await supabase
    .from('pool_deployments')
    .select('*')
    .eq('s_long_supply', 0)
    .eq('s_short_supply', 0);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n=== Posts with 0 LONG and SHORT supplies ===\n`);
  console.log(`Found ${pools?.length || 0} pools\n`);

  for (const pool of pools || []) {
    // Get post details
    const { data: post } = await supabase
      .from('posts')
      .select('id, title, content_text')
      .eq('belief_id', pool.belief_id)
      .single();

    const longPrice = pool.sqrt_price_long_x96 ? (Number(pool.sqrt_price_long_x96) / (2**96)) ** 2 : 0;
    const shortPrice = pool.sqrt_price_short_x96 ? (Number(pool.sqrt_price_short_x96) / (2**96)) ** 2 : 0;
    const impliedRelevance = longPrice / (longPrice + shortPrice);

    console.log(`Post: ${post?.title || 'N/A'} (belief_id: ${pool.belief_id})`);
    console.log(`  Pool Address: ${pool.pool_address}`);
    console.log(`  LONG Supply: ${pool.s_long_supply} (${(pool.s_long_supply / 1_000_000).toFixed(2)} display)`);
    console.log(`  SHORT Supply: ${pool.s_short_supply} (${(pool.s_short_supply / 1_000_000).toFixed(2)} display)`);
    console.log(`  Vault Balance: ${pool.vault_balance} micro-USDC ($${(pool.vault_balance / 1_000_000).toFixed(2)})`);
    console.log(`  LONG Price (from sqrt): $${longPrice.toFixed(4)}`);
    console.log(`  SHORT Price (from sqrt): $${shortPrice.toFixed(4)}`);
    console.log(`  Implied Relevance: ${(impliedRelevance * 100).toFixed(2)}%`);
    console.log(`  R_long: ${pool.r_long}`);
    console.log(`  R_short: ${pool.r_short}`);
    console.log(`  Status: ${pool.status}`);

    // Check trade history for this pool
    const { data: trades } = await supabase
      .from('trades')
      .select('*')
      .eq('pool_address', pool.pool_address)
      .order('executed_at', { ascending: true });

    console.log(`  Trade History (${trades?.length || 0} trades):`);
    if (trades && trades.length > 0) {
      for (const trade of trades) {
        console.log(`    - ${trade.trade_type} ${trade.token_type}: ${(trade.token_amount / 1_000_000).toFixed(6)} tokens for $${(trade.usdc_amount / 1_000_000).toFixed(2)}`);
      }
    }
    console.log('');
  }

  // Also check all pools with vault_balance < $1
  const { data: lowLiqPools, error: lowLiqError } = await supabase
    .from('pool_deployments')
    .select('*')
    .lt('vault_balance', 1_000_000);

  if (lowLiqError) {
    console.error('Error:', lowLiqError);
    return;
  }

  console.log(`\n=== Posts with < $1 vault balance ===\n`);
  console.log(`Found ${lowLiqPools?.length || 0} pools\n`);

  for (const pool of lowLiqPools || []) {
    // Get post details
    const { data: post } = await supabase
      .from('posts')
      .select('id, title, content_text')
      .eq('belief_id', pool.belief_id)
      .single();

    const longPrice = pool.sqrt_price_long_x96 ? (Number(pool.sqrt_price_long_x96) / (2**96)) ** 2 : 0;
    const shortPrice = pool.sqrt_price_short_x96 ? (Number(pool.sqrt_price_short_x96) / (2**96)) ** 2 : 0;
    const impliedRelevance = longPrice / (longPrice + shortPrice);

    console.log(`Post: ${post?.title || 'N/A'} (belief_id: ${pool.belief_id})`);
    console.log(`  Pool Address: ${pool.pool_address}`);
    console.log(`  LONG Supply: ${pool.s_long_supply} (${(pool.s_long_supply / 1_000_000).toFixed(2)} display)`);
    console.log(`  SHORT Supply: ${pool.s_short_supply} (${(pool.s_short_supply / 1_000_000).toFixed(2)} display)`);
    console.log(`  Vault Balance: ${pool.vault_balance} micro-USDC ($${(pool.vault_balance / 1_000_000).toFixed(2)})`);
    console.log(`  LONG Price (from sqrt): $${longPrice.toFixed(4)}`);
    console.log(`  SHORT Price (from sqrt): $${shortPrice.toFixed(4)}`);
    console.log(`  Implied Relevance: ${(impliedRelevance * 100).toFixed(2)}%`);
    console.log(`  Status: ${pool.status}`);
    console.log('');
  }
}

main().catch(console.error);
