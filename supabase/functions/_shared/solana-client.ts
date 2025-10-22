/**
 * Shared Solana Client Utilities for Edge Functions
 *
 * Provides reusable connection, program, and account fetching utilities.
 * Reduces code duplication across edge functions.
 */

import { Connection, PublicKey } from 'https://esm.sh/@solana/web3.js@1.78.0';
import { Program, AnchorProvider, Wallet } from 'https://esm.sh/@coral-xyz/anchor@0.29.0';

/**
 * Create a read-only Anchor program instance
 *
 * @param rpcEndpoint - Solana RPC endpoint
 * @param programId - Program public key
 * @param idl - Program IDL
 * @returns Configured Anchor program
 */
export function createReadOnlyProgram(
  rpcEndpoint: string,
  programId: PublicKey,
  idl: any
): Program {
  const connection = new Connection(rpcEndpoint, 'confirmed');

  // Create dummy wallet for read-only operations
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async () => {
      throw new Error('Read-only wallet - cannot sign transactions');
    },
    signAllTransactions: async () => {
      throw new Error('Read-only wallet - cannot sign transactions');
    },
  } as Wallet;

  const provider = new AnchorProvider(connection, dummyWallet, {
    commitment: 'confirmed',
  });

  return new Program(idl, programId, provider);
}

/**
 * Fetch ContentPool account data
 *
 * @param program - Anchor program instance
 * @param poolAddress - Pool public key or address string
 * @returns ContentPool account data
 */
export async function fetchContentPool(
  program: Program,
  poolAddress: string | PublicKey
) {
  const poolPubkey = typeof poolAddress === 'string'
    ? new PublicKey(poolAddress)
    : poolAddress;

  return await program.account.contentPool.fetch(poolPubkey);
}

/**
 * Fetch PoolFactory account data
 *
 * @param program - Anchor program instance
 * @param factoryAddress - Factory public key or address string
 * @returns PoolFactory account data
 */
export async function fetchPoolFactory(
  program: Program,
  factoryAddress: string | PublicKey
) {
  const factoryPubkey = typeof factoryAddress === 'string'
    ? new PublicKey(factoryAddress)
    : factoryAddress;

  return await program.account.poolFactory.fetch(factoryPubkey);
}

/**
 * Convert post_id UUID to content_id PublicKey
 *
 * @param postId - UUID string with or without dashes
 * @returns Content ID as PublicKey
 */
export function postIdToContentId(postId: string): PublicKey {
  // Remove dashes from UUID
  const postIdHex = postId.replace(/-/g, '');

  // Convert hex to bytes (16 bytes)
  const postIdBytes = Buffer.from(postIdHex, 'hex');

  // Pad to 32 bytes
  const contentId = Buffer.alloc(32);
  postIdBytes.copy(contentId, 0);

  return new PublicKey(contentId);
}

/**
 * Derive ContentPool PDA
 *
 * @param programId - Program public key
 * @param contentId - Content ID public key
 * @returns Pool PDA and bump
 */
export function derivePoolPDA(
  programId: PublicKey,
  contentId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('content_pool'), contentId.toBuffer()],
    programId
  );
}

/**
 * Derive LONG mint PDA
 *
 * @param programId - Program public key
 * @param contentId - Content ID public key
 * @returns LONG mint PDA and bump
 */
export function deriveLongMintPDA(
  programId: PublicKey,
  contentId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('long_mint'), contentId.toBuffer()],
    programId
  );
}

/**
 * Derive SHORT mint PDA
 *
 * @param programId - Program public key
 * @param contentId - Content ID public key
 * @returns SHORT mint PDA and bump
 */
export function deriveShortMintPDA(
  programId: PublicKey,
  contentId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('short_mint'), contentId.toBuffer()],
    programId
  );
}

/**
 * Derive vault PDA
 *
 * @param programId - Program public key
 * @param contentId - Content ID public key
 * @returns Vault PDA and bump
 */
export function deriveVaultPDA(
  programId: PublicKey,
  contentId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), contentId.toBuffer()],
    programId
  );
}

/**
 * Derive PoolFactory PDA
 *
 * @param programId - Program public key
 * @returns Factory PDA and bump
 */
export function deriveFactoryPDA(
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('factory')],
    programId
  );
}

/**
 * Load Veritas Curation IDL
 *
 * @returns Program IDL
 */
export async function loadVeritasIDL() {
  const idlResponse = await fetch(
    new URL('../../solana/veritas-curation/target/idl/veritas_curation.json', import.meta.url)
  );
  return await idlResponse.json();
}

/**
 * Get configured RPC endpoint from environment
 * Handles Docker localhost translation
 *
 * @returns RPC endpoint URL
 */
export function getRpcEndpoint(): string {
  const endpoint = Deno.env.get('SOLANA_RPC_ENDPOINT') || 'http://127.0.0.1:8899';

  // Convert localhost to host.docker.internal for Docker compatibility
  return endpoint
    .replace('localhost', 'host.docker.internal')
    .replace('127.0.0.1', 'host.docker.internal');
}

/**
 * Get program ID from environment
 *
 * @returns Program public key
 */
export function getProgramId(): PublicKey {
  const programIdStr = Deno.env.get('VERITAS_PROGRAM_ID') ||
                       Deno.env.get('SOLANA_PROGRAM_ID') ||
                       'CuRATjKbbxKDHPShtDvh8L8J7rY7kqRmjXVQWhYSd3nk';
  return new PublicKey(programIdStr);
}
