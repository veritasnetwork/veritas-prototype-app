/**
 * Check on-chain pool state
 * Usage: npx tsx scripts/check-pool-state.ts <pool_address>
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { VeritasCuration } from '../src/lib/solana/target/types/veritas_curation';
import idl from '../src/lib/solana/target/idl/veritas_curation.json';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';
const PROGRAM_ID = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID || 'GUUnua8NmaJQKvseg1oGXcZn3Ddh1RGrDnaiXRzQUvew';

async function checkPoolState(poolAddress: string) {
  const connection = new Connection(RPC_URL, 'confirmed');
  const programPubkey = new PublicKey(PROGRAM_ID);

  // Create dummy provider for read-only operations
  const provider = new AnchorProvider(
    connection,
    // @ts-expect-error - Dummy wallet for read-only
    { publicKey: PublicKey.default, signTransaction: () => {}, signAllTransactions: () => {} },
    { commitment: 'confirmed' }
  );

  const program = new Program<VeritasCuration>(idl as VeritasCuration, provider);

  // Fetch pool account
  const poolPubkey = new PublicKey(poolAddress);
  const poolAccount = await program.account.contentPool.fetch(poolPubkey);

  console.log('\n========== ON-CHAIN POOL STATE ==========');
  console.log('Pool Address:', poolAddress);
  console.log('\nEpoch Info:');
  console.log('  Current Epoch:', poolAccount.currentEpoch.toString());
  console.log('  Last Settlement:', new Date(poolAccount.lastSettleTime.toNumber() * 1000).toISOString());

  console.log('\nReserves (micro-USDC):');
  const rLong = poolAccount.rLong?.toNumber ? poolAccount.rLong.toNumber() : poolAccount.rLong;
  const rShort = poolAccount.rShort?.toNumber ? poolAccount.rShort.toNumber() : poolAccount.rShort;
  console.log('  R_LONG:', rLong, `($${(rLong / 1_000_000).toFixed(6)})`);
  console.log('  R_SHORT:', rShort, `($${(rShort / 1_000_000).toFixed(6)})`);
  console.log('  Total Reserves:', rLong + rShort, `($${((rLong + rShort) / 1_000_000).toFixed(2)})`);

  console.log('\nSqrt Prices (X96):');
  console.log('  sqrtPriceLongX96:', poolAccount.sqrtPriceLongX96?.toString());
  console.log('  sqrtPriceShortX96:', poolAccount.sqrtPriceShortX96?.toString());

  console.log('\nToken Supply (display units):');
  console.log('  sLong:', poolAccount.sLong?.toString());
  console.log('  sShort:', poolAccount.sShort?.toString());

  console.log('\nICBS Parameters:');
  console.log('  Beta (Q64.64):', poolAccount.beta.toString());
  console.log('  Sigma (Q64.64):', poolAccount.sigma.toString());

  console.log('\nMints:');
  console.log('  LONG Mint:', poolAccount.longMint.toBase58());
  console.log('  SHORT Mint:', poolAccount.shortMint.toBase58());
  console.log('  Vault:', poolAccount.vault.toBase58());

  console.log('\nSettlement Info:');
  console.log('  Min Settle Interval:', poolAccount.minSettleInterval.toString(), 'seconds');
  console.log('  Content ID:', poolAccount.contentId.toBase58());

  // Calculate implied relevance from reserves
  const totalReserves = rLong + rShort;
  const impliedRelevance = totalReserves > 0 ? rLong / totalReserves : 0;
  console.log('\nCalculated Metrics:');
  console.log('  Implied Relevance (from reserves):', (impliedRelevance * 100).toFixed(2) + '%');
  console.log('  Reserve Ratio (LONG/SHORT):', (rLong / rShort).toFixed(4));

  console.log('========================================\n');
}

const poolAddress = process.argv[2];
if (!poolAddress) {
  console.error('Usage: npx tsx scripts/check-pool-state.ts <pool_address>');
  process.exit(1);
}

checkPoolState(poolAddress).catch(console.error);
