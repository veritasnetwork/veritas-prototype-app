/**
 * POST /api/posts/[id]/rebase
 *
 * Triggers belief-specific epoch processing (BD decomposition + stake redistribution)
 * then creates a settlement transaction for the pool.
 *
 * Flow:
 * 1. Call protocol-belief-epoch-process to calculate new BD score
 * 2. Build settle_epoch transaction with new BD score
 * 3. Protocol authority partially signs
 * 4. Return transaction for user to sign and send
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { VeritasCuration } from '@/lib/solana/target/types/veritas_curation';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
import idl from '@/lib/solana/target/idl/veritas_curation.json';
import { asBDScore, bdScoreToMillionths } from '@/lib/units';

const programId = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID!;
const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';

interface RebaseResponse {
  success: true;
  transaction: string;
  beliefId: string;
  bdScore: number;
  poolAddress: string;
  currentEpoch: number;
  stakeChanges: {
    totalRewards: number;
    totalSlashes: number;
    participantCount: number;
  };
}

/**
 * Call Supabase Edge Function
 */
async function callEdgeFunction(functionName: string, payload: Record<string, unknown>) {
  console.log(`[rebase] Calling ${functionName}...`);

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      const errorText = await response.text();
      throw new Error(`${functionName} failed (${response.status}): ${errorText}`);
    }
    throw new Error(`${functionName} failed: ${JSON.stringify(errorData)}`);
  }

  return await response.json();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const postId = params.id;
  console.log('[/api/posts/[id]/rebase] Request received for post:', postId);

  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      console.log('[rebase] Authentication failed');
      return NextResponse.json({ error: 'Invalid or missing authentication' }, { status: 401 });
    }

    const body = await req.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      console.log('[rebase] Missing walletAddress');
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    // Get Supabase singleton client
    const supabase = getSupabaseServiceRole();

    // Get pool deployment
    const { data: poolDeployment, error: poolError } = await supabase
      .from('pool_deployments')
      .select('pool_address, belief_id, post_id, current_epoch, status')
      .eq('post_id', postId)
      .single();

    if (poolError || !poolDeployment) {
      console.log('[rebase] Pool not found for post:', postId);
      return NextResponse.json({ error: 'Pool not found for this post' }, { status: 404 });
    }

    if (poolDeployment.status !== 'market_deployed') {
      return NextResponse.json({
        error: `Pool status is ${poolDeployment.status}, must be market_deployed`
      }, { status: 400 });
    }

    const beliefId = poolDeployment.belief_id;
    const poolAddress = poolDeployment.pool_address;

    console.log('[rebase] Pool found:', { poolAddress, beliefId, currentEpoch: poolDeployment.current_epoch });

    // Check settlement cooldown
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const programPubkey = new PublicKey(programId);
    const protocolAuthority = loadProtocolAuthority();

    const provider = new AnchorProvider(
      connection,
      // @ts-expect-error - Dummy wallet for read-only operations
      { publicKey: protocolAuthority.publicKey, signTransaction: () => {}, signAllTransactions: () => {} },
      { commitment: 'confirmed' }
    );

    const program = new Program<VeritasCuration>(idl as VeritasCuration, provider);

    // Derive pool PDA
    const postIdBytes = Buffer.from(postId.replace(/-/g, ''), 'hex');
    const postIdBytes32 = Buffer.alloc(32);
    postIdBytes.copy(postIdBytes32, 0);
    const contentId = new PublicKey(postIdBytes32);

    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('content_pool'), contentId.toBuffer()],
      programPubkey
    );

    // Fetch pool account to get settle interval
    const poolAccount = await program.account.contentPool.fetch(poolPda);
    const minSettleInterval = poolAccount.minSettleInterval.toNumber();

    // Check last settlement time
    const { data: lastSettlement } = await supabase
      .from('settlements')
      .select('created_at')
      .eq('pool_address', poolAddress)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSettlement) {
      const lastSettleTime = new Date(lastSettlement.created_at).getTime();
      const now = Date.now();
      const timeSinceLastSettle = (now - lastSettleTime) / 1000;

      if (timeSinceLastSettle < minSettleInterval) {
        const remainingTime = Math.ceil(minSettleInterval - timeSinceLastSettle);
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;

        return NextResponse.json({
          error: `Settlement cooldown active. Please wait ${minutes}m ${seconds}s before rebasing.`,
          remainingSeconds: remainingTime,
          minInterval: minSettleInterval
        }, { status: 429 });
      }
    }

    console.log('[rebase] Cooldown check passed');

    // Check minimum new submissions threshold
    // Get last settlement epoch to count new submissions since then
    const lastSettlementEpoch = lastSettlement
      ? (await supabase
          .from('settlements')
          .select('epoch')
          .eq('pool_address', poolAddress)
          .order('epoch', { ascending: false })
          .limit(1)
          .maybeSingle()).data?.epoch || 0
      : 0;

    // Count unique new submissions since last settlement
    const { data: newSubmissions, error: submissionsError } = await supabase
      .from('belief_submissions')
      .select('agent_id')
      .eq('belief_id', beliefId)
      .gt('epoch', lastSettlementEpoch);

    if (submissionsError) {
      console.error('[rebase] Failed to count new submissions:', submissionsError);
      return NextResponse.json({ error: 'Failed to check submission status' }, { status: 500 });
    }

    // Get unique agent count
    const uniqueNewSubmitters = new Set(newSubmissions?.map(s => s.agent_id) || []).size;

    // Get configurable minimum from system_config
    const { data: minSubmissionsConfig, error: configError } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'min_new_submissions_for_rebase')
      .single();

    if (configError) {
      console.error('[rebase] Failed to get min_new_submissions_for_rebase config:', configError);
      return NextResponse.json({ error: 'Failed to read system configuration' }, { status: 500 });
    }

    const minNewSubmissions = parseInt(minSubmissionsConfig?.value || '2');

    if (uniqueNewSubmitters < minNewSubmissions) {
      console.log('[rebase] Insufficient new submissions:', {
        required: minNewSubmissions,
        actual: uniqueNewSubmitters,
        lastSettlementEpoch
      });

      return NextResponse.json({
        error: `Insufficient new activity. Need at least ${minNewSubmissions} new unique belief submissions since last settlement (found ${uniqueNewSubmitters}).`,
        minNewSubmissions,
        currentNewSubmissions: uniqueNewSubmitters,
        lastSettlementEpoch
      }, { status: 400 });
    }

    console.log('[rebase] New submissions check passed:', {
      uniqueNewSubmitters,
      minRequired: minNewSubmissions,
      lastSettlementEpoch
    });

    // Step 1: Call protocol-belief-epoch-process
    console.log('[rebase] Step 1: Running belief epoch processing...');

    const epochProcessResult = await callEdgeFunction('protocol-belief-epoch-process', {
      belief_id: beliefId
    });

    console.log('[rebase] Epoch processing complete:', {
      aggregate: epochProcessResult.aggregate,
      certainty: epochProcessResult.certainty,
      participantCount: epochProcessResult.participant_count
    });

    // Step 2: Get updated belief with new BD score
    const { data: belief, error: beliefError } = await supabase
      .from('beliefs')
      .select('id, previous_aggregate, certainty')
      .eq('id', beliefId)
      .single();

    if (beliefError || !belief) {
      console.error('[rebase] Failed to get updated belief:', beliefError);
      return NextResponse.json({ error: 'Failed to get updated belief' }, { status: 500 });
    }

    const bdScore = belief.previous_aggregate;

    if (bdScore === null || bdScore === undefined) {
      return NextResponse.json({
        error: 'Epoch processing did not produce a BD score. Ensure there are at least 2 participants.'
      }, { status: 400 });
    }

    console.log('[rebase] Step 2: BD score updated:', bdScore);

    // Step 3: Build settlement transaction
    console.log('[rebase] Step 3: Building settlement transaction...');

    // Convert BD score to millionths format (contract expects 0-1,000,000)
    const bdScoreTyped = asBDScore(bdScore);
    const bdScoreMillionths = bdScoreToMillionths(bdScoreTyped);
    const bdScoreBN = new BN(bdScoreMillionths);

    // Derive factory PDA
    const [factoryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('factory')],
      programPubkey
    );

    // Validate authority
    const factory = await program.account.poolFactory.fetch(factoryPda);
    if (!factory.poolAuthority.equals(protocolAuthority.publicKey)) {
      console.error('[rebase] Authority mismatch:', {
        expected: factory.poolAuthority.toBase58(),
        actual: protocolAuthority.publicKey.toBase58(),
      });
      return NextResponse.json({
        error: 'Protocol authority mismatch'
      }, { status: 500 });
    }

    // Build settle_epoch instruction
    const settleEpochIx = await program.methods
      .settleEpoch(bdScoreBN)
      .accounts({
        contentPool: poolPda,
        protocolAuthority: protocolAuthority.publicKey,
      })
      .instruction();

    // Create transaction
    const transaction = new Transaction();
    transaction.add(settleEpochIx);

    // Set recent blockhash and fee payer
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = new PublicKey(walletAddress);

    // Protocol authority partially signs
    transaction.partialSign(protocolAuthority);

    // Serialize transaction
    const serializedTx = transaction.serialize({
      requireAllSignatures: false
    }).toString('base64');

    console.log('[rebase] Transaction built and partially signed');

    // Calculate stake changes for response
    const totalRewards = Object.values(epochProcessResult.stake_changes?.individual_rewards || {})
      .reduce((sum: number, val: unknown) => sum + (typeof val === 'number' ? val : 0), 0);
    const totalSlashes = Object.values(epochProcessResult.stake_changes?.individual_slashes || {})
      .reduce((sum: number, val: unknown) => sum + (typeof val === 'number' ? val : 0), 0);

    const response: RebaseResponse = {
      success: true,
      transaction: serializedTx,
      beliefId,
      bdScore,
      poolAddress,
      currentEpoch: poolDeployment.current_epoch,
      stakeChanges: {
        totalRewards,
        totalSlashes,
        participantCount: epochProcessResult.participant_count || 0
      }
    };

    console.log('[rebase] Success:', {
      bdScore,
      totalRewards,
      totalSlashes,
      participantCount: response.stakeChanges.participantCount
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('[/api/posts/[id]/rebase] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
