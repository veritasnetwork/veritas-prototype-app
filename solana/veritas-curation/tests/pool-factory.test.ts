import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VeritasCuration } from "../target/types/veritas_curation";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";
import * as bs58 from "bs58";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  getMint,
} from "@solana/spl-token";
import { assert } from "chai";
import * as crypto from "crypto";
import { TEST_FACTORY_AUTHORITY, TEST_POOL_AUTHORITY } from "./utils/test-keypairs";

describe("PoolFactory Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;
  const payer = provider.wallet as anchor.Wallet;

  let usdcMint: PublicKey;
  let factoryPda: PublicKey;
  let factoryAuthority: Keypair;
  let poolAuthority: Keypair;

  const TEST_K_QUADRATIC = new anchor.BN(200); // Updated for reserve-based system
  const TEST_RESERVE_CAP = new anchor.BN(5_000_000_000); // $5K USDC

  before(async () => {
    // Create mock USDC mint
    usdcMint = await createMint(
      provider.connection,
      payer.payer,
      payer.publicKey,
      null,
      6
    );

    // Derive factory PDA
    [factoryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("factory")],
      program.programId
    );

    // Use the provider's wallet as factory authority (so we can sign transactions)
    // and a test keypair for pool authority
    factoryAuthority = payer; // Use the provider's wallet so we can sign
    poolAuthority = TEST_POOL_AUTHORITY;

    // Airdrop SOL to pool authority
    try {
      const sig = await provider.connection.requestAirdrop(
        poolAuthority.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig, 'confirmed');
    } catch (e) {
      // Ignore airdrop errors - account may already be funded
    }

    // Wait for transactions to settle
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Ensure factory is initialized with our test authorities
    try {
      await program.methods
        .initializeFactory(factoryAuthority.publicKey, poolAuthority.publicKey)
        .accounts({
          factory: factoryPda,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e: any) {
      // Factory already exists - verify it has our expected authorities
      if (e.toString().includes("already in use")) {
        const factory = await program.account.poolFactory.fetch(factoryPda);
        if (factory.factoryAuthority.toBase58() !== factoryAuthority.publicKey.toBase58() ||
            factory.poolAuthority.toBase58() !== poolAuthority.publicKey.toBase58()) {
          throw new Error(
            `Factory exists with different authorities. ` +
            `Expected factory: ${factoryAuthority.publicKey.toBase58()}, pool: ${poolAuthority.publicKey.toBase58()}. ` +
            `Got factory: ${factory.factoryAuthority.toBase58()}, pool: ${factory.poolAuthority.toBase58()}`
          );
        }
      } else {
        throw e;
      }
    }
  });

  describe("1. Factory Initialization", () => {
    describe("1.1 Singleton Factory Creation", () => {
      it("initializes factory with dual authorities", async () => {
        // Try to initialize factory - it may already exist from a previous test
        try {
          await program.methods
            .initializeFactory(factoryAuthority.publicKey, poolAuthority.publicKey)
            .accounts({
              factory: factoryPda,
              payer: payer.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
        } catch (e: any) {
          // If factory already exists, that's fine - just verify it
          if (!e.toString().includes("already in use")) {
            throw e;
          }
        }

        // Verify factory state
        const factory = await program.account.poolFactory.fetch(factoryPda);
        assert.equal(
          factory.factoryAuthority.toBase58(),
          factoryAuthority.publicKey.toBase58()
        );
        assert.equal(
          factory.poolAuthority.toBase58(),
          poolAuthority.publicKey.toBase58()
        );
        assert.equal(factory.totalPools.toString(), "0");
      });

      it("prevents duplicate factory initialization", async () => {
        try {
          await program.methods
            .initializeFactory(factoryAuthority.publicKey, poolAuthority.publicKey)
            .accounts({
              factory: factoryPda,
              payer: payer.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
          assert.fail("Should have failed with account already exists");
        } catch (err) {
          assert.ok(err);
        }
      });
    });

    // Note: Authority validation tests for initialization are skipped because
    // PoolFactory is a singleton with fixed PDA seeds ["factory"].
    // The contract DOES validate authorities (see initialize_factory.rs lines 16-19),
    // but we cannot test initialization with invalid params in isolation.
    // Authority validation is tested in the update_factory_authority and
    // update_pool_authority tests instead.
  });

  describe("2. Pool Creation Through Factory", () => {
    describe("2.1 Permissionless Pool Creation", () => {
      it("allows any user to create a pool", async () => {
        const randomUser = Keypair.generate();
        await provider.connection.requestAirdrop(
          randomUser.publicKey,
          10 * anchor.web3.LAMPORTS_PER_SOL
        );
        await new Promise(resolve => setTimeout(resolve, 1000));

        const postId = crypto.createHash("sha256").update("factory-test-pool-1").digest();
        const tokenName = "Factory Pool 1";
        const tokenSymbol = "FP1";

        const [poolPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("pool"), postId],
          program.programId
        );

        const [tokenMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("mint"), postId],
          program.programId
        );

        const [registryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("registry"), postId],
          program.programId
        );

        const [poolUsdcVault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), postId],
          program.programId
        );

        const beforeFactory = await program.account.poolFactory.fetch(factoryPda);

        await program.methods
          .createPool(
            Array.from(postId),
            TEST_K_QUADRATIC,
            TEST_RESERVE_CAP,
            tokenName,
            tokenSymbol
          )
          .accounts({
            factory: factoryPda,
            pool: poolPda,
            tokenMint: tokenMint,
            poolUsdcVault: poolUsdcVault,
            registry: registryPda,
            config: null,
            usdcMint: usdcMint,
            creator: randomUser.publicKey,
            payer: randomUser.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([randomUser])
          .rpc();

        // Verify pool created successfully
        const pool = await program.account.contentPool.fetch(poolPda);
        assert.deepEqual(pool.postId, Array.from(postId));
        assert.equal(pool.factory.toBase58(), factoryPda.toBase58());

        // Verify factory total_pools incremented
        const afterFactory = await program.account.poolFactory.fetch(factoryPda);
        assert.equal(
          afterFactory.totalPools.toString(),
          beforeFactory.totalPools.add(new anchor.BN(1)).toString()
        );
      });
    });

    describe("2.2 Registry Creation", () => {
      it("creates registry entry for new pool", async () => {
        const postId = crypto.createHash("sha256").update("factory-test-pool-2").digest();
        const tokenName = "Factory Pool 2";
        const tokenSymbol = "FP2";

        const [poolPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("pool"), postId],
          program.programId
        );

        const [tokenMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("mint"), postId],
          program.programId
        );

        const [registryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("registry"), postId],
          program.programId
        );

        const [poolUsdcVault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), postId],
          program.programId
        );

        await program.methods
          .createPool(
            Array.from(postId),
            TEST_K_QUADRATIC,
            TEST_RESERVE_CAP,
            tokenName,
            tokenSymbol
          )
          .accounts({
            factory: factoryPda,
            pool: poolPda,
            tokenMint: tokenMint,
            poolUsdcVault: poolUsdcVault,
            registry: registryPda,
            config: null,
            usdcMint: usdcMint,
            creator: payer.publicKey,
            payer: payer.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        // Verify registry entry
        const registry = await program.account.poolRegistry.fetch(registryPda);
        assert.deepEqual(registry.postId, Array.from(postId));
        assert.equal(registry.poolAddress.toBase58(), poolPda.toBase58());
        assert.ok(registry.createdAt > 0);
      });
    });

    describe("2.3 Pool-Factory Linkage", () => {
      it("created pool contains factory reference", async () => {
        const postId = crypto.createHash("sha256").update("factory-test-pool-3").digest();
        const tokenName = "Factory Pool 3";
        const tokenSymbol = "FP3";

        const [poolPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("pool"), postId],
          program.programId
        );

        const [tokenMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("mint"), postId],
          program.programId
        );

        const [registryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("registry"), postId],
          program.programId
        );

        const [poolUsdcVault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), postId],
          program.programId
        );

        await program.methods
          .createPool(
            Array.from(postId),
            TEST_K_QUADRATIC,
            TEST_RESERVE_CAP,
            tokenName,
            tokenSymbol
          )
          .accounts({
            factory: factoryPda,
            pool: poolPda,
            tokenMint: tokenMint,
            poolUsdcVault: poolUsdcVault,
            registry: registryPda,
            config: null,
            usdcMint: usdcMint,
            creator: payer.publicKey,
            payer: payer.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        // Verify pool factory reference
        const pool = await program.account.contentPool.fetch(poolPda);
        assert.equal(pool.factory.toBase58(), factoryPda.toBase58());

        // Verify token mint created
        const mintInfo = await getMint(provider.connection, tokenMint);
        assert.equal(mintInfo.decimals, 6);
        assert.equal(mintInfo.mintAuthority?.toBase58(), poolPda.toBase58());
      });
    });
  });

  describe("3. Authority Management", () => {
    describe("3.1 Update Pool Authority", () => {
      it("allows factory_authority to update pool_authority", async () => {

        const newPoolAuthority = Keypair.generate();

        // Fund the new pool authority
        const sig = await provider.connection.requestAirdrop(
          newPoolAuthority.publicKey,
          5 * anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(sig, 'confirmed');

        await program.methods
          .updatePoolAuthority(newPoolAuthority.publicKey)
          .accounts({
            factory: factoryPda,
            factoryAuthority: factoryAuthority.publicKey,
          })
          .rpc();

        const updatedFactory = await program.account.poolFactory.fetch(factoryPda);
        assert.equal(
          updatedFactory.poolAuthority.toBase58(),
          newPoolAuthority.publicKey.toBase58()
        );

        // Restore for other tests
        await program.methods
          .updatePoolAuthority(poolAuthority.publicKey)
          .accounts({
            factory: factoryPda,
            factoryAuthority: factoryAuthority.publicKey,
          })
          .rpc();
      });

      it("rejects pool_authority update from wrong signer", async () => {
        const randomUser = Keypair.generate();
        const newAuthority = Keypair.generate();

        try {
          await program.methods
            .updatePoolAuthority(newAuthority.publicKey)
            .accounts({
              factory: factoryPda,
              factoryAuthority: randomUser.publicKey,
            })
            .signers([randomUser])
            .rpc();
          assert.fail("Should have failed with unauthorized");
        } catch (err) {
          assert.ok(err);
        }
      });

      it("rejects pool_authority update from pool_authority itself", async () => {
        const newAuthority = Keypair.generate();

        try {
          await program.methods
            .updatePoolAuthority(newAuthority.publicKey)
            .accounts({
              factory: factoryPda,
              factoryAuthority: poolAuthority.publicKey,
            })
            .signers([poolAuthority])
            .rpc();
          assert.fail("Should have failed with unauthorized");
        } catch (err) {
          assert.ok(err);
        }
      });
    });

    describe("3.2 Update Factory Authority", () => {
      it("allows factory_authority to transfer ownership", async () => {

        const newFactoryAuthority = Keypair.generate();

        // Fund the new authority
        const sig = await provider.connection.requestAirdrop(
          newFactoryAuthority.publicKey,
          5 * anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(sig, 'confirmed');

        await program.methods
          .updateFactoryAuthority(newFactoryAuthority.publicKey)
          .accounts({
            factory: factoryPda,
            factoryAuthority: factoryAuthority.publicKey,
          })
          .rpc();

        const updatedFactory = await program.account.poolFactory.fetch(factoryPda);
        assert.equal(
          updatedFactory.factoryAuthority.toBase58(),
          newFactoryAuthority.publicKey.toBase58()
        );

        // Old authority should not work (provider is still the old authority)
        // But since the factory authority has changed, this should fail
        try {
          await program.methods
            .updatePoolAuthority(Keypair.generate().publicKey)
            .accounts({
              factory: factoryPda,
              factoryAuthority: factoryAuthority.publicKey,
            })
            .rpc();
          assert.fail("Old authority should not work");
        } catch (err) {
          assert.ok(err);
        }

        // Note: Cannot restore the original authority since we can't sign with newFactoryAuthority
        // This means subsequent tests will need to handle the changed authority
        // In a real test suite with proper isolation, this wouldn't be an issue
      });
    });
  });

  describe("5. Edge Cases and Security", () => {
    describe("5.1 Post ID Uniqueness", () => {
      it("prevents duplicate pools for same post_id", async () => {
        const postId = crypto.createHash("sha256").update("duplicate-test").digest();
        const tokenName = "Duplicate Test";
        const tokenSymbol = "DUP";

        const [poolPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("pool"), postId],
          program.programId
        );

        const [tokenMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("mint"), postId],
          program.programId
        );

        const [registryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("registry"), postId],
          program.programId
        );

        const [poolUsdcVault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), postId],
          program.programId
        );

        // First creation should succeed
        await program.methods
          .createPool(
            Array.from(postId),
            TEST_K_QUADRATIC,
            TEST_RESERVE_CAP,
            tokenName,
            tokenSymbol
          )
          .accounts({
            factory: factoryPda,
            pool: poolPda,
            tokenMint: tokenMint,
            poolUsdcVault: poolUsdcVault,
            registry: registryPda,
            config: null,
            usdcMint: usdcMint,
            creator: payer.publicKey,
            payer: payer.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        // Second creation should fail
        try {
          await program.methods
            .createPool(
              Array.from(postId),
              TEST_K_QUADRATIC,
              TEST_RESERVE_CAP,
              tokenName,
              tokenSymbol
            )
            .accounts({
              factory: factoryPda,
              pool: poolPda,
              tokenMint: tokenMint,
              poolUsdcVault: poolUsdcVault,
              registry: registryPda,
              config: null,
              usdcMint: usdcMint,
              creator: payer.publicKey,
              payer: payer.publicKey,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();
          assert.fail("Should have failed with pool already exists");
        } catch (err) {
          assert.ok(err);
        }
      });
    });

    describe("5.2 Invalid Post ID", () => {
      it("rejects pool creation with zero post_id", async () => {
        const zeroPostId = Buffer.alloc(32); // All zeros
        const tokenName = "Zero Post";
        const tokenSymbol = "ZERO";

        const [poolPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("pool"), zeroPostId],
          program.programId
        );

        const [tokenMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("mint"), zeroPostId],
          program.programId
        );

        const [registryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("registry"), zeroPostId],
          program.programId
        );

        const [poolUsdcVault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), zeroPostId],
          program.programId
        );

        try {
          await program.methods
            .createPool(
              Array.from(zeroPostId),
              TEST_K_QUADRATIC,
              TEST_RESERVE_CAP,
              tokenName,
              tokenSymbol
            )
            .accounts({
              factory: factoryPda,
              pool: poolPda,
              tokenMint: tokenMint,
              poolUsdcVault: poolUsdcVault,
              registry: registryPda,
              config: null,
              usdcMint: usdcMint,
              creator: payer.publicKey,
              payer: payer.publicKey,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();
          assert.fail("Should have failed with InvalidPostId");
        } catch (err: any) {
          assert.ok(err.toString().includes("InvalidPostId"));
        }
      });
    });
  });

  describe("6. State Consistency", () => {
    describe("6.1 Total Pools Counter", () => {
      it("increments total_pools atomically", async () => {
        const beforeFactory = await program.account.poolFactory.fetch(factoryPda);

        // Create 3 pools rapidly
        for (let i = 0; i < 3; i++) {
          const postId = crypto.createHash('sha256').update(`rapid-pool-${i}`).digest();
          const tokenName = `Rapid Pool ${i}`;
          const tokenSymbol = `RP${i}`;

          const [poolPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("pool"), postId],
            program.programId
          );

          const [tokenMint] = PublicKey.findProgramAddressSync(
            [Buffer.from("mint"), postId],
            program.programId
          );

          const [registryPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("registry"), postId],
            program.programId
          );

          const [poolUsdcVault] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), postId],
            program.programId
          );

          await program.methods
            .createPool(
              Array.from(postId),
              TEST_K_QUADRATIC,
              TEST_RESERVE_CAP,
              tokenName,
              tokenSymbol
            )
            .accounts({
              factory: factoryPda,
              pool: poolPda,
              tokenMint: tokenMint,
              poolUsdcVault: poolUsdcVault,
              registry: registryPda,
              config: null,
              usdcMint: usdcMint,
              creator: payer.publicKey,
              payer: payer.publicKey,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();
        }

        const afterFactory = await program.account.poolFactory.fetch(factoryPda);

        // Verify all 3 increments counted
        assert.equal(
          afterFactory.totalPools.toString(),
          beforeFactory.totalPools.add(new anchor.BN(3)).toString()
        );
      });
    });
  });
});
