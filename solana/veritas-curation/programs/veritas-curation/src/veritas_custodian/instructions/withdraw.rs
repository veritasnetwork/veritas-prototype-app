use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::veritas_custodian::state::{
    VeritasCustodian, WithdrawEvent,
    CUSTODIAN_SEED
};
use crate::errors::ErrorCode;

/// Protocol authority withdraws USDC on behalf of a user
pub fn withdraw(
    ctx: Context<Withdraw>,
    amount: u64,
    recipient: Pubkey,
) -> Result<()> {
    let custodian = &mut ctx.accounts.custodian;

    // Emergency pause check
    require!(!custodian.emergency_pause, ErrorCode::SystemPaused);

    // Only protocol authority can withdraw
    require!(
        ctx.accounts.authority.key() == custodian.protocol_authority,
        ErrorCode::Unauthorized
    );

    require!(amount > 0, ErrorCode::InvalidAmount);

    // Verify vault has sufficient USDC
    require!(
        amount <= ctx.accounts.custodian_usdc_vault.amount,
        ErrorCode::InsufficientVaultBalance
    );

    // Track total withdrawals
    custodian.total_withdrawals = custodian.total_withdrawals
        .checked_add(amount as u128)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Transfer USDC from pool to recipient
    let seeds = &[
        CUSTODIAN_SEED,
        &[custodian.bump],
    ];
    let signer = &[&seeds[..]];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.custodian_usdc_vault.to_account_info(),
            to: ctx.accounts.recipient_usdc_account.to_account_info(),
            authority: custodian.to_account_info(),
        },
        signer,
    );
    token::transfer(transfer_ctx, amount)?;

    // Emit event for off-chain tracking
    emit!(WithdrawEvent {
        recipient,
        amount,
        authority: ctx.accounts.authority.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("Withdrawal: recipient={}, amount={}", recipient, amount);
    Ok(())
}

#[derive(Accounts)]
#[instruction(amount: u64, recipient: Pubkey)]
pub struct Withdraw<'info> {
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

    #[account(
        mut,
        constraint = recipient_usdc_account.owner == recipient @ ErrorCode::InvalidRecipient,
        constraint = recipient_usdc_account.mint == custodian_usdc_vault.mint @ ErrorCode::InvalidMint
    )]
    pub recipient_usdc_account: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}