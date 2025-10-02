use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::veritas_custodian::state::{
    VeritasCustodian, DepositEvent,
    CUSTODIAN_SEED, MIN_DEPOSIT
};
use crate::errors::ErrorCode;

/// Anyone can deposit USDC into the protocol pool
pub fn deposit(
    ctx: Context<Deposit>,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(amount >= MIN_DEPOSIT, ErrorCode::BelowMinimum);

    let custodian = &mut ctx.accounts.custodian;

    // Transfer USDC from depositor to pool
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.depositor_usdc_account.to_account_info(),
            to: ctx.accounts.custodian_usdc_vault.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, amount)?;

    // Track total deposits
    custodian.total_deposits = custodian.total_deposits
        .checked_add(amount as u128)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Emit event for off-chain indexing
    emit!(DepositEvent {
        depositor: ctx.accounts.depositor.key(),
        amount,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("Deposit: user={}, amount={}", ctx.accounts.depositor.key(), amount);
    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [CUSTODIAN_SEED],
        bump = custodian.bump
    )]
    pub custodian: Account<'info, VeritasCustodian>,

    #[account(
        mut,
        constraint = custodian_usdc_vault.key() == custodian.usdc_vault @ ErrorCode::InvalidVault
    )]
    pub custodian_usdc_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub depositor_usdc_account: Account<'info, TokenAccount>,

    pub depositor: Signer<'info>,
    pub token_program: Program<'info, Token>,
}