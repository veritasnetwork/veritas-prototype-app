use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::utils::integer_cbrt;

/// Constants for bonding curve formula
/// Formula: s(R) = (3R/k)^(1/3) * 100
/// Where R is in USDC (not micro-USDC), s is shares
/// We scale by dividing micro-USDC by 10^6, then multiply result by 10^6 for atomic units
const USDC_PRECISION: u128 = 1_000_000; // Convert micro-USDC to USDC
const SHARE_MULTIPLIER: u128 = 100;     // The 100x in the formula
const TOKEN_PRECISION: u128 = 1_000_000; // SPL token has 6 decimals

/// Calculate new token supply after buying with USDC
/// Formula: s(R) = (3R/k)^(1/3) * 100
/// Where R is reserves in USDC dollars (micro-USDC / 10^6)
///
/// For k=1 and R=$10:
/// s = cbrt(3 * 10 / 1) * 100 = cbrt(30) * 100 ≈ 3.107 * 100 = 310.7 shares
/// In atomic units: 310.7 * 10^6 = 310,700,000
pub fn calculate_buy_supply(
    _s0: u128, // Current supply (unused, kept for compatibility)
    reserve0: u128,  // in micro-USDC
    usdc_amount: u128, // in micro-USDC
    k_quadratic: u128,
) -> Result<u128> {
    let new_reserve_micro = reserve0
        .checked_add(usdc_amount)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Strategy: We want to calculate cbrt((3 * R_dollars / k)) * 100 * 10^6
    // Where R_dollars = new_reserve_micro / 10^6
    //
    // To maintain precision with integer math, we'll scale the calculation:
    // 1. Convert micro-USDC to a scaled representation
    // 2. Take the cube root
    // 3. Apply the 100x multiplier
    // 4. Convert to atomic units (multiply by 10^6)

    // We scale by 10^9 internally for the cube root calculation
    // This gives us enough precision without overflow
    const CBRT_SCALE: u128 = 1_000_000_000; // 10^9 for internal precision

    // Calculate 3 * new_reserve_micro / k
    // This is in micro-USDC units
    let term_micro = new_reserve_micro
        .checked_mul(3)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_div(k_quadratic)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Now we need cbrt(term_micro / 10^6) but scaled up
    // We'll calculate cbrt(term_micro * CBRT_SCALE^3 / 10^6)
    // Then divide by CBRT_SCALE to get the actual value

    // term_micro * CBRT_SCALE^3 / 10^6 = term_micro * 10^27 / 10^6 = term_micro * 10^21
    // But 10^21 is too large, it will overflow
    // Instead, let's use: cbrt(term_micro * 10^15 / 10^6) = cbrt(term_micro * 10^9)

    let term_scaled = term_micro
        .checked_mul(CBRT_SCALE)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Take cube root - this gives us cbrt(term_micro * 10^9)
    // For term_micro = 30,000,000 (from $10 with k=1):
    // cbrt(30,000,000 * 10^9) = cbrt(30 * 10^15) = cbrt(30) * 10^5 = 3.107 * 100,000 = 310,723
    let cbrt_scaled = integer_cbrt(term_scaled)?;

    // Now cbrt_scaled ≈ cbrt(term_dollars) * 100,000
    // For $10 with k=1: cbrt(30) * 100,000 ≈ 3.107 * 100,000 = 310,723

    // Apply 100x multiplier and convert to shares
    // We have cbrt in units where 100,000 = 1 dollar^(1/3)
    // So shares = cbrt_scaled * 100 / 100,000 = cbrt_scaled / 1,000
    // For our example: 310,723 / 1,000 = 310.7 shares
    let shares = cbrt_scaled
        .checked_mul(SHARE_MULTIPLIER)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_div(100_000)  // Fixed: was 10_000, causing 10x too many tokens
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Convert shares to atomic units
    // atomic = shares * 10^6
    let new_supply = shares
        .checked_mul(TOKEN_PRECISION)
        .ok_or(ErrorCode::NumericalOverflow)?;

    Ok(new_supply)
}

/// Calculate USDC payout for selling tokens
/// Inverse formula: R = k * (s/100)^3 / 3
/// Where s is shares (atomic units / 10^6) and R is in USDC dollars
///
/// For s=310 shares and k=1:
/// R = 1 * (310/100)^3 / 3 = 1 * 3.1^3 / 3 ≈ 9.92 USDC
pub fn calculate_sell_payout(
    s0: u128,  // Current supply in atomic units
    s1: u128,  // New supply after selling (atomic units)
    _reserve0: u128,  // Current reserve (unused, but kept for compatibility)
    k_quadratic: u128,
) -> Result<u128> {
    if s1 >= s0 {
        return Err(ErrorCode::InvalidAmount.into());
    }

    // Convert atomic units to shares
    // shares = atomic / 10^6
    let s0_shares = s0
        .checked_div(TOKEN_PRECISION)
        .ok_or(ErrorCode::NumericalOverflow)?;

    let s1_shares = s1
        .checked_div(TOKEN_PRECISION)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Calculate reserves using R = k * (s/100)^3 / 3
    // We need to be careful with integer division

    // For better precision, we'll scale the calculation
    const CUBE_SCALE: u128 = 1_000_000; // Scale factor for cubing

    // Calculate (s * CUBE_SCALE / 100)^3
    let s0_scaled = s0_shares
        .checked_mul(CUBE_SCALE)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_div(SHARE_MULTIPLIER)
        .ok_or(ErrorCode::NumericalOverflow)?;

    let s1_scaled = s1_shares
        .checked_mul(CUBE_SCALE)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_div(SHARE_MULTIPLIER)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Cube the scaled values
    let s0_cubed_scaled = s0_scaled
        .checked_pow(3)
        .ok_or(ErrorCode::NumericalOverflow)?;

    let s1_cubed_scaled = s1_scaled
        .checked_pow(3)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Calculate reserves: R = k * (s_scaled)^3 / (3 * CUBE_SCALE^3)
    // Result will be in USDC dollars
    let divisor = 3u128
        .checked_mul(CUBE_SCALE)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_mul(CUBE_SCALE)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_mul(CUBE_SCALE)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Calculate reserves in micro-USDC directly (multiply before divide to preserve precision)
    let reserve0_micro = k_quadratic
        .checked_mul(s0_cubed_scaled)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_mul(USDC_PRECISION)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_div(divisor)
        .ok_or(ErrorCode::NumericalOverflow)?;

    let reserve1_micro = k_quadratic
        .checked_mul(s1_cubed_scaled)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_mul(USDC_PRECISION)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_div(divisor)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Calculate payout in micro-USDC (already has 6 decimal precision)
    let payout_micro_usdc = reserve0_micro
        .checked_sub(reserve1_micro)
        .ok_or(ErrorCode::NumericalOverflow)?;

    Ok(payout_micro_usdc)
}

/// Calculate price with price floor enforced
/// Price formula: P(s) = max(0.0001, k * s^2 / 1,000,000)
/// Where s is shares (atomic units / 10^6) and P is in USDC per share
///
/// Returns price in micro-USDC per share (not per atomic unit)
pub fn calculate_price_with_floor(supply_atomic: u128, k_quadratic: u128) -> Result<u128> {
    // Convert atomic units to shares
    let shares = supply_atomic
        .checked_div(TOKEN_PRECISION)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Calculate k * shares^2
    let shares_squared = shares
        .checked_pow(2)
        .ok_or(ErrorCode::NumericalOverflow)?;

    let price_numerator = k_quadratic
        .checked_mul(shares_squared)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Calculate price in micro-USDC per share
    // P = k * s^2 / 1,000,000 (in USDC)
    // P_micro = k * s^2 * 10^6 / 10^6 = k * s^2 (in micro-USDC)
    let price_micro_usdc = price_numerator;

    // Apply floor of 0.0001 USDC = 100 micro-USDC per share
    const PRICE_FLOOR_MICRO: u128 = 100; // 0.0001 USDC in micro-USDC

    Ok(price_micro_usdc.max(PRICE_FLOOR_MICRO))
}