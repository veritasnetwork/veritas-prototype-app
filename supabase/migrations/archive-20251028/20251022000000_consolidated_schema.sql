-- ============================================================================
-- Veritas Protocol - Consolidated Schema
-- ============================================================================
-- This migration consolidates all previous migrations (00_initial_schema.sql 
-- through 20251027000005_add_advisory_lock_functions.sql) into a single file.
--
-- Previous migrations archived in: supabase/migrations/archive/
--
-- Generated: October 2025
-- Schema dump date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- SCHEMA
-- ============================================================================

COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."add_agent_stake"("p_agent_id" "uuid", "p_amount" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Update agent's total stake
    UPDATE agents
    SET total_stake = total_stake + p_amount,
        updated_at = NOW()
    WHERE id = p_agent_id;

    -- Also update the user's total_stake field
    UPDATE users
    SET total_stake = total_stake + p_amount,
        updated_at = NOW()
    WHERE agent_id = p_agent_id;
END;
$$;


ALTER FUNCTION "public"."add_agent_stake"("p_agent_id" "uuid", "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_skim_with_lock"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) RETURNS TABLE("skim_amount" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_current_stake BIGINT;
  v_total_locks BIGINT;
  v_old_lock_this_side BIGINT;
  v_new_lock BIGINT;
  v_required_locks BIGINT;
BEGIN
  -- Get current stake
  SELECT COALESCE(total_stake, 0) INTO v_current_stake
  FROM agents WHERE solana_address = p_wallet_address FOR UPDATE;

  -- Get sum of all belief locks for open positions
  SELECT COALESCE(SUM(belief_lock), 0) INTO v_total_locks
  FROM user_pool_balances
  WHERE user_id = p_user_id AND token_balance > 0;

  -- Get current lock for this specific pool/side (to be replaced)
  SELECT belief_lock INTO v_old_lock_this_side
  FROM user_pool_balances
  WHERE user_id = p_user_id
    AND pool_address = p_pool_address
    AND token_type = p_side;

  -- If no row found, v_old_lock_this_side will be NULL, so set to 0
  v_old_lock_this_side := COALESCE(v_old_lock_this_side, 0);

  -- Calculate new lock for this trade (2% of trade amount = divide by 50)
  v_new_lock := (p_trade_amount_micro / 50)::BIGINT;

  -- Calculate required locks after this trade
  -- (all existing locks - old lock for this side + new lock for this side)
  v_required_locks := v_total_locks - v_old_lock_this_side + v_new_lock;

  -- Return skim = max(0, required - current)
  RETURN QUERY SELECT GREATEST(0::BIGINT, v_required_locks - v_current_stake);
END;
$$;


ALTER FUNCTION "public"."calculate_skim_with_lock"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_epoch_status"() RETURNS TABLE("current_epoch" integer, "epoch_start_time" timestamp with time zone, "time_remaining_seconds" integer, "next_deadline" timestamp with time zone, "processing_enabled" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    config_row RECORD;
    start_time TIMESTAMPTZ;
    deadline TIMESTAMPTZ;
    duration_sec INTEGER;
BEGIN
    -- Get all config values in one query
    SELECT
        MAX(CASE WHEN key = 'current_epoch' THEN value::INTEGER END) as curr_epoch,
        MAX(CASE WHEN key = 'current_epoch_start_time' THEN value::TIMESTAMPTZ END) as start_tm,
        MAX(CASE WHEN key = 'next_epoch_deadline' THEN value::TIMESTAMPTZ END) as deadline_tm,
        MAX(CASE WHEN key = 'epoch_duration_seconds' THEN value::INTEGER END) as duration
    INTO config_row
    FROM system_config
    WHERE key IN (
        'current_epoch',
        'current_epoch_start_time',
        'next_epoch_deadline',
        'epoch_duration_seconds'
    );

    -- Calculate time remaining
    start_time := COALESCE(config_row.start_tm, NOW());
    deadline := COALESCE(config_row.deadline_tm, start_time + INTERVAL '1 hour');
    duration_sec := GREATEST(0, EXTRACT(EPOCH FROM (deadline - NOW()))::INTEGER);

    -- Return results
    current_epoch := COALESCE(config_row.curr_epoch, 0);
    epoch_start_time := start_time;
    time_remaining_seconds := duration_sec;
    next_deadline := deadline;
    processing_enabled := true;

    RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."get_epoch_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pool_with_stats"("p_post_id" "uuid") RETURNS TABLE("pool_address" "text", "long_mint_address" "text", "short_mint_address" "text", "market_address" "text", "status" "text", "deployed_at" timestamp with time zone, "pool_created_at" timestamp with time zone, "market_deployed_at" timestamp with time zone, "fee_rate_bps" integer, "strike_ratio_num" bigint, "strike_ratio_den" bigint, "total_long_supply" numeric, "total_short_supply" numeric, "total_usdc_reserve" numeric, "sqrt_price_long" numeric, "sqrt_price_short" numeric, "last_synced_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.pool_address,
    pd.long_mint_address,
    pd.short_mint_address,
    pd.market_address,
    pd.status,
    pd.deployed_at,
    pd.pool_created_at,
    pd.market_deployed_at,
    pd.fee_rate_bps,
    pd.strike_ratio_num,
    pd.strike_ratio_den,
    pd.total_long_supply,
    pd.total_short_supply,
    pd.total_usdc_reserve,
    pd.sqrt_price_long,
    pd.sqrt_price_short,
    pd.last_synced_at
  FROM pool_deployments pd
  WHERE pd.post_id = p_post_id;
END;
$$;


ALTER FUNCTION "public"."get_pool_with_stats"("p_post_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_pool_with_stats"("p_post_id" "uuid") IS 'Get pool deployment info and stats for a post (ICBS version)';



CREATE OR REPLACE FUNCTION "public"."pg_advisory_lock"("lock_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM pg_advisory_lock(lock_id);
END;
$$;


ALTER FUNCTION "public"."pg_advisory_lock"("lock_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pg_advisory_unlock"("lock_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM pg_advisory_unlock(lock_id);
END;
$$;


ALTER FUNCTION "public"."pg_advisory_unlock"("lock_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_pool_deployment"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_vault_address" "text", "p_mint_address" "text", "p_deployed_by_agent_id" "uuid", "p_tx_signature" "text", "p_k_quadratic" numeric) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."record_pool_deployment"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_vault_address" "text", "p_mint_address" "text", "p_deployed_by_agent_id" "uuid", "p_tx_signature" "text", "p_k_quadratic" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_pool_deployment"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_vault_address" "text", "p_mint_address" "text", "p_deployed_by_agent_id" "uuid", "p_tx_signature" "text", "p_k_quadratic" numeric) IS 'Records a new pool deployment. Updated to pure quadratic curve (removed reserve_cap, linear_slope, virtual_liquidity).';



CREATE OR REPLACE FUNCTION "public"."sync_agent_stake_from_chain"("p_agent_id" "uuid", "p_solana_address" "text", "p_onchain_balance" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE agents
    SET
        solana_address = p_solana_address,
        total_stake = p_onchain_balance,
        last_synced_at = NOW()
    WHERE id = p_agent_id;
END;
$$;


ALTER FUNCTION "public"."sync_agent_stake_from_chain"("p_agent_id" "uuid", "p_solana_address" "text", "p_onchain_balance" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pool_state"("p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE pool_deployments
    SET
        token_supply = p_token_supply,
        reserve = p_reserve,
        last_synced_at = NOW()
    WHERE pool_address = p_pool_address;
END;
$$;


ALTER FUNCTION "public"."update_pool_state"("p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stake_atomic"("p_agent_id" "uuid", "p_delta_micro" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE agents SET total_stake = GREATEST(0, total_stake + p_delta_micro) WHERE id = p_agent_id;
END;
$$;


ALTER FUNCTION "public"."update_stake_atomic"("p_agent_id" "uuid", "p_delta_micro" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_balance_after_trade"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Upsert user balance
  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    post_id,
    token_balance,
    total_bought,
    total_sold,
    total_usdc_spent,
    total_usdc_received,
    first_trade_at,
    last_trade_at
  ) VALUES (
    NEW.user_id,
    NEW.pool_address,
    NEW.post_id,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE -NEW.token_amount END,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    NEW.recorded_at,
    NEW.recorded_at
  )
  ON CONFLICT (user_id, pool_address) DO UPDATE SET
    token_balance = user_pool_balances.token_balance +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE -NEW.token_amount END,
    total_bought = user_pool_balances.total_bought +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    total_sold = user_pool_balances.total_sold +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    total_usdc_spent = user_pool_balances.total_usdc_spent +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    total_usdc_received = user_pool_balances.total_usdc_received +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    last_trade_at = NEW.recorded_at,
    updated_at = NOW();

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_balance_after_trade"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_user_balance_after_trade"() IS 'Auto-updates user_pool_balances when trade is inserted';



CREATE OR REPLACE FUNCTION "public"."update_user_balance_after_trade_safe"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Get current balance if exists
  SELECT token_balance INTO v_current_balance
  FROM user_pool_balances
  WHERE user_id = NEW.user_id
    AND pool_address = NEW.pool_address;

  -- Calculate new balance
  IF v_current_balance IS NULL THEN
    -- First trade - initialize
    IF NEW.trade_type = 'buy' THEN
      v_new_balance := NEW.token_amount;
    ELSE
      -- Selling without buying first? Use 0
      v_new_balance := 0;
    END IF;
  ELSE
    -- Update existing balance
    IF NEW.trade_type = 'buy' THEN
      v_new_balance := v_current_balance + NEW.token_amount;
    ELSE
      v_new_balance := GREATEST(0, v_current_balance - NEW.token_amount);
    END IF;
  END IF;

  -- Upsert the balance (won't fail on constraint violations)
  INSERT INTO user_pool_balances (
    user_id,
    pool_address,
    post_id,
    token_balance,
    total_bought,
    total_sold,
    total_usdc_spent,
    total_usdc_received,
    first_trade_at,
    last_trade_at
  ) VALUES (
    NEW.user_id,
    NEW.pool_address,
    NEW.post_id,
    v_new_balance,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    NEW.recorded_at,
    NEW.recorded_at
  )
  ON CONFLICT (user_id, pool_address) DO UPDATE SET
    token_balance = GREATEST(0, v_new_balance), -- Never go negative
    total_bought = user_pool_balances.total_bought +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.token_amount ELSE 0 END,
    total_sold = user_pool_balances.total_sold +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.token_amount ELSE 0 END,
    total_usdc_spent = user_pool_balances.total_usdc_spent +
      CASE WHEN NEW.trade_type = 'buy' THEN NEW.usdc_amount ELSE 0 END,
    total_usdc_received = user_pool_balances.total_usdc_received +
      CASE WHEN NEW.trade_type = 'sell' THEN NEW.usdc_amount ELSE 0 END,
    last_trade_at = NEW.recorded_at,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the trade insertion
    RAISE WARNING 'Failed to update user balance: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_balance_after_trade_safe"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "solana_address" "text",
    "total_stake" bigint DEFAULT 0 NOT NULL,
    "total_deposited" numeric DEFAULT 0,
    "total_withdrawn" numeric DEFAULT 0,
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agents_total_stake_non_negative" CHECK (("total_stake" >= 0)),
    CONSTRAINT "agents_total_stake_positive" CHECK ((("total_stake")::numeric >= (0)::numeric))
);


ALTER TABLE "public"."agents" OWNER TO "postgres";


COMMENT ON TABLE "public"."agents" IS 'Protocol-level agents with Solana wallet integration and stake tracking. Stake locks tracked per-pool in user_pool_balances.';



COMMENT ON COLUMN "public"."agents"."solana_address" IS 'User''s Solana wallet address - primary identity for the protocol';



COMMENT ON COLUMN "public"."agents"."total_deposited" IS 'Total USDC deposited into custodian (all time)';



COMMENT ON COLUMN "public"."agents"."total_withdrawn" IS 'Total USDC withdrawn from custodian (all time)';



COMMENT ON COLUMN "public"."agents"."last_synced_at" IS 'Last time total_stake was synced from on-chain custodian';



CREATE TABLE IF NOT EXISTS "public"."belief_relevance_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "belief_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "epoch" integer NOT NULL,
    "aggregate" numeric NOT NULL,
    "certainty" numeric NOT NULL,
    "disagreement_entropy" numeric,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "belief_relevance_history_aggregate_check" CHECK ((("aggregate" >= (0)::numeric) AND ("aggregate" <= (1)::numeric))),
    CONSTRAINT "belief_relevance_history_certainty_check" CHECK ((("certainty" >= (0)::numeric) AND ("certainty" <= (1)::numeric)))
);


ALTER TABLE "public"."belief_relevance_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."belief_relevance_history" IS 'Historical belief metrics per epoch for delta relevance charts';



COMMENT ON COLUMN "public"."belief_relevance_history"."aggregate" IS 'Absolute BD relevance score [0,1] for this epoch (used for pool settlement)';



CREATE TABLE IF NOT EXISTS "public"."belief_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "belief_id" "uuid" NOT NULL,
    "belief" numeric(10,8) NOT NULL,
    "meta_prediction" numeric(10,8) NOT NULL,
    "epoch" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "belief_submissions_belief_check" CHECK ((("belief" >= (0)::numeric) AND ("belief" <= (1)::numeric))),
    CONSTRAINT "belief_submissions_meta_prediction_check" CHECK ((("meta_prediction" >= (0)::numeric) AND ("meta_prediction" <= (1)::numeric)))
);


ALTER TABLE "public"."belief_submissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."belief_submissions" IS 'Agent submissions to belief markets with belief and meta-prediction';



CREATE TABLE IF NOT EXISTS "public"."beliefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_agent_id" "uuid" NOT NULL,
    "created_epoch" integer DEFAULT 0 NOT NULL,
    "previous_aggregate" numeric(10,8) DEFAULT 0.5 NOT NULL,
    "previous_disagreement_entropy" numeric(10,8) DEFAULT 0.0 NOT NULL,
    "certainty" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "beliefs_certainty_check" CHECK ((("certainty" >= (0)::numeric) AND ("certainty" <= (1)::numeric))),
    CONSTRAINT "beliefs_previous_aggregate_check" CHECK ((("previous_aggregate" >= (0)::numeric) AND ("previous_aggregate" <= (1)::numeric)))
);


ALTER TABLE "public"."beliefs" OWNER TO "postgres";


COMMENT ON TABLE "public"."beliefs" IS 'Belief markets for intersubjective consensus using Bayesian Truth Serum (persist indefinitely)';



COMMENT ON COLUMN "public"."beliefs"."certainty" IS 'Certainty metric from learning assessment (NOT uncertainty)';



CREATE TABLE IF NOT EXISTS "public"."custodian_deposits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "depositor_address" "text" NOT NULL,
    "amount_usdc" numeric NOT NULL,
    "tx_signature" "text" NOT NULL,
    "block_time" timestamp with time zone,
    "slot" bigint,
    "indexed_at" timestamp with time zone DEFAULT "now"(),
    "agent_credited" boolean DEFAULT false,
    "credited_at" timestamp with time zone,
    "agent_id" "uuid",
    "deposit_type" "text" DEFAULT 'direct'::"text",
    "recorded_by" "text" DEFAULT 'indexer'::"text",
    "confirmed" boolean DEFAULT false,
    CONSTRAINT "custodian_deposits_deposit_type_check" CHECK (("deposit_type" = ANY (ARRAY['trade_skim'::"text", 'direct'::"text"]))),
    CONSTRAINT "custodian_deposits_recorded_by_check" CHECK (("recorded_by" = ANY (ARRAY['server'::"text", 'indexer'::"text"])))
);


ALTER TABLE "public"."custodian_deposits" OWNER TO "postgres";


COMMENT ON TABLE "public"."custodian_deposits" IS 'Event log for USDC deposits into VeritasCustodian contracts (indexed via webhook)';



COMMENT ON COLUMN "public"."custodian_deposits"."deposit_type" IS 'Whether deposit came from trade skim or direct deposit';



COMMENT ON COLUMN "public"."custodian_deposits"."recorded_by" IS 'Which system created this record first (server or indexer)';



COMMENT ON COLUMN "public"."custodian_deposits"."confirmed" IS 'Has on-chain event verified this transaction?';



CREATE TABLE IF NOT EXISTS "public"."custodian_withdrawals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "amount_usdc" numeric NOT NULL,
    "recipient_address" "text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "requested_by_user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "tx_signature" "text",
    "processed_at" timestamp with time zone,
    "block_time" timestamp with time zone,
    "rejection_reason" "text",
    "failure_reason" "text",
    "recorded_by" "text" DEFAULT 'indexer'::"text",
    "confirmed" boolean DEFAULT false,
    CONSTRAINT "custodian_withdrawals_recorded_by_check" CHECK (("recorded_by" = ANY (ARRAY['server'::"text", 'indexer'::"text"]))),
    CONSTRAINT "custodian_withdrawals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."custodian_withdrawals" OWNER TO "postgres";


COMMENT ON TABLE "public"."custodian_withdrawals" IS 'Withdrawal requests and execution status';



COMMENT ON COLUMN "public"."custodian_withdrawals"."recorded_by" IS 'Which system created this record first (server or indexer)';



COMMENT ON COLUMN "public"."custodian_withdrawals"."confirmed" IS 'Has on-chain event verified this transaction?';



CREATE TABLE IF NOT EXISTS "public"."epoch_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "epoch_number" integer NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "ended_at" timestamp with time zone,
    "scheduled_duration_seconds" integer NOT NULL,
    "actual_duration_seconds" integer,
    "processing_triggered_at" timestamp with time zone,
    "processing_completed_at" timestamp with time zone,
    "processing_duration_ms" integer,
    "beliefs_processed" integer DEFAULT 0,
    "beliefs_expired" integer DEFAULT 0,
    "manual_triggered" boolean DEFAULT false,
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "epoch_history_duration_positive" CHECK (("scheduled_duration_seconds" > 0)),
    CONSTRAINT "epoch_history_epoch_number_positive" CHECK (("epoch_number" >= 0)),
    CONSTRAINT "epoch_history_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'failed'::"text", 'timeout'::"text"]))),
    CONSTRAINT "epoch_history_timing_consistent" CHECK (((("ended_at" IS NULL) OR ("ended_at" >= "started_at")) AND (("processing_completed_at" IS NULL) OR ("processing_triggered_at" IS NULL) OR ("processing_completed_at" >= "processing_triggered_at"))))
);


ALTER TABLE "public"."epoch_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."epoch_history" IS 'Tracks epoch transitions, processing metrics, and timing accuracy';



CREATE TABLE IF NOT EXISTS "public"."pool_deployments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "belief_id" "uuid" NOT NULL,
    "pool_address" "text" NOT NULL,
    "deployed_at" timestamp with time zone DEFAULT "now"(),
    "deployed_by_agent_id" "uuid",
    "deployment_tx_signature" "text",
    "token_supply" numeric DEFAULT 0,
    "reserve" numeric DEFAULT 0,
    "last_synced_at" timestamp with time zone,
    "f" integer DEFAULT 1,
    "beta_num" integer DEFAULT 1,
    "beta_den" integer DEFAULT 2,
    "long_mint_address" "text",
    "short_mint_address" "text",
    "status" "text" DEFAULT 'pool_created'::"text" NOT NULL,
    "sqrt_price_long_x96" "text",
    "sqrt_price_short_x96" "text",
    "s_long_supply" numeric,
    "s_short_supply" numeric,
    "vault_balance" numeric,
    "sqrt_lambda_long_x96" "text",
    "sqrt_lambda_short_x96" "text",
    "initial_usdc" numeric,
    "initial_long_allocation" numeric,
    "initial_short_allocation" numeric,
    "r_long" numeric,
    "r_short" numeric,
    "market_deployed_at" timestamp with time zone,
    "market_deployment_tx_signature" "text",
    "last_settlement_epoch" integer,
    "last_settlement_tx" "text",
    "current_epoch" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "pool_deployments_status_check" CHECK (("status" = ANY (ARRAY['pool_created'::"text", 'market_deployed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."pool_deployments" OWNER TO "postgres";


COMMENT ON TABLE "public"."pool_deployments" IS 'Tracks ContentPool deployments on Solana. ICBS two-sided market with LONG/SHORT tokens. Schema aligned with ContentPool smart contract v2.';



COMMENT ON COLUMN "public"."pool_deployments"."token_supply" IS 'DEPRECATED: Old single-sided token supply. Use s_long_supply and s_short_supply instead.';



COMMENT ON COLUMN "public"."pool_deployments"."reserve" IS 'DEPRECATED: Old single-sided reserve. Use r_long and r_short instead.';



COMMENT ON COLUMN "public"."pool_deployments"."last_synced_at" IS 'Last time pool data was synced from Solana';



COMMENT ON COLUMN "public"."pool_deployments"."f" IS 'ICBS growth exponent (FIXED at 1 for all pools)';



COMMENT ON COLUMN "public"."pool_deployments"."beta_num" IS 'ICBS β numerator (default: 1)';



COMMENT ON COLUMN "public"."pool_deployments"."beta_den" IS 'ICBS β denominator (default: 2, so β = 0.5)';



COMMENT ON COLUMN "public"."pool_deployments"."long_mint_address" IS 'SPL token mint for LONG tokens (created on pool initialization)';



COMMENT ON COLUMN "public"."pool_deployments"."short_mint_address" IS 'SPL token mint for SHORT tokens (created on pool initialization)';



COMMENT ON COLUMN "public"."pool_deployments"."status" IS 'Deployment status: pool_created (pool exists but no liquidity), market_deployed (fully deployed with liquidity), failed (deployment failed)';



COMMENT ON COLUMN "public"."pool_deployments"."sqrt_price_long_x96" IS 'Cached LONG token sqrt price in X96 format from on-chain';



COMMENT ON COLUMN "public"."pool_deployments"."sqrt_price_short_x96" IS 'Cached SHORT token sqrt price in X96 format from on-chain';



COMMENT ON COLUMN "public"."pool_deployments"."s_long_supply" IS 'LONG token supply in atomic units (6 decimals). On-chain ContentPool.s_long stores display units; converted to atomic for DB storage (display × 1,000,000).';



COMMENT ON COLUMN "public"."pool_deployments"."s_short_supply" IS 'SHORT token supply in atomic units (6 decimals). On-chain ContentPool.s_short stores display units; converted to atomic for DB storage (display × 1,000,000).';



COMMENT ON COLUMN "public"."pool_deployments"."vault_balance" IS 'Cached USDC vault balance (micro-USDC, 6 decimals)';



COMMENT ON COLUMN "public"."pool_deployments"."sqrt_lambda_long_x96" IS 'ICBS λ parameter for LONG side in X96 fixed-point format';



COMMENT ON COLUMN "public"."pool_deployments"."sqrt_lambda_short_x96" IS 'ICBS λ parameter for SHORT side in X96 fixed-point format';



COMMENT ON COLUMN "public"."pool_deployments"."initial_usdc" IS 'Total USDC deposited at market deployment (micro-USDC, 6 decimals)';



COMMENT ON COLUMN "public"."pool_deployments"."initial_long_allocation" IS 'Initial USDC allocated to LONG side (micro-USDC)';



COMMENT ON COLUMN "public"."pool_deployments"."initial_short_allocation" IS 'Initial USDC allocated to SHORT side (micro-USDC)';



COMMENT ON COLUMN "public"."pool_deployments"."r_long" IS 'Virtual reserve for LONG side: R_L = s_L × p_L (cached from on-chain)';



COMMENT ON COLUMN "public"."pool_deployments"."r_short" IS 'Virtual reserve for SHORT side: R_S = s_S × p_S (cached from on-chain)';



COMMENT ON COLUMN "public"."pool_deployments"."market_deployed_at" IS 'When deploy_market instruction was executed (initial liquidity added)';



COMMENT ON COLUMN "public"."pool_deployments"."market_deployment_tx_signature" IS 'Transaction signature of deploy_market instruction';



COMMENT ON COLUMN "public"."pool_deployments"."last_settlement_epoch" IS 'Most recent epoch this pool was settled';



COMMENT ON COLUMN "public"."pool_deployments"."last_settlement_tx" IS 'Transaction signature of most recent settlement';



COMMENT ON COLUMN "public"."pool_deployments"."current_epoch" IS 'Current epoch for this pool (increments on settlement, independent per-pool counter)';



CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "belief_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "post_type" "text",
    "content_json" "jsonb",
    "media_urls" "text"[],
    "caption" "text",
    "content_text" "text",
    "article_title" "text",
    "cover_image_url" "text",
    CONSTRAINT "posts_article_title_length" CHECK ((("article_title" IS NULL) OR (("char_length"("article_title") >= 1) AND ("char_length"("article_title") <= 200)))),
    CONSTRAINT "posts_caption_length_check" CHECK ((("caption" IS NULL) OR ("char_length"("caption") <= 280))),
    CONSTRAINT "posts_cover_requires_title" CHECK ((("cover_image_url" IS NULL) OR ("article_title" IS NOT NULL)))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."posts" IS 'All posts must have an associated belief. No multimedia support.';



COMMENT ON COLUMN "public"."posts"."belief_id" IS 'Required reference to the belief market for this post';



COMMENT ON COLUMN "public"."posts"."post_type" IS 'Content type: text, image, or video. Added in Phase 1 for rich media support.';



COMMENT ON COLUMN "public"."posts"."content_json" IS 'Tiptap JSON for rich text posts. Added in Phase 1.';



COMMENT ON COLUMN "public"."posts"."media_urls" IS 'Array of media URLs for image/video posts. Added in Phase 1.';



COMMENT ON COLUMN "public"."posts"."caption" IS 'Optional caption for all post types (max 280 chars). Added in Phase 1.';



COMMENT ON COLUMN "public"."posts"."content_text" IS 'Plain text extracted from content_json or caption for search. Added in Phase 1.';



COMMENT ON COLUMN "public"."posts"."article_title" IS 'Optional dedicated title for text/article posts. Displayed prominently on post cards.';



COMMENT ON COLUMN "public"."posts"."cover_image_url" IS 'Optional cover/hero image URL for text/article posts. Requires article_title to be set.';



CREATE TABLE IF NOT EXISTS "public"."settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pool_address" "text" NOT NULL,
    "belief_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "epoch" integer NOT NULL,
    "bd_relevance_score" numeric NOT NULL,
    "market_prediction_q" numeric NOT NULL,
    "f_long" numeric NOT NULL,
    "f_short" numeric NOT NULL,
    "reserve_long_before" bigint NOT NULL,
    "reserve_long_after" bigint NOT NULL,
    "reserve_short_before" bigint NOT NULL,
    "reserve_short_after" bigint NOT NULL,
    "tx_signature" "text",
    "recorded_by" "text" DEFAULT 'indexer'::"text" NOT NULL,
    "confirmed" boolean DEFAULT false NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "settlements_bd_relevance_score_check" CHECK ((("bd_relevance_score" >= (0)::numeric) AND ("bd_relevance_score" <= (1)::numeric))),
    CONSTRAINT "settlements_f_long_check" CHECK (("f_long" >= (0)::numeric)),
    CONSTRAINT "settlements_f_short_check" CHECK (("f_short" >= (0)::numeric)),
    CONSTRAINT "settlements_market_prediction_q_check" CHECK ((("market_prediction_q" >= (0)::numeric) AND ("market_prediction_q" <= (1)::numeric))),
    CONSTRAINT "settlements_recorded_by_check" CHECK (("recorded_by" = ANY (ARRAY['indexer'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."settlements" OWNER TO "postgres";


COMMENT ON TABLE "public"."settlements" IS 'Historical record of pool settlements from on-chain SettlementEvent';



COMMENT ON COLUMN "public"."settlements"."bd_relevance_score" IS 'BD (Belief Decomposition) relevance score x ∈ [0,1] used for settlement';



COMMENT ON COLUMN "public"."settlements"."market_prediction_q" IS 'Market prediction q = R_long / (R_long + R_short) before settlement';



COMMENT ON COLUMN "public"."settlements"."f_long" IS 'Settlement factor for LONG side: f_long = x / q';



COMMENT ON COLUMN "public"."settlements"."f_short" IS 'Settlement factor for SHORT side: f_short = (1-x) / (1-q)';



COMMENT ON COLUMN "public"."settlements"."reserve_long_before" IS 'LONG reserve in micro-USDC before settlement';



COMMENT ON COLUMN "public"."settlements"."reserve_long_after" IS 'LONG reserve in micro-USDC after settlement';



COMMENT ON COLUMN "public"."settlements"."reserve_short_before" IS 'SHORT reserve in micro-USDC before settlement';



COMMENT ON COLUMN "public"."settlements"."reserve_short_after" IS 'SHORT reserve in micro-USDC after settlement';



COMMENT ON COLUMN "public"."settlements"."recorded_by" IS 'Source that recorded this settlement: indexer (event-processor) or manual';



COMMENT ON COLUMN "public"."settlements"."confirmed" IS 'Whether settlement transaction was confirmed on-chain';



CREATE TABLE IF NOT EXISTS "public"."implied_relevance_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "belief_id" "uuid" NOT NULL,
    "implied_relevance" numeric NOT NULL,
    "reserve_long" numeric NOT NULL,
    "reserve_short" numeric NOT NULL,
    "event_type" "text" NOT NULL,
    "event_reference" "text" NOT NULL,
    "confirmed" boolean DEFAULT false NOT NULL,
    "recorded_by" "text" DEFAULT 'server'::"text" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "implied_relevance_history_event_type_check" CHECK (("event_type" = ANY (ARRAY['trade'::"text", 'deployment'::"text", 'rebase'::"text"]))),
    CONSTRAINT "implied_relevance_history_implied_relevance_check" CHECK ((("implied_relevance" >= (0)::numeric) AND ("implied_relevance" <= (1)::numeric))),
    CONSTRAINT "implied_relevance_history_recorded_by_check" CHECK (("recorded_by" = ANY (ARRAY['server'::"text", 'indexer'::"text"]))),
    CONSTRAINT "implied_relevance_history_reserve_long_check" CHECK (("reserve_long" >= (0)::numeric)),
    CONSTRAINT "implied_relevance_history_reserve_short_check" CHECK (("reserve_short" >= (0)::numeric))
);


ALTER TABLE "public"."implied_relevance_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."implied_relevance_history" IS 'Tracks market-implied relevance over time based on reserve ratios. Used to compare trader predictions against actual BD relevance scores.';



COMMENT ON COLUMN "public"."implied_relevance_history"."implied_relevance" IS 'Market-implied relevance: reserve_long / (reserve_long + reserve_short). Shows what traders collectively predict the relevance to be.';



COMMENT ON COLUMN "public"."implied_relevance_history"."reserve_long" IS 'Reserve state for LONG side at time of recording (in USDC display units)';



COMMENT ON COLUMN "public"."implied_relevance_history"."reserve_short" IS 'Reserve state for SHORT side at time of recording (in USDC display units)';



COMMENT ON COLUMN "public"."implied_relevance_history"."event_type" IS 'Event that triggered this recording: trade, deployment, or rebase';



COMMENT ON COLUMN "public"."implied_relevance_history"."event_reference" IS 'Transaction signature, pool address, etc. for idempotency';



COMMENT ON COLUMN "public"."implied_relevance_history"."confirmed" IS 'Whether this event was confirmed on-chain';



COMMENT ON COLUMN "public"."implied_relevance_history"."recorded_by" IS 'Source that recorded this: server or indexer';



CREATE TABLE IF NOT EXISTS "public"."system_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_config" OWNER TO "postgres";

-- Insert initial system configuration values
INSERT INTO system_config (key, value, description) VALUES
    -- Protocol Core
    ('current_epoch', '0', 'Global epoch counter for protocol processing'),
    ('epoch_duration_seconds', '3600', 'Duration of each epoch in seconds (3600 = 1 hour, 30 for testing)'),
    ('epoch_processing_enabled', 'false', 'Whether automatic epoch processing is enabled'),
    ('epoch_processing_trigger', 'manual', 'How epochs are triggered: manual or event-driven'),

    -- Belief Market Rules
    ('min_participants_for_scoring', '2', 'Minimum participants required for BTS scoring'),
    ('min_stake_per_belief', '0.5', 'Minimum stake allocated per belief (USD)'),
    ('initial_agent_stake', '10000.0', 'Default stake amount for new agents (USD) - $10k for alpha'),
    ('max_beliefs_per_agent', '1000', 'Maximum number of beliefs per agent'),
    ('max_agents_per_belief', '10000', 'Maximum number of agents per belief market'),

    -- Epoch Timing
    ('current_epoch_start_time', '2025-09-15T10:00:00.000Z', 'Timestamp of first epoch start'),
    ('next_epoch_deadline', '2025-09-15T11:00:00.000Z', 'Next scheduled epoch target time'),

    -- System Environment
    ('deployment_environment', 'supabase', 'Deployment environment: supabase or local'),

    -- Pool Redistribution
    ('base_skim_rate', '0.01', 'Base penalty rate for pools with zero delta_relevance (1% = 0.01)'),
    ('epoch_rollover_balance', '0', 'Accumulated penalty pot from epochs with no winning pools');


CREATE TABLE IF NOT EXISTS "public"."trades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pool_address" "text" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wallet_address" "text" NOT NULL,
    "trade_type" "text" NOT NULL,
    "token_amount" numeric NOT NULL,
    "usdc_amount" numeric NOT NULL,
    "token_supply_after" numeric NOT NULL,
    "reserve_after" numeric NOT NULL,
    "tx_signature" "text" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "recorded_by" "text" DEFAULT 'server'::"text",
    "confirmed" boolean DEFAULT false,
    "server_amount" numeric,
    "indexer_corrected" boolean DEFAULT false,
    "confirmed_at" timestamp with time zone,
    "indexed_at" timestamp with time zone,
    "block_time" timestamp with time zone,
    "slot" bigint,
    "side" "text",
    "f" integer,
    "beta_num" integer,
    "beta_den" integer,
    "sqrt_price_long_x96" "text",
    "sqrt_price_short_x96" "text",
    "price_long" numeric,
    "price_short" numeric,
    "s_long_before" numeric,
    "s_long_after" numeric,
    "s_short_before" numeric,
    "s_short_after" numeric,
    "r_long_before" numeric,
    "r_long_after" numeric,
    "r_short_before" numeric,
    "r_short_after" numeric,
    CONSTRAINT "trades_recorded_by_check" CHECK (("recorded_by" = ANY (ARRAY['server'::"text", 'indexer'::"text"]))),
    CONSTRAINT "trades_reserve_after_check" CHECK (("reserve_after" >= (0)::numeric)),
    CONSTRAINT "trades_side_check" CHECK (("side" = ANY (ARRAY['LONG'::"text", 'SHORT'::"text"]))),
    CONSTRAINT "trades_token_amount_check" CHECK (("token_amount" > (0)::numeric)),
    CONSTRAINT "trades_token_supply_after_check" CHECK (("token_supply_after" >= (0)::numeric)),
    CONSTRAINT "trades_trade_type_check" CHECK (("trade_type" = ANY (ARRAY['buy'::"text", 'sell'::"text", 'liquidity_provision'::"text"]))),
    CONSTRAINT "trades_usdc_amount_check" CHECK (("usdc_amount" > (0)::numeric))
);


ALTER TABLE "public"."trades" OWNER TO "postgres";


COMMENT ON TABLE "public"."trades" IS 'Individual trades for ICBS two-sided markets. Tracks buy/sell of LONG (bullish) or SHORT (bearish) tokens. Supports dual-source indexing (server + on-chain events).';



COMMENT ON COLUMN "public"."trades"."trade_type" IS 'Type of trade: buy (directional long), sell (directional short), or liquidity_provision (bilateral non-predictive liquidity)';



COMMENT ON COLUMN "public"."trades"."token_amount" IS 'Token amount traded in display units (human-readable)';



COMMENT ON COLUMN "public"."trades"."usdc_amount" IS 'USDC amount traded in display units (human-readable)';



COMMENT ON COLUMN "public"."trades"."token_supply_after" IS 'DEPRECATED: Old single-sided token supply. Use s_long_after/s_short_after instead.';



COMMENT ON COLUMN "public"."trades"."reserve_after" IS 'DEPRECATED: Old single-sided reserve. Use r_long_after/r_short_after instead.';



COMMENT ON COLUMN "public"."trades"."recorded_by" IS 'Which system created this record first (server or indexer)';



COMMENT ON COLUMN "public"."trades"."confirmed" IS 'Has on-chain event verified this transaction?';



COMMENT ON COLUMN "public"."trades"."server_amount" IS 'Original server amount if indexer corrected it';



COMMENT ON COLUMN "public"."trades"."indexer_corrected" IS 'Did indexer overwrite incorrect server data?';



COMMENT ON COLUMN "public"."trades"."confirmed_at" IS 'When indexer confirmed this trade';



COMMENT ON COLUMN "public"."trades"."indexed_at" IS 'When event was indexed from blockchain';



COMMENT ON COLUMN "public"."trades"."block_time" IS 'Blockchain timestamp of transaction';



COMMENT ON COLUMN "public"."trades"."slot" IS 'Solana slot number';



COMMENT ON COLUMN "public"."trades"."side" IS 'Which token was traded: LONG (bullish) or SHORT (bearish). NULL for legacy trades or liquidity provision.';



COMMENT ON COLUMN "public"."trades"."f" IS 'ICBS growth exponent at time of trade';



COMMENT ON COLUMN "public"."trades"."beta_num" IS 'ICBS β numerator at time of trade';



COMMENT ON COLUMN "public"."trades"."beta_den" IS 'ICBS β denominator at time of trade';



COMMENT ON COLUMN "public"."trades"."sqrt_price_long_x96" IS 'LONG token sqrt price in X96 format at time of trade (from on-chain event)';



COMMENT ON COLUMN "public"."trades"."sqrt_price_short_x96" IS 'SHORT token sqrt price in X96 format at time of trade (from on-chain event)';



COMMENT ON COLUMN "public"."trades"."price_long" IS 'LONG token price in USDC at time of trade (human-readable, computed from sqrt_price_long_x96)';



COMMENT ON COLUMN "public"."trades"."price_short" IS 'SHORT token price in USDC at time of trade (human-readable, computed from sqrt_price_short_x96)';



COMMENT ON COLUMN "public"."trades"."s_long_before" IS 'LONG token supply before this trade (atomic units)';



COMMENT ON COLUMN "public"."trades"."s_long_after" IS 'LONG token supply after this trade (atomic units)';



COMMENT ON COLUMN "public"."trades"."s_short_before" IS 'SHORT token supply before this trade (atomic units)';



COMMENT ON COLUMN "public"."trades"."s_short_after" IS 'SHORT token supply after this trade (atomic units)';



COMMENT ON COLUMN "public"."trades"."r_long_before" IS 'LONG virtual reserve before this trade (R_L = s_L × p_L)';



COMMENT ON COLUMN "public"."trades"."r_long_after" IS 'LONG virtual reserve after this trade';



COMMENT ON COLUMN "public"."trades"."r_short_before" IS 'SHORT virtual reserve before this trade (R_S = s_S × p_S)';



COMMENT ON COLUMN "public"."trades"."r_short_after" IS 'SHORT virtual reserve after this trade';



CREATE TABLE IF NOT EXISTS "public"."user_pool_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pool_address" "text" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "token_balance" numeric DEFAULT 0 NOT NULL,
    "total_bought" numeric DEFAULT 0 NOT NULL,
    "total_sold" numeric DEFAULT 0 NOT NULL,
    "total_usdc_spent" numeric DEFAULT 0 NOT NULL,
    "total_usdc_received" numeric DEFAULT 0 NOT NULL,
    "first_trade_at" timestamp with time zone,
    "last_trade_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_buy_amount" bigint DEFAULT 0 NOT NULL,
    "belief_lock" bigint DEFAULT 0 NOT NULL,
    "token_type" "text" DEFAULT 'LONG'::"text" NOT NULL,
    CONSTRAINT "user_pool_balances_belief_lock_non_negative" CHECK (("belief_lock" >= 0)),
    CONSTRAINT "user_pool_balances_token_balance_check" CHECK (("token_balance" >= (0)::numeric)),
    CONSTRAINT "user_pool_balances_token_type_check" CHECK (("token_type" = ANY (ARRAY['LONG'::"text", 'SHORT'::"text"])))
);


ALTER TABLE "public"."user_pool_balances" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_pool_balances" IS 'ONE row per user-pool pair - current state (NOT history)';



COMMENT ON COLUMN "public"."user_pool_balances"."token_balance" IS 'Current token balance (total_bought - total_sold)';



COMMENT ON COLUMN "public"."user_pool_balances"."total_usdc_spent" IS 'Lifetime USDC spent on buys';



COMMENT ON COLUMN "public"."user_pool_balances"."total_usdc_received" IS 'Lifetime USDC received from sells';



COMMENT ON COLUMN "public"."user_pool_balances"."last_buy_amount" IS 'USDC amount (micro-USDC) of most recent buy in this pool - used to calculate belief_lock';



COMMENT ON COLUMN "public"."user_pool_balances"."belief_lock" IS 'Required stake lock: 2% of last_buy_amount. Only enforced while token_balance > 0. Auto-releases on full exit.';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "auth_provider" "text",
    "auth_id" "text",
    "username" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "bio" "text",
    "avatar_url" "text",
    "total_stake" numeric(10,2) DEFAULT 0 NOT NULL,
    "beliefs_created" integer DEFAULT 0 NOT NULL,
    "beliefs_participated" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "users_username_length" CHECK ((("char_length"("username") >= 2) AND ("char_length"("username") <= 50)))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'Application-layer users with social profiles, linked to protocol agents';



COMMENT ON COLUMN "public"."users"."total_stake" IS 'Cached from agents.total_stake for app-layer queries';



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_solana_address_key" UNIQUE ("solana_address");



ALTER TABLE ONLY "public"."belief_relevance_history"
    ADD CONSTRAINT "belief_relevance_history_belief_id_epoch_key" UNIQUE ("belief_id", "epoch");



ALTER TABLE ONLY "public"."belief_relevance_history"
    ADD CONSTRAINT "belief_relevance_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."belief_submissions"
    ADD CONSTRAINT "belief_submissions_agent_id_belief_id_key" UNIQUE ("agent_id", "belief_id");



ALTER TABLE ONLY "public"."belief_submissions"
    ADD CONSTRAINT "belief_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beliefs"
    ADD CONSTRAINT "beliefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custodian_deposits"
    ADD CONSTRAINT "custodian_deposits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custodian_deposits"
    ADD CONSTRAINT "custodian_deposits_tx_signature_key" UNIQUE ("tx_signature");



ALTER TABLE ONLY "public"."custodian_withdrawals"
    ADD CONSTRAINT "custodian_withdrawals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custodian_withdrawals"
    ADD CONSTRAINT "custodian_withdrawals_tx_signature_key" UNIQUE ("tx_signature");



ALTER TABLE ONLY "public"."epoch_history"
    ADD CONSTRAINT "epoch_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_deployments"
    ADD CONSTRAINT "pool_deployments_deployment_tx_signature_key" UNIQUE ("deployment_tx_signature");



ALTER TABLE ONLY "public"."pool_deployments"
    ADD CONSTRAINT "pool_deployments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_deployments"
    ADD CONSTRAINT "pool_deployments_pool_address_key" UNIQUE ("pool_address");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_pool_address_epoch_key" UNIQUE ("pool_address", "epoch");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_tx_signature_key" UNIQUE ("tx_signature");



ALTER TABLE ONLY "public"."implied_relevance_history"
    ADD CONSTRAINT "implied_relevance_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."implied_relevance_history"
    ADD CONSTRAINT "implied_relevance_history_event_reference_key" UNIQUE ("event_reference");



ALTER TABLE ONLY "public"."system_config"
    ADD CONSTRAINT "system_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_tx_signature_key" UNIQUE ("tx_signature");



ALTER TABLE ONLY "public"."user_pool_balances"
    ADD CONSTRAINT "user_pool_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_pool_balances"
    ADD CONSTRAINT "user_pool_balances_user_pool_side_key" UNIQUE ("user_id", "pool_address", "token_type");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_credentials_unique" UNIQUE ("auth_provider", "auth_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



CREATE INDEX "idx_agents_last_synced" ON "public"."agents" USING "btree" ("last_synced_at");



CREATE INDEX "idx_agents_solana_address" ON "public"."agents" USING "btree" ("solana_address");



CREATE INDEX "idx_balances_pool_balance" ON "public"."user_pool_balances" USING "btree" ("pool_address", "token_balance" DESC);



CREATE INDEX "idx_balances_user" ON "public"."user_pool_balances" USING "btree" ("user_id");



CREATE INDEX "idx_balances_user_pool" ON "public"."user_pool_balances" USING "btree" ("user_id", "pool_address");



CREATE INDEX "idx_belief_history_belief_epoch" ON "public"."belief_relevance_history" USING "btree" ("belief_id", "epoch" DESC);



CREATE INDEX "idx_belief_history_epoch_time" ON "public"."belief_relevance_history" USING "btree" ("epoch", "recorded_at");



CREATE INDEX "idx_belief_history_post_epoch" ON "public"."belief_relevance_history" USING "btree" ("post_id", "epoch" DESC);



CREATE INDEX "idx_belief_submissions_agent" ON "public"."belief_submissions" USING "btree" ("agent_id");



CREATE INDEX "idx_belief_submissions_belief" ON "public"."belief_submissions" USING "btree" ("belief_id");



CREATE INDEX "idx_belief_submissions_epoch" ON "public"."belief_submissions" USING "btree" ("epoch");



CREATE INDEX "idx_beliefs_certainty" ON "public"."beliefs" USING "btree" ("certainty") WHERE ("certainty" IS NOT NULL);



CREATE INDEX "idx_beliefs_creator_agent" ON "public"."beliefs" USING "btree" ("creator_agent_id");



CREATE INDEX "idx_deposits_agent" ON "public"."custodian_deposits" USING "btree" ("agent_id");



CREATE INDEX "idx_deposits_block_time" ON "public"."custodian_deposits" USING "btree" ("block_time");



CREATE INDEX "idx_deposits_depositor" ON "public"."custodian_deposits" USING "btree" ("depositor_address");



CREATE INDEX "idx_deposits_pending" ON "public"."custodian_deposits" USING "btree" ("agent_credited") WHERE (NOT "agent_credited");



CREATE INDEX "idx_epoch_history_epoch_number" ON "public"."epoch_history" USING "btree" ("epoch_number");



CREATE INDEX "idx_epoch_history_started_at" ON "public"."epoch_history" USING "btree" ("started_at");



CREATE INDEX "idx_epoch_history_status" ON "public"."epoch_history" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_pool_deployments_belief" ON "public"."pool_deployments" USING "btree" ("belief_id");



CREATE INDEX "idx_pool_deployments_current_epoch" ON "public"."pool_deployments" USING "btree" ("current_epoch");



CREATE INDEX "idx_pool_deployments_deployed_by" ON "public"."pool_deployments" USING "btree" ("deployed_by_agent_id");



CREATE INDEX "idx_pool_deployments_last_synced" ON "public"."pool_deployments" USING "btree" ("last_synced_at");



CREATE INDEX "idx_pool_deployments_long_mint" ON "public"."pool_deployments" USING "btree" ("long_mint_address") WHERE ("long_mint_address" IS NOT NULL);



CREATE INDEX "idx_pool_deployments_market_deployment_tx" ON "public"."pool_deployments" USING "btree" ("market_deployment_tx_signature") WHERE ("market_deployment_tx_signature" IS NOT NULL);



CREATE INDEX "idx_pool_deployments_pool_address" ON "public"."pool_deployments" USING "btree" ("pool_address");



CREATE UNIQUE INDEX "idx_pool_deployments_post" ON "public"."pool_deployments" USING "btree" ("post_id");



CREATE INDEX "idx_pool_deployments_post_id" ON "public"."pool_deployments" USING "btree" ("post_id");



CREATE INDEX "idx_pool_deployments_prices" ON "public"."pool_deployments" USING "btree" ("sqrt_price_long_x96", "sqrt_price_short_x96") WHERE ("sqrt_price_long_x96" IS NOT NULL);



CREATE INDEX "idx_pool_deployments_settlement_epoch" ON "public"."pool_deployments" USING "btree" ("last_settlement_epoch") WHERE ("last_settlement_epoch" IS NOT NULL);



CREATE INDEX "idx_pool_deployments_short_mint" ON "public"."pool_deployments" USING "btree" ("short_mint_address") WHERE ("short_mint_address" IS NOT NULL);



CREATE INDEX "idx_pool_deployments_status" ON "public"."pool_deployments" USING "btree" ("status");



CREATE INDEX "idx_posts_article_title_search" ON "public"."posts" USING "gin" ("to_tsvector"('"english"'::"regconfig", COALESCE("article_title", ''::"text")));



CREATE INDEX "idx_posts_belief_created" ON "public"."posts" USING "btree" ("belief_id", "created_at" DESC) WHERE ("belief_id" IS NOT NULL);



CREATE INDEX "idx_posts_belief_id" ON "public"."posts" USING "btree" ("belief_id");



CREATE INDEX "idx_posts_content_text_search" ON "public"."posts" USING "gin" ("to_tsvector"('"english"'::"regconfig", COALESCE("content_text", ''::"text")));



CREATE INDEX "idx_posts_created_at" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_posts_type" ON "public"."posts" USING "btree" ("post_type");



CREATE INDEX "idx_posts_user_id" ON "public"."posts" USING "btree" ("user_id");



CREATE INDEX "idx_settlements_belief" ON "public"."settlements" USING "btree" ("belief_id");



CREATE INDEX "idx_settlements_epoch" ON "public"."settlements" USING "btree" ("epoch");



CREATE INDEX "idx_settlements_pool" ON "public"."settlements" USING "btree" ("pool_address");



CREATE INDEX "idx_settlements_post" ON "public"."settlements" USING "btree" ("post_id");



CREATE INDEX "idx_settlements_timestamp" ON "public"."settlements" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_settlements_tx" ON "public"."settlements" USING "btree" ("tx_signature");



CREATE INDEX "idx_implied_relevance_post_time" ON "public"."implied_relevance_history" USING "btree" ("post_id", "recorded_at" DESC);



CREATE INDEX "idx_implied_relevance_belief_time" ON "public"."implied_relevance_history" USING "btree" ("belief_id", "recorded_at" DESC);



CREATE INDEX "idx_implied_relevance_event_type" ON "public"."implied_relevance_history" USING "btree" ("event_type");



CREATE INDEX "idx_system_config_key" ON "public"."system_config" USING "btree" ("key");



CREATE INDEX "idx_trades_block_time" ON "public"."trades" USING "btree" ("block_time") WHERE ("block_time" IS NOT NULL);



CREATE INDEX "idx_trades_confirmed" ON "public"."trades" USING "btree" ("confirmed") WHERE (NOT "confirmed");



CREATE INDEX "idx_trades_long" ON "public"."trades" USING "btree" ("pool_address", "recorded_at" DESC) WHERE ("side" = 'LONG'::"text");



CREATE INDEX "idx_trades_pool_time" ON "public"."trades" USING "btree" ("pool_address", "recorded_at" DESC);



CREATE INDEX "idx_trades_post_time" ON "public"."trades" USING "btree" ("post_id", "recorded_at" DESC);



CREATE INDEX "idx_trades_short" ON "public"."trades" USING "btree" ("pool_address", "recorded_at" DESC) WHERE ("side" = 'SHORT'::"text");



CREATE INDEX "idx_trades_side" ON "public"."trades" USING "btree" ("side") WHERE ("side" IS NOT NULL);



CREATE INDEX "idx_trades_time" ON "public"."trades" USING "btree" ("recorded_at" DESC);



CREATE INDEX "idx_trades_tx" ON "public"."trades" USING "btree" ("tx_signature");



CREATE INDEX "idx_trades_user_time" ON "public"."trades" USING "btree" ("user_id", "recorded_at" DESC);



CREATE INDEX "idx_user_pool_balances_user_open" ON "public"."user_pool_balances" USING "btree" ("user_id", "pool_address", "token_type") WHERE ("token_balance" > (0)::numeric);



CREATE INDEX "idx_users_agent_id" ON "public"."users" USING "btree" ("agent_id");



CREATE INDEX "idx_users_auth_credentials" ON "public"."users" USING "btree" ("auth_provider", "auth_id") WHERE (("auth_provider" IS NOT NULL) AND ("auth_id" IS NOT NULL));



CREATE INDEX "idx_users_username" ON "public"."users" USING "btree" ("username");



CREATE INDEX "idx_withdrawals_agent" ON "public"."custodian_withdrawals" USING "btree" ("agent_id");



CREATE INDEX "idx_withdrawals_requested_at" ON "public"."custodian_withdrawals" USING "btree" ("requested_at");



CREATE INDEX "idx_withdrawals_status" ON "public"."custodian_withdrawals" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "trg_update_balance_after_trade_safe" AFTER INSERT ON "public"."trades" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_balance_after_trade_safe"();



ALTER TABLE ONLY "public"."belief_relevance_history"
    ADD CONSTRAINT "belief_relevance_history_belief_id_fkey" FOREIGN KEY ("belief_id") REFERENCES "public"."beliefs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."belief_relevance_history"
    ADD CONSTRAINT "belief_relevance_history_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."belief_submissions"
    ADD CONSTRAINT "belief_submissions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."belief_submissions"
    ADD CONSTRAINT "belief_submissions_belief_id_fkey" FOREIGN KEY ("belief_id") REFERENCES "public"."beliefs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beliefs"
    ADD CONSTRAINT "beliefs_creator_agent_id_fkey" FOREIGN KEY ("creator_agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custodian_deposits"
    ADD CONSTRAINT "custodian_deposits_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custodian_withdrawals"
    ADD CONSTRAINT "custodian_withdrawals_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custodian_withdrawals"
    ADD CONSTRAINT "custodian_withdrawals_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pool_deployments"
    ADD CONSTRAINT "pool_deployments_belief_id_fkey" FOREIGN KEY ("belief_id") REFERENCES "public"."beliefs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pool_deployments"
    ADD CONSTRAINT "pool_deployments_deployed_by_agent_id_fkey" FOREIGN KEY ("deployed_by_agent_id") REFERENCES "public"."agents"("id");



ALTER TABLE ONLY "public"."pool_deployments"
    ADD CONSTRAINT "pool_deployments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_belief_id_fkey" FOREIGN KEY ("belief_id") REFERENCES "public"."beliefs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_belief_id_fkey" FOREIGN KEY ("belief_id") REFERENCES "public"."beliefs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_pool_address_fkey" FOREIGN KEY ("pool_address") REFERENCES "public"."pool_deployments"("pool_address") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_pool_balances"
    ADD CONSTRAINT "user_pool_balances_pool_address_fkey" FOREIGN KEY ("pool_address") REFERENCES "public"."pool_deployments"("pool_address") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_pool_balances"
    ADD CONSTRAINT "user_pool_balances_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_pool_balances"
    ADD CONSTRAINT "user_pool_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_agent_stake"("p_agent_id" "uuid", "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."add_agent_stake"("p_agent_id" "uuid", "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_agent_stake"("p_agent_id" "uuid", "p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_skim_with_lock"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_skim_with_lock"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_skim_with_lock"("p_user_id" "uuid", "p_wallet_address" "text", "p_pool_address" "text", "p_side" "text", "p_trade_amount_micro" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_epoch_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_epoch_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_epoch_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pool_with_stats"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pool_with_stats"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pool_with_stats"("p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."pg_advisory_lock"("lock_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."pg_advisory_lock"("lock_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pg_advisory_lock"("lock_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."pg_advisory_unlock"("lock_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."pg_advisory_unlock"("lock_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pg_advisory_unlock"("lock_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_pool_deployment"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_vault_address" "text", "p_mint_address" "text", "p_deployed_by_agent_id" "uuid", "p_tx_signature" "text", "p_k_quadratic" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."record_pool_deployment"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_vault_address" "text", "p_mint_address" "text", "p_deployed_by_agent_id" "uuid", "p_tx_signature" "text", "p_k_quadratic" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_pool_deployment"("p_post_id" "uuid", "p_belief_id" "uuid", "p_pool_address" "text", "p_vault_address" "text", "p_mint_address" "text", "p_deployed_by_agent_id" "uuid", "p_tx_signature" "text", "p_k_quadratic" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_agent_stake_from_chain"("p_agent_id" "uuid", "p_solana_address" "text", "p_onchain_balance" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."sync_agent_stake_from_chain"("p_agent_id" "uuid", "p_solana_address" "text", "p_onchain_balance" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_agent_stake_from_chain"("p_agent_id" "uuid", "p_solana_address" "text", "p_onchain_balance" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pool_state"("p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."update_pool_state"("p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pool_state"("p_pool_address" "text", "p_token_supply" numeric, "p_reserve" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stake_atomic"("p_agent_id" "uuid", "p_delta_micro" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."update_stake_atomic"("p_agent_id" "uuid", "p_delta_micro" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stake_atomic"("p_agent_id" "uuid", "p_delta_micro" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_balance_after_trade"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_balance_after_trade"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_balance_after_trade"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_balance_after_trade_safe"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_balance_after_trade_safe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_balance_after_trade_safe"() TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON TABLE "public"."belief_relevance_history" TO "anon";
GRANT ALL ON TABLE "public"."belief_relevance_history" TO "authenticated";
GRANT ALL ON TABLE "public"."belief_relevance_history" TO "service_role";



GRANT ALL ON TABLE "public"."belief_submissions" TO "anon";
GRANT ALL ON TABLE "public"."belief_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."belief_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."beliefs" TO "anon";
GRANT ALL ON TABLE "public"."beliefs" TO "authenticated";
GRANT ALL ON TABLE "public"."beliefs" TO "service_role";



GRANT ALL ON TABLE "public"."custodian_deposits" TO "anon";
GRANT ALL ON TABLE "public"."custodian_deposits" TO "authenticated";
GRANT ALL ON TABLE "public"."custodian_deposits" TO "service_role";



GRANT ALL ON TABLE "public"."custodian_withdrawals" TO "anon";
GRANT ALL ON TABLE "public"."custodian_withdrawals" TO "authenticated";
GRANT ALL ON TABLE "public"."custodian_withdrawals" TO "service_role";



GRANT ALL ON TABLE "public"."epoch_history" TO "anon";
GRANT ALL ON TABLE "public"."epoch_history" TO "authenticated";
GRANT ALL ON TABLE "public"."epoch_history" TO "service_role";



GRANT ALL ON TABLE "public"."pool_deployments" TO "anon";
GRANT ALL ON TABLE "public"."pool_deployments" TO "authenticated";
GRANT ALL ON TABLE "public"."pool_deployments" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."settlements" TO "anon";
GRANT ALL ON TABLE "public"."settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."settlements" TO "service_role";



GRANT ALL ON TABLE "public"."system_config" TO "anon";
GRANT ALL ON TABLE "public"."system_config" TO "authenticated";
GRANT ALL ON TABLE "public"."system_config" TO "service_role";



GRANT ALL ON TABLE "public"."trades" TO "anon";
GRANT ALL ON TABLE "public"."trades" TO "authenticated";
GRANT ALL ON TABLE "public"."trades" TO "service_role";



GRANT ALL ON TABLE "public"."user_pool_balances" TO "anon";
GRANT ALL ON TABLE "public"."user_pool_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."user_pool_balances" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create veritas-media bucket for post images and videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'veritas-media',
  'veritas-media',
  true,  -- Public bucket (files accessible via public URL)
  104857600,  -- 100MB file size limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ];

-- Create profile-photos bucket for user avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE RLS POLICIES
-- ============================================================================

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Public media files are viewable by anyone" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Public can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile photo" ON storage.objects;

-- Media bucket policies
CREATE POLICY "Public media files are viewable by anyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'veritas-media');

CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'veritas-media' AND
  (
    name LIKE 'images/' || auth.uid()::text || '/%' OR
    name LIKE 'videos/' || auth.uid()::text || '/%'
  )
);

CREATE POLICY "Users can update their own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'veritas-media' AND
  (
    name LIKE 'images/' || auth.uid()::text || '/%' OR
    name LIKE 'videos/' || auth.uid()::text || '/%'
  )
)
WITH CHECK (
  bucket_id = 'veritas-media' AND
  (
    name LIKE 'images/' || auth.uid()::text || '/%' OR
    name LIKE 'videos/' || auth.uid()::text || '/%'
  )
);

CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'veritas-media' AND
  (
    name LIKE 'images/' || auth.uid()::text || '/%' OR
    name LIKE 'videos/' || auth.uid()::text || '/%'
  )
);

-- Profile photos bucket policies
CREATE POLICY "Users can upload own profile photo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-photos');

CREATE POLICY "Users can update own profile photo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-photos');

CREATE POLICY "Public can view profile photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can delete own profile photo"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-photos');


RESET ALL;
