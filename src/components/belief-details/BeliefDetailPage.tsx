'use client';

import { useState, useEffect } from 'react';
import { Belief } from '@/types/belief.types';
import { HeadingComponent } from './components/HeadingComponent';
import { ChartComponent } from './components/ChartComponent';
import { ArticleComponent } from './components/ArticleComponent';
import { IntelligenceEvolution } from './IntelligenceEvolution';
import { CommentsSection } from './CommentsSection';
import { ActionPanel } from './ActionPanel';
import { RelatedBeliefs } from './RelatedBeliefs';
import { SkeletonBeliefDetailPage } from './skeleton/SkeletonBeliefDetailPage';
import { getBeliefById } from '@/lib/data';
import { ArrowLeft, Share2 } from 'lucide-react';
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

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: belief?.heading.title || 'Veritas Intelligence',
        text: belief?.article.excerpt || belief?.article.content.slice(0, 100) + '...' || 'Check out this intelligence on Veritas',
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      // You could add a toast notification here for user feedback
    }
  };

  if (isLoading) {
    return <SkeletonBeliefDetailPage />;
  }

  if (!belief) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-veritas-darker-blue">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">🔍</span>
            </div>
            <h1 className="text-3xl font-bold text-veritas-primary dark:text-veritas-eggshell mb-4">
              Information Not Found
            </h1>
            <p className="text-veritas-primary/70 dark:text-veritas-eggshell/70 mb-8">
              The information with ID &quot;{beliefId}&quot; could not be found.
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-veritas-darker-blue">
      {/* Simplified Header - No Heading Content */}
      <div className="bg-gradient-to-r from-veritas-secondary/10 to-veritas-secondary/5 dark:from-veritas-secondary/15 dark:to-veritas-secondary/5 border-b border-slate-200 dark:border-veritas-eggshell/10 pt-20 md:pt-8">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Breadcrumbs */}
          <div className="flex items-center space-x-2 text-sm text-veritas-primary dark:text-veritas-eggshell mb-4">
            <button 
              onClick={handleBackToFeed}
              className="flex items-center space-x-2 hover:text-veritas-secondary dark:hover:text-veritas-secondary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Feed</span>
            </button>
            <span>/</span>
            <span className="text-veritas-secondary dark:text-veritas-secondary">{belief.category}</span>
            <span>/</span>
            <span>Details</span>
          </div>

          {/* Category Badge & Actions */}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-veritas-secondary/10 dark:bg-veritas-secondary/20 text-veritas-secondary dark:text-veritas-eggshell border border-veritas-secondary/20 dark:border-veritas-secondary/30">
              {belief.category}
            </span>
            
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleShare}
                className="p-2 rounded-xl bg-white dark:bg-veritas-darker-blue/80 hover:bg-slate-100 dark:hover:bg-veritas-eggshell/10 transition-all duration-300 border border-slate-200 dark:border-veritas-eggshell/10"
                aria-label="Share this belief"
                title="Share this belief"
              >
                <Share2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
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
              <div 
                className={`relative w-full h-64 md:h-80 lg:h-96 rounded-2xl overflow-hidden mb-8 shadow-lg cursor-pointer transition-all duration-200 ${editingComponent === 'heading' ? 'ring-2 ring-veritas-secondary' : 'hover:ring-1 hover:ring-veritas-secondary/50'}`}
                onClick={() => setEditingComponent('heading')}
              >
                <Image 
                  src={belief.article.thumbnail}
                  alt={belief.heading.title}
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                <div className="absolute inset-0 bg-veritas-darker-blue/20" />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <div className="text-xs uppercase tracking-wide font-medium mb-2 text-veritas-secondary">
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
                  className={`cursor-pointer transition-all duration-200 ${editingComponent === 'heading' ? 'ring-2 ring-veritas-secondary' : 'hover:bg-slate-100 dark:hover:bg-veritas-eggshell/5'} rounded-xl p-4`}
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

              {/* Article Component */}
              <div 
                className={`cursor-pointer transition-all duration-200 ${editingComponent === 'article' ? 'ring-2 ring-veritas-secondary' : 'hover:bg-slate-100 dark:hover:bg-veritas-eggshell/5'} rounded-xl p-4`}
                onClick={() => setEditingComponent('article')}
              >
                <ArticleComponent 
                  article={belief.article} 
                  variant="detail" 
                  isEditable={true}
                  onEdit={() => setEditingComponent('article')}
                />
              </div>
              
              {/* Chart Component */}
              <div 
                className={`cursor-pointer transition-all duration-200 ${editingComponent === 'chart' ? 'ring-2 ring-veritas-secondary' : 'hover:bg-slate-100 dark:hover:bg-veritas-eggshell/5'} rounded-xl p-4`}
                onClick={() => setEditingComponent('chart')}
              >
                <ChartComponent 
                  charts={belief.charts} 
                  beliefId={belief.id}
                  variant="detail" 
                />
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
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <RelatedBeliefs 
                belief={belief} 
                onBeliefClick={handleBeliefClick}
              />
            </div>
          </div>

          {/* Full Width Sections - Span all 4 columns */}
          <div className="lg:col-span-4 mt-8 space-y-8">
            {/* Intelligence Evolution - 3 Line Charts */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <IntelligenceEvolution belief={belief} />
            </div>

            {/* Community Discussion */}
            <div>
              <CommentsSection belief={belief} />
            </div>
          </div>
        </div>
      </div>

      {/* Component Editing Modal */}
      {editingComponent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-veritas-darker-blue/95 rounded-3xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl border border-white/20 dark:border-veritas-eggshell/10">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-veritas-secondary/20 to-veritas-primary/20">
                    <span className="text-xl">✏️</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-veritas-primary dark:text-veritas-eggshell">
                      Edit {editingComponent} Component
                    </h3>
                    <p className="text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70">
                      Propose changes to information components
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingComponent(null)}
                  className="p-2 text-veritas-primary/60 hover:text-veritas-primary dark:text-veritas-eggshell/60 dark:hover:text-veritas-eggshell transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-veritas-eggshell/10"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-veritas-secondary/20 to-veritas-primary/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🚧</span>
                  </div>
                  <h4 className="text-lg font-semibold text-veritas-primary dark:text-veritas-eggshell mb-2">
                    Coming Soon
                  </h4>
                  <p className="text-veritas-primary/70 dark:text-veritas-eggshell/70 mb-4">
                    Component editing functionality is under development.
                  </p>
                  <button
                    onClick={() => setEditingComponent(null)}
                    className="px-6 py-2 bg-gradient-to-r from-veritas-secondary to-veritas-primary text-white rounded-xl hover:shadow-lg transition-all duration-300"
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
