/**
 * Sync pool data from chain when database values are null
 * This is a fallback mechanism for when the event indexer misses the initial deployment
 *
 * Uses the units system and formatPoolAccountData to properly convert units.
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
  sLongSupplyAtomic: number; // Atomic units for database
  sShortSupplyAtomic: number; // Atomic units for database
  vaultBalanceMicro: number; // Micro-USDC for database
  f: number;
  betaNum: number;
  betaDen: number;
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

    return {
      sqrtPriceLongX96: formatted._raw.sqrtPriceLongX96,
      sqrtPriceShortX96: formatted._raw.sqrtPriceShortX96,
      sLongSupplyAtomic: formatted._raw.sLongAtomic,
      sShortSupplyAtomic: formatted._raw.sShortAtomic,
      vaultBalanceMicro: formatted._raw.vaultBalanceMicro,
      f: formatted.f,
      betaNum: formatted.betaNum,
      betaDen: formatted.betaDen,
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
const syncInFlight = new Map<string, Promise<boolean>>();

export async function syncPoolFromChain(
  poolAddress: string,
  connection?: Connection,
  timeoutMs: number = 5000 // DEFENSIVE: 5 second timeout
): Promise<boolean> {
  // DEFENSIVE: Check if sync already in progress for this pool
  if (syncInFlight.has(poolAddress)) {
    console.log('[SyncPool] Sync already in progress, waiting for existing sync:', poolAddress);
    return await syncInFlight.get(poolAddress)!;
  }

  // Create sync promise with timeout protection
  const syncPromise = Promise.race([
    doSyncPoolFromChain(poolAddress, connection),
    new Promise<boolean>((_, reject) =>
      setTimeout(() => reject(new Error('Pool sync timeout')), timeoutMs)
    )
  ]).catch((error) => {
    // DEFENSIVE: Log error but don't throw - return false so callers can handle gracefully
    console.error('[SyncPool] Sync failed or timed out:', error.message);
    return false;
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
  connection?: Connection
): Promise<boolean> {
  try {
    console.log('[SyncPool] Syncing pool from chain:', poolAddress);

    // Use provided connection or get from pool (reuses connections)
    const conn = connection || getPooledConnection();

    // Fetch pool account
    const poolPubkey = new PublicKey(poolAddress);
    const poolAccount = await conn.getAccountInfo(poolPubkey);

    if (!poolAccount) {
      console.error('[SyncPool] Pool account not found on chain:', poolAddress);
      return false;
    }

    console.log('[SyncPool] Pool account found, size:', poolAccount.data.length);

    // Parse actual on-chain data using Anchor IDL
    const poolData = await parsePoolAccount(poolPubkey, conn);

    if (!poolData) {
      console.error('[SyncPool] Failed to parse pool account data');
      return false;
    }

    console.log('[SyncPool] Parsed pool data:', poolData);

    // Update database - only update null fields
    const supabase = getSupabaseServiceRole();

    // First fetch current data to see what's null
    const { data: currentPool, error: fetchError } = await supabase
      .from('pool_deployments')
      .select('sqrt_price_long_x96, sqrt_price_short_x96, s_long_supply, s_short_supply, vault_balance')
      .eq('pool_address', poolAddress)
      .single();

    if (fetchError) {
      console.error('[SyncPool] Error fetching current pool data:', fetchError);
      return false;
    }

    // Build update object with only null fields
    const updates: any = {
      last_synced_at: new Date().toISOString(),
    };

    if (currentPool.sqrt_price_long_x96 === null) {
      updates.sqrt_price_long_x96 = poolData.sqrtPriceLongX96;
    }
    if (currentPool.sqrt_price_short_x96 === null) {
      updates.sqrt_price_short_x96 = poolData.sqrtPriceShortX96;
    }
    if (currentPool.s_long_supply === null) {
      updates.s_long_supply = poolData.sLongSupplyAtomic;
    }
    if (currentPool.s_short_supply === null) {
      updates.s_short_supply = poolData.sShortSupplyAtomic;
    }
    if (currentPool.vault_balance === null) {
      updates.vault_balance = poolData.vaultBalanceMicro;
    }
    if (currentPool.f === null) {
      updates.f = poolData.f;
    }
    if (currentPool.beta_num === null) {
      updates.beta_num = poolData.betaNum;
    }
    if (currentPool.beta_den === null) {
      updates.beta_den = poolData.betaDen;
    }

    // Only update if there are fields to update
    if (Object.keys(updates).length > 1) { // More than just last_synced_at
      const { error: updateError } = await supabase
        .from('pool_deployments')
        .update(updates)
        .eq('pool_address', poolAddress);

      if (updateError) {
        console.error('[SyncPool] Error updating pool:', updateError);
        return false;
      }

      console.log('[SyncPool] Pool synced successfully, updated fields:', Object.keys(updates));
    } else {
      console.log('[SyncPool] No null fields to update');
    }

    return true;
  } catch (error) {
    console.error('[SyncPool] Error syncing pool from chain:', error);
    return false;
  }
}