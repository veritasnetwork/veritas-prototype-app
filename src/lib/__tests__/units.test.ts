import { describe, it, expect } from 'vitest';
import {
  DisplayUnits,
  AtomicUnits,
  MicroUSDC,
  displayToAtomic,
  atomicToDisplay,
  usdcToMicro,
  microToUsdc,
  asDisplay,
  asAtomic,
  asMicroUsdc,
  poolDisplayToAtomic,
  poolAtomicToDisplay,
} from '../units';

describe('Unit Conversion System', () => {
  describe('displayToAtomic', () => {
    it('converts display units to atomic units correctly', () => {
      expect(displayToAtomic(0.000025 as DisplayUnits)).toBe(25);
      expect(displayToAtomic(1 as DisplayUnits)).toBe(1_000_000);
      expect(displayToAtomic(0.123456 as DisplayUnits)).toBe(123_456);
    });

    it('handles edge cases', () => {
      expect(displayToAtomic(0 as DisplayUnits)).toBe(0);
      expect(displayToAtomic(1000000 as DisplayUnits)).toBe(1_000_000_000_000);
    });

    it('rounds floating point properly', () => {
      expect(displayToAtomic(0.0000001 as DisplayUnits)).toBe(0); // Rounds down
      expect(displayToAtomic(0.0000009 as DisplayUnits)).toBe(1); // Rounds up
      expect(displayToAtomic(0.1234567 as DisplayUnits)).toBe(123_457); // Rounds up
    });
  });

  describe('atomicToDisplay', () => {
    it('converts atomic units to display units correctly', () => {
      expect(atomicToDisplay(25 as AtomicUnits)).toBe(0.000025);
      expect(atomicToDisplay(1_000_000 as AtomicUnits)).toBe(1);
      expect(atomicToDisplay(123_456 as AtomicUnits)).toBe(0.123456);
    });

    it('handles edge cases', () => {
      expect(atomicToDisplay(0 as AtomicUnits)).toBe(0);
      expect(atomicToDisplay(1_000_000_000_000 as AtomicUnits)).toBe(1000000);
    });
  });

  describe('usdcToMicro and microToUsdc', () => {
    it('converts USDC to micro-USDC and back', () => {
      expect(usdcToMicro(1)).toBe(1_000_000);
      expect(usdcToMicro(0.01)).toBe(10_000);
      expect(usdcToMicro(1234.56)).toBe(1_234_560_000);

      expect(microToUsdc(1_000_000 as MicroUSDC)).toBe(1);
      expect(microToUsdc(10_000 as MicroUSDC)).toBe(0.01);
      expect(microToUsdc(1_234_560_000 as MicroUSDC)).toBe(1234.56);
    });
  });

  describe('Safe casting functions', () => {
    describe('asDisplay', () => {
      it('accepts valid display values', () => {
        expect(asDisplay(0)).toBe(0);
        expect(asDisplay(100)).toBe(100);
        expect(asDisplay(0.123456)).toBe(0.123456);
      });

      it('throws on invalid values', () => {
        expect(() => asDisplay(-1)).toThrow('Invalid display unit value');
        expect(() => asDisplay(NaN)).toThrow('Invalid display unit value');
        expect(() => asDisplay(Infinity)).toThrow('Invalid display unit value');
        expect(() => asDisplay(1_000_000_000_001)).toThrow('exceeds max safe supply');
      });
    });

    describe('asAtomic', () => {
      it('accepts valid atomic values', () => {
        expect(asAtomic(0)).toBe(0);
        expect(asAtomic(1_000_000)).toBe(1_000_000);
        expect(asAtomic(123_456_789)).toBe(123_456_789);
      });

      it('throws on non-integers', () => {
        expect(() => asAtomic(0.5)).toThrow('Atomic units must be integers');
        expect(() => asAtomic(1.23)).toThrow('Atomic units must be integers');
      });

      it('throws on invalid values', () => {
        expect(() => asAtomic(-1)).toThrow('Invalid atomic unit value');
        expect(() => asAtomic(NaN)).toThrow('Invalid atomic unit value');
        expect(() => asAtomic(Number.MAX_SAFE_INTEGER + 1)).toThrow('exceeds max safe supply');
      });
    });

    describe('asMicroUsdc', () => {
      it('accepts valid micro-USDC values', () => {
        expect(asMicroUsdc(0)).toBe(0);
        expect(asMicroUsdc(1_000_000)).toBe(1_000_000);
        expect(asMicroUsdc(999_999_999)).toBe(999_999_999);
      });

      it('throws on non-integers', () => {
        expect(() => asMicroUsdc(0.5)).toThrow('Micro-USDC must be integer');
        expect(() => asMicroUsdc(100.01)).toThrow('Micro-USDC must be integer');
      });

      it('throws on invalid values', () => {
        expect(() => asMicroUsdc(-1)).toThrow('Invalid micro-USDC value');
        expect(() => asMicroUsdc(NaN)).toThrow('Invalid micro-USDC value');
      });
    });
  });

  describe('Pool state conversions', () => {
    it('converts pool state from display to atomic', () => {
      const displayState = {
        sLong: asDisplay(100),
        sShort: asDisplay(50),
        vaultBalance: asMicroUsdc(10_000_000), // 10 USDC
      };

      const atomicState = poolDisplayToAtomic(displayState);

      expect(atomicState.sLongSupply).toBe(100_000_000);
      expect(atomicState.sShortSupply).toBe(50_000_000);
      expect(atomicState.vaultBalance).toBe(10_000_000);
    });

    it('converts pool state from atomic to display', () => {
      const atomicState = {
        sLongSupply: asAtomic(100_000_000),
        sShortSupply: asAtomic(50_000_000),
        vaultBalance: asMicroUsdc(10_000_000),
      };

      const displayState = poolAtomicToDisplay(atomicState);

      expect(displayState.sLong).toBe(100);
      expect(displayState.sShort).toBe(50);
      expect(displayState.vaultBalance).toBe(10_000_000);
    });

    it('round-trips correctly', () => {
      const original = {
        sLong: asDisplay(123.456789),
        sShort: asDisplay(987.654321),
        vaultBalance: asMicroUsdc(55_555_555),
      };

      const atomic = poolDisplayToAtomic(original);
      const backToDisplay = poolAtomicToDisplay(atomic);

      // Note: Some precision loss is expected due to rounding
      expect(backToDisplay.sLong).toBeCloseTo(123.456789, 5);
      expect(backToDisplay.sShort).toBeCloseTo(987.654321, 5);
      expect(backToDisplay.vaultBalance).toBe(55_555_555);
    });
  });

  describe('Real-world scenarios', () => {
    it('handles typical trade amounts correctly', () => {
      // User buys 0.001 tokens (display)
      const tokensDisplay = asDisplay(0.001);
      const tokensAtomic = displayToAtomic(tokensDisplay);
      expect(tokensAtomic).toBe(1000);

      // Back to display for UI
      expect(atomicToDisplay(tokensAtomic)).toBe(0.001);
    });

    it('handles pool deployment scenario', () => {
      // Initial deployment: 1000 USDC split 50/50
      const initialUsdc = 1000;
      const initialMicroUsdc = usdcToMicro(initialUsdc);
      expect(initialMicroUsdc).toBe(1_000_000_000);

      // Initial supplies (display units from smart contract)
      const initialSupply = asDisplay(1000); // 1000 tokens each side
      const atomicSupply = displayToAtomic(initialSupply);
      expect(atomicSupply).toBe(1_000_000_000);
    });

    it('handles very small amounts', () => {
      // Minimum tradeable amount: 1 atomic unit
      const minAtomic = asAtomic(1);
      const minDisplay = atomicToDisplay(minAtomic);
      expect(minDisplay).toBe(0.000001);

      // Convert back
      expect(displayToAtomic(minDisplay as DisplayUnits)).toBe(1);
    });

    it('handles maximum safe supplies', () => {
      // Max supply limited by JavaScript's Number.MAX_SAFE_INTEGER
      // 1 trillion tokens * 1M decimals = 10^18, which exceeds MAX_SAFE_INTEGER
      // So we need a smaller max: ~9 million tokens is the practical limit
      const maxSafeDisplay = asDisplay(9_000_000); // 9 million tokens
      const maxSafeAtomic = displayToAtomic(maxSafeDisplay);
      expect(maxSafeAtomic).toBe(9_000_000_000_000); // 9 * 10^12

      // Should still be within safe integer range
      expect(Number.isSafeInteger(maxSafeAtomic)).toBe(true);

      // Trying to go beyond should eventually hit limits
      const tooLarge = 10_000_000_000_000; // 10 trillion display units
      expect(() => asDisplay(tooLarge)).toThrow('exceeds max safe supply');
    });
  });

  describe('Common mistakes and edge cases', () => {
    it('catches display/atomic confusion', () => {
      // Accidentally passing atomic where display expected
      expect(() => asDisplay(1_000_000_000_001)).toThrow('exceeds max safe supply');

      // Accidentally passing display where atomic expected
      expect(() => asAtomic(0.5)).toThrow('must be integers');
    });

    it('handles JavaScript floating point quirks', () => {
      // Classic JS: 0.1 + 0.2 !== 0.3
      const problematic = 0.1 + 0.2; // 0.30000000000000004
      const display = asDisplay(problematic);
      const atomic = displayToAtomic(display);
      const backToDisplay = atomicToDisplay(atomic);

      // Should round correctly despite floating point errors
      expect(atomic).toBe(300_000);
      expect(backToDisplay).toBeCloseTo(0.3, 10);
    });

    it('preserves precision for reasonable values', () => {
      const testCases = [
        0.000001, // Minimum
        0.123456, // Typical small
        1.0,      // Unity
        999.999999, // Large
        1000000.0, // Very large
      ];

      for (const value of testCases) {
        const display = asDisplay(value);
        const atomic = displayToAtomic(display);
        const back = atomicToDisplay(atomic);
        expect(back).toBeCloseTo(value, 6);
      }
    });
  });
});