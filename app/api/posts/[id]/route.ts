/**
 * API endpoint for fetching individual post details
 * Phase 2: Support for Post Detail Panel
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { PostAPIResponseSchema } from '@/types/api';
import { sqrtPriceX96ToPrice, USDC_PRECISION } from '@/lib/solana/sqrt-price-helpers';
import { syncPoolFromChain } from '@/lib/solana/sync-pool-from-chain';

// Force dynamic rendering - no static generation or caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('[GET /api/posts/[id]] Fetching post:', id);

    const supabase = getSupabaseServiceRole();

    // Fetch post with all related data - use same query as feed for consistency
    const { data: post, error } = await supabase
      .from('posts')
      .select(`
        *,
        total_volume_usdc,
        user:users!posts_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        ),
        belief:beliefs!posts_belief_id_fkey (
          previous_aggregate
        ),
        pool_deployments (
          pool_address,
          token_supply,
          reserve,
          f,
          beta_num,
          beta_den,
          long_mint_address,
          short_mint_address,
          s_long_supply,
          s_short_supply,
          sqrt_price_long_x96,
          sqrt_price_short_x96,
          vault_balance,
          r_long,
          r_short,
          last_synced_at,
          current_epoch,
          status
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('[GET /api/posts/[id]] Database error:', { id, error: error.message, code: error.code });
      return NextResponse.json(
        { error: 'Post not found', details: error?.message, code: error?.code },
        { status: 404 }
      );
    }

    if (!post) {
      console.warn('[GET /api/posts/[id]] Post not found in DB:', id);
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    console.log('[GET /api/posts/[id]] Found post:', { id: post.id, userId: post.user_id, hasPool: !!post.pool_deployments?.[0] });

    // Extract nested relations
    const userData = Array.isArray(post.user) ? post.user[0] : post.user;
    const poolData = post.pool_deployments?.[0] || null;

    // IMPORTANT: Always sync pool data from chain to ensure reserves are up-to-date
    // This is critical because trades update implied_relevance_history but the
    // pool_deployments table needs to be refreshed from chain to show current reserves
    //
    // PERFORMANCE: This happens asynchronously (fire and forget) so it doesn't block the response
    if (poolData?.pool_address) {
      console.log('[GET /api/posts/[id]] Triggering pool sync for:', poolData.pool_address);
      // Trigger async sync in background (fire and forget)
      syncPoolFromChain(poolData.pool_address, undefined, 5000, true).catch((err) => {
        console.error('[GET /api/posts/[id]] Background sync failed:', err);
        // Don't fail the request even if sync fails
      });
    } else {
      console.log('[GET /api/posts/[id]] No pool address to sync');
    }

    // Calculate actual prices from sqrt prices
    let priceLong: number | null = null;
    let priceShort: number | null = null;

    if (poolData?.sqrt_price_long_x96) {
      try {
        priceLong = sqrtPriceX96ToPrice(poolData.sqrt_price_long_x96);
      } catch (e) {
      }
    }

    if (poolData?.sqrt_price_short_x96) {
      try {
        priceShort = sqrtPriceX96ToPrice(poolData.sqrt_price_short_x96);
      } catch (e) {
      }
    }

    // Transform the data to match our Post type
    const transformedPost = {
      id: post.id,
      authorId: post.user_id,
      timestamp: post.created_at,
      createdAt: post.created_at,

      // New schema fields
      post_type: post.post_type || 'text',
      content_text: post.content_text, // Plain text content
      content_json: post.content_json, // Tiptap JSON
      caption: post.caption,
      media_urls: post.media_urls,
      article_title: post.article_title,
      cover_image_url: post.cover_image_url,
      image_display_mode: post.image_display_mode || 'contain',

      // Author info
      author: userData ? {
        id: userData.id,
        username: userData.username || 'anonymous',
        display_name: userData.display_name,
        avatar_url: userData.avatar_url
      } : null,

      // Belief info
      belief: null,

      // Pool info (ICBS - synced from chain if stale)
      poolAddress: poolData?.pool_address || null,
      // Token supplies are stored in DISPLAY units in DB (per units.ts spec)
      // Note: Use !== null/undefined check to allow 0 values (selling all tokens results in 0 supply)
      poolSupplyLong: poolData?.s_long_supply !== null && poolData?.s_long_supply !== undefined
        ? Number(poolData.s_long_supply)
        : null,
      poolSupplyShort: poolData?.s_short_supply !== null && poolData?.s_short_supply !== undefined
        ? Number(poolData.s_short_supply)
        : null,
      poolPriceLong: priceLong,
      poolPriceShort: priceShort,
      poolSqrtPriceLongX96: poolData?.sqrt_price_long_x96 || null,
      poolSqrtPriceShortX96: poolData?.sqrt_price_short_x96 || null,
      poolVaultBalance: poolData?.vault_balance ? Number(poolData.vault_balance) / USDC_PRECISION : null,
      poolReserveLong: poolData?.r_long !== null && poolData?.r_long !== undefined ? Number(poolData.r_long) : null,
      poolReserveShort: poolData?.r_short !== null && poolData?.r_short !== undefined ? Number(poolData.r_short) : null,
      poolLastSyncedAt: poolData?.last_synced_at || null,
      // ICBS parameters (F is FIXED at 1 for all pools)
      poolF: poolData?.f || 1,
      poolBetaNum: poolData?.beta_num || 1,
      poolBetaDen: poolData?.beta_den || 2
    };

    // Validate response with Zod schema
    try {
      const validated = PostAPIResponseSchema.parse(transformedPost);
      return NextResponse.json(validated);
    } catch (validationError) {
      console.error('[GET /api/posts/[id]] Validation failed:', validationError);
      console.error('[GET /api/posts/[id]] Transformed post data:', JSON.stringify(transformedPost, null, 2));
      // Return unvalidated data with warning in both dev and production
      // This prevents the app from breaking if validation is too strict
      console.warn('[GET /api/posts/[id]] Returning unvalidated data due to validation error');
      return NextResponse.json(transformedPost);
    }
  } catch (error) {
    console.error('[GET /api/posts/[id]] Unexpected error:', error);
    // Check for connection errors
    if (error instanceof Error) {
      if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Database unavailable. Run: npx supabase start' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}