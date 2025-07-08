'use client';

import { useState, useEffect } from 'react';
import { Belief } from '@/types/belief.types';
import { HeadingComponent } from './components/HeadingComponent';
import { ChartComponent } from './components/ChartComponent';
import { ArticleComponent } from './components/ArticleComponent';
import { MetadataComponent } from './components/MetadataComponent';
import { IntelligenceEvolution } from './IntelligenceEvolution';
import { CommentsSection } from './CommentsSection';
import { ActionPanel } from './ActionPanel';
import { RelatedBeliefs } from './RelatedBeliefs';
import { SkeletonBeliefDetailPage } from './skeleton/SkeletonBeliefDetailPage';
import { getBeliefById } from '@/lib/data';
import { ArrowLeft, Share2, Bookmark } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface BeliefDetailPageProps {
  beliefId: string;
}

export const BeliefDetailPage: React.FC<BeliefDetailPageProps> = ({
  beliefId
}) => {
  const [belief, setBelief] = useState<Belief | null>(null);
  const [editingComponent, setEditingComponent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchBelief = () => {
      const foundBelief = getBeliefById(beliefId);
      setBelief(foundBelief);
      
      setTimeout(() => {
        setIsLoading(false);
      }, 800);
    };

    fetchBelief();
  }, [beliefId]);

  const handleBeliefClick = (newBeliefId: string) => {
    router.push(`/belief/${newBeliefId}`);
  };

  const handleBackToFeed = () => {
    router.push('/');
  };

  if (isLoading) {
    return <SkeletonBeliefDetailPage />;
  }

  if (!belief) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">🔍</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Information Not Found
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-8">
              The information with ID &quot;{beliefId}&quot; could not be found.
            </p>
            <button 
              onClick={handleBackToFeed}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-blue-600 dark:from-amber-400 dark:to-blue-500 text-white font-medium rounded-xl hover:shadow-lg transition-all duration-300"
            >
              Back to Feed
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Simplified Header - No Heading Content */}
      <div className="bg-gradient-to-r from-amber-500/10 to-blue-600/10 dark:from-amber-400/10 dark:to-blue-500/10 border-b border-slate-200 dark:border-slate-700 pt-20 md:pt-8">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Breadcrumbs */}
          <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
            <button 
              onClick={handleBackToFeed}
              className="flex items-center space-x-2 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Feed</span>
            </button>
            <span>/</span>
            <span className="text-amber-600 dark:text-amber-400">{belief.category}</span>
            <span>/</span>
            <span>Details</span>
          </div>

          {/* Category Badge & Actions */}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700">
              {belief.category}
            </span>
            
            <div className="flex items-center space-x-3">
              <button className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-300 border border-slate-200 dark:border-slate-600">
                <Share2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <button className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-300 border border-slate-200 dark:border-slate-600">
                <Bookmark className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - News Article Style */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Article Content - 3 columns on desktop */}
          <div className="lg:col-span-3">
            
            {/* Hero Image Section - News Style */}
            {belief.article?.thumbnail && (
              <div className="relative w-full h-64 md:h-80 lg:h-96 rounded-2xl overflow-hidden mb-8 shadow-lg">
                <Image 
                  src={belief.article.thumbnail}
                  alt={belief.heading.title}
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <div className="text-xs uppercase tracking-wide font-medium mb-2 text-amber-300">
                    Veritas Intelligence
                  </div>
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight drop-shadow-lg">
                    {belief.heading.title}
                  </h1>
                  {belief.heading.context && (
                    <p className="text-lg text-gray-200 mt-2 drop-shadow">
                      {belief.heading.context}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Article Content - No Card Wrapper */}
            <div className="space-y-8">
              
              {/* Heading Component (for cases without hero image) */}
              {!belief.article?.thumbnail && (
                <div 
                  className={`cursor-pointer transition-all duration-200 ${editingComponent === 'heading' ? 'ring-2 ring-amber-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800'} rounded-xl p-4`}
                  onClick={() => setEditingComponent('heading')}
                >
                  <HeadingComponent 
                    heading={belief.heading} 
                    variant="detail" 
                    isEditable={true}
                    onEdit={() => setEditingComponent('heading')}
                  />
                </div>
              )}
              
              {/* Chart Component */}
              <div 
                className={`cursor-pointer transition-all duration-200 ${editingComponent === 'chart' ? 'ring-2 ring-amber-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800'} rounded-xl p-4`}
                onClick={() => setEditingComponent('chart')}
              >
                <ChartComponent 
                  charts={belief.charts} 
                  variant="detail" 
                />
              </div>

              {/* Submit Belief CTA Button */}
              <div className="flex justify-center my-8">
                <button 
                  onClick={() => {
                    // Trigger ActionPanel submission modal
                    const actionPanel = document.querySelector('[data-action-panel]') as HTMLElement;
                    actionPanel?.click();
                  }}
                  className="px-8 py-4 bg-gradient-to-r from-amber-500 to-blue-600 dark:from-amber-400 dark:to-blue-500 text-white font-semibold rounded-2xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-300 hover:scale-105"
                >
                  Submit Your Understanding
                </button>
              </div>
              
              {/* Article Component */}
              <div 
                className={`cursor-pointer transition-all duration-200 ${editingComponent === 'article' ? 'ring-2 ring-amber-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800'} rounded-xl p-4`}
                onClick={() => setEditingComponent('article')}
              >
                <ArticleComponent 
                  article={belief.article} 
                  variant="detail" 
                  isEditable={true}
                  onEdit={() => setEditingComponent('article')}
                />
              </div>
              
              {/* Metadata Component */}
              <div 
                className={`cursor-pointer transition-all duration-200 ${editingComponent === 'metadata' ? 'ring-2 ring-amber-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800'} rounded-xl p-4`}
                onClick={() => setEditingComponent('metadata')}
              >
                <MetadataComponent 
                  belief={belief} 
                  variant="detail" 
                  isEditable={true}
                  onEdit={() => setEditingComponent('metadata')}
                />
              </div>
            </div>

            {/* Full Width Sections */}
            <div className="mt-12 space-y-8">
              {/* Intelligence Evolution - 3 Line Charts */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                <IntelligenceEvolution belief={belief} />
              </div>

              {/* Community Discussion */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                <CommentsSection belief={belief} />
              </div>
            </div>
          </div>

          {/* Sidebar - 1 column on desktop */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Take Action - Prominent Position */}
            <div data-action-panel>
              <ActionPanel belief={belief} />
            </div>

            {/* Related Information */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
              <RelatedBeliefs 
                belief={belief} 
                onBeliefClick={handleBeliefClick}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Component Editing Modal */}
      {editingComponent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-blue-600/20">
                    <span className="text-xl">✏️</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      Edit {editingComponent} Component
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Propose changes to information components
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingComponent(null)}
                  className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-blue-600/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🚧</span>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Coming Soon
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    Component editing functionality is under development.
                  </p>
                  <button
                    onClick={() => setEditingComponent(null)}
                    className="px-6 py-2 bg-gradient-to-r from-amber-500 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all duration-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
