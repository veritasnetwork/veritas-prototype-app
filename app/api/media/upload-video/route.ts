/**
 * Phase 5: Upload Video API Route
 * POST /api/media/upload-video
 *
 * Handles video uploads to Supabase Storage (veritas-media bucket)
 * Uses Privy for authentication
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

// File validation constants
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for videos (bucket limit)
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm'
];

export async function POST(request: NextRequest) {
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

    // Get user_id from Privy user (auth_provider = 'privy' and auth_id = privyUserId)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_provider', 'privy')
      .eq('auth_id', privyUserId)
      .single();

    if (userError || !userData) {
      console.error('User lookup error:', userError);
      console.log('Looking for user with auth_provider=privy and auth_id=', privyUserId);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = userData.id;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed types: ${ALLOWED_VIDEO_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const fileName = `${timestamp}-${randomStr}.${fileExt}`;

    // Upload path: videos/{user_id}/{filename}
    const uploadPath = `videos/${userId}/${fileName}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('veritas-media')
      .upload(uploadPath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      return NextResponse.json(
        { error: `Upload failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('veritas-media')
      .getPublicUrl(uploadPath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: data.path,
      fileName: fileName,
      fileSize: file.size,
      fileType: file.type
    });

  } catch (error) {
    console.error('Video upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
