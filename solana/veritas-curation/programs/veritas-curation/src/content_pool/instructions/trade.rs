use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn},
};
use crate::pool_factory::state::PoolFactory;
use crate::content_pool::{
    state::*,
    events::TradeEvent,
    errors::ContentPoolError,
    curve::ICBSCurve,
};

#[derive(Accounts)]
pub struct Trade<'info> {
    #[account(
        mut,
        seeds = [b"content_pool", pool.content_id.as_ref()],
        bump = pool.bump,
        constraint = pool.market_deployer != Pubkey::default() @ ContentPoolError::MarketNotDeployed
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(mut)]
    pub factory: Account<'info, PoolFactory>,

    #[account(mut)]
    pub trader_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault.key() == pool.vault @ ContentPoolError::InvalidVault
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = stake_vault.key() == pool.stake_vault @ ContentPoolError::InvalidStakeVault
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = trader
    )]
    pub trader_tokens: Account<'info, TokenAccount>,

    #[account(mut)]
    pub token_mint: Account<'info, Mint>,

    pub usdc_mint: Account<'info, Mint>,

    pub trader: Signer<'info>,

    #[account(
        constraint = protocol_authority.key() == factory.pool_authority @ ContentPoolError::UnauthorizedProtocol
    )]
    pub protocol_authority: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Trade>,
    side: TokenSide,
    trade_type: TradeType,
    amount: u64,
    stake_skim: u64,
    min_tokens_out: u64,
    min_usdc_out: u64,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let pool_key = pool.key();
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    // Apply decay if needed (before any trade logic)
    crate::content_pool::decay::apply_decay_if_needed(pool, pool_key, current_time)?;

    // ===== CAPTURE STATE BEFORE TRADE =====
    let s_long_before = pool.s_long;
    let s_short_before = pool.s_short;
    let sqrt_price_long_x96_before = pool.sqrt_price_long_x96;
    let sqrt_price_short_x96_before = pool.sqrt_price_short_x96;

    // Validate trade size (different minimums for buy vs sell)
    match trade_type {
        TradeType::Buy => {
            require!(
                amount >= MIN_TRADE_SIZE && amount <= MAX_TRADE_SIZE,
                ContentPoolError::InvalidTradeAmount
            );
        }
        TradeType::Sell => {
            require!(
                amount >= MIN_TOKEN_TRADE_SIZE,
                ContentPoolError::InvalidTradeAmount
            );
        }
    }

    // Validate correct mint
    let expected_mint = match side {
        TokenSide::Long => pool.long_mint,
        TokenSide::Short => pool.short_mint,
    };
    require!(
        ctx.accounts.token_mint.key() == expected_mint,
        ContentPoolError::InvalidMint
    );

    let pool_seeds = &[
        b"content_pool",
        pool.content_id.as_ref(),
        &[pool.bump],
    ];

    match trade_type {
        TradeType::Buy => {
            // Validate stake skim
            require!(
                stake_skim <= amount,
                ContentPoolError::InvalidStakeSkim
            );

            let usdc_to_trade = amount
                .checked_sub(stake_skim)
                .ok_or(ContentPoolError::InvalidStakeSkim)?;

            // Transfer stake skim to stake vault
            if stake_skim > 0 {
                token::transfer(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.trader_usdc.to_account_info(),
                            to: ctx.accounts.stake_vault.to_account_info(),
                            authority: ctx.accounts.trader.to_account_info(),
                        },
                    ),
                    stake_skim,
                )?;
            }

            // Transfer trade amount to pool vault
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.trader_usdc.to_account_info(),
                        to: ctx.accounts.vault.to_account_info(),
                        authority: ctx.accounts.trader.to_account_info(),
                    },
                ),
                usdc_to_trade,
            )?;

            // Calculate tokens out
            let (tokens_out, new_sqrt_price) = match side {
                TokenSide::Long => {
                    ICBSCurve::calculate_buy(
                        pool.s_long,
                        usdc_to_trade,
                        pool.sqrt_lambda_long_x96,
                        pool.s_short,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                        true,
                    )?
                }
                TokenSide::Short => {
                    ICBSCurve::calculate_buy(
                        pool.s_short,
                        usdc_to_trade,
                        pool.sqrt_lambda_short_x96,
                        pool.s_long,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                        false,
                    )?
                }
            };

            // Check slippage
            require!(
                tokens_out >= min_tokens_out,
                ContentPoolError::SlippageExceeded
            );

            // Mint tokens to trader
            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.token_mint.to_account_info(),
                        to: ctx.accounts.trader_tokens.to_account_info(),
                        authority: pool.to_account_info(),
                    },
                    &[pool_seeds],
                ),
                tokens_out,
            )?;

            // Update pool state
            match side {
                TokenSide::Long => {
                    let new_supply = pool.s_long
                        .checked_add(tokens_out)
                        .ok_or(ContentPoolError::SupplyOverflow)?;

                    // Validate against maximum safe supply
                    require!(
                        new_supply <= MAX_SAFE_SUPPLY,
                        ContentPoolError::SupplyOverflow
                    );

                    pool.s_long = new_supply;
                    pool.sqrt_price_long_x96 = new_sqrt_price;
                    // Update virtual reserve: R_L = s_L × p_L
                    pool.r_long = ICBSCurve::virtual_reserves(pool.s_long, pool.sqrt_price_long_x96)?;

                    // Recalculate SHORT price due to inverse coupling
                    // p_S depends on both s_L and s_S through the denominator √(s_L² + s_S²)
                    pool.sqrt_price_short_x96 = ICBSCurve::sqrt_marginal_price(
                        pool.s_long,
                        pool.s_short,
                        TokenSide::Short,
                        pool.sqrt_lambda_short_x96,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                    )?;
                    pool.r_short = ICBSCurve::virtual_reserves(pool.s_short, pool.sqrt_price_short_x96)?;
                }
                TokenSide::Short => {
                    let new_supply = pool.s_short
                        .checked_add(tokens_out)
                        .ok_or(ContentPoolError::SupplyOverflow)?;

                    // Validate against maximum safe supply
                    require!(
                        new_supply <= MAX_SAFE_SUPPLY,
                        ContentPoolError::SupplyOverflow
                    );

                    pool.s_short = new_supply;
                    pool.sqrt_price_short_x96 = new_sqrt_price;
                    // Update virtual reserve: R_S = s_S × p_S
                    pool.r_short = ICBSCurve::virtual_reserves(pool.s_short, pool.sqrt_price_short_x96)?;

                    // Recalculate LONG price due to inverse coupling
                    // p_L depends on both s_L and s_S through the denominator √(s_L² + s_S²)
                    pool.sqrt_price_long_x96 = ICBSCurve::sqrt_marginal_price(
                        pool.s_long,
                        pool.s_short,
                        TokenSide::Long,
                        pool.sqrt_lambda_long_x96,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                    )?;
                    pool.r_long = ICBSCurve::virtual_reserves(pool.s_long, pool.sqrt_price_long_x96)?;
                }
            }

            // Update vault balance
            pool.vault_balance = pool.vault_balance
                .checked_add(usdc_to_trade)
                .ok_or(ContentPoolError::NumericalOverflow)?;

            // Emit event with complete ICBS snapshots
            emit!(TradeEvent {
                pool: pool.key(),
                trader: ctx.accounts.trader.key(),
                side,
                trade_type,
                usdc_amount: amount,
                usdc_to_trade,
                usdc_to_stake: stake_skim,
                tokens_traded: tokens_out,
                // BEFORE snapshots
                s_long_before,
                s_short_before,
                sqrt_price_long_x96_before,
                sqrt_price_short_x96_before,
                // AFTER snapshots
                s_long_after: pool.s_long,
                s_short_after: pool.s_short,
                sqrt_price_long_x96_after: pool.sqrt_price_long_x96,
                sqrt_price_short_x96_after: pool.sqrt_price_short_x96,
                // Virtual reserves
                r_long_after: pool.r_long,
                r_short_after: pool.r_short,
                vault_balance_after: pool.vault_balance,
                timestamp: clock.unix_timestamp,
            });
        }

        TradeType::Sell => {
            // Calculate USDC out
            let (usdc_out, new_sqrt_price) = match side {
                TokenSide::Long => {
                    ICBSCurve::calculate_sell(
                        pool.s_long,
                        amount,
                        pool.sqrt_lambda_long_x96,
                        pool.s_short,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                        true,
                    )?
                }
                TokenSide::Short => {
                    ICBSCurve::calculate_sell(
                        pool.s_short,
                        amount,
                        pool.sqrt_lambda_short_x96,
                        pool.s_long,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                        false,
                    )?
                }
            };

            // Check slippage
            require!(
                usdc_out >= min_usdc_out,
                ContentPoolError::SlippageExceeded
            );

            // Burn tokens from trader
            token::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.token_mint.to_account_info(),
                        from: ctx.accounts.trader_tokens.to_account_info(),
                        authority: ctx.accounts.trader.to_account_info(),
                    },
                ),
                amount,
            )?;

            // Transfer USDC to trader
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.trader_usdc.to_account_info(),
                        authority: pool.to_account_info(),
                    },
                    &[pool_seeds],
                ),
                usdc_out,
            )?;

            // Update pool state
            match side {
                TokenSide::Long => {
                    pool.s_long = pool.s_long
                        .checked_sub(amount)
                        .ok_or(ContentPoolError::InsufficientBalance)?;
                    pool.sqrt_price_long_x96 = new_sqrt_price;
                    // Update virtual reserve: R_L = s_L × p_L
                    pool.r_long = ICBSCurve::virtual_reserves(pool.s_long, pool.sqrt_price_long_x96)?;

                    // Recalculate SHORT price due to inverse coupling
                    pool.sqrt_price_short_x96 = ICBSCurve::sqrt_marginal_price(
                        pool.s_long,
                        pool.s_short,
                        TokenSide::Short,
                        pool.sqrt_lambda_short_x96,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                    )?;
                    pool.r_short = ICBSCurve::virtual_reserves(pool.s_short, pool.sqrt_price_short_x96)?;
                }
                TokenSide::Short => {
                    pool.s_short = pool.s_short
                        .checked_sub(amount)
                        .ok_or(ContentPoolError::InsufficientBalance)?;
                    pool.sqrt_price_short_x96 = new_sqrt_price;
                    // Update virtual reserve: R_S = s_S × p_S
                    pool.r_short = ICBSCurve::virtual_reserves(pool.s_short, pool.sqrt_price_short_x96)?;

                    // Recalculate LONG price due to inverse coupling
                    pool.sqrt_price_long_x96 = ICBSCurve::sqrt_marginal_price(
                        pool.s_long,
                        pool.s_short,
                        TokenSide::Long,
                        pool.sqrt_lambda_long_x96,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                    )?;
                    pool.r_long = ICBSCurve::virtual_reserves(pool.s_long, pool.sqrt_price_long_x96)?;
                }
            }

            // Update vault balance
            pool.vault_balance = pool.vault_balance
                .checked_sub(usdc_out)
                .ok_or(ContentPoolError::InsufficientBalance)?;

            // Emit event with complete ICBS snapshots
            emit!(TradeEvent {
                pool: pool.key(),
                trader: ctx.accounts.trader.key(),
                side,
                trade_type,
                usdc_amount: usdc_out,
                usdc_to_trade: usdc_out,
                usdc_to_stake: 0,
                tokens_traded: amount,  // For sells, this is tokens IN (burned)
                // BEFORE snapshots
                s_long_before,
                s_short_before,
                sqrt_price_long_x96_before,
                sqrt_price_short_x96_before,
                // AFTER snapshots
                s_long_after: pool.s_long,
                s_short_after: pool.s_short,
                sqrt_price_long_x96_after: pool.sqrt_price_long_x96,
                sqrt_price_short_x96_after: pool.sqrt_price_short_x96,
                // Virtual reserves
                r_long_after: pool.r_long,
                r_short_after: pool.r_short,
                vault_balance_after: pool.vault_balance,
                timestamp: clock.unix_timestamp,
            });
        }
    }

    Ok(())
}