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

    config.min_k_quadratic = DEFAULT_MIN_K_QUADRATIC;
    config.max_k_quadratic = DEFAULT_MAX_K_QUADRATIC;
    config.min_trade_amount = DEFAULT_MIN_TRADE_AMOUNT;

    config.reserved = [0; 2]; // Zero-initialized for future use

    msg!("ProtocolConfig initialized");
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 105,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub authority: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}
