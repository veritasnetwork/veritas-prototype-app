-- Add default bonding curve parameters to system_config

INSERT INTO system_config (key, value) VALUES
    ('default_pool_k_quadratic', '1'),
    ('default_pool_reserve_cap', '5000000000'),
    ('default_pool_linear_slope', '1000000000000'),
    ('default_pool_virtual_liquidity', '1000000000'),
    ('default_pool_supply_offset', '10000')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();
