/**
 * Square Root Price Helpers for ICBS
 *
 * The on-chain ContentPool stores prices as sqrt(price) * 2^96 to prevent overflow.
 * These helpers convert between the on-chain X96 format and human-readable prices.
 *
 * IMPORTANT: On-chain token supplies (s_long, s_short) are stored in DISPLAY units.
 * See /lib/units.ts for unit conversion conventions.
 */

import { DisplayUnits, MicroUSDC, asDisplay, asMicroUsdc, displayToAtomic } from '@/lib/units';

const Q96 = 2n ** 96n;
const USDC_DECIMALS = 6;
const USDC_PRECISION = 10 ** USDC_DECIMALS;

/**
 * Convert sqrt price X96 to human-readable USDC price
 *
 * @param sqrtPriceX96 - Square root of price in X96 format (from on-chain)
 * @returns Price in USDC per token (e.g., 0.1 means 0.1 USDC per token)
 *
 * @example
 * const price = sqrtPriceX96ToPrice(pool.sqrtPriceLongX96);
 */
export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint | string | number): number {
  const sqrtPrice = BigInt(sqrtPriceX96);

  // price = (sqrt_price_x96)² / 2^192
  // On-chain stores sqrt(price) * 2^96 where price is in lamports (micro-USDC units)
  // To recover price: (sqrt_price_x96 / 2^96)^2 = price in lamports
  // Then convert lamports to USDC by dividing by 1,000,000

  // Square the sqrt price to get price * 2^192
  const priceX192 = sqrtPrice * sqrtPrice;

  // Divide by 2^192 to get price in lamports (do in two steps to avoid precision loss)
  const priceX96 = priceX192 / Q96;
  const priceLamports = priceX96 / Q96;

  // Convert from lamports (micro-USDC, 6 decimals) to USDC
  return Number(priceLamports) / USDC_PRECISION;
}

/**
 * Alternative implementation using float math for better precision in some cases
 *
 * @param sqrtPriceX96 - Square root of price in X96 format
 * @returns Price in USDC per token
 */
export function sqrtPriceX96ToPriceFloat(sqrtPriceX96: bigint | string | number): number {
  const sqrtPrice = Number(BigInt(sqrtPriceX96));
  const Q96_FLOAT = Math.pow(2, 96);

  // Convert sqrt to actual price
  const sqrtPriceFloat = sqrtPrice / Q96_FLOAT;
  const price = sqrtPriceFloat * sqrtPriceFloat;

  // Price is already in USDC per token (decimals cancel out)
  return price;
}

/**
 * Convert human-readable price to sqrt price X96
 * Useful for simulations or testing
 *
 * @param priceUsdc - Price in USDC per token
 * @returns Square root of price in X96 format
 *
 * @example
 * const sqrtPrice = priceToSqrtPriceX96(1.5); // 1.5 USDC per token
 */
export function priceToSqrtPriceX96(priceUsdc: number): bigint {
  // Price is already in correct units (USDC per token = micro-USDC per micro-token)
  // Take square root
  const sqrtPrice = Math.sqrt(priceUsdc);

  // Scale by 2^96
  const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Math.pow(2, 96)));

  return sqrtPriceX96;
}

/**
 * Format pool account data from on-chain to UI-friendly format
 *
 * @param pool - ContentPool account data
 * @returns Formatted pool data for display
 *
 * @example
 * const poolAccount = await program.account.contentPool.fetch(poolAddress);
 * const formatted = formatPoolAccountData(poolAccount);
 */
/**
 * Parse a value that might be a BN object (from Anchor) or a number
 * Anchor returns BN fields as either BN objects or hex strings depending on version
 */
function parseAnchorNumber(value: any): number {
  if (value === null || value === undefined) return 0;

  // If it's already a number, return it
  if (typeof value === 'number') return value;

  // If it's a bigint, convert to number
  if (typeof value === 'bigint') return Number(value);

  // If it's a BN object from Anchor
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber();
  }

  // If it's a string, it's likely hex from Anchor
  if (typeof value === 'string') {
    // Check if it looks like a hex string (contains a-f or leading zeros)
    if (/^[0-9a-f]+$/i.test(value) && (value.length > 1 || parseInt(value, 16) !== parseInt(value, 10))) {
      return parseInt(value, 16);
    }
    // Otherwise parse as decimal
    return Number(value);
  }

  return 0;
}

export function formatPoolAccountData(pool: any) {
  // Parse hex strings from Anchor
  // IMPORTANT: pool.sLong and pool.sShort are stored in DISPLAY units on-chain
  // See src/lib/units.ts for unit conventions
  const sLongDisplay = asDisplay(parseAnchorNumber(pool.sLong));
  const sShortDisplay = asDisplay(parseAnchorNumber(pool.sShort));
  const vaultBalanceMicro = asMicroUsdc(parseAnchorNumber(pool.vaultBalance));

  // Parse sqrt prices (can be BN objects or hex strings)
  const sqrtPriceLongX96 = pool.sqrtPriceLongX96
    ? (typeof pool.sqrtPriceLongX96 === 'object' && 'toString' in pool.sqrtPriceLongX96
      ? BigInt(pool.sqrtPriceLongX96.toString(10))
      : BigInt('0x' + pool.sqrtPriceLongX96.toString()))
    : 0n;

  const sqrtPriceShortX96 = pool.sqrtPriceShortX96
    ? (typeof pool.sqrtPriceShortX96 === 'object' && 'toString' in pool.sqrtPriceShortX96
      ? BigInt(pool.sqrtPriceShortX96.toString(10))
      : BigInt('0x' + pool.sqrtPriceShortX96.toString()))
    : 0n;

  const priceLong = sqrtPriceLongX96 > 0n
    ? sqrtPriceX96ToPrice(sqrtPriceLongX96)
    : 0;

  const priceShort = sqrtPriceShortX96 > 0n
    ? sqrtPriceX96ToPrice(sqrtPriceShortX96)
    : 0;

  // Market cap calculations (using display units for readability)
  const marketCapLong = sLongDisplay * priceLong;
  const marketCapShort = sShortDisplay * priceShort;
  const totalMarketCap = marketCapLong + marketCapShort;

  // Parse actual reserves from the pool account
  // IMPORTANT: Use the on-chain reserves directly, don't calculate from price × supply
  // The on-chain reserves are the source of truth, especially after settlements
  const rLongMicro = parseAnchorNumber(pool.r_long ?? pool.rLong);
  const rShortMicro = parseAnchorNumber(pool.r_short ?? pool.rShort);

  // Debug log to diagnose zero reserve issue
  if (rLongMicro === 0 && rShortMicro === 0) {
    console.warn('[formatPoolAccountData] WARNING: Both reserves are zero!', {
      pool_r_long: pool.r_long,
      pool_rLong: pool.rLong,
      pool_r_short: pool.r_short,
      pool_rShort: pool.rShort,
      rLongMicro,
      rShortMicro
    });
  }

  // Convert from micro-USDC to display USDC
  const rLongDisplay = rLongMicro / USDC_PRECISION;
  const rShortDisplay = rShortMicro / USDC_PRECISION;

  // Also need to parse other addresses/mints that might be needed
  const contentId = pool.contentId?.toString() || '';
  const longMint = pool.longMint;
  const shortMint = pool.shortMint;

  return {
    // Token supplies (display units for UI)
    supplyLong: sLongDisplay,
    supplyShort: sShortDisplay,
    totalSupply: sLongDisplay + sShortDisplay,

    // Prices in USDC
    priceLong,
    priceShort,
    averagePrice: (priceLong + priceShort) / 2,

    // Market caps
    marketCapLong,
    marketCapShort,
    totalMarketCap,

    // Vault balance (in USDC for UI)
    vaultBalance: vaultBalanceMicro / USDC_PRECISION,

    // Actual on-chain reserves (for implied relevance calculation)
    // NOTE: These are the source of truth, directly from the pool account
    // After settlements, these reflect the BD score, NOT the market caps
    rLong: rLongDisplay,
    rShort: rShortDisplay,

    // Raw values for debugging and database storage
    _raw: {
      sqrtPriceLongX96: sqrtPriceLongX96.toString(),
      sqrtPriceShortX96: sqrtPriceShortX96.toString(),
      sLong: sLongDisplay, // Display units from on-chain
      sShort: sShortDisplay, // Display units from on-chain
      sLongAtomic: displayToAtomic(sLongDisplay), // Convert to atomic for DB
      sShortAtomic: displayToAtomic(sShortDisplay), // Convert to atomic for DB
      vaultBalanceMicro: vaultBalanceMicro, // Atomic units (micro-USDC)
      rLong: rLongDisplay, // Display USDC units
      rShort: rShortDisplay, // Display USDC units
    },

    // ICBS parameters (for trade simulation)
    f: Number(pool.f || 1),
    betaNum: Number(pool.betaNum || 1),
    betaDen: Number(pool.betaDen || 2),
    sScaleLongQ64: pool.sScaleLongQ64?.toString() || '0',        // NEW
    sScaleShortQ64: pool.sScaleShortQ64?.toString() || '0',      // NEW
    sqrtLambdaLongX96: pool.sqrtLambdaLongX96?.toString() || '0',  // DEPRECATED
    sqrtLambdaShortX96: pool.sqrtLambdaShortX96?.toString() || '0', // DEPRECATED

    // Add contentId and mints for event indexer
    contentId,
    longMint,
    shortMint,
  };
}

/**
 * Calculate market cap from pool data
 *
 * @param pool - ContentPool account data
 * @returns Total market cap in USDC
 */
export function calculateMarketCap(pool: any): number {
  const formatted = formatPoolAccountData(pool);
  return formatted.totalMarketCap;
}

/**
 * Helper to check if a sqrt price value is valid
 *
 * @param sqrtPriceX96 - Square root price to validate
 * @returns true if valid, false otherwise
 */
export function isValidSqrtPrice(sqrtPriceX96: bigint | string | number): boolean {
  try {
    const sqrtPrice = BigInt(sqrtPriceX96);
    return sqrtPrice > 0n && sqrtPrice < (2n ** 128n);
  } catch {
    return false;
  }
}

/**
 * Format pool data for UI display from database values
 * This is for displaying pool data from the database when you don't need live on-chain data
 *
 * @param supplyLong - LONG token supply (atomic units from DB)
 * @param supplyShort - SHORT token supply (atomic units from DB)
 * @param sqrtPriceLongX96 - Square root price for LONG tokens (from DB)
 * @param sqrtPriceShortX96 - Square root price for SHORT tokens (from DB)
 * @param vaultBalance - USDC vault balance (micro-USDC from DB)
 * @returns Formatted data for display
 */
export function formatPoolDataFromDb(
  supplyLong: number | string | null,
  supplyShort: number | string | null,
  sqrtPriceLongX96: bigint | string | number | null,
  sqrtPriceShortX96: bigint | string | number | null,
  vaultBalance: number | string | null
) {
  // Handle null/undefined values
  const sLong = Number(supplyLong) || 0;
  const sShort = Number(supplyShort) || 0;
  const vault = Number(vaultBalance) || 0;

  // Convert supplies to display units
  const supplyLongDisplay = sLong / USDC_PRECISION;
  const supplyShortDisplay = sShort / USDC_PRECISION;
  const totalSupply = supplyLongDisplay + supplyShortDisplay;
  const vaultUsdc = vault / USDC_PRECISION;

  // Convert prices
  let priceLong = 0;
  let priceShort = 0;

  if (sqrtPriceLongX96 && sqrtPriceLongX96 !== '0') {
    try {
      priceLong = sqrtPriceX96ToPrice(sqrtPriceLongX96);
    } catch (e) {
      console.warn('Failed to parse sqrtPriceLongX96:', e);
    }
  }

  if (sqrtPriceShortX96 && sqrtPriceShortX96 !== '0') {
    try {
      priceShort = sqrtPriceX96ToPrice(sqrtPriceShortX96);
    } catch (e) {
      console.warn('Failed to parse sqrtPriceShortX96:', e);
    }
  }

  // Calculate market caps
  const marketCapLong = supplyLongDisplay * priceLong;
  const marketCapShort = supplyShortDisplay * priceShort;
  const totalMarketCap = marketCapLong + marketCapShort;

  // Average price (weighted by supply)
  const averagePrice = totalSupply > 0
    ? totalMarketCap / totalSupply
    : (priceLong + priceShort) / 2;

  return {
    // Display-friendly values
    currentPrice: averagePrice,
    priceLong,
    priceShort,
    totalSupply,
    supplyLong: supplyLongDisplay,
    supplyShort: supplyShortDisplay,
    reserveBalance: vaultUsdc,
    marketCap: totalMarketCap,
    marketCapLong,
    marketCapShort,

    // Legacy aliases for backward compatibility
    tokenSupply: totalSupply,
    reserve: vaultUsdc,
  };
}

// Re-export constants
export { USDC_DECIMALS, USDC_PRECISION };