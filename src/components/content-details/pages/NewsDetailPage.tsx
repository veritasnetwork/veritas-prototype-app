'use client';

import { useState, useEffect } from 'react';
import { NewsContent } from '@/types/content.types';
import { HeadingComponent } from '../components/HeadingComponent';
import { ChartComponent } from '../components/ChartComponent';
import { ArticleComponent } from '../components/ArticleComponent';
import { RelevanceSignals } from '../RelevanceSignals';
import { SkeletonContentDetailPage } from '../skeleton/SkeletonContentDetailPage';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';

interface NewsDetailPageProps {
  content: NewsContent;
  onBack: () => void;
}

export const NewsDetailPage: React.FC<NewsDetailPageProps> = ({
  content,
  onBack
}) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading for smooth transition
    setTimeout(() => {
      setIsLoading(false);
    }, 300);
  }, []);

  if (isLoading) {
    return <SkeletonContentDetailPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-veritas-darker-blue">
      {/* Minimal Header - Same background as page */}
      <div className="bg-slate-50 dark:bg-veritas-darker-blue pt-20 md:pt-4">
        <div className="container mx-auto px-4 py-3 max-w-7xl">
          {/* Simple Back to Feed Button */}
          <button 
            onClick={onBack}
            className="flex items-center space-x-2 text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70 hover:text-veritas-primary dark:hover:text-veritas-eggshell transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Feed</span>
          </button>
        </div>
      </div>

      {/* Main Content - News Article Style */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Article Content - 3 columns on desktop */}
          <div className="lg:col-span-3">
            
            {/* Hero Image Section - News Style */}
            {content.article?.thumbnail && (
              <div className="relative w-full h-64 md:h-80 lg:h-96 rounded-2xl overflow-hidden mb-8 shadow-lg transition-all duration-200">
                <Image 
                  src={content.article.thumbnail}
                  alt={content.heading.title}
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                <div className="absolute inset-0 bg-veritas-darker-blue/20" />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <div className="text-xs uppercase tracking-wide font-medium mb-2 text-veritas-secondary">
                    {content.source || 'Veritas Intelligence'}
                  </div>
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight drop-shadow-lg">
                    {content.heading.title}
                  </h1>
                  {content.heading.context && (
                    <p className="text-lg text-gray-200 mt-2 drop-shadow">
                      {content.heading.context}
                    </p>
                  )}
                  {content.breakingNews && (
                    <div className="inline-block mt-3 px-3 py-1 bg-red-600 text-white text-xs font-bold uppercase rounded">
                      Breaking News
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Article Content - No Card Wrapper */}
            <div className="space-y-8">
              
              {/* Heading Component (for cases without hero image) */}
              {!content.article?.thumbnail && (
                <div className="transition-all duration-200 rounded-xl p-4">
                  <HeadingComponent 
                    heading={content.heading} 
                    variant="detail" 
                    isEditable={false}
                    onEdit={() => {}}
                  />
                </div>
              )}

              {/* Article Component */}
              <div className="transition-all duration-200 rounded-xl p-4">
                <ArticleComponent 
                  article={content.article} 
                  variant="detail" 
                  isEditable={false}
                  onEdit={() => {}}
                />
              </div>
              
              {/* Chart Component - News specific */}
              {content.charts && content.charts.length > 0 && (
                <div className="transition-all duration-200 rounded-xl p-4">
                  <ChartComponent 
                    charts={content.charts} 
                    beliefId={content.id}
                    variant="detail" 
                  />
                </div>
              )}

            </div>

          </div>

          {/* Sidebar - 1 column on desktop */}
          <div className="lg:col-span-1">
            {/* Quick Stats */}
            {content.source && (
              <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 mb-4 border border-slate-200 dark:border-veritas-eggshell/10">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Source</h3>
                <p className="text-sm text-gray-900 dark:text-white">{content.source}</p>
              </div>
            )}
          </div>

          {/* Full Width Sections - Span all 4 columns */}
          <div className="lg:col-span-4 space-y-8">
            {/* Relevance Signals - Consistent across all content types */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <RelevanceSignals belief={content} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};