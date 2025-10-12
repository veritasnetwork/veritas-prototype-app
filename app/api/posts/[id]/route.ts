/**
 * API endpoint for fetching individual post details
 * Phase 2: Support for Post Detail Panel
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Connection, PublicKey } from '@solana/web3.js';
import { getRpcEndpoint } from '@/lib/solana/network-config';

// Helper to read u128 little-endian
function readU128LE(buffer: Buffer, offset: number): bigint {
  let value = 0n;
  for (let i = 0; i < 16; i++) {
    value |= BigInt(buffer[offset + i]) << BigInt(i * 8);
  }
  return value;
}

// Helper to read u64 little-endian
function readU64LE(buffer: Buffer, offset: number): bigint {
  let value = 0n;
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
          token_supply,
          reserve,
          k_quadratic,
          deployment_tx_signature,
          usdc_vault_address,
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
    if (poolData?.pool_address && poolData?.usdc_vault_address) {
      const lastSynced = poolData.last_synced_at ? new Date(poolData.last_synced_at).getTime() : 0;
      const now = Date.now();
      const SYNC_THRESHOLD_MS = 10000; // 10 seconds for individual post (more aggressive than feed)

      if ((now - lastSynced) > SYNC_THRESHOLD_MS) {
        try {
          console.log('[Post API] Syncing pool data from chain...');
          const rpcEndpoint = getRpcEndpoint();
          const connection = new Connection(rpcEndpoint, 'confirmed');

          // Fetch pool account for token supply
          const poolPubkey = new PublicKey(poolData.pool_address);
          const poolAccount = await connection.getAccountInfo(poolPubkey);

          if (poolAccount) {
            // Parse ContentPool struct for token_supply
            // Layout: discriminator (8) + authority (32) + k_quadratic (16) + token_supply (16)
            const offset_token_supply = 8 + 32 + 16; // 56
            const tokenSupply = readU128LE(poolAccount.data, offset_token_supply);

            // Fetch vault account for USDC reserve
            const vaultPubkey = new PublicKey(poolData.usdc_vault_address);
            const vaultAccount = await connection.getAccountInfo(vaultPubkey);

            if (vaultAccount) {
              // SPL Token Account layout: mint(32) + owner(32) + amount(8)
              const vaultBalance = readU64LE(vaultAccount.data, 64);

              // Update database with fresh data
              const { error: updateError } = await supabase
                .from('pool_deployments')
                .update({
                  token_supply: tokenSupply.toString(),
                  reserve: vaultBalance.toString(),
                  last_synced_at: new Date().toISOString()
                })
                .eq('post_id', id);

              if (!updateError) {
                // Update poolData with fresh values
                poolData = {
                  ...poolData,
                  token_supply: tokenSupply.toString(),
                  reserve: vaultBalance.toString()
                };
                console.log('[Post API] Pool data synced:', {
                  tokenSupply: tokenSupply.toString(),
                  reserve: vaultBalance.toString()
                });
              }
            }
          }
        } catch (syncError) {
          console.warn('[Post API] Failed to sync pool data:', syncError);
          // Continue with stale data on sync failure
        }
      } else {
        console.log('[Post API] Using cached pool data (recently synced)');
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

      // Pool info (now synced from chain if stale)
      poolAddress: poolData?.pool_address || null,
      poolTokenSupply: poolData?.token_supply || null,
      poolReserveBalance: poolData?.reserve || null, // Micro-USDC (6 decimals)
      poolKQuadratic: poolData?.k_quadratic || 1,

      // Additional metadata
      likes: post.likes || 0,
      views: post.views || 0
    };

    console.log('[Post API] Returning transformed post:', transformedPost.id);
    return NextResponse.json(transformedPost);
  } catch (error) {
    console.error('Error fetching post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}