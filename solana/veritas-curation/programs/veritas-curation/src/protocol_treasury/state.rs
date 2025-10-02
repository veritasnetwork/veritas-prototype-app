use anchor_lang::prelude::*;

// Seeds
pub const TREASURY_SEED: &[u8] = b"treasury";

// No balance requirements - expected to zero out each epoch

#[account]
pub struct ProtocolTreasury {
    pub authority: Pubkey,      // 32 bytes
    pub usdc_vault: Pubkey,     // 32 bytes
    pub bump: u8,               // 1 byte
}
// Total: 65 bytes + 8 discriminator = 73 bytes