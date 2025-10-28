use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn},
};
use crate::pool_factory::state::PoolFactory;
use crate::content_pool::{
    state::*,
    events::{TradeEvent, TradeFeeEvent},
    errors::ContentPoolError,
    curve::{ICBSCurve, Q96},
    math::{mul_div_u128, round_to_nearest, renormalize_scales, ceil_div},
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

/// Calculate trading fees with overflow protection
/// Returns (total_fee, creator_fee, protocol_fee) all in µUSDC
#[inline]
fn calc_fees(amount: u64, total_bps: u16, split_bps: u16) -> Result<(u64, u64, u64)> {
    let total = (amount as u128)
        .checked_mul(total_bps as u128)
        .ok_or(ContentPoolError::FeeCalculationOverflow)?
        .checked_div(10000)
        .ok_or(ContentPoolError::FeeCalculationOverflow)?
        as u64;

    let creator = (total as u128)
        .checked_mul(split_bps as u128)
        .ok_or(ContentPoolError::FeeCalculationOverflow)?
        .checked_div(10000)
        .ok_or(ContentPoolError::FeeCalculationOverflow)?
        as u64;

    let protocol = total
        .checked_sub(creator)
        .ok_or(ContentPoolError::FeeCalculationOverflow)?;

    Ok((total, creator, protocol))
}

/// Derive lambda from vault balance and virtual supplies
/// This is the ONLY source of truth for lambda - we NEVER store or multiply it
#[inline]
pub(super) fn derive_lambda(vault: &Account<TokenAccount>, pool: &ContentPool) -> Result<u128> {
    use crate::content_pool::math::ceil_div;

    // 1. Compute virtual supplies with CEILING division to prevent zero
    let s_long_virtual = if pool.s_long > 0 {
        ceil_div(pool.s_long as u128 * Q64, pool.s_scale_long_q64).max(1)
    } else {
        0
    };

    let s_short_virtual = if pool.s_short > 0 {
        ceil_div(pool.s_short as u128 * Q64, pool.s_scale_short_q64).max(1)
    } else {
        0
    };

    // 2. CRITICAL: Virtual supplies must fit u64 for curve
    require!(
        s_long_virtual <= u64::MAX as u128,
        ContentPoolError::VirtualSupplyOverflow
    );
    require!(
        s_short_virtual <= u64::MAX as u128,
        ContentPoolError::VirtualSupplyOverflow
    );

    // 3. Compute norm: ||ŝ|| = sqrt(ŝ_L² + ŝ_S²)
    let norm_sq = s_long_virtual
        .checked_mul(s_long_virtual)
        .and_then(|v| v.checked_add(s_short_virtual.checked_mul(s_short_virtual)?))
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let norm = isqrt_u128(norm_sq).max(1);  // min 1 to avoid div-by-zero

    // 4. Derive λ using DIVISION-FIRST to avoid overflow
    // Instead of: lambda_q96 = (vault * Q96) / norm  (can overflow at multiply)
    // We do: lambda_q96 = (vault / norm) * Q96 + (vault % norm * Q96) / norm
    let vault_balance = vault.amount;
    let a = vault_balance as u128;
    let d = norm;
    let q = a / d;
    let r = a % d;

    let term1 = q.checked_mul(Q96)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let term2_num = r.checked_mul(Q96)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let term2 = term2_num / d;

    let lambda_q96 = term1.checked_add(term2)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // 5. Sanity check
    let lambda_usdc = lambda_q96 / Q96;
    require!(
        lambda_usdc >= 10 && lambda_usdc <= 100_000_000_000u128,
        ContentPoolError::InvalidParameter
    );

    // 6. Return lambda_q96 directly (fixes the Q96 squaring bug!)
    // Previously we returned sqrt(lambda)<<48, but that caused issues when
    // curve functions squared it back - the mul_shift_right_96 helper assumes
    // operands <= 2^96, but sqrt(lambda) for large lambda violates this.
    Ok(lambda_q96)
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
        constraint = protocol_authority.key() == factory.protocol_authority @ ContentPoolError::UnauthorizedProtocol
    )]
    pub protocol_authority: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    // NEW: Fee recipient accounts
    #[account(mut)]
    /// CHECK: Post creator's USDC token account (validated in handler)
    pub post_creator_usdc_account: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK: Protocol treasury's USDC token account (validated in handler)
    pub protocol_treasury_usdc_account: AccountInfo<'info>,

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

    // Copy values needed for seeds to avoid borrow conflicts
    let content_id = pool.content_id;
    let bump = pool.bump;

    let pool_seeds = &[
        b"content_pool",
        content_id.as_ref(),
        &[bump],
    ];

    match trade_type {
        TradeType::Buy => {
            // ======== BUY ========
            // BUY FLOW: Trader → Skim + Fees + Net → Vault
            // Fees are deducted from USDC BEFORE it goes to the curve

            // Validate stake skim (µUSDC throughout)
            require!(
                stake_skim <= amount,
                ContentPoolError::InvalidStakeSkim
            );

            let after_skim = amount
                .checked_sub(stake_skim)
                .ok_or(ContentPoolError::InvalidStakeSkim)?;

            // OPTIONAL safety: catch egregious unit mistakes (skim > 50% of trade)
            // Keep generous threshold to avoid false positives on config changes
            require!(
                stake_skim <= amount / 2,
                ContentPoolError::InvalidStakeSkim
            );

            // Calculate fees on after_skim amount
            let factory = &ctx.accounts.factory;
            let (total_fee, creator_fee, protocol_fee) = calc_fees(
                after_skim,
                factory.total_fee_bps,
                factory.creator_split_bps,
            )?;

            // Net amount that goes to the curve
            let usdc_to_trade = after_skim
                .checked_sub(total_fee)
                .ok_or(ContentPoolError::FeeCalculationOverflow)?;

            // Transfer skim (µUSDC) to stake vault
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

            // Transfer creator fee (trader → post creator)
            if creator_fee > 0 {
                token::transfer(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.trader_usdc.to_account_info(),
                            to: ctx.accounts.post_creator_usdc_account.to_account_info(),
                            authority: ctx.accounts.trader.to_account_info(),
                        },
                    ),
                    creator_fee,
                )?;
            }

            // Transfer protocol fee (trader → protocol treasury)
            if protocol_fee > 0 {
                token::transfer(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.trader_usdc.to_account_info(),
                            to: ctx.accounts.protocol_treasury_usdc_account.to_account_info(),
                            authority: ctx.accounts.trader.to_account_info(),
                        },
                    ),
                    protocol_fee,
                )?;
            }

            // Transfer NET trade amount (µUSDC) to vault (after fees)
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

            // Renormalize sigma scales to keep virtual norm in safe range
            {
                let mut sigma_long = pool.s_scale_long_q64;
                let mut sigma_short = pool.s_scale_short_q64;
                let s_long = pool.s_long;
                let s_short = pool.s_short;
                renormalize_scales(
                    &mut sigma_long,
                    &mut sigma_short,
                    s_long,
                    s_short,
                );
                pool.s_scale_long_q64 = sigma_long;
                pool.s_scale_short_q64 = sigma_short;
            }

            // Derive lambda from vault + virtual supplies (now returns lambda_q96 directly!)
            let lambda_q96 = derive_lambda(&ctx.accounts.vault, pool)?;

            // Compute virtual supplies for curve (with ceiling division)
            let s_long_virtual = if pool.s_long > 0 {
                ceil_div(pool.s_long as u128 * Q64, pool.s_scale_long_q64).max(1)
            } else {
                0
            };

            let s_short_virtual = if pool.s_short > 0 {
                ceil_div(pool.s_short as u128 * Q64, pool.s_scale_short_q64).max(1)
            } else {
                0
            };

            // Run curve on VIRTUAL supplies
            let (delta_s_virtual, new_sqrt_price) = match side {
                TokenSide::Long => {
                    ICBSCurve::calculate_buy(
                        s_long_virtual as u64,   // VIRTUAL units
                        usdc_to_trade,
                        lambda_q96,
                        s_short_virtual as u64,  // Other side virtual
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                        true,
                        pool.s_scale_long_q64,
                        pool.s_scale_short_q64,
                    )?
                }
                TokenSide::Short => {
                    ICBSCurve::calculate_buy(
                        s_short_virtual as u64,
                        usdc_to_trade,
                        lambda_q96,
                        s_long_virtual as u64,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                        false,
                        pool.s_scale_long_q64,
                        pool.s_scale_short_q64,
                    )?
                }
            };

            // Convert virtual delta → display delta (round-to-nearest)
            let delta_display = match side {
                TokenSide::Long => {
                    round_to_nearest(
                        delta_s_virtual as u128 * pool.s_scale_long_q64,
                        Q64
                    )
                }
                TokenSide::Short => {
                    round_to_nearest(
                        delta_s_virtual as u128 * pool.s_scale_short_q64,
                        Q64
                    )
                }
            };

            // GUARDS
            // 1. Zero-mint protection
            require!(
                delta_display > 0 || usdc_to_trade == 0,
                ContentPoolError::TooSmallAfterRounding
            );

            // 2. Supply cap protection
            let new_supply = match side {
                TokenSide::Long => pool.s_long.checked_add(delta_display),
                TokenSide::Short => pool.s_short.checked_add(delta_display),
            }.ok_or(ContentPoolError::NumericalOverflow)?;

            require!(
                new_supply <= S_DISPLAY_CAP,
                ContentPoolError::SupplyOverflow
            );

            // Convert display → atomic for SPL mint
            let delta_atomic = to_atomic(delta_display)?;
            require!(
                delta_atomic >= min_tokens_out,
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
                delta_atomic,
            )?;

            // Update vault FIRST (µUSDC)
            pool.vault_balance = pool.vault_balance
                .checked_add(usdc_to_trade)
                .ok_or(ContentPoolError::NumericalOverflow)?;

            // Update pool state with DISPLAY delta and compute reserves from VIRTUAL supplies
            let (s_long_virtual_after, s_short_virtual_after) = match side {
                TokenSide::Long => {
                    pool.s_long += delta_display;
                    pool.sqrt_price_long_x96 = new_sqrt_price;

                    // Recouple SHORT price using VIRTUAL supplies
                    let s_long_v_after = s_long_virtual + (delta_s_virtual as u128);
                    let s_short_v_after = s_short_virtual;

                    pool.sqrt_price_short_x96 = ICBSCurve::sqrt_marginal_price_from_virtual(
                        s_long_v_after as u64,
                        s_short_v_after as u64,
                        TokenSide::Short,
                        lambda_q96,
                        pool.s_scale_long_q64,
                        pool.s_scale_short_q64,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                    )?;

                    (s_long_v_after, s_short_v_after)
                }
                TokenSide::Short => {
                    pool.s_short += delta_display;
                    pool.sqrt_price_short_x96 = new_sqrt_price;

                    // Recouple LONG price using VIRTUAL supplies
                    let s_long_v_after = s_long_virtual;
                    let s_short_v_after = s_short_virtual + (delta_s_virtual as u128);

                    pool.sqrt_price_long_x96 = ICBSCurve::sqrt_marginal_price_from_virtual(
                        s_long_v_after as u64,
                        s_short_v_after as u64,
                        TokenSide::Long,
                        lambda_q96,
                        pool.s_scale_long_q64,
                        pool.s_scale_short_q64,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                    )?;

                    (s_long_v_after, s_short_v_after)
                }
            };

            // Calculate reserves directly from lambda and virtual supplies
            // This avoids unit mixing (display price × virtual supply) and is cheaper
            let r_long_calc = ICBSCurve::reserve_from_lambda_and_virtual(
                s_long_virtual_after as u64,
                s_short_virtual_after as u64,
                lambda_q96,
            )?;

            // ENFORCE INVARIANT: r_long + r_short = vault_balance
            // Calculate r_long from virtual supply, then set r_short as remainder
            pool.r_long = r_long_calc.min(pool.vault_balance);
            pool.r_short = pool.vault_balance.saturating_sub(pool.r_long);

            // Persist the computed lambda (identical for both sides)
            pool.lambda_long_q96 = lambda_q96;
            pool.lambda_short_q96 = lambda_q96;

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

            // Emit fee event
            emit!(TradeFeeEvent {
                pool: pool.key(),
                trader: ctx.accounts.trader.key(),
                side,
                trade_type,
                total_fee_micro_usdc: total_fee,
                creator_fee_micro_usdc: creator_fee,
                protocol_fee_micro_usdc: protocol_fee,
                post_creator: pool.post_creator,
                protocol_treasury: factory.protocol_treasury,
                timestamp: clock.unix_timestamp,
            });
        }

        TradeType::Sell => {
            // ======== SELL ========
            // SELL FLOW: Vault → Fees → Net → Trader
            // Fees are deducted from proceeds AFTER curve calculation

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

            // Renormalize sigma scales to keep virtual norm in safe range
            {
                let mut sigma_long = pool.s_scale_long_q64;
                let mut sigma_short = pool.s_scale_short_q64;
                let s_long = pool.s_long;
                let s_short = pool.s_short;
                renormalize_scales(
                    &mut sigma_long,
                    &mut sigma_short,
                    s_long,
                    s_short,
                );
                pool.s_scale_long_q64 = sigma_long;
                pool.s_scale_short_q64 = sigma_short;
            }

            // Derive lambda from vault + virtual supplies
            let lambda_q96 = derive_lambda(&ctx.accounts.vault, pool)?;

            // Compute virtual supplies for curve (with ceiling division)
            let s_long_virtual = if pool.s_long > 0 {
                ceil_div(pool.s_long as u128 * Q64, pool.s_scale_long_q64).max(1)
            } else {
                0
            };

            let s_short_virtual = if pool.s_short > 0 {
                ceil_div(pool.s_short as u128 * Q64, pool.s_scale_short_q64).max(1)
            } else {
                0
            };

            // Convert sell_display to virtual units
            let sell_virtual = match side {
                TokenSide::Long => round_to_nearest(sell_display as u128 * Q64, pool.s_scale_long_q64),
                TokenSide::Short => round_to_nearest(sell_display as u128 * Q64, pool.s_scale_short_q64),
            };

            // Guard against zero-burn rounding
            require!(
                sell_virtual > 0,
                ContentPoolError::TooSmallAfterRounding
            );

            // Run curve on VIRTUAL supplies - calculate GROSS proceeds
            let (gross_usdc_out, new_sqrt_price) = match side {
                TokenSide::Long => {
                    ICBSCurve::calculate_sell(
                        s_long_virtual as u64,
                        sell_virtual,
                        lambda_q96,
                        s_short_virtual as u64,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                        true,
                        pool.s_scale_long_q64,
                        pool.s_scale_short_q64,
                    )?
                }
                TokenSide::Short => {
                    ICBSCurve::calculate_sell(
                        s_short_virtual as u64,
                        sell_virtual,
                        lambda_q96,
                        s_long_virtual as u64,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                        false,
                        pool.s_scale_long_q64,
                        pool.s_scale_short_q64,
                    )?
                }
            };

            // Calculate fees on gross proceeds
            let factory = &ctx.accounts.factory;
            let (total_fee, creator_fee, protocol_fee) = calc_fees(
                gross_usdc_out,
                factory.total_fee_bps,
                factory.creator_split_bps,
            )?;

            // Net proceeds to trader (after fees)
            let net_usdc_out = gross_usdc_out
                .checked_sub(total_fee)
                .ok_or(ContentPoolError::FeeCalculationOverflow)?;

            // Slippage check on NET proceeds (what trader actually receives)
            require!(
                net_usdc_out >= min_usdc_out,
                ContentPoolError::SlippageExceeded
            );

            // Burn atomic tokens from trader
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

            // Transfer creator fee (vault → post creator, signed by pool PDA)
            if creator_fee > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.vault.to_account_info(),
                            to: ctx.accounts.post_creator_usdc_account.to_account_info(),
                            authority: pool.to_account_info(),
                        },
                        &[pool_seeds],
                    ),
                    creator_fee,
                )?;
            }

            // Transfer protocol fee (vault → protocol treasury, signed by pool PDA)
            if protocol_fee > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.vault.to_account_info(),
                            to: ctx.accounts.protocol_treasury_usdc_account.to_account_info(),
                            authority: pool.to_account_info(),
                        },
                        &[pool_seeds],
                    ),
                    protocol_fee,
                )?;
            }

            // Pay out NET µUSDC to trader (vault → trader, signed by pool PDA)
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
                net_usdc_out,
            )?;

            // Update vault balance FIRST (deduct GROSS amount including fees)
            pool.vault_balance = pool.vault_balance
                .checked_sub(gross_usdc_out)
                .ok_or(ContentPoolError::InsufficientBalance)?;

            // Update state (DISPLAY) and compute reserves from VIRTUAL supplies
            let (s_long_virtual_after, s_short_virtual_after) = match side {
                TokenSide::Long => {
                    pool.s_long = pool.s_long
                        .checked_sub(sell_display)
                        .ok_or(ContentPoolError::InsufficientBalance)?;
                    pool.sqrt_price_long_x96 = new_sqrt_price;

                    // Recouple SHORT price using VIRTUAL supplies
                    let s_long_v_after = (s_long_virtual as u64).checked_sub(sell_virtual)
                        .ok_or(ContentPoolError::InsufficientBalance)?;
                    let s_short_v_after = s_short_virtual;

                    pool.sqrt_price_short_x96 = ICBSCurve::sqrt_marginal_price_from_virtual(
                        s_long_v_after as u64,
                        s_short_v_after as u64,
                        TokenSide::Short,
                        lambda_q96,
                        pool.s_scale_long_q64,
                        pool.s_scale_short_q64,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                    )?;

                    (s_long_v_after as u128, s_short_v_after as u128)
                }
                TokenSide::Short => {
                    pool.s_short = pool.s_short
                        .checked_sub(sell_display)
                        .ok_or(ContentPoolError::InsufficientBalance)?;
                    pool.sqrt_price_short_x96 = new_sqrt_price;

                    // Recouple LONG price using VIRTUAL supplies
                    let s_long_v_after = s_long_virtual;
                    let s_short_v_after = (s_short_virtual as u64).checked_sub(sell_virtual)
                        .ok_or(ContentPoolError::InsufficientBalance)?;

                    pool.sqrt_price_long_x96 = ICBSCurve::sqrt_marginal_price_from_virtual(
                        s_long_v_after as u64,
                        s_short_v_after as u64,
                        TokenSide::Long,
                        lambda_q96,
                        pool.s_scale_long_q64,
                        pool.s_scale_short_q64,
                        pool.f,
                        pool.beta_num,
                        pool.beta_den,
                    )?;

                    (s_long_v_after as u128, s_short_v_after as u128)
                }
            };

            // MINIMUM LIQUIDITY PROTECTION: Prevent pool from reaching 0 supply
            // This ensures the ICBS curve math always has valid inputs
            const MIN_POOL_LIQUIDITY: u64 = 1_000; // 0.001 tokens (in display units)
            require!(
                pool.s_long >= MIN_POOL_LIQUIDITY && pool.s_short >= MIN_POOL_LIQUIDITY,
                ContentPoolError::NoLiquidity
            );

            // Calculate reserves directly from lambda and virtual supplies
            // This avoids unit mixing (display price × virtual supply) and is cheaper
            let r_long_calc = ICBSCurve::reserve_from_lambda_and_virtual(
                s_long_virtual_after as u64,
                s_short_virtual_after as u64,
                lambda_q96,
            )?;

            // ENFORCE INVARIANT: r_long + r_short = vault_balance
            pool.r_long = r_long_calc.min(pool.vault_balance);
            pool.r_short = pool.vault_balance.saturating_sub(pool.r_long);

            // Persist the computed lambda (identical for both sides)
            pool.lambda_long_q96 = lambda_q96;
            pool.lambda_short_q96 = lambda_q96;

            // Emit: for sells, keep tokens_traded = atomic burned (helps reconcile wallets)
            emit!(TradeEvent {
                pool: pool.key(),
                trader: ctx.accounts.trader.key(),
                side,
                trade_type,
                usdc_amount: net_usdc_out,  // What trader receives
                usdc_to_trade: net_usdc_out,
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

            // Emit fee event
            emit!(TradeFeeEvent {
                pool: pool.key(),
                trader: ctx.accounts.trader.key(),
                side,
                trade_type,
                total_fee_micro_usdc: total_fee,
                creator_fee_micro_usdc: creator_fee,
                protocol_fee_micro_usdc: protocol_fee,
                post_creator: pool.post_creator,
                protocol_treasury: factory.protocol_treasury,
                timestamp: clock.unix_timestamp,
            });
        }
    }

    Ok(())
}