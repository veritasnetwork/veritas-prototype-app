use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, CloseAccount};
use crate::pool_factory::state::PoolFactory;
use crate::content_pool::{
    state::ContentPool,
    events::PoolClosedEvent,
    errors::ContentPoolError,
};

#[derive(Accounts)]
pub struct ClosePool<'info> {
    #[account(
        mut,
        close = creator,
        seeds = [b"content_pool", pool.content_id.as_ref()],
        bump = pool.bump,
        constraint = pool.creator == creator.key() @ ContentPoolError::Unauthorized
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(
        constraint = factory.key() == pool.factory @ ContentPoolError::InvalidFactory
    )]
    pub factory: Account<'info, PoolFactory>,

    #[account(
        mut,
        constraint = vault.key() == pool.vault @ ContentPoolError::InvalidVault
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator_usdc: Account<'info, TokenAccount>,

    /// CHECK: Creator receiving lamports
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        constraint = protocol_authority.key() == factory.pool_authority @ ContentPoolError::UnauthorizedProtocol
    )]
    pub protocol_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClosePool>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let clock = Clock::get()?;

    // Can only close if no tokens are in circulation
    // This is simplified - in production you'd check total supply
    require!(
        pool.s_long == 0 && pool.s_short == 0,
        ContentPoolError::PositionsStillOpen
    );

    let pool_seeds = &[
        b"content_pool",
        pool.content_id.as_ref(),
        &[pool.bump],
    ];

    // Transfer any remaining USDC to creator
    let remaining_usdc = ctx.accounts.vault.amount;
    if remaining_usdc > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.creator_usdc.to_account_info(),
                    authority: pool.to_account_info(),
                },
                &[pool_seeds],
            ),
            remaining_usdc,
        )?;
    }

    // Close the vault account
    token::close_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.vault.to_account_info(),
                destination: ctx.accounts.creator.to_account_info(),
                authority: pool.to_account_info(),
            },
            &[pool_seeds],
        ),
    )?;

    // Emit event
    emit!(PoolClosedEvent {
        pool: pool.key(),
        creator: ctx.accounts.creator.key(),
        remaining_usdc,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}