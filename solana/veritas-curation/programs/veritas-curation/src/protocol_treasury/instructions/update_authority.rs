use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::protocol_treasury::state::{ProtocolTreasury, TREASURY_SEED};
use crate::errors::ErrorCode;

/// Updates treasury authority for management
pub fn update_treasury_authority(
    ctx: Context<UpdateTreasuryAuthority>,
    new_authority: Pubkey,
) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;

    // Validate authority
    require!(ctx.accounts.authority.key() == treasury.authority, ErrorCode::Unauthorized);
    require!(new_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
    require!(new_authority != system_program::ID, ErrorCode::InvalidAuthority);

    let old_authority = treasury.authority;
    treasury.authority = new_authority;

    msg!("Treasury authority updated: old={}, new={}", old_authority, new_authority);
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateTreasuryAuthority<'info> {
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, ProtocolTreasury>,

    pub authority: Signer<'info>,
}