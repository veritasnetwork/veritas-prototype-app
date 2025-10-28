use anchor_lang::prelude::*;

#[error_code]
pub enum ContentPoolError {
    // Initialization (6000-6009)
    #[msg("Invalid growth exponent F (must be 1-10)")]
    InvalidExponent,
    #[msg("Invalid coupling coefficient β (must be 0.1-0.9)")]
    InvalidBeta,
    #[msg("Invalid factory address")]
    InvalidFactory,
    #[msg("Invalid parameter (only F=1, β=0.5 supported)")]
    InvalidParameter,

    // Market deployment (6010-6019)
    #[msg("Market already deployed for this pool")]
    MarketAlreadyDeployed,
    #[msg("Market not deployed yet")]
    MarketNotDeployed,
    #[msg("Initial deposit below minimum ($100 USDC)")]
    BelowMinimumDeposit,
    #[msg("Invalid LONG/SHORT allocation")]
    InvalidAllocation,

    // Trade (6020-6039)
    #[msg("Trade size below minimum")]
    TradeTooSmall,
    #[msg("Trade size above maximum")]
    TradeTooLarge,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Invalid stake skim amount")]
    InvalidStakeSkim,
    #[msg("Invalid trade amount")]
    InvalidTradeAmount,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Supply overflow (exceeds safety bound)")]
    SupplyOverflow,

    // Settlement (6040-6049)
    #[msg("Settlement cooldown not elapsed")]
    SettlementCooldown,
    #[msg("Invalid BD score (must be 0-1_000_000 in millionths format)")]
    InvalidBDScore,
    #[msg("No liquidity in pool")]
    NoLiquidity,
    #[msg("Settlement invariant violated")]
    SettlementInvariantViolation,
    #[msg("Settlement convergence failed")]
    SettlementConvergenceFailed,

    // Math (6050-6059)
    #[msg("Numerical overflow")]
    NumericalOverflow,
    #[msg("Division by zero")]
    DivisionByZero,
    #[msg("Reserve invariant violated")]
    ReserveInvariantViolation,
    #[msg("Price calculation failed")]
    PriceCalculationFailed,
    #[msg("Solver failed to converge")]
    SolverConvergenceFailed,

    // Authority (6060-6069)
    #[msg("Unauthorized (not pool creator)")]
    Unauthorized,
    #[msg("Unauthorized protocol authority")]
    UnauthorizedProtocol,

    // Accounts (6070-6079)
    #[msg("Invalid mint")]
    InvalidMint,
    #[msg("Invalid vault")]
    InvalidVault,
    #[msg("Invalid stake vault")]
    InvalidStakeVault,
    #[msg("Invalid owner")]
    InvalidOwner,

    // Closure (6080-6089)
    #[msg("Positions still open (cannot close pool)")]
    PositionsStillOpen,
    #[msg("Vault not empty")]
    VaultNotEmpty,

    // Post Creator & Fees (6090-6099)
    #[msg("Invalid post creator - does not match pool")]
    InvalidPostCreator,
    #[msg("Fee calculation overflow")]
    FeeCalculationOverflow,

    // Sigma Virtualization (6100-6109)
    #[msg("Virtual supply exceeds u64::MAX - check sigma scales")]
    VirtualSupplyOverflow,
    #[msg("Trade amount too small after rounding - increase trade size")]
    TooSmallAfterRounding,
}