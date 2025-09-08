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
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-10">
          <p className="text-red-500">{error}</p>
          <button 
            onClick={fetchPosts}
            className="mt-4 px-4 py-2 bg-veritas-light-blue text-veritas-dark-blue rounded-lg hover:bg-veritas-light-blue/90"
          >
            Try Again
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