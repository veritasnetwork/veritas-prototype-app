/**
 * PostPreviewThumbnail Component
 * Renders a 96x96 scaled-down preview of a post
 * Handles all post types: image, video, blog (with/without cover), text
 */

'use client';

import { getPostPreview, type Post } from '@/types/post.types';
import Image from 'next/image';

interface PostPreviewThumbnailProps {
  post: Post;
}

export function PostPreviewThumbnail({ post }: PostPreviewThumbnailProps) {
  // Image post - show first image
  if (post.post_type === 'image' && post.media_urls && post.media_urls.length > 0) {
    return (
      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-[#0f0f0f] group-hover:scale-105 transition-transform duration-200">
        <Image
          src={post.media_urls[0]}
          alt="Post preview"
          fill
          className="object-cover"
          sizes="96px"
        />
      </div>
    );
  }

  // Video post - show video thumbnail with play icon
  if (post.post_type === 'video' && post.media_urls && post.media_urls.length > 0) {
    return (
      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-[#0f0f0f] group-hover:scale-105 transition-transform duration-200">
        <video
          src={post.media_urls[0]}
          className="w-full h-full object-cover"
          muted
          playsInline
        />
        {/* Play icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <svg className="w-8 h-8 text-white opacity-80" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
        </div>
      </div>
    );
  }

  // Blog post with cover image
  if (post.post_type === 'blog' && post.cover_image) {
    return (
      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-[#0f0f0f] group-hover:scale-105 transition-transform duration-200">
        <Image
          src={post.cover_image}
          alt="Blog cover"
          fill
          className="object-cover"
          sizes="96px"
        />
      </div>
    );
  }

  // Blog post without cover OR text post - render scaled-down text preview
  const preview = getPostPreview(post, 80); // Get short preview text
  const firstChar = preview?.[0] || 'P';

  return (
    <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-[#2a2a2a] flex items-center justify-center p-2 group-hover:scale-105 transition-transform duration-200">
      {/* For blog posts, show document icon */}
      {post.post_type === 'blog' ? (
        <div className="flex flex-col items-center justify-center gap-1">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-[9px] text-gray-500 font-medium">BLOG</span>
        </div>
      ) : (
        /* For text posts, show preview text scaled down */
        <div className="text-[9px] leading-tight text-gray-300 line-clamp-6 overflow-hidden">
          {preview || 'Text post'}
        </div>
      )}
    </div>
  );
}
