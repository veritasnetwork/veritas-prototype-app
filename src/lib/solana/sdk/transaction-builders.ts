/**
 * Transaction Builders for Next.js Integration
 *
 * These utilities build unsigned transactions that can be signed
 * by the user's wallet in the browser (via Privy/Phantom/etc)
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { VeritasCuration } from "../target/types/veritas_curation";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

export interface ProtocolAddresses {
  programId: PublicKey;
  configPda: PublicKey;
  factoryPda: PublicKey;
  treasuryPda: PublicKey;
  usdcMint: PublicKey;
}

/**
 * Helper to derive PDAs
 */
export class PDAHelper {
  constructor(private programId: PublicKey) {}

  getConfigPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      this.programId
    );
  }

  getFactoryPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("factory")],
      this.programId
    );
  }

  getTreasuryPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      this.programId
    );
  }

  getTreasuryVaultPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("treasury-vault")],
      this.programId
    );
  }

  getPoolPda(postId: Buffer): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), postId],
      this.programId
    );
  }

  getRegistryPda(postId: Buffer): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("registry"), postId],
      this.programId
    );
  }

  getTokenMintPda(postId: Buffer): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("mint"), postId],
      this.programId
    );
  }

  getPoolVaultPda(postId: Buffer): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), postId],
      this.programId
    );
  }

  getCustodianPda(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("custodian"), owner.toBuffer()],
      this.programId
    );
  }

  getCustodianVaultPda(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("custodian-vault"), owner.toBuffer()],
      this.programId
    );
  }
}

/**
 * Initialize a user's custodian account
 */
export async function buildInitializeCustodianTx(
  program: Program<VeritasCuration>,
  owner: PublicKey,
  protocolAuthority: PublicKey,
  usdcMint: PublicKey
): Promise<Transaction> {
  const pdaHelper = new PDAHelper(program.programId);
  const [custodianPda] = pdaHelper.getCustodianPda(owner);
  const [custodianVault] = pdaHelper.getCustodianVaultPda(owner);

  const tx = await program.methods
    .initializeCustodian(owner, protocolAuthority)
    .accounts({
      custodian: custodianPda,
      custodianVault: custodianVault,
      usdcMint: usdcMint,
      owner: owner,
      payer: owner,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .transaction();

  return tx;
}

/**
 * Create a content pool (permissionless)
 */
export async function buildCreatePoolTx(
  program: Program<VeritasCuration>,
  creator: PublicKey,
  postId: Buffer,
  params: {
    initialKQuadratic: anchor.BN;
    tokenName: string;
    tokenSymbol: string;
  },
  addresses: ProtocolAddresses
): Promise<Transaction> {
  const pdaHelper = new PDAHelper(program.programId);

  const [poolPda] = pdaHelper.getPoolPda(postId);
  const [registryPda] = pdaHelper.getRegistryPda(postId);
  const [tokenMintPda] = pdaHelper.getTokenMintPda(postId);
  const [poolVaultPda] = pdaHelper.getPoolVaultPda(postId);

  const postIdArray = Array.from(postId);
  if (postIdArray.length !== 32) {
    throw new Error("Post ID must be exactly 32 bytes");
  }

  // Convert token name/symbol to fixed-size byte arrays
  const tokenNameBytes = Buffer.alloc(32);
  Buffer.from(params.tokenName).copy(tokenNameBytes, 0);
  const tokenSymbolBytes = Buffer.alloc(10);
  Buffer.from(params.tokenSymbol).copy(tokenSymbolBytes, 0);

  const tx = await program.methods
    .createPool(
      postIdArray as number[] & { length: 32 },
      params.initialKQuadratic,
      Array.from(tokenNameBytes) as number[] & { length: 32 },
      Array.from(tokenSymbolBytes) as number[] & { length: 10 }
    )
    .accounts({
      factory: addresses.factoryPda,
      pool: poolPda,
      tokenMint: tokenMintPda,
      poolUsdcVault: poolVaultPda,
      registry: registryPda,
      config: null,  // Optional - set to null since not initialized
      usdcMint: addresses.usdcMint,
      creator: creator,
      payer: creator,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .transaction();

  return tx;
}

/**
 * Deposit USDC into user's custodian
 */
export async function buildDepositTx(
  program: Program<VeritasCuration>,
  owner: PublicKey,
  amount: anchor.BN,
  usdcMint: PublicKey
): Promise<Transaction> {
  const pdaHelper = new PDAHelper(program.programId);
  const [custodianPda] = pdaHelper.getCustodianPda(owner);
  const [custodianVault] = pdaHelper.getCustodianVaultPda(owner);

  const userUsdcAccount = await getAssociatedTokenAddress(usdcMint, owner);

  const tx = await program.methods
    .deposit(amount)
    .accounts({
      custodian: custodianPda,
      custodianVault: custodianVault,
      userUsdcAccount: userUsdcAccount,
      owner: owner,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  return tx;
}

/**
 * Withdraw USDC from user's custodian
 */
export async function buildWithdrawTx(
  program: Program<VeritasCuration>,
  owner: PublicKey,
  amount: anchor.BN,
  recipient: PublicKey,
  usdcMint: PublicKey
): Promise<Transaction> {
  const pdaHelper = new PDAHelper(program.programId);
  const [custodianPda] = pdaHelper.getCustodianPda(owner);
  const [custodianVault] = pdaHelper.getCustodianVaultPda(owner);

  const recipientUsdcAccount = await getAssociatedTokenAddress(usdcMint, recipient);

  const tx = await program.methods
    .withdraw(amount, recipient)
    .accounts({
      custodian: custodianPda,
      custodianVault: custodianVault,
      recipientUsdcAccount: recipientUsdcAccount,
      owner: owner,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  return tx;
}

/**
 * Buy tokens from a pool
 */
export async function buildBuyTx(
  program: Program<VeritasCuration>,
  buyer: PublicKey,
  postId: Buffer,
  usdcAmount: anchor.BN,
  addresses: ProtocolAddresses
): Promise<Transaction> {
  const pdaHelper = new PDAHelper(program.programId);

  const [poolPda] = pdaHelper.getPoolPda(postId);
  const [tokenMintPda] = pdaHelper.getTokenMintPda(postId);
  const [poolVaultPda] = pdaHelper.getPoolVaultPda(postId);

  const buyerUsdcAccount = await getAssociatedTokenAddress(
    addresses.usdcMint,
    buyer,
    false, // allowOwnerOffCurve
    TOKEN_PROGRAM_ID // tokenProgramId
  );
  const buyerTokenAccount = await getAssociatedTokenAddress(
    tokenMintPda,
    buyer,
    false, // allowOwnerOffCurve
    TOKEN_PROGRAM_ID // tokenProgramId
  );

  // Check if USDC account exists
  const connection = program.provider.connection;
  const usdcAccountInfo = await connection.getAccountInfo(buyerUsdcAccount);

  const tx = new Transaction();

  // Create USDC ATA if it doesn't exist
  if (!usdcAccountInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        buyer, // payer
        buyerUsdcAccount, // ata
        buyer, // owner
        addresses.usdcMint, // mint
        TOKEN_PROGRAM_ID // token program - must match mint's program
      )
    );
  }

  // Add buy instruction
  // Note: user_token_account uses init_if_needed in the program, so Anchor creates it automatically
  const buyIx = await program.methods
    .buy(usdcAmount)
    .accounts({
      pool: poolPda,
      tokenMint: tokenMintPda,
      poolUsdcVault: poolVaultPda,
      userUsdcAccount: buyerUsdcAccount,
      userTokenAccount: buyerTokenAccount,
      user: buyer,
      config: addresses.configPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(buyIx);

  return tx;
}

/**
 * Sell tokens back to a pool
 */
export async function buildSellTx(
  program: Program<VeritasCuration>,
  seller: PublicKey,
  postId: Buffer,
  tokenAmount: anchor.BN,
  addresses: ProtocolAddresses
): Promise<Transaction> {
  const pdaHelper = new PDAHelper(program.programId);

  const [poolPda] = pdaHelper.getPoolPda(postId);
  const [tokenMintPda] = pdaHelper.getTokenMintPda(postId);
  const [poolVaultPda] = pdaHelper.getPoolVaultPda(postId);

  const userUsdcAccount = await getAssociatedTokenAddress(addresses.usdcMint, seller);
  const userTokenAccount = await getAssociatedTokenAddress(tokenMintPda, seller);

  const tx = await program.methods
    .sell(tokenAmount)
    .accounts({
      pool: poolPda,
      tokenMint: tokenMintPda,
      poolUsdcVault: poolVaultPda,
      userUsdcAccount: userUsdcAccount,
      userTokenAccount: userTokenAccount,
      user: seller,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  return tx;
}

/**
 * Helper to get pool data
 */
export async function getPoolData(
  program: Program<VeritasCuration>,
  postId: Buffer
) {
  const pdaHelper = new PDAHelper(program.programId);
  const [poolPda] = pdaHelper.getPoolPda(postId);

  return await program.account.contentPool.fetch(poolPda);
}

/**
 * Helper to get custodian data
 */
export async function getCustodianData(
  program: Program<VeritasCuration>,
  owner: PublicKey
) {
  const pdaHelper = new PDAHelper(program.programId);
  const [custodianPda] = pdaHelper.getCustodianPda(owner);

  return await program.account.veritasCustodian.fetch(custodianPda);
}

/**
 * Helper to check if custodian exists
 */
export async function custodianExists(
  program: Program<VeritasCuration>,
  owner: PublicKey
): Promise<boolean> {
  try {
    await getCustodianData(program, owner);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to check if pool exists
 */
export async function poolExists(
  program: Program<VeritasCuration>,
  postId: Buffer
): Promise<boolean> {
  try {
    await getPoolData(program, postId);
    return true;
  } catch {
    return false;
  }
}
