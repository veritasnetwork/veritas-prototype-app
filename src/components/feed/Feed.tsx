'use client';

import { useEffect, useState } from 'react';
import { PostCard } from './PostCard';
import type { Post } from '@/types/post.types';
import { supabase } from '@/lib/supabase';
import type { Post as SupabasePost, OpinionHistory } from '@/lib/supabase';

export function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    try {
      // Debug logging
      console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('Supabase Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (data) {
        // Transform Supabase data to match our frontend types
        const transformedPosts: Post[] = await Promise.all(
          data.map(async (post: SupabasePost) => {
            let opinionHistory: OpinionHistory[] = [];
            
            // Fetch opinion history if this is an opinion post
            if (post.type === 'opinion') {
              const { data: historyData } = await supabase
                .from('opinion_history')
                .select('*')
                .eq('post_id', post.id)
                .order('recorded_at', { ascending: true })
                .limit(50); // Limit to last 50 data points

              opinionHistory = historyData || [];
            }

            return {
              id: post.id,
              type: post.type,
              headline: post.headline,
              content: post.content,
              thumbnail: post.thumbnail || undefined,
              author: {
                name: post.author_name,
                avatar: post.author_avatar || undefined,
              },
              timestamp: new Date(post.created_at),
              relevanceScore: post.relevance_score,
              signals: {
                truth: post.truth_signal,
                novelty: post.novelty_signal,
                importance: post.importance_signal,
                virality: post.virality_signal,
              },
              sources: post.sources || undefined,
              discussionCount: post.discussion_count,
              opinion: post.type === 'opinion' && post.opinion_yes_percentage !== undefined ? {
                yesPercentage: post.opinion_yes_percentage,
                history: opinionHistory.map(h => ({
                  yesPercentage: h.yes_percentage,
                  recordedAt: new Date(h.recorded_at),
                })),
              } : undefined,
            };
          })
        );

        setPosts(transformedPosts);
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-b border-neutral-200 dark:border-neutral-700 py-10">
              <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-full mb-2"></div>
              <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-5/6"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-neutral-900">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
              Failed to Load Posts
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400">
              We couldn't connect to load the latest posts. Please try refreshing the page.
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-veritas-light-blue text-veritas-dark-blue rounded-xl font-medium hover:bg-veritas-light-blue/90 transition-all duration-200 hover:scale-105"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div>
        {posts.map((post, index) => (
          <div 
            key={post.id} 
            className="animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <PostCard post={post} />
          </div>
        ))}
      </div>
    </div>
  );
}