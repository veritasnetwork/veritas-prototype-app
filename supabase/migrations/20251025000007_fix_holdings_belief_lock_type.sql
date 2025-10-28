-- Fix type mismatch in get_user_holdings_with_entry_price function
-- The belief_lock column is bigint in user_pool_balances but the function returns numeric

-- Drop existing function first to avoid type conflicts
DROP FUNCTION IF EXISTS get_user_holdings_with_entry_price(uuid);

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
  belief_lock numeric,  -- Keep as numeric for consistency with other numeric fields
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
    upb.belief_lock::numeric,  -- Cast bigint to numeric
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

COMMENT ON FUNCTION get_user_holdings_with_entry_price IS 'Returns user holdings with calculated entry prices and full post/pool data. Uses calculate_entry_price function to determine weighted average cost basis. Fixed type casting for belief_lock column.';