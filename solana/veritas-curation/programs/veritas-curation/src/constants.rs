// Precision (immutable)
pub const USDC_DECIMALS: u8 = 6;
pub const RATIO_PRECISION: u128 = 1_000_000;
pub const PRICE_FLOOR: u128 = 100;                          // $0.0001 per token (100 / 1_000_000)

// Default initial values (used if no ProtocolConfig exists)
pub const DEFAULT_K_QUADRATIC: u128 = 1;                     // k=1 for simple quadratic curve

// Bounds for parameters
pub const DEFAULT_MIN_K_QUADRATIC: u128 = 100;              // Min 0.0001
pub const DEFAULT_MAX_K_QUADRATIC: u128 = 10_000_000;       // Max 10
pub const DEFAULT_MIN_TRADE_AMOUNT: u64 = 1_000_000;        // 1 USDC
