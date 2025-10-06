use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::protocol_treasury::state::{ProtocolTreasury, TREASURY_SEED};
use crate::errors::ErrorCode;

/// Creates singleton treasury PDA with USDC vault
pub fn initialize_treasury(
    ctx: Context<InitializeTreasury>,
) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;

    // Validate authority
    require!(ctx.accounts.authority.key() != Pubkey::default(), ErrorCode::InvalidAuthority);
    require!(ctx.accounts.authority.key() != system_program::ID, ErrorCode::InvalidAuthority);

    // Initialize state
    treasury.authority = ctx.accounts.authority.key();
    treasury.usdc_vault = ctx.accounts.usdc_vault.key();
    treasury.bump = ctx.bumps.treasury;

    msg!("ProtocolTreasury initialized with authority={}", ctx.accounts.authority.key());
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 65,
        seeds = [TREASURY_SEED],
        bump
    )]
    pub treasury: Account<'info, ProtocolTreasury>,

    #[account(
        init,
        payer = payer,
        token::mint = usdc_mint,
        token::authority = treasury,
        seeds = [b"treasury_vault"],
        bump,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub authority: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}