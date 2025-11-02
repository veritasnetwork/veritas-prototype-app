/**
 * POST /api/posts/[id]/rebase
 *
 * Triggers pool rebase by calculating BD score and returning settlement transaction.
 * BTS scoring + stake redistribution run asynchronously in the background.
 *
 * Flow:
 * 1. Calculate epistemic weights + BD decomposition (synchronous - needed for tx)
 * 2. Build settle_epoch transaction with new BD score
 * 3. Protocol authority partially signs
 * 4. Return transaction for user to sign and send
 * 5. Run BTS scoring + stake redistribution asynchronously (fire and forget)
 *
 * This ensures users can sign the transaction quickly without waiting for
 * the full protocol processing to complete.
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
  console.log(`\n========== REBASE REQUEST START ==========`);
  console.log(`[rebase] Post ID: ${postId}`);
  console.log(`[rebase] Timestamp: ${new Date().toISOString()}`);

  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      console.log(`[rebase] ❌ Authentication failed`);
      return NextResponse.json({ error: 'Invalid or missing authentication' }, { status: 401 });
    }
    console.log(`[rebase] ✅ Authenticated user: ${privyUserId}`);

    const body = await req.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      console.log(`[rebase] ❌ Missing wallet address`);
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }
    console.log(`[rebase] Wallet: ${walletAddress}`);

    // Get Supabase singleton client
    const supabase = getSupabaseServiceRole();

    // Get pool deployment
    console.log(`[rebase] Fetching pool deployment...`);
    const { data: poolDeployment, error: poolError } = await supabase
      .from('pool_deployments')
      .select('pool_address, belief_id, post_id, current_epoch, status')
      .eq('post_id', postId)
      .single();

    if (poolError || !poolDeployment) {
      console.log(`[rebase] ❌ Pool not found:`, poolError);
      return NextResponse.json({ error: 'Pool not found for this post' }, { status: 404 });
    }
    console.log(`[rebase] ✅ Pool found:`, {
      pool_address: poolDeployment.pool_address,
      belief_id: poolDeployment.belief_id,
      current_epoch: poolDeployment.current_epoch,
      status: poolDeployment.status
    });

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

    console.log(`[rebase] New submissions check:`, {
      uniqueNewSubmitters,
      minNewSubmissions,
      lastSettlementEpoch,
      nextEpoch
    });

    if (uniqueNewSubmitters < minNewSubmissions) {
      console.log(`[rebase] ❌ Insufficient new submissions`);
      return NextResponse.json({
        error: `Insufficient new activity. Need at least ${minNewSubmissions} new unique belief submissions since last settlement (found ${uniqueNewSubmitters}).`,
        minNewSubmissions,
        currentNewSubmissions: uniqueNewSubmitters,
        lastSettlementEpoch,
        nextEpoch
      }, { status: 400 });
    }


    // Step 1: Run weights calculation + BD decomposition (synchronous - needed for transaction)
    console.log(`[rebase] Running weights + BD decomposition for belief ${beliefId}...`);

    // Get all participants
    const { data: submissions, error: allSubmissionsError } = await supabase
      .from('belief_submissions')
      .select('agent_id')
      .eq('belief_id', beliefId);

    if (allSubmissionsError || !submissions || submissions.length < 2) {
      console.log(`[rebase] ❌ Insufficient submissions`);
      return NextResponse.json({
        error: 'Insufficient submissions for belief decomposition (need at least 2 participants)'
      }, { status: 400 });
    }

    const participantAgents = [...new Set(submissions.map(s => s.agent_id))];
    console.log(`[rebase] Found ${participantAgents.length} unique participants`);

    // Calculate weights
    const weightsData = await callEdgeFunction('protocol-weights-calculate', {
      belief_id: beliefId,
      participant_agents: participantAgents
    });
    console.log(`[rebase] ✅ Weights calculated for ${Object.keys(weightsData.weights).length} agents`);

    // Run BD decomposition
    let aggregationData;
    try {
      aggregationData = await callEdgeFunction('protocol-beliefs-decompose/decompose', {
        belief_id: beliefId,
        weights: weightsData.weights,
        epoch: nextEpoch // Use pool's next epoch, not system current_epoch
      });
      console.log(`[rebase] ✅ BD decomposition complete: ${(aggregationData.aggregate * 100).toFixed(1)}%`);

      // Check decomposition quality - fall back to naive if too low
      if (aggregationData.decomposition_quality < 0.3) {
        console.log(`[rebase] ⚠️ Low quality, falling back to naive aggregation`);
        aggregationData = await callEdgeFunction('protocol-beliefs-aggregate', {
          belief_id: beliefId,
          weights: weightsData.weights,
          epoch: nextEpoch // Also pass epoch to naive aggregation
        });
      }
    } catch (decomposeError) {
      console.error(`[rebase] ⚠️ Decomposition failed:`, decomposeError);
      console.log(`[rebase] Falling back to naive aggregation`);
      aggregationData = await callEdgeFunction('protocol-beliefs-aggregate', {
        belief_id: beliefId,
        weights: weightsData.weights,
        epoch: nextEpoch // Also pass epoch to naive aggregation
      });
    }

    // NOTE: We do NOT persist the BD score yet!
    // State will only be updated after the settlement transaction succeeds
    // This happens in /api/settlements/record after tx confirmation
    console.log(`[rebase] ⚠️  NOT persisting state yet - waiting for tx confirmation`);


    // Step 2: Use BD score from aggregation
    const bdScore = aggregationData.aggregate;
    console.log(`[rebase] ✅ BD Score (Absolute Relevance): ${(bdScore * 100).toFixed(2)}%`);


    // Step 3: Build settlement transaction
    console.log(`[rebase] Building settlement transaction...`);
    // Convert BD score to millionths format (contract expects 0-1,000,000)
    const bdScoreTyped = asBDScore(bdScore);
    const bdScoreMillionths = bdScoreToMillionths(bdScoreTyped);
    const bdScoreBN = new BN(bdScoreMillionths);
    console.log(`[rebase] BD score for contract: ${bdScoreMillionths} (${bdScore})`);

    // Derive factory PDA
    const [factoryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('factory')],
      programPubkey
    );

    // Validate authority
    const factory = await program.account.poolFactory.fetch(factoryPda);

    // Log what we actually got
    console.log('[rebase] Factory object:', JSON.stringify(factory, null, 2));
    console.log('[rebase] Factory keys:', Object.keys(factory));
    console.log('[rebase] Checking protocol_authority:', (factory as any).protocol_authority);
    console.log('[rebase] Checking protocolAuthority:', (factory as any).protocolAuthority);

    // The IDL uses snake_case: protocol_authority, but Anchor might convert to camelCase
    const factoryAuthority = (factory as any).protocolAuthority || (factory as any).protocol_authority;

    if (!factoryAuthority) {
      console.error('[rebase] protocol_authority field not found on factory');
      console.error('[rebase] Available fields:', Object.keys(factory));
      return NextResponse.json({
        error: 'Factory protocol_authority not found',
        availableFields: Object.keys(factory),
        factoryData: factory
      }, { status: 500 });
    }

    if (!factoryAuthority.equals(protocolAuthority.publicKey)) {
      console.error('[rebase] Authority mismatch:', {
        factoryAuthority: factoryAuthority.toBase58(),
        signerAuthority: protocolAuthority.publicKey.toBase58(),
      });
      return NextResponse.json({
        error: 'Protocol authority mismatch'
      }, { status: 500 });
    }

    // Build settle_epoch instruction
    const settleEpochIx = await program.methods
      .settleEpoch(bdScoreMillionths)
      .accounts({
        pool: poolPda,
        factory: factoryPda,
        protocolAuthority: protocolAuthority.publicKey,
        settler: new PublicKey(walletAddress),
        vault: poolAccount.vault,
      } as any)
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

    // Add memo for wallet transparency
    const { TransactionInstruction } = await import('@solana/web3.js');
    transaction.add(
      new TransactionInstruction({
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        keys: [],
        data: Buffer.from(`Veritas: Settle pool epoch (BD score: ${bdScore.toFixed(3)})`)
      })
    );

    transaction.add(settleEpochIx);

    // Set recent blockhash and fee payer
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = new PublicKey(walletAddress);

    // Protocol authority will sign in /api/settlements/execute (user signs first)
    // Transaction is returned unsigned to user for proper signing order

    // Serialize transaction
    const serializedTx = transaction.serialize({
      requireAllSignatures: false
    }).toString('base64');


    const response: RebaseResponse = {
      success: true,
      transaction: serializedTx,
      beliefId,
      bdScore,
      poolAddress,
      currentEpoch: poolDeployment.current_epoch,
      stakeChanges: {
        totalRewards: 36.43, // Hardcoded for demo UI
        totalSlashes: 36.43, // Hardcoded for demo UI (zero-sum)
        participantCount: participantAgents.length
      }
    };

    console.log(`[rebase] ✅ Transaction built successfully`);
    console.log(`\n========== REBASE SUMMARY ==========`);
    console.log(`BD Score (Absolute Relevance): ${(bdScore * 100).toFixed(2)}%`);
    console.log(`Current Epoch: ${poolDeployment.current_epoch}`);
    console.log(`Participants: ${participantAgents.length}`);
    console.log(`Pool: ${poolAddress.substring(0, 8)}...`);
    console.log(`⚠️  State NOT persisted yet - waiting for tx confirmation`);
    console.log(`BTS + redistribution will run AFTER tx succeeds`);
    console.log(`========== REBASE REQUEST END ==========\n`);

    return NextResponse.json(response);

  } catch (error) {
    console.error(`[rebase] ❌ ERROR:`, error);
    console.log(`========== REBASE REQUEST END (ERROR) ==========\n`);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
