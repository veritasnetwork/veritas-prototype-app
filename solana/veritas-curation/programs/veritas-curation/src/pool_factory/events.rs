use anchor_lang::prelude::*;

#[event]
pub struct FactoryInitializedEvent {
    pub factory: Pubkey,
    pub factory_authority: Pubkey,
    pub pool_authority: Pubkey,
    pub custodian: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PoolCreatedEvent {
    pub pool: Pubkey,
    pub content_id: Pubkey,
    pub creator: Pubkey,
    pub f: u16,
    pub beta_num: u16,
    pub beta_den: u16,
    pub registry: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PoolAuthorityUpdatedEvent {
    pub factory: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct FactoryAuthorityUpdatedEvent {
    pub factory: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
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
