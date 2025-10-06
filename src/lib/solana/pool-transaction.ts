import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { VeritasCuration } from './sdk/types/veritas_curation';
import { buildCreatePoolTx, ProtocolAddresses, PDAHelper } from './sdk/transaction-builders';
import idl from '../../../solana/veritas-curation/target/idl/veritas_curation.json';

// USDC mint addresses by network
const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const USDC_MINT_LOCALNET = new PublicKey('9VPy2f1Sn5N3dp86byQMbpuj9m3KgdtaTusiee15Rrde'); // Mock USDC from deployment

// Default to localnet for now
const USDC_MINT = USDC_MINT_LOCALNET;

export interface CreatePoolParams {
  connection: Connection;
  creator: string; // Creator wallet address (from Privy)
  postId: string; // Post ID (UUID)
  kQuadratic: number;
  reserveCap: number;
  linearSlope?: number;
  virtualLiquidity?: number;
  programId: string;
}

/**
 * Builds a transaction to create a ContentPool on Solana using the SDK.
 * The transaction must be signed by the user's Privy wallet.
 */
export async function buildCreatePoolTransaction(params: CreatePoolParams): Promise<Transaction> {
  const {
    connection,
    creator,
    postId,
    kQuadratic,
    reserveCap,
    programId,
  } = params;

  const creatorPubkey = new PublicKey(creator);
  const programPubkey = new PublicKey(programId);

  // Create a minimal provider for transaction building (wallet will sign later via Privy)
  const provider = new AnchorProvider(
    connection,
    // @ts-ignore - Dummy wallet, actual signing happens via Privy
    { publicKey: creatorPubkey, signTransaction: () => {}, signAllTransactions: () => {} },
    { commitment: 'confirmed' }
  );

  // Create program instance with typed IDL
  const program = new Program<VeritasCuration>(idl as VeritasCuration, provider);

  // Derive protocol PDAs
  const pdaHelper = new PDAHelper(programPubkey);
  const [configPda] = pdaHelper.getConfigPda();
  const [factoryPda] = pdaHelper.getFactoryPda();
  const [treasuryPda] = pdaHelper.getTreasuryPda();

  const protocolAddresses: ProtocolAddresses = {
    programId: programPubkey,
    configPda,
    factoryPda,
    treasuryPda,
    usdcMint: USDC_MINT,
  };

  // Convert UUID to 32-byte buffer (your SDK expects 32 bytes, not 16)
  // UUID is 16 bytes, we'll pad with zeros to make it 32 bytes
  const postIdBytes16 = Buffer.from(postId.replace(/-/g, ''), 'hex');
  const postIdBytes32 = Buffer.alloc(32);
  postIdBytes16.copy(postIdBytes32, 0);

  // Build the transaction using the SDK
  const transaction = await buildCreatePoolTx(
    program,
    creatorPubkey,
    postIdBytes32,
    {
      initialKQuadratic: new BN(kQuadratic),
      reserveCap: new BN(reserveCap),
      tokenName: 'VERITAS', // You can customize this
      tokenSymbol: 'VRT',
    },
    protocolAddresses
  );

  // Set recent blockhash and fee payer
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = creatorPubkey;

  return transaction;
}

/**
 * Derives the pool PDA address for a given post ID (for reference)
 */
export function derivePoolAddress(postId: string, programId: string): PublicKey {
  const postIdBytes = Buffer.from(postId.replace(/-/g, ''), 'hex');
  const programPubkey = new PublicKey(programId);

  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), postIdBytes],
    programPubkey
  );

  return poolPda;
}
