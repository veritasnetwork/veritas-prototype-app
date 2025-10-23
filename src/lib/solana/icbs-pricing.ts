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
  f: number = 1,  // FIXED: Changed from 3 to 1 to match Rust implementation
  betaNum: number = 1,
  betaDen: number = 2
): number {
  // Get the supply for the requested side
  const s = side === TokenSide.Long ? sLong : sShort;

  // Handle edge case of zero supply
  if (s === 0) {
    return lambdaScale; // Minimum price
  }

  // Use display units directly (already converted from API)
  const sLongDisplay = sLong;
  const sShortDisplay = sShort;
  const sDisplay = s;

  // Calculate F/β
  const fOverBeta = (f * betaDen) / betaNum;

  // Calculate s^(F/β - 1)
  const sPower = Math.pow(sDisplay, fOverBeta - 1);

  // Calculate s_L^(F/β) + s_S^(F/β)
  const sLongPow = Math.pow(sLongDisplay, fOverBeta);
  const sShortPow = Math.pow(sShortDisplay, fOverBeta);
  const sumPow = sLongPow + sShortPow;

  // Calculate β (as a decimal)
  const beta = betaNum / betaDen;

  // Calculate (s_L^(F/β) + s_S^(F/β))^(β - 1)
  const sumPower = Math.pow(sumPow, beta - 1);

  // Calculate final price: λ × F × s^(F/β - 1) × (sum)^(β - 1)
  const price = lambdaScale * f * sPower * sumPower;

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
 * Estimate tokens received for a given USDC amount (buy trade)
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
  // Binary search for the amount of tokens that costs approximately usdcIn
  let low = 0;
  let high = usdcIn * 100; // Upper bound estimate
  let result = 0;

  const tolerance = 0.01; // 1 cent tolerance

  while (low <= high) {
    const mid = (low + high) / 2;

    // Calculate average price for this trade (supply is already in display units)
    const newSupply = currentSupply + mid;

    const priceBefore = calculateICBSPrice(
      side === TokenSide.Long ? currentSupply : otherSupply,
      side === TokenSide.Long ? otherSupply : currentSupply,
      side,
      lambdaScale,
      f,
      betaNum,
      betaDen
    );

    const priceAfter = calculateICBSPrice(
      side === TokenSide.Long ? newSupply : otherSupply,
      side === TokenSide.Long ? otherSupply : newSupply,
      side,
      lambdaScale,
      f,
      betaNum,
      betaDen
    );

    // Use average price for cost estimation
    const avgPrice = (priceBefore + priceAfter) / 2;
    const cost = avgPrice * mid;

    if (Math.abs(cost - usdcIn) < tolerance) {
      return mid;
    } else if (cost < usdcIn) {
      result = mid;
      low = mid + 0.001; // Increment by small amount for precision
    } else {
      high = mid - 0.001;
    }
  }

  return result;
}

/**
 * Estimate USDC received for selling tokens
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
  // Calculate new supply after selling (supply is already in display units)
  const newSupply = Math.max(0, currentSupply - tokensIn);

  // Calculate average price
  const priceBefore = calculateICBSPrice(
    side === TokenSide.Long ? currentSupply : otherSupply,
    side === TokenSide.Long ? otherSupply : currentSupply,
    side,
    lambdaScale,
    f,
    betaNum,
    betaDen
  );

  const priceAfter = calculateICBSPrice(
    side === TokenSide.Long ? newSupply : otherSupply,
    side === TokenSide.Long ? otherSupply : newSupply,
    side,
    lambdaScale,
    f,
    betaNum,
    betaDen
  );

  const avgPrice = (priceBefore + priceAfter) / 2;
  return avgPrice * tokensIn;
}