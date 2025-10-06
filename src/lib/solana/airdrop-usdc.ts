import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createMintToInstruction } from '@solana/spl-token';

/**
 * Airdrops test USDC to a user's wallet on localnet
 * This requires the USDC mint authority keypair
 */
export async function airdropTestUSDC({
  connection,
  recipient,
  amount,
  usdcMint,
}: {
  connection: Connection;
  recipient: string; // User's wallet address
  amount: number; // Amount in USDC (e.g., 100 for 100 USDC)
  usdcMint: string; // USDC mint address
}): Promise<string> {
  const recipientPubkey = new PublicKey(recipient);
  const usdcMintPubkey = new PublicKey(usdcMint);

  // Get the user's USDC token account
  const recipientUsdcAccount = await getAssociatedTokenAddress(
    usdcMintPubkey,
    recipientPubkey
  );

  // For localnet, we need the mint authority to sign
  // In production, this would be handled by a backend service with the authority keypair
  // For now, we'll return instructions that need to be signed by the mint authority
  throw new Error(
    'USDC airdrop requires mint authority. Please fund your wallet using the CLI: ' +
    'spl-token mint <USDC_MINT> <AMOUNT> <USER_USDC_ACCOUNT>'
  );
}

/**
 * Builds a transaction to mint test USDC (requires mint authority)
 * This would typically be called by a backend service on localnet/devnet
 */
export async function buildMintUSDCTransaction({
  connection,
  mintAuthority,
  recipient,
  amount,
  usdcMint,
}: {
  connection: Connection;
  mintAuthority: PublicKey;
  recipient: PublicKey;
  amount: number;
  usdcMint: PublicKey;
}): Promise<Transaction> {
  const recipientUsdcAccount = await getAssociatedTokenAddress(
    usdcMint,
    recipient
  );

  const tx = new Transaction();

  // Mint USDC to recipient's account
  tx.add(
    createMintToInstruction(
      usdcMint,
      recipientUsdcAccount,
      mintAuthority,
      amount * 1_000_000 // Convert to base units
    )
  );

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = mintAuthority;

  return tx;
}
