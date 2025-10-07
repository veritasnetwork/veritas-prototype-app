import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role to bypass RLS
);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    // Extract JWT token
    const token = authHeader.replace('Bearer ', '');

    // Verify Privy JWT token
    let privyUser;
    try {
      const verifiedClaims = await privy.verifyAuthToken(token);
      privyUser = verifiedClaims.userId;
    } catch (error) {
      console.error('Privy token verification failed:', error);

      // In development, allow bypass if network issues
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ DEV MODE: Bypassing Privy verification due to network error');
        // Extract userId from token payload without verification (DEV ONLY!)
        try {
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          privyUser = payload.sub || payload.userId;
          if (!privyUser) throw new Error('No user ID in token');
        } catch (parseError) {
          return NextResponse.json(
            { error: 'Invalid authentication token' },
            { status: 401 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        );
      }
    }

    const body = await request.json();
    const {
      user_id,
      title,
      content,
      initial_belief,
      meta_belief,
      belief_duration_hours,
      post_id,
      tx_signature,
      pool_deployment,
    } = body;

    // Validate required fields
    if (!user_id || !title || initial_belief === undefined || !post_id || !tx_signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get user's agent_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('agent_id')
      .eq('id', user_id)
      .single();

    if (userError || !userData) {
      console.error('Failed to get user agent_id:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const agent_id = userData.agent_id;

    // Create belief FIRST (posts table has FK constraint on belief_id)
    // Get current epoch
    const { data: configData } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'current_epoch')
      .single();

    const currentEpoch = parseInt(configData?.value || '0');
    const durationInEpochs = Math.ceil(belief_duration_hours / 1); // Assuming 1 hour per epoch
    const expirationEpoch = currentEpoch + durationInEpochs;

    const { data: belief, error: beliefError } = await supabase
      .from('beliefs')
      .insert({
        id: post_id, // Same ID as post
        creator_agent_id: agent_id,
        created_epoch: currentEpoch,
        expiration_epoch: expirationEpoch,
        previous_aggregate: initial_belief,
        previous_disagreement_entropy: 0.0,
      })
      .select()
      .single();

    if (beliefError) {
      console.error('Failed to create belief:', beliefError);
      return NextResponse.json(
        { error: 'Failed to create belief', details: beliefError.message },
        { status: 500 }
      );
    }

    // Create post with belief (now that belief exists)
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        id: post_id,
        user_id: user_id,
        title: title,
        content: content || null,
        belief_id: post_id, // Use same ID for linked belief
      })
      .select()
      .single();

    if (postError) {
      console.error('Failed to create post:', postError);
      // Rollback belief
      await supabase.from('beliefs').delete().eq('id', post_id);
      return NextResponse.json(
        { error: 'Failed to create post', details: postError.message },
        { status: 500 }
      );
    }

    // Submit initial belief
    const { error: submissionError } = await supabase
      .from('belief_submissions')
      .insert({
        belief_id: post_id,
        agent_id: agent_id,
        belief: initial_belief,
        meta_prediction: meta_belief || initial_belief,
        epoch: currentEpoch,
      });

    if (submissionError) {
      console.error('Failed to submit initial belief:', submissionError);
      // Note: Not rolling back here since post/belief are created
    }

    // Store pool deployment info if provided
    if (pool_deployment) {
      const { error: poolError } = await supabase
        .from('pool_deployments')
        .insert({
          post_id: post_id,
          belief_id: post_id,
          pool_address: pool_deployment.pool_address,
          token_mint_address: pool_deployment.token_mint_address,
          usdc_vault_address: pool_deployment.usdc_vault_address,
          deployed_by_agent_id: agent_id,
          deployment_tx_signature: pool_deployment.deployment_tx_signature || tx_signature,
          k_quadratic: pool_deployment.k_quadratic,
        });

      if (poolError) {
        console.error('Failed to store pool deployment:', poolError);
        // Continue anyway - post is created
      }
    }

    return NextResponse.json({
      success: true,
      post_id: post.id,
      belief_id: belief.id,
    });

  } catch (error) {
    console.error('Create post error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
