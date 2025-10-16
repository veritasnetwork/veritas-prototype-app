/**
 * PostDetailContent Component
 * Full post content display for the detail panel
 * Phase 2: Complete post display with pool metrics
 */

'use client';

import { useState, useEffect } from 'react';
import { getPostTitle, type Post } from '@/types/post.types';
import { TiptapRenderer } from '../TiptapRenderer';
import { usePanel } from './PanelProvider';

interface PostDetailContentProps {
  postId: string;
}

export function PostDetailContent({ postId }: PostDetailContentProps) {
  const { closePanel } = usePanel();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch post data
  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/posts/${postId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch post: ${response.status}`);
        }

        const data = await response.json();
        setPost(data);
      } catch (err) {
        console.error('[PostDetailContent] Error fetching post:', err);
        setError(err instanceof Error ? err.message : 'Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    if (postId) {
      fetchPost();
    }
  }, [postId]);

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading post...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !post) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-xl">!</span>
          </div>
          <p className="text-gray-400">Unable to load post. Please try again.</p>
        </div>
      </div>
    );
  }

  const postTitle = getPostTitle(post);

  return (
    <div className="p-6 relative">
      {/* Close Button */}
      <button
        onClick={closePanel}
        className="absolute top-6 left-6 w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors z-10"
        aria-label="Close"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 4L4 12M4 4L12 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Post Header */}
      <div className="mb-6 mt-8">
        <h1 className="text-2xl font-bold text-white mb-2">{postTitle}</h1>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span>@{post.author?.username || 'unknown'}</span>
          <span>•</span>
          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Post Content */}
      <div className="prose prose-invert max-w-none">
        {post.contentRich ? (
          <TiptapRenderer content={post.contentRich} />
        ) : (
          <p className="text-gray-300 whitespace-pre-wrap">{post.content}</p>
        )}
      </div>

      {/* Media */}
      {post.media && post.media.length > 0 && (
        <div className="mt-6 space-y-4">
          {post.media.map((item, index) => (
            <div key={index}>
              {item.type === 'image' && (
                <img src={item.url} alt={item.alt || ''} className="rounded-lg max-w-full" />
              )}
              {item.type === 'video' && (
                <video src={item.url} controls className="rounded-lg max-w-full" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
