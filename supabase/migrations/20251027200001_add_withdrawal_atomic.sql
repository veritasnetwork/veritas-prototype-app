-- Add atomic withdrawal recording function
-- This ensures withdrawal record and stake update happen in the same transaction
-- Following the same pattern as record_trade_atomic for consistency

CREATE OR REPLACE FUNCTION record_withdrawal_atomic(
  p_agent_id uuid,
  p_amount_usdc numeric,  -- Display USDC
  p_tx_signature text,
  p_wallet_address text,
  p_authority_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_withdrawal_id uuid;
  v_amount_micro bigint;
  v_current_stake bigint;
  v_row_inserted boolean;
BEGIN
  -- Convert display USDC to micro-USDC
  v_amount_micro := (p_amount_usdc * 1000000)::bigint;

  -- Validate amount
  IF v_amount_micro <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be positive';
  END IF;

  -- Get current stake and lock row for update
  SELECT total_stake INTO v_current_stake
  FROM agents
  WHERE id = p_agent_id
  FOR UPDATE;

  IF v_current_stake IS NULL THEN
    RAISE EXCEPTION 'Agent not found: %', p_agent_id;
  END IF;

  -- Check sufficient balance (basic check - full withdrawable calculation done in API)
  IF v_current_stake < v_amount_micro THEN
    RAISE EXCEPTION 'Insufficient stake balance. Current: %, Requested: %', v_current_stake, v_amount_micro;
  END IF;

  -- Try to insert withdrawal record (optimistic - unconfirmed until event indexer processes)
  -- Use DO NOTHING to prevent conflicts from duplicates
  INSERT INTO custodian_withdrawals (
    tx_signature,
    recipient_address,
    amount_usdc,
    recorded_by,
    confirmed,
    requested_at,
    agent_id,
    status
  ) VALUES (
    p_tx_signature,
    p_wallet_address,
    p_amount_usdc,  -- Store in display USDC (per table spec)
    'server',
    false,  -- Unconfirmed until indexer processes it
    NOW(),
    p_agent_id,
    'pending'
  )
  ON CONFLICT (tx_signature) DO NOTHING
  RETURNING id INTO v_withdrawal_id;

  -- Check if we actually inserted a new row (prevents double-crediting on duplicates)
  GET DIAGNOSTICS v_row_inserted = ROW_COUNT;

  -- Only update stake if we inserted a new withdrawal record
  IF v_row_inserted THEN
    UPDATE agents
    SET
      total_stake = GREATEST(0, total_stake - v_amount_micro),
      updated_at = NOW()
    WHERE id = p_agent_id;
  ELSE
    -- Get existing withdrawal_id for response
    SELECT id INTO v_withdrawal_id
    FROM custodian_withdrawals
    WHERE tx_signature = p_tx_signature;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'amount_micro', v_amount_micro,
    'new_stake', (SELECT total_stake FROM agents WHERE id = p_agent_id),
    'was_duplicate', NOT v_row_inserted
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Automatic rollback on any error
    RAISE NOTICE 'Withdrawal failed: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;