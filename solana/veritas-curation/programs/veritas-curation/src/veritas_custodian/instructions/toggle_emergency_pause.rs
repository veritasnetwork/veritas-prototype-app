use anchor_lang::prelude::*;

use crate::veritas_custodian::state::{VeritasCustodian, CUSTODIAN_SEED};
use crate::errors::ErrorCode;

/// Owner toggles emergency pause to halt withdrawals
pub fn toggle_emergency_pause(
    ctx: Context<ToggleEmergencyPause>,
    paused: bool,
) -> Result<()> {
    let custodian = &mut ctx.accounts.custodian;

    // Validate authority
    require!(ctx.accounts.authority.key() == custodian.owner, ErrorCode::Unauthorized);

    let old_state = custodian.emergency_pause;
    custodian.emergency_pause = paused;

    msg!("Emergency pause toggled: old={}, new={}", old_state, paused);
    Ok(())
}

#[derive(Accounts)]
pub struct ToggleEmergencyPause<'info> {
    #[account(
        mut,
        seeds = [CUSTODIAN_SEED],
        bump = custodian.bump
    )]
    pub custodian: Account<'info, VeritasCustodian>,

    pub authority: Signer<'info>,
}
