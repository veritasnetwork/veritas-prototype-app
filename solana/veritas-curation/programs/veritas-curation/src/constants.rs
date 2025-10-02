// Precision (immutable)
pub const USDC_DECIMALS: u8 = 6;
pub const RATIO_PRECISION: u128 = 1_000_000;

// Default initial values (used if no ProtocolConfig exists)
pub const DEFAULT_K_QUADRATIC: u128 = 1_000;        // 0.000001 in real terms
pub const DEFAULT_SUPPLY_CAP: u128 = 100_000_000_000; // 100,000 tokens with 6 decimals
pub const DEFAULT_MIN_K_QUADRATIC: u128 = 100;      // 0.0000001 (very flat)
pub const DEFAULT_MAX_K_QUADRATIC: u128 = 10_000;   // 0.00001 (very steep)
pub const DEFAULT_MIN_SUPPLY_CAP: u128 = 10_000_000_000;   // 10,000 tokens
pub const DEFAULT_MAX_SUPPLY_CAP: u128 = 1_000_000_000_000; // 1,000,000 tokens
pub const DEFAULT_MIN_TRADE_AMOUNT: u64 = 1_000_000; // 1 USDC
