import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';

// Helper function to extract plain text from Tiptap JSON
function extractPlainTextFromTiptap(doc: any): string {
  if (!doc || !doc.content) return '';

  let text = '';

  function traverse(node: any) {
    if (node.text) {
      text += node.text;
    }
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach((child: any) => {
        traverse(child);
        // Add space after block elements
        if (child.type === 'paragraph' || child.type === 'heading') {
          text += ' ';
        }
      });
    }
  }

  traverse(doc);
  return text.trim();
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json(
        { error: 'Invalid or missing authentication' },
        { status: 401 }
      );
    }

    // Check rate limit (10 posts per hour)
    try {
      const { success, headers } = await checkRateLimit(privyUserId, rateLimiters.postCreate);

      if (!success) {
        console.log('[/api/posts/create] Rate limit exceeded for user:', privyUserId);
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. You can create up to 10 posts per hour.',
            rateLimitExceeded: true
          },
          { status: 429, headers }
        );
      }
    } catch (rateLimitError) {
      console.error('[/api/posts/create] Rate limit check failed:', rateLimitError);
      // Continue with request - fail open for availability
    }

    const body = await request.json();
    const {
      user_id,
      post_type,
      content_json,
      media_urls,
      caption,
      article_title,
      cover_image_url,
      initial_belief,
      meta_belief,
      tx_signature,
      pool_deployment,
    } = body;

    // Validate required fields (initial_belief, tx_signature, and post_id are now optional)
    if (!user_id || !post_type) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, post_type' },
        { status: 400 }
      );
    }

    // Generate post_id server-side
    const post_id = crypto.randomUUID();

    // Validate post_type
    const validPostTypes = ['text', 'image', 'video'];
    if (!validPostTypes.includes(post_type)) {
      return NextResponse.json(
        { error: `Invalid post_type. Must be one of: ${validPostTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate post type specific requirements
    if (post_type === 'text') {
      if (!content_json) {
        return NextResponse.json(
          { error: 'content_json is required for text posts' },
          { status: 400 }
        );
      }
    } else if (post_type === 'image' || post_type === 'video') {
      if (!media_urls || !Array.isArray(media_urls) || media_urls.length === 0) {
        return NextResponse.json(
          { error: `media_urls array is required for ${post_type} posts` },
          { status: 400 }
        );
      }
    }

    // Validate caption length (280 chars max)
    if (caption && caption.length > 280) {
      return NextResponse.json(
        { error: 'Caption must be 280 characters or less' },
        { status: 400 }
      );
    }

    // Validate article title length (200 chars max)
    if (article_title && article_title.length > 200) {
      return NextResponse.json(
        { error: 'Article title must be 200 characters or less' },
        { status: 400 }
      );
    }

    // Validate cover image requires title
    if (cover_image_url && !article_title) {
      return NextResponse.json(
        { error: 'Cover image requires an article title' },
        { status: 400 }
      );
    }

    // Get Supabase singleton client
    const supabase = getSupabaseServiceRole();

    // Fetch user and config in parallel
    const [
      { data: userData, error: userError },
      { data: configData }
    ] = await Promise.all([
      supabase
        .from('users')
        .select('agent_id')
        .eq('id', user_id)
        .single(),
      supabase
        .from('system_config')
        .select('value')
        .eq('key', 'current_epoch')
        .single()
    ]);

    if (userError || !userData) {
      console.error('Failed to get user agent_id:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const agent_id = userData.agent_id;
    const currentEpoch = parseInt(configData?.value || '0');

    const { data: belief, error: beliefError } = await supabase
      .from('beliefs')
      .insert({
        id: post_id, // Same ID as post
        creator_agent_id: agent_id,
        created_epoch: currentEpoch,
        previous_aggregate: initial_belief ?? 0.5, // Default to 0.5 (neutral) if not provided
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

    // Extract plain text from content for search/display
    let content_text = null;
    if (post_type === 'text' && content_json) {
      content_text = extractPlainTextFromTiptap(content_json);
    } else if (caption) {
      content_text = caption;
    }

    // Create post with belief (now that belief exists)
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        id: post_id,
        user_id: user_id,
        post_type: post_type,
        content_json: content_json || null,
        media_urls: media_urls || null,
        caption: caption || null,
        content_text: content_text,
        article_title: article_title || null,
        cover_image_url: cover_image_url || null,
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

    // Submit initial belief ONLY if both initial_belief and meta_belief are provided
    if (initial_belief !== undefined && meta_belief !== undefined) {
      const { error: submissionError } = await supabase
        .from('belief_submissions')
        .insert({
          belief_id: post_id,
          agent_id: agent_id,
          belief: initial_belief,
          meta_prediction: meta_belief,
          epoch: currentEpoch,
        });

      if (submissionError) {
        console.error('Failed to submit initial belief:', submissionError);
        // Note: Not rolling back here since post/belief are created
      }
    }

    // Store pool deployment info if provided
    if (pool_deployment) {
      const { error: poolError } = await supabase
        .from('pool_deployments')
        .insert({
          post_id: post_id,
          belief_id: post_id,
          pool_address: pool_deployment.pool_address,
          long_mint_address: pool_deployment.long_mint_address || null,
          short_mint_address: pool_deployment.short_mint_address || null,
          market_address: pool_deployment.market_address || null,
          deployed_by_agent_id: agent_id,
          deployment_tx_signature: pool_deployment.deployment_tx_signature || tx_signature,
          f: pool_deployment.f ?? 3,
          beta_num: pool_deployment.beta_num ?? 1,
          beta_den: pool_deployment.beta_den ?? 2,
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
