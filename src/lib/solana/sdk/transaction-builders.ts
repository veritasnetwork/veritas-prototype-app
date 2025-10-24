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
  ComputeBudgetProgram,
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
  protocolAuthority?: PublicKey; // NEW - pool authority from factory (optional for backward compat)
}

// =========================================================================
// ICBS Trade Types and Interfaces
// =========================================================================

/**
 * Token side for ICBS two-sided market
 */
export enum TokenSide {
  Long = 'Long',
  Short = 'Short',
}

/**
 * Trade type (buy or sell)
 */
export enum TradeType {
  Buy = 'Buy',
  Sell = 'Sell',
}

/**
 * Parameters for building a trade transaction
 */
export interface TradeParams {
  trader: PublicKey;
  contentId: PublicKey;
  side: TokenSide;
  tradeType: TradeType;
  amount: anchor.BN; // USDC for buy (micro-USDC), tokens for sell
  stakeSkim: anchor.BN; // Calculated server-side
  minTokensOut: anchor.BN; // Slippage protection (buys)
  minUsdcOut: anchor.BN; // Slippage protection (sells)
  protocolAuthority: PublicKey; // Pool authority from factory
  usdcMint: PublicKey;
  factoryAddress: PublicKey;
}

// =========================================================================
// Utility Functions
// =========================================================================

/**
 * Converts a UUID (post_id) to a 32-byte content_id PublicKey
 * Used for deriving pool PDAs from post IDs
 */
export function uuidToContentId(postId: string): PublicKey {
  const postIdHex = postId.replace(/-/g, '');
  const postIdBytes = Buffer.from(postIdHex, 'hex'); // 16 bytes
  const contentIdBuffer = Buffer.alloc(32);
  postIdBytes.copy(contentIdBuffer, 0);
  return new PublicKey(contentIdBuffer);
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

  /**
   * Get PoolRegistry PDA (ICBS architecture)
   * Seeds: [b"registry", content_id]
   */
  getPoolRegistryPda(contentId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("registry"), contentId.toBuffer()],
      this.programId
    );
  }

  // =========================================================================
  // ICBS (Inversely Coupled Bonding Surface) PDA Methods
  // =========================================================================

  /**
   * Get ContentPool PDA (ICBS architecture)
   * Seeds: [b"content_pool", content_id]
   */
  getContentPoolPda(contentId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("content_pool"), contentId.toBuffer()],
      this.programId
    );
  }

  /**
   * Get LONG token mint PDA
   * Seeds: [b"long_mint", content_id]
   */
  getLongMintPda(contentId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("long_mint"), contentId.toBuffer()],
      this.programId
    );
  }

  /**
   * Get SHORT token mint PDA
   * Seeds: [b"short_mint", content_id]
   */
  getShortMintPda(contentId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("short_mint"), contentId.toBuffer()],
      this.programId
    );
  }

  /**
   * Get pool vault PDA (ICBS)
   * Seeds: [b"vault", content_id]
   */
  getContentPoolVaultPda(contentId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), contentId.toBuffer()],
      this.programId
    );
  }

  /**
   * Get global custodian PDA (singleton)
   * Seeds: [b"custodian"]
   */
  getGlobalCustodianPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("custodian")],
      this.programId
    );
  }
}

/**
 * Client-side helper to derive all pool-related addresses from a post ID
 * Use this in React components to display addresses without API calls
 */
export function derivePoolAddresses(postId: string, programId: PublicKey) {
  const pdaHelper = new PDAHelper(programId);
  const contentId = uuidToContentId(postId);

  return {
    contentId: contentId.toBase58(),
    pool: pdaHelper.getContentPoolPda(contentId)[0].toBase58(),
    registry: pdaHelper.getPoolRegistryPda(contentId)[0].toBase58(),
    factory: pdaHelper.getFactoryPda()[0].toBase58(),
    custodian: pdaHelper.getGlobalCustodianPda()[0].toBase58(),
    longMint: pdaHelper.getLongMintPda(contentId)[0].toBase58(),
    shortMint: pdaHelper.getShortMintPda(contentId)[0].toBase58(),
    vault: pdaHelper.getContentPoolVaultPda(contentId)[0].toBase58(),
  };
}

// =========================================================================
// Transaction Builders
// =========================================================================

/**
 * Build a create_pool transaction for PoolFactory
 *
 * Creates a ContentPool via the PoolFactory. All ICBS parameters (f, beta_num, beta_den)
 * and limits (min_initial_deposit, min_settle_interval) are set by the factory defaults.
 * Users cannot override these parameters.
 *
 * @param program - Anchor program instance
 * @param creator - Pool creator (also pays for account creation)
 * @param contentId - Content ID as PublicKey (derived from post UUID)
 * @param addresses - Protocol addresses (factory, custodian, etc.)
 * @returns Unsigned transaction (ready for signing)
 */
export async function buildCreatePoolTx(
  program: Program<VeritasCuration>,
  creator: PublicKey,
  contentId: PublicKey,
  addresses: ProtocolAddresses
): Promise<Transaction> {
  const pdaHelper = new PDAHelper(program.programId);

  // Derive all required PDAs
  const [poolPda] = pdaHelper.getContentPoolPda(contentId);
  const [registryPda] = pdaHelper.getPoolRegistryPda(contentId);
  const [custodianPda] = pdaHelper.getGlobalCustodianPda();

  // create_pool only takes content_id as argument
  // Factory defaults (f, beta_num, beta_den, min_settle_interval) are applied automatically
  const tx = await program.methods
    .createPool(contentId)
    .accounts({
      factory: addresses.factoryPda,
      pool: poolPda,
      registry: registryPda,
      custodian: custodianPda,
      creator: creator,
      payer: creator,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  // Add compute budget instruction (300K CU should be sufficient)
  tx.instructions.unshift(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 })
  );

  return tx;
}

// =========================================================================
// ICBS Trade Transaction Builder
// =========================================================================

/**
 * Build a trade transaction for ICBS ContentPool
 *
 * This is the NEW unified trade function that replaces buildBuyTx and buildSellTx.
 * It supports both LONG and SHORT sides, and includes stake skim functionality.
 *
 * @param program - Anchor program instance
 * @param params - Trade parameters
 * @returns Unsigned transaction (ready for signing)
 */
export async function buildTradeTx(
  program: Program<VeritasCuration>,
  params: TradeParams
): Promise<Transaction> {
  const pdaHelper = new PDAHelper(program.programId);

  // Derive PDAs
  const [poolPda] = pdaHelper.getContentPoolPda(params.contentId);
  const [poolVaultPda] = pdaHelper.getContentPoolVaultPda(params.contentId);
  const [custodianPda] = pdaHelper.getGlobalCustodianPda();

  // Determine which token mint to use based on side
  const tokenMintPda = params.side === TokenSide.Long
    ? pdaHelper.getLongMintPda(params.contentId)[0]
    : pdaHelper.getShortMintPda(params.contentId)[0];

  // Get trader's USDC and token accounts
  const traderUsdcAccount = await getAssociatedTokenAddress(
    params.usdcMint,
    params.trader
  );

  const traderTokenAccount = await getAssociatedTokenAddress(
    tokenMintPda,
    params.trader
  );

  // Fetch custodian to get stake vault address
  const custodian = await program.account.veritasCustodian.fetch(custodianPda);
  const stakeVault = custodian.usdcVault;

  // Build transaction
  const tx = new Transaction();

  // Add compute budget instruction (250K CU for trades)
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 })
  );

  // Add trade instruction
  const tradeIx = await program.methods
    .trade(
      params.side === TokenSide.Long ? { long: {} } : { short: {} },
      params.tradeType === TradeType.Buy ? { buy: {} } : { sell: {} },
      params.amount,
      params.stakeSkim,
      params.minTokensOut,
      params.minUsdcOut
    )
    .accounts({
      pool: poolPda,
      factory: params.factoryAddress,
      traderUsdc: traderUsdcAccount,
      vault: poolVaultPda,
      stakeVault: stakeVault,
      traderTokens: traderTokenAccount,
      tokenMint: tokenMintPda,
      usdcMint: params.usdcMint,
      trader: params.trader,
      protocolAuthority: params.protocolAuthority,
      payer: params.trader,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(tradeIx);

  return tx;
}

// =========================================================================
// Deploy Market Transaction Builder
// =========================================================================

/**
 * Parameters for deploying market (initial liquidity)
 */
export interface DeployMarketParams {
  deployer: PublicKey;
  contentId: PublicKey;
  initialDeposit: anchor.BN; // Total USDC to deposit (micro-USDC, min 100 USDC)
  longAllocation: anchor.BN; // USDC allocated to LONG side (micro-USDC)
  usdcMint: PublicKey;
}

/**
 * Build a deploy_market transaction for ContentPool
 *
 * This is the second step after creating a pool via PoolFactory.
 * It deposits initial USDC and mints initial LONG/SHORT tokens.
 *
 * @param program - Anchor program instance
 * @param params - Deploy market parameters
 * @returns Unsigned transaction (ready for signing)
 */
export async function buildDeployMarketTx(
  program: Program<VeritasCuration>,
  params: DeployMarketParams
): Promise<Transaction> {
  const pdaHelper = new PDAHelper(program.programId);

  // Derive PDAs
  const [poolPda] = pdaHelper.getContentPoolPda(params.contentId);
  const [factoryPda] = pdaHelper.getFactoryPda();
  const [longMintPda] = pdaHelper.getLongMintPda(params.contentId);
  const [shortMintPda] = pdaHelper.getShortMintPda(params.contentId);
  const [vaultPda] = pdaHelper.getContentPoolVaultPda(params.contentId);

  // Get deployer's USDC account
  const deployerUsdcAccount = await getAssociatedTokenAddress(
    params.usdcMint,
    params.deployer
  );

  // Get deployer's LONG and SHORT token accounts
  const deployerLongAccount = await getAssociatedTokenAddress(
    longMintPda,
    params.deployer
  );

  const deployerShortAccount = await getAssociatedTokenAddress(
    shortMintPda,
    params.deployer
  );

  // Build transaction
  // Note: deploy_market instruction uses init_if_needed for deployer ATAs
  // so we don't need to manually create them
  const tx = await program.methods
    .deployMarket(params.initialDeposit, params.longAllocation)
    .accounts({
      pool: poolPda,
      factory: factoryPda,
      longMint: longMintPda,
      shortMint: shortMintPda,
      vault: vaultPda,
      deployerUsdc: deployerUsdcAccount,
      deployerLong: deployerLongAccount,
      deployerShort: deployerShortAccount,
      usdcMint: params.usdcMint,
      deployer: params.deployer,
      payer: params.deployer,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  // Add compute budget instruction (600K CU for deploy_market - creates ATAs and mints tokens)
  tx.instructions.unshift(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 })
  );

  return tx;
}


/**
 * Build a transaction to settle a ContentPool epoch
 *
 * Settlement scales virtual reserves based on prediction accuracy using ICBS proper scoring rules.
 * The BD score represents the actual relevance (x), and the market prediction (q) is derived from
 * current reserve ratios. Settlement factors f_L = x/q and f_S = (1-x)/(1-q) are applied to reserves.
 *
 * @param program - The Anchor program instance
 * @param settler - The user who will pay for the transaction
 * @param contentId - The content ID (post ID as PublicKey)
 * @param bdScore - The belief decomposition score (0-1 range, will be converted to micro-units)
 * @param protocolAuthority - The protocol authority that must sign
 * @param factoryAddress - The PoolFactory address
 * @returns Transaction ready to be signed by settler (protocol authority must pre-sign)
 */
export async function buildSettleEpochTx(
  program: Program<VeritasCuration>,
  settler: PublicKey,
  contentId: PublicKey,
  bdScore: number,
  protocolAuthority: PublicKey,
  factoryAddress: PublicKey
): Promise<Transaction> {
  // Validate BD score is in valid range
  if (bdScore < 0 || bdScore > 1) {
    throw new Error(`BD score must be in range [0, 1], got ${bdScore}`);
  }

  // Convert BD score to micro-units (0-1 range to 0-1,000,000 integer)
  // This format matches the smart contract's expectation for u32 BD scores
  const bdScoreMicro = Math.floor(bdScore * 1_000_000);

  // Derive ContentPool PDA
  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("content_pool"), contentId.toBuffer()],
    program.programId
  );

  // Build settle_epoch instruction
  // Note: Only requires pool, factory, protocol_authority, and settler accounts
  const settleEpochIx = await program.methods
    .settleEpoch(bdScoreMicro)
    .accounts({
      pool: poolPda,
      factory: factoryAddress,
      protocolAuthority,
      settler,
    })
    .instruction();

  // Create transaction
  const transaction = new Transaction();
  transaction.add(settleEpochIx);

  return transaction;
}
