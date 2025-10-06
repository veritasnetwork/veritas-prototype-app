use anchor_lang::prelude::*;

use crate::content_pool::state::ProtocolConfig;
use crate::errors::ErrorCode;

/// Update protocol configuration (authority only)
pub fn update_config(
    ctx: Context<UpdateConfig>,
    default_k_quadratic: Option<u128>,
    default_reserve_cap: Option<u128>,
    min_k_quadratic: Option<u128>,
    max_k_quadratic: Option<u128>,
    min_reserve_cap: Option<u128>,
    max_reserve_cap: Option<u128>,
    min_trade_amount: Option<u64>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    // Validate new bounds if provided
    if let Some(min_k) = min_k_quadratic {
        require!(min_k > 0, ErrorCode::InvalidParameters);
    }
    if let Some(min_cap) = min_reserve_cap {
        require!(min_cap > 0, ErrorCode::InvalidParameters);
    }

    // Check consistency between new and old values
    let final_min_k = min_k_quadratic.unwrap_or(config.min_k_quadratic);
    let final_max_k = max_k_quadratic.unwrap_or(config.max_k_quadratic);
    let final_min_cap = min_reserve_cap.unwrap_or(config.min_reserve_cap);
    let final_max_cap = max_reserve_cap.unwrap_or(config.max_reserve_cap);

    require!(final_max_k >= final_min_k, ErrorCode::InvalidParameters);
    require!(final_max_cap >= final_min_cap, ErrorCode::InvalidParameters);

    // Update only provided values (Option pattern)
    if let Some(val) = default_k_quadratic {
        config.default_k_quadratic = val;
    }
    if let Some(val) = default_reserve_cap {
        config.default_reserve_cap = val;
    }
    if let Some(val) = min_k_quadratic {
        config.min_k_quadratic = val;
    }
    if let Some(val) = max_k_quadratic {
        config.max_k_quadratic = val;
    }
    if let Some(val) = min_reserve_cap {
        config.min_reserve_cap = val;
    }
    if let Some(val) = max_reserve_cap {
        config.max_reserve_cap = val;
    }
    if let Some(val) = min_trade_amount {
        config.min_trade_amount = val;
    }

    msg!("ProtocolConfig updated");
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        constraint = config.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub authority: Signer<'info>,
}
