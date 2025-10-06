import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { VeritasCuration } from "../../target/types/veritas_curation";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
} from "@solana/spl-token";
import { TEST_POOL_AUTHORITY } from "./test-keypairs";

/**
 * Shared test environment for all Solana tests.
 * Ensures proper initialization of interconnected modules:
 * - Single USDC mint shared across all modules
 * - Factory initialization
 * - Treasury initialization with proper USDC vault
 * - Consistent PDA derivation
 */
export class TestEnvironment {
  // Core Anchor objects
  provider: AnchorProvider;
  program: Program<VeritasCuration>;
  payer: Wallet;

  // Shared infrastructure
  usdcMint!: PublicKey;
  factoryPda!: PublicKey;
  treasuryPda!: PublicKey;
  treasuryVault!: PublicKey;

  // Test authorities
  poolAuthority: Keypair;

  private constructor() {
    this.provider = anchor.AnchorProvider.env();
    anchor.setProvider(this.provider);
    this.program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;
    this.payer = this.provider.wallet as Wallet;
    this.poolAuthority = TEST_POOL_AUTHORITY;
  }

  /**
   * Creates and initializes a complete test environment.
   * CRITICAL: This must be called once per test suite in a before() hook.
   */
  static async setup(): Promise<TestEnvironment> {
    const env = new TestEnvironment();

    // 1. Derive all PDAs first
    [env.factoryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("factory")],
      env.program.programId
    );

    [env.treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      env.program.programId
    );

    [env.treasuryVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_vault")],
      env.program.programId
    );

    console.log("PDAs derived:");
    console.log("  Factory:", env.factoryPda.toString());
    console.log("  Treasury:", env.treasuryPda.toString());
    console.log("  Treasury Vault:", env.treasuryVault.toString());

    // 2. Create USDC mint (or reuse existing from treasury vault)
    console.log("Setting up USDC mint...");
    env.usdcMint = await createMint(
      env.provider.connection,
      env.payer.payer,
      env.payer.publicKey,
      null,
      6 // USDC decimals
    );
    console.log("USDC mint created:", env.usdcMint.toString());

    // 3. Initialize Factory
    await env.initializeFactory();

    // 4. Initialize Treasury with USDC vault (may update usdcMint if already exists)
    await env.initializeTreasury();

    // 5. Verify setup is correct
    await env.verifySetup();

    console.log("TestEnvironment setup complete");
    console.log("  Using USDC mint:", env.usdcMint.toString());
    return env;
  }

  private async initializeFactory(): Promise<void> {
    console.log("Initializing factory...");
    try {
      await this.program.methods
        .initializeFactory(this.payer.publicKey, this.poolAuthority.publicKey)
        .accounts({
          factory: this.factoryPda,
          payer: this.payer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("Factory initialized");
    } catch (e: any) {
      if (e.toString().includes("already in use")) {
        console.log("Factory already initialized");
      } else {
        throw e;
      }
    }
  }

  private async initializeTreasury(): Promise<void> {
    console.log("Initializing treasury...");
    try {
      await this.program.methods
        .initializeTreasury()
        .accounts({
          treasury: this.treasuryPda,
          usdcVault: this.treasuryVault,
          usdcMint: this.usdcMint, // CRITICAL: Use shared USDC mint
          authority: this.payer.publicKey,
          payer: this.payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      console.log("Treasury initialized");
      return; // Successfully initialized, return true
    } catch (e: any) {
      if (e.toString().includes("already in use")) {
        console.log("Treasury already initialized (from previous test run)");
        // Read the existing treasury vault to use its mint
        const vaultAccount = await getAccount(
          this.provider.connection,
          this.treasuryVault
        );
        // Update our USDC mint to match the existing treasury vault
        console.log(`Using existing USDC mint: ${vaultAccount.mint.toString()}`);
        this.usdcMint = vaultAccount.mint;
        return; // Already initialized, return false
      } else {
        throw e;
      }
    }
  }

  private async verifySetup(): Promise<void> {
    console.log("Verifying setup...");

    // Verify treasury vault is a USDC token account
    const vaultAccount = await getAccount(
      this.provider.connection,
      this.treasuryVault
    );

    if (vaultAccount.mint.toString() !== this.usdcMint.toString()) {
      throw new Error(
        `Treasury vault mint mismatch! Expected ${this.usdcMint.toString()}, got ${vaultAccount.mint.toString()}`
      );
    }

    // Verify treasury state
    const treasury = await this.program.account.protocolTreasury.fetch(
      this.treasuryPda
    );

    if (treasury.usdcVault.toString() !== this.treasuryVault.toString()) {
      throw new Error(
        `Treasury vault reference mismatch! Expected ${this.treasuryVault.toString()}, got ${treasury.usdcVault.toString()}`
      );
    }

    console.log("Setup verification passed ✓");
  }

  /**
   * Get test user USDC accounts for funding tests
   */
  async getTestUsers(count: number = 2): Promise<{
    users: Keypair[];
    usdcAccounts: PublicKey[];
  }> {
    const users: Keypair[] = [];
    const usdcAccounts: PublicKey[] = [];

    for (let i = 0; i < count; i++) {
      const user = Keypair.generate();
      users.push(user);

      // Airdrop SOL
      await this.provider.connection.requestAirdrop(
        user.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      );
    }

    // Wait for airdrops
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create USDC accounts
    const { getOrCreateAssociatedTokenAccount } = await import("@solana/spl-token");
    for (const user of users) {
      const account = await getOrCreateAssociatedTokenAccount(
        this.provider.connection,
        this.payer.payer,
        this.usdcMint,
        user.publicKey
      );
      usdcAccounts.push(account.address);
    }

    return { users, usdcAccounts };
  }
}
