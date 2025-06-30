'use client';

import { useState, useEffect } from 'react';
import { Belief } from '@/types/belief.types';
import { HeadingComponent } from './components/HeadingComponent';
import { ChartComponent } from './components/ChartComponent';
import { ArticleComponent } from './components/ArticleComponent';
import { MetadataComponent } from './components/MetadataComponent';
import { ConsensusTimeline } from './ConsensusTimeline';
import { CommentsSection } from './CommentsSection';
import { PerformanceStats } from './PerformanceStats';
import { ActionPanel } from './ActionPanel';
import { RelatedBeliefs } from './RelatedBeliefs';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { getBeliefById, getCategoryGradient } from '@/lib/data';
import { ArrowLeft, Share2, Bookmark, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
      setIsLoading(false);
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex justify-center items-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!belief) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">🔍</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Belief Not Found
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-8">
              The belief with ID "{beliefId}" could not be found.
            </p>
            <button 
              onClick={handleBackToFeed}
              className="px-6 py-3 bg-gradient-to-r from-[#FFB800] to-[#F5A623] text-[#1B365D] font-medium rounded-xl hover:shadow-lg transition-all duration-300"
            >
              Back to Feed
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Hero Section with Category-based Background */}
      <div className={`relative bg-gradient-to-br ${getCategoryGradient(belief.category)} border-b border-white/20 dark:border-white/10`}>
        {/* Backdrop overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/5 via-transparent to-[#1B365D]/5" />
        
        <div className="relative container mx-auto px-4 py-8 max-w-7xl">
          {/* Breadcrumbs */}
          <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400 mb-6">
            <button 
              onClick={handleBackToFeed}
              className="flex items-center space-x-2 hover:text-[#FFB800] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Feed</span>
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-[#FFB800]">{belief.category}</span>
            <ChevronRight className="w-4 h-4" />
            <span>Details</span>
          </div>

          {/* Hero Content */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-4">
                <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-gradient-to-r from-[#FFB800]/30 to-[#F5A623]/20 text-[#1B365D] border border-[#FFB800]/40">
                  {belief.category}
                </span>
                <div className={`w-3 h-3 rounded-full ${
                  belief.status === 'active' 
                    ? 'bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50' 
                    : belief.status === 'resolved'
                    ? 'bg-blue-400 shadow-lg shadow-blue-400/50'
                    : 'bg-slate-400'
                }`} />
                <span className="text-sm font-medium capitalize text-slate-700 dark:text-slate-300">
                  {belief.status}
                </span>
              </div>
              
              <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4 leading-tight">
                {belief.title}
              </h1>
              
              <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl">
                {belief.description}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-3 ml-8">
              <button className="p-3 rounded-2xl bg-white/20 dark:bg-white/10 hover:bg-white/30 dark:hover:bg-white/20 transition-all duration-300 hover:scale-110">
                <Share2 className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </button>
              <button className="p-3 rounded-2xl bg-white/20 dark:bg-white/10 hover:bg-white/30 dark:hover:bg-white/20 transition-all duration-300 hover:scale-110">
                <Bookmark className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Column - Primary Content */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Main Belief Card - The Centerpiece */}
            <div className={`backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl shadow-yellow-500/10 bg-gradient-to-br ${getCategoryGradient(belief.category)}`}>
              {/* Premium inner glow */}
              <div className="absolute inset-px bg-gradient-to-br from-white/20 via-transparent to-transparent rounded-3xl opacity-50 pointer-events-none" />
              
              <div className="relative space-y-8">
                <HeadingComponent 
                  belief={belief} 
                  variant="detail" 
                  isEditable={true}
                  onEdit={() => setEditingComponent('heading')}
                />
                
                <ChartComponent 
                  belief={belief} 
                  variant="detail" 
                  isEditable={true}
                  onEdit={() => setEditingComponent('chart')}
                />
                
                <ArticleComponent 
                  belief={belief} 
                  variant="detail" 
                  isEditable={true}
                  onEdit={() => setEditingComponent('article')}
                />
                
                <MetadataComponent 
                  belief={belief} 
                  variant="detail" 
                  isEditable={true}
                  onEdit={() => setEditingComponent('metadata')}
                />
              </div>
            </div>

            {/* Consensus Timeline */}
            <ConsensusTimeline belief={belief} />

            {/* Comments Section */}
            <CommentsSection belief={belief} />
            
          </div>

          {/* Sidebar - Supporting Content */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* Performance Stats */}
            <PerformanceStats belief={belief} />

            {/* Action Panel */}
            <ActionPanel belief={belief} />

            {/* Related Beliefs */}
            <RelatedBeliefs 
              belief={belief} 
              onBeliefClick={handleBeliefClick}
            />
            
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
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10">
                    <span className="text-xl">✏️</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      Edit {editingComponent} Component
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Propose changes to belief components
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
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🚧</span>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Coming Soon
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    Component editing functionality is under development.
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-left">
                    <h5 className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                      Features in development:
                    </h5>
                    <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                      <li>• Propose changes to titles and descriptions</li>
                      <li>• Update chart configurations and timeframes</li>
                      <li>• Add/edit related articles and sources</li>
                      <li>• Community voting on proposed changes</li>
                      <li>• Version history and rollback options</li>
                    </ul>
                  </div>
                </div>

                <button 
                  onClick={() => setEditingComponent(null)}
                  className="w-full py-3 px-6 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-2xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
