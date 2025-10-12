use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::utils::integer_cbrt;
use crate::constants::{RATIO_PRECISION, PRICE_FLOOR};

/// Calculate new token supply after buying with USDC
/// Pure quadratic bonding curve with price floor
pub fn calculate_buy_supply(
    s0: u128,
    reserve0: u128,
    usdc_amount: u128,
    k_quadratic: u128,
) -> Result<u128> {
    let new_reserve = reserve0
        .checked_add(usdc_amount)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Standard quadratic calculation
    // Use reserve-based formula: reserve = k * s^3 / 3
    // Solving for s: s = cbrt(3 * reserve / k)
    let term = new_reserve
        .checked_mul(3)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_div(k_quadratic)
        .ok_or(ErrorCode::NumericalOverflow)?;

    let new_supply = integer_cbrt(term)?;

    // Enforce price floor by checking if we're below the floor threshold
    // Floor threshold is where k * s^2 = PRICE_FLOOR, so s_floor = sqrt(PRICE_FLOOR / k)
    // For k=1, PRICE_FLOOR=100: s_floor = 10
    let s_floor_squared = PRICE_FLOOR.checked_div(k_quadratic).ok_or(ErrorCode::NumericalOverflow)?;

    if new_supply.checked_pow(2).ok_or(ErrorCode::NumericalOverflow)? < s_floor_squared {
        // We're below floor - calculate tokens at floor price
        // tokens = usdc_amount / floor_price
        return usdc_amount
            .checked_mul(RATIO_PRECISION).ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(PRICE_FLOOR)
            .ok_or(ErrorCode::NumericalOverflow.into());
    }

    Ok(new_supply)
}

/// Calculate USDC payout for selling tokens
pub fn calculate_sell_payout(
    s0: u128,
    s1: u128,
    _reserve0: u128,
    k_quadratic: u128,
) -> Result<u128> {
    if s1 >= s0 {
        return Err(ErrorCode::InvalidAmount.into());
    }

    let tokens_to_sell = s0.checked_sub(s1).ok_or(ErrorCode::NumericalOverflow)?;

    // If selling down to 0, use price floor for portion below floor threshold
    if s1 == 0 {
        let price_at_s0 = calculate_price_with_floor(s0, k_quadratic)?;
        if price_at_s0 <= PRICE_FLOOR {
            // All tokens sold at price floor
            return tokens_to_sell
                .checked_mul(PRICE_FLOOR)
                .ok_or(ErrorCode::NumericalOverflow)?
                .checked_div(RATIO_PRECISION)
                .ok_or(ErrorCode::NumericalOverflow.into());
        }
        // Some sold at curve price, some at floor
        // Use average for approximation
        let avg_price = price_at_s0.checked_add(PRICE_FLOOR).ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(2).ok_or(ErrorCode::NumericalOverflow)?;
        return tokens_to_sell
            .checked_mul(avg_price)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(RATIO_PRECISION)
            .ok_or(ErrorCode::NumericalOverflow.into());
    }

    // Standard quadratic calculation
    // payout = k * (s0^3 - s1^3) / 3
    let s0_cubed = s0.checked_pow(3).ok_or(ErrorCode::NumericalOverflow)?;
    let s1_cubed = s1.checked_pow(3).ok_or(ErrorCode::NumericalOverflow)?;
    let diff = s0_cubed.checked_sub(s1_cubed).ok_or(ErrorCode::NumericalOverflow)?;

    diff.checked_mul(k_quadratic)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_div(3)
        .ok_or(ErrorCode::NumericalOverflow.into())
}

/// Calculate price with price floor enforced
fn calculate_price_with_floor(supply: u128, k_quadratic: u128) -> Result<u128> {
    // Price = max(PRICE_FLOOR, k * s^2)
    let curve_price = k_quadratic
        .checked_mul(supply.checked_pow(2).ok_or(ErrorCode::NumericalOverflow)?)
        .ok_or(ErrorCode::NumericalOverflow)?;

    Ok(curve_price.max(PRICE_FLOOR))
}