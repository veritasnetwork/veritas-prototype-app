use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::veritas_custodian::state::{VeritasCustodian, CUSTODIAN_SEED};
use crate::errors::ErrorCode;

/// Creates singleton custodian PDA with pooled USDC vault
/// Owner field removed - upgrade authority controls governance
pub fn initialize_custodian(
    ctx: Context<InitializeCustodian>,
    protocol_authority: Pubkey,
) -> Result<()> {
    let custodian = &mut ctx.accounts.custodian;

    // Validate authority
    require!(protocol_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
    require!(protocol_authority != system_program::ID, ErrorCode::InvalidAuthority);

    // Initialize state (no owner field)
    custodian.protocol_authority = protocol_authority;
    custodian.usdc_vault = ctx.accounts.usdc_vault.key();
    custodian.total_deposits = 0;
    custodian.total_withdrawals = 0;
    custodian.emergency_pause = false;
    custodian.bump = ctx.bumps.custodian;

    msg!("VeritasCustodian initialized with protocol_authority={}", protocol_authority);
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeCustodian<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + VeritasCustodian::LEN,  // 8 + 98 = 106 bytes
        seeds = [CUSTODIAN_SEED],
        bump
    )]
    pub custodian: Account<'info, VeritasCustodian>,

    #[account(
        init,
        payer = payer,
        token::mint = usdc_mint,
        token::authority = custodian,
        seeds = [b"custodian_vault"],
        bump,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}