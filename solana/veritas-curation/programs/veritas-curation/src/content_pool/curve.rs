use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::utils::{integer_sqrt, integer_cbrt};
use crate::content_pool::state::ContentPool;

/// Get k_linear (derived from k_quadratic and supply_cap)
pub fn get_k_linear(pool: &ContentPool) -> Result<u128> {
    // k_linear = k_quadratic × supply_cap (maintains continuity)
    pool.k_quadratic
        .checked_mul(pool.supply_cap)
        .ok_or(ErrorCode::NumericalOverflow.into())
}

/// Calculate new supply after buying with USDC
pub fn calculate_buy_supply(
    s0: u128,
    usdc_amount: u128,
    supply_cap: u128,
    k_quad: u128,
    k_linear: u128,
) -> Result<u128> {
    if s0 >= supply_cap {
        // Case C: Fully in linear region
        // Solve: (k_linear / 2) * (s1² - s0²) = usdc_amount
        let numerator = usdc_amount
            .checked_mul(2)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let term = numerator
            .checked_div(k_linear)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let s0_squared = s0
            .checked_pow(2)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let s1_squared = s0_squared
            .checked_add(term)
            .ok_or(ErrorCode::NumericalOverflow)?;

        // Integer square root
        let s1 = integer_sqrt(s1_squared)?;
        Ok(s1)
    } else {
        // Calculate cost to reach supply_cap
        let s_cap_cubed = supply_cap
            .checked_pow(3)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let s0_cubed = s0
            .checked_pow(3)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let quadratic_cost = s_cap_cubed
            .checked_sub(s0_cubed)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_mul(k_quad)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(3)
            .ok_or(ErrorCode::NumericalOverflow)?;

        if usdc_amount <= quadratic_cost {
            // Case A: Fully in quadratic region
            // Solve: (k_quad / 3) * (s1³ - s0³) = usdc_amount
            let numerator = usdc_amount
                .checked_mul(3)
                .ok_or(ErrorCode::NumericalOverflow)?;
            let term = numerator
                .checked_div(k_quad)
                .ok_or(ErrorCode::NumericalOverflow)?;
            let s1_cubed = s0_cubed
                .checked_add(term)
                .ok_or(ErrorCode::NumericalOverflow)?;

            // Integer cube root
            let s1 = integer_cbrt(s1_cubed)?;
            Ok(s1)
        } else {
            // Case B: Crossing boundary
            let remaining_cost = usdc_amount
                .checked_sub(quadratic_cost)
                .ok_or(ErrorCode::NumericalOverflow)?;

            // Solve linear portion
            let numerator = remaining_cost
                .checked_mul(2)
                .ok_or(ErrorCode::NumericalOverflow)?;
            let term = numerator
                .checked_div(k_linear)
                .ok_or(ErrorCode::NumericalOverflow)?;
            let s_cap_squared = supply_cap
                .checked_pow(2)
                .ok_or(ErrorCode::NumericalOverflow)?;
            let s1_squared = s_cap_squared
                .checked_add(term)
                .ok_or(ErrorCode::NumericalOverflow)?;

            let s1 = integer_sqrt(s1_squared)?;
            Ok(s1)
        }
    }
}

/// Calculate USDC payout for selling tokens
pub fn calculate_sell_payout(
    s0: u128,
    s1: u128,
    supply_cap: u128,
    k_quad: u128,
    k_linear: u128,
) -> Result<u128> {
    if s1 >= supply_cap {
        // Case A: Fully in linear region
        // payout = (k_linear / 2) * (s0² - s1²)
        let s0_squared = s0
            .checked_pow(2)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let s1_squared = s1
            .checked_pow(2)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let diff = s0_squared
            .checked_sub(s1_squared)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let payout = diff
            .checked_mul(k_linear)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(2)
            .ok_or(ErrorCode::NumericalOverflow)?;
        Ok(payout)
    } else if s0 <= supply_cap {
        // Case C: Fully in quadratic region
        // payout = (k_quad / 3) * (s0³ - s1³)
        let s0_cubed = s0
            .checked_pow(3)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let s1_cubed = s1
            .checked_pow(3)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let diff = s0_cubed
            .checked_sub(s1_cubed)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let payout = diff
            .checked_mul(k_quad)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(3)
            .ok_or(ErrorCode::NumericalOverflow)?;
        Ok(payout)
    } else {
        // Case B: Crossing boundary
        // Linear portion: (k_linear / 2) * (s0² - supply_cap²)
        let s0_squared = s0
            .checked_pow(2)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let s_cap_squared = supply_cap
            .checked_pow(2)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let linear_diff = s0_squared
            .checked_sub(s_cap_squared)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let linear_payout = linear_diff
            .checked_mul(k_linear)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(2)
            .ok_or(ErrorCode::NumericalOverflow)?;

        // Quadratic portion: (k_quad / 3) * (supply_cap³ - s1³)
        let s_cap_cubed = supply_cap
            .checked_pow(3)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let s1_cubed = s1
            .checked_pow(3)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let quad_diff = s_cap_cubed
            .checked_sub(s1_cubed)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let quad_payout = quad_diff
            .checked_mul(k_quad)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(3)
            .ok_or(ErrorCode::NumericalOverflow)?;

        let total_payout = linear_payout
            .checked_add(quad_payout)
            .ok_or(ErrorCode::NumericalOverflow)?;
        Ok(total_payout)
    }
}
