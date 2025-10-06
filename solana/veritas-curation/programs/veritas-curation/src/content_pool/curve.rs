use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::utils::integer_cbrt;
use crate::constants::RATIO_PRECISION;

/// Calculate new token supply after buying with USDC
/// Reserve-based transition with dampened linear region
pub fn calculate_buy_supply(
    s0: u128,
    reserve0: u128,
    usdc_amount: u128,
    reserve_cap: u128,
    k_quadratic: u128,
    linear_slope: u128,
    virtual_liquidity: u128,
) -> Result<u128> {
    let new_reserve = reserve0
        .checked_add(usdc_amount)
        .ok_or(ErrorCode::NumericalOverflow)?;

    if reserve0 >= reserve_cap {
        // Already in linear region - use dampened linear pricing
        // Price = P_transition + slope * (s - s_transition) * (L / (L + s))
        let s_transition = calculate_supply_at_reserve_cap(reserve_cap, k_quadratic)?;
        let price_at_transition = k_quadratic
            .checked_mul(s_transition.checked_pow(2).ok_or(ErrorCode::NumericalOverflow)?)
            .ok_or(ErrorCode::NumericalOverflow)?;

        // We need to integrate to find the new supply
        // This requires solving: ∫ P(s) ds = usdc_amount
        // For dampened linear, this is complex, so we'll use numerical approximation

        // Start with an estimate using average dampening
        let avg_supply = s0.checked_add(s_transition).ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(2).ok_or(ErrorCode::NumericalOverflow)?;
        let dampening = virtual_liquidity
            .checked_mul(RATIO_PRECISION).ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(virtual_liquidity.checked_add(avg_supply).ok_or(ErrorCode::NumericalOverflow)?)
            .ok_or(ErrorCode::NumericalOverflow)?;

        // Estimate average price in the linear region
        let supply_above_transition = if s0 > s_transition {
            s0.checked_sub(s_transition).ok_or(ErrorCode::NumericalOverflow)?
        } else {
            0
        };

        let avg_price = price_at_transition
            .checked_add(
                linear_slope
                    .checked_mul(supply_above_transition).ok_or(ErrorCode::NumericalOverflow)?
                    .checked_mul(dampening).ok_or(ErrorCode::NumericalOverflow)?
                    .checked_div(RATIO_PRECISION).ok_or(ErrorCode::NumericalOverflow)?
                    .checked_div(2).ok_or(ErrorCode::NumericalOverflow)?
            ).ok_or(ErrorCode::NumericalOverflow)?;

        // Estimate tokens to mint
        let tokens_to_mint = usdc_amount
            .checked_mul(RATIO_PRECISION).ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(avg_price).ok_or(ErrorCode::NumericalOverflow)?;

        s0.checked_add(tokens_to_mint).ok_or(ErrorCode::NumericalOverflow.into())

    } else if new_reserve <= reserve_cap {
        // Entirely in quadratic region
        // Use standard cubic formula: reserve = k * s^3 / 3
        // s1 = cbrt(3 * new_reserve / k)
        let term = new_reserve
            .checked_mul(3)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(k_quadratic)
            .ok_or(ErrorCode::NumericalOverflow)?;

        integer_cbrt(term)

    } else {
        // Crossing from quadratic to linear
        // First calculate how much USDC takes us to reserve_cap
        let usdc_to_cap = reserve_cap
            .checked_sub(reserve0)
            .ok_or(ErrorCode::NumericalOverflow)?;
        let usdc_in_linear = usdc_amount
            .checked_sub(usdc_to_cap)
            .ok_or(ErrorCode::NumericalOverflow)?;

        // Calculate supply at transition point
        let s_transition = calculate_supply_at_reserve_cap(reserve_cap, k_quadratic)?;
        let price_at_transition = k_quadratic
            .checked_mul(s_transition.checked_pow(2).ok_or(ErrorCode::NumericalOverflow)?)
            .ok_or(ErrorCode::NumericalOverflow)?;

        // For the linear portion, use dampened pricing
        // Initial dampening at transition
        let dampening_at_transition = virtual_liquidity
            .checked_mul(RATIO_PRECISION).ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(virtual_liquidity.checked_add(s_transition).ok_or(ErrorCode::NumericalOverflow)?)
            .ok_or(ErrorCode::NumericalOverflow)?;

        // Approximate using average price in linear region with dampening
        let initial_price = price_at_transition;

        // Estimate final supply using average dampening
        let estimated_tokens = usdc_in_linear
            .checked_mul(RATIO_PRECISION).ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(initial_price).ok_or(ErrorCode::NumericalOverflow)?
            .checked_mul(dampening_at_transition).ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(RATIO_PRECISION).ok_or(ErrorCode::NumericalOverflow)?;

        s_transition.checked_add(estimated_tokens).ok_or(ErrorCode::NumericalOverflow.into())
    }
}

