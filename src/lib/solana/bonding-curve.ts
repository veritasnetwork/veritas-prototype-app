/**
 * Bonding Curve Calculations
 *
 * Mirrors the smart contract bonding curve logic for frontend display.
 * See: solana/veritas-curation/programs/veritas-curation/src/content_pool/curve.rs
 *
 * IMPORTANT: Token Supply Units
 * - Pool tokens are stored as whole numbers (e.g., 676) in the database
 * - They have 6 decimals internally for SPL token compatibility, but we treat them as integers
 * - USDC has 6 decimals and IS converted (micro-USDC → USDC)
 * - Example: 676 tokens at 103 USDC reserve
 */

// Constants from smart contract (solana/veritas-curation/programs/veritas-curation/src/constants.rs)
const RATIO_PRECISION = 1_000_000; // Price scaling factor
const PRICE_FLOOR = 100; // Minimum price: 100 / 1_000_000 = 0.0001 USDC per token

/**
 * Calculate the current marginal price for buying one more token
 *
 * Bonding curve formula:
 * - Reserve: r = k × s³ / 3 (integral)
 * - Price: p = k × s² (derivative, marginal cost)
 *
 * @param tokenSupplyRaw - Token supply as stored (whole number, e.g., 676)
 * @param kQuadratic - Curve steepness parameter (scaled integer from database)
 * @returns Price in USDC per token (human-readable)
 */
export function calculateTokenPrice(tokenSupplyRaw: number, kQuadratic: number): number {
  // Smart contract uses raw values (not decimal-adjusted)
  // price_scaled = k × s²
  const priceScaled = kQuadratic * tokenSupplyRaw * tokenSupplyRaw;

  // Apply RATIO_PRECISION to get actual USDC price
  const priceUsdc = priceScaled / RATIO_PRECISION;

  // Apply price floor
  const minPrice = PRICE_FLOOR / RATIO_PRECISION;
  return Math.max(priceUsdc, minPrice);
}

/**
 * Calculate total reserve for a given supply (theoretical)
 *
 * @param tokenSupplyRaw - Raw token supply
 * @param kQuadratic - Curve steepness parameter
 * @returns Reserve in micro-USDC (raw blockchain units)
 */
export function calculateReserveForSupply(tokenSupplyRaw: number, kQuadratic: number): number {
  // reserve = k × s³ / 3
  const reserve = (kQuadratic * Math.pow(tokenSupplyRaw, 3)) / 3;
  return Math.floor(reserve);
}

/**
 * Calculate cost to buy a specific amount of tokens
 * This is an approximation using average price over the range
 *
 * @param currentSupplyRaw - Current raw token supply
 * @param tokensToBuy - Number of tokens to buy (in raw units)
 * @param kQuadratic - Curve steepness parameter
 * @returns Cost in USDC
 */
export function calculateBuyCost(
  currentSupplyRaw: number,
  tokensToBuy: number,
  kQuadratic: number
): number {
  const currentReserve = calculateReserveForSupply(currentSupplyRaw, kQuadratic);
  const newSupply = currentSupplyRaw + tokensToBuy;
  const newReserve = calculateReserveForSupply(newSupply, kQuadratic);
  const costRaw = newReserve - currentReserve;

  // Convert from raw to USDC (6 decimals)
  return costRaw / 1e6;
}

/**
 * Format pool data for display
 *
 * @param poolTokenSupply - Raw token supply from API (stored as-is, no decimals)
 * @param poolReserveBalance - Raw reserve balance from API (micro-USDC, 6 decimals)
 * @param poolKQuadratic - k_quadratic from API
 * @returns Formatted pool data for UI display
 */
export function formatPoolData(
  poolTokenSupply: number,
  poolReserveBalance: number,
  poolKQuadratic: number
) {
  return {
    currentPrice: calculateTokenPrice(poolTokenSupply, poolKQuadratic),
    tokenSupply: poolTokenSupply, // Display as-is (e.g., 676 tokens, not 0.000676)
    reserve: poolReserveBalance / 1e6, // Convert micro-USDC to USDC
  };
}
