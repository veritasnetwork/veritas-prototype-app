import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import * as crypto from "crypto";
import { mintTo } from "@solana/spl-token";
import { TestEnvironment } from "./utils/test-environment";
import { TestPool } from "./utils/test-pool";

describe("Integration Tests - Linked Modules", () => {
  let env: TestEnvironment;

  before(async () => {
    console.log("\n========== Setting up Test Environment ==========");
    env = await TestEnvironment.setup();
    console.log("=================================================\n");
  });

  it("verifies treasury is properly initialized", async () => {
    const treasury = await env.program.account.protocolTreasury.fetch(
      env.treasuryPda
    );

    assert.equal(
      treasury.usdcVault.toString(),
      env.treasuryVault.toString(),
      "Treasury vault should match"
    );
  });

  describe("Pool-Treasury Integration", () => {
    let pool: TestPool;
    let testUsers: { users: any[]; usdcAccounts: any[] };

    before(async () => {
      // Create test users
      testUsers = await env.getTestUsers(1);

      // Mint USDC to test user
      await mintTo(
        env.provider.connection,
        env.payer.payer,
        env.usdcMint,
        testUsers.usdcAccounts[0],
        env.payer.publicKey,
        100_000_000_000 // 100K USDC
      );

      // Create and initialize pool
      const postId = crypto
        .createHash("sha256")
        .update("integration-test-pool")
        .digest();

      pool = new TestPool(env, postId, {
        kQuadratic: new anchor.BN(200),
        reserveCap: new anchor.BN(5_000_000_000),
        tokenName: "Test Token",
        tokenSymbol: "TEST",
      });

      await pool.initialize();

      // Fund pool with buy
      await pool.fundWithBuy(
        testUsers.users[0],
        testUsers.usdcAccounts[0],
        new anchor.BN(50_000_000_000) // 50K USDC
      );
    });

    it("applies penalty correctly with treasury integration", async () => {
      const penaltyAmount = new anchor.BN(10_000_000_000); // 10K USDC

      const beforePool = await pool.fetch();
      const beforeReserve = beforePool.reserve;

      // This should work: pool and treasury share same USDC mint
      await pool.applyPenalty(penaltyAmount);

      const afterPool = await pool.fetch();
      const afterReserve = afterPool.reserve;

      // Verify reserve decreased by penalty
      assert.equal(
        afterReserve.toString(),
        beforeReserve.sub(penaltyAmount).toString(),
        "Pool reserve should decrease by penalty amount"
      );

      // Verify k_quadratic scaled down (elastic-k)
      const scalingRatio = afterReserve.toNumber() / beforeReserve.toNumber();
      const expectedKQuadratic = Math.floor(
        beforePool.kQuadratic.toNumber() * scalingRatio
      );

      assert.approximately(
        afterPool.kQuadratic.toNumber(),
        expectedKQuadratic,
        5,
        "k_quadratic should scale with reserve"
      );
    });

    it("applies reward correctly with treasury integration", async () => {
      const rewardAmount = new anchor.BN(5_000_000_000); // 5K USDC

      const beforePool = await pool.fetch();
      const beforeReserve = beforePool.reserve;

      // This should work: pool and treasury share same USDC mint
      await pool.applyReward(rewardAmount);

      const afterPool = await pool.fetch();
      const afterReserve = afterPool.reserve;

      // Verify reserve increased by reward
      assert.equal(
        afterReserve.toString(),
        beforeReserve.add(rewardAmount).toString(),
        "Pool reserve should increase by reward amount"
      );

      // Verify k_quadratic scaled up (elastic-k)
      const scalingRatio = afterReserve.toNumber() / beforeReserve.toNumber();
      const expectedKQuadratic = Math.floor(
        beforePool.kQuadratic.toNumber() * scalingRatio
      );

      assert.approximately(
        afterPool.kQuadratic.toNumber(),
        expectedKQuadratic,
        5,
        "k_quadratic should scale with reserve"
      );
    });
  });
});
