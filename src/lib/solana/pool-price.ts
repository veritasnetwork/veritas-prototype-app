import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { VeritasCuration } from './sdk/types/veritas_curation';
import { getPoolData, PDAHelper } from './sdk/transaction-builders';
import idl from '../../../solana/veritas-curation/target/idl/veritas_curation.json';

const RATIO_PRECISION = 1_000_000n; // From constants.rs

/**
 * Calculate the current price per token for a content pool
 * Price formula depends on whether we're in quadratic or linear region
 */
export function calculateCurrentPrice(
  tokenSupply: bigint,
  reserve: bigint,
  reserveCap: bigint,
  kQuadratic: bigint,
  linearSlope: bigint,
  virtualLiquidity: bigint
): number {
  // Calculate transition point
  const sTransition = calculateSupplyAtReserveCap(reserveCap, kQuadratic);

  if (reserve >= reserveCap && tokenSupply > sTransition) {
    // Linear region with dampening
    // Price = P_transition + slope * (s - s_transition) * (L / (L + s))
    const priceAtTransition = kQuadratic * sTransition * sTransition;
    const supplyAboveTransition = tokenSupply - sTransition;

    // Calculate dampening factor: L / (L + s)
    const dampening = (virtualLiquidity * RATIO_PRECISION) / (virtualLiquidity + tokenSupply);

    // Price with dampening
    const price = priceAtTransition +
      (linearSlope * supplyAboveTransition * dampening) / RATIO_PRECISION;

    return Number(price) / 1e6; // Convert from micro-USDC to USDC
  } else {
    // Quadratic region
    // Price = k * s^2
    const price = kQuadratic * tokenSupply * tokenSupply;
    return Number(price) / 1e6; // Convert from micro-USDC to USDC
  }
}

/**
 * Calculate the token supply at the reserve cap transition point
 */
function calculateSupplyAtReserveCap(reserveCap: bigint, kQuadratic: bigint): bigint {
  // At transition: reserve_cap = k * s^3 / 3
  // So: s = cbrt(3 * reserve_cap / k)
  const term = (3n * reserveCap) / kQuadratic;
  return integerCbrt(term);
}

/**
 * Integer cube root using Newton's method
 */
function integerCbrt(n: bigint): bigint {
  if (n === 0n) return 0n;
  if (n === 1n) return 1n;

  let x = n;
  let y = (2n * x + n / (x * x)) / 3n;

  while (y < x) {
    x = y;
    y = (2n * x + n / (x * x)) / 3n;
  }

  return x;
}

export interface PoolPriceData {
  currentPrice: number;
  tokenSupply: number;
  reserve: number;
  reserveCap: number;
}

/**
 * Fetch pool data from Solana and calculate current price
 */
export async function fetchPoolPrice(
  connection: Connection,
  postId: string,
  programId: string
): Promise<PoolPriceData | null> {
  try {
    // Create a minimal provider for reading data
    const dummyWallet = {
      publicKey: PublicKey.default,
      signTransaction: async () => { throw new Error('Not implemented'); },
      signAllTransactions: async () => { throw new Error('Not implemented'); }
    };

    const provider = new AnchorProvider(
      connection,
      // @ts-ignore - Dummy wallet for read-only operations
      dummyWallet,
      { commitment: 'confirmed' }
    );

    // Create program instance
    const program = new Program<VeritasCuration>(idl as VeritasCuration, provider);

    // Convert post ID (UUID) to 32-byte buffer
    const postIdBytes16 = Buffer.from(postId.replace(/-/g, ''), 'hex');
    const postIdBytes32 = Buffer.alloc(32);
    postIdBytes16.copy(postIdBytes32, 0);

    // Fetch pool data
    const poolData = await getPoolData(program, postIdBytes32);

    console.log('🔍 Raw pool data from chain:', {
      tokenSupply: poolData.tokenSupply.toString(),
      reserve: poolData.reserve.toString(),
      reserveCap: poolData.reserveCap.toString(),
    });

    // Convert to bigint for calculations
    const tokenSupply = BigInt(poolData.tokenSupply.toString());
    const reserve = BigInt(poolData.reserve.toString());
    const reserveCap = BigInt(poolData.reserveCap.toString());
    const kQuadratic = BigInt(poolData.kQuadratic.toString());
    const linearSlope = BigInt(poolData.linearSlope.toString());
    const virtualLiquidity = BigInt(poolData.virtualLiquidity.toString());

    console.log('🔍 Converted values:', {
      tokenSupply: tokenSupply.toString(),
      tokenSupplyDisplay: Number(tokenSupply) / 1e6,
      reserve: reserve.toString(),
      reserveDisplay: Number(reserve) / 1e6,
    });

    // Calculate current price
    const currentPrice = calculateCurrentPrice(
      tokenSupply,
      reserve,
      reserveCap,
      kQuadratic,
      linearSlope,
      virtualLiquidity
    );

    return {
      currentPrice,
      tokenSupply: Number(tokenSupply) / 1e6, // Convert to regular units
      reserve: Number(reserve) / 1e6, // Convert to USDC
      reserveCap: Number(reserveCap) / 1e6, // Convert to USDC
    };
  } catch (error) {
    console.error('Error fetching pool price:', error);
    return null;
  }
}
