/**
 * One-time script to fix pool state after manual settlement
 * This manually syncs pool state from chain and creates settlement/relevance records
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { createClient } from '@supabase/supabase-js';
import idl from '../src/lib/solana/target/idl/veritas_curation.json';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const connection = new Connection(RPC_ENDPOINT, 'confirmed');

async function fixPoolState(poolAddress: string) {
  console.log(`\n=== Fixing pool state for ${poolAddress} ===\n`);

  // 1. Fetch on-chain pool state
  const poolPubkey = new PublicKey(poolAddress);

  // Create dummy provider
  const dummyKeypair = anchor.web3.Keypair.generate();
  const wallet = new anchor.Wallet(dummyKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  const program = new anchor.Program(idl as anchor.Idl, provider);

  const poolData = await program.account.contentPool.fetch(poolPubkey) as any;

  console.log('On-chain pool state:');
  console.log('  Current Epoch:', poolData.currentEpoch);
  console.log('  R_long:', poolData.rLong.toString());
  console.log('  R_short:', poolData.rShort.toString());
  console.log('  S_long supply:', poolData.sLongSupply.toString());
  console.log('  S_short supply:', poolData.sShortSupply.toString());

  // 2. Get pool deployment record
  const { data: pool, error: poolError } = await supabase
    .from('pool_deployments')
    .select('*, posts!inner(id), beliefs!inner(id, certainty)')
    .eq('pool_address', poolAddress)
    .single();

  if (poolError || !pool) {
    throw new Error(`Pool not found: ${poolError?.message}`);
  }

  console.log('\nDatabase pool state:');
  console.log('  Post ID:', pool.post_id);
  console.log('  Belief ID:', pool.belief_id);
  console.log('  Current Epoch (DB):', pool.current_epoch);
  console.log('  Certainty (BD score):', pool.beliefs.certainty);

  // 3. Update pool_deployments with on-chain state
  const Q64_ONE = BigInt(1) << BigInt(64);
  const { error: updateError } = await supabase
    .from('pool_deployments')
    .update({
      current_epoch: poolData.currentEpoch,
      last_settlement_epoch: poolData.currentEpoch,
      r_long: Number(poolData.rLong) / 1e6, // micro-USDC to display USDC
      r_short: Number(poolData.rShort) / 1e6, // micro-USDC to display USDC
      s_long_supply: Number(poolData.sLongSupply) / 1e6,
      s_short_supply: Number(poolData.sShortSupply) / 1e6,
      s_scale_long_q64: (BigInt(poolData.sScaleLongQ64.toString()) * BigInt(1e18) / Q64_ONE).toString(),
      s_scale_short_q64: (BigInt(poolData.sScaleShortQ64.toString()) * BigInt(1e18) / Q64_ONE).toString(),
      last_synced_at: new Date().toISOString(),
    })
    .eq('pool_address', poolAddress);

  if (updateError) {
    throw new Error(`Failed to update pool: ${updateError.message}`);
  }

  console.log('\n✅ Updated pool_deployments with on-chain state');

  // 4. Add implied_relevance_history point for the chart
  const rLong = Number(poolData.rLong) / 1e6;
  const rShort = Number(poolData.rShort) / 1e6;
  const totalReserve = rLong + rShort;
  const impliedRelevance = totalReserve > 0 ? rLong / totalReserve : 0.5;

  const { error: relevanceError } = await supabase.rpc('upsert_implied_relevance_server', {
    p_post_id: pool.post_id,
    p_belief_id: pool.belief_id,
    p_implied_relevance: impliedRelevance,
    p_reserve_long: rLong,
    p_reserve_short: rShort,
    p_event_type: 'rebase',
    p_event_reference: `manual_fix_epoch_${poolData.currentEpoch}`,
    p_recorded_at: new Date().toISOString(),
  });

  if (relevanceError) {
    console.error('Failed to add relevance history:', relevanceError);
  } else {
    console.log('✅ Added relevance history point');
    console.log('  Implied Relevance:', impliedRelevance.toFixed(6));
  }

  console.log('\n=== Done ===\n');
}

async function main() {
  const pools = [
    'E4T7vHQxDdKHFjokZ1zuRyLHJihtYkr1ghzKas7Z2je9', // First pool
    'GTCz5cdvJGUT3UBDhRm212aQzTkFB3PQNgFCESj7WEFV', // Second pool
  ];

  for (const pool of pools) {
    try {
      await fixPoolState(pool);
    } catch (error) {
      console.error(`Error fixing pool ${pool}:`, error);
    }
  }
}

main().catch(console.error);