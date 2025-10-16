-- Update column comments to reflect actual data storage format
-- All pool state data is stored in atomic units (micro-USDC with 6 decimals)

-- pool_deployments: Store atomic units
COMMENT ON COLUMN pool_deployments.token_supply IS 'Token supply in atomic units (6 decimals) - source of truth from Solana';
COMMENT ON COLUMN pool_deployments.reserve IS 'USDC reserve in micro-USDC (6 decimals) - source of truth from Solana';
COMMENT ON COLUMN pool_deployments.k_quadratic IS 'Bonding curve parameter k (display units)';

-- trades: Mixed format for optimal querying
COMMENT ON COLUMN trades.token_amount IS 'Token amount traded in display units (human-readable)';
COMMENT ON COLUMN trades.usdc_amount IS 'USDC amount traded in display units (human-readable)';
COMMENT ON COLUMN trades.token_supply_after IS 'Pool token supply AFTER trade in atomic units (6 decimals)';
COMMENT ON COLUMN trades.reserve_after IS 'Pool USDC reserve AFTER trade in micro-USDC (6 decimals)';
COMMENT ON COLUMN trades.k_quadratic IS 'Bonding curve parameter k (display units) - denormalized for price calculation';
