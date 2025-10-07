import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { VeritasCuration } from './sdk/types/veritas_curation';
import { buildSellTx, ProtocolAddresses, PDAHelper } from './sdk/transaction-builders';
import { getUsdcMint } from './network-config';
import idl from './target/idl/veritas_curation.json';

/**
 * Build a sell transaction for selling tokens back to a pool
 * This transaction needs to be signed by the user's wallet
 */
export async function buildSellTransaction({
  connection,
  seller,
  postId,
  tokenAmount,
  programId,
}: {
  connection: Connection;
  seller: string; // Base58 wallet address
  postId: string; // UUID string
  tokenAmount: number; // Token amount to sell
  programId: string; // Program ID as base58 string
}) {
  // Convert addresses
  const sellerPubkey = new PublicKey(seller);
  const programPubkey = new PublicKey(programId);

  // Convert UUID to 32-byte buffer (same as buy)
  const postIdBytes16 = Buffer.from(postId.replace(/-/g, ''), 'hex');
  const postIdBytes32 = Buffer.alloc(32);
  postIdBytes16.copy(postIdBytes32, 0);

  // Create dummy wallet for provider (we don't need to sign here)
  const dummyWallet = {
    publicKey: sellerPubkey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };

  // Create provider and program
  const provider = new AnchorProvider(connection, dummyWallet as any, {
    commitment: 'confirmed',
  });
  const program = new Program<VeritasCuration>(
    idl as VeritasCuration,
    provider
  );

  // Derive protocol addresses
  const pdaHelper = new PDAHelper(programPubkey);
  const [configPda] = pdaHelper.getConfigPda();
  const [factoryPda] = pdaHelper.getFactoryPda();
  const [treasuryPda] = pdaHelper.getTreasuryPda();

  // Get USDC mint based on current network
  const usdcMint = getUsdcMint();

  const addresses: ProtocolAddresses = {
    programId: programPubkey,
    configPda,
    factoryPda,
    treasuryPda,
    usdcMint,
  };

  // Build the transaction
  const tokenAmountBn = new anchor.BN(tokenAmount);
  const transaction = await buildSellTx(
    program,
    sellerPubkey,
    postIdBytes32,
    tokenAmountBn,
    addresses
  );

  // Set recent blockhash and fee payer
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = sellerPubkey;

  return transaction;
}
