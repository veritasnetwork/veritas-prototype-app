/**
 * Branded types for unit safety
 *
 * Prevents mixing up display USDC and micro-USDC values at compile time.
 * Use these throughout the codebase instead of plain `number` for currency amounts.
 *
 * @example
 * ```typescript
 * // ❌ BAD: Easy to mix up units
 * function charge(amount: number) { ... }
 * charge(10.50);  // Is this display or micro? Who knows!
 *
 * // ✅ GOOD: Units enforced by type system
 * function charge(amount: MicroUsdc) { ... }
 * charge(10.50 as MicroUsdc);  // Type error!
 * charge(toMicroUsdc(10.50));  // OK
 * ```
 */

// Brand symbol to make types unique
declare const MICRO_USDC: unique symbol;
declare const DISPLAY_USDC: unique symbol;
declare const SOL_LAMPORTS: unique symbol;

/**
 * Micro-USDC (integer, on-chain representation)
 * 1 USDC = 1,000,000 micro-USDC
 * Used for: Database storage, on-chain values, calculations
 */
export type MicroUsdc = number & { readonly [MICRO_USDC]: typeof MICRO_USDC };

/**
 * Display USDC (decimal, human-readable)
 * Standard decimal representation (e.g., 10.50)
 * Used for: UI display, user input, API responses
 */
export type DisplayUsdc = number & { readonly [DISPLAY_USDC]: typeof DISPLAY_USDC };

/**
 * SOL Lamports (integer, on-chain representation)
 * 1 SOL = 1,000,000,000 lamports
 * Used for: SOL amounts on-chain
 */
export type Lamports = number & { readonly [SOL_LAMPORTS]: typeof SOL_LAMPORTS };

// Conversion constants
export const USDC_DECIMALS = 6;
export const MICRO_USDC_PER_USDC = 1_000_000;
export const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Convert display USDC to micro-USDC
 * @param displayUsdc - Human-readable USDC amount (e.g., 10.50)
 * @returns Integer micro-USDC (e.g., 10,500,000)
 */
export function toMicroUsdc(displayUsdc: DisplayUsdc | number): MicroUsdc {
  return Math.floor(displayUsdc * MICRO_USDC_PER_USDC) as MicroUsdc;
}

/**
 * Convert micro-USDC to display USDC
 * @param microUsdc - Integer micro-USDC (e.g., 10,500,000)
 * @returns Human-readable USDC amount (e.g., 10.50)
 */
export function toDisplayUsdc(microUsdc: MicroUsdc | number): DisplayUsdc {
  return (microUsdc / MICRO_USDC_PER_USDC) as DisplayUsdc;
}

/**
 * Convert SOL to lamports
 * @param sol - Human-readable SOL amount
 * @returns Integer lamports
 */
export function toLamports(sol: number): Lamports {
  return Math.floor(sol * LAMPORTS_PER_SOL) as Lamports;
}

/**
 * Convert lamports to SOL
 * @param lamports - Integer lamports
 * @returns Human-readable SOL amount
 */
export function toSol(lamports: Lamports | number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Assert that a value is in micro-USDC
 * Use this when receiving data from external sources (DB, API)
 * @param value - Value to assert
 * @returns Value branded as MicroUsdc
 */
export function assertMicroUsdc(value: number): MicroUsdc {
  if (!Number.isInteger(value)) {
    throw new Error(`Expected integer micro-USDC, got decimal: ${value}`);
  }
  if (value < 0) {
    throw new Error(`Expected non-negative micro-USDC, got: ${value}`);
  }
  return value as MicroUsdc;
}

/**
 * Assert that a value is in display USDC
 * Use this when receiving user input
 * @param value - Value to assert
 * @returns Value branded as DisplayUsdc
 */
export function assertDisplayUsdc(value: number): DisplayUsdc {
  if (value < 0) {
    throw new Error(`Expected non-negative display USDC, got: ${value}`);
  }
  return value as DisplayUsdc;
}

/**
 * Format micro-USDC for display
 * @param microUsdc - Integer micro-USDC
 * @param decimals - Number of decimal places (default 2)
 * @returns Formatted string (e.g., "$10.50")
 */
export function formatMicroUsdc(microUsdc: MicroUsdc | number, decimals: number = 2): string {
  const displayUsdc = toDisplayUsdc(microUsdc as MicroUsdc);
  return `$${displayUsdc.toFixed(decimals)}`;
}

/**
 * Format display USDC
 * @param displayUsdc - Human-readable USDC
 * @param decimals - Number of decimal places (default 2)
 * @returns Formatted string (e.g., "$10.50")
 */
export function formatDisplayUsdc(displayUsdc: DisplayUsdc | number, decimals: number = 2): string {
  return `$${displayUsdc.toFixed(decimals)}`;
}

// Type guards for runtime checking
export function isMicroUsdc(value: any): value is MicroUsdc {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isDisplayUsdc(value: any): value is DisplayUsdc {
  return typeof value === 'number' && value >= 0;
}

// Re-export for convenience
export type { MicroUsdc as µUSDC, DisplayUsdc as USDC };