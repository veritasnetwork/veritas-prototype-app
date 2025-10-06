use anchor_lang::prelude::*;

use crate::content_pool::state::{ContentPool, ProtocolConfig};
use crate::pool_factory::state::PoolFactory;
use crate::constants::*;
use crate::errors::ErrorCode;

/// Adjust the reserve transition point between quadratic and linear curve regions
pub fn set_reserve_cap(
    ctx: Context<SetReserveCap>,
    new_reserve_cap: u128,
) -> Result<()> {
    // Validate authority via PoolFactory
    let pool = &ctx.accounts.pool;
    let factory = &ctx.accounts.factory;
    require!(pool.factory == factory.key(), ErrorCode::InvalidFactory);
    require!(ctx.accounts.authority.key() == factory.pool_authority, ErrorCode::Unauthorized);

    let pool = &mut ctx.accounts.pool;

    // Load config (may not exist - use defaults)
    let config = ctx.accounts.config.as_ref();
    let min_cap = config.map_or(DEFAULT_MIN_RESERVE_CAP, |c| c.min_reserve_cap);

    require!(new_reserve_cap >= min_cap, ErrorCode::InvalidParameters);

    // Update reserve_cap - transitions to linear when reserve reaches this amount
    pool.reserve_cap = new_reserve_cap;

    msg!("Reserve cap updated: new_reserve_cap={}", new_reserve_cap);
    Ok(())
}

#[derive(Accounts)]
pub struct SetReserveCap<'info> {
    #[account(
        mut,
        seeds = [b"pool", pool.post_id.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(
        seeds = [b"factory"],
        bump = factory.bump
    )]
    pub factory: Account<'info, PoolFactory>,

    // Optional: May not exist
    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Option<Account<'info, ProtocolConfig>>,

    pub authority: Signer<'info>,
}