/// Calculate USDC payout for selling tokens
pub fn calculate_sell_payout(
    s0: u128,
    s1: u128,
    reserve0: u128,
    reserve_cap: u128,
    k_quadratic: u128,
    linear_slope: u128,
    virtual_liquidity: u128,
) -> Result<u128> {
    if s1 >= s0 {
        return Err(ErrorCode::InvalidAmount.into());
    }

    // Calculate the supply at reserve cap transition
    let s_transition = calculate_supply_at_reserve_cap(reserve_cap, k_quadratic)?;

    if s1 >= s_transition && reserve0 >= reserve_cap {
        // Entirely in linear region with dampening
        let tokens_to_sell = s0.checked_sub(s1).ok_or(ErrorCode::NumericalOverflow)?;
        let price_at_transition = k_quadratic
            .checked_mul(s_transition.checked_pow(2).ok_or(ErrorCode::NumericalOverflow)?)
            .ok_or(ErrorCode::NumericalOverflow)?;

        // Calculate average dampening over the sell range
        let avg_supply = s0.checked_add(s1).ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(2).ok_or(ErrorCode::NumericalOverflow)?;
        let dampening = virtual_liquidity
            .checked_mul(RATIO_PRECISION).ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(virtual_liquidity.checked_add(avg_supply).ok_or(ErrorCode::NumericalOverflow)?)
            .ok_or(ErrorCode::NumericalOverflow)?;

        // Calculate average distance from transition
        let avg_distance = avg_supply.checked_sub(s_transition).ok_or(ErrorCode::NumericalOverflow)?;

        // Average price in the linear region with dampening
        let avg_price = price_at_transition
            .checked_add(
                linear_slope
                    .checked_mul(avg_distance).ok_or(ErrorCode::NumericalOverflow)?
                    .checked_mul(dampening).ok_or(ErrorCode::NumericalOverflow)?
                    .checked_div(RATIO_PRECISION).ok_or(ErrorCode::NumericalOverflow)?
            ).ok_or(ErrorCode::NumericalOverflow)?;

        // payout = tokens * average_price
        tokens_to_sell
            .checked_mul(avg_price)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(RATIO_PRECISION) // Scale back from precision
            .ok_or(ErrorCode::NumericalOverflow.into())

    } else if s0 <= s_transition {
        // Entirely in quadratic region
        // payout = k * (s0^3 - s1^3) / 3
        let s0_cubed = s0.checked_pow(3).ok_or(ErrorCode::NumericalOverflow)?;
        let s1_cubed = s1.checked_pow(3).ok_or(ErrorCode::NumericalOverflow)?;
        let diff = s0_cubed.checked_sub(s1_cubed).ok_or(ErrorCode::NumericalOverflow)?;

        diff.checked_mul(k_quadratic)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(3)
            .ok_or(ErrorCode::NumericalOverflow.into())

    } else {
        // Crossing from linear to quadratic
        // Calculate payout from linear portion with dampening
        let tokens_in_linear = s0.checked_sub(s_transition).ok_or(ErrorCode::NumericalOverflow)?;
        let price_at_transition = k_quadratic
            .checked_mul(s_transition.checked_pow(2).ok_or(ErrorCode::NumericalOverflow)?)
            .ok_or(ErrorCode::NumericalOverflow)?;

        // Average supply in linear portion
        let avg_supply_linear = s0.checked_add(s_transition).ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(2).ok_or(ErrorCode::NumericalOverflow)?;
        let dampening = virtual_liquidity
            .checked_mul(RATIO_PRECISION).ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(virtual_liquidity.checked_add(avg_supply_linear).ok_or(ErrorCode::NumericalOverflow)?)
            .ok_or(ErrorCode::NumericalOverflow)?;

        // Average distance from transition in linear portion
        let avg_distance = tokens_in_linear.checked_div(2).ok_or(ErrorCode::NumericalOverflow)?;

        // Average price with dampening
        let avg_price_linear = price_at_transition
            .checked_add(
                linear_slope
                    .checked_mul(avg_distance).ok_or(ErrorCode::NumericalOverflow)?
                    .checked_mul(dampening).ok_or(ErrorCode::NumericalOverflow)?
                    .checked_div(RATIO_PRECISION).ok_or(ErrorCode::NumericalOverflow)?
            ).ok_or(ErrorCode::NumericalOverflow)?;

        let linear_payout = tokens_in_linear
            .checked_mul(avg_price_linear)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(RATIO_PRECISION) // Scale back
            .ok_or(ErrorCode::NumericalOverflow)?;

        // Calculate payout from quadratic portion (from s_transition down to s1)
        let s_trans_cubed = s_transition.checked_pow(3).ok_or(ErrorCode::NumericalOverflow)?;
        let s1_cubed = s1.checked_pow(3).ok_or(ErrorCode::NumericalOverflow)?;
        let quad_diff = s_trans_cubed.checked_sub(s1_cubed).ok_or(ErrorCode::NumericalOverflow)?;

        let quad_payout = quad_diff
            .checked_mul(k_quadratic)
            .ok_or(ErrorCode::NumericalOverflow)?
            .checked_div(3)
            .ok_or(ErrorCode::NumericalOverflow)?;

        linear_payout.checked_add(quad_payout).ok_or(ErrorCode::NumericalOverflow.into())
    }
}

/// Calculate the token supply at the reserve cap transition point
fn calculate_supply_at_reserve_cap(reserve_cap: u128, k_quadratic: u128) -> Result<u128> {
    // At transition: reserve_cap = k * s^3 / 3
    // So: s = cbrt(3 * reserve_cap / k)
    let term = reserve_cap
        .checked_mul(3)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_div(k_quadratic)
        .ok_or(ErrorCode::NumericalOverflow)?;

    integer_cbrt(term)
}