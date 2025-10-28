import { assert } from "chai";

/**
 * Unit Tests: Fee Calculation Logic
 * Tests the fee calculation math in isolation
 */

describe("Fee Calculation Tests", () => {
  // Helper function (mirrors smart contract logic)
  function calculateFees(
    amount: number,
    totalFeeBps: number,
    creatorSplitBps: number
  ): { totalFee: number; creatorFee: number; protocolFee: number } {
    const totalFee = Math.floor((amount * totalFeeBps) / 10000);
    const creatorFee = Math.floor((totalFee * creatorSplitBps) / 10000);
    const protocolFee = totalFee - creatorFee;

    return { totalFee, creatorFee, protocolFee };
  }

  describe("Standard Fee Scenarios", () => {
    it("calculates 0.5% fee (50 bps) correctly", () => {
      const amount = 100_000_000; // 100 USDC (6 decimals)
      const { totalFee, creatorFee, protocolFee } = calculateFees(
        amount,
        50, // 0.5%
        10000 // 100% to creator
      );

      assert.equal(totalFee, 500_000); // 0.50 USDC
      assert.equal(creatorFee, 500_000); // 0.50 USDC to creator
      assert.equal(protocolFee, 0); // 0 USDC to protocol
    });

    it("calculates 1% fee (100 bps) correctly", () => {
      const amount = 100_000_000; // 100 USDC
      const { totalFee, creatorFee, protocolFee } = calculateFees(
        amount,
        100, // 1%
        10000 // 100% to creator
      );

      assert.equal(totalFee, 1_000_000); // 1 USDC
      assert.equal(creatorFee, 1_000_000);
      assert.equal(protocolFee, 0);
    });

    it("calculates 10% fee (1000 bps) correctly", () => {
      const amount = 100_000_000; // 100 USDC
      const { totalFee, creatorFee, protocolFee } = calculateFees(
        amount,
        1000, // 10%
        10000 // 100% to creator
      );

      assert.equal(totalFee, 10_000_000); // 10 USDC
      assert.equal(creatorFee, 10_000_000);
      assert.equal(protocolFee, 0);
    });
  });

  describe("Fee Split Scenarios", () => {
    it("splits 100% to creator (10000 bps)", () => {
      const amount = 100_000_000;
      const { totalFee, creatorFee, protocolFee } = calculateFees(amount, 50, 10000);

      assert.equal(creatorFee, 500_000);
      assert.equal(protocolFee, 0);
      assert.equal(creatorFee + protocolFee, totalFee);
    });

    it("splits 50/50 (5000 bps)", () => {
      const amount = 100_000_000;
      const { totalFee, creatorFee, protocolFee } = calculateFees(amount, 100, 5000);

      assert.equal(totalFee, 1_000_000); // 1 USDC
      assert.equal(creatorFee, 500_000); // 0.50 USDC
      assert.equal(protocolFee, 500_000); // 0.50 USDC
      assert.equal(creatorFee + protocolFee, totalFee);
    });

    it("splits 70/30 (7000 bps)", () => {
      const amount = 100_000_000;
      const { totalFee, creatorFee, protocolFee } = calculateFees(amount, 100, 7000);

      assert.equal(totalFee, 1_000_000);
      assert.equal(creatorFee, 700_000); // 70%
      assert.equal(protocolFee, 300_000); // 30%
      assert.equal(creatorFee + protocolFee, totalFee);
    });

    it("splits 0% to creator (0 bps) - all to protocol", () => {
      const amount = 100_000_000;
      const { totalFee, creatorFee, protocolFee } = calculateFees(amount, 100, 0);

      assert.equal(creatorFee, 0);
      assert.equal(protocolFee, 1_000_000); // All to protocol
      assert.equal(creatorFee + protocolFee, totalFee);
    });
  });

  describe("Edge Cases", () => {
    it("handles zero fee (0 bps)", () => {
      const amount = 100_000_000;
      const { totalFee, creatorFee, protocolFee } = calculateFees(amount, 0, 10000);

      assert.equal(totalFee, 0);
      assert.equal(creatorFee, 0);
      assert.equal(protocolFee, 0);
    });

    it("handles 100% fee (10000 bps)", () => {
      const amount = 100_000_000;
      const { totalFee, creatorFee, protocolFee } = calculateFees(amount, 10000, 10000);

      assert.equal(totalFee, 100_000_000); // All of it
      assert.equal(creatorFee, 100_000_000);
      assert.equal(protocolFee, 0);
    });

    it("handles rounding down for small amounts", () => {
      const amount = 1; // 0.000001 USDC
      const { totalFee, creatorFee, protocolFee } = calculateFees(amount, 50, 10000);

      assert.equal(totalFee, 0); // Rounds down
      assert.equal(creatorFee, 0);
      assert.equal(protocolFee, 0);
    });

    it("handles rounding on fee split", () => {
      const amount = 100_000_000;
      const { totalFee, creatorFee, protocolFee } = calculateFees(amount, 33, 3333);

      // total_fee = 100M * 33 / 10000 = 330000
      // creator_fee = 330000 * 3333 / 10000 = 109989 (rounds down)
      // protocol_fee = 330000 - 109989 = 220011

      assert.equal(totalFee, 330_000);
      assert.equal(creatorFee, 109_989);
      assert.equal(protocolFee, 220_011);
      assert.equal(creatorFee + protocolFee, totalFee);
    });
  });

  describe("Large Amount Tests", () => {
    it("handles 1M USDC trade", () => {
      const amount = 1_000_000_000_000; // 1M USDC
      const { totalFee, creatorFee, protocolFee } = calculateFees(amount, 50, 10000);

      assert.equal(totalFee, 5_000_000_000); // 5000 USDC
      assert.equal(creatorFee, 5_000_000_000);
      assert.equal(protocolFee, 0);
    });

    it("handles max trade size with high fee", () => {
      const amount = 1_000_000_000_000; // 1M USDC
      const { totalFee, creatorFee, protocolFee } = calculateFees(amount, 5000, 5000);

      assert.equal(totalFee, 500_000_000_000); // 500K USDC (50%)
      assert.equal(creatorFee, 250_000_000_000); // 250K USDC
      assert.equal(protocolFee, 250_000_000_000); // 250K USDC
      assert.equal(creatorFee + protocolFee, totalFee);
    });
  });

  describe("Invariants", () => {
    it("ensures creator_fee + protocol_fee = total_fee", () => {
      const testCases = [
        { amount: 100_000_000, feeBps: 50, splitBps: 10000 },
        { amount: 100_000_000, feeBps: 100, splitBps: 5000 },
        { amount: 1_000_000, feeBps: 500, splitBps: 7500 },
        { amount: 1_000_000_000, feeBps: 1000, splitBps: 3333 },
      ];

      testCases.forEach(({ amount, feeBps, splitBps }) => {
        const { totalFee, creatorFee, protocolFee } = calculateFees(
          amount,
          feeBps,
          splitBps
        );
        assert.equal(
          creatorFee + protocolFee,
          totalFee,
          `Failed for amount=${amount}, fee=${feeBps}, split=${splitBps}`
        );
      });
    });

    it("ensures total_fee <= amount", () => {
      const testCases = [
        { amount: 100_000_000, feeBps: 50 },
        { amount: 100_000_000, feeBps: 1000 },
        { amount: 100_000_000, feeBps: 9999 },
        { amount: 100_000_000, feeBps: 10000 }, // 100%
      ];

      testCases.forEach(({ amount, feeBps }) => {
        const { totalFee } = calculateFees(amount, feeBps, 10000);
        assert.isAtMost(
          totalFee,
          amount,
          `Fee exceeds amount for fee=${feeBps}`
        );
      });
    });

    it("ensures creator_fee <= total_fee", () => {
      const testCases = [
        { splitBps: 10000 }, // 100%
        { splitBps: 5000 }, // 50%
        { splitBps: 0 }, // 0%
      ];

      testCases.forEach(({ splitBps }) => {
        const { totalFee, creatorFee } = calculateFees(100_000_000, 100, splitBps);
        assert.isAtMost(
          creatorFee,
          totalFee,
          `Creator fee exceeds total for split=${splitBps}`
        );
      });
    });
  });
});
