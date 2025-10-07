-- Fix record_pool_deployment function to remove obsolete parameters
-- This function was broken after migration 20250207 removed reserve_cap, linear_slope, virtual_liquidity columns

-- Drop the old function with obsolete parameters
DROP FUNCTION IF EXISTS record_pool_deployment(
    UUID, UUID, TEXT, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC
);

-- Create new version with only k_quadratic (pure quadratic curve)
CREATE OR REPLACE FUNCTION record_pool_deployment(
    p_post_id UUID,
    p_belief_id UUID,
    p_pool_address TEXT,
    p_vault_address TEXT,
    p_mint_address TEXT,
    p_deployed_by_agent_id UUID,
    p_tx_signature TEXT,
    p_k_quadratic NUMERIC
) RETURNS UUID AS $$
DECLARE
    v_deployment_id UUID;
BEGIN
    INSERT INTO pool_deployments (
        post_id,
        belief_id,
        pool_address,
        usdc_vault_address,
        token_mint_address,
        deployed_by_agent_id,
        deployment_tx_signature,
        k_quadratic
    ) VALUES (
        p_post_id,
        p_belief_id,
        p_pool_address,
        p_vault_address,
        p_mint_address,
        p_deployed_by_agent_id,
        p_tx_signature,
        p_k_quadratic
    ) RETURNING id INTO v_deployment_id;

    RETURN v_deployment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment documenting the change
COMMENT ON FUNCTION record_pool_deployment IS
'Records a new pool deployment. Updated to pure quadratic curve (removed reserve_cap, linear_slope, virtual_liquidity).';