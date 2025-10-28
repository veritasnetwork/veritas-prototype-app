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
import { Connection, PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { VeritasCuration } from '@/lib/solana/target/types/veritas_curation';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
import idl from '@/lib/solana/target/idl/veritas_curation.json';
import { asBDScore, bdScoreToMillionths } from '@/lib/units';

const programId = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID!;
const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;

  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json({ error: 'Invalid or missing authentication' }, { status: 401 });
    }

    const body = await req.json();
    const { walletAddress } = body;

    if (!walletAddress) {
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
      return NextResponse.json({ error: 'Pool not found for this post' }, { status: 404 });
    }

    if (poolDeployment.status !== 'market_deployed') {
      return NextResponse.json({
        error: `Pool status is ${poolDeployment.status}, must be market_deployed`
      }, { status: 400 });
    }

    const beliefId = poolDeployment.belief_id;
    const poolAddress = poolDeployment.pool_address;


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
      .select('timestamp')
      .eq('pool_address', poolAddress)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSettlement) {
      const lastSettleTime = new Date(lastSettlement.timestamp).getTime();
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


    // Check minimum new submissions threshold
    // Get pool's current epoch (represents last settlement epoch)
    // New submissions use current_epoch + 1
    const { data: poolData, error: poolEpochError } = await supabase
      .from('pool_deployments')
      .select('current_epoch')
      .eq('pool_address', poolAddress)
      .single();

    if (poolEpochError || !poolData) {
      console.error('[rebase] Failed to get pool epoch:', poolEpochError);
      return NextResponse.json({ error: 'Failed to get pool data' }, { status: 500 });
    }

    const lastSettlementEpoch = poolData.current_epoch;
    const nextEpoch = lastSettlementEpoch + 1;

    // Count unique submissions in the next epoch (submissions since last settlement)
    const { data: newSubmissions, error: submissionsError } = await supabase
      .from('belief_submissions')
      .select('agent_id')
      .eq('belief_id', beliefId)
      .eq('epoch', nextEpoch);

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

      return NextResponse.json({
        error: `Insufficient new activity. Need at least ${minNewSubmissions} new unique belief submissions since last settlement (found ${uniqueNewSubmitters}).`,
        minNewSubmissions,
        currentNewSubmissions: uniqueNewSubmitters,
        lastSettlementEpoch,
        nextEpoch
      }, { status: 400 });
    }


    // Step 1: Call protocol-belief-epoch-process

    const epochProcessResult = await callEdgeFunction('protocol-belief-epoch-process', {
      belief_id: beliefId
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


    // Step 3: Build settlement transaction

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
    if (!factory.protocolAuthority.equals(protocolAuthority.publicKey)) {
      console.error('[rebase] Authority mismatch:', {
        expected: factory.protocolAuthority.toBase58(),
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
        pool: poolPda,
        factory: factoryPda,
        protocolAuthority: protocolAuthority.publicKey,
        settler: new PublicKey(walletAddress),
        vault: poolAccount.vault,
      })
      .instruction();

    // Create transaction with increased compute budget
    const transaction = new Transaction();

    // Add compute budget instructions (settle_epoch is computationally expensive)
    // Request 400,000 CU (2x default) and set priority fee
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })
    );
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 })
    );

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


    return NextResponse.json(response);

  } catch (error) {
    console.error('[/api/posts/[id]/rebase] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
