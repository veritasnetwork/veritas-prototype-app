/**
 * POST /api/admin/settlements/retry
 *
 * Manually retry settlement for a specific pool.
 * Used when automated settlement fails during epoch processing.
 *
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    // TODO: Add admin authentication check
    // const authHeader = req.headers.get('authorization');
    // Verify admin role before proceeding

    const body = await req.json();
    const { pool_address, force } = body;

    if (!pool_address) {
      return NextResponse.json(
        { error: 'pool_address is required' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = getSupabaseServiceRole();

    // Get pool deployment info
    const { data: pool, error: poolError } = await supabase
      .from('pool_deployments')
      .select('belief_id, post_id')
      .eq('pool_address', pool_address)
      .single();

    if (poolError || !pool) {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Get belief with BD score
    const { data: belief, error: beliefError } = await supabase
      .from('beliefs')
      .select('id, previous_aggregate, status')
      .eq('id', pool.belief_id)
      .single();

    if (beliefError || !belief) {
      return NextResponse.json(
        { error: 'Belief not found' },
        { status: 404 }
      );
    }

    if (!belief.previous_aggregate && !force) {
      return NextResponse.json(
        { error: 'No BD score available for this belief. Use force=true to override.' },
        { status: 400 }
      );
    }

    // Get current epoch
    const { data: configData } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'current_epoch')
      .single();

    const currentEpoch = parseInt(configData?.value || '0');

    // Check if already settled this epoch
    const { data: existingSettlement } = await supabase
      .from('settlements')
      .select('id, tx_signature, confirmed')
      .eq('pool_address', pool_address)
      .eq('epoch', currentEpoch)
      .single();

    if (existingSettlement && existingSettlement.confirmed && !force) {
      return NextResponse.json(
        {
          error: 'Pool already settled for this epoch',
          settlement: existingSettlement,
          message: 'Use force=true to re-settle'
        },
        { status: 409 }
      );
    }

    // Call pool-settlement edge function using Supabase SDK
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabaseAdmin.functions.invoke('pool-settlement', {
      body: {
        pool_address,
        epoch: currentEpoch,
        bd_score: belief.previous_aggregate,
      }
    });

    if (error) {
      return NextResponse.json(
        {
          error: 'Settlement failed',
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pool_address,
      epoch: currentEpoch,
      bd_score: belief.previous_aggregate,
      result: data,
    });

  } catch (error) {
    console.error('[/api/admin/settlements/retry] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
