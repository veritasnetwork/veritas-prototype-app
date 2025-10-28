use anchor_lang::prelude::*;

#[error_code]
pub enum FactoryError {
    // Initialization (7000-7009)
    #[msg("Factory already initialized")]
    AlreadyInitialized = 7000,
    #[msg("Invalid authority address")]
    InvalidAuthority = 7001,

    // Pool creation (7010-7019)
    #[msg("Pool already exists for content_id")]
    PoolAlreadyExists = 7010,
    #[msg("Invalid content_id")]
    InvalidContentId = 7011,
    #[msg("Invalid ICBS parameters")]
    InvalidParameters = 7012,

    // Authority (7020-7029)
    #[msg("Unauthorized (not factory authority)")]
    Unauthorized = 7020,
    #[msg("Unauthorized protocol authority")]
    UnauthorizedProtocol = 7021,

    // Parameters (7030-7039)
    #[msg("Invalid growth exponent F")]
    InvalidF = 7030,
    #[msg("Invalid coupling coefficient β")]
    InvalidBeta = 7031,
    #[msg("Invalid minimum deposit")]
    InvalidMinDeposit = 7032,
    #[msg("Invalid settle interval")]
    InvalidSettleInterval = 7033,

    // Upgrade Authority & Governance (7040-7049)
    #[msg("Invalid upgrade authority")]
    InvalidUpgradeAuthority = 7040,
    #[msg("Invalid program data")]
    InvalidProgramData = 7041,
    #[msg("Invalid fee configuration")]
    InvalidFeeConfiguration = 7042,
    #[msg("Invalid creator split - must be <= 10000 basis points")]
    InvalidCreatorSplit = 7043,
    #[msg("Fee calculation overflow")]
    FeeCalculationOverflow = 7044,
}
