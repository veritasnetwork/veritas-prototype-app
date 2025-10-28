-- Update rebase parameters
-- 1. Increase minimum new submissions threshold from 2 to 4
-- 2. Document that cooldown period is updated in smart contract (7200s = 2 hours)

-- Update activity threshold in system_config
UPDATE system_config
SET value = '4',
    description = 'Minimum number of new unique belief submissions required since last settlement to allow rebase (increased from 2 to 4 for better data quality)'
WHERE key = 'min_new_submissions_for_rebase';

-- Note: Cooldown period (min_settle_interval) is stored on-chain in ContentPool.min_settle_interval
-- and set by PoolFactory at pool creation time. Updated from 300s (5 min) to 7200s (2 hours) in:
-- - solana/veritas-curation/programs/veritas-curation/src/pool_factory/state.rs
-- - solana/veritas-curation/programs/veritas-curation/src/content_pool/state.rs
