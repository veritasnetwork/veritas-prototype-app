/**
 * POST /api/pools/settle
 * Creates a settlement transaction for a ContentPool
 *
 * The server signs with protocol authority, user signs as fee payer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { VeritasCuration } from '@/lib/solana/target/types/veritas_curation';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
import idl from '@/lib/solana/target/idl/veritas_curation.json';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const programId = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID!;
const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';

export async function POST(req: NextRequest) {
  console.log('[/api/pools/settle] Request received');
  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      console.log('[/api/pools/settle] Authentication failed');
      return NextResponse.json({ error: 'Invalid or missing authentication' }, { status: 401 });
    }

    const body = await req.json();
    const { postId, walletAddress } = body;

    console.log('[/api/pools/settle] Request body:', { postId, walletAddress });

    if (!postId || !walletAddress) {
      console.log('[/api/pools/settle] Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create Supabase client
    const supabase = getSupabaseServiceRole();

    // Get pool deployment and belief data
    const { data: poolDeployment, error: poolError } = await supabase
      .from('pool_deployments')
      .select('pool_address, belief_id, post_id')
      .eq('post_id', postId)
      .single();

    if (poolError || !poolDeployment) {
      console.log('[/api/pools/settle] Pool not found for post:', postId);
      return NextResponse.json({ error: 'Pool not found for this post' }, { status: 404 });
    }

    // Get belief with BD score
    const { data: belief, error: beliefError } = await supabase
      .from('beliefs')
      .select('id, previous_aggregate')
      .eq('id', poolDeployment.belief_id)
      .single();

    if (beliefError || !belief) {
      console.log('[/api/pools/settle] Belief not found:', poolDeployment.belief_id);
      return NextResponse.json({ error: 'Belief not found' }, { status: 404 });
    }

    if (belief.previous_aggregate === null || belief.previous_aggregate === undefined) {
      console.log('[/api/pools/settle] No BD score available for belief:', belief.id);
      return NextResponse.json({
        error: 'No decomposition score available. Pool must be processed in an epoch first.'
      }, { status: 400 });
    }

    // Load protocol authority keypair
    const protocolAuthority = loadProtocolAuthority();

    // Create connection and provider
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const provider = new AnchorProvider(
      connection,
      // @ts-ignore - We'll use the protocol authority wallet for signing
      { publicKey: protocolAuthority.publicKey, signTransaction: () => {}, signAllTransactions: () => {} },
      { commitment: 'confirmed' }
    );

    // Create program instance
    const program = new Program<VeritasCuration>(idl as VeritasCuration, provider);
    const programPubkey = new PublicKey(programId);

    // Derive factory PDA and fetch factory data
    const [factoryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('factory')],
      programPubkey
    );

    const factory = await program.account.poolFactory.fetch(factoryPda);

    // Validate that our protocol authority matches the factory's pool_authority
    if (!factory.poolAuthority.equals(protocolAuthority.publicKey)) {
      console.error('[/api/pools/settle] Authority mismatch:', {
        expected: factory.poolAuthority.toBase58(),
        actual: protocolAuthority.publicKey.toBase58(),
      });
      return NextResponse.json({
        error: 'Protocol authority mismatch. Factory authority may have changed. Please contact support.',
      }, { status: 500 });
    }

    // Fetch pool to get pool-specific settle interval (may differ from factory default)
    const poolAccount = await program.account.contentPool.fetch(poolPda);
    const minSettleInterval = poolAccount.minSettleInterval.toNumber();

    // Check settlement cooldown (server-side enforcement)
    const { data: lastSettlement } = await supabase
      .from('settlements')
      .select('created_at')
      .eq('pool_address', poolDeployment.pool_address)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastSettlement) {
      const lastSettleTime = new Date(lastSettlement.created_at).getTime();
      const now = Date.now();
      const timeSinceLastSettle = (now - lastSettleTime) / 1000; // Convert to seconds

      if (timeSinceLastSettle < minSettleInterval) {
        const remainingTime = Math.ceil(minSettleInterval - timeSinceLastSettle);
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;

        return NextResponse.json({
          error: `Settlement cooldown active. Please wait ${minutes}m ${seconds}s before settling again.`,
          remainingSeconds: remainingTime,
          minInterval: minSettleInterval
        }, { status: 429 }); // 429 Too Many Requests
      }
    }

    // Check if pool was already settled recently (using pool's current_epoch)
    // Get pool's current epoch from database
    const { data: poolData, error: poolDataError } = await supabase
      .from('pool_deployments')
      .select('current_epoch')
      .eq('pool_address', poolDeployment.pool_address)
      .single();

    if (poolDataError) {
      console.error('[/api/pools/settle] Failed to get pool epoch:', poolDataError);
      return NextResponse.json({ error: 'Failed to get pool state' }, { status: 500 });
    }

    // Check if there's a settlement for the current epoch already
    if (poolData.current_epoch > 0) {
      const { data: existingSettlement } = await supabase
        .from('settlements')
        .select('id')
        .eq('pool_address', poolDeployment.pool_address)
        .eq('epoch', poolData.current_epoch)
        .single();

      if (existingSettlement) {
        return NextResponse.json({
          error: `Pool already settled at epoch ${poolData.current_epoch}. Run belief decomposition to advance to next epoch.`
        }, { status: 400 });
      }
    }

    // Convert BD score to Q32.32 format (0-1 range to 0-1,000,000 integer)
    const bdScore = Math.floor(belief.previous_aggregate * 1_000_000);

    console.log('[/api/pools/settle] BD score:', {
      raw: belief.previous_aggregate,
      q32Format: bdScore
    });

    // Convert post ID to content ID (same as in pool deployment)
    const postIdBytes = Buffer.from(postId.replace(/-/g, ''), 'hex');
    const postIdBytes32 = Buffer.alloc(32);
    postIdBytes.copy(postIdBytes32, 0);
    const contentId = new PublicKey(postIdBytes32);

    // Derive ContentPool PDA
    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('content_pool'), contentId.toBuffer()],
      programPubkey
    );

    // Build settle_epoch instruction
    // Note: The smart contract only requires pool, factory, protocol_authority, and settler
    const settleEpochIx = await program.methods
      .settleEpoch(bdScore)
      .accounts({
        pool: poolPda,
        factory: factoryPda,
        protocolAuthority: protocolAuthority.publicKey,
        settler: new PublicKey(walletAddress), // User as fee payer
      })
      .instruction();

    // Create transaction
    const transaction = new Transaction();
    transaction.add(settleEpochIx);

    // Set recent blockhash and fee payer
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = new PublicKey(walletAddress); // User pays fees

    // Sign with protocol authority
    transaction.partialSign(protocolAuthority);

    // Serialize transaction (with partial signature)
    const serializedTx = transaction.serialize({
      requireAllSignatures: false
    }).toString('base64');

    console.log('[/api/pools/settle] Settlement transaction created successfully');

    return NextResponse.json({
      transaction: serializedTx,
      bdScore: belief.previous_aggregate,
      poolAddress: poolDeployment.pool_address,
    });
  } catch (error) {
    console.error('[/api/pools/settle] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}