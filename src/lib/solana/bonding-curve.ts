/**
 * Bonding Curve Calculations - Unified with Desmos Formulas
 *
 * Source of truth: s(R) = (3R/k)^(1/3) * 100
 * Where:
 * - R is reserves in USDC dollars (not micro-USDC!)
 * - s is share supply (310 shares for $10)
 * - k is the curve parameter (default 1)
 *
 * The smart contract will need to handle the conversion between
 * micro-USDC (on-chain) and USDC (in formulas).
 */

// Constants
const TOKEN_DECIMALS = 6;
const TOKEN_PRECISION = 10 ** TOKEN_DECIMALS; // 1,000,000
const RATIO_PRECISION = 1_000_000;

/**
 * Calculate tokens received for USDC input
 * Formula: s(R) = (3R/k)^(1/3) * 100
 *
 * @param usdcAmount - USDC to spend (e.g., 10.0 for $10)
 * @param currentSupplyAtomic - Current supply in atomic units
 * @param currentReserveMicroUsdc - Current reserve in micro-USDC
 * @param kQuadratic - Curve parameter (default 1)
 * @returns Tokens received in atomic units
 */
export function calculateBuyAmount(
  usdcAmount: number,
  currentSupplyAtomic: number,
  currentReserveMicroUsdc: number,
  kQuadratic: number
): number {
  // Use actual current supply (not derived from reserves)
  const currentSupply = currentSupplyAtomic / TOKEN_PRECISION;

  // Convert reserves to USDC dollars
  const currentReserveUsdc = currentReserveMicroUsdc / TOKEN_PRECISION;
  const newReserveUsdc = currentReserveUsdc + usdcAmount;

  // Apply formula to calculate new supply: s = (3R/k)^(1/3) * 100
  const newSupply = Math.cbrt((3 * newReserveUsdc) / kQuadratic) * 100;

  // Calculate tokens to mint (in share units)
  const sharesToMint = newSupply - currentSupply;

  // Convert shares to atomic units for SPL tokens
  const atomicToMint = sharesToMint * TOKEN_PRECISION;

  return Math.floor(Math.max(0, atomicToMint));
}

/**
 * Calculate USDC received for selling tokens
 * Inverse formula: R = k * (s/100)^3 / 3
 *
 * @param tokenAmountAtomic - Tokens to sell in atomic units
 * @param currentSupplyAtomic - Current supply in atomic units
 * @param currentReserveMicroUsdc - Current reserve in micro-USDC
 * @param kQuadratic - Curve parameter
 * @returns USDC received (human readable)
 */
export function calculateSellAmount(
  tokenAmountAtomic: number,
  currentSupplyAtomic: number,
  currentReserveMicroUsdc: number,
  kQuadratic: number
): number {
  // Convert atomic to shares
  const currentShares = currentSupplyAtomic / TOKEN_PRECISION;
  const sharesToSell = tokenAmountAtomic / TOKEN_PRECISION;
  const newShares = Math.max(0, currentShares - sharesToSell);

  // Calculate reserves using inverse formula: R = k * (s/100)^3 / 3
  const currentReserveUsdc = kQuadratic * Math.pow(currentShares / 100, 3) / 3;
  const newReserveUsdc = kQuadratic * Math.pow(newShares / 100, 3) / 3;

  // USDC payout
  const usdcPayout = currentReserveUsdc - newReserveUsdc;

  return Math.max(0, usdcPayout);
}

/**
 * Calculate the current price per share
 * Formula: P(s) = max(0.0001, k * s^2 / 1,000,000)
 *
 * @param supplyAtomic - Token supply in atomic units
 * @param kQuadratic - Curve parameter
 * @returns Price in USDC per share
 */
export function calculateTokenPrice(supplyAtomic: number, kQuadratic: number): number {
  // Convert atomic to shares
  const shares = supplyAtomic / TOKEN_PRECISION;

  // Apply formula: P(s) = k * s^2 / 1,000,000
  const price = (kQuadratic * shares * shares) / 1_000_000;

  // Apply price floor
  return Math.max(0.0001, price);
}

/**
 * Alternative price formula from reserves
 * Formula: P(R) = ((3R/k)^(2/3)) / 100
 *
 * @param reserveMicroUsdc - Reserve in micro-USDC
 * @param kQuadratic - Curve parameter
 * @returns Price in USDC per share
 */
export function calculatePriceFromReserve(
  reserveMicroUsdc: number,
  kQuadratic: number
): number {
  // Convert to USDC for formula
  const reserveUsdc = reserveMicroUsdc / TOKEN_PRECISION;

  // Apply formula: P(R) = ((3R/k)^(2/3)) / 100
  const price = Math.pow((3 * reserveUsdc) / kQuadratic, 2/3) / 100;

  return Math.max(0.0001, price);
}

/**
 * Calculate reserve for a given supply
 * Formula: R = k * (s/100)^3 / 3
 *
 * @param supplyAtomic - Supply in atomic units
 * @param kQuadratic - Curve parameter
 * @returns Reserve in micro-USDC
 */
export function calculateReserveForSupply(supplyAtomic: number, kQuadratic: number): number {
  // Convert atomic to shares
  const shares = supplyAtomic / TOKEN_PRECISION;

  // Apply formula: R = k * (s/100)^3 / 3
  const reserveUsdc = kQuadratic * Math.pow(shares / 100, 3) / 3;

  // Convert to micro-USDC
  return Math.floor(reserveUsdc * TOKEN_PRECISION);
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
  const supplyAtomic = Number(poolTokenSupply) || 0;
  const reserveMicroUsdc = Number(poolReserveBalance) || 0;
  const k = Number(poolKQuadratic) || 1;

  console.log('[formatPoolData] Input:', {
    poolTokenSupply,
    poolReserveBalance,
    poolKQuadratic,
    supplyAtomic,
    reserveMicroUsdc,
    k
  });

  // Convert to display units
  const shares = supplyAtomic / TOKEN_PRECISION;
  const reserveUsdc = reserveMicroUsdc / TOKEN_PRECISION;

  // Calculate price
  const currentPrice = calculateTokenPrice(supplyAtomic, k);

  // Market cap
  const marketCap = shares * currentPrice;

  return {
    currentPrice,
    totalSupply: shares,       // Shares (e.g., 310)
    reserveBalance: reserveUsdc, // USDC (e.g., 10)
    marketCap,
    // Legacy aliases
    tokenSupply: shares,
    reserve: reserveUsdc,
  };
}

// Helper functions
export function atomicToDisplay(atomic: number): number {
  return atomic / TOKEN_PRECISION;
}

export function displayToAtomic(display: number): number {
  return Math.floor(display * TOKEN_PRECISION);
}

// Export constants
export { TOKEN_DECIMALS, TOKEN_PRECISION, RATIO_PRECISION };