/**
 * API endpoint for fetching individual post details
 * Phase 2: Support for Post Detail Panel
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { PostAPIResponseSchema } from '@/types/api';
import { sqrtPriceX96ToPrice, USDC_PRECISION } from '@/lib/solana/sqrt-price-helpers';
import { syncPoolFromChain } from '@/lib/solana/sync-pool-from-chain';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('[Post API] Fetching post with id:', id);

    const supabase = getSupabaseServiceRole();

    // Fetch post with all related data - using simpler syntax
    const { data: post, error } = await supabase
      .from('posts')
      .select(`
        *,
        users!posts_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        ),
        beliefs!posts_belief_id_fkey (
          id,
          previous_aggregate
        ),
        pool_deployments (
          pool_address,
          s_long_supply,
          s_short_supply,
          vault_balance,
          sqrt_price_long_x96,
          sqrt_price_short_x96,
          f,
          beta_num,
          beta_den,
          deployment_tx_signature,
          long_mint_address,
          short_mint_address,
          last_synced_at
        )
      `)
      .eq('id', id)
      .single();

    console.log('[Post API] Query result:', { post, error });

    if (error) {
      console.error('[Post API] Error fetching post:', error);
      return NextResponse.json(
        { error: 'Post not found', details: error?.message, code: error?.code },
        { status: 404 }
      );
    }

    if (!post) {
      console.error('[Post API] No post found for id:', id);
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Extract nested relations
    const userData = Array.isArray(post.users) ? post.users[0] : post.users;
    const poolData = post.pool_deployments?.[0] || null;

    console.log('[Post API] Extracted data:', {
      hasUser: !!userData,
      hasPool: !!poolData,
      postType: post.post_type
    });

    // Pool data is kept fresh by the event indexer
    // Event indexer updates pool_deployments table after every trade event
    // If critical fields are null, sync from chain as fallback
    if (poolData?.pool_address) {
      // Check if critical fields are null
      const hasNullFields =
        poolData.sqrt_price_long_x96 === null ||
        poolData.sqrt_price_short_x96 === null ||
        poolData.s_long_supply === null ||
        poolData.s_short_supply === null ||
        poolData.vault_balance === null;

      if (hasNullFields) {
        console.log('[Post API] Pool has null fields, syncing from chain...');
        const synced = await syncPoolFromChain(poolData.pool_address);

        if (synced) {
          // Re-fetch pool data after sync
          const { data: refreshedPool } = await supabase
            .from('pool_deployments')
            .select('*')
            .eq('pool_address', poolData.pool_address)
            .single();

          if (refreshedPool) {
            // Replace poolData with refreshed data
            Object.assign(poolData, refreshedPool);
            console.log('[Post API] Pool data refreshed after sync');
          }
        }
      }

      const lastSynced = poolData.last_synced_at ? new Date(poolData.last_synced_at).getTime() : 0;
      const now = Date.now();
      const staleness = now - lastSynced;

      if (staleness > 60000) {
        console.log(`[Post API] Pool data is ${Math.round(staleness / 1000)}s old - may be stale if event indexer is down`);
      } else {
        console.log('[Post API] Using fresh pool data from event indexer');
      }
    }

    // Calculate actual prices from sqrt prices
    let priceLong: number | null = null;
    let priceShort: number | null = null;

    if (poolData?.sqrt_price_long_x96) {
      try {
        priceLong = sqrtPriceX96ToPrice(poolData.sqrt_price_long_x96);
      } catch (e) {
        console.warn('[Post API] Failed to calculate priceLong:', e);
      }
    }

    if (poolData?.sqrt_price_short_x96) {
      try {
        priceShort = sqrtPriceX96ToPrice(poolData.sqrt_price_short_x96);
      } catch (e) {
        console.warn('[Post API] Failed to calculate priceShort:', e);
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

      // Author info
      author: userData ? {
        id: userData.id,
        username: userData.username || 'anonymous',
        display_name: userData.display_name,
        avatar_url: userData.avatar_url
      } : null,

      // Belief info
      belief: null, // TODO: Add belief schema when protocol integration complete

      // Pool info (ICBS - synced from chain if stale)
      poolAddress: poolData?.pool_address || null,
      poolSupplyLong: poolData?.s_long_supply ? Number(poolData.s_long_supply) / USDC_PRECISION : null,
      poolSupplyShort: poolData?.s_short_supply ? Number(poolData.s_short_supply) / USDC_PRECISION : null,
      poolPriceLong: priceLong,
      poolPriceShort: priceShort,
      poolSqrtPriceLongX96: poolData?.sqrt_price_long_x96 || null,
      poolSqrtPriceShortX96: poolData?.sqrt_price_short_x96 || null,
      poolVaultBalance: poolData?.vault_balance ? Number(poolData.vault_balance) / USDC_PRECISION : null,
      poolLastSyncedAt: poolData?.last_synced_at || null,
      // ICBS parameters (F is FIXED at 1 for all pools)
      poolF: poolData?.f || 1,
      poolBetaNum: poolData?.beta_num || 1,
      poolBetaDen: poolData?.beta_den || 2,

      // Additional metadata
      likes: post.likes || 0,
      views: post.views || 0
    };

    console.log('[Post API] Returning transformed post:', {
      id: transformedPost.id,
      poolSupplyLong: transformedPost.poolSupplyLong,
      poolSupplyShort: transformedPost.poolSupplyShort,
      poolPriceLong: transformedPost.poolPriceLong,
      poolPriceShort: transformedPost.poolPriceShort,
      lastSynced: poolData?.last_synced_at
    });

    // Validate response with Zod schema
    try {
      const validated = PostAPIResponseSchema.parse(transformedPost);
      return NextResponse.json(validated);
    } catch (validationError) {
      console.error('[Post API] Schema validation failed:', validationError);
      // In development, return unvalidated data with warning
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Post API] Returning unvalidated data in development mode');
        return NextResponse.json(transformedPost);
      }
      // In production, fail
      return NextResponse.json(
        { error: 'Data validation failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error fetching post:', error);

    // Check for connection errors
    if (error instanceof Error) {
      if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
        console.error('⚠️  Cannot connect to Supabase - Is it running? Try: npx supabase start');
        return NextResponse.json(
          { error: 'Database unavailable. Run: npx supabase start' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}