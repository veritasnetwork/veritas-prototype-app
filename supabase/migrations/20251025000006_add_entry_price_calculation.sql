-- Add function to calculate weighted average entry price for holdings
-- Takes into account buys and sells using average cost basis method

CREATE OR REPLACE FUNCTION calculate_entry_price(
  p_user_id uuid,
  p_pool_address text,
  p_token_type text
) RETURNS numeric AS $$
DECLARE
  v_total_cost numeric := 0;
  v_total_tokens numeric := 0;
  v_current_avg_price numeric := 0;
  v_current_position numeric := 0;
  trade_record RECORD;
BEGIN
  -- Process all trades in chronological order
  FOR trade_record IN
    SELECT
      trade_type,
      side,
      token_amount,
      usdc_amount / 1000000.0 as usdc_amount_display, -- Convert from lamports to display units
      CASE
        WHEN side = 'LONG' THEN price_long
        WHEN side = 'SHORT' THEN price_short
        ELSE 0
      END as price_at_trade,
      recorded_at
    FROM trades
    WHERE
      user_id = p_user_id
      AND pool_address = p_pool_address
      AND side = p_token_type
      AND confirmed = true
    ORDER BY recorded_at ASC, created_at ASC
  LOOP
    IF trade_record.trade_type = 'buy' THEN
      -- Add to position with weighted average
      v_total_cost := v_total_cost + trade_record.usdc_amount_display;
      v_total_tokens := v_total_tokens + trade_record.token_amount;

      -- Update average price
      IF v_total_tokens > 0 THEN
        v_current_avg_price := v_total_cost / v_total_tokens;
      END IF;

    ELSIF trade_record.trade_type = 'sell' THEN
      -- Reduce position but keep average price the same
      v_total_tokens := v_total_tokens - trade_record.token_amount;

      -- Reduce cost proportionally
      IF v_total_tokens > 0 THEN
        v_total_cost := v_total_tokens * v_current_avg_price;
      ELSE
        -- Position closed completely
        v_total_cost := 0;
        v_current_avg_price := 0;
      END IF;
    END IF;
  END LOOP;

  -- Return the average entry price
  -- If position is closed or no trades, return 0
  IF v_total_tokens > 0 AND v_total_cost > 0 THEN
    RETURN v_total_cost / v_total_tokens;
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_entry_price IS 'Calculates weighted average entry price for a user position using average cost basis method. Processes trades chronologically, adding cost on buys and reducing proportionally on sells.';

-- Drop existing function if it exists to allow changing return type
DROP FUNCTION IF EXISTS get_user_holdings_with_entry_price(uuid);

-- Create RPC function to get user holdings with entry prices
CREATE OR REPLACE FUNCTION get_user_holdings_with_entry_price(p_user_id uuid)
RETURNS TABLE (
  token_balance numeric,
  total_usdc_spent numeric,
  total_bought numeric,
  total_sold numeric,
  total_usdc_received numeric,
  pool_address text,
  post_id uuid,
  token_type text,
  belief_lock bigint,
  last_trade_at timestamp with time zone,
  entry_price numeric,
  posts json,
  pool_deployments json
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    upb.token_balance,
    upb.total_usdc_spent,
    upb.total_bought,
    upb.total_sold,
    upb.total_usdc_received,
    upb.pool_address,
    upb.post_id,
    upb.token_type,
    upb.belief_lock,
    upb.last_trade_at,
    calculate_entry_price(p_user_id, upb.pool_address, upb.token_type) as entry_price,
    (
      SELECT json_build_object(
        'id', p.id,
        'post_type', p.post_type,
        'content_text', p.content_text,
        'caption', p.caption,
        'media_urls', p.media_urls,
        'cover_image_url', p.cover_image_url,
        'article_title', p.article_title,
        'user_id', p.user_id,
        'created_at', p.created_at,
        'users', (
          SELECT json_build_object(
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url
          )
          FROM users u
          WHERE u.id = p.user_id
        )
      )
      FROM posts p
      WHERE p.id = upb.post_id
    ) as posts,
    (
      SELECT json_build_object(
        'pool_address', pd.pool_address,
        'cached_price_long', pd.cached_price_long,
        'cached_price_short', pd.cached_price_short,
        'prices_last_updated_at', pd.prices_last_updated_at,
        's_long_supply', pd.s_long_supply,
        's_short_supply', pd.s_short_supply
      )
      FROM pool_deployments pd
      WHERE pd.pool_address = upb.pool_address
    ) as pool_deployments
  FROM user_pool_balances upb
  WHERE upb.user_id = p_user_id
    AND upb.token_balance > 0;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_user_holdings_with_entry_price IS 'Returns user holdings with calculated entry prices and full post/pool data. Uses calculate_entry_price function to determine weighted average cost basis.';
