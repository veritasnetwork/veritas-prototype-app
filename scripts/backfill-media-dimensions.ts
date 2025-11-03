/**
 * Backfill media dimensions for existing posts
 *
 * This script:
 * 1. Fetches all posts with media_urls but no aspect_ratio
 * 2. Downloads each media file to extract dimensions
 * 3. Updates the database with width, height, and aspect_ratio
 *
 * Usage:
 *   npx tsx scripts/backfill-media-dimensions.ts
 */

import { createClient } from '@supabase/supabase-js';
import sizeOf from 'image-size';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface MediaDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

/**
 * Extract dimensions from a media URL
 */
async function getMediaDimensionsFromUrl(url: string): Promise<MediaDimensions | null> {
  try {
    // Determine media type from URL
    const ext = url.split('.').pop()?.toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const videoExts = ['mp4', 'webm', 'mov'];

    if (imageExts.includes(ext || '')) {
      // For images, use image-size package
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const dimensions = sizeOf(buffer);

      return {
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio: dimensions.width / dimensions.height,
      };
    } else if (videoExts.includes(ext || '')) {
      // For videos, we need ffprobe or similar
      // For now, we'll skip videos and only handle images
      console.warn(`Skipping video (not implemented): ${url}`);
      return null;
    }

    console.warn(`Unknown media type: ${url}`);
    return null;
  } catch (error) {
    console.error(`Failed to get dimensions for ${url}:`, error);
    return null;
  }
}

async function main() {
  console.log('🔍 Fetching posts with media but no aspect ratio...\n');

  // Fetch all posts with media_urls but no aspect_ratio
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, post_type, media_urls')
    .not('media_urls', 'is', null)
    .is('aspect_ratio', null)
    .in('post_type', ['image', 'video']);

  if (error) {
    console.error('Failed to fetch posts:', error);
    process.exit(1);
  }

  if (!posts || posts.length === 0) {
    console.log('✅ No posts need backfilling!');
    return;
  }

  console.log(`Found ${posts.length} posts to process\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`[${i + 1}/${posts.length}] Processing post ${post.id}...`);

    // Get the main media URL (not thumbnail)
    let mediaUrl: string | null = null;

    if (post.post_type === 'image' && post.media_urls && post.media_urls.length > 0) {
      mediaUrl = post.media_urls[0];
    } else if (post.post_type === 'video' && post.media_urls && post.media_urls.length > 0) {
      // For videos: [thumbnail, video] or [video]
      mediaUrl = post.media_urls.length > 1 ? post.media_urls[1] : post.media_urls[0];
    }

    if (!mediaUrl) {
      console.log(`  ⚠️  No media URL found, skipping`);
      skipCount++;
      continue;
    }

    // Extract dimensions
    const dimensions = await getMediaDimensionsFromUrl(mediaUrl);

    if (!dimensions) {
      console.log(`  ❌ Failed to extract dimensions`);
      errorCount++;
      continue;
    }

    // Update database
    const { error: updateError } = await supabase
      .from('posts')
      .update({
        media_width: dimensions.width,
        media_height: dimensions.height,
        aspect_ratio: dimensions.aspectRatio,
      })
      .eq('id', post.id);

    if (updateError) {
      console.error(`  ❌ Failed to update database:`, updateError);
      errorCount++;
      continue;
    }

    console.log(`  ✅ Updated: ${dimensions.width}x${dimensions.height} (${dimensions.aspectRatio.toFixed(2)})`);
    successCount++;

    // Add a small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ⚠️  Skipped: ${skipCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📝 Total: ${posts.length}`);
}

main().catch(console.error);
