// Precision (immutable)
pub const USDC_DECIMALS: u8 = 6;
pub const RATIO_PRECISION: u128 = 1_000_000;

// Default initial values (used if no ProtocolConfig exists)
// Reserve-based linear transition at $5K with dampening
pub const DEFAULT_K_QUADRATIC: u128 = 200;                  // 0.0002 in real terms (lower for better transition price)
pub const DEFAULT_RESERVE_CAP: u128 = 5_000_000_000;        // $5K USDC (with 6 decimals)
pub const DEFAULT_LINEAR_SLOPE: u128 = 1_000;               // 0.001 slope in linear region
pub const DEFAULT_VIRTUAL_LIQUIDITY: u128 = 100_000_000_000; // 100M tokens for dampening

// Bounds for parameters
pub const DEFAULT_MIN_K_QUADRATIC: u128 = 100;              // Min 0.0001
pub const DEFAULT_MAX_K_QUADRATIC: u128 = 10_000_000;       // Max 10
pub const DEFAULT_MIN_RESERVE_CAP: u128 = 1_000_000_000;    // Min $1K USDC
pub const DEFAULT_MAX_RESERVE_CAP: u128 = 1_000_000_000_000; // Max $1M USDC
pub const DEFAULT_MIN_LINEAR_SLOPE: u128 = 100;             // Min 0.0001
pub const DEFAULT_MAX_LINEAR_SLOPE: u128 = 100_000;         // Max 0.1
pub const DEFAULT_MIN_VIRTUAL_LIQUIDITY: u128 = 1_000_000_000; // Min 1M tokens
pub const DEFAULT_MAX_VIRTUAL_LIQUIDITY: u128 = 10_000_000_000_000; // Max 10B tokens
pub const DEFAULT_MIN_TRADE_AMOUNT: u64 = 1_000_000;        // 1 USDC
