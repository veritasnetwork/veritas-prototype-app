use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::veritas_custodian::state::{VeritasCustodian, CUSTODIAN_SEED};
use crate::errors::ErrorCode;
use crate::program::VeritasCuration;

/// Upgrade authority updates the protocol authority that can execute withdrawals
/// Only callable by upgrade authority (governance)
pub fn update_protocol_authority(
    ctx: Context<UpdateCustodianProtocolAuthority>,
    new_protocol_authority: Pubkey,
) -> Result<()> {
    // Validate upgrade authority
    let program_data_bytes = ctx.accounts.program_data.try_borrow_data()?;
    if program_data_bytes.len() < 45 {
        return Err(ErrorCode::InvalidProgramData.into());
    }

    // Deserialize: first 4 bytes = discriminator, next 8 = slot, next 1 = Option tag, next 32 = Pubkey
    let upgrade_authority_option = if program_data_bytes[12] == 0 {
        None
    } else {
        let mut pubkey_bytes = [0u8; 32];
        pubkey_bytes.copy_from_slice(&program_data_bytes[13..45]);
        Some(Pubkey::new_from_array(pubkey_bytes))
    };

    require!(
        upgrade_authority_option == Some(ctx.accounts.upgrade_authority.key()),
        ErrorCode::InvalidUpgradeAuthority
    );

    let custodian = &mut ctx.accounts.custodian;

    // Validate new authority
    require!(new_protocol_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
    require!(new_protocol_authority != system_program::ID, ErrorCode::InvalidAuthority);

    let old_authority = custodian.protocol_authority;
    custodian.protocol_authority = new_protocol_authority;

    msg!("Protocol authority updated: old={}, new={}", old_authority, new_protocol_authority);
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateCustodianProtocolAuthority<'info> {
    #[account(
        mut,
        seeds = [CUSTODIAN_SEED],
        bump = custodian.bump
    )]
    pub custodian: Account<'info, VeritasCustodian>,

    pub upgrade_authority: Signer<'info>,

    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, VeritasCuration>,

    /// CHECK: Program data account validated in handler
    pub program_data: AccountInfo<'info>,
}