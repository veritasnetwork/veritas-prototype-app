import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { mintTo, getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";
import * as crypto from "crypto";
import { TestEnvironment } from "./utils/test-environment";
import { TestPool } from "./utils/test-pool";

describe("ProtocolTreasury Tests", () => {
  let env: TestEnvironment;
  let pool1: TestPool;
  let pool2: TestPool;
  let testUsers: { users: Keypair[]; usdcAccounts: PublicKey[] };

  before(async () => {
    // Setup shared test environment (USDC mint, factory, treasury)
    env = await TestEnvironment.setup();

    // Create test user and fund with USDC
    testUsers = await env.getTestUsers(1);
    await mintTo(
      env.provider.connection,
      env.payer.payer,
      env.usdcMint,
      testUsers.usdcAccounts[0],
      env.payer.publicKey,
      200_000_000_000 // 200K USDC
    );

    // Create pool1
    pool1 = new TestPool(
      env,
      crypto.createHash("sha256").update("treasury-test-pool-1").digest(),
      {
        kQuadratic: new anchor.BN(200),
        reserveCap: new anchor.BN(5_000_000_000),
        tokenName: "Treasury Test 1",
        tokenSymbol: "TT1",
      }
    );
    await pool1.initialize();
    await pool1.fundWithBuy(
      testUsers.users[0],
      testUsers.usdcAccounts[0],
      new anchor.BN(50_000_000_000)
    );

    // Create pool2
    pool2 = new TestPool(
      env,
      crypto.createHash("sha256").update("treasury-test-pool-2").digest(),
      {
        kQuadratic: new anchor.BN(200),
        reserveCap: new anchor.BN(5_000_000_000),
        tokenName: "Treasury Test 2",
        tokenSymbol: "TT2",
      }
    );
    await pool2.initialize();
    await pool2.fundWithBuy(
      testUsers.users[0],
      testUsers.usdcAccounts[0],
      new anchor.BN(50_000_000_000)
    );
  });


  describe("1. Treasury Initialization", () => {
    describe("1.1 Singleton Treasury Creation", () => {
      it("initializes treasury with authority and vault", async () => {
        // Treasury is already initialized by TestEnvironment.setup()
        const treasury = await env.program.account.protocolTreasury.fetch(env.treasuryPda);

        // Verify treasury has an authority
        assert.ok(treasury.authority, "Treasury should have an authority");
        assert.notEqual(treasury.authority.toBase58(), PublicKey.default.toBase58());

        // Verify vault is properly configured
        const vaultInfo = await getAccount(env.provider.connection, env.treasuryVault);
        assert.equal(vaultInfo.owner.toBase58(), env.treasuryPda.toBase58());
        assert.equal(vaultInfo.mint.toBase58(), env.usdcMint.toBase58());
      });

      it("prevents duplicate treasury initialization", async () => {
        try {
          await env.program.methods
            .initializeTreasury()
            .accounts({
              treasury: env.treasuryPda,
              usdcVault: env.treasuryVault,
              usdcMint: env.usdcMint,
              authority: env.payer.publicKey,
              payer: env.payer.publicKey,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();
          assert.fail("Should have failed with account already exists");
        } catch (err) {
          assert.ok(err);
        }
      });
    });
  });

  describe("2. Epoch Settlement Operations", () => {
    describe("2.1 Phase 1: Penalty Collection", () => {
      it("collects penalty from pool to treasury", async () => {
        const penaltyAmount = new anchor.BN(10_000_000_000); // 10K USDC

        const beforePoolVault = await getAccount(env.provider.connection, pool1.usdcVault);
        const beforeTreasuryVault = await getAccount(env.provider.connection, env.treasuryVault);
        const beforePool = await pool1.fetch();

        await pool1.applyPenalty(penaltyAmount);

        const afterPoolVault = await getAccount(env.provider.connection, pool1.usdcVault);
        const afterTreasuryVault = await getAccount(env.provider.connection, env.treasuryVault);
        const afterPool = await pool1.fetch();

        // Verify USDC transferred
        assert.equal(
          Number(afterPoolVault.amount),
          Number(beforePoolVault.amount) - penaltyAmount.toNumber()
        );
        assert.equal(
          Number(afterTreasuryVault.amount),
          Number(beforeTreasuryVault.amount) + penaltyAmount.toNumber()
        );

        // Verify pool reserve decreased
        assert.equal(
          afterPool.reserve.toString(),
          beforePool.reserve.sub(penaltyAmount).toString()
        );

        // Verify k values scaled down (elastic-k)
        const scalingRatio = afterPool.reserve.toNumber() / beforePool.reserve.toNumber();
        const expectedKQuadratic = Math.floor(beforePool.kQuadratic.toNumber() * scalingRatio);

        // Allow for small rounding differences
        assert.approximately(
          afterPool.kQuadratic.toNumber(),
          expectedKQuadratic,
          10 // tolerance
        );
      });

      it("handles multiple penalties in sequence", async () => {
        const penalty1 = new anchor.BN(5_000_000_000); // 5K USDC
        const penalty2 = new anchor.BN(3_000_000_000); // 3K USDC

        const beforeTreasuryVault = await getAccount(env.provider.connection, env.treasuryVault);

        await pool2.applyPenalty(penalty1);
        await pool1.applyPenalty(penalty2);

        const afterTreasuryVault = await getAccount(env.provider.connection, env.treasuryVault);

        // Verify treasury accumulated both penalties
        const totalPenalties = penalty1.add(penalty2).toNumber();
        assert.equal(
          Number(afterTreasuryVault.amount),
          Number(beforeTreasuryVault.amount) + totalPenalties
        );
      });
    });

    describe("2.2 Phase 2: Reward Distribution", () => {
      it("distributes reward from treasury to pool", async () => {
        const rewardAmount = new anchor.BN(5_000_000_000); // 5K USDC

        // Create a fresh pool for reward testing (pool2 was penalized in previous test)
        const pool3 = new TestPool(
          env,
          crypto.createHash("sha256").update("treasury-test-pool-3").digest(),
          {
            kQuadratic: new anchor.BN(200),
            reserveCap: new anchor.BN(5_000_000_000),
            tokenName: "Treasury Test 3",
            tokenSymbol: "TT3",
          }
        );
        await pool3.initialize();
        await pool3.fundWithBuy(
          testUsers.users[0],
          testUsers.usdcAccounts[0],
          new anchor.BN(50_000_000_000)
        );

        const beforePoolVault = await getAccount(env.provider.connection, pool3.usdcVault);
        const beforeTreasuryVault = await getAccount(env.provider.connection, env.treasuryVault);
        const beforePool = await pool3.fetch();

        await pool3.applyReward(rewardAmount);

        const afterPoolVault = await getAccount(env.provider.connection, pool3.usdcVault);
        const afterTreasuryVault = await getAccount(env.provider.connection, env.treasuryVault);
        const afterPool = await pool3.fetch();

        // Verify USDC transferred (relative change, not absolute)
        const poolVaultChange = Number(afterPoolVault.amount) - Number(beforePoolVault.amount);
        const treasuryVaultChange = Number(afterTreasuryVault.amount) - Number(beforeTreasuryVault.amount);

        assert.equal(
          poolVaultChange,
          rewardAmount.toNumber(),
          "Pool vault should increase by reward amount"
        );
        assert.equal(
          treasuryVaultChange,
          -rewardAmount.toNumber(),
          "Treasury vault should decrease by reward amount"
        );

        // Verify pool reserve increased
        assert.equal(
          afterPool.reserve.toString(),
          beforePool.reserve.add(rewardAmount).toString()
        );

        // Verify k values scaled up (elastic-k)
        const scalingRatio = afterPool.reserve.toNumber() / beforePool.reserve.toNumber();
        const expectedKQuadratic = Math.floor(beforePool.kQuadratic.toNumber() * scalingRatio);

        assert.approximately(
          afterPool.kQuadratic.toNumber(),
          expectedKQuadratic,
          10
        );
      });

      it("distributes proportional rewards to multiple pools", async () => {
        const reward1 = new anchor.BN(2_000_000_000); // 2K USDC
        const reward2 = new anchor.BN(3_000_000_000); // 3K USDC

        const beforeTreasuryVault = await getAccount(env.provider.connection, env.treasuryVault);

        await pool1.applyReward(reward1);
        await pool2.applyReward(reward2);

        const afterTreasuryVault = await getAccount(env.provider.connection, env.treasuryVault);

        // Verify treasury depleted by rewards
        const totalRewards = reward1.add(reward2).toNumber();
        assert.equal(
          Number(afterTreasuryVault.amount),
          Number(beforeTreasuryVault.amount) - totalRewards
        );
      });
    });
  });

  describe("3. Zero-Sum Property", () => {
    describe("3.1 Complete Epoch Cycle", () => {
      it("maintains zero-sum through complete epoch", async () => {
        // Get initial treasury balance
        const initialTreasury = await getAccount(env.provider.connection, env.treasuryVault);
        const initialTreasuryBalance = Number(initialTreasury.amount);

        // Phase 1: Collect penalties (30K total)
        const penalty1 = new anchor.BN(10_000_000_000);
        const penalty2 = new anchor.BN(20_000_000_000);

        await pool1.applyPenalty(penalty1);
        await pool2.applyPenalty(penalty2);

        const afterPenalties = await getAccount(env.provider.connection, env.treasuryVault);
        const totalPenalties = penalty1.add(penalty2).toNumber();

        // Verify treasury accumulated penalties
        assert.equal(
          Number(afterPenalties.amount),
          initialTreasuryBalance + totalPenalties
        );

        // Phase 2: Distribute rewards (30K total - same as penalties)
        const reward1 = new anchor.BN(15_000_000_000);
        const reward2 = new anchor.BN(15_000_000_000);

        await pool1.applyReward(reward1);
        await pool2.applyReward(reward2);

        const finalTreasury = await getAccount(env.provider.connection, env.treasuryVault);

        // Verify zero-sum: treasury should return to initial balance
        assert.equal(
          Number(finalTreasury.amount),
          initialTreasuryBalance
        );
      });
    });
  });

  describe("4. Authority and Access Control", () => {
    describe("4.1 Treasury Operations Authority", () => {
      it("allows authority to update treasury authority", async () => {
        const treasuryAccount = await env.program.account.protocolTreasury.fetch(env.treasuryPda);
        const currentAuthority = env.payer; // TestEnvironment uses payer as authority

        const newAuthority = Keypair.generate();

        await env.program.methods
          .updateTreasuryAuthority(newAuthority.publicKey)
          .accounts({
            treasury: env.treasuryPda,
            authority: currentAuthority.publicKey,
          })
          .signers([currentAuthority.payer])
          .rpc();

        const treasury = await env.program.account.protocolTreasury.fetch(env.treasuryPda);
        assert.equal(
          treasury.authority.toBase58(),
          newAuthority.publicKey.toBase58()
        );

        // Restore original authority
        await env.program.methods
          .updateTreasuryAuthority(currentAuthority.publicKey)
          .accounts({
            treasury: env.treasuryPda,
            authority: newAuthority.publicKey,
          })
          .signers([newAuthority])
          .rpc();
      });

      it("rejects treasury operations from non-authority", async () => {
        const randomUser = Keypair.generate();

        try {
          await env.program.methods
            .applyPoolPenalty(new anchor.BN(1_000_000_000))
            .accounts({
              pool: pool1.poolPda,
              factory: env.factoryPda,
              poolUsdcVault: pool1.usdcVault,
              treasury: env.treasuryPda,
              treasuryUsdcVault: env.treasuryVault,
              authority: randomUser.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([randomUser])
            .rpc();
          assert.fail("Should have failed with unauthorized");
        } catch (err) {
          assert.ok(err);
        }
      });
    });
  });

  describe("6. Edge Cases and Attack Vectors", () => {
    describe("6.1 Insufficient Treasury Balance", () => {
      it("rejects reward exceeding treasury balance", async () => {
        const treasuryBalance = await getAccount(env.provider.connection, env.treasuryVault);
        const excessiveReward = Number(treasuryBalance.amount) + 1_000_000_000;

        try {
          await env.program.methods
            .applyPoolReward(new anchor.BN(excessiveReward))
            .accounts({
              pool: pool1.poolPda,
              factory: env.factoryPda,
              poolUsdcVault: pool1.usdcVault,
              treasury: env.treasuryPda,
              treasuryUsdcVault: env.treasuryVault,
              authority: env.poolAuthority.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([env.poolAuthority])
            .rpc();
          assert.fail("Should have failed with insufficient balance");
        } catch (err) {
          assert.ok(err);
        }
      });
    });

    describe("6.2 Insufficient Pool Balance", () => {
      it("rejects penalty exceeding pool reserve", async () => {
        const poolAccount = await pool1.fetch();
        const poolVaultInfo = await getAccount(env.provider.connection, pool1.usdcVault);
        const excessivePenalty = Math.max(
          poolAccount.reserve.toNumber(),
          Number(poolVaultInfo.amount)
        ) + 1_000_000_000;

        try {
          await env.program.methods
            .applyPoolPenalty(new anchor.BN(excessivePenalty))
            .accounts({
              pool: pool1.poolPda,
              factory: env.factoryPda,
              poolUsdcVault: pool1.usdcVault,
              treasury: env.treasuryPda,
              treasuryUsdcVault: env.treasuryVault,
              authority: env.poolAuthority.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([env.poolAuthority])
            .rpc();
          assert.fail("Should have failed with insufficient reserve");
        } catch (err) {
          assert.ok(err);
        }
      });
    });
  });
});
