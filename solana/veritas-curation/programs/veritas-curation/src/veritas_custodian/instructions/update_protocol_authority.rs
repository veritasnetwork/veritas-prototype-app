use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::veritas_custodian::state::{VeritasCustodian, CUSTODIAN_SEED};
use crate::errors::ErrorCode;

/// Owner updates the protocol authority that can execute withdrawals
pub fn update_protocol_authority(
    ctx: Context<UpdateProtocolAuthority>,
    new_protocol_authority: Pubkey,
) -> Result<()> {
    let custodian = &mut ctx.accounts.custodian;

    // Validate authority
    require!(ctx.accounts.authority.key() == custodian.owner, ErrorCode::Unauthorized);
    require!(new_protocol_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
    require!(new_protocol_authority != system_program::ID, ErrorCode::InvalidAuthority);

    let old_authority = custodian.protocol_authority;
    custodian.protocol_authority = new_protocol_authority;

    msg!("Protocol authority updated: old={}, new={}", old_authority, new_protocol_authority);
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateProtocolAuthority<'info> {
    #[account(
        mut,
        seeds = [CUSTODIAN_SEED],
        bump = custodian.bump
    )]
    pub custodian: Account<'info, VeritasCustodian>,

    pub authority: Signer<'info>,
}