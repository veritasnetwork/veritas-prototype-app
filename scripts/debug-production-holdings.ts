/**
 * Debug script to check production holdings data vs pool metrics
 * Run: npx tsx scripts/debug-production-holdings.ts <username>
 */

import { createClient } from '@supabase/supabase-js';
import { sqrtPriceX96ToPrice } from '../src/lib/solana/sqrt-price-helpers';

const PROD_URL = 'https://gkozygjbhvpakuwzexot.supabase.co';
const PROD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrb3p5Z2piaHZwYWt1d3pleG90Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4MTAyMiwiZXhwIjoyMDcyODU3MDIyfQ.f1Njp3uV94IPL7k2M-gw9kRWQYaBovH1y9W5lI6G9wc';

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: npx tsx scripts/debug-production-holdings.ts <username>');
    process.exit(1);
  }

  const supabase = createClient(PROD_URL, PROD_SERVICE_KEY);

  console.log(`\n🔍 Debugging holdings for user: ${username}\n`);

  // Get user ID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, username')
    .eq('username', username)
    .single();

  if (userError || !user) {
    console.error('❌ User not found:', userError);
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.username} (${user.id})\n`);

  // Get user's holdings
  const { data: balances, error: balancesError } = await supabase
    .from('user_pool_balances')
    .select('*')
    .eq('user_id', user.id)
    .gt('token_balance', 0);

  if (balancesError) {
    console.error('❌ Error fetching balances:', balancesError);
    process.exit(1);
  }

  console.log(`📊 Total holdings: ${balances?.length || 0}\n`);

  if (!balances || balances.length === 0) {
    console.log('No holdings found');
    return;
  }

  // Get unique post IDs
  const postIds = [...new Set(balances.map(b => b.post_id).filter(Boolean))];
  console.log(`📝 Unique posts: ${postIds.length}\n`);

  // Fetch posts with pool data
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select(`
      *,
      total_volume_usdc,
      user:users!posts_user_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      ),
      pool_deployments (
        pool_address,
        s_long_supply,
        s_short_supply,
        sqrt_price_long_x96,
        sqrt_price_short_x96,
        r_long,
        r_short
      )
    `)
    .in('id', postIds);

  if (postsError) {
    console.error('❌ Error fetching posts:', postsError);
    process.exit(1);
  }

  console.log(`✅ Fetched ${posts?.length || 0} posts with pool data\n`);

  // Fetch volume data per token side
  const { data: volumeData, error: volumeError } = await supabase
    .from('trades')
    .select('post_id, side, usdc_amount')
    .in('post_id', postIds);

  console.log(`📈 Trade records found: ${volumeData?.length || 0}\n`);

  // Aggregate volume by post + side
  const volumeMap = new Map<string, number>();
  (volumeData || []).forEach(trade => {
    const key = `${trade.post_id}-${trade.side}`;
    const current = volumeMap.get(key) || 0;
    volumeMap.set(key, current + (Number(trade.usdc_amount) / 1_000_000));
  });

  console.log('📊 Volume Map:');
  volumeMap.forEach((vol, key) => {
    console.log(`  ${key}: $${vol.toFixed(2)}`);
  });
  console.log();

  // Process each holding
  balances.forEach((balance, idx) => {
    const post = posts?.find(p => p.id === balance.post_id);
    if (!post) {
      console.log(`⚠️  Holding ${idx + 1}: Post not found (${balance.post_id})`);
      return;
    }

    const poolData = post.pool_deployments?.[0];
    const content = post.content_text?.substring(0, 60) || post.caption?.substring(0, 60) || 'No content';

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📌 Holding ${idx + 1}: ${balance.token_type} tokens`);
    console.log(`   Post: "${content}..."`);
    console.log(`   Post ID: ${post.id}`);
    console.log(`   Pool Address: ${poolData?.pool_address || 'N/A'}`);
    console.log(`${'='.repeat(80)}`);

    // RAW POOL DATA
    console.log('\n🔢 RAW POOL DATA:');
    console.log(`   sqrt_price_long_x96:  ${poolData?.sqrt_price_long_x96 || 'NULL'}`);
    console.log(`   sqrt_price_short_x96: ${poolData?.sqrt_price_short_x96 || 'NULL'}`);
    console.log(`   r_long:               ${poolData?.r_long || 'NULL'}`);
    console.log(`   r_short:              ${poolData?.r_short || 'NULL'}`);
    console.log(`   s_long_supply:        ${poolData?.s_long_supply || 'NULL'}`);
    console.log(`   s_short_supply:       ${poolData?.s_short_supply || 'NULL'}`);

    // CALCULATED PRICES
    let priceLong = 0;
    let priceShort = 0;

    if (poolData?.sqrt_price_long_x96) {
      try {
        priceLong = sqrtPriceX96ToPrice(poolData.sqrt_price_long_x96);
      } catch (e) {
        console.error('   ❌ Error calculating price_long:', e);
      }
    }

    if (poolData?.sqrt_price_short_x96) {
      try {
        priceShort = sqrtPriceX96ToPrice(poolData.sqrt_price_short_x96);
      } catch (e) {
        console.error('   ❌ Error calculating price_short:', e);
      }
    }

    console.log('\n💵 CALCULATED PRICES:');
    console.log(`   price_long:  $${priceLong.toFixed(6)}`);
    console.log(`   price_short: $${priceShort.toFixed(6)}`);

    // VOLUME DATA
    const volumeKey = `${balance.post_id}-${balance.token_type}`;
    const tokenVolume = volumeMap.get(volumeKey) || 0;

    console.log('\n📊 VOLUME DATA:');
    console.log(`   post.total_volume_usdc: ${post.total_volume_usdc || 'NULL'}`);
    console.log(`   Volume map key:         ${volumeKey}`);
    console.log(`   Token side volume:      $${tokenVolume.toFixed(2)}`);
    console.log(`   All trades for post:`);
    (volumeData || [])
      .filter(t => t.post_id === balance.post_id)
      .forEach(t => {
        console.log(`      ${t.side}: $${(Number(t.usdc_amount) / 1_000_000).toFixed(2)}`);
      });

    // RELEVANCE CALCULATIONS
    const reserveLongUSDC = Number(poolData?.r_long || 0);
    const reserveShortUSDC = Number(poolData?.r_short || 0);
    const totalReserve = reserveLongUSDC + reserveShortUSDC;
    const relevanceFromReserves = totalReserve > 0 ? (reserveLongUSDC / totalReserve) * 100 : 50;

    const totalPrice = priceLong + priceShort;
    const relevanceFromPrices = totalPrice > 0 ? (priceLong / totalPrice) * 100 : 50;

    console.log('\n🎯 RELEVANCE CALCULATIONS:');
    console.log(`   Reserve long (USDC):      ${reserveLongUSDC}`);
    console.log(`   Reserve short (USDC):     ${reserveShortUSDC}`);
    console.log(`   Total reserve (USDC):     ${totalReserve}`);
    console.log(`   From reserves (CORRECT):  ${relevanceFromReserves.toFixed(2)}%`);
    console.log(`   From prices (WRONG):      ${relevanceFromPrices.toFixed(2)}%`);

    // WHAT HOLDINGS API SHOULD RETURN
    console.log('\n📦 WHAT HOLDINGS API RETURNS:');
    console.log(`   token_volume_usdc: ${tokenVolume}`);
    console.log(`   pool.r_long:       ${reserveLongUSDC}`);
    console.log(`   pool.r_short:      ${reserveShortUSDC}`);
    console.log(`   pool.price_long:   ${priceLong}`);
    console.log(`   pool.price_short:  ${priceShort}`);

    // WHAT FRONTEND SHOULD SHOW
    const currentPrice = balance.token_type === 'LONG' ? priceLong : priceShort;
    const currentValue = balance.token_balance * currentPrice;

    console.log('\n🖥️  WHAT FRONTEND SHOULD DISPLAY:');
    console.log(`   Token balance:    ${balance.token_balance}`);
    console.log(`   Current price:    $${currentPrice.toFixed(6)}`);
    console.log(`   Current value:    $${currentValue.toFixed(2)}`);
    console.log(`   Volume (side):    $${tokenVolume.toFixed(2)}`);
    console.log(`   Relevance:        ${relevanceFromReserves.toFixed(1)}%`);
  });

  console.log(`\n${'='.repeat(80)}\n`);
}

main().catch(console.error);
