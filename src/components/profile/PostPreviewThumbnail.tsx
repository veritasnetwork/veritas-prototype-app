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

  // Video post - show thumbnail image with play icon
  // For videos: media_urls = [thumbnail, video] or [video] for old posts
  if (post.post_type === 'video' && post.media_urls && post.media_urls.length > 0) {
    const thumbnailUrl = post.media_urls.length > 1 ? post.media_urls[0] : undefined;

    return (
      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-[#0f0f0f] group-hover:scale-105 transition-transform duration-200">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt="Video thumbnail"
            fill
            className="object-cover"
            sizes="96px"
          />
        ) : (
          // Fallback for old videos without thumbnails
          <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
          </div>
        )}
        {/* Play icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <svg className="w-8 h-8 text-white opacity-80" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
        </div>
      </div>
    );
  }

  // Text post with cover image
  if (post.post_type === 'text' && post.cover_image_url) {
    return (
      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-[#0f0f0f] group-hover:scale-105 transition-transform duration-200">
        <Image
          src={post.cover_image_url}
          alt="Cover"
          fill
          className="object-cover"
          sizes="96px"
        />
      </div>
    );
  }

  // Blog post without cover OR text post - render styled preview
  const preview = getPostPreview(post, 100); // Get short preview text

  return (
    <div className="w-24 h-24 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
      {/* For text posts without cover, show document icon */}
      {post.post_type === 'text' ? (
        <div className="flex flex-col items-center justify-center gap-1">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-[9px] text-gray-500 font-medium">BLOG</span>
        </div>
      ) : (
        /* For text posts, show text icon with quote */
        <div className="flex flex-col items-center justify-center gap-1 px-2">
          <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>
          <span className="text-[8px] text-gray-500 font-medium uppercase tracking-wide">Text</span>
        </div>
      )}
    </div>
  );
}
