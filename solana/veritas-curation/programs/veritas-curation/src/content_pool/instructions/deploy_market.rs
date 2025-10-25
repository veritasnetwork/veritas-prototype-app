use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer, MintTo},
};
use anchor_spl::token::spl_token::{
    state::{Account as SplAccount, Mint as SplMint},
    solana_program::program_pack::Pack,
};
use crate::content_pool::{
    state::*,
    events::MarketDeployedEvent,
    errors::ContentPoolError,
    curve::{ICBSCurve, Q96},
    math::{mul_div_u128, mul_shift_right_96},
};
use crate::pool_factory::state::PoolFactory;

/// USDC precision (10^6 for 6 decimals)
const USDC_PRECISION: u64 = 1_000_000;

/// Helper to decode SPL token account
fn read_token_account(ai: &AccountInfo) -> Result<SplAccount> {
    SplAccount::unpack(&ai.try_borrow_data()?)
        .map_err(|_| ContentPoolError::InvalidParameter.into())
}

/// Helper to decode SPL mint
fn read_mint(ai: &AccountInfo) -> Result<SplMint> {
    SplMint::unpack(&ai.try_borrow_data()?)
        .map_err(|_| ContentPoolError::InvalidParameter.into())
}

#[derive(Accounts)]
pub struct DeployMarket<'info> {
    /// CHECK: PDA validated in handler
    #[account(mut)]
    pub pool: Account<'info, ContentPool>,

    #[account(
        seeds = [b"factory"],
        bump = factory.bump
    )]
    pub factory: Account<'info, PoolFactory>,

    #[account(
        init,
        payer = payer,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = pool,
        seeds = [b"long_mint", pool.content_id.as_ref()],
        bump
    )]
    pub long_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = pool,
        seeds = [b"short_mint", pool.content_id.as_ref()],
        bump
    )]
    pub short_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        token::mint = usdc_mint,
        token::authority = pool,
        seeds = [b"vault", pool.content_id.as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: Validated in handler
    #[account(mut)]
    pub deployer_usdc: UncheckedAccount<'info>,

    /// CHECK: PDA, will be created manually if needed
    #[account(mut)]
    pub deployer_long: UncheckedAccount<'info>,

    /// CHECK: PDA, will be created manually if needed
    #[account(mut)]
    pub deployer_short: UncheckedAccount<'info>,

    /// CHECK: Validated in handler
    pub usdc_mint: UncheckedAccount<'info>,

    pub deployer: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<DeployMarket>,
    initial_deposit: u64,
    long_allocation: u64,
) -> Result<()> {
    // Validate pool PDA
    let expected_pool = Pubkey::find_program_address(
        &[b"content_pool", ctx.accounts.pool.content_id.as_ref()],
        ctx.program_id,
    ).0;
    require!(
        expected_pool == ctx.accounts.pool.key(),
        ContentPoolError::InvalidParameter
    );

    // Validate pool state
    require!(
        ctx.accounts.pool.market_deployer == Pubkey::default(),
        ContentPoolError::MarketAlreadyDeployed
    );
    require!(
        ctx.accounts.pool.factory == ctx.accounts.factory.key(),
        ContentPoolError::InvalidParameter
    );

    // Validate deployer USDC account
    let deployer_usdc_acc = read_token_account(&ctx.accounts.deployer_usdc.to_account_info())?;
    require!(
        deployer_usdc_acc.owner == ctx.accounts.deployer.key(),
        ContentPoolError::InvalidParameter
    );
    require!(
        deployer_usdc_acc.mint == ctx.accounts.usdc_mint.key(),
        ContentPoolError::InvalidParameter
    );

    // Validate USDC mint
    let usdc_mint_acc = read_mint(&ctx.accounts.usdc_mint.to_account_info())?;
    require!(
        usdc_mint_acc.decimals == 6,
        ContentPoolError::InvalidParameter
    );

    // Validate deposit against factory minimum
    require!(
        initial_deposit >= ctx.accounts.factory.min_initial_deposit,
        ContentPoolError::BelowMinimumDeposit
    );

    // Validate allocation
    let short_allocation = initial_deposit
        .checked_sub(long_allocation)
        .ok_or(ContentPoolError::InvalidAllocation)?;

    require!(
        long_allocation > 0 && short_allocation > 0,
        ContentPoolError::InvalidAllocation
    );

    // Get p0 from factory (used for supply calculation later)
    let p0 = ctx.accounts.factory.default_p0;

    // Create deployer's LONG token account if needed
    if ctx.accounts.deployer_long.data_is_empty() {
        anchor_spl::associated_token::create(
            CpiContext::new(
                ctx.accounts.associated_token_program.to_account_info(),
                anchor_spl::associated_token::Create {
                    payer: ctx.accounts.payer.to_account_info(),
                    associated_token: ctx.accounts.deployer_long.to_account_info(),
                    authority: ctx.accounts.deployer.to_account_info(),
                    mint: ctx.accounts.long_mint.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
            ),
        )?;
    }

    // Create deployer's SHORT token account if needed
    if ctx.accounts.deployer_short.data_is_empty() {
        anchor_spl::associated_token::create(
            CpiContext::new(
                ctx.accounts.associated_token_program.to_account_info(),
                anchor_spl::associated_token::Create {
                    payer: ctx.accounts.payer.to_account_info(),
                    associated_token: ctx.accounts.deployer_short.to_account_info(),
                    authority: ctx.accounts.deployer.to_account_info(),
                    mint: ctx.accounts.short_mint.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
            ),
        )?;
    }

    // Transfer USDC to vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.deployer_usdc.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.deployer.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, initial_deposit)?;

    // === ON-MANIFOLD DEPLOYMENT (√allocation + candidate search) ===
    // For F=1, β=0.5: C(s_L, s_S) = ||s|| and p_i = λ·s_i/||s||
    // We pick integer supplies (s_L, s_S) to match the allocation ratio,
    // then set λ = D/||s|| to hit the deposit exactly (staying on-manifold).

    require!(
        p0 > 0,
        ContentPoolError::InvalidParameter
    );

    let a_l: u128 = long_allocation as u128;
    let a_s: u128 = short_allocation as u128;
    let a_ref: u128 = a_l.max(a_s);

    // Base supplies from √allocation (floor)
    let s_l0 = integer_sqrt(
        a_l.checked_mul(a_ref)
            .ok_or(ContentPoolError::NumericalOverflow)?
    )?.checked_div(p0 as u128)
        .ok_or(ContentPoolError::InvalidParameter)?;

    let s_s0 = integer_sqrt(
        a_s.checked_mul(a_ref)
            .ok_or(ContentPoolError::NumericalOverflow)?
    )?.checked_div(p0 as u128)
        .ok_or(ContentPoolError::InvalidParameter)?;

    require!(
        s_l0 > 0 && s_s0 > 0,
        ContentPoolError::InvalidAllocation
    );

    // Candidate search: try {s_l0, s_l0+1} × {s_s0, s_s0+1} to fix floor rounding
    // Pick the candidate that minimizes reserve ratio error
    struct Candidate {
        s_long: u64,
        s_short: u64,
        lambda_x96: u128,
        sqrt_lambda_x96: u128,
        sqrt_price_long_x96: u128,
        sqrt_price_short_x96: u128,
        r_long: u64,
        r_short: u64,
        ratio_error: u128,
    }

    let mut best: Option<Candidate> = None;
    // Only try base + bump smaller side by +1 (2 candidates to save CUs)
    let candidates = if s_l0 >= s_s0 {
        [(s_l0, s_s0), (s_l0, s_s0 + 1)]
    } else {
        [(s_l0, s_s0), (s_l0 + 1, s_s0)]
    };

    for &(s_l_cand, s_s_cand) in &candidates {
        let s_l_u64 = s_l_cand as u64;
        let s_s_u64 = s_s_cand as u64;

        // ---------- OPTION A: exact deploy prices from deposit identity ----------
        // Geometry (F=1, β=0.5):
        //   p_i = D * s_i / (s_L^2 + s_S^2)
        // Do it fully in Q96 without any sqrt(||s||) so we avoid floor bias.

        let n2 = s_l_cand
            .checked_mul(s_l_cand)
            .ok_or(ContentPoolError::NumericalOverflow)?
            .checked_add(
                s_s_cand
                    .checked_mul(s_s_cand)
                    .ok_or(ContentPoolError::NumericalOverflow)?,
            )
            .ok_or(ContentPoolError::NumericalOverflow)?;

        // Q96 scale: d_over_n2_q96 = (D * Q96) / (s_L^2 + s_S^2)
        let d_over_n2_q96 = mul_div_u128(initial_deposit as u128, Q96, n2)?;

        // p_i in Q96: p_i = d_over_n2_q96 * s_i
        // Use checked_mul to keep 256-bit intermediate and avoid u128 overflow.
        let p_long_q96 = d_over_n2_q96
            .checked_mul(s_l_cand as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        let p_short_q96 = d_over_n2_q96
            .checked_mul(s_s_cand as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?;

        // sqrt_price_i_x96 = sqrt(p_i_q96) << 48   (so that (sqrt_price >>48)^2 is Q96)
        let sqrt_price_long_x96 = integer_sqrt(p_long_q96)?
            .checked_shl(48)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        let sqrt_price_short_x96 = integer_sqrt(p_short_q96)?
            .checked_shl(48)
            .ok_or(ContentPoolError::NumericalOverflow)?;

        // Make λ consistent with curve: p_i = λ * s_i / ||s|| with *your* integer ||s||.
        // We compute ||s|| as integer sqrt (same as the runtime curve will do).
        let s_norm_int = integer_sqrt(n2)?.max(1);

        // λ in Q96 from each side, then take max to cover any ulp asymmetry.
        let lambda_q96_from_long  = mul_div_u128(p_long_q96,  s_norm_int, s_l_cand)?;
        let lambda_q96_from_short = mul_div_u128(p_short_q96, s_norm_int, s_s_cand)?;
        let lambda_x96 = lambda_q96_from_long.max(lambda_q96_from_short);

        // √λ in x96: sqrt_lambda_x96 = sqrt(λ_q96) << 48
        let sqrt_lambda_x96 = integer_sqrt(lambda_x96)?
            .checked_shl(48)
            .ok_or(ContentPoolError::NumericalOverflow)?;

        // Reserves: r_i = (p_i_q96 * s_i) >> 96
        let r_long  = mul_shift_right_96(p_long_q96,  s_l_cand)?  as u64;
        let r_short = mul_shift_right_96(p_short_q96, s_s_cand)? as u64;
        // ---------- end OPTION A block ----------

        // Score by reserve ratio error: minimize |r_long * A_S - r_short * A_L|
        let cross_l = (r_long as u128).checked_mul(a_s)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        let cross_s = (r_short as u128).checked_mul(a_l)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        let ratio_error = if cross_l > cross_s {
            cross_l - cross_s
        } else {
            cross_s - cross_l
        };

        let candidate = Candidate {
            s_long: s_l_u64,
            s_short: s_s_u64,
            lambda_x96,
            sqrt_lambda_x96,
            sqrt_price_long_x96,
            sqrt_price_short_x96,
            r_long,
            r_short,
            ratio_error,
        };

        if best.is_none() || ratio_error < best.as_ref().unwrap().ratio_error {
            best = Some(candidate);
        }
    }

    let chosen = best.ok_or(ContentPoolError::InvalidParameter)?;

    msg!("deploy_market: chosen s_long={}, s_short={}, ratio_error={}",
         chosen.s_long, chosen.s_short, chosen.ratio_error);
    msg!("deploy_market: r_long={}, r_short={}, r_sum={}",
         chosen.r_long, chosen.r_short, chosen.r_long as u128 + chosen.r_short as u128);

    // Mint tokens to deployer
    let pool = &ctx.accounts.pool;
    let seeds: &[&[&[u8]]] = &[&[
        b"content_pool",
        pool.content_id.as_ref(),
        &[pool.bump],
    ]];

    // Mint LONG tokens
    let mint_long_accounts = MintTo {
        mint: ctx.accounts.long_mint.to_account_info(),
        to: ctx.accounts.deployer_long.to_account_info(),
        authority: pool.to_account_info(),
    };
    let mint_long_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        mint_long_accounts,
        seeds,
    );
    // Convert display units to atomic units for SPL minting (6 decimals)
    const TOKEN_SCALE: u64 = 1_000_000;
    let long_atomic = (chosen.s_long as u64)
        .checked_mul(TOKEN_SCALE)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    token::mint_to(mint_long_ctx, long_atomic)?;

    // Mint SHORT tokens
    let mint_short_accounts = MintTo {
        mint: ctx.accounts.short_mint.to_account_info(),
        to: ctx.accounts.deployer_short.to_account_info(),
        authority: pool.to_account_info(),
    };
    let mint_short_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        mint_short_accounts,
        seeds,
    );
    let short_atomic = (chosen.s_short as u64)
        .checked_mul(TOKEN_SCALE)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    token::mint_to(mint_short_ctx, short_atomic)?;

    // Use the chosen values for pool state
    let s_long = chosen.s_long;
    let s_short = chosen.s_short;
    let r_long = chosen.r_long;
    let r_short = chosen.r_short;
    let sqrt_lambda_x96 = chosen.sqrt_lambda_x96;
    let sqrt_price_long_x96 = chosen.sqrt_price_long_x96;
    let sqrt_price_short_x96 = chosen.sqrt_price_short_x96;

    // Verify reserves are close to initial deposit (within 0.01%)
    // We accept small rounding errors rather than adjusting reserves,
    // which would violate the r_i = s_i × p_i invariant
    let r_sum = (r_long as u128).checked_add(r_short as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let deposit_u128 = initial_deposit as u128;

    let diff = if r_sum > deposit_u128 {
        r_sum - deposit_u128
    } else {
        deposit_u128 - r_sum
    };

    // Allow up to 0.01% error (1 basis point)
    let max_error = deposit_u128 / 10_000;
    require!(
        diff <= max_error,
        ContentPoolError::NumericalOverflow
    );

    msg!("deploy_market: r_sum={}, deposit={}, diff={}",
         r_sum, deposit_u128, diff);

    // Update pool state
    let pool = &mut ctx.accounts.pool;
    pool.market_deployer = ctx.accounts.deployer.key();
    pool.long_mint = ctx.accounts.long_mint.key();
    pool.short_mint = ctx.accounts.short_mint.key();
    pool.vault = ctx.accounts.vault.key();
    pool.s_long = s_long;
    pool.s_short = s_short;
    pool.r_long = r_long;
    pool.r_short = r_short;

    // Store √λ (both fields identical; λ is global)
    pool.sqrt_lambda_long_x96 = sqrt_lambda_x96; // <-- FIXED (was λ)
    pool.sqrt_lambda_short_x96 = sqrt_lambda_x96; // <-- FIXED (was λ)

    pool.sqrt_price_long_x96 = sqrt_price_long_x96;
    pool.sqrt_price_short_x96 = sqrt_price_short_x96;

    // initial q from reserves (on-manifold), not from USDC split
    // Use actual r_sum for consistency (may differ from initial_deposit by a few µUSDC)
    let initial_q_bps = if r_sum > 0 {
        ((r_long as u128) * 10_000u128 / r_sum) as u64
    } else {
        5_000
    };
    pool.initial_q = ((initial_q_bps as u128) * (Q32_ONE as u128) / 10_000u128) as u64;

    // Store the actual sum of reserves as vault_balance for consistency
    // This may differ from initial_deposit by a few µUSDC due to rounding
    pool.vault_balance = r_sum as u64;

    // Emit event
    emit!(MarketDeployedEvent {
        pool: pool.key(),
        deployer: ctx.accounts.deployer.key(),
        initial_deposit,
        long_allocation,
        short_allocation,
        initial_q: pool.initial_q,
        long_tokens: s_long,
        short_tokens: s_short,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

/// Integer square root using Newton's method
fn integer_sqrt(n: u128) -> Result<u128> {
    if n == 0 {
        return Ok(0);
    }

    let mut x = n;
    let mut y = (x + 1) >> 1;

    while y < x {
        x = y;
        y = (x + n / x) >> 1;
    }

    Ok(x)
}

