import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { TestEnvironment } from "./test-environment";

/**
 * Convert a string to a fixed-length byte array, padding with zeros.
 */
export function stringToBytes(str: string, length: number): number[] {
  const bytes = Buffer.from(str, 'utf8');
  const result = new Array(length).fill(0);
  for (let i = 0; i < Math.min(bytes.length, length); i++) {
    result[i] = bytes[i];
  }
  return result;
}

/**
 * Helper class for creating and managing test pools.
 * Ensures pools are properly linked to the shared test environment.
 */
export class TestPool {
  poolPda!: PublicKey;
  tokenMint!: PublicKey;
  usdcVault!: PublicKey;

  constructor(
    private env: TestEnvironment,
    public postId: Buffer,
    public params: {
      kQuadratic: anchor.BN;
      tokenName: string;
      tokenSymbol: string;
    }
  ) {
    this.deriveAddresses();
  }

  private deriveAddresses(): void {
    [this.poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), this.postId],
      this.env.program.programId
    );

    [this.tokenMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint"), this.postId],
      this.env.program.programId
    );

    [this.usdcVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), this.postId],
      this.env.program.programId
    );
  }

  /**
   * Initialize the pool.
   * CRITICAL: Uses shared USDC mint from test environment.
   */
  async initialize(): Promise<void> {
    await this.env.program.methods
      .initializePool(
        Array.from(this.postId),
        this.params.kQuadratic,
        stringToBytes(this.params.tokenName, 32),
        stringToBytes(this.params.tokenSymbol, 10)
      )
      .accounts({
        pool: this.poolPda,
        tokenMint: this.tokenMint,
        usdcVault: this.usdcVault,
        config: null,
        usdcMint: this.env.usdcMint, // Shared USDC mint
        factory: this.env.factoryPda,
        payer: this.env.payer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
  }

  /**
   * Fund the pool with USDC by having a user buy tokens.
   */
  async fundWithBuy(userKeypair: any, userUsdcAccount: PublicKey, amount: anchor.BN): Promise<void> {
    // Get or create user's token account for pool tokens
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.env.provider.connection,
      this.env.payer.payer,
      this.tokenMint,
      userKeypair.publicKey
    );

    await this.env.program.methods
      .buy(amount)
      .accounts({
        pool: this.poolPda,
        tokenMint: this.tokenMint,
        poolUsdcVault: this.usdcVault,
        userUsdcAccount: userUsdcAccount,
        userTokenAccount: userTokenAccount.address,
        user: userKeypair.publicKey,
        config: null,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([userKeypair])
      .rpc();
  }

  /**
   * Apply a penalty to the pool, transferring USDC to treasury.
   * CRITICAL: Uses shared treasury vault from test environment.
   */
  async applyPenalty(amount: anchor.BN): Promise<void> {
    await this.env.program.methods
      .applyPoolPenalty(amount)
      .accounts({
        pool: this.poolPda,
        factory: this.env.factoryPda,
        poolUsdcVault: this.usdcVault,
        treasuryUsdcVault: this.env.treasuryVault, // Shared treasury vault
        authority: this.env.poolAuthority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([this.env.poolAuthority])
      .rpc();
  }

  /**
   * Apply a reward to the pool, minting USDC from treasury.
   * CRITICAL: Uses shared treasury vault from test environment.
   */
  async applyReward(amount: anchor.BN): Promise<void> {
    // First mint USDC to pool vault to simulate reward
    await mintTo(
      this.env.provider.connection,
      this.env.payer.payer,
      this.env.usdcMint,
      this.usdcVault,
      this.env.payer.publicKey,
      Number(amount)
    );

    await this.env.program.methods
      .applyPoolReward(amount)
      .accounts({
        pool: this.poolPda,
        factory: this.env.factoryPda,
        poolUsdcVault: this.usdcVault,
        treasuryUsdcVault: this.env.treasuryVault, // Shared treasury vault
        authority: this.env.poolAuthority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([this.env.poolAuthority])
      .rpc();
  }

  /**
   * Fetch the current pool state.
   */
  async fetch() {
    return this.env.program.account.contentPool.fetch(this.poolPda);
  }
}
