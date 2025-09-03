'use client';

import { useState, useEffect } from 'react';
import { 
  Content,
  NewsContent,
  isOpinionContent,
  isConversationContent,
  isBlogContent
} from '@/types/content.types';
import { NewsDetailPage } from './pages/NewsDetailPage';
import { OpinionDetailPage } from './pages/OpinionDetailPage';
import { ConversationDetailPage } from './pages/ConversationDetailPage';
import { BlogDetailPage } from './pages/BlogDetailPage';
import { SkeletonNewsDetailPage } from './skeleton/SkeletonNewsDetailPage';
import { SkeletonOpinionDetailPage } from './skeleton/SkeletonOpinionDetailPage';
import { SkeletonConversationDetailPage } from './skeleton/SkeletonConversationDetailPage';
import { SkeletonBlogDetailPage } from './skeleton/SkeletonBlogDetailPage';
import { getContentById } from '@/lib/data';
import { useRouter } from 'next/navigation';

interface ContentDetailPageProps {
  contentId: string;
}

/**
 * ContentDetailPage Dispatcher Component
 * Routes to appropriate detail page based on content type
 * Handles loading states and shared navigation
 */
export const ContentDetailPage: React.FC<ContentDetailPageProps> = ({
  contentId
}) => {
  const [content, setContent] = useState<Content | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchContent = () => {
      const foundContent = getContentById(contentId);
      setContent(foundContent);
      
      // Simulate loading for smooth transition
      setTimeout(() => {
        setIsLoading(false);
      }, 800);
    };

    fetchContent();
  }, [contentId]);

  const handleBackToFeed = () => {
    router.push('/');
  };

  if (isLoading) {
    // Determine content type even while loading to show the correct skeleton
    const tempContent = getContentById(contentId);
    
    if (tempContent) {
      if (isOpinionContent(tempContent)) {
        return <SkeletonOpinionDetailPage />;
      }
      if (isConversationContent(tempContent)) {
        return <SkeletonConversationDetailPage />;
      }
      if (isBlogContent(tempContent)) {
        return <SkeletonBlogDetailPage />;
      }
      // Default to news skeleton for news and legacy content
      return <SkeletonNewsDetailPage />;
    }
    
    // If content not found, show news skeleton as default
    return <SkeletonNewsDetailPage />;
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-veritas-darker-blue">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">🔍</span>
            </div>
            <h1 className="text-3xl font-bold text-veritas-primary dark:text-veritas-eggshell mb-4">
              Content Not Found
            </h1>
            <p className="text-veritas-primary/70 dark:text-veritas-eggshell/70 mb-8">
              The content with ID &quot;{contentId}&quot; could not be found.
            </p>
            <button 
              onClick={handleBackToFeed}
              className="px-6 py-3 bg-gradient-to-r from-veritas-secondary to-veritas-primary dark:from-veritas-secondary dark:to-veritas-primary text-white font-medium rounded-xl hover:shadow-lg transition-all duration-300"
            >
              Back to Feed
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Route to appropriate detail page based on content type
  if (isOpinionContent(content)) {
    return <OpinionDetailPage content={content} onBack={handleBackToFeed} />;
  }
  
  if (isConversationContent(content)) {
    return <ConversationDetailPage content={content} onBack={handleBackToFeed} />;
  }
  
  if (isBlogContent(content)) {
    return <BlogDetailPage content={content} onBack={handleBackToFeed} />;
  }
  
  // Default to NewsDetailPage for news content and legacy content
  // This ensures backward compatibility with existing Belief type
  return <NewsDetailPage content={content as NewsContent} onBack={handleBackToFeed} />;
};
