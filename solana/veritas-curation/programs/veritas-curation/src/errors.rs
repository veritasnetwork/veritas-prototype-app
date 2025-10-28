use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid parameters")]
    InvalidParameters, // 422

    #[msg("Unauthorized access")]
    Unauthorized, // 401

    #[msg("Insufficient balance")]
    InsufficientBalance, // 400

    #[msg("Insufficient pool reserve")]
    InsufficientReserve, // 503

    #[msg("Invalid amount")]
    InvalidAmount, // 422

    #[msg("Numerical overflow")]
    NumericalOverflow, // 503

    #[msg("Transfer failed")]
    TransferFailed, // 503

    #[msg("Invalid factory reference")]
    InvalidFactory, // 422

    #[msg("Invalid authority address")]
    InvalidAuthority, // 422

    #[msg("Invalid post ID")]
    InvalidPostId, // 422

    #[msg("Below minimum amount")]
    BelowMinimum, // 422

    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance, // 503

    #[msg("Account already initialized")]
    AlreadyInitialized, // 422

    #[msg("Pool already exists for post_id")]
    PoolAlreadyExists, // 422

    #[msg("Invalid vault")]
    InvalidVault, // 422

    #[msg("Invalid recipient")]
    InvalidRecipient, // 422

    #[msg("Invalid mint")]
    InvalidMint, // 422

    #[msg("Invalid accounting state")]
    InvalidAccountingState, // 503

    #[msg("System paused")]
    SystemPaused, // 503

    #[msg("Invalid program data account")]
    InvalidProgramData,

    #[msg("Invalid upgrade authority")]
    InvalidUpgradeAuthority,
}
