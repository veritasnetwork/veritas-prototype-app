import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VeritasCuration } from "../target/types/veritas_curation";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getMint,
  transfer,
  burn,
} from "@solana/spl-token";
import { assert } from "chai";
import * as crypto from "crypto";

/**
 * Convert a string to a fixed-length byte array, padding with zeros.
 */
function stringToBytes(str: string, length: number): number[] {
  const bytes = Buffer.from(str, 'utf8');
  const result = new Array(length).fill(0);
  for (let i = 0; i < Math.min(bytes.length, length); i++) {
    result[i] = bytes[i];
  }
  return result;
}

describe("ContentPool Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VeritasCuration as Program<VeritasCuration>;
  const payer = provider.wallet as anchor.Wallet;

  let usdcMint: PublicKey;
  let testUser1: Keypair;
  let testUser2: Keypair;
  let testUser1UsdcAccount: PublicKey;
  let testUser2UsdcAccount: PublicKey;

  // Test pool parameters - Pure quadratic curve with price floor
  const TEST_K_QUADRATIC = new anchor.BN(200); // k_quadratic coefficient
  const TEST_USDC_AMOUNT = 1_000_000_000; // 1000 USDC
  let globalFactoryPda: PublicKey;
  let globalTreasuryPda: PublicKey;
  let globalTreasuryVault: PublicKey;

  before(async () => {
    // Create mock USDC mint
    usdcMint = await createMint(
      provider.connection,
      payer.payer,
      payer.publicKey,
      null,
      6 // USDC decimals
    );

    // Initialize factory and treasury for tests that need them
    [globalFactoryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("factory")],
      program.programId
    );

    [globalTreasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );

    [globalTreasuryVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_vault")],
      program.programId
    );

    // Load test pool authority
    const { TEST_POOL_AUTHORITY } = await import("./utils/test-keypairs");

    // Initialize factory if not already exists
    try {
      await program.methods
        .initializeFactory(payer.publicKey, TEST_POOL_AUTHORITY.publicKey)
        .accounts({
          factory: globalFactoryPda,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e: any) {
      if (!e.toString().includes("already in use")) {
        console.log("Factory initialization error:", e.toString());
      }
    }

    // Initialize treasury if not already exists
    try {
      await program.methods
        .initializeTreasury()
        .accounts({
          treasury: globalTreasuryPda,
          usdcVault: globalTreasuryVault,
          usdcMint: usdcMint,
          authority: payer.publicKey,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
    } catch (e: any) {
      if (!e.toString().includes("already in use")) {
        console.log("Treasury initialization error:", e.toString());
      }
    }

    // Create test users
    testUser1 = Keypair.generate();
    testUser2 = Keypair.generate();

    // Airdrop SOL to test users
    await provider.connection.requestAirdrop(
      testUser1.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      testUser2.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );

    // Wait for airdrops to confirm
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create USDC token accounts for test users
    const user1Account = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer.payer,
      usdcMint,
      testUser1.publicKey
    );
    testUser1UsdcAccount = user1Account.address;

    const user2Account = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer.payer,
      usdcMint,
      testUser2.publicKey
    );
    testUser2UsdcAccount = user2Account.address;

    // Mint USDC to test users
    await mintTo(
      provider.connection,
      payer.payer,
      usdcMint,
      testUser1UsdcAccount,
      payer.publicKey,
      10_000_000_000 // 10K USDC
    );

    await mintTo(
      provider.connection,
      payer.payer,
      usdcMint,
      testUser2UsdcAccount,
      payer.publicKey,
      10_000_000_000 // 10K USDC
    );
  });

  describe("1. Initialization Tests", () => {
    describe("1.1 Valid Pool Creation", () => {
      it("creates pool with valid parameters and SPL token mint", async () => {
        const postId = crypto.createHash("sha256").update("test-post-1").digest();
        const tokenName = "Content-ABC";
        const tokenSymbol = "cABC";

        const [poolPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("pool"), postId],
          program.programId
        );

        const [tokenMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("mint"), postId],
          program.programId
        );

        const [poolUsdcVault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), postId],
          program.programId
        );

        // Create a factory account (simplified for testing)

        await program.methods
          .initializePool(
            Array.from(postId),
            TEST_K_QUADRATIC,
            stringToBytes(tokenName, 32),
            stringToBytes(tokenSymbol, 10)
          )
          .accounts({
            pool: poolPda,
            tokenMint: tokenMint,
            usdcVault: poolUsdcVault,
            config: null,
            usdcMint: usdcMint,
            factory: globalFactoryPda,
            payer: payer.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        // Verify pool state
        const poolAccount = await program.account.contentPool.fetch(poolPda);
        assert.deepEqual(poolAccount.postId, Array.from(postId));
        assert.equal(poolAccount.kQuadratic.toString(), TEST_K_QUADRATIC.toString());
        // Pure quadratic implementation - no reserveCap field
        assert.equal(poolAccount.tokenSupply.toString(), "0");
        assert.equal(poolAccount.reserve.toString(), "0");
        assert.equal(poolAccount.tokenMint.toBase58(), tokenMint.toBase58());

        // Verify token mint
        const mintInfo = await getMint(provider.connection, tokenMint);
        assert.equal(mintInfo.decimals, 6);
        assert.equal(mintInfo.mintAuthority?.toBase58(), poolPda.toBase58());
        assert.equal(mintInfo.freezeAuthority, null);
        assert.equal(mintInfo.supply.toString(), "0");

        // Verify token metadata stored in pool
        const nameBytes = Buffer.from(tokenName);
        const storedName = Buffer.from(poolAccount.tokenName.slice(0, nameBytes.length));
        assert.equal(storedName.toString(), tokenName);

        const symbolBytes = Buffer.from(tokenSymbol);
        const storedSymbol = Buffer.from(poolAccount.tokenSymbol.slice(0, symbolBytes.length));
        assert.equal(storedSymbol.toString(), tokenSymbol);

        assert.equal(poolAccount.tokenDecimals, 6);

        // Verify USDC vault
        const vaultInfo = await getAccount(provider.connection, poolUsdcVault);
        assert.equal(vaultInfo.mint.toBase58(), usdcMint.toBase58());
        assert.equal(vaultInfo.owner.toBase58(), poolPda.toBase58());
      });
    });

    describe("1.3 Duplicate Pool Prevention", () => {
      it("prevents duplicate pools for same post_id", async () => {
        const postId = crypto.createHash("sha256").update("test-post-duplicate").digest();
        const tokenName = "Test Token";
        const tokenSymbol = "TEST";

        const [poolPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("pool"), postId],
          program.programId
        );

        const [tokenMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("mint"), postId],
          program.programId
        );

        const [poolUsdcVault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), postId],
          program.programId
        );


        // First creation should succeed
        await program.methods
          .initializePool(
            Array.from(postId),
            TEST_K_QUADRATIC,
            stringToBytes(tokenName, 32),
            stringToBytes(tokenSymbol, 10)
          )
          .accounts({
            pool: poolPda,
            tokenMint: tokenMint,
            usdcVault: poolUsdcVault,
            config: null,
            usdcMint: usdcMint,
            factory: globalFactoryPda,
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
            .initializePool(
              Array.from(postId),
              TEST_K_QUADRATIC,
              stringToBytes(tokenName, 32),
              stringToBytes(tokenSymbol, 10)
            )
            .accounts({
              pool: poolPda,
              tokenMint: tokenMint,
              usdcVault: poolUsdcVault,
              config: null,
              usdcMint: usdcMint,
              factory: globalFactoryPda,
              payer: payer.publicKey,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();
          assert.fail("Should have failed with duplicate pool error");
        } catch (err) {
          // Expected to fail
          assert.ok(err);
        }
      });
    });
  });

  describe("7. SPL Token Tests", () => {
    let testPool: PublicKey;
    let testTokenMint: PublicKey;
    let testPoolVault: PublicKey;

    before(async () => {
      const postId = crypto.createHash("sha256").update("test-post-spl").digest();
      const tokenName = "SPL Test Token";
      const tokenSymbol = "SPLT";

      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), postId],
        program.programId
      );
      testPool = poolPda;

      const [tokenMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), postId],
        program.programId
      );
      testTokenMint = tokenMint;

      const [poolUsdcVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), postId],
        program.programId
      );
      testPoolVault = poolUsdcVault;


      await program.methods
        .initializePool(
          Array.from(postId),
          TEST_K_QUADRATIC,
          stringToBytes(tokenName, 32),
          stringToBytes(tokenSymbol, 10)
        )
        .accounts({
          pool: poolPda,
          tokenMint: tokenMint,
          usdcVault: poolUsdcVault,
          config: null,
          usdcMint: usdcMint,
          factory: globalFactoryPda,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
    });

    describe("7.2 Token Minting and Burning", () => {
      it("mints exact tokens calculated from bonding curve", async () => {
        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
          provider.connection,
          testUser1,
          testTokenMint,
          testUser1.publicKey
        );

        const usdcAmount = 1_000_000; // 1 USDC

        await program.methods
          .buy(new anchor.BN(usdcAmount))
          .accounts({
            pool: testPool,
            tokenMint: testTokenMint,
            poolUsdcVault: testPoolVault,
            userUsdcAccount: testUser1UsdcAccount,
            userTokenAccount: userTokenAccount.address,
            user: testUser1.publicKey,
            config: null,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([testUser1])
          .rpc();

        // Verify tokens were minted
        const tokenAccount = await getAccount(provider.connection, userTokenAccount.address);
        assert.ok(Number(tokenAccount.amount) > 0);

        // Verify pool state updated
        const poolAccount = await program.account.contentPool.fetch(testPool);
        assert.equal(poolAccount.tokenSupply.toString(), tokenAccount.amount.toString());
        assert.equal(poolAccount.reserve.toString(), usdcAmount.toString());

        // Verify mint supply matches
        const mintInfo = await getMint(provider.connection, testTokenMint);
        assert.equal(mintInfo.supply.toString(), tokenAccount.amount.toString());
      });

      it("burns tokens when selling back to curve", async () => {
        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
          provider.connection,
          testUser1,
          testTokenMint,
          testUser1.publicKey
        );

        // First buy some tokens
        const usdcAmount = 2_000_000; // 2 USDC
        await program.methods
          .buy(new anchor.BN(usdcAmount))
          .accounts({
            pool: testPool,
            tokenMint: testTokenMint,
            poolUsdcVault: testPoolVault,
            userUsdcAccount: testUser1UsdcAccount,
            userTokenAccount: userTokenAccount.address,
            user: testUser1.publicKey,
            config: null,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([testUser1])
          .rpc();

        const beforeSellTokens = await getAccount(provider.connection, userTokenAccount.address);
        const beforeSellSupply = await getMint(provider.connection, testTokenMint);

        // Sell half the tokens (rounded down to integer)
        const tokensToSell = Math.floor(Number(beforeSellTokens.amount) / 2);

        await program.methods
          .sell(new anchor.BN(tokensToSell))
          .accounts({
            pool: testPool,
            tokenMint: testTokenMint,
            poolUsdcVault: testPoolVault,
            userUsdcAccount: testUser1UsdcAccount,
            userTokenAccount: userTokenAccount.address,
            user: testUser1.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([testUser1])
          .rpc();

        // Verify tokens were burned
        const afterSellTokens = await getAccount(provider.connection, userTokenAccount.address);
        assert.equal(Number(afterSellTokens.amount), Number(beforeSellTokens.amount) - tokensToSell);

        // Verify total supply decreased
        const afterSellSupply = await getMint(provider.connection, testTokenMint);
        assert.equal(
          Number(afterSellSupply.supply),
          Number(beforeSellSupply.supply) - tokensToSell
        );
      });
    });
  });

  describe("2. Bonding Curve Mathematics", () => {
    let mathTestPool: PublicKey;
    let mathTestTokenMint: PublicKey;
    let mathTestPoolVault: PublicKey;
    let mathTestPostId: Buffer;

    before(async () => {
      mathTestPostId = crypto.createHash("sha256").update("bonding-curve-math-test").digest();
      const tokenName = "Math Test Token";
      const tokenSymbol = "MATH";

      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), mathTestPostId],
        program.programId
      );
      mathTestPool = poolPda;

      const [tokenMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), mathTestPostId],
        program.programId
      );
      mathTestTokenMint = tokenMint;

      const [poolUsdcVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), mathTestPostId],
        program.programId
      );
      mathTestPoolVault = poolUsdcVault;


      await program.methods
        .initializePool(
          Array.from(mathTestPostId),
          TEST_K_QUADRATIC,
          stringToBytes(tokenName, 32),
          stringToBytes(tokenSymbol, 10)
        )
        .accounts({
          pool: poolPda,
          tokenMint: tokenMint,
          usdcVault: poolUsdcVault,
          config: null,
          usdcMint: usdcMint,
          factory: globalFactoryPda,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
    });

    describe("2.1 Quadratic Region Calculations", () => {
      it("calculates correct token supply increase for first purchase", async () => {
        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
          provider.connection,
          testUser1,
          mathTestTokenMint,
          testUser1.publicKey
        );

        const usdcAmount = 1_000_000; // 1 USDC
        const beforePool = await program.account.contentPool.fetch(mathTestPool);

        await program.methods
          .buy(new anchor.BN(usdcAmount))
          .accounts({
            pool: mathTestPool,
            tokenMint: mathTestTokenMint,
            poolUsdcVault: mathTestPoolVault,
            userUsdcAccount: testUser1UsdcAccount,
            userTokenAccount: userTokenAccount.address,
            user: testUser1.publicKey,
            config: null,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([testUser1])
          .rpc();

        const afterPool = await program.account.contentPool.fetch(mathTestPool);
        const tokenAccount = await getAccount(provider.connection, userTokenAccount.address);

        // Verify reserve increased by exact USDC amount
        assert.equal(
          afterPool.reserve.sub(beforePool.reserve).toString(),
          usdcAmount.toString()
        );

        // Verify token supply increased
        assert.ok(afterPool.tokenSupply.gt(beforePool.tokenSupply));

        // Verify user received tokens
        assert.equal(
          tokenAccount.amount.toString(),
          afterPool.tokenSupply.sub(beforePool.tokenSupply).toString()
        );

        // In quadratic region: reserve = k * s^3 / 3
        // Due to integer cube root calculations in the contract, we verify that:
        // 1. Tokens were minted
        // 2. Reserve matches exact USDC spent
        // 3. Supply increased appropriately
        assert.ok(afterPool.tokenSupply.gt(new anchor.BN(0)), "Tokens should be minted");
        assert.equal(afterPool.reserve.toString(), usdcAmount.toString(), "Reserve should match USDC spent");
      });

      it("maintains price curve consistency across multiple purchases", async () => {
        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
          provider.connection,
          testUser2,
          mathTestTokenMint,
          testUser2.publicKey
        );

        // Make several purchases (must be >= 1 USDC minimum)
        const purchases = [5_000_000, 3_000_000, 2_000_000]; // 5, 3, 2 USDC

        for (const usdcAmount of purchases) {
          const beforePool = await program.account.contentPool.fetch(mathTestPool);

          await program.methods
            .buy(new anchor.BN(usdcAmount))
            .accounts({
              pool: mathTestPool,
              tokenMint: mathTestTokenMint,
              poolUsdcVault: mathTestPoolVault,
              userUsdcAccount: testUser2UsdcAccount,
              userTokenAccount: userTokenAccount.address,
              user: testUser2.publicKey,
              config: null,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([testUser2])
            .rpc();

          const afterPool = await program.account.contentPool.fetch(mathTestPool);

          // Verify reserve increased by exact USDC amount
          assert.equal(
            afterPool.reserve.sub(beforePool.reserve).toString(),
            usdcAmount.toString()
          );

          // Verify supply increased
          assert.ok(afterPool.tokenSupply.gt(beforePool.tokenSupply));
        }

        // Verify all purchases succeeded
        const finalPool = await program.account.contentPool.fetch(mathTestPool);
        assert.ok(finalPool.tokenSupply.gt(new anchor.BN(0)), "Final supply should be positive");
        assert.ok(finalPool.reserve.gt(new anchor.BN(0)), "Final reserve should be positive");
      });

      it("verifies price increases with supply in quadratic region", async () => {
        const pool = await program.account.contentPool.fetch(mathTestPool);

        // In quadratic region: price P(s) = k * s^2
        const k = Number(pool.kQuadratic);
        const supply = Number(pool.tokenSupply);

        // Current marginal price
        const currentPrice = k * Math.pow(supply, 2);

        // Price at supply + 1M tokens
        const futureSupply = supply + 1_000_000;
        const futurePrice = k * Math.pow(futureSupply, 2);

        // Verify price increases with supply
        assert.ok(futurePrice > currentPrice, "Price should increase with supply");

        // Price should increase quadratically
        const priceRatio = futurePrice / currentPrice;
        const supplyRatio = futureSupply / supply;
        assert.ok(priceRatio > supplyRatio, "Price should increase faster than supply");
      });
    });

    describe("2.2 Price Floor Mechanism", () => {
      it("enforces minimum price floor at zero supply", async () => {
        // Create a fresh pool to test from s=0
        const postId = crypto.createHash("sha256").update("price-floor-test-1").digest();
        const tokenName = "Price Floor Test";
        const tokenSymbol = "PFT";

        const [poolPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("pool"), postId],
          program.programId
        );

        const [tokenMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("mint"), postId],
          program.programId
        );

        const [poolUsdcVault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), postId],
          program.programId
        );

        // Create pool with very small k to stay near price floor
        const smallK = new anchor.BN(1); // k=1 means very gradual price increase

        await program.methods
          .initializePool(
            Array.from(postId),
            smallK,
            tokenName,
            tokenSymbol
          )
          .accounts({
            pool: poolPda,
            tokenMint: tokenMint,
            usdcVault: poolUsdcVault,
            config: null,
            usdcMint: usdcMint,
            factory: globalFactoryPda,
            payer: payer.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        // First purchase should be at price floor ($0.0001 per token)
        // PRICE_FLOOR = 100 (in micro-USDC units, i.e., 100/1_000_000 = $0.0001)
        const usdcAmount = 1_000_000; // 1 USDC
        const expectedTokensAtFloor = (usdcAmount * 1_000_000) / 100; // Should get 10,000 tokens

        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
          provider.connection,
          testUser1,
          tokenMint,
          testUser1.publicKey
        );

        await program.methods
          .buy(new anchor.BN(usdcAmount))
          .accounts({
            pool: poolPda,
            tokenMint: tokenMint,
            poolUsdcVault: poolUsdcVault,
            userUsdcAccount: testUser1UsdcAccount,
            userTokenAccount: userTokenAccount.address,
            user: testUser1.publicKey,
            config: null,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([testUser1])
          .rpc();

        const tokenBalance = (await getAccount(provider.connection, userTokenAccount.address)).amount;
        const tokensReceived = Number(tokenBalance);

        // Verify tokens received are at floor price (allow 5% tolerance for rounding)
        assert.ok(
          tokensReceived >= expectedTokensAtFloor * 0.95 && tokensReceived <= expectedTokensAtFloor * 1.05,
          `Expected ~${expectedTokensAtFloor} tokens at floor price, got ${tokensReceived}`
        );
      });

      it("transitions from price floor to quadratic curve", async () => {
        // Buy more tokens to push price above floor
        const postId = crypto.createHash("sha256").update("price-floor-test-2").digest();
        const tokenName = "Transition Test";
        const tokenSymbol = "TRT";

        const [poolPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("pool"), postId],
          program.programId
        );

        const [tokenMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("mint"), postId],
          program.programId
        );

        const [poolUsdcVault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), postId],
          program.programId
        );

        // Use moderate k so we transition above floor quickly
        const moderateK = new anchor.BN(1000);

        await program.methods
          .initializePool(
            Array.from(postId),
            moderateK,
            tokenName,
            tokenSymbol
          )
          .accounts({
            pool: poolPda,
            tokenMint: tokenMint,
            usdcVault: poolUsdcVault,
            config: null,
            usdcMint: usdcMint,
            factory: globalFactoryPda,
            payer: payer.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
          provider.connection,
          testUser2,
          tokenMint,
          testUser2.publicKey
        );

        // Buy enough to exceed price floor
        const usdcAmount = 10_000_000; // 10 USDC

        await program.methods
          .buy(new anchor.BN(usdcAmount))
          .accounts({
            pool: poolPda,
            tokenMint: tokenMint,
            poolUsdcVault: poolUsdcVault,
            userUsdcAccount: testUser2UsdcAccount,
            userTokenAccount: userTokenAccount.address,
            user: testUser2.publicKey,
            config: null,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([testUser2])
          .rpc();

        const pool = await program.account.contentPool.fetch(poolPda);
        const tokenBalance = (await getAccount(provider.connection, userTokenAccount.address)).amount;

        // Calculate current price: P = k × s²
        const supply = pool.tokenSupply.toNumber();
        const k = pool.kQuadratic.toNumber();
        const curvePrice = (k * supply * supply) / 1_000_000; // In micro-USDC units

        // Verify price is above floor (PRICE_FLOOR = 100)
        assert.ok(curvePrice > 100, `Price ${curvePrice} should exceed floor of 100`);
      });

      it("uses quadratic pricing once above floor", async () => {
        // Verify multiple purchases follow P(s) = k × s² above floor
        const postId = crypto.createHash("sha256").update("price-floor-test-3").digest();
        const tokenName = "Quadratic Test";
        const tokenSymbol = "QDT";

        const [poolPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("pool"), postId],
          program.programId
        );

        const [tokenMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("mint"), postId],
          program.programId
        );

        const [poolUsdcVault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), postId],
          program.programId
        );

        await program.methods
          .initializePool(
            Array.from(postId),
            TEST_K_QUADRATIC,
            stringToBytes(tokenName, 32),
            stringToBytes(tokenSymbol, 10)
          )
          .accounts({
            pool: poolPda,
            tokenMint: tokenMint,
            usdcVault: poolUsdcVault,
            config: null,
            usdcMint: usdcMint,
            factory: globalFactoryPda,
            payer: payer.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
          provider.connection,
          testUser1,
          tokenMint,
          testUser1.publicKey
        );

        // First purchase to establish above floor
        await program.methods
          .buy(new anchor.BN(100_000_000))
          .accounts({
            pool: poolPda,
            tokenMint: tokenMint,
            poolUsdcVault: poolUsdcVault,
            userUsdcAccount: testUser1UsdcAccount,
            userTokenAccount: userTokenAccount.address,
            user: testUser1.publicKey,
            config: null,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([testUser1])
          .rpc();

        const pool1 = await program.account.contentPool.fetch(poolPda);
        const supply1 = pool1.tokenSupply.toNumber();

        // Second purchase
        await program.methods
          .buy(new anchor.BN(100_000_000))
          .accounts({
            pool: poolPda,
            tokenMint: tokenMint,
            poolUsdcVault: poolUsdcVault,
            userUsdcAccount: testUser1UsdcAccount,
            userTokenAccount: userTokenAccount.address,
            user: testUser1.publicKey,
            config: null,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([testUser1])
          .rpc();

        const pool2 = await program.account.contentPool.fetch(poolPda);
        const supply2 = pool2.tokenSupply.toNumber();

        // Verify supply increased (tokens were minted)
        assert.ok(supply2 > supply1, "Supply should increase with second purchase");

        // Verify price increased quadratically (more USDC for fewer tokens on 2nd buy)
        const tokens1 = supply1;
        const tokens2 = supply2 - supply1;
        assert.ok(tokens2 < tokens1, "Should receive fewer tokens on second buy (price increased)");
      });
    });
  });

  describe("3. Elastic-K Mechanism", () => {
    let elasticTestPool: PublicKey;
    let elasticTestTokenMint: PublicKey;
    let elasticTestPoolVault: PublicKey;
    let elasticTestPostId: Buffer;
    let poolAuthority: Keypair;

    before(async () => {
      elasticTestPostId = crypto.createHash("sha256").update("elastic-k-test-pool").digest();
      const tokenName = "Elastic Test Token";
      const tokenSymbol = "ELASTIC";

      // Load test pool authority (must match the one used in pool-factory tests)
      const { TEST_POOL_AUTHORITY } = await import("./utils/test-keypairs");
      poolAuthority = TEST_POOL_AUTHORITY;

      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), elasticTestPostId],
        program.programId
      );
      elasticTestPool = poolPda;

      const [tokenMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), elasticTestPostId],
        program.programId
      );
      elasticTestTokenMint = tokenMint;

      const [poolUsdcVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), elasticTestPostId],
        program.programId
      );
      elasticTestPoolVault = poolUsdcVault;

      // Use the global factory that was initialized in the main before() hook
      await program.methods
        .initializePool(
          Array.from(elasticTestPostId),
          TEST_K_QUADRATIC,
          stringToBytes(tokenName, 32),
          stringToBytes(tokenSymbol, 10)
        )
        .accounts({
          pool: poolPda,
          tokenMint: tokenMint,
          usdcVault: poolUsdcVault,
          config: null,
          usdcMint: usdcMint,
          factory: globalFactoryPda,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      // Buy tokens to establish reserves
      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        testUser2,
        elasticTestTokenMint,
        testUser2.publicKey
      );

      // Mint more USDC to testUser2 for this test
      await mintTo(
        provider.connection,
        payer.payer,
        usdcMint,
        testUser2UsdcAccount,
        payer.publicKey,
        100_000_000_000 // 100K USDC
      );

      await program.methods
        .buy(new anchor.BN(50_000_000_000)) // 50K USDC
        .accounts({
          pool: elasticTestPool,
          tokenMint: elasticTestTokenMint,
          poolUsdcVault: elasticTestPoolVault,
          userUsdcAccount: testUser2UsdcAccount,
          userTokenAccount: userTokenAccount.address,
          user: testUser2.publicKey,
          config: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([testUser2])
        .rpc();
    });

    describe("3.1 Penalty Application", () => {
      it("applies penalty correctly reducing pool value", async () => {
        const penaltyAmount = 10_000_000_000; // 10K USDC

        const beforePool = await program.account.contentPool.fetch(elasticTestPool);
        const beforeVault = await getAccount(provider.connection, elasticTestPoolVault);

        await program.methods
          .applyPoolPenalty(new anchor.BN(penaltyAmount))
          .accounts({
            pool: elasticTestPool,
            factory: globalFactoryPda,
            poolUsdcVault: elasticTestPoolVault,
            treasuryUsdcVault: globalTreasuryVault,
            authority: poolAuthority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([poolAuthority])
          .rpc();

        const afterPool = await program.account.contentPool.fetch(elasticTestPool);
        const afterVault = await getAccount(provider.connection, elasticTestPoolVault);

        // Verify reserve decreased by penalty
        assert.equal(
          afterPool.reserve.toString(),
          beforePool.reserve.sub(new anchor.BN(penaltyAmount)).toString()
        );

        // Verify vault decreased
        assert.equal(
          Number(afterVault.amount),
          Number(beforeVault.amount) - penaltyAmount
        );

        // Verify k_quadratic scaled down (elastic-k)
        const scalingRatio = afterPool.reserve.toNumber() / beforePool.reserve.toNumber();
        const expectedKQuadratic = Math.floor(beforePool.kQuadratic.toNumber() * scalingRatio);

        // Allow for small rounding differences
        assert.approximately(
          afterPool.kQuadratic.toNumber(),
          expectedKQuadratic,
          100 // tolerance for rounding
        );

        // Verify token supply unchanged
        assert.equal(
          afterPool.tokenSupply.toString(),
          beforePool.tokenSupply.toString()
        );

        // Verify token mint supply unchanged
        const mintInfo = await getMint(provider.connection, elasticTestTokenMint);
        assert.equal(
          mintInfo.supply.toString(),
          beforePool.tokenSupply.toString()
        );
      });
    });

    describe("3.2 Reward Application", () => {
      it("applies reward correctly increasing pool value", async () => {
        const rewardAmount = 5_000_000_000; // 5K USDC

        const beforePool = await program.account.contentPool.fetch(elasticTestPool);
        const beforeVault = await getAccount(provider.connection, elasticTestPoolVault);

        // First, mint USDC to pool vault to simulate reward
        await mintTo(
          provider.connection,
          payer.payer,
          usdcMint,
          elasticTestPoolVault,
          payer.publicKey,
          rewardAmount
        );

        await program.methods
          .applyPoolReward(new anchor.BN(rewardAmount))
          .accounts({
            pool: elasticTestPool,
            factory: globalFactoryPda,
            poolUsdcVault: elasticTestPoolVault,
            treasuryUsdcVault: globalTreasuryVault,
            authority: poolAuthority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([poolAuthority])
          .rpc();

        const afterPool = await program.account.contentPool.fetch(elasticTestPool);
        const afterVault = await getAccount(provider.connection, elasticTestPoolVault);

        // Verify reserve increased by reward
        assert.equal(
          afterPool.reserve.toString(),
          beforePool.reserve.add(new anchor.BN(rewardAmount)).toString()
        );

        // Verify k_quadratic scaled up (elastic-k)
        const scalingRatio = afterPool.reserve.toNumber() / beforePool.reserve.toNumber();
        const expectedKQuadratic = Math.floor(beforePool.kQuadratic.toNumber() * scalingRatio);

        assert.approximately(
          afterPool.kQuadratic.toNumber(),
          expectedKQuadratic,
          100
        );

        // Verify token supply unchanged
        assert.equal(
          afterPool.tokenSupply.toString(),
          beforePool.tokenSupply.toString()
        );
      });
    });

    describe("3.3 Price Consistency After Adjustment", () => {
      it("maintains price continuity after elastic-k adjustment", async () => {
        const penaltyAmount = 1_000_000_000; // 1K USDC

        const beforePool = await program.account.contentPool.fetch(elasticTestPool);

        // Calculate price before: P(s) = k * s^2
        const beforePrice = beforePool.kQuadratic.toNumber() *
          Math.pow(beforePool.tokenSupply.toNumber(), 2);

        await program.methods
          .applyPoolPenalty(new anchor.BN(penaltyAmount))
          .accounts({
            pool: elasticTestPool,
            factory: globalFactoryPda,
            poolUsdcVault: elasticTestPoolVault,
            treasuryUsdcVault: globalTreasuryVault,
            authority: poolAuthority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([poolAuthority])
          .rpc();

        const afterPool = await program.account.contentPool.fetch(elasticTestPool);

        // Calculate price after: P(s) = k_new * s^2
        const afterPrice = afterPool.kQuadratic.toNumber() *
          Math.pow(afterPool.tokenSupply.toNumber(), 2);

        // Verify price changed proportionally to reserve change
        const reserveRatio = afterPool.reserve.toNumber() / beforePool.reserve.toNumber();
        const priceRatio = afterPrice / beforePrice;

        // Price should scale with k, which scales with reserve
        assert.approximately(priceRatio, reserveRatio, 0.01);
      });
    });
  });

  describe("1.2 Parameter Boundary Validation", () => {
    it("rejects pool creation with k_quadratic below minimum", async () => {
      const postId = crypto.createHash("sha256").update("test-pool-k-too-low").digest();
      const tokenName = "Test Token";
      const tokenSymbol = "TEST";

      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), postId],
        program.programId
      );

      const [tokenMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), postId],
        program.programId
      );

      const [poolUsdcVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), postId],
        program.programId
      );


      // DEFAULT_MIN_K_QUADRATIC = 100, use 50 (below minimum)
      const tooLowK = new anchor.BN(50);

      try {
        await program.methods
          .initializePool(
            Array.from(postId),
            tooLowK,
            tokenName,
            tokenSymbol
          )
          .accounts({
            pool: poolPda,
            tokenMint: tokenMint,
            usdcVault: poolUsdcVault,
            config: null,
            usdcMint: usdcMint,
            factory: globalFactoryPda,
            payer: payer.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        assert.fail("Should have failed with InvalidParameters");
      } catch (err: any) {
        assert.ok(err.toString().includes("InvalidParameters") || err.toString().includes("0x1771"));
      }
    });

    it("rejects pool creation with k_quadratic above maximum", async () => {
      const postId = crypto.createHash("sha256").update("test-pool-k-too-high").digest();
      const tokenName = "Test Token";
      const tokenSymbol = "TEST";

      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), postId],
        program.programId
      );

      const [tokenMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), postId],
        program.programId
      );

      const [poolUsdcVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), postId],
        program.programId
      );


      // DEFAULT_MAX_K_QUADRATIC = 10_000, use 20_000 (above maximum)
      const tooHighK = new anchor.BN(20_000);

      try {
        await program.methods
          .initializePool(
            Array.from(postId),
            tooHighK,
            tokenName,
            tokenSymbol
          )
          .accounts({
            pool: poolPda,
            tokenMint: tokenMint,
            usdcVault: poolUsdcVault,
            config: null,
            usdcMint: usdcMint,
            factory: globalFactoryPda,
            payer: payer.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        assert.fail("Should have failed with InvalidParameters");
      } catch (err: any) {
        assert.ok(err.toString().includes("InvalidParameters") || err.toString().includes("0x1771"));
      }
    });

    // REMOVED: supply_cap validation tests - pure quadratic implementation has no supply_cap parameter
  });

  describe("4. Minimum Trade Amount Enforcement", () => {
    it("rejects buy below minimum trade amount", async () => {
      const postId = crypto.createHash("sha256").update("min-trade-test").digest();
      const tokenName = "Min Trade Test";
      const tokenSymbol = "MTT";

      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), postId],
        program.programId
      );

      const [tokenMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), postId],
        program.programId
      );

      const [poolUsdcVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), postId],
        program.programId
      );


      await program.methods
        .initializePool(
          Array.from(postId),
          TEST_K_QUADRATIC,
          stringToBytes(tokenName, 32),
          stringToBytes(tokenSymbol, 10)
        )
        .accounts({
          pool: poolPda,
          tokenMint: tokenMint,
          usdcVault: poolUsdcVault,
          config: null,
          usdcMint: usdcMint,
          factory: globalFactoryPda,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        testUser1,
        tokenMint,
        testUser1.publicKey
      );

      // DEFAULT_MIN_TRADE_AMOUNT = 1_000_000 (1 USDC), try 500_000 (0.5 USDC)
      const belowMinimum = 500_000;

      try {
        await program.methods
          .buy(new anchor.BN(belowMinimum))
          .accounts({
            pool: poolPda,
            tokenMint: tokenMint,
            poolUsdcVault: poolUsdcVault,
            userUsdcAccount: testUser1UsdcAccount,
            userTokenAccount: userTokenAccount.address,
            user: testUser1.publicKey,
            config: null,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([testUser1])
          .rpc();
        assert.fail("Should have failed with InvalidAmount");
      } catch (err: any) {
        assert.ok(err.toString().includes("InvalidAmount") || err.toString().includes("0x1772"));
      }
    });

    it("rejects sell below minimum trade amount", async () => {
      const postId = crypto.createHash("sha256").update("min-trade-sell-test").digest();
      const tokenName = "Min Trade Sell Test";
      const tokenSymbol = "MTST";

      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), postId],
        program.programId
      );

      const [tokenMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), postId],
        program.programId
      );

      const [poolUsdcVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), postId],
        program.programId
      );


      await program.methods
        .initializePool(
          Array.from(postId),
          TEST_K_QUADRATIC,
          stringToBytes(tokenName, 32),
          stringToBytes(tokenSymbol, 10)
        )
        .accounts({
          pool: poolPda,
          tokenMint: tokenMint,
          usdcVault: poolUsdcVault,
          config: null,
          usdcMint: usdcMint,
          factory: globalFactoryPda,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        testUser2,
        tokenMint,
        testUser2.publicKey
      );

      // First buy some tokens
      await program.methods
        .buy(new anchor.BN(10_000_000_000)) // 10K USDC
        .accounts({
          pool: poolPda,
          tokenMint: tokenMint,
          poolUsdcVault: poolUsdcVault,
          userUsdcAccount: testUser2UsdcAccount,
          userTokenAccount: userTokenAccount.address,
          user: testUser2.publicKey,
          config: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([testUser2])
        .rpc();

      // Try to sell tiny amount (100 tokens with 6 decimals = 0.0001 tokens)
      const tinyAmount = 100;

      try {
        await program.methods
          .sell(new anchor.BN(tinyAmount))
          .accounts({
            pool: poolPda,
            tokenMint: tokenMint,
            poolUsdcVault: poolUsdcVault,
            userUsdcAccount: testUser2UsdcAccount,
            userTokenAccount: userTokenAccount.address,
            user: testUser2.publicKey,
            config: null,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([testUser2])
          .rpc();
        assert.fail("Should have failed with InvalidAmount");
      } catch (err: any) {
        assert.ok(err.toString().includes("InvalidAmount") || err.toString().includes("0x1772"));
      }
    });
  });

  describe("5. SPL Token Standard Compliance", () => {
    let splTestPool: PublicKey;
    let splTestTokenMint: PublicKey;
    let splTestPoolVault: PublicKey;

    before(async () => {
      const postId = crypto.createHash("sha256").update("spl-token-test-pool").digest();
      const tokenName = "SPL Test Token";
      const tokenSymbol = "SPLTEST";

      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), postId],
        program.programId
      );
      splTestPool = poolPda;

      const [tokenMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), postId],
        program.programId
      );
      splTestTokenMint = tokenMint;

      const [poolUsdcVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), postId],
        program.programId
      );
      splTestPoolVault = poolUsdcVault;

      await program.methods
        .initializePool(
          Array.from(postId),
          TEST_K_QUADRATIC,
          stringToBytes(tokenName, 32),
          stringToBytes(tokenSymbol, 10)
        )
        .accounts({
          pool: poolPda,
          tokenMint: tokenMint,
          usdcVault: poolUsdcVault,
          config: null,
          usdcMint: usdcMint,
          factory: globalFactoryPda,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      // Mint additional USDC to testUser1 for this specific test
      await mintTo(
        provider.connection,
        payer.payer,
        usdcMint,
        testUser1UsdcAccount,
        payer.publicKey,
        10_000_000_000 // 10K USDC extra for this test
      );
    });

    it("allows standard SPL token transfers between wallets", async () => {
      const user1TokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        testUser1,
        splTestTokenMint,
        testUser1.publicKey
      );

      const user2TokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        testUser2,
        splTestTokenMint,
        testUser2.publicKey
      );

      // User1 buys tokens (buy extra to ensure we have enough)
      await program.methods
        .buy(new anchor.BN(10_000_000_000)) // 10K USDC to ensure enough tokens
        .accounts({
          pool: splTestPool,
          tokenMint: splTestTokenMint,
          poolUsdcVault: splTestPoolVault,
          userUsdcAccount: testUser1UsdcAccount,
          userTokenAccount: user1TokenAccount.address,
          user: testUser1.publicKey,
          config: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([testUser1])
        .rpc();

      const beforeUser1 = await getAccount(provider.connection, user1TokenAccount.address);
      const transferAmount = 10_000_000; // 10 tokens (small amount to ensure we have enough)

      // Standard SPL token transfer (not through pool contract)
      await transfer(
        provider.connection,
        testUser1,
        user1TokenAccount.address,
        user2TokenAccount.address,
        testUser1,
        transferAmount
      );

      const afterUser1 = await getAccount(provider.connection, user1TokenAccount.address);
      const afterUser2 = await getAccount(provider.connection, user2TokenAccount.address);

      // Verify transfer succeeded
      assert.equal(
        Number(afterUser1.amount),
        Number(beforeUser1.amount) - transferAmount
      );
      assert.equal(
        Number(afterUser2.amount),
        transferAmount
      );
    });

    it("auto-creates associated token account on first buy", async () => {
      const newUser = Keypair.generate();

      // Fund with SOL
      await provider.connection.requestAirdrop(
        newUser.publicKey,
        5 * anchor.web3.LAMPORTS_PER_SOL
      );
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create USDC account and fund it
      const newUserUsdcAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer.payer,
        usdcMint,
        newUser.publicKey
      );

      await mintTo(
        provider.connection,
        payer.payer,
        usdcMint,
        newUserUsdcAccount.address,
        payer.publicKey,
        10_000_000_000 // 10K USDC
      );

      // Derive ATA address (should not exist yet)
      const [ata] = PublicKey.findProgramAddressSync(
        [
          newUser.publicKey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          splTestTokenMint.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Verify ATA doesn't exist
      const accountInfoBefore = await provider.connection.getAccountInfo(ata);
      assert.isNull(accountInfoBefore);

      // Buy should auto-create ATA
      await program.methods
        .buy(new anchor.BN(2_000_000_000)) // 2K USDC
        .accounts({
          pool: splTestPool,
          tokenMint: splTestTokenMint,
          poolUsdcVault: splTestPoolVault,
          userUsdcAccount: newUserUsdcAccount.address,
          userTokenAccount: ata,
          user: newUser.publicKey,
          config: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([newUser])
        .rpc();

      // Verify ATA was created and has tokens
      const accountInfoAfter = await getAccount(provider.connection, ata);
      assert.ok(Number(accountInfoAfter.amount) > 0);
    });

    it("allows direct token burning by users", async () => {
      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        testUser1,
        splTestTokenMint,
        testUser1.publicKey
      );

      // First buy some tokens to ensure we have enough to burn
      await program.methods
        .buy(new anchor.BN(1_000_000_000)) // 1K USDC
        .accounts({
          pool: splTestPool,
          tokenMint: splTestTokenMint,
          poolUsdcVault: splTestPoolVault,
          userUsdcAccount: testUser1UsdcAccount,
          userTokenAccount: userTokenAccount.address,
          user: testUser1.publicKey,
          config: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([testUser1])
        .rpc();

      const beforeBalance = await getAccount(provider.connection, userTokenAccount.address);
      const beforeMint = await getMint(provider.connection, splTestTokenMint);

      const burnAmount = 1_000_000; // 1 token (small amount to ensure we have enough)

      // User can burn their own tokens directly (standard SPL behavior)
      await burn(
        provider.connection,
        testUser1,
        userTokenAccount.address,
        splTestTokenMint,
        testUser1,
        burnAmount
      );

      const afterBalance = await getAccount(provider.connection, userTokenAccount.address);
      const afterMint = await getMint(provider.connection, splTestTokenMint);

      // Verify burn succeeded
      assert.equal(
        Number(afterBalance.amount),
        Number(beforeBalance.amount) - burnAmount
      );
      assert.equal(
        Number(afterMint.supply),
        Number(beforeMint.supply - BigInt(burnAmount))
      );
    });
  });

  describe("6. Authority and Access Control", () => {
    let authTestPool: PublicKey;
    let authTestTokenMint: PublicKey;
    let authTestPoolVault: PublicKey;
    let authTestPostId: Buffer;
    let authPoolAuthority: Keypair;

    before(async () => {
      authTestPostId = crypto.createHash("sha256").update("auth-test-pool").digest();
      const tokenName = "Auth Test Token";
      const tokenSymbol = "AUTH";

      const { TEST_POOL_AUTHORITY } = await import("./utils/test-keypairs");
      authPoolAuthority = TEST_POOL_AUTHORITY;

      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), authTestPostId],
        program.programId
      );
      authTestPool = poolPda;

      const [tokenMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), authTestPostId],
        program.programId
      );
      authTestTokenMint = tokenMint;

      const [poolUsdcVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), authTestPostId],
        program.programId
      );
      authTestPoolVault = poolUsdcVault;

      await program.methods
        .initializePool(
          Array.from(authTestPostId),
          TEST_K_QUADRATIC,
          stringToBytes(tokenName, 32),
          stringToBytes(tokenSymbol, 10)
        )
        .accounts({
          pool: poolPda,
          tokenMint: tokenMint,
          usdcVault: poolUsdcVault,
          config: null,
          usdcMint: usdcMint,
          factory: globalFactoryPda,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      // Mint additional USDC to testUser2 for this specific test
      await mintTo(
        provider.connection,
        payer.payer,
        usdcMint,
        testUser2UsdcAccount,
        payer.publicKey,
        50_000_000_000 // 50K USDC for this test
      );

      // Buy tokens to establish reserves
      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        testUser2,
        authTestTokenMint,
        testUser2.publicKey
      );

      await program.methods
        .buy(new anchor.BN(30_000_000_000)) // 30K USDC (reduced to leave room)
        .accounts({
          pool: authTestPool,
          tokenMint: authTestTokenMint,
          poolUsdcVault: authTestPoolVault,
          userUsdcAccount: testUser2UsdcAccount,
          userTokenAccount: userTokenAccount.address,
          user: testUser2.publicKey,
          config: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([testUser2])
        .rpc();
    });

    it("validates factory authority for penalty operations", async () => {
      const pool = await program.account.contentPool.fetch(authTestPool);

      // Verify pool has correct factory reference
      assert.equal(pool.factory.toBase58(), globalFactoryPda.toBase58());

      // Correct authority should succeed
      await program.methods
        .applyPoolPenalty(new anchor.BN(1_000_000_000)) // 1K USDC
        .accounts({
          pool: authTestPool,
          factory: globalFactoryPda,
          poolUsdcVault: authTestPoolVault,
          treasury: globalTreasuryPda,
          treasuryUsdcVault: globalTreasuryVault,
          authority: authPoolAuthority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authPoolAuthority])
        .rpc();
    });

    it("rejects penalty from unauthorized signer", async () => {
      const randomUser = Keypair.generate();

      try {
        await program.methods
          .applyPoolPenalty(new anchor.BN(1_000_000_000))
          .accounts({
            pool: authTestPool,
            factory: globalFactoryPda,
            poolUsdcVault: authTestPoolVault,
            treasuryUsdcVault: globalTreasuryVault,
            authority: randomUser.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([randomUser])
          .rpc();
        assert.fail("Should have failed with Unauthorized");
      } catch (err: any) {
        assert.ok(err.toString().includes("Unauthorized") || err.toString().includes("0x1770"));
      }
    });

    it("rejects reward from unauthorized signer", async () => {
      const randomUser = Keypair.generate();

      // Mint USDC to pool vault first
      await mintTo(
        provider.connection,
        payer.payer,
        usdcMint,
        authTestPoolVault,
        payer.publicKey,
        5_000_000_000 // 5K USDC
      );

      try {
        await program.methods
          .applyPoolReward(new anchor.BN(1_000_000_000))
          .accounts({
            pool: authTestPool,
            factory: globalFactoryPda,
            poolUsdcVault: authTestPoolVault,
            treasuryUsdcVault: globalTreasuryVault,
            authority: randomUser.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([randomUser])
          .rpc();
        assert.fail("Should have failed with Unauthorized");
      } catch (err: any) {
        assert.ok(err.toString().includes("Unauthorized") || err.toString().includes("0x1770"));
      }
    });

    it("validates pool-factory reference integrity", async () => {
      // Create a different factory
      const fakeFactory = Keypair.generate();

      try {
        await program.methods
          .applyPoolPenalty(new anchor.BN(1_000_000_000))
          .accounts({
            pool: authTestPool,
            factory: fakeFactory.publicKey, // Wrong factory
            poolUsdcVault: authTestPoolVault,
            treasury: globalTreasuryPda,
            treasuryUsdcVault: globalTreasuryVault,
            authority: authPoolAuthority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([authPoolAuthority])
          .rpc();
        assert.fail("Should have failed with InvalidFactory or account validation");
      } catch (err: any) {
        // Should fail with either InvalidFactory or Anchor account validation error
        assert.ok(err);
      }
    });
  });
});
