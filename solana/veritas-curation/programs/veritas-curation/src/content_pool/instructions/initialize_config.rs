use anchor_lang::prelude::*;

use crate::content_pool::state::ProtocolConfig;
use crate::constants::*;

/// Initialize protocol configuration (one-time setup)
pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
    let config = &mut ctx.accounts.config;

    // Initialize with default values
    config.authority = ctx.accounts.authority.key();
    config.bump = ctx.bumps.config;

    config.default_k_quadratic = DEFAULT_K_QUADRATIC;
    config.default_reserve_cap = DEFAULT_RESERVE_CAP;
    config.default_linear_slope = DEFAULT_LINEAR_SLOPE;
    config.default_virtual_liquidity = DEFAULT_VIRTUAL_LIQUIDITY;

    config.min_k_quadratic = DEFAULT_MIN_K_QUADRATIC;
    config.max_k_quadratic = DEFAULT_MAX_K_QUADRATIC;
    config.min_reserve_cap = DEFAULT_MIN_RESERVE_CAP;
    config.max_reserve_cap = DEFAULT_MAX_RESERVE_CAP;
    config.min_linear_slope = DEFAULT_MIN_LINEAR_SLOPE;
    config.max_linear_slope = DEFAULT_MAX_LINEAR_SLOPE;
    config.min_trade_amount = DEFAULT_MIN_TRADE_AMOUNT;

    config.reserved = [0; 4]; // Zero-initialized for future use

    msg!("ProtocolConfig initialized");
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 233,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub authority: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}
