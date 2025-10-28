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
import * as anchor from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');

    const privyUserId = await verifyAuthHeader(authHeader);
    console.log('[/api/pools/deploy] Auth check:', { privyUserId });

    if (!privyUserId) {
      return NextResponse.json({ error: 'Invalid or missing authentication' }, { status: 401 });
    }

    // Check rate limit (3 deployments per hour)
    try {
      const { success, headers } = await checkRateLimit(privyUserId, rateLimiters.poolDeploy);

      if (!success) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. You can deploy up to 30 pools per hour.',
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


    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, auth_id, auth_provider')
      .eq('auth_id', privyUserId)
      .eq('auth_provider', authProvider)
      .single();

    console.log('[/api/pools/deploy] User lookup:', {
      user: user?.id,
      username: user?.username,
      userError: userError?.message,
      userErrorCode: userError?.code,
      userErrorDetails: userError?.details,
      searchCriteria: { privyUserId, authProvider, isMockAuth }
    });

    if (userError || !user) {

      // Debug: Check if any users exist with similar auth_id
      const { data: similarUsers } = await supabase
        .from('users')
        .select('auth_id, auth_provider, username')
        .ilike('auth_id', `%${privyUserId.slice(-20)}%`);

      // Debug: Get all users to see what's in the database
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, auth_id, auth_provider, username')
        .limit(10);

      console.log('[/api/pools/deploy] ❌ User not found. All users in DB:', allUsers);


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

    // Verify post exists (anyone can deploy a pool for any post)
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, user_id')
      .eq('id', postId)
      .single();

    console.log('[/api/pools/deploy] Post lookup:', { postId, post: post?.id, postUserId: post?.user_id, postError: postError?.message });

    if (postError || !post) {
      return NextResponse.json({
        error: 'Post not found',
        debug: { postId, postError: postError?.message }
      }, { status: 404 });
    }

    // Get post creator's agent_id
    const { data: postCreatorUser, error: postCreatorError } = await supabase
      .from('users')
      .select('agent_id')
      .eq('id', post.user_id)
      .single();

    if (postCreatorError || !postCreatorUser) {
      return NextResponse.json({
        error: 'Post creator not found',
        debug: { postId, postUserId: post.user_id, error: postCreatorError?.message }
      }, { status: 404 });
    }

    // Get post creator's Solana address from agents table
    const { data: postCreatorAgent, error: agentError } = await supabase
      .from('agents')
      .select('solana_address')
      .eq('id', postCreatorUser.agent_id)
      .single();

    if (agentError || !postCreatorAgent) {
      return NextResponse.json({
        error: 'Post creator agent not found',
        debug: { postId, agentId: postCreatorUser.agent_id, error: agentError?.message }
      }, { status: 404 });
    }

    const postCreatorSolanaAddress = postCreatorAgent.solana_address;
    if (!postCreatorSolanaAddress) {
      return NextResponse.json({
        error: 'Post creator Solana address not found',
        debug: { postId, agentId: postCreatorUser.agent_id }
      }, { status: 404 });
    }

    // Check if pool already deployed in database

    const { data: existingPool } = await supabase
      .from('pool_deployments')
      .select('pool_address')
      .eq('post_id', postId)
      .single();

    if (existingPool) {
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

      // Check if this is an orphaned pool (created but never deployed with liquidity)
      // An orphaned pool will have minimal data (just the created account with default values)
      // A properly deployed pool will have vault, mints, and other data initialized
      try {

        // Create a dummy wallet for the provider (manual implementation to avoid Wallet constructor issues)
        const dummyKeypair = Keypair.generate();
        const wallet = {
          publicKey: dummyKeypair.publicKey,
          signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => {
            if ('sign' in tx && typeof tx.sign === 'function') {
              tx.sign([dummyKeypair]);
            }
            return tx;
          },
          signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> => {
            return txs.map(tx => {
              if ('sign' in tx && typeof tx.sign === 'function') {
                tx.sign([dummyKeypair]);
              }
              return tx;
            });
          },
        };
        const provider = new anchor.AnchorProvider(connection, wallet as anchor.Wallet, {});

        const idl = await import('@/lib/solana/target/idl/veritas_curation.json');
        const program = new anchor.Program(idl.default as anchor.Idl, provider);

        const poolData = await program.account.contentPool.fetch(poolPda);


        // Check if pool is properly deployed (has vault initialized)
        if (poolData.vault && poolData.vault.toBase58() !== '11111111111111111111111111111111') {
          return NextResponse.json(
            {
              error: 'Pool already exists and is fully deployed for this post.',
              existingPoolAddress: poolPda.toBase58(),
              canRecover: true,
              recoveryHint: 'The pool exists on-chain but may not be recorded in the database. Try recovering it.'
            },
            { status: 409 }
          );
        }

        // Return orphaned status so client knows to skip create_pool instruction
        return NextResponse.json({
          success: true,
          postId,
          userId: user.id,
          poolExists: true,
          isOrphaned: true,
          postCreatorSolanaAddress,
        });
      } catch (fetchError) {
        console.error('[/api/pools/deploy] ❌ Could not fetch pool data:', {
          error: fetchError instanceof Error ? fetchError.message : 'Unknown error',
          name: fetchError instanceof Error ? fetchError.name : 'Unknown',
          stack: fetchError instanceof Error ? fetchError.stack?.substring(0, 200) : undefined,
        });
        // If pool account exists but we can't deserialize it, treat as orphaned
        // This means the account was created but deploy_market never ran successfully
        return NextResponse.json({
          success: true,
          postId,
          userId: user.id,
          poolExists: true,
          isOrphaned: true,
          postCreatorSolanaAddress,
        });
      }
    }

    // Validation passed - client can proceed with transaction
    return NextResponse.json({
      success: true,
      postId,
      userId: user.id,
      poolExists: false,
      isOrphaned: false,
      postCreatorSolanaAddress,
    });
  } catch (error) {
    console.error('[/api/pools/deploy] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
