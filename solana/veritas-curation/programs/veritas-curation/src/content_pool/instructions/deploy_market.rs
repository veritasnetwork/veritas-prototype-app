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
    curve::ICBSCurve,
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

    // CRITICAL: Validate minimum allocation amounts to prevent zero token minting
    // With p0 = 100,000 (0.1 USDC), we need at least ~1 USDC per side to avoid rounding to zero
    // Conservative minimum: each side should get at least 10 * p0 micro-USDC
    let p0 = ctx.accounts.factory.default_p0;
    let min_side_allocation = p0.saturating_mul(10); // 10x p0 per side

    require!(
        long_allocation >= min_side_allocation,
        ContentPoolError::InvalidAllocation
    );
    require!(
        short_allocation >= min_side_allocation,
        ContentPoolError::InvalidAllocation
    );

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

    // === ON-MANIFOLD DEPLOYMENT ===
    // Calculate token amounts using proper bonding curve: s = t × v
    // where t = D·v_ref / (p0·K·||v||²)

    // Step 1: v_l = long_allocation / p0, v_s = short_allocation / p0
    // (use a 1e6 scale K to keep precision: v' = K * v)
    const K: u128 = USDC_PRECISION as u128;

    let v_l = (long_allocation as u128)
        .checked_mul(K)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(p0 as u128)
        .ok_or(ContentPoolError::InvalidParameter)?;

    let v_s = (short_allocation as u128)
        .checked_mul(K)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(p0 as u128)
        .ok_or(ContentPoolError::InvalidParameter)?;

    // Step 2: pin the larger side to p0
    let v_ref = v_l.max(v_s);

    // Step 3: ||v||^2
    let v_l2 = v_l
        .checked_mul(v_l)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let v_s2 = v_s
        .checked_mul(v_s)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let v_norm2 = v_l2
        .checked_add(v_s2)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // Step 4 (FIXED SCALE): t = D·v_ref / (p0·K·||v||²)
    let denominator = (p0 as u128)
        .checked_mul(v_norm2)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_mul(K)
        .ok_or(ContentPoolError::NumericalOverflow)?; // <-- multiply, don't divide

    let t = mul_div_u128(initial_deposit as u128, v_ref, denominator)?;

    // Step 5: s = floor( t * v / K )
    let s_long = (t
        .checked_mul(v_l)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(K)
        .ok_or(ContentPoolError::NumericalOverflow)?) as u64;

    let s_short = (t
        .checked_mul(v_s)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(K)
        .ok_or(ContentPoolError::NumericalOverflow)?) as u64;

    msg!("deploy_market: initial_deposit={}, long_alloc={}, p0={}", initial_deposit, long_allocation, p0);
    msg!("deploy_market: v_l={}, v_s={}, v_ref={}, v_norm2={}", v_l, v_s, v_ref, v_norm2);
    msg!("deploy_market: denominator={}, t={}", denominator, t);
    msg!("deploy_market: s_long={}, s_short={}", s_long, s_short);

    // Validate that both token amounts are non-zero
    // This can fail if deposit is too small or allocation too extreme
    require!(
        s_long > 0,
        ContentPoolError::InvalidAllocation
    );
    require!(
        s_short > 0,
        ContentPoolError::InvalidAllocation
    );

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
    token::mint_to(mint_long_ctx, s_long)?;

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
    token::mint_to(mint_short_ctx, s_short)?;

    // Step 6: λ_x96 = (p0<<96) * ||s|| / s_ref
    let sL = s_long as u128;
    let sS = s_short as u128;
    let sL2 = sL
        .checked_mul(sL)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let sS2 = sS
        .checked_mul(sS)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let s_norm = integer_sqrt(
        sL2.checked_add(sS2)
            .ok_or(ContentPoolError::NumericalOverflow)?
    )?
    .max(1);

    let s_ref = sL.max(sS);
    let p0_q96 = (p0 as u128) << 96;

    let lambda_x96 = mul_div_u128(p0_q96, s_norm, s_ref)?;

    // ---- NEW: compute √λ in Q96 and use it everywhere sqrt-λ is expected ----
    let sqrt_lambda_x96 = (integer_sqrt(lambda_x96)?) << 48;

    // Step 7: prices using ICBS (pass √λ, not λ)
    let sqrt_price_long_x96 = ICBSCurve::sqrt_marginal_price(
        s_long,
        s_short,
        TokenSide::Long,
        sqrt_lambda_x96, // <-- FIXED: pass √λ, not λ
        pool.f,
        pool.beta_num,
        pool.beta_den,
    )?;

    let sqrt_price_short_x96 = ICBSCurve::sqrt_marginal_price(
        s_long,
        s_short,
        TokenSide::Short,
        sqrt_lambda_x96, // <-- FIXED: pass √λ, not λ
        pool.f,
        pool.beta_num,
        pool.beta_den,
    )?;

    // Step 8: reserves r = s * price
    // price_q96 = (sqrt_price_x96^2) >> 96
    let p_long_q96 = mul_shift_right_96(sqrt_price_long_x96, sqrt_price_long_x96)?;
    let p_short_q96 = mul_shift_right_96(sqrt_price_short_x96, sqrt_price_short_x96)?;

    // r = (price_q96 * s) >> 96  (Q96 first arg!)
    let r_long = mul_shift_right_96(p_long_q96, s_long as u128)? as u64; // <-- swapped args
    let r_short = mul_shift_right_96(p_short_q96, s_short as u128)? as u64; // <-- swapped args

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
    let r_sum = (r_long as u128)
        .checked_add(r_short as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let initial_q_bps = if r_sum > 0 {
        ((r_long as u128) * 10_000u128 / r_sum) as u64
    } else {
        5_000
    };
    pool.initial_q = ((initial_q_bps as u128) * (Q32_ONE as u128) / 10_000u128) as u64;

    pool.vault_balance = initial_deposit;

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

