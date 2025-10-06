import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { VeritasCuration } from './sdk/types/veritas_curation';
import { getPoolData, PDAHelper } from './sdk/transaction-builders';
import idl from './target/idl/veritas_curation.json';

const RATIO_PRECISION = 1_000_000n; // From constants.rs

/**
 * Calculate the current price per token for a content pool
 * Pure quadratic bonding curve: Price = k * s^2
 */
export function calculateCurrentPrice(
  tokenSupply: bigint,
  kQuadratic: bigint
): number {
  // Quadratic bonding curve: Price = k * s^2
  const price = kQuadratic * tokenSupply * tokenSupply;
  return Number(price) / 1e6; // Convert from micro-USDC to USDC
}

export interface PoolPriceData {
  currentPrice: number;
  tokenSupply: number;
  reserve: number;
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

    console.log('🔍 Raw pool data from chain:', poolData);

    // Validate pool data has required fields
    if (!poolData) {
      console.error('❌ Pool data is null or undefined');
      return null;
    }

    if (!poolData.tokenSupply || !poolData.reserve) {
      console.error('❌ Pool data is missing required fields:', {
        hasTokenSupply: !!poolData.tokenSupply,
        hasReserve: !!poolData.reserve,
      });
      return null;
    }

    console.log('✅ Pool data validated:', {
      tokenSupply: poolData.tokenSupply.toString(),
      reserve: poolData.reserve.toString(),
    });

    // Convert to bigint for calculations
    const tokenSupply = BigInt(poolData.tokenSupply.toString());
    const reserve = BigInt(poolData.reserve.toString());
    const kQuadratic = BigInt(poolData.kQuadratic.toString());

    console.log('🔍 Converted values:', {
      tokenSupply: tokenSupply.toString(),
      tokenSupplyDisplay: Number(tokenSupply) / 1e6,
      reserve: reserve.toString(),
      reserveDisplay: Number(reserve) / 1e6,
    });

    // Calculate current price
    const currentPrice = calculateCurrentPrice(tokenSupply, kQuadratic);

    return {
      currentPrice,
      tokenSupply: Number(tokenSupply), // Already in token units (not atomic units)
      reserve: Number(reserve) / 1e6, // Convert from micro-USDC to USDC
    };
  } catch (error) {
    console.error('Error fetching pool price:', error);
    return null;
  }
}
