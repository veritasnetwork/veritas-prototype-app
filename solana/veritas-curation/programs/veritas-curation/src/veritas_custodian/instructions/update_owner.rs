use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::veritas_custodian::state::{VeritasCustodian, CUSTODIAN_SEED};
use crate::errors::ErrorCode;

/// Transfers ownership of the custodian contract
pub fn update_owner(
    ctx: Context<UpdateOwner>,
    new_owner: Pubkey,
) -> Result<()> {
    let custodian = &mut ctx.accounts.custodian;

    // Validate authority
    require!(ctx.accounts.authority.key() == custodian.owner, ErrorCode::Unauthorized);
    require!(new_owner != Pubkey::default(), ErrorCode::InvalidAuthority);
    require!(new_owner != system_program::ID, ErrorCode::InvalidAuthority);

    let old_owner = custodian.owner;
    custodian.owner = new_owner;

    msg!("Owner updated: old={}, new={}", old_owner, new_owner);
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateOwner<'info> {
    #[account(
        mut,
        seeds = [CUSTODIAN_SEED],
        bump = custodian.bump
    )]
    pub custodian: Account<'info, VeritasCustodian>,

    pub authority: Signer<'info>,
}