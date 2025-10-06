use anchor_lang::prelude::*;

declare_id!("67hGzDbbjqirJuaXi3rtKviZuWQ71cMjTZ1b2aFtRkLS");

// Module declarations
pub mod constants;
pub mod errors;
pub mod utils;
pub mod content_pool;
pub mod pool_factory;
pub mod protocol_treasury;
pub mod veritas_custodian;

// Re-exports
pub use errors::*;
pub use content_pool::*;
pub use pool_factory::*;
pub use protocol_treasury::*;
pub use veritas_custodian::*;

#[program]
pub mod veritas_curation {
    use super::*;

    // ============================================================================
    // Protocol Configuration Instructions
    // ============================================================================

    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        content_pool::instructions::initialize_config(ctx)
    }

    // Disabled - references removed reserve_cap fields
    // pub fn update_config(
    //     ctx: Context<UpdateConfig>,
    //     default_k_quadratic: Option<u128>,
    //     default_reserve_cap: Option<u128>,
    //     min_k_quadratic: Option<u128>,
    //     max_k_quadratic: Option<u128>,
    //     min_reserve_cap: Option<u128>,
    //     max_reserve_cap: Option<u128>,
    //     min_trade_amount: Option<u64>,
    // ) -> Result<()> {
    //     content_pool::instructions::update_config(
    //         ctx,
    //         default_k_quadratic,
    //         default_reserve_cap,
    //         min_k_quadratic,
    //         max_k_quadratic,
    //         min_reserve_cap,
    //         max_reserve_cap,
    //         min_trade_amount,
    //     )
    // }

    // ============================================================================
    // ContentPool Instructions
    // ============================================================================

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        post_id: [u8; 32],
        initial_k_quadratic: u128,
        token_name: [u8; 32],
        token_symbol: [u8; 10],
    ) -> Result<()> {
        content_pool::instructions::initialize_pool(
            ctx,
            post_id,
            initial_k_quadratic,
            token_name,
            token_symbol
        )
    }

    pub fn buy(ctx: Context<Buy>, usdc_amount: u64) -> Result<()> {
        content_pool::instructions::buy(ctx, usdc_amount)
    }

    pub fn sell(ctx: Context<Sell>, token_amount: u64) -> Result<()> {
        content_pool::instructions::sell(ctx, token_amount)
    }

    pub fn apply_pool_penalty(
        ctx: Context<ApplyPoolPenalty>,
        penalty_amount: u64,
    ) -> Result<()> {
        content_pool::instructions::apply_pool_penalty(ctx, penalty_amount)
    }

    pub fn apply_pool_reward(
        ctx: Context<ApplyPoolReward>,
        reward_amount: u64,
    ) -> Result<()> {
        content_pool::instructions::apply_pool_reward(ctx, reward_amount)
    }

    // Disabled - references removed reserve_cap fields
    // pub fn set_reserve_cap(
    //     ctx: Context<SetReserveCap>,
    //     new_reserve_cap: u128,
    // ) -> Result<()> {
    //     content_pool::instructions::set_reserve_cap(ctx, new_reserve_cap)
    // }

    // ============================================================================
    // PoolFactory Instructions
    // ============================================================================

    pub fn initialize_factory(
        ctx: Context<InitializeFactory>,
        factory_authority: Pubkey,
        pool_authority: Pubkey,
    ) -> Result<()> {
        pool_factory::instructions::initialize_factory(ctx, factory_authority, pool_authority)
    }

    pub fn create_pool(
        ctx: Context<CreatePool>,
        post_id: [u8; 32],
        initial_k_quadratic: u128,
        token_name: [u8; 32],
        token_symbol: [u8; 10],
    ) -> Result<()> {
        pool_factory::instructions::create_pool(
            ctx,
            post_id,
            initial_k_quadratic,
            token_name,
            token_symbol
        )
    }

    pub fn update_pool_authority(
        ctx: Context<UpdatePoolAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        pool_factory::instructions::update_pool_authority(ctx, new_authority)
    }

    pub fn update_factory_authority(
        ctx: Context<UpdateFactoryAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        pool_factory::instructions::update_factory_authority(ctx, new_authority)
    }

    // ============================================================================
    // ProtocolTreasury Instructions
    // ============================================================================

    pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
        protocol_treasury::instructions::initialize_treasury(ctx)
    }

    pub fn update_treasury_authority(
        ctx: Context<UpdateTreasuryAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        protocol_treasury::instructions::update_treasury_authority(ctx, new_authority)
    }

    // ============================================================================
    // VeritasCustodian Instructions
    // ============================================================================

    pub fn initialize_custodian(
        ctx: Context<InitializeCustodian>,
        owner: Pubkey,
        protocol_authority: Pubkey,
    ) -> Result<()> {
        veritas_custodian::instructions::initialize_custodian(ctx, owner, protocol_authority)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        veritas_custodian::instructions::deposit(ctx, amount)
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        amount: u64,
        recipient: Pubkey,
    ) -> Result<()> {
        veritas_custodian::instructions::withdraw(ctx, amount, recipient)
    }

    pub fn update_protocol_authority(
        ctx: Context<UpdateProtocolAuthority>,
        new_protocol_authority: Pubkey,
    ) -> Result<()> {
        veritas_custodian::instructions::update_protocol_authority(ctx, new_protocol_authority)
    }

    pub fn update_owner(
        ctx: Context<UpdateOwner>,
        new_owner: Pubkey,
    ) -> Result<()> {
        veritas_custodian::instructions::update_owner(ctx, new_owner)
    }

    pub fn toggle_emergency_pause(
        ctx: Context<ToggleEmergencyPause>,
        paused: bool,
    ) -> Result<()> {
        veritas_custodian::instructions::toggle_emergency_pause(ctx, paused)
    }
}
