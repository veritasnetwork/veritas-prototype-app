/**
 * POST /api/pools/deploy
 * Validates pool deployment request
 *
 * Client-side flow:
 * 1. POST here to validate (auth, duplicate check)
 * 2. Client derives PDAs using SDK
 * 3. Client builds + signs + sends transaction
 * 4. Client calls /api/pools/record to save to DB
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  console.log('[/api/pools/deploy] Validation request received');
  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    console.log('[/api/pools/deploy] Auth header present:', !!authHeader);

    const privyUserId = await verifyAuthHeader(authHeader);
    console.log('[/api/pools/deploy] Privy user ID:', privyUserId);

    if (!privyUserId) {
      console.log('[/api/pools/deploy] Authentication failed');
      return NextResponse.json({ error: 'Invalid or missing authentication' }, { status: 401 });
    }

    // Check rate limit (3 deployments per hour)
    try {
      const { success, headers } = await checkRateLimit(privyUserId, rateLimiters.poolDeploy);

      if (!success) {
        console.log('[/api/pools/deploy] Rate limit exceeded for user:', privyUserId);
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. You can deploy up to 3 pools per hour.',
            rateLimitExceeded: true
          },
          { status: 429, headers }
        );
      }
    } catch (rateLimitError) {
      // Log error but don't block the request if rate limiting fails
      console.error('[/api/pools/deploy] Rate limit check failed:', rateLimitError);
      // Continue with request - fail open for availability
    }

    const body = await req.json();
    const { postId } = body;

    if (!postId) {
      return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
    }

    // Create Supabase client
    const supabase = getSupabaseServiceRole();

    // Get user_id from Privy ID or mock ID
    // Check if this is mock auth (auth_id starts with 'mock-user-')
    const isMockAuth = privyUserId.startsWith('mock-user-');
    const authProvider = isMockAuth ? 'mock' : 'privy';

    console.log('[/api/pools/deploy] Querying user with auth_id:', privyUserId, 'auth_provider:', authProvider);

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, auth_id, auth_provider')
      .eq('auth_id', privyUserId)
      .eq('auth_provider', authProvider)
      .single();

    console.log('[/api/pools/deploy] User query result:', { user, userError });

    if (userError || !user) {
      console.log('[/api/pools/deploy] User not found. Error:', userError);

      // Debug: Check if any users exist with similar auth_id
      const { data: similarUsers } = await supabase
        .from('users')
        .select('auth_id, auth_provider, username')
        .ilike('auth_id', `%${privyUserId.slice(-20)}%`);

      console.log('[/api/pools/deploy] Similar users found:', similarUsers);

      return NextResponse.json({
        error: 'You need to complete onboarding first. Please refresh the page to set up your profile.',
        userFriendlyError: true,
        debug: {
          privyUserId,
          userError: userError?.message,
          similarUsersCount: similarUsers?.length || 0
        }
      }, { status: 404 });
    }

    // Verify post exists and user owns it
    console.log('[/api/pools/deploy] Querying post:', postId);

    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, user_id')
      .eq('id', postId)
      .single();

    console.log('[/api/pools/deploy] Post query result:', { post, postError });

    if (postError || !post) {
      console.log('[/api/pools/deploy] Post not found. Error:', postError);
      return NextResponse.json({
        error: 'Post not found',
        debug: { postId, postError: postError?.message }
      }, { status: 404 });
    }

    console.log('[/api/pools/deploy] Checking ownership. Post user_id:', post.user_id, 'Current user_id:', user.id);

    if (post.user_id !== user.id) {
      console.log('[/api/pools/deploy] User does not own this post');
      return NextResponse.json({ error: 'Not authorized to deploy pool for this post' }, { status: 403 });
    }

    // Check if pool already deployed in database
    console.log('[/api/pools/deploy] Checking for existing pool deployment');

    const { data: existingPool } = await supabase
      .from('pool_deployments')
      .select('pool_address')
      .eq('post_id', postId)
      .single();

    if (existingPool) {
      console.log('[/api/pools/deploy] Pool already deployed in DB:', existingPool.pool_address);
      return NextResponse.json(
        {
          error: 'Pool already deployed for this post',
          existingPoolAddress: existingPool.pool_address
        },
        { status: 409 }
      );
    }

    // Check if pool exists on-chain (might not be in DB due to previous recording failure)
    const { Connection, PublicKey } = await import('@solana/web3.js');
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899');

    // Derive pool address from post ID
    const postIdHex = postId.replace(/-/g, '');
    const postIdBytes = Buffer.from(postIdHex, 'hex');
    const contentIdBuffer = Buffer.alloc(32);
    postIdBytes.copy(contentIdBuffer, 0);

    const programId = new PublicKey(process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID!);
    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('content_pool'), contentIdBuffer],
      programId
    );

    const poolAccountInfo = await connection.getAccountInfo(poolPda);
    if (poolAccountInfo) {
      console.log('[/api/pools/deploy] Pool account exists on-chain:', poolPda.toBase58());

      // Check if this is an orphaned pool (created but never deployed with liquidity)
      // An orphaned pool will have minimal data (just the created account with default values)
      // A properly deployed pool will have vault, mints, and other data initialized
      try {
        const { Program, AnchorProvider, Wallet } = await import('@coral-xyz/anchor');
        const { Keypair } = await import('@solana/web3.js');

        // Create a dummy wallet for the provider
        const dummyKeypair = Keypair.generate();
        const wallet = new Wallet(dummyKeypair);
        const provider = new AnchorProvider(connection, wallet, {});

        const idl = await import('@/lib/solana/target/idl/veritas_curation.json');
        const program = new Program(idl.default as any, provider);

        const poolData = await program.account.contentPool.fetch(poolPda);

        // Check if pool is properly deployed (has vault initialized)
        if (poolData.vault && poolData.vault.toBase58() !== '11111111111111111111111111111111') {
          console.log('[/api/pools/deploy] Pool fully deployed with vault:', poolData.vault.toBase58());
          return NextResponse.json(
            {
              error: 'Pool already exists and is fully deployed for this post.',
              existingPoolAddress: poolPda.toBase58()
            },
            { status: 409 }
          );
        }

        console.log('[/api/pools/deploy] Pool exists but is orphaned (no vault). Allowing redeployment with init_if_needed.');
        // Fall through to allow deployment - smart contract now handles orphaned pools with init_if_needed
      } catch (fetchError) {
        console.log('[/api/pools/deploy] Could not fetch pool data, treating as orphaned:', fetchError);
        // Fall through to allow deployment
      }
    }

    // Validation passed - client can proceed with transaction
    console.log('[/api/pools/deploy] ✅ Validation passed. User can proceed with transaction');
    return NextResponse.json({
      success: true,
      postId,
      userId: user.id,
    });
  } catch (error) {
    console.error('[/api/pools/deploy] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
