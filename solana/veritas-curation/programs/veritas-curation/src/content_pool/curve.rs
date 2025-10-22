use anchor_lang::prelude::*;
use super::errors::ContentPoolError;
use super::state::{TokenSide, MAX_SAFE_SUPPLY};

/// ICBS Curve implementation using square root prices to prevent overflow
/// This maintains the exact same bonding curve mathematics while avoiding u128 overflow
pub struct ICBSCurve;

/// X96 format: sqrt(price) * 2^96 for precision
/// This gives us 96 bits of precision for the square root of price
pub const Q96: u128 = 1 << 96;

/// Scale factor for numerical stability
/// All supplies are divided by this before power calculations to prevent overflow
/// With USDC having 6 decimals, this gives us "whole USDC" units
/// Example: 100 USDC = 100_000_000 lamports → 100 scaled units
pub const SUPPLY_SCALE: u64 = 1_000_000;

/// GCD helper for overflow-safe multiplication and division
#[inline]
fn gcd_u128(mut a: u128, mut b: u128) -> u128 {
    while b != 0 {
        let t = a % b;
        a = b;
        b = t;
    }
    a
}

/// Overflow-safe mul_div: computes (a * b) / den with GCD reduction
/// Reduces b/den first to avoid overflow in a*b
#[inline]
fn mul_div_u128(a: u128, b: u128, den: u128) -> Result<u128> {
    if den == 0 {
        return err!(ContentPoolError::DivisionByZero);
    }
    // Reduce b/den first to avoid overflow in a*b
    let g = gcd_u128(b, den);
    let (b_r, den_r) = (b / g, den / g);

    Ok(a.checked_mul(b_r)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(den_r)
        .ok_or(ContentPoolError::NumericalOverflow)?)
}

impl ICBSCurve {
    /// Calculate the cost function C(s_L, s_S)
    ///
    /// For F=1, β=0.5 (the default and only supported configuration):
    /// C(s_L, s_S) = λ × sqrt(s_L² + s_S²)
    ///
    /// This specialized implementation avoids all overflow issues by:
    /// 1. Using direct sqrt instead of fractional powers
    /// 2. Working directly in lamports without scaling
    /// 3. Staying within u128 bounds for realistic pool sizes (up to 10^13 lamports)
    pub fn cost_function(
        s_long: u64,
        s_short: u64,
        lambda_x96: u128,  // λ in X96 format (NOT sqrt!)
        f: u16,
        beta_num: u16,
        beta_den: u16,
    ) -> Result<u128> {
        // Only support F=1, β=0.5 for now (the optimal configuration)
        if f != 1 || beta_num != 1 || beta_den != 2 {
            return err!(ContentPoolError::InvalidParameter);
        }

        // Direct formula: C = λ × sqrt(s_L² + s_S²)
        // No scaling needed, no fractional powers!

        // Calculate s_L² and s_S²
        let s_l_squared = (s_long as u128)
            .checked_mul(s_long as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?;

        let s_s_squared = (s_short as u128)
            .checked_mul(s_short as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?;

        // Sum of squares
        let sum_of_squares = s_l_squared
            .checked_add(s_s_squared)
            .ok_or(ContentPoolError::NumericalOverflow)?;

        // sqrt(s_L² + s_S²) - the L2 norm
        let norm = integer_sqrt(sum_of_squares)?;

        // Apply lambda: C = λ × norm
        // lambda_x96 is in Q96 format, use mul_x96 to avoid overflow
        let total_cost = mul_x96(lambda_x96, norm)?;

        Ok(total_cost)
    }

    /// Calculate the square root of marginal price
    ///
    /// For F=1, β=0.5: p = λ × s / sqrt(s_L² + s_S²)
    /// Compute p in Q96 first, then sqrt(p) × 2^48
    ///
    /// Returns sqrt(p) * 2^96
    pub fn sqrt_marginal_price(
        s_long: u64,
        s_short: u64,
        side: TokenSide,
        sqrt_lambda_x96: u128,  // sqrt(λ) * 2^96
        f: u16,
        beta_num: u16,
        beta_den: u16,
    ) -> Result<u128> {
        // Only support F=1, β=0.5
        if f != 1 || beta_num != 1 || beta_den != 2 {
            return err!(ContentPoolError::InvalidParameter);
        }

        // Get the supply for the requested side
        let s = match side {
            TokenSide::Long => s_long,
            TokenSide::Short => s_short,
        };

        // Prevent division by zero
        if s == 0 {
            return Ok(0); // Zero supply means zero price
        }

        // Calculate the norm: sqrt(s_L² + s_S²)
        let s_l_squared = (s_long as u128)
            .checked_mul(s_long as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        let s_s_squared = (s_short as u128)
            .checked_mul(s_short as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        let sum_of_squares = s_l_squared
            .checked_add(s_s_squared)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        let norm = integer_sqrt(sum_of_squares)?.max(1); // Avoid div by zero

        // Convert sqrt(λ) to λ in Q96: λ_q96 = (sqrt_lambda * sqrt_lambda) >> 96
        use crate::content_pool::math::mul_shift_right_96;
        let lambda_q96 = mul_shift_right_96(sqrt_lambda_x96, sqrt_lambda_x96)?;

        // Compute p in Q96: p = (λ_q96 * s) / norm
        // Use mul_div_u128 from math module for safe 256-bit intermediate
        use crate::content_pool::math::mul_div_u128;
        let p_q96 = mul_div_u128(lambda_q96, s as u128, norm)?;

        // sqrt_price_x96 = sqrt(p_q96) << 48
        // Because p is in Q96, sqrt(p) needs to be scaled by 2^48 to get Q96
        let sqrt_p = integer_sqrt(p_q96)?;
        let sqrt_price_x96 = sqrt_p
            .checked_shl(48)
            .ok_or(ContentPoolError::NumericalOverflow)?;

        Ok(sqrt_price_x96)
    }

    /// Calculate tokens received for a buy trade using direct algebraic solution
    /// For F=1, β=0.5: Δs = sqrt([(usdc_in/λ) + norm]² - s_other²) - current_s
    pub fn calculate_buy(
        current_s: u64,
        usdc_in: u64,
        sqrt_lambda_x96: u128,
        s_other: u64,
        f: u16,
        beta_num: u16,
        beta_den: u16,
        is_long: bool,
    ) -> Result<(u64, u128)> {
        // Only support F=1, β=0.5
        if f != 1 || beta_num != 1 || beta_den != 2 {
            return err!(ContentPoolError::InvalidParameter);
        }

        // Convert sqrt_lambda to lambda: lambda = (sqrt_lambda)^2 / Q96
        let lambda_x96 = mul_x96(sqrt_lambda_x96, sqrt_lambda_x96)?;

        // Calculate current norm: sqrt(s_L² + s_S²)
        let (s_l_before, s_s_before) = if is_long {
            (current_s, s_other)
        } else {
            (s_other, current_s)
        };

        let s_l_sq = (s_l_before as u128)
            .checked_mul(s_l_before as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        let s_s_sq = (s_s_before as u128)
            .checked_mul(s_s_before as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        let sum_sq = s_l_sq
            .checked_add(s_s_sq)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        let norm_before = integer_sqrt(sum_sq)?;

        // Solve: norm_after = (usdc_in / λ) + norm_before
        // usdc_in / λ = (usdc_in * Q96) / lambda_x96
        // Use GCD-reduced mul_div to avoid overflow
        let delta_norm = mul_div_u128(usdc_in as u128, Q96, lambda_x96)?;
        let norm_after = norm_before
            .checked_add(delta_norm)
            .ok_or(ContentPoolError::NumericalOverflow)?;

        // Guard against overflow in squaring: if norm_after > u64::MAX, squaring will overflow u128
        require!(norm_after <= u64::MAX as u128, ContentPoolError::NumericalOverflow);

        // Now: norm_after² = (current_s + Δs)² + s_other²
        // So: (current_s + Δs)² = norm_after² - s_other²
        let norm_after_sq = norm_after
            .checked_mul(norm_after)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        let s_other_sq = (s_other as u128)
            .checked_mul(s_other as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?;

        let new_s_sq = norm_after_sq
            .checked_sub(s_other_sq)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        let new_s = integer_sqrt(new_s_sq)?;

        // Δs = new_s - current_s
        let delta_s = new_s
            .checked_sub(current_s as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?;

        if delta_s > u64::MAX as u128 {
            return err!(ContentPoolError::SupplyOverflow);
        }

        let result = delta_s as u64;

        // Calculate final sqrt price
        let final_s = current_s.saturating_add(result);
        let final_sqrt_price = if is_long {
            Self::sqrt_marginal_price(final_s, s_other, TokenSide::Long, sqrt_lambda_x96, f, beta_num, beta_den)?
        } else {
            Self::sqrt_marginal_price(s_other, final_s, TokenSide::Short, sqrt_lambda_x96, f, beta_num, beta_den)?
        };

        Ok((result, final_sqrt_price))
    }

    /// Calculate USDC received for a sell trade using direct cost function
    /// Uses ΔC = C(s_before) - C(s_after) to get exact USDC out
    pub fn calculate_sell(
        current_s: u64,
        tokens_to_sell: u64,
        sqrt_lambda_x96: u128,
        s_other: u64,
        f: u16,
        beta_num: u16,
        beta_den: u16,
        is_long: bool,
    ) -> Result<(u64, u128)> {
        // New supply after selling
        let s_new = current_s
            .checked_sub(tokens_to_sell)
            .ok_or(ContentPoolError::InsufficientBalance)?;

        // Calculate supplies before and after for cost function
        let (s_l_before, s_s_before) = if is_long {
            (current_s, s_other)
        } else {
            (s_other, current_s)
        };

        let (s_l_after, s_s_after) = if is_long {
            (s_new, s_other)
        } else {
            (s_other, s_new)
        };

        // Convert sqrt_lambda to lambda: lambda = (sqrt_lambda)^2 / Q96
        let lambda_x96 = mul_x96(sqrt_lambda_x96, sqrt_lambda_x96)?;

        // Calculate costs before and after
        let cost_before = Self::cost_function(s_l_before, s_s_before, lambda_x96, f, beta_num, beta_den)?;
        let cost_after = Self::cost_function(s_l_after, s_s_after, lambda_x96, f, beta_num, beta_den)?;

        // USDC out = cost decrease (selling reduces total cost)
        let usdc_out = cost_before.saturating_sub(cost_after);

        let usdc_out_u64 = if usdc_out > u64::MAX as u128 {
            return err!(ContentPoolError::NumericalOverflow);
        } else {
            usdc_out as u64
        };

        // Calculate final sqrt price for return value
        let sqrt_price_after = if is_long {
            Self::sqrt_marginal_price(s_new, s_other, TokenSide::Long, sqrt_lambda_x96, f, beta_num, beta_den)?
        } else {
            Self::sqrt_marginal_price(s_other, s_new, TokenSide::Short, sqrt_lambda_x96, f, beta_num, beta_den)?
        };

        Ok((usdc_out_u64, sqrt_price_after))
    }

    /// Calculate virtual reserves from supply and sqrt price
    /// r = s * price = s * (sqrt_price)² / Q96²
    pub fn virtual_reserves(s: u64, sqrt_price_x96: u128) -> Result<u64> {
        // Compute price in Q96: price = (sqrt_price)² / Q96
        let price_q96 = mul_x96(sqrt_price_x96, sqrt_price_x96)?;

        // Compute reserve: r = (s * price_q96) / Q96
        let reserve = mul_x96(price_q96, s as u128)?;

        if reserve > u64::MAX as u128 {
            return err!(ContentPoolError::NumericalOverflow);
        }

        Ok(reserve as u64)
    }

    /// Calculate market prediction q from supplies and sqrt prices
    /// q = r_long / (r_long + r_short)
    pub fn market_prediction(
        s_long: u64,
        s_short: u64,
        sqrt_price_long_x96: u128,
        sqrt_price_short_x96: u128,
    ) -> Result<u64> {
        let r_long = Self::virtual_reserves(s_long, sqrt_price_long_x96)?;
        let r_short = Self::virtual_reserves(s_short, sqrt_price_short_x96)?;

        if r_long == 0 && r_short == 0 {
            // Default to 50/50 if no reserves
            return Ok(500_000); // 0.5 in micro-units
        }

        // q = r_long / (r_long + r_short) in basis points
        let q_bps = ((r_long as u128 * 10000) / ((r_long + r_short) as u128)) as u64;

        // Convert to micro-units (6 decimals)
        Ok(q_bps * 100)
    }
}

// Helper functions for X96 arithmetic

/// Multiply two X96 numbers and return X96 result (floor rounding)
///
/// Computes floor((a * b) / 2^96) without overflow for Q96 inputs.
/// Uses 64-bit limb decomposition to safely handle a, b up to 2^96.
pub fn mul_x96(a: u128, b: u128) -> Result<u128> {
    const MASK64: u128 = (1u128 << 64) - 1;

    // Decompose into 64-bit limbs: a = a1*2^64 + a0
    let a0 = a & MASK64;
    let a1 = a >> 64;
    let b0 = b & MASK64;
    let b1 = b >> 64;

    // Compute (a*b) >> 96 = (a1*b1)<<32 + (a1*b0 + a0*b1)>>32 + (a0*b0)>>96
    // For Q96 inputs (≤ 2^96-1): a1, b1 < 2^32, so (a1*b1)<<32 < 2^96
    let t2 = (a1 * b1) << 32;

    // Cross terms: < 2^97 for Q96 inputs, so >>32 fits comfortably in u128
    let cross = (a1 * b0)
        .checked_add(a0 * b1)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let t1 = cross >> 32;

    // Low-low contributes only top 32 bits after >>96
    let t0 = (a0 * b0) >> 96;

    // Sum all terms
    let result = t2
        .checked_add(t1)
        .and_then(|r| r.checked_add(t0))
        .ok_or(ContentPoolError::NumericalOverflow)?;

    Ok(result)
}

/// Multiply-divide: (a * b) / c using 256-bit intermediate
/// Computes floor((a * b) / c) without overflow for realistic inputs
fn mul_div(a: u128, b: u128, c: u128) -> Result<u128> {
    if c == 0 {
        return err!(ContentPoolError::DivisionByZero);
    }

    // For our typical use case where a is Q96 and b is small,
    // use a simple approach: divide a first to avoid overflow
    // (a / c) * b + ((a % c) * b) / c

    // Check if we can do simple division without overflow
    let q = a / c;
    let r = a % c;

    // q * b
    let term1 = q.checked_mul(b).ok_or(ContentPoolError::NumericalOverflow)?;

    // (r * b) / c
    let r_times_b = r.checked_mul(b).ok_or(ContentPoolError::NumericalOverflow)?;
    let term2 = r_times_b / c;

    let result = term1.checked_add(term2).ok_or(ContentPoolError::NumericalOverflow)?;

    Ok(result)
}

/// Integer square root using Newton's method
fn integer_sqrt(n: u128) -> Result<u128> {
    if n == 0 {
        return Ok(0);
    }

    let mut x = n;
    let mut y = (x + 1) / 2;

    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }

    Ok(x)
}


#[cfg(test)]
mod tests {
    use super::*;


    #[test]
    fn test_cost_function_homogeneity() {
        // Test homogeneity: C(λs_L, λs_S) = λ^F × C(s_L, s_S)
        // With F=1, doubling supplies should give 2x the cost (1-homogeneous)
        // Use realistic USDC values (10 USDC = 10_000_000 lamports)
        let s_l = 10_000_000u64;
        let s_s = 10_000_000u64;
        let lambda_x96 = Q96; // λ = 1
        let f = 1u16;  // Changed from 2 to 1
        let beta_num = 1u16;
        let beta_den = 2u16;

        let cost_base = ICBSCurve::cost_function(s_l, s_s, lambda_x96, f, beta_num, beta_den).unwrap();

        // Scale supplies by 2
        let cost_scaled = ICBSCurve::cost_function(s_l * 2, s_s * 2, lambda_x96, f, beta_num, beta_den).unwrap();

        // Should be 2^F = 2^1 = 2x (within rounding error)
        let ratio = cost_scaled as f64 / cost_base as f64;
        let expected_ratio = 2f64.powi(f as i32);
        assert!((ratio - expected_ratio).abs() < 0.01, "Homogeneity violated: expected {}, got {}", expected_ratio, ratio);
    }

    #[test]
    fn test_cost_function_lambda_scaling() {
        // Test that doubling lambda doubles the cost
        let s_l = 10_000_000u64;
        let s_s = 10_000_000u64;
        let lambda_x96 = Q96; // λ = 1
        let lambda_2x_x96 = Q96 * 2; // λ = 2
        let f = 1u16;  // Changed from 2 to 1
        let beta_num = 1u16;
        let beta_den = 2u16;

        let cost_1 = ICBSCurve::cost_function(s_l, s_s, lambda_x96, f, beta_num, beta_den).unwrap();
        let cost_2 = ICBSCurve::cost_function(s_l, s_s, lambda_2x_x96, f, beta_num, beta_den).unwrap();

        let ratio = cost_2 as f64 / cost_1 as f64;
        assert!((ratio - 2.0).abs() < 0.01, "Lambda scaling violated: ratio = {}", ratio);
    }

    #[test]
    fn test_buy_sell_roundtrip() {
        // Test that buying then selling returns approximately the same USDC
        let s_l = 10_000_000u64;  // 10 USDC
        let s_s = 10_000_000u64;  // 10 USDC
        let sqrt_lambda_x96 = Q96; // λ = 1
        let f = 1u16;  // Changed from 2 to 1
        let beta_num = 1u16;
        let beta_den = 2u16;
        let usdc_in = 1_000_000u64; // 1 USDC

        // Buy tokens
        let (tokens_bought, _sqrt_price_after_buy) = ICBSCurve::calculate_buy(
            s_l,
            usdc_in,
            sqrt_lambda_x96,
            s_s,
            f,
            beta_num,
            beta_den,
            true, // long
        ).unwrap();

        // Sell them back
        let (usdc_out, _sqrt_price_after_sell) = ICBSCurve::calculate_sell(
            s_l + tokens_bought,
            tokens_bought,
            sqrt_lambda_x96,
            s_s,
            f,
            beta_num,
            beta_den,
            true, // long
        ).unwrap();

        // Should get back approximately the same USDC (within 1% due to rounding)
        let diff_ratio = (usdc_in as f64 - usdc_out as f64).abs() / usdc_in as f64;
        assert!(diff_ratio < 0.01, "Buy-sell roundtrip lost {}%: {} -> {} tokens -> {}",
                diff_ratio * 100.0, usdc_in, tokens_bought, usdc_out);
    }

    #[test]
    fn test_buy_increases_price() {
        // Test that buying increases marginal price
        let s_l = 10_000_000u64;
        let s_s = 10_000_000u64;
        let sqrt_lambda_x96 = Q96;
        let f = 1u16;  // Changed from 2 to 1
        let beta_num = 1u16;
        let beta_den = 2u16;

        let price_before = ICBSCurve::sqrt_marginal_price(
            s_l,
            s_s,
            TokenSide::Long,
            sqrt_lambda_x96,
            f,
            beta_num,
            beta_den,
        ).unwrap();

        let (tokens_bought, price_after) = ICBSCurve::calculate_buy(
            s_l,
            1_000_000,
            sqrt_lambda_x96,
            s_s,
            f,
            beta_num,
            beta_den,
            true,
        ).unwrap();

        assert!(price_after > price_before, "Price should increase after buy");
        assert!(tokens_bought > 0, "Should buy some tokens");
    }

    #[test]
    fn test_sell_decreases_price() {
        // Test that selling decreases marginal price
        let s_l = 20_000_000u64;
        let s_s = 10_000_000u64;
        let sqrt_lambda_x96 = Q96;
        let f = 1u16;  // Changed from 2 to 1
        let beta_num = 1u16;
        let beta_den = 2u16;

        let price_before = ICBSCurve::sqrt_marginal_price(
            s_l,
            s_s,
            TokenSide::Long,
            sqrt_lambda_x96,
            f,
            beta_num,
            beta_den,
        ).unwrap();

        let (usdc_out, price_after) = ICBSCurve::calculate_sell(
            s_l,
            1_000_000,
            sqrt_lambda_x96,
            s_s,
            f,
            beta_num,
            beta_den,
            true,
        ).unwrap();

        assert!(price_after < price_before, "Price should decrease after sell");
        assert!(usdc_out > 0, "Should receive USDC");
    }

    #[test]
    fn test_cost_function_increases_with_supply() {
        // Test that cost increases when either supply increases
        let s_l = 10_000_000u64;
        let s_s = 10_000_000u64;
        let lambda_x96 = Q96;
        let f = 1u16;  // Changed from 2 to 1
        let beta_num = 1u16;
        let beta_den = 2u16;

        let cost_base = ICBSCurve::cost_function(s_l, s_s, lambda_x96, f, beta_num, beta_den).unwrap();
        // Use larger increment to see difference after scaling/rounding
        let cost_more_long = ICBSCurve::cost_function(s_l + 5_000_000, s_s, lambda_x96, f, beta_num, beta_den).unwrap();
        let cost_more_short = ICBSCurve::cost_function(s_l, s_s + 5_000_000, lambda_x96, f, beta_num, beta_den).unwrap();

        // With F=1, the cost function should increase when supply increases
        assert!(cost_more_long > cost_base, "Cost should increase with s_long: base={}, with_more_long={}", cost_base, cost_more_long);
        assert!(cost_more_short > cost_base, "Cost should increase with s_short: base={}, with_more_short={}", cost_base, cost_more_short);
    }

    #[test]
    fn tiny_trade_no_overflow() {
        // Test that tiny trades (0.001 USDC) don't cause overflow
        // 60/40 supplies, λ=1
        let s_l = 60_000_000u64;
        let s_s = 40_000_000u64;
        let sqrt_lambda_x96 = Q96; // λ=1
        // 0.001 USDC
        let (tokens, _) = ICBSCurve::calculate_buy(
            s_l, 1_000, sqrt_lambda_x96, s_s, 1, 1, 2, true
        ).unwrap();
        assert!(tokens > 0, "Should mint tokens for minimum trade");
    }
}