/**
 * API endpoint for fetching individual post details
 * Phase 2: Support for Post Detail Panel
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Connection, PublicKey } from '@solana/web3.js';
import { getRpcEndpoint } from '@/lib/solana/network-config';
import { PostAPIResponseSchema } from '@/types/api';
import { sqrtPriceX96ToPrice, USDC_PRECISION } from '@/lib/solana/sqrt-price-helpers';

// Helper to read u128 little-endian
function readU128LE(buffer: Buffer, offset: number): bigint {
  let value = BigInt(0); // Changed from 0n to BigInt(0)
  for (let i = 0; i < 16; i++) {
    value |= BigInt(buffer[offset + i]) << BigInt(i * 8);
  }
  return value;
}

// Helper to read u64 little-endian
function readU64LE(buffer: Buffer, offset: number): bigint {
  let value = BigInt(0); // Changed from 0n to BigInt(0)
  for (let i = 0; i < 8; i++) {
    value |= BigInt(buffer[offset + i]) << BigInt(i * 8);
  }
  return value;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('[Post API] Fetching post with id:', id);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
    let poolData = post.pool_deployments?.[0] || null;

    console.log('[Post API] Extracted data:', {
      hasUser: !!userData,
      hasPool: !!poolData,
      postType: post.post_type
    });

    // Sync pool data from chain if pool exists and is stale (older than 10 seconds)
    // This ensures fresh data when viewing post details
    if (poolData?.pool_address) {
      const lastSynced = poolData.last_synced_at ? new Date(poolData.last_synced_at).getTime() : 0;
      const now = Date.now();
      const SYNC_THRESHOLD_MS = 10000; // 10 seconds for individual post (more aggressive than feed)

      if ((now - lastSynced) > SYNC_THRESHOLD_MS) {
        try {
          console.log('[Post API] Syncing ICBS pool data from chain...');

          // Use the new fetch helper for ICBS pools
          const { fetchPoolData } = await import('@/lib/solana/fetch-pool-data');
          const rpcEndpoint = getRpcEndpoint();
          const poolMetrics = await fetchPoolData(poolData.pool_address, rpcEndpoint);

          // Update database with fresh data
          const { error: updateError } = await supabase
            .from('pool_deployments')
            .update({
              s_long_supply: poolMetrics.supplyLong,
              s_short_supply: poolMetrics.supplyShort,
              vault_balance: poolMetrics.vaultBalance,
              sqrt_price_long_x96: poolMetrics._raw.sqrtPriceLongX96,
              sqrt_price_short_x96: poolMetrics._raw.sqrtPriceShortX96,
              last_synced_at: new Date().toISOString()
            })
            .eq('post_id', id);

          if (!updateError) {
            // Update poolData with fresh values
            poolData = {
              ...poolData,
              s_long_supply: poolMetrics.supplyLong.toString(),
              s_short_supply: poolMetrics.supplyShort.toString(),
              vault_balance: poolMetrics.vaultBalance.toString(),
              sqrt_price_long_x96: poolMetrics._raw.sqrtPriceLongX96,
              sqrt_price_short_x96: poolMetrics._raw.sqrtPriceShortX96,
            };
            console.log('[Post API] ICBS pool data synced:', {
              supplyLong: poolMetrics.supplyLong,
              supplyShort: poolMetrics.supplyShort,
              vaultBalance: poolMetrics.vaultBalance,
              priceLong: poolMetrics.priceLong,
              priceShort: poolMetrics.priceShort
            });
          }
        } catch (syncError) {
          console.warn('[Post API] Failed to sync pool data:', syncError);
          // Continue with stale data on sync failure
        }
      } else {
        console.log('[Post API] Using cached pool data (recently synced)');
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

      // Belief info (TODO: Implement belief aggregation from belief_submissions)
      belief: null,

      // Pool info (ICBS - synced from chain if stale)
      poolAddress: poolData?.pool_address || null,
      poolSupplyLong: poolData?.s_long_supply ? Number(poolData.s_long_supply) / USDC_PRECISION : null,
      poolSupplyShort: poolData?.s_short_supply ? Number(poolData.s_short_supply) / USDC_PRECISION : null,
      poolPriceLong: priceLong,
      poolPriceShort: priceShort,
      poolSqrtPriceLongX96: poolData?.sqrt_price_long_x96 || null,
      poolSqrtPriceShortX96: poolData?.sqrt_price_short_x96 || null,
      poolVaultBalance: poolData?.vault_balance ? Number(poolData.vault_balance) / USDC_PRECISION : null,
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