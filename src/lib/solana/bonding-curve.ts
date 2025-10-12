/**
 * Bonding Curve Calculations - Unified Library
 *
 * This library properly bridges between:
 * 1. Smart Contract: Mints SPL tokens with 6 decimals using formula s = cbrt(3R/k)
 * 2. Database: Stores token_supply as atomic units (raw from contract)
 * 3. Display: Shows "shares" as whole numbers matching your Desmos formulas
 *
 * KEY INSIGHT:
 * - Smart contract mints atomic units: s_atomic = cbrt(3R/k)
 * - Your Desmos expects: s_display = cbrt(3R/k) * 100
 * - Database stores atomic units (e.g., 310,000,000 for what displays as "310 shares")
 *
 * The conversion:
 * - To get display shares from atomic: shares = atomic / 10,000 (not 1,000,000!)
 * - This gives us the 100x multiplier effect you want
 * - 310,000,000 atomic units = 310 shares (displayed)
 */

// Constants from smart contract
const RATIO_PRECISION = 1_000_000;
const PRICE_FLOOR = 100; // 100 / 1_000_000 = 0.0001 USDC minimum
const TOKEN_DECIMALS = 6;
const TOKEN_PRECISION = 1_000_000; // 10^6 for SPL token decimals

// Display scaling to match Desmos
// We want atomic / 10,000 = shares, which gives us the 100x effect
const ATOMIC_TO_SHARES = 10_000;

/**
 * Calculate the current price per share (display unit)
 *
 * Your Desmos: P(s) = max(0.0001, k * s² / 1000000)
 * Where s is shares (display units)
 *
 * @param tokenSupplyAtomic - Token supply in atomic units from database
 * @param kQuadratic - Curve parameter from database/contract
 * @returns Price in USDC per share
 */
export function calculateTokenPrice(tokenSupplyAtomic: number, kQuadratic: number): number {
  // Convert atomic to display shares (divide by 10,000 to get 100x effect)
  const shares = tokenSupplyAtomic / ATOMIC_TO_SHARES;

  // Your Desmos formula: P(s) = k * s² / 1000000
  const priceUsdc = (kQuadratic * shares * shares) / RATIO_PRECISION;

  // Apply floor
  return Math.max(0.0001, priceUsdc);
}

/**
 * Calculate shares received for USDC input
 *
 * Contract: s_atomic = cbrt(3R/k)
 * Display: shares = s_atomic / 10,000 (gives 100x effect)
 *
 * @param usdcAmount - USDC to spend (human readable)
 * @param currentSupplyAtomic - Current supply in atomic units
 * @param currentReserveMicroUsdc - Current reserve in micro-USDC
 * @param kQuadratic - Curve parameter
 * @returns Shares received (display units)
 */
export function calculateBuyAmount(
  usdcAmount: number,
  currentSupplyAtomic: number,
  currentReserveMicroUsdc: number,
  kQuadratic: number
): number {
  // Convert input to micro-USDC
  const microUsdc = Math.floor(usdcAmount * 1_000_000);

  // New reserve
  const newReserveMicro = currentReserveMicroUsdc + microUsdc;

  // Contract formula: s_atomic = cbrt(3R/k)
  const newSupplyAtomic = Math.cbrt((3 * newReserveMicro) / kQuadratic);

  // Convert to display shares
  const currentShares = currentSupplyAtomic / ATOMIC_TO_SHARES;
  const newShares = newSupplyAtomic / ATOMIC_TO_SHARES;

  // Return shares received
  const sharesReceived = newShares - currentShares;
  return Math.floor(Math.max(0, sharesReceived));
}

/**
 * Calculate USDC received for selling shares
 *
 * Inverse: R = k * s_atomic³ / 3
 * With: s_atomic = shares * 10,000
 *
 * @param shareAmount - Shares to sell (display units)
 * @param currentSupplyAtomic - Current supply in atomic units
 * @param currentReserveMicroUsdc - Current reserve in micro-USDC
 * @param kQuadratic - Curve parameter
 * @returns USDC received (human readable)
 */
export function calculateSellAmount(
  shareAmount: number,
  currentSupplyAtomic: number,
  currentReserveMicroUsdc: number,
  kQuadratic: number
): number {
  // Convert shares to atomic
  const atomicToSell = shareAmount * ATOMIC_TO_SHARES;

  // New supply after selling
  const newSupplyAtomic = Math.max(0, currentSupplyAtomic - atomicToSell);

  // Calculate reserves using contract formula: R = k * s³ / 3
  const newReserveMicro = (kQuadratic * Math.pow(newSupplyAtomic, 3)) / 3;

  // USDC to receive
  const microUsdcToReceive = currentReserveMicroUsdc - newReserveMicro;

  // Convert to human readable USDC
  return Math.max(0, microUsdcToReceive / 1_000_000);
}

/**
 * Calculate reserve for a given supply
 *
 * R = k * s_atomic³ / 3
 *
 * @param tokenSupplyAtomic - Supply in atomic units
 * @param kQuadratic - Curve parameter
 * @returns Reserve in micro-USDC
 */
export function calculateReserveForSupply(tokenSupplyAtomic: number, kQuadratic: number): number {
  const reserve = (kQuadratic * Math.pow(tokenSupplyAtomic, 3)) / 3;
  return Math.floor(reserve);
}

/**
 * Calculate cost to buy specific amount of shares
 *
 * @param currentSupplyAtomic - Current supply in atomic units
 * @param sharesToBuy - Shares to buy (display units)
 * @param kQuadratic - Curve parameter
 * @returns Cost in USDC
 */
export function calculateBuyCost(
  currentSupplyAtomic: number,
  sharesToBuy: number,
  kQuadratic: number
): number {
  const atomicToBuy = sharesToBuy * ATOMIC_TO_SHARES;

  const currentReserve = calculateReserveForSupply(currentSupplyAtomic, kQuadratic);
  const newSupplyAtomic = currentSupplyAtomic + atomicToBuy;
  const newReserve = calculateReserveForSupply(newSupplyAtomic, kQuadratic);

  const costMicroUsdc = newReserve - currentReserve;
  return costMicroUsdc / 1_000_000;
}

/**
 * Format pool data for UI display
 *
 * @param poolTokenSupply - Token supply from API (atomic units)
 * @param poolReserveBalance - Reserve from API (micro-USDC)
 * @param poolKQuadratic - k parameter from API
 * @returns Formatted data for display
 */
export function formatPoolData(
  poolTokenSupply: number | string,
  poolReserveBalance: number | string,
  poolKQuadratic: number | string
) {
  // Parse inputs
  const supplyAtomic = Number(poolTokenSupply) || 0;
  const reserveMicroUsdc = Number(poolReserveBalance) || 0;
  const k = Number(poolKQuadratic) || 1;

  // Convert to display units
  const shares = supplyAtomic / ATOMIC_TO_SHARES;
  const reserveUsdc = reserveMicroUsdc / 1_000_000;

  // Calculate current price
  const currentPrice = calculateTokenPrice(supplyAtomic, k);

  // Market cap
  const marketCap = shares * currentPrice;

  return {
    currentPrice,
    totalSupply: shares, // Display shares
    reserveBalance: reserveUsdc,
    marketCap,
    // Legacy aliases
    tokenSupply: shares,
    reserve: reserveUsdc,
  };
}