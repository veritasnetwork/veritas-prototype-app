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
    curve::{ICBSCurve, Q96},
    math::mul_div_u128,
};

// Token has 6 decimals
const TOKEN_SCALE: u64 = 1_000_000;

/// Convert display token units to atomic units (for SPL minting/burning)
#[inline]
fn to_atomic(display_tokens: u64) -> Result<u64> {
    display_tokens
        .checked_mul(TOKEN_SCALE)
        .ok_or(ContentPoolError::SupplyOverflow.into())
}

/// Convert atomic token units to display units (must be exact multiple)
#[inline]
fn atomic_to_display_exact(atomic: u64) -> Result<u64> {
    require!(
        atomic % TOKEN_SCALE == 0,
        ContentPoolError::InvalidTradeAmount
    );
    Ok(atomic / TOKEN_SCALE)
}

/// Local integer square root
#[inline]
fn isqrt_u128(n: u128) -> u128 {
    if n == 0 { return 0; }
    let mut x = n;
    let mut y = (x + 1) >> 1;
    while y < x {
        x = y;
        y = (x + n / x) >> 1;
    }
    x
}

/// Compute current √λ_x96 from pool state (vault_balance and supplies)
/// This is the source of truth for lambda - we derive it from first principles:
/// λ = D / ||s|| where D = vault_balance (µUSDC), ||s|| = sqrt(s_L^2 + s_S^2) (display tokens)
#[inline]
fn current_sqrt_lambda_x96(pool: &ContentPool) -> Result<u128> {
    let s_l = pool.s_long as u128;
    let s_s = pool.s_short as u128;

    // ||s|| = floor(sqrt(s_L^2 + s_S^2)), min 1 to avoid div-by-zero
    let n2 = s_l.checked_mul(s_l)
        .and_then(|v| v.checked_add(s_s.checked_mul(s_s)?))
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let norm = isqrt_u128(n2).max(1);

    // λ_Q96 = (vault_balance * Q96) / norm    [vault_balance is µUSDC BEFORE trade]
    let lambda_q96 = mul_div_u128(pool.vault_balance as u128, Q96, norm)?;

    // √λ_x96 = sqrt(λ_Q96) << 48
    let sqrt_lambda_x96 = isqrt_u128(lambda_q96)
        .checked_shl(48)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // Sanity check: lambda should be in a reasonable range (0.00001 USDC to 100,000 USDC per token)
    // lambda_usdc = lambda_q96 / Q96 (µUSDC per token)
    // Allow 10 µUSDC (0.00001 USDC) to 100B µUSDC (100k USDC) to handle edge cases
    let lambda_usdc = lambda_q96 / Q96;
    require!(
        lambda_usdc >= 10 && lambda_usdc <= 100_000_000_000u128,
        ContentPoolError::InvalidParameter
    );

    Ok(sqrt_lambda_x96)
}

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
            // ======== BUY ========
            // Validate stake skim (µUSDC throughout)
            require!(
                stake_skim <= amount,
                ContentPoolError::InvalidStakeSkim
            );

            let usdc_to_trade = amount
                .checked_sub(stake_skim)
                .ok_or(ContentPoolError::InvalidStakeSkim)?;

            // OPTIONAL safety: catch egregious unit mistakes (skim > 50% of trade)
            // Keep generous threshold to avoid false positives on config changes
            require!(
                stake_skim <= amount / 2,
                ContentPoolError::InvalidStakeSkim
            );

            // Transfer skim (µUSDC) first
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

            // Compute √λ from current state BEFORE adding new USDC
            // This ensures lambda reflects the pool state before this trade
            let sqrt_lambda_x96 = current_sqrt_lambda_x96(pool)?;

            // Transfer trade amount (µUSDC) to vault
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

            // Curve math returns Δs in DISPLAY tokens
            let (delta_display, new_sqrt_price) = match side {
                TokenSide::Long => {
                    ICBSCurve::calculate_buy(
                        pool.s_long,                // display units
                        usdc_to_trade,              // µUSDC
                        sqrt_lambda_x96,            // computed from state
                        pool.s_short,               // display units
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                        true,
                    )?
                }
                TokenSide::Short => {
                    ICBSCurve::calculate_buy(
                        pool.s_short,               // display units
                        usdc_to_trade,              // µUSDC
                        sqrt_lambda_x96,            // computed from state
                        pool.s_long,                // display units
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                        false,
                    )?
                }
            };

            // Convert once: display → atomic for SPL mint
            let delta_atomic = to_atomic(delta_display)?;
            require!(
                delta_atomic >= min_tokens_out,
                ContentPoolError::SlippageExceeded
            );

            // Mint atomic to trader
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
                delta_atomic,
            )?;

            // Update pool STATE in DISPLAY units only
            match side {
                TokenSide::Long => {
                    let new_supply = pool.s_long
                        .checked_add(delta_display)
                        .ok_or(ContentPoolError::SupplyOverflow)?;

                    require!(
                        new_supply <= MAX_SAFE_SUPPLY,
                        ContentPoolError::SupplyOverflow
                    );

                    pool.s_long = new_supply;
                    pool.sqrt_price_long_x96 = new_sqrt_price;

                    // r = s(display) * price(micro/token) → µUSDC
                    pool.r_long = ICBSCurve::virtual_reserves(pool.s_long, pool.sqrt_price_long_x96)?;

                    // Recouple SHORT price and reserves using the same sqrt_lambda_x96
                    pool.sqrt_price_short_x96 = ICBSCurve::sqrt_marginal_price(
                        pool.s_long,
                        pool.s_short,
                        TokenSide::Short,
                        sqrt_lambda_x96,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                    )?;
                    pool.r_short = ICBSCurve::virtual_reserves(pool.s_short, pool.sqrt_price_short_x96)?;
                }
                TokenSide::Short => {
                    let new_supply = pool.s_short
                        .checked_add(delta_display)
                        .ok_or(ContentPoolError::SupplyOverflow)?;

                    require!(
                        new_supply <= MAX_SAFE_SUPPLY,
                        ContentPoolError::SupplyOverflow
                    );

                    pool.s_short = new_supply;
                    pool.sqrt_price_short_x96 = new_sqrt_price;

                    pool.r_short = ICBSCurve::virtual_reserves(pool.s_short, pool.sqrt_price_short_x96)?;

                    // Recouple LONG price and reserves using the same sqrt_lambda_x96
                    pool.sqrt_price_long_x96 = ICBSCurve::sqrt_marginal_price(
                        pool.s_long,
                        pool.s_short,
                        TokenSide::Long,
                        sqrt_lambda_x96,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                    )?;
                    pool.r_long = ICBSCurve::virtual_reserves(pool.s_long, pool.sqrt_price_long_x96)?;
                }
            }

            // Update vault (µUSDC)
            pool.vault_balance = pool.vault_balance
                .checked_add(usdc_to_trade)
                .ok_or(ContentPoolError::NumericalOverflow)?;

            // Persist the computed sqrt_lambda (identical for both sides)
            pool.sqrt_lambda_long_x96 = sqrt_lambda_x96;
            pool.sqrt_lambda_short_x96 = sqrt_lambda_x96;

            // Emit: record tokens_traded in DISPLAY (it reflects state change)
            emit!(TradeEvent {
                pool: pool.key(),
                trader: ctx.accounts.trader.key(),
                side,
                trade_type,
                usdc_amount: amount,
                usdc_to_trade,
                usdc_to_stake: stake_skim,
                tokens_traded: delta_display, // display units
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
            // ======== SELL ========
            // Require sells to be exact multiples of TOKEN_SCALE (so state stays consistent)
            require!(
                amount % TOKEN_SCALE == 0,
                ContentPoolError::InvalidTradeAmount
            );
            let sell_display = atomic_to_display_exact(amount)?;
            require!(
                sell_display >= MIN_TOKEN_TRADE_SIZE,
                ContentPoolError::InvalidTradeAmount
            );

            // Compute √λ from current state BEFORE burning tokens
            let sqrt_lambda_x96 = current_sqrt_lambda_x96(pool)?;

            // Curve math (display)
            let (usdc_out, new_sqrt_price) = match side {
                TokenSide::Long => {
                    ICBSCurve::calculate_sell(
                        pool.s_long,
                        sell_display,
                        sqrt_lambda_x96,
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
                        sell_display,
                        sqrt_lambda_x96,
                        pool.s_long,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                        false,
                    )?
                }
            };

            require!(
                usdc_out >= min_usdc_out,
                ContentPoolError::SlippageExceeded
            );

            // Burn atomic
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

            // Pay out µUSDC
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

            // Update state (DISPLAY)
            match side {
                TokenSide::Long => {
                    pool.s_long = pool.s_long
                        .checked_sub(sell_display)
                        .ok_or(ContentPoolError::InsufficientBalance)?;
                    pool.sqrt_price_long_x96 = new_sqrt_price;
                    pool.r_long = ICBSCurve::virtual_reserves(pool.s_long, pool.sqrt_price_long_x96)?;

                    // Recouple SHORT price and reserves using the same sqrt_lambda_x96
                    pool.sqrt_price_short_x96 = ICBSCurve::sqrt_marginal_price(
                        pool.s_long,
                        pool.s_short,
                        TokenSide::Short,
                        sqrt_lambda_x96,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                    )?;
                    pool.r_short = ICBSCurve::virtual_reserves(pool.s_short, pool.sqrt_price_short_x96)?;
                }
                TokenSide::Short => {
                    pool.s_short = pool.s_short
                        .checked_sub(sell_display)
                        .ok_or(ContentPoolError::InsufficientBalance)?;
                    pool.sqrt_price_short_x96 = new_sqrt_price;
                    pool.r_short = ICBSCurve::virtual_reserves(pool.s_short, pool.sqrt_price_short_x96)?;

                    // Recouple LONG price and reserves using the same sqrt_lambda_x96
                    pool.sqrt_price_long_x96 = ICBSCurve::sqrt_marginal_price(
                        pool.s_long,
                        pool.s_short,
                        TokenSide::Long,
                        sqrt_lambda_x96,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                    )?;
                    pool.r_long = ICBSCurve::virtual_reserves(pool.s_long, pool.sqrt_price_long_x96)?;
                }
            }

            pool.vault_balance = pool.vault_balance
                .checked_sub(usdc_out)
                .ok_or(ContentPoolError::InsufficientBalance)?;

            // Persist the computed sqrt_lambda (identical for both sides)
            pool.sqrt_lambda_long_x96 = sqrt_lambda_x96;
            pool.sqrt_lambda_short_x96 = sqrt_lambda_x96;

            // Emit: for sells, keep tokens_traded = atomic burned (helps reconcile wallets)
            emit!(TradeEvent {
                pool: pool.key(),
                trader: ctx.accounts.trader.key(),
                side,
                trade_type,
                usdc_amount: usdc_out,
                usdc_to_trade: usdc_out,
                usdc_to_stake: 0,
                tokens_traded: amount, // atomic burned (helps reconcile wallets)
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