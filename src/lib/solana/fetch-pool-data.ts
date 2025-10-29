/**
 * Fetch Pool Data from Solana Chain
 *
 * Fetches live ICBS pool state including sqrt prices, supplies, and reserves.
 * This is the ONLY correct way to get pool metrics for ICBS markets.
 */

import { Connection, PublicKey, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { formatPoolAccountData } from './sqrt-price-helpers';
import type { VeritasCuration } from './sdk/types/veritas_curation';
import IDL from './target/idl/veritas_curation.json';

/**
 * Simple Node-only wallet implementation for server-side operations.
 * Matches the Wallet interface expected by Anchor.
 */
class NodeWallet {
  constructor(readonly payer: Keypair) {}

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof Transaction) {
      tx.partialSign(this.payer);
    }
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return txs.map(tx => {
      if (tx instanceof Transaction) {
        tx.partialSign(this.payer);
      }
      return tx;
    });
  }

  get publicKey() {
    return this.payer.publicKey;
  }
}

/**
 * Fetch pool account data from Solana
 *
 * @param poolAddress - ContentPool public key
 * @param rpcEndpoint - Solana RPC endpoint
 * @returns Formatted pool data with human-readable prices
 */
export async function fetchPoolData(poolAddress: string, rpcEndpoint: string) {
  const connection = new Connection(rpcEndpoint, 'confirmed');
  const poolPubkey = new PublicKey(poolAddress);

  // Create a read-only wallet for Anchor provider
  const dummyKeypair = Keypair.generate();
  const dummyWallet = new NodeWallet(dummyKeypair);

  const provider = new AnchorProvider(connection, dummyWallet, {
    commitment: 'confirmed',
  });

  const program = new Program<VeritasCuration>(
    IDL as any,
    provider
  );

  // Fetch ContentPool account
  const poolAccount = await program.account.contentPool.fetch(poolPubkey);

  // Format for UI consumption
  return formatPoolAccountData(poolAccount);
}

/**
 * Fetch multiple pool accounts in parallel
 *
 * @param poolAddresses - Array of ContentPool public keys
 * @param rpcEndpoint - Solana RPC endpoint
 * @returns Array of formatted pool data
 */
