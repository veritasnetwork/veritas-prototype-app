use anchor_lang::prelude::*;

declare_id!("7ggXQcLpcjLDQEAZvfXicxTD3KCbvfZMnA1KVGd6ivF2");

// Module declarations
pub mod constants;
pub mod errors;
pub mod utils;
pub mod content_pool;
pub mod pool_factory;
pub mod veritas_custodian;

// Re-exports (glob imports needed for Anchor's #[program] macro to find client accounts)
#[allow(ambiguous_glob_reexports)]
pub use content_pool::instructions::*;
pub use content_pool::state::{TokenSide, TradeType};
#[allow(ambiguous_glob_reexports)]
pub use pool_factory::*;
#[allow(ambiguous_glob_reexports)]
pub use veritas_custodian::state::*;
#[allow(ambiguous_glob_reexports)]
pub use veritas_custodian::instructions::*;

#[program]
pub mod veritas_curation {
    use super::*;

    // ============================================================================
    // ContentPool Instructions (ICBS)
    // ============================================================================

    /// Deploy market with initial liquidity (first trader)
    pub fn deploy_market(
        ctx: Context<DeployMarket>,
        initial_deposit: u64,
        long_allocation: u64,
    ) -> Result<()> {
        content_pool::instructions::deploy_market::handler(
            ctx,
            initial_deposit,
            long_allocation,
        )
    }

    /// Trade on the ICBS market (buy or sell LONG/SHORT tokens)
    pub fn trade(
        ctx: Context<Trade>,
        side: TokenSide,
        trade_type: TradeType,
        amount: u64,
        stake_skim: u64,
        min_tokens_out: u64,
        min_usdc_out: u64,
    ) -> Result<()> {
        content_pool::instructions::trade::handler(
            ctx,
            side,
            trade_type,
            amount,
            stake_skim,
            min_tokens_out,
            min_usdc_out,
        )
    }

    /// Add bilateral liquidity to both sides of the market
    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        usdc_amount: u64,
    ) -> Result<()> {
        content_pool::instructions::add_liquidity::handler(ctx, usdc_amount)
    }

    /// Settle epoch with BD score
    pub fn settle_epoch(
        ctx: Context<SettleEpoch>,
        bd_score: u32,
    ) -> Result<()> {
        content_pool::instructions::settle_epoch::handler(ctx, bd_score)
    }

    /// Close an empty pool
    pub fn close_pool(ctx: Context<ClosePool>) -> Result<()> {
        content_pool::instructions::close_pool::handler(ctx)
    }

    /// View-only instruction: Get current pool state with decay applied
    /// Does not mutate on-chain state
    pub fn get_current_state(ctx: Context<GetCurrentState>) -> Result<CurrentPoolState> {
        content_pool::instructions::get_current_state::handler(ctx)
    }

    // ============================================================================
    // PoolFactory Instructions
    // ============================================================================

    pub fn initialize_factory(
        ctx: Context<InitializeFactory>,
        protocol_authority: Pubkey,
        custodian: Pubkey,
        total_fee_bps: u16,
        creator_split_bps: u16,
        protocol_treasury: Pubkey,
    ) -> Result<()> {
        pool_factory::instructions::initialize_factory(
            ctx,
            protocol_authority,
            custodian,
            total_fee_bps,
            creator_split_bps,
            protocol_treasury,
        )
    }

    pub fn create_pool(
        ctx: Context<CreatePool>,
        content_id: Pubkey,
    ) -> Result<()> {
        pool_factory::instructions::create_pool(
            ctx,
            content_id,
        )
    }

    pub fn update_protocol_authority(
        ctx: Context<UpdateProtocolAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        pool_factory::instructions::update_protocol_authority(ctx, new_authority)
    }

    pub fn update_fee_config(
        ctx: Context<UpdateFeeConfig>,
        new_total_fee_bps: Option<u16>,
        new_creator_split_bps: Option<u16>,
        update_treasury: bool,
    ) -> Result<()> {
        pool_factory::instructions::update_fee_config(
            ctx,
            new_total_fee_bps,
            new_creator_split_bps,
            update_treasury,
        )
    }

    pub fn update_defaults(
        ctx: Context<UpdateDefaults>,
        default_f: Option<u16>,
        default_beta_num: Option<u16>,
        default_beta_den: Option<u16>,
        default_p0: Option<u64>,
        min_initial_deposit: Option<u64>,
        min_settle_interval: Option<i64>,
    ) -> Result<()> {
        pool_factory::instructions::update_defaults(
            ctx,
            default_f,
            default_beta_num,
            default_beta_den,
            default_p0,
            min_initial_deposit,
            min_settle_interval,
        )
    }

    // ============================================================================
    // VeritasCustodian Instructions
    // ============================================================================

    pub fn initialize_custodian(
        ctx: Context<InitializeCustodian>,
        protocol_authority: Pubkey,
    ) -> Result<()> {
        veritas_custodian::instructions::initialize_custodian(ctx, protocol_authority)
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

    pub fn update_custodian_protocol_authority(
        ctx: Context<UpdateCustodianProtocolAuthority>,
        new_protocol_authority: Pubkey,
    ) -> Result<()> {
        veritas_custodian::instructions::update_protocol_authority::update_protocol_authority(ctx, new_protocol_authority)
    }

    pub fn toggle_emergency_pause(
        ctx: Context<ToggleEmergencyPause>,
        paused: bool,
    ) -> Result<()> {
        veritas_custodian::instructions::toggle_emergency_pause(ctx, paused)
    }
}
