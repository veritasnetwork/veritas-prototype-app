/**
 * DELETE /api/media/delete
 * Deletes an image from Supabase Storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuthHeader } from '@/lib/auth/privy-server';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for storage access
);

export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json(
        { error: 'Invalid or missing authentication' },
        { status: 401 }
      );
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
