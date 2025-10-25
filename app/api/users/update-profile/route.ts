/**
 * POST /api/users/update-profile
 * Updates user's username and/or profile photo
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json({ error: 'Invalid or missing authentication' }, { status: 401 });
    }

    // Check rate limit (50 updates per hour)
    try {
      const { success, headers } = await checkRateLimit(privyUserId, rateLimiters.profileUpdate);

      if (!success) {
        console.log('[/api/users/update-profile] Rate limit exceeded for user:', privyUserId);
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. You can update your profile up to 50 times per hour.',
            rateLimitExceeded: true
          },
          { status: 429, headers }
        );
      }
    } catch (rateLimitError) {
      console.error('[/api/users/update-profile] Rate limit check failed:', rateLimitError);
      // Continue with request - fail open for availability
    }

    // Parse multipart form data
    const formData = await req.formData();
    const username = formData.get('username') as string;
    const avatarFile = formData.get('avatar') as File | null;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Validate username
    if (!/^[a-z0-9_]{2,50}$/.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 2-50 characters, lowercase letters, numbers, and underscores only' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceRole();

    // Get user by Privy ID
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, username, avatar_url')
      .eq('auth_id', privyUserId)
      .single();

    if (userError || !users) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if username is taken (if changed)
    if (username !== users.username) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (existingUser) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
      }
    }

    // Handle avatar upload if provided
    let avatarUrl = users.avatar_url;
    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${users.id}-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase
        .storage
        .from('veritas-media')
        .upload(`avatars/${fileName}`, avatarFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Avatar upload error:', uploadError);
        return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 });
      }

      // Get public URL
      const { data: { publicUrl } } = supabase
        .storage
        .from('veritas-media')
        .getPublicUrl(`avatars/${fileName}`);

      avatarUrl = publicUrl;

      // Delete old avatar if exists
      if (users.avatar_url && users.avatar_url.includes('veritas-media/avatars/')) {
        const oldPath = users.avatar_url.split('veritas-media/')[1];
        await supabase.storage.from('veritas-media').remove([oldPath]);
      }
    }

    // Update user profile
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        username,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', users.id)
      .select()
      .single();

    if (updateError) {
      console.error('User update error:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: {
        username: updatedUser.username,
        avatar_url: updatedUser.avatar_url,
      },
    });
  } catch (error) {
    console.error('[/api/users/update-profile] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
