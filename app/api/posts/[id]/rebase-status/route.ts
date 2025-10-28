/**
 * GET /api/posts/[id]/rebase-status
 *
 * Returns information about rebase eligibility:
 * - Number of unique unaccounted-for belief submissions
 * - Cooldown status (time remaining until next rebase is allowed)
 * - Minimum required submissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { VeritasCuration } from '@/lib/solana/target/types/veritas_curation';
import { loadProtocolAuthority } from '@/lib/solana/load-authority';
import idl from '@/lib/solana/target/idl/veritas_curation.json';

const programId = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID!;
const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;

  try {
    const supabase = getSupabaseServiceRole();

    // Get pool deployment
    const { data: poolDeployment, error: poolError } = await supabase
      .from('pool_deployments')
      .select('pool_address, belief_id, current_epoch, status')
      .eq('post_id', postId)
      .single();

    if (poolError || !poolDeployment) {
      return NextResponse.json({ error: 'Pool not found for this post' }, { status: 404 });
    }

    if (poolDeployment.status !== 'market_deployed') {
      return NextResponse.json({
        canRebase: false,
        reason: `Pool status is ${poolDeployment.status}`,
        unaccountedSubmissions: 0,
        minRequiredSubmissions: 0,
        cooldownRemaining: 0,
      });
    }

    const beliefId = poolDeployment.belief_id;
    const poolAddress = poolDeployment.pool_address;
    const lastSettlementEpoch = poolDeployment.current_epoch;
    const nextEpoch = lastSettlementEpoch + 1;

    // Count unique unaccounted-for submissions (submissions in nextEpoch)
    const { data: newSubmissions, error: submissionsError } = await supabase
      .from('belief_submissions')
      .select('agent_id')
      .eq('belief_id', beliefId)
      .eq('epoch', nextEpoch);

    if (submissionsError) {
      console.error('[rebase-status] Failed to count submissions:', submissionsError);
      return NextResponse.json({ error: 'Failed to check submission status' }, { status: 500 });
    }

    const uniqueNewSubmitters = new Set(newSubmissions?.map(s => s.agent_id) || []).size;

    // Get minimum required submissions from config
    const { data: minSubmissionsConfig, error: configError } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'min_new_submissions_for_rebase')
      .single();

    if (configError) {
      console.error('[rebase-status] Failed to get config:', configError);
      return NextResponse.json({ error: 'Failed to read system configuration' }, { status: 500 });
    }

    const minNewSubmissions = parseInt(minSubmissionsConfig?.value || '2');

    // Check cooldown from on-chain pool state
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

    // Check last settlement time from database
    const { data: lastSettlement } = await supabase
      .from('settlements')
      .select('timestamp')
      .eq('pool_address', poolAddress)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    let cooldownRemaining = 0;
    let canRebaseTime: string | null = null;

    if (lastSettlement) {
      const lastSettleTime = new Date(lastSettlement.timestamp).getTime();
      const now = Date.now();
      const timeSinceLastSettle = (now - lastSettleTime) / 1000; // seconds

      if (timeSinceLastSettle < minSettleInterval) {
        cooldownRemaining = Math.ceil(minSettleInterval - timeSinceLastSettle);
        canRebaseTime = new Date(lastSettleTime + minSettleInterval * 1000).toISOString();
      }
    }

    // Determine if rebase is allowed
    const hasEnoughSubmissions = uniqueNewSubmitters >= minNewSubmissions;
    const cooldownExpired = cooldownRemaining === 0;
    const canRebase = hasEnoughSubmissions && cooldownExpired;

    let reason = null;
    if (!cooldownExpired) {
      reason = 'Settlement cooldown active';
    } else if (!hasEnoughSubmissions) {
      reason = `Need ${minNewSubmissions - uniqueNewSubmitters} more unique belief submission(s)`;
    }

    return NextResponse.json({
      canRebase,
      reason,
      unaccountedSubmissions: uniqueNewSubmitters,
      minRequiredSubmissions: minNewSubmissions,
      cooldownRemaining,
      cooldownInterval: minSettleInterval,
      canRebaseTime,
      currentEpoch: lastSettlementEpoch,
      nextEpoch,
    });

  } catch (error) {
    console.error('[/api/posts/[id]/rebase-status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}