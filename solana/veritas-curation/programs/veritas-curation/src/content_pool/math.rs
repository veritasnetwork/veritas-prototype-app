use anchor_lang::prelude::*;
use super::errors::ContentPoolError;

/// Core arithmetic helpers for overflow-safe fixed-point math
/// These are the building blocks for Q64 and ICBS calculations

/// 128×128 → 256-bit multiplication (hi, lo)
#[inline]
pub fn full_mul_128(a: u128, b: u128) -> (u128, u128) {
    let a0 = a as u64 as u128;
    let a1 = (a >> 64) as u64 as u128;
    let b0 = b as u64 as u128;
    let b1 = (b >> 64) as u64 as u128;

    let ll = a0 * b0;
    let lh = a0 * b1;
    let hl = a1 * b0;
    let hh = a1 * b1;

    let mid = lh + hl;
    let carry_mid = (mid < lh) as u128; // 1 if 128-bit overflow

    let low = ll.wrapping_add(mid << 64);
    let carry_low = (low < ll) as u128; // 1 if low overflowed

    let high = hh
        .wrapping_add(mid >> 64)
        .wrapping_add(carry_low)
        .wrapping_add(carry_mid << 64);

    (high, low)
}

/// 256÷128 → 128-bit division (floor). Requires hi < d so quotient fits in u128.
/// Returns floor((hi * 2^128 + lo) / d)
#[inline]
pub fn div_256_by_128(hi: u128, lo: u128, d: u128) -> Result<u128> {
    if d == 0 {
        return err!(ContentPoolError::DivisionByZero);
    }
    if hi >= d {
        return err!(ContentPoolError::NumericalOverflow);
    }

    // Bitwise long division specialized for 256/128 where quotient fits u128
    let mut q: u128 = 0;
    let mut r: u128 = 0;

    // Consume high 128 bits (no quotient bits emitted; ensures q fits u128)
    for i in (0..128).rev() {
        r = (r << 1) | ((hi >> i) & 1);
        if r >= d {
            r -= d;
        }
    }

    // Consume low 128 bits; emit quotient bits into q
    for i in (0..128).rev() {
        r = (r << 1) | ((lo >> i) & 1);
        if r >= d {
            r -= d;
            q |= 1u128 << i;
        }
    }

    Ok(q)
}

/// (a * b) / d using 256-bit intermediate
/// Computes floor((a * b) / d) without overflow
#[inline]
pub fn mul_div_u128(a: u128, b: u128, d: u128) -> Result<u128> {
    let (hi, lo) = full_mul_128(a, b);
    div_256_by_128(hi, lo, d)
}

/// Plain integer sqrt for u128 (floor)
#[inline]
fn isqrt_u128(n: u128) -> u128 {
    if n == 0 {
        return 0;
    }
    // Newton's method on integers (fast and deterministic)
    let mut x = n;
    let mut y = (x + 1) >> 1;
    while y < x {
        x = y;
        y = (x + n / x) >> 1;
    }
    x
}

/// (a_q96 * b) >> 96 for Q96 fixed-point
/// Safe for a <= 2^96-1; b arbitrary u128
#[inline]
pub fn mul_shift_right_96(a_q96: u128, b: u128) -> Result<u128> {
    const MASK64: u128 = (1u128 << 64) - 1;

    let a0 = a_q96 & MASK64;
    let a1 = a_q96 >> 64;
    let b0 = b & MASK64;
    let b1 = b >> 64;

    // Compute (a*b) >> 96
    let t2 = (a1 * b1) << 32;

    let cross = (a1 * b0)
        .checked_add(a0 * b1)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let t1 = cross >> 32;

    let t0 = (a0 * b0) >> 96;

    let result = t2
        .checked_add(t1)
        .and_then(|r| r.checked_add(t0))
        .ok_or(ContentPoolError::NumericalOverflow)?;

    Ok(result)
}

/// Q64.64 fixed-point math library
/// 64 bits for integer part, 64 bits for fractional part
pub mod q64 {
    use super::*;

    pub const ONE: u128 = 1 << 64;
    pub const HALF: u128 = 1 << 63;

    /// Convert u64 to Q64.64
    pub fn from_u64(n: u64) -> u128 {
        (n as u128) << 64
    }

    /// Convert Q64.64 to u64 (truncate)
    pub fn to_u64(q: u128) -> Result<u64> {
        let result = q >> 64;
        if result > u64::MAX as u128 {
            return err!(ContentPoolError::NumericalOverflow);
        }
        Ok(result as u64)
    }

    /// Convert Q64.64 to u128 (just return the raw value)
    pub fn to_u128(q: u128) -> u128 {
        q
    }

    /// Multiply two Q64.64 numbers: (a * b) >> 64
    pub fn mul(a: u128, b: u128) -> Result<u128> {
        let (hi, lo) = full_mul_128(a, b);
        // >> 64: combine upper 64 of lo with lower 64 of hi
        let result = (hi << 64) | (lo >> 64);
        Ok(result)
    }

    /// Divide two Q64.64 numbers: (a << 64) / b
    pub fn div(a: u128, b: u128) -> Result<u128> {
        if b == 0 {
            return err!(ContentPoolError::DivisionByZero);
        }
        let hi = a >> 64;
        let lo = a << 64;
        div_256_by_128(hi, lo, b)
    }

    /// Square root for Q64.64 using Newton's method
    /// Returns sqrt(n) in Q64.64 format
    /// Input n is Q64.64 (n = X * 2^64), output is sqrt(X) in Q64.64
    pub fn sqrt(n: u128) -> Result<u128> {
        if n == 0 {
            return Ok(0);
        }

        let int_part = n >> 64;
        // Seed near sqrt(X) in Q64.64 scale
        let mut x = if int_part > 0 {
            isqrt_u128(int_part) << 64
        } else {
            1u128 << 63 // 0.5 in Q64.64 to avoid div by zero for 0<X<1
        };

        // 8 Newton steps are plenty for 128-bit Q64.64 precision
        for _ in 0..8 {
            let x_next = (x + div(n, x)?) >> 1;
            if x_next == x {
                break; // Converged
            }
            x = x_next;
        }

        Ok(x)
    }
}

/// Q32.32 fixed-point math for BD scores
pub mod q32 {
    use super::*;

    pub const ONE: u64 = 1 << 32;

    /// Convert Q32.32 to Q64.64
    pub fn to_q64(q32: u64) -> u128 {
        (q32 as u128) << 32
    }

    /// Convert Q64.64 to Q32.32
    pub fn from_q64(q64: u128) -> Result<u64> {
        let result = q64 >> 32;
        if result > u64::MAX as u128 {
            return err!(ContentPoolError::NumericalOverflow);
        }
        Ok(result as u64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_full_mul_128() {
        // Simple case: 2 * 3
        let (hi, lo) = full_mul_128(2, 3);
        assert_eq!(hi, 0);
        assert_eq!(lo, 6);

        // Max u64 * Max u64
        let max_u64 = u64::MAX as u128;
        let (hi, lo) = full_mul_128(max_u64, max_u64);
        assert_eq!(hi, 0);
        assert_eq!(lo, max_u64 * max_u64);

        // Test overflow
        let large = 1u128 << 100;
        let (hi, lo) = full_mul_128(large, large);
        assert!(hi > 0, "Should have high bits set");
    }

    #[test]
    fn test_div_256_by_128() {
        // Simple: 100 / 10 = 10
        let result = div_256_by_128(0, 100, 10).unwrap();
        assert_eq!(result, 10);

        // With high bits: (1 << 128) / 2
        let result = div_256_by_128(1, 0, 2).unwrap();
        assert_eq!(result, 1u128 << 127);

        // Division by zero
        assert!(div_256_by_128(0, 100, 0).is_err());

        // Overflow: hi >= divisor
        assert!(div_256_by_128(10, 0, 5).is_err());
    }

    #[test]
    fn test_mul_div_u128() {
        // (10 * 20) / 5 = 40
        let result = mul_div_u128(10, 20, 5).unwrap();
        assert_eq!(result, 40);

        // Avoid intermediate overflow: (2^64 * 2^64) / 2^64 = 2^64
        let large = 1u128 << 64;
        let result = mul_div_u128(large, large, large).unwrap();
        assert_eq!(result, large);
    }

    #[test]
    fn test_q64_mul() {
        use q64::*;

        // 2.0 * 3.0 = 6.0
        let a = from_u64(2);
        let b = from_u64(3);
        let result = mul(a, b).unwrap();
        assert_eq!(to_u64(result).unwrap(), 6);

        // 1.5 * 2.0 = 3.0
        let a = ONE + HALF; // 1.5
        let b = from_u64(2);
        let result = mul(a, b).unwrap();
        assert_eq!(to_u64(result).unwrap(), 3);
    }

    #[test]
    fn test_q64_div() {
        use q64::*;

        // 6.0 / 2.0 = 3.0
        let a = from_u64(6);
        let b = from_u64(2);
        let result = div(a, b).unwrap();
        assert_eq!(to_u64(result).unwrap(), 3);

        // 1.0 / 2.0 = 0.5
        let a = ONE;
        let b = from_u64(2);
        let result = div(a, b).unwrap();
        assert_eq!(result, HALF);
    }

    #[test]
    fn test_q64_sqrt() {
        use q64::*;

        // sqrt(4.0) = 2.0
        let n = from_u64(4);
        let result = sqrt(n).unwrap();
        let result_u64 = to_u64(result).unwrap();
        assert_eq!(result_u64, 2);

        // sqrt(9.0) = 3.0
        let n = from_u64(9);
        let result = sqrt(n).unwrap();
        let result_u64 = to_u64(result).unwrap();
        assert_eq!(result_u64, 3);

        // sqrt(2.0) ≈ 1.414...
        let n = from_u64(2);
        let result = sqrt(n).unwrap();
        let result_f64 = (result as f64) / (ONE as f64);
        assert!((result_f64 - 1.414).abs() < 0.001);
    }
}

/// Round to nearest (banker's rounding)
/// Used to convert virtual→display tokens without cumulative bias
#[inline]
pub fn round_to_nearest(value: u128, divisor: u128) -> u64 {
    let quotient = value / divisor;
    let remainder = value % divisor;
    let half = divisor / 2;

    if remainder > half || (remainder == half && quotient % 2 == 1) {
        (quotient + 1) as u64
    } else {
        quotient as u64
    }
}

/// Ceiling division: ⌈a/b⌉
/// Used to prevent virtual supplies from rounding to zero
#[inline]
pub fn ceil_div(a: u128, b: u128) -> u128 {
    if b == 0 {
        return 0;
    }
    (a + b - 1) / b
}

/// Helper: compute bit length of u128 (position of highest set bit)
#[inline]
fn bitlen_u128(x: u128) -> u32 {
    if x == 0 { 0 } else { 128 - x.leading_zeros() }
}

/// Renormalize sigma scales to keep both sigma and virtual norm in safe ranges
/// Power-of-2 shifts preserve exact price ratios (gauge transformation)
/// O(1) complexity - no loops, no sqrt!
#[inline]
pub fn renormalize_scales(
    sigma_long: &mut u128,
    sigma_short: &mut u128,
    s_long_display: u64,
    s_short_display: u64,
) {
    use crate::content_pool::state::{SIGMA_MIN, SIGMA_MAX, VIRTUAL_NORM_MIN, VIRTUAL_NORM_MAX, Q64};

    // Precomputed squared bounds for O(1) norm check
    const VIRTUAL_NORM_MIN_SQ: u128 = (VIRTUAL_NORM_MIN as u128) * (VIRTUAL_NORM_MIN as u128);
    const VIRTUAL_NORM_MAX_SQ: u128 = (VIRTUAL_NORM_MAX as u128) * (VIRTUAL_NORM_MAX as u128);

    // First enforce sigma bounds [2^48, 2^96] - power-of-two clamp
    let max_sigma = (*sigma_long).max(*sigma_short);
    if max_sigma > SIGMA_MAX {
        let excess_bits = bitlen_u128(max_sigma) - bitlen_u128(SIGMA_MAX);
        *sigma_long >>= excess_bits;
        *sigma_short >>= excess_bits;
    }

    let min_sigma = (*sigma_long).min(*sigma_short);
    if min_sigma < SIGMA_MIN {
        let deficit_bits = bitlen_u128(SIGMA_MIN) - bitlen_u128(min_sigma);
        *sigma_long <<= deficit_bits;
        *sigma_short <<= deficit_bits;
    }

    // Compute virtual supplies with ceil-division ONCE
    let s_long_virtual = if s_long_display > 0 {
        ceil_div(s_long_display as u128 * Q64, *sigma_long).max(1)
    } else {
        0
    };

    let s_short_virtual = if s_short_display > 0 {
        ceil_div(s_short_display as u128 * Q64, *sigma_short).max(1)
    } else {
        0
    };

    // Compute norm_sq (NO sqrt needed!)
    let norm_sq = s_long_virtual
        .saturating_mul(s_long_virtual)
        .saturating_add(s_short_virtual.saturating_mul(s_short_virtual));

    if norm_sq == 0 {
        return; // Both supplies are zero, nothing to normalize
    }

    // ONE-SHOT adjustment based on squared bounds
    if norm_sq < VIRTUAL_NORM_MIN_SQ {
        // Need norm' >= MIN ⇒ multiply norm by 2^k ⇒ norm_sq by 2^(2k)
        // k = ceil((log2(MIN_SQ) - log2(norm_sq)) / 2)
        let need_bits = (bitlen_u128(VIRTUAL_NORM_MIN_SQ) as i32) - (bitlen_u128(norm_sq) as i32);
        let k = ((need_bits + 1) / 2).max(0) as u32;
        *sigma_long >>= k;  // Decreasing σ increases virtuals
        *sigma_short >>= k;
    } else if norm_sq > VIRTUAL_NORM_MAX_SQ {
        // Need norm' <= MAX ⇒ divide norm by 2^k ⇒ norm_sq by 2^(2k)
        let need_bits = (bitlen_u128(norm_sq) as i32) - (bitlen_u128(VIRTUAL_NORM_MAX_SQ) as i32);
        let k = ((need_bits + 1) / 2).max(0) as u32;
        *sigma_long <<= k;  // Increasing σ reduces virtuals
        *sigma_short <<= k;
    }
    // Within bounds - no adjustment needed
}
