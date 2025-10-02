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
    // Critical: Bound hi to prevent overflow in cubing
    let mut lo = 1u128;
    let mut hi = n.min(2_097_151); // cbrt(u128::MAX) ≈ 2^42

    while lo <= hi {
        let mid = lo.checked_add(hi)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(2)
            .ok_or(ErrorCode::NumericalOverflow)?;

        let mid_squared = mid
            .checked_mul(mid)
            .ok_or(ErrorCode::NumericalOverflow)?;
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
