/**
 * Sync pool data from chain when database values are null
 * This is a fallback mechanism for when the event indexer misses the initial deployment
 *
 * Uses the units system and formatPoolAccountData to properly convert units.
 *
 * @param poolAddress - The pool address to sync
 * @param forceUpdate - If true, updates all fields regardless of null status (use after settlements)
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { getPooledConnection } from './connection-pool';
import { formatPoolAccountData } from './sqrt-price-helpers';
import idl from './target/idl/veritas_curation.json';

interface PoolAccountDataForDB {
  sqrtPriceLongX96: string;
  sqrtPriceShortX96: string;
  sLongSupplyDisplay: number; // DISPLAY units for database
  sShortSupplyDisplay: number; // DISPLAY units for database
  vaultBalanceMicro: number; // Micro-USDC for database
  rLong: number; // Display USDC units
  rShort: number; // Display USDC units
  f: number;
  betaNum: number;
  betaDen: number;
  sScaleLongQ64: string;
  sScaleShortQ64: string;
}

/**
 * Parse pool account data using Anchor IDL and convert to database format
 * Uses formatPoolAccountData for proper unit conversion
 */
async function parsePoolAccount(
  poolAddress: PublicKey,
  connection: Connection
): Promise<PoolAccountDataForDB | null> {
  try {
    // Create a dummy wallet for the provider
    const dummyKeypair = Keypair.generate();
    const wallet = {
      publicKey: dummyKeypair.publicKey,
      signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => {
        if ('sign' in tx && typeof tx.sign === 'function') {
          tx.sign([dummyKeypair]);
        }
        return tx;
      },
      signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> => {
        return txs.map(tx => {
          if ('sign' in tx && typeof tx.sign === 'function') {
            tx.sign([dummyKeypair]);
          }
          return tx;
        });
      },
    };

    const provider = new anchor.AnchorProvider(connection, wallet as anchor.Wallet, {});
    const program = new anchor.Program(idl as anchor.Idl, provider);

    // Fetch pool account using Anchor's deserializer
    const poolData = await program.account.contentPool.fetch(poolAddress);

    // Use formatPoolAccountData to handle hex parsing and unit conversion
    const formatted = formatPoolAccountData(poolData);

    console.log('[SyncPool] Parsed pool data:', {
      rLong: formatted._raw.rLong,
      rShort: formatted._raw.rShort,
      poolData_r_long: poolData.r_long,
      poolData_r_short: poolData.r_short,
      poolData_rLong: poolData.rLong,
      poolData_rShort: poolData.rShort
    });

    return {
      sqrtPriceLongX96: formatted._raw.sqrtPriceLongX96,
      sqrtPriceShortX96: formatted._raw.sqrtPriceShortX96,
      sLongSupplyDisplay: formatted._raw.sLong,  // Use display units for DB
      sShortSupplyDisplay: formatted._raw.sShort,  // Use display units for DB
      vaultBalanceMicro: formatted._raw.vaultBalanceMicro,
      rLong: formatted._raw.rLong,  // Display USDC units
      rShort: formatted._raw.rShort,  // Display USDC units
      f: formatted.f,
      betaNum: formatted.betaNum,
      betaDen: formatted.betaDen,
      sScaleLongQ64: formatted.sScaleLongQ64,
      sScaleShortQ64: formatted.sScaleShortQ64,
    };
  } catch (error) {
    console.error('[SyncPool] Error parsing pool account:', error);
    return null;
  }
}

/**
 * Sync pool data from chain to database
 * Only updates null fields, preserves existing data
 */
// In-flight sync tracker to prevent duplicate syncs
const syncInFlight = new Map<string, Promise<{ r_long: number; r_short: number } | null>>();

