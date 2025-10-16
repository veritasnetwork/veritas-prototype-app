use anchor_lang::prelude::*;
use crate::errors::ErrorCode;

/// Integer square root using Newton's method
pub fn integer_sqrt(n: u128) -> Result<u128> {
    if n == 0 {
        return Ok(0);
    }

    // Newton's method for integer square root
    // Critical: Use checked operations to prevent overflow
    let mut x = n;
    let mut y = x.checked_add(1)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_div(2)
        .ok_or(ErrorCode::NumericalOverflow)?;

    while y < x {
        x = y;
        // y = (x + n/x) / 2
        let n_div_x = n.checked_div(x)
            .ok_or(ErrorCode::NumericalOverflow)?;
        y = x.checked_add(n_div_x)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(2)
            .ok_or(ErrorCode::NumericalOverflow)?;
    }

    Ok(x)
}

/// Integer cube root using binary search
pub fn integer_cbrt(n: u128) -> Result<u128> {
    if n == 0 {
        return Ok(0);
    }

    // Binary search for cube root
    // We need to handle the full range of u128 values
    // cbrt(u128::MAX) ≈ 6_981_463_658_331 (approximately 7 * 10^12)
    // But we need to be careful about overflow when cubing

    // Start with a good initial upper bound
    // For safety, we'll use a more conservative approach
    let mut lo = 1u128;
    let mut hi = 6_981_463_658_331u128; // cbrt(2^128 - 1)

    // If n is small enough, we can use a tighter bound
    if n < 1_000_000_000_000u128 { // 10^12
        // For smaller numbers, use sqrt as upper bound (cbrt(n) <= sqrt(n) for n >= 1)
        hi = integer_sqrt(n)?;
    }

    while lo <= hi {
        let mid = lo.checked_add(hi)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(2)
            .ok_or(ErrorCode::NumericalOverflow)?;

        // Check if mid^3 would overflow before computing it
        // mid^3 <= u128::MAX means mid <= cbrt(u128::MAX) ≈ 6_981_463_658_331
        if mid > 6_981_463_658_331u128 {
            hi = mid - 1;
            continue;
        }

        let mid_squared = mid
            .checked_mul(mid)
            .ok_or(ErrorCode::NumericalOverflow)?;

        // Check if mid_squared * mid would overflow
        if mid_squared > u128::MAX / mid {
            hi = mid - 1;
            continue;
        }

        let cubed = mid_squared
            .checked_mul(mid)
            .ok_or(ErrorCode::NumericalOverflow)?;

        match cubed.cmp(&n) {
            std::cmp::Ordering::Equal => return Ok(mid),
            std::cmp::Ordering::Less => {
                lo = mid.checked_add(1)
                    .ok_or(ErrorCode::NumericalOverflow)?;
            },
            std::cmp::Ordering::Greater => {
                // Prevent underflow when mid = 0
                if mid == 0 {
                    return Ok(0);
                }
                hi = mid - 1;
            }
        }
    }

    Ok(hi) // Return floor(cbrt(n))
}
