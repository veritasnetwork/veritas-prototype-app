use anchor_lang::prelude::*;

#[event]
pub struct FactoryInitializedEvent {
    pub factory: Pubkey,
    pub protocol_authority: Pubkey,
    pub custodian: Pubkey,
    pub total_fee_bps: u16,
    pub creator_split_bps: u16,
    pub protocol_treasury: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PoolCreatedEvent {
    pub pool: Pubkey,
    pub content_id: Pubkey,
    pub creator: Pubkey,
    pub post_creator: Pubkey,  // NEW
    pub f: u16,
    pub beta_num: u16,
    pub beta_den: u16,
    pub registry: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolAuthorityUpdatedEvent {
    pub factory: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct FeeConfigUpdatedEvent {
    pub factory: Pubkey,
    pub total_fee_bps: u16,
    pub creator_split_bps: u16,
    pub protocol_treasury: Pubkey,
    pub updated_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct DefaultsUpdatedEvent {
    pub factory: Pubkey,
    pub default_f: u16,
    pub default_beta_num: u16,
    pub default_beta_den: u16,
    pub default_p0: u64,
    pub min_initial_deposit: u64,
    pub min_settle_interval: i64,
    pub timestamp: i64,
}
