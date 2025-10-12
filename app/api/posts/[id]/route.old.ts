import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch post with all related data
    const { data: post, error } = await supabase
      .from('posts')
      .select(`
        *,
        users:user_id (
          id,
          username,
          display_name,
          avatar_url
        ),
        beliefs:belief_id (
          id,
          previous_aggregate,
          delta_relevance,
          certainty,
          expiration_epoch,
          status
        ),
        pool_deployments:pool_deployments!post_id (
          pool_address,
          token_mint_address,
          usdc_vault_address,
          token_supply,
          reserve,
          k_quadratic,
          last_synced_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching post:', error);
      return NextResponse.json(
        { error: error.message || 'Post not found' },
        { status: 404 }
      );
    }

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check if user is authenticated (optional)
    const authHeader = req.headers.get('Authorization');
    let userHoldings = null;

    if (authHeader && post.pool_deployments && post.pool_deployments.length > 0) {
      try {
        // Try to get user from JWT token
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (user && !userError) {
          // Fetch user holdings
          const { data: holdings } = await supabase
            .from('user_pool_balances')
            .select('token_balance, total_usdc_spent, total_bought, total_sold, total_usdc_received')
            .eq('user_id', user.id)
            .eq('pool_address', post.pool_deployments[0].pool_address)
            .single();

          if (holdings && holdings.token_balance > 0) {
            const avgBuyPrice = holdings.total_bought > 0
              ? holdings.total_usdc_spent / holdings.total_bought
              : 0;

            const avgSellPrice = holdings.total_sold > 0
              ? holdings.total_usdc_received / holdings.total_sold
              : 0;

            // Calculate realized PnL (from sells)
            const realizedPnL = holdings.total_usdc_received - (avgBuyPrice * holdings.total_sold);

            // Calculate unrealized PnL (current holdings)
            const currentPrice = post.pool_deployments[0].token_supply > 0
              ? post.pool_deployments[0].reserve / (post.pool_deployments[0].k_quadratic * Math.pow(post.pool_deployments[0].token_supply, 2))
              : 0;
            const unrealizedPnL = (currentPrice * holdings.token_balance) - (avgBuyPrice * holdings.token_balance);

            userHoldings = {
              token_balance: holdings.token_balance,
              cost_basis: avgBuyPrice,
              total_invested: holdings.total_usdc_spent,
              total_withdrawn: holdings.total_usdc_received,
              realized_pnl: realizedPnL,
              unrealized_pnl: unrealizedPnL,
              total_pnl: realizedPnL + unrealizedPnL
            };
          }
        }
      } catch (authError) {
        console.error('Error checking user holdings:', authError);
        // Continue without user holdings
      }
    }

    return NextResponse.json({
      post,
      user_holdings: userHoldings
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
