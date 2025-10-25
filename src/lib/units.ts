/**
 * Type-safe unit system for Veritas Protocol
 *
 * CRITICAL: This module enforces correct unit conversions throughout the codebase.
 *
 * Unit Conventions:
 * - On-chain (Solana): Token supplies stored in DISPLAY units
 * - Database (Supabase): Token supplies stored in ATOMIC units
 * - SPL Token Mints: Always ATOMIC units (6 decimals)
 * - USDC amounts: Always ATOMIC units (micro-USDC)
 *
 * Display unit: The human-readable amount (e.g., 0.000025 tokens)
 * Atomic unit: The raw integer amount (e.g., 25 = 0.000025 * 1,000,000)
 */

// Branded types to prevent mixing units at compile time
export type DisplayUnits = number & { readonly __brand: 'display' };
export type AtomicUnits = number & { readonly __brand: 'atomic' };
export type MicroUSDC = number & { readonly __brand: 'microUsdc' };

// BD Score formats (for settle_epoch instruction)
export type BDScore = number & { readonly __brand: 'bdScore' }; // [0, 1] decimal
export type BDScoreMillionths = number & { readonly __brand: 'bdScoreMillionths' }; // [0, 1_000_000] integer

// Constants
export const TOKEN_DECIMALS = 6;
export const USDC_DECIMALS = 6;
export const DECIMAL_MULTIPLIER = 1_000_000; // 10^6

/**
 * Convert display units to atomic units
 * @param display Display units (e.g., 0.000025)
 * @returns Atomic units (e.g., 25)
 */
export function displayToAtomic(display: DisplayUnits): AtomicUnits {
  // Use Math.round to handle floating point precision issues
  return Math.round(display * DECIMAL_MULTIPLIER) as AtomicUnits;
}

/**
 * Convert atomic units to display units
 * @param atomic Atomic units (e.g., 25)
 * @returns Display units (e.g., 0.000025)
 */
export function atomicToDisplay(atomic: AtomicUnits): DisplayUnits {
  return (atomic / DECIMAL_MULTIPLIER) as DisplayUnits;
}

/**
 * Convert USDC amount to micro-USDC (atomic)
 * @param usdc USDC amount (e.g., 1.5 USDC)
 * @returns Micro-USDC (e.g., 1,500,000)
 */
export function usdcToMicro(usdc: number): MicroUSDC {
  return Math.round(usdc * DECIMAL_MULTIPLIER) as MicroUSDC;
}

/**
 * Convert micro-USDC to USDC
 * @param micro Micro-USDC (e.g., 1,500,000)
 * @returns USDC amount (e.g., 1.5)
 */
export function microToUsdc(micro: MicroUSDC): number {
  return micro / DECIMAL_MULTIPLIER;
}

/**
 * Safe cast from number to DisplayUnits (use when reading from on-chain)
 * Validates that the number is within safe bounds
 */
export function asDisplay(value: number): DisplayUnits {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid display unit value: ${value}`);
  }
  // Max safe supply: 1 trillion tokens in display units
  if (value > 1_000_000_000_000) {
    throw new Error(`Display unit overflow: ${value} exceeds max safe supply`);
  }
  return value as DisplayUnits;
}

/**
 * Safe cast from number to AtomicUnits (use when reading from database)
 * Validates that the number is within safe bounds
 */
export function asAtomic(value: number): AtomicUnits {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid atomic unit value: ${value}`);
  }
  // Must be an integer
  if (!Number.isInteger(value)) {
    throw new Error(`Atomic units must be integers: ${value}`);
  }
  // Max safe supply: Must fit in JavaScript's safe integer range
  // Note: 1 trillion tokens * 1M decimals = 10^18, which exceeds Number.MAX_SAFE_INTEGER
  // We'll use a more conservative limit
  if (value > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Atomic unit overflow: ${value} exceeds max safe supply`);
  }
  return value as AtomicUnits;
}

/**
 * Safe cast from number to MicroUSDC
 */
export function asMicroUsdc(value: number): MicroUSDC {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid micro-USDC value: ${value}`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`Micro-USDC must be integer: ${value}`);
  }
  return value as MicroUSDC;
}

/**
 * Format display units for UI presentation
 * @param display Display units
 * @param decimals Number of decimal places to show (default: 6)
 */
export function formatDisplay(display: DisplayUnits, decimals: number = 6): string {
  return display.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Format atomic units for UI presentation
 * @param atomic Atomic units
 * @param decimals Number of decimal places to show (default: 6)
 */
export function formatAtomic(atomic: AtomicUnits, decimals: number = 6): string {
  const display = atomicToDisplay(atomic);
  return formatDisplay(display, decimals);
}

// Type guards
export function isDisplayUnits(value: any): value is DisplayUnits {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isAtomicUnits(value: any): value is AtomicUnits {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isMicroUSDC(value: any): value is MicroUSDC {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * BD Score converters (for Solana settle_epoch instruction)
 * Contract expects millionths format: 0 = 0%, 500_000 = 50%, 1_000_000 = 100%
 */
export function bdScoreToMillionths(score: BDScore): BDScoreMillionths {
  if (score < 0 || score > 1) {
    throw new Error(`BD score out of range [0,1]: ${score}`);
  }
  return Math.round(score * 1_000_000) as BDScoreMillionths;
}

export function millionthsToBDScore(millionths: BDScoreMillionths): BDScore {
  if (millionths < 0 || millionths > 1_000_000) {
    throw new Error(`BD score millionths out of range [0,1_000_000]: ${millionths}`);
  }
  return (millionths / 1_000_000) as BDScore;
}

export function asBDScore(value: number): BDScore {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`Invalid BD score: ${value} (must be in range [0,1])`);
  }
  return value as BDScore;
}

export function asBDScoreMillionths(value: number): BDScoreMillionths {
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
    throw new Error(`Invalid BD score millionths: ${value} (must be integer in range [0,1_000_000])`);
  }
  return value as BDScoreMillionths;
}

/**
 * Pool state units converter
 * Converts on-chain pool state (display units) to database format (atomic units)
 */
export interface PoolStateDisplay {
  sLong: DisplayUnits;
  sShort: DisplayUnits;
  vaultBalance: MicroUSDC; // Already in micro-USDC on-chain
}

export interface PoolStateAtomic {
  sLongSupply: AtomicUnits;
  sShortSupply: AtomicUnits;
  vaultBalance: MicroUSDC;
}

export function poolDisplayToAtomic(display: PoolStateDisplay): PoolStateAtomic {
  return {
    sLongSupply: displayToAtomic(display.sLong),
    sShortSupply: displayToAtomic(display.sShort),
    vaultBalance: display.vaultBalance,
  };
}

export function poolAtomicToDisplay(atomic: PoolStateAtomic): PoolStateDisplay {
  return {
    sLong: atomicToDisplay(atomic.sLongSupply),
    sShort: atomicToDisplay(atomic.sShortSupply),
    vaultBalance: atomic.vaultBalance,
  };
}