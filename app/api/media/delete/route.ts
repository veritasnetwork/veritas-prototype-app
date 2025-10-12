/**
 * DELETE /api/media/delete
 * Deletes an image from Supabase Storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for storage access
);

export async function DELETE(request: NextRequest) {
  try {
    // Get auth token from request headers
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify Privy JWT token
    let privyUserId;
    try {
      const verifiedClaims = await privy.verifyAuthToken(token);
      privyUserId = verifiedClaims.userId;
    } catch (error) {
      console.error('Privy token verification failed:', error);

      // In development, allow bypass if network issues
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ DEV MODE: Bypassing Privy verification due to network error');
        try {
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          privyUserId = payload.sub || payload.userId;
          if (!privyUserId) throw new Error('No user ID in token');
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

    // Get user_id from Privy user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_provider', 'privy')
      .eq('auth_id', privyUserId)
      .single();

    if (userError || !userData) {
      console.error('User lookup error:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = userData.id;

    // Parse request body
    const body = await request.json();
    const { path } = body;

    if (!path) {
      return NextResponse.json(
        { error: 'No file path provided' },
        { status: 400 }
      );
    }

    // Security: Verify the path belongs to this user
    // Path format: images/{user_id}/{filename} or videos/{user_id}/{filename}
    const userPathPattern = new RegExp(`^(images|videos)/${userId}/`);
    if (!userPathPattern.test(path)) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only delete your own files' },
        { status: 403 }
      );
    }

    // Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from('veritas-media')
      .remove([path]);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: `Delete failed: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
      path: path,
    });

  } catch (error) {
    console.error('Media delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
