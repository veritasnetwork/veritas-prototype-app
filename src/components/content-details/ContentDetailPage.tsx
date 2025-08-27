'use client';

import { useState, useEffect } from 'react';
import { Belief } from '@/types/belief.types';
import { HeadingComponent } from './components/HeadingComponent';
import { ChartComponent } from './components/ChartComponent';
import { ArticleComponent } from './components/ArticleComponent';
import { RelevanceSignals } from './RelevanceSignals';

// CommentsSection temporarily disabled - can be re-enabled by uncommenting the import and render section below
// import { CommentsSection } from './CommentsSection';

// ActionPanel preserved but not imported - can be re-enabled later
// import { ActionPanel } from './ActionPanel';
import { SkeletonContentDetailPage } from './skeleton/SkeletonContentDetailPage';
import { getBeliefById } from '@/lib/data';
import { ArrowLeft, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface ContentDetailPageProps {
  contentId: string;
}

export const ContentDetailPage: React.FC<ContentDetailPageProps> = ({
  contentId
}) => {
  const [content, setContent] = useState<Belief | null>(null);
  // Component editing temporarily disabled - can be re-enabled by uncommenting
  // const [editingComponent, setEditingComponent] = useState<string | null>(null);
  
  // We keep this variable even though it's unused to preserve any conditional styling
  // and make re-enabling the editing feature easier (just uncomment the state above)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const editingComponent = null;
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchContent = () => {
      const foundContent = getBeliefById(contentId);
      setContent(foundContent);
      
      setTimeout(() => {
        setIsLoading(false);
      }, 800);
    };

    fetchContent();
  }, [contentId]);

  // Removed handleContentClick - was used for RelatedBeliefs navigation

  const handleBackToFeed = () => {
    router.push('/');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: content?.heading.title || 'Veritas Intelligence',
        text: content?.article.excerpt || content?.article.content.slice(0, 100) + '...' || 'Check out this intelligence on Veritas',
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      // You could add a toast notification here for user feedback
    }
  };

  if (isLoading) {
    return <SkeletonContentDetailPage />;
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
              Information Not Found
            </h1>
            <p className="text-veritas-primary/70 dark:text-veritas-eggshell/70 mb-8">
              The information with ID &quot;{contentId}&quot; could not be found.
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
          {/* Simplified Header with Back Button and Share */}
          <div className="flex items-center justify-between">
            {/* Back to Feed Button with simple breadcrumb */}
            <div className="flex items-center space-x-2 text-sm text-veritas-primary dark:text-veritas-eggshell">
              <button 
                onClick={handleBackToFeed}
                className="flex items-center space-x-2 hover:text-veritas-secondary dark:hover:text-veritas-secondary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Feed</span>
              </button>
              <span>/</span>
              <span className="text-veritas-secondary dark:text-veritas-secondary">Details</span>
            </div>
            
            {/* Share Button */}
            <button 
              onClick={handleShare}
              className="p-2 rounded-xl bg-white dark:bg-veritas-darker-blue/80 hover:bg-slate-100 dark:hover:bg-veritas-eggshell/10 transition-all duration-300 border border-slate-200 dark:border-veritas-eggshell/10"
              aria-label="Share this content"
              title="Share this content"
            >
              <Share2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - News Article Style */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Article Content - 3 columns on desktop */}
          <div className="lg:col-span-3">
            
            {/* Hero Image Section - News Style */}
            {content.article?.thumbnail && (
              <div 
                className={`relative w-full h-64 md:h-80 lg:h-96 rounded-2xl overflow-hidden mb-8 shadow-lg transition-all duration-200`}
                // onClick={() => setEditingComponent('heading')} // Component editing disabled
              >
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
                    Veritas Intelligence
                  </div>
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight drop-shadow-lg">
                    {content.heading.title}
                  </h1>
                  {content.heading.context && (
                    <p className="text-lg text-gray-200 mt-2 drop-shadow">
                      {content.heading.context}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Article Content - No Card Wrapper */}
            <div className="space-y-8">
              
              {/* Heading Component (for cases without hero image) */}
              {!content.article?.thumbnail && (
                <div 
                  className={`transition-all duration-200 rounded-xl p-4`}
                  // onClick={() => setEditingComponent('heading')} // Component editing disabled
                >
                  <HeadingComponent 
                    heading={content.heading} 
                    variant="detail" 
                    isEditable={false} // Was true - component editing disabled
                    onEdit={() => {}} // Was setEditingComponent('heading')
                  />
                </div>
              )}

              {/* Article Component */}
              <div 
                className={`transition-all duration-200 rounded-xl p-4`}
                // onClick={() => setEditingComponent('article')} // Component editing disabled
              >
                <ArticleComponent 
                  article={content.article} 
                  variant="detail" 
                  isEditable={false} // Was true - component editing disabled
                  onEdit={() => {}} // Was setEditingComponent('article')
                />
              </div>
              
              {/* Chart Component */}
              <div 
                className={`transition-all duration-200 rounded-xl p-4`}
                // onClick={() => setEditingComponent('chart')} // Component editing disabled
              >
                <ChartComponent 
                  charts={content.charts || []} 
                  beliefId={content.id}
                  variant="detail" 
                />
              </div>           

            </div>

          </div>

          {/* Sidebar - 1 column on desktop (kept empty for now) */}
          <div className="lg:col-span-1">
            {/* This column is intentionally left empty for future use */}
          </div>

          {/* Full Width Sections - Span all 4 columns */}
          <div className="lg:col-span-4 space-y-8">
            {/* Relevance Signals - Multiple Signal Charts */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <RelevanceSignals belief={content} />
            </div>

            {/* Community Discussion - TEMPORARILY DISABLED */}
            {/* To re-enable: 
                1. Uncomment the import statement at the top of the file
                2. Uncomment the div block below
            */}
            {/* <div>
              <CommentsSection belief={content} />
            </div> */}
          </div>
        </div>
      </div>

      {/* Component Editing Modal - TEMPORARILY DISABLED */}
      {/* To re-enable component editing:
          1. Uncomment the editingComponent state variable at the top
          2. Restore onClick handlers in each component section
          3. Set isEditable={true} on components
          4. Uncomment this entire modal block below
      */}
      {/* {editingComponent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-veritas-darker-blue/95 rounded-3xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl border border-slate-200 dark:border-veritas-eggshell/10">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-veritas-primary dark:bg-veritas-eggshell">
                    <svg className="w-6 h-6 text-white dark:text-veritas-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
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
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-veritas-primary/10 dark:bg-veritas-eggshell/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-veritas-primary dark:text-veritas-eggshell" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-veritas-primary dark:text-veritas-eggshell mb-2">
                    Coming Soon
                  </h4>
                  <p className="text-veritas-primary/70 dark:text-veritas-eggshell/70 mb-4">
                    Component editing functionality is under development.
                  </p>
                  <button
                    onClick={() => setEditingComponent(null)}
                    className="px-6 py-2 bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue font-medium rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )} */}
    </div>
  );
};