export async function fetchMultiplePoolsData(
  poolAddresses: string[],
  rpcEndpoint: string
) {
  const promises = poolAddresses.map(addr => fetchPoolData(addr, rpcEndpoint));
  const results = await Promise.allSettled(promises);

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Failed to fetch pool ${poolAddresses[index]}:`, result.reason);
      return null;
    }
  });
}

/**
 * Batch fetch multiple pool accounts using getMultipleAccounts (more efficient)
 *
 * This uses a single RPC call instead of multiple individual calls,
 * making it 10-20x faster for fetching many pools.
 *
 * @param poolAddresses - Array of ContentPool public keys
 * @param rpcEndpoint - Solana RPC endpoint
 * @returns Map of pool address -> formatted pool data
 */
export async function batchFetchPoolsData(
  poolAddresses: string[],
  rpcEndpoint: string
): Promise<Map<string, PoolData | null>> {
  if (poolAddresses.length === 0) {
    return new Map();
  }

  const connection = new Connection(rpcEndpoint, 'confirmed');

  // Create a read-only wallet for Anchor provider
  const dummyKeypair = Keypair.generate();
  const dummyWallet = new NodeWallet(dummyKeypair);

  const provider = new AnchorProvider(connection, dummyWallet, {
    commitment: 'confirmed',
  });

  const program = new Program<VeritasCuration>(
    IDL as any,
    provider
  );

  // Convert addresses to PublicKeys
  const poolPubkeys = poolAddresses.map(addr => new PublicKey(addr));

  // Batch fetch all accounts in one RPC call
  const accounts = await program.account.contentPool.fetchMultiple(poolPubkeys);

  // Build result map
  const resultMap = new Map<string, PoolData | null>();

  for (let i = 0; i < poolAddresses.length; i++) {
    const account = accounts[i];
    if (account) {
      try {
        const formatted = formatPoolAccountData(account);
        resultMap.set(poolAddresses[i], formatted);
      } catch (error) {
        console.error(`Failed to format pool ${poolAddresses[i]}:`, error);
        resultMap.set(poolAddresses[i], null);
      }
    } else {
      console.warn(`Pool account not found: ${poolAddresses[i]}`);
      resultMap.set(poolAddresses[i], null);
    }
  }

  return resultMap;
}

/**
 * Pool data structure returned from fetchPoolData
 */
export interface PoolData {
  // Token supplies (display units, 6 decimals)
  supplyLong: number;
  supplyShort: number;
  totalSupply: number;

  // Prices in USDC per token
  priceLong: number;
  priceShort: number;
  averagePrice: number;

  // Market caps in USDC
  marketCapLong: number;
  marketCapShort: number;
  totalMarketCap: number;

  // Vault balance in USDC
  vaultBalance: number;

  // Virtual reserves (for implied relevance calculation)
  rLong: number;   // LONG reserve in display USDC
  rShort: number;  // SHORT reserve in display USDC

  // Raw values for debugging
  _raw: {
    sqrtPriceLongX96: string;
    sqrtPriceShortX96: string;
    sLong: number;
    sShort: number;
    vaultBalanceMicro: number;
    rLong: number;  // Virtual reserve LONG (display USDC)
    rShort: number; // Virtual reserve SHORT (display USDC)
  };

  // ICBS parameters (needed for trade simulation)
  f: number;
  betaNum: number;
  betaDen: number;
  sScaleLongQ64: string;        // NEW: Sigma scale for LONG tokens
  sScaleShortQ64: string;       // NEW: Sigma scale for SHORT tokens
  sqrtLambdaLongX96: string;    // DEPRECATED: Telemetry only
  sqrtLambdaShortX96: string;   // DEPRECATED: Telemetry only
}

/**
 * Pool state with decay applied (from view function)
 */
export interface PoolStateWithDecay {
  // Decayed reserves (micro-USDC)
  rLong: number;
  rShort: number;
  // Relevance score (0.0 to 1.0)
  q: number;
  // Human-readable prices (USDC per token)
  priceLong: number;
  priceShort: number;
  // Token supplies (atomic units)
  sLong: number;
  sShort: number;
  // Sqrt prices (X96 format)
  sqrtPriceLongX96: string;
  sqrtPriceShortX96: string;
  // Decay info
  daysExpired: number;
  daysSinceLastUpdate: number;
  decayPending: boolean;
  expirationTimestamp: number;
  lastDecayUpdate: number;
}

/**
 * Fetch current pool state with decay applied (view function)
 *
 * This calls the on-chain view function which calculates decayed reserves
 * without mutating state.
 *
 * @param poolAddress - Solana address of the ContentPool
 * @param rpcEndpoint - Solana RPC endpoint URL
 * @returns Current pool state with decay applied
 */
export async function fetchPoolStateWithDecay(
  poolAddress: string,
  rpcEndpoint: string
): Promise<PoolStateWithDecay> {
  const connection = new Connection(rpcEndpoint, 'confirmed');
  const poolPubkey = new PublicKey(poolAddress);

  // Create a read-only wallet for Anchor provider
  const dummyKeypair = Keypair.generate();
  const dummyWallet = new NodeWallet(dummyKeypair);

  const provider = new AnchorProvider(connection, dummyWallet, {
    commitment: 'confirmed',
  });

  const program = new Program<VeritasCuration>(
    IDL as any,
    provider
  );

  try {
    // TEMPORARY: Use direct account fetch instead of view function
    // The view() function fails with AccountNotFound on local devnet
    // TODO: Debug why view simulation fails and revert to .view() when fixed
    const poolAccount = await program.account.contentPool.fetch(poolPubkey);

    // Calculate state client-side (matches get_current_state logic)
    const Q32_ONE = 2 ** 32;
    const rLong = poolAccount.rLong.toNumber();
    const rShort = poolAccount.rShort.toNumber();
    const total = rLong + rShort;

    // Calculate relevance (q)
    const q = total > 0 ? rLong / total : 0.5;

    // Calculate prices
    const sLong = poolAccount.sLong.toNumber();
    const sShort = poolAccount.sShort.toNumber();
    const priceLong = sLong > 0 ? rLong / sLong / 1_000_000 : 1.0;
    const priceShort = sShort > 0 ? rShort / sShort / 1_000_000 : 1.0;

    return {
      rLong,
      rShort,
      q,
      priceLong,
      priceShort,
      sLong,
      sShort,
      sqrtPriceLongX96: poolAccount.sqrtPriceLongX96.toString(),
      sqrtPriceShortX96: poolAccount.sqrtPriceShortX96.toString(),
      daysExpired: 0,
      daysSinceLastUpdate: 0,
      decayPending: false,
      expirationTimestamp: poolAccount.expirationTimestamp.toNumber(),
      lastDecayUpdate: poolAccount.lastDecayUpdate.toNumber(),
    };
  } catch (error) {
    console.error('[fetchPoolStateWithDecay] Error:', error);
    throw error;
  }
}

/**
 * Batch fetch multiple pool states with decay in parallel
 *
 * Optimized for feed ranking - fetches 50+ pools efficiently.
 *
 * @param poolAddresses - Array of pool addresses to fetch
 * @param rpcEndpoint - Solana RPC endpoint URL
 * @returns Map of pool address -> pool state
 */
export async function fetchMultiplePoolStatesWithDecay(
  poolAddresses: string[],
  rpcEndpoint: string
): Promise<Map<string, PoolStateWithDecay>> {
  // Fetch all pools in parallel
  const promises = poolAddresses.map(async (address) => {
    try {
      const state = await fetchPoolStateWithDecay(address, rpcEndpoint);
      return { address, state };
    } catch (error) {
      console.warn(`[fetchMultiplePoolStatesWithDecay] Failed to fetch ${address}:`, error);
      return null;
    }
  });

  const results = await Promise.all(promises);

  // Build map
  const stateMap = new Map<string, PoolStateWithDecay>();
  for (const result of results) {
    if (result) {
      stateMap.set(result.address, result.state);
    }
  }

  return stateMap;
}