export async function syncPoolFromChain(
  poolAddress: string,
  connection?: Connection,
  timeoutMs: number = 5000, // DEFENSIVE: 5 second timeout
  forceUpdate: boolean = false // If true, updates all fields regardless of null status
): Promise<{ r_long: number; r_short: number } | null> {
  // DEFENSIVE: Check if sync already in progress for this pool
  if (syncInFlight.has(poolAddress)) {
    return await syncInFlight.get(poolAddress)!;
  }

  // Create sync promise with timeout protection
  const syncPromise = Promise.race([
    doSyncPoolFromChain(poolAddress, connection, forceUpdate),
    new Promise<{ r_long: number; r_short: number } | null>((_, reject) =>
      setTimeout(() => reject(new Error('Pool sync timeout')), timeoutMs)
    )
  ]).catch((error) => {
    // DEFENSIVE: Log error but don't throw - return null so callers can handle gracefully
    console.error('[SyncPool] Sync failed or timed out:', error.message);
    return null;
  });

  syncInFlight.set(poolAddress, syncPromise);

  try {
    return await syncPromise;
  } finally {
    // Clean up tracking when done
    syncInFlight.delete(poolAddress);
  }
}

/**
 * Internal implementation of pool sync
 * Don't call this directly - use syncPoolFromChain() which handles deduplication
 */
async function doSyncPoolFromChain(
  poolAddress: string,
  connection?: Connection,
  forceUpdate: boolean = false
): Promise<{ r_long: number; r_short: number } | null> {
  try {

    // Use provided connection or get from pool (reuses connections)
    const conn = connection || getPooledConnection();

    // Fetch pool account
    const poolPubkey = new PublicKey(poolAddress);
    const poolAccount = await conn.getAccountInfo(poolPubkey);

    if (!poolAccount) {
      console.error('[SyncPool] Pool account not found on chain:', poolAddress);
      return null;
    }


    // Parse actual on-chain data using Anchor IDL
    const poolData = await parsePoolAccount(poolPubkey, conn);

    if (!poolData) {
      console.error('[SyncPool] Failed to parse pool account data');
      return null;
    }


    // Update database - only update null fields
    const supabase = getSupabaseServiceRole();

    // First fetch current data to see what's null
    const { data: currentPool, error: fetchError } = await supabase
      .from('pool_deployments')
      .select('sqrt_price_long_x96, sqrt_price_short_x96, s_long_supply, s_short_supply, vault_balance, r_long, r_short, s_scale_long_q64, s_scale_short_q64')
      .eq('pool_address', poolAddress)
      .single();

    if (fetchError) {
      console.error('[SyncPool] Error fetching current pool data:', fetchError);
      return null;
    }

    // Build update object with only null fields (or all fields if forceUpdate)
    const updates: any = {
      last_synced_at: new Date().toISOString(),
    };

    // ALWAYS update trading state - these change with every trade
    updates.sqrt_price_long_x96 = poolData.sqrtPriceLongX96;
    updates.sqrt_price_short_x96 = poolData.sqrtPriceShortX96;
    updates.s_long_supply = poolData.sLongSupplyDisplay;
    updates.s_short_supply = poolData.sShortSupplyDisplay;
    updates.vault_balance = poolData.vaultBalanceMicro;
    // ALWAYS update reserves - they change with every trade and settlement
    // These are critical for implied relevance calculation
    updates.r_long = poolData.rLong;
    updates.r_short = poolData.rShort;
    if (forceUpdate || currentPool.f === null) {
      updates.f = poolData.f;
    }
    if (forceUpdate || currentPool.beta_num === null) {
      updates.beta_num = poolData.betaNum;
    }
    if (forceUpdate || currentPool.beta_den === null) {
      updates.beta_den = poolData.betaDen;
    }
    if (forceUpdate || currentPool.s_scale_long_q64 === null) {
      updates.s_scale_long_q64 = poolData.sScaleLongQ64;
    }
    if (forceUpdate || currentPool.s_scale_short_q64 === null) {
      updates.s_scale_short_q64 = poolData.sScaleShortQ64;
    }

    console.log('[SyncPool] Updates to apply:', updates);

    // Only update if there are fields to update
    if (Object.keys(updates).length > 1) { // More than just last_synced_at
      const { error: updateError } = await supabase
        .from('pool_deployments')
        .update(updates)
        .eq('pool_address', poolAddress);

      if (updateError) {
        console.error('[SyncPool] Error updating pool:', updateError);
        return null;
      }

    } else {
    }

    // Return r_long and r_short for caller to use
    return {
      r_long: poolData.rLong,
      r_short: poolData.rShort,
    };
  } catch (error) {
    console.error('[SyncPool] Error syncing pool from chain:', error);
    return null;
  }
}