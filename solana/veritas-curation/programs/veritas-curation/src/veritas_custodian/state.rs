use anchor_lang::prelude::*;

#[account]
pub struct VeritasCustodian {
    pub protocol_authority: Pubkey, // Authority for operations (upgrade authority controls governance) (32 bytes)
    pub usdc_vault: Pubkey,         // Pooled USDC vault (32 bytes)
    pub total_deposits: u128,       // Total lifetime deposits (16 bytes)
    pub total_withdrawals: u128,    // Total lifetime withdrawals (16 bytes)
    pub emergency_pause: bool,      // Pause withdrawals in emergency (1 byte)
    pub bump: u8,                   // PDA bump seed (1 byte)
}

impl VeritasCustodian {
    // protocol_authority(32) + usdc_vault(32) + total_deposits(16) + total_withdrawals(16) + emergency_pause(1) + bump(1)
    pub const LEN: usize = 32 + 32 + 16 + 16 + 1 + 1; // 98 bytes
}
// Total: 98 bytes + 8 discriminator = 106 bytes

// Events for off-chain indexing
#[event]
pub struct DepositEvent {
    pub depositor: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawEvent {
    pub recipient: Pubkey,
    pub amount: u64,
    pub authority: Pubkey,
    pub timestamp: i64,
}

// Seeds
pub const CUSTODIAN_SEED: &[u8] = b"custodian";

// Minimums (in USDC with 6 decimals)
pub const MIN_DEPOSIT: u64 = 1_000_000;     // 1 USDC

// USDC has 6 decimals
pub const USDC_DECIMALS: u8 = 6;