/**
 * ICBS (Inversely Coupled Bonding Surface) Price Calculations
 *
 * Implements the same mathematics as the Rust smart contract for client-side price estimation.
 * Uses square root prices (X96 format) to prevent overflow.
 *
 * IMPORTANT: All pools use F=1, β=0.5 (fixed parameters)
 * With these parameters, the marginal price formula simplifies to:
 *   p_L = λ_L × s_L / ||s||
 *   p_S = λ_S × s_S / ||s||
 * where ||s|| = sqrt(s_L² + s_S²) is the L2 norm of the supply vector.
 */

export enum TokenSide {
  Long = 'long',
  Short = 'short',
}

// X96 format: sqrt(price) * 2^96 for precision
const Q96 = BigInt(1) << BigInt(96);

/**
 * Calculate the marginal price for ICBS tokens
 *
 * For F=1, β=0.5, the formula simplifies to: p = λ × s / ||s||
 * where ||s|| = sqrt(s_L² + s_S²)
 *
 * @param sLong - LONG token supply (in display units, NOT atomic units)
 * @param sShort - SHORT token supply (in display units, NOT atomic units)
 * @param side - Which side to calculate price for (LONG or SHORT)
 * @param lambdaScale - Lambda scaling factor (default 1.0)
 * @param f - Growth exponent (FIXED at 1 for all pools)
 * @param betaNum - Beta numerator (FIXED at 1)
 * @param betaDen - Beta denominator (FIXED at 2, making β = 0.5)
 * @returns Price in USDC per token
 */
export function calculateICBSPrice(
  sLong: number,
  sShort: number,
  side: TokenSide,
  lambdaScale: number = 1.0,
  f: number = 1,  // FIXED: Must be 1 to match on-chain implementation
  betaNum: number = 1,
  betaDen: number = 2
): number {
  // For F=1 and β=0.5, the ICBS formula simplifies to:
  // p_L = λ × s_L / ||s||
  // p_S = λ × s_S / ||s||
  // where ||s|| = sqrt(s_L² + s_S²)

  // Validate that we're using the simplified parameters
  if (f !== 1 || betaNum !== 1 || betaDen !== 2) {
    console.warn('ICBS price calculation expects F=1, β=0.5 for simplified formula');
  }

  // Get the supply for the requested side
  const s = side === TokenSide.Long ? sLong : sShort;

  // Handle edge case of zero or near-zero supplies
  if (sLong <= 0.000001 && sShort <= 0.000001) {
    return lambdaScale; // Initial price when both supplies are essentially zero
  }

  // Calculate L2 norm: ||s|| = sqrt(s_L² + s_S²)
  const norm = Math.sqrt(sLong * sLong + sShort * sShort);

  // Handle edge case where norm is zero (shouldn't happen with check above)
  if (norm === 0) {
    return lambdaScale;
  }

  // Calculate simplified price: p = λ × s / ||s||
  const price = lambdaScale * s / norm;

  return price;
}

/**
 * Calculate the square root of marginal price (for compatibility with smart contract)
 * Returns sqrt(price) * 2^96
 */
export function calculateSqrtPriceX96(
  sLong: number,
  sShort: number,
  side: TokenSide,
  sqrtLambdaX96: bigint = Q96,
  f: number = 1,  // FIXED: Must be 1 to match on-chain implementation
  betaNum: number = 1,
  betaDen: number = 2
): bigint {
  // Calculate regular price first
  const price = calculateICBSPrice(
    sLong,
    sShort,
    side,
    1.0, // Lambda is handled separately in X96 format
    f,
    betaNum,
    betaDen
  );

  // Convert to sqrt price X96
  const sqrtPrice = Math.sqrt(price);
  const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Number(Q96)));

  // Multiply by sqrt lambda
  return (sqrtPriceX96 * sqrtLambdaX96) / Q96;
}

/**
 * Calculate the current market prediction q (reserve ratio)
 * q = R_L / (R_L + R_S) where R = s × p
 */
export function calculateMarketPrediction(
  sLong: number,
  sShort: number,
  lambdaLong: number = 1.0,
  lambdaShort: number = 1.0,
  f: number = 1,  // FIXED: Must be 1 to match on-chain implementation
  betaNum: number = 1,
  betaDen: number = 2
): number {
  const priceLong = calculateICBSPrice(sLong, sShort, TokenSide.Long, lambdaLong, f, betaNum, betaDen);
  const priceShort = calculateICBSPrice(sLong, sShort, TokenSide.Short, lambdaShort, f, betaNum, betaDen);

  // Calculate virtual reserves (supply is already in display units)
  const rLong = sLong * priceLong;
  const rShort = sShort * priceShort;

  // Avoid division by zero
  if (rLong + rShort === 0) {
    return 0.5; // Default to 50%
  }

  return rLong / (rLong + rShort);
}

/**
 * Estimate tokens received for a given USDC amount (buy trade) using cost function
 * This matches the on-chain calculate_buy implementation
 */
export function estimateTokensOut(
  currentSupply: number,
  otherSupply: number,
  usdcIn: number,
  side: TokenSide,
  lambdaScale: number = 1.0,
  f: number = 1,  // FIXED: Must be 1 to match on-chain implementation
  betaNum: number = 1,
  betaDen: number = 2
): number {
  // Validate parameters
  if (f !== 1 || betaNum !== 1 || betaDen !== 2) {
    console.warn('ICBS only supports F=1, β=0.5');
  }

  // Determine current supplies based on side
  const [sLongBefore, sShortBefore] = side === TokenSide.Long
    ? [currentSupply, otherSupply]
    : [otherSupply, currentSupply];

  // Calculate current cost: C_before = λ × sqrt(s_L² + s_S²)
  const costBefore = calculateCost(sLongBefore, sShortBefore, lambdaScale);

  // After buying, cost increases by usdcIn: C_after = C_before + usdcIn
  const costAfter = costBefore + usdcIn;

  // From C_after = λ × sqrt(s_L_after² + s_S_after²), solve for new supply
  // norm_after = C_after / λ
  const normAfter = costAfter / lambdaScale;

  // norm_after² = s_L_after² + s_S_after²
  // For buying LONG: norm_after² = (s_L + Δs)² + s_S²
  // For buying SHORT: norm_after² = s_L² + (s_S + Δs)²
  const normAfterSq = normAfter * normAfter;
  const otherSupplySq = otherSupply * otherSupply;

  // Solve for new supply squared
  const newSupplySq = normAfterSq - otherSupplySq;

  // Safety check: ensure we're not taking sqrt of negative
  if (newSupplySq < 0) {
    console.warn('Invalid calculation: negative supply squared');
    return 0;
  }

  // Calculate new supply
  const newSupply = Math.sqrt(newSupplySq);

  // Tokens received = new supply - current supply
  const tokensOut = Math.max(0, newSupply - currentSupply);

  return tokensOut;
}

/**
 * Cost function for ICBS: C = λ × sqrt(s_L² + s_S²)
 * This matches the on-chain implementation for F=1, β=0.5
 */
function calculateCost(
  sLong: number,
  sShort: number,
  lambda: number = 1.0
): number {
  // Calculate L2 norm: sqrt(s_L² + s_S²)
  const norm = Math.sqrt(sLong * sLong + sShort * sShort);

  // Cost = λ × norm
  return lambda * norm;
}

/**
 * Estimate USDC received for selling tokens using cost function approach
 * This matches the on-chain calculate_sell implementation
 */
export function estimateUsdcOut(
  currentSupply: number,
  otherSupply: number,
  tokensIn: number,
  side: TokenSide,
  lambdaScale: number = 1.0,
  f: number = 1,  // FIXED: Must be 1 to match on-chain implementation
  betaNum: number = 1,
  betaDen: number = 2
): number {
  // Validate parameters
  if (f !== 1 || betaNum !== 1 || betaDen !== 2) {
    console.warn('ICBS only supports F=1, β=0.5');
  }

  // Calculate new supply after selling
  const newSupply = Math.max(0, currentSupply - tokensIn);

  // Determine supplies before and after based on side
  const [sLongBefore, sShortBefore] = side === TokenSide.Long
    ? [currentSupply, otherSupply]
    : [otherSupply, currentSupply];

  const [sLongAfter, sShortAfter] = side === TokenSide.Long
    ? [newSupply, otherSupply]
    : [otherSupply, newSupply];

  // Calculate costs before and after
  const costBefore = calculateCost(sLongBefore, sShortBefore, lambdaScale);
  const costAfter = calculateCost(sLongAfter, sShortAfter, lambdaScale);

  // USDC out = decrease in cost (selling reduces total cost)
  const usdcOut = Math.max(0, costBefore - costAfter);

  return usdcOut;
}