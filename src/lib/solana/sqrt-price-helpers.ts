/**
 * Square Root Price Helpers for ICBS
 *
 * The on-chain ContentPool stores prices as sqrt(price) * 2^96 to prevent overflow.
 * These helpers convert between the on-chain X96 format and human-readable prices.
 */

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
 * console.log(`Long token price: $${price.toFixed(4)}`);
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
 * console.log(`Long Price: $${formatted.priceLong.toFixed(4)}`);
 */
export function formatPoolAccountData(pool: any) {
  const supplyLong = Number(pool.sLong || 0);
  const supplyShort = Number(pool.sShort || 0);

  const priceLong = pool.sqrtPriceLongX96
    ? sqrtPriceX96ToPrice(pool.sqrtPriceLongX96.toString())
    : 0;

  const priceShort = pool.sqrtPriceShortX96
    ? sqrtPriceX96ToPrice(pool.sqrtPriceShortX96.toString())
    : 0;

  // Convert from atomic units to display units (both use 6 decimals)
  const supplyLongDisplay = supplyLong / USDC_PRECISION;
  const supplyShortDisplay = supplyShort / USDC_PRECISION;

  // Market cap calculations
  const marketCapLong = supplyLongDisplay * priceLong;
  const marketCapShort = supplyShortDisplay * priceShort;
  const totalMarketCap = marketCapLong + marketCapShort;

  return {
    // Token supplies
    supplyLong: supplyLongDisplay,
    supplyShort: supplyShortDisplay,
    totalSupply: supplyLongDisplay + supplyShortDisplay,

    // Prices in USDC
    priceLong,
    priceShort,
    averagePrice: (priceLong + priceShort) / 2,

    // Market caps
    marketCapLong,
    marketCapShort,
    totalMarketCap,

    // Vault balance
    vaultBalance: Number(pool.vaultBalance || 0) / USDC_PRECISION,

    // Raw values for debugging
    _raw: {
      sqrtPriceLongX96: pool.sqrtPriceLongX96?.toString(),
      sqrtPriceShortX96: pool.sqrtPriceShortX96?.toString(),
      sLong: supplyLong,
      sShort: supplyShort,
    },

    // ICBS parameters (for trade simulation)
    f: Number(pool.f || 2),
    betaNum: Number(pool.betaNum || 1),
    betaDen: Number(pool.betaDen || 2),
    sqrtLambdaLongX96: pool.sqrtLambdaLongX96?.toString() || '0',
    sqrtLambdaShortX96: pool.sqrtLambdaShortX96?.toString() || '0',
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