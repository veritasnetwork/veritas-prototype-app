-- Add atomic pool deployment function with advisory locks
-- Prevents duplicate pool deployments for the same post

CREATE OR REPLACE FUNCTION "public"."deploy_pool_with_lock"(
  p_post_id uuid,
  p_pool_address text,
  p_belief_id uuid,
  p_long_mint_address text,
  p_short_mint_address text,
  p_deployment_tx_signature text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock_id bigint;
  v_existing_pool text;
BEGIN
  -- 1. Generate advisory lock ID from post_id
  -- Remove hyphens and convert first 16 hex chars of UUID to bigint for lock ID
  v_lock_id := ('x' || substring(replace(p_post_id::text, '-', ''), 1, 16))::bit(64)::bigint;

  -- 2. Try to acquire advisory lock (released at transaction end)
  IF NOT pg_try_advisory_xact_lock(v_lock_id) THEN
    -- Another deployment in progress for this post
    RETURN jsonb_build_object(
      'success', false,
      'error', 'LOCKED',
      'message', 'Pool deployment already in progress for this post'
    );
  END IF;

  -- 3. Check if pool already exists (now safe due to lock)
  SELECT pool_address INTO v_existing_pool
  FROM pool_deployments
  WHERE post_id = p_post_id;

  IF v_existing_pool IS NOT NULL THEN
    -- Pool already deployed
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXISTS',
      'pool_address', v_existing_pool,
      'message', 'Pool already deployed for this post'
    );
  END IF;

  -- 4. Insert pool deployment record
  -- Use ON CONFLICT because event indexer might have written already
  INSERT INTO pool_deployments (
    post_id,
    pool_address,
    belief_id,
    long_mint_address,
    short_mint_address,
    deployment_tx_signature,
    status,
    deployed_at
  ) VALUES (
    p_post_id,
    p_pool_address,
    p_belief_id,
    p_long_mint_address,
    p_short_mint_address,
    p_deployment_tx_signature,
    'market_deployed',
    NOW()
  )
  ON CONFLICT (pool_address) DO UPDATE SET
    status = 'market_deployed',
    deployed_at = COALESCE(pool_deployments.deployed_at, NOW());

  -- 5. Record initial implied relevance (0.5 for balanced deployment)
  -- Initial deployment has equal reserves, so implied relevance = 0.5
  INSERT INTO implied_relevance_history (
    post_id,
    belief_id,
    implied_relevance,
    reserve_long,
    reserve_short,
    event_type,
    event_reference,
    confirmed,
    recorded_by,
    recorded_at
  ) VALUES (
    p_post_id,
    p_belief_id,
    0.5,  -- Always 0.5 at deployment (equal reserves)
    25000000,  -- Default initial reserve (25 USDC in micro-USDC units)
    25000000,
    'deployment',
    p_pool_address,  -- Use pool address as event reference for deployments
    false,
    'server',
    NOW()
  )
  ON CONFLICT (event_reference) DO NOTHING;  -- Idempotent

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'pool_address', p_pool_address
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'deploy_pool_with_lock error: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXCEPTION',
      'message', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION deploy_pool_with_lock IS 'Atomically deploys pool with advisory lock to prevent duplicates';
