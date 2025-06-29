'use client';

import { useState, useEffect } from 'react';
import { Belief } from '@/types/belief.types';
import { HeadingComponent } from './components/HeadingComponent';
import { ChartComponent } from './components/ChartComponent';
import { ArticleComponent } from './components/ArticleComponent';
import { MetadataComponent } from './components/MetadataComponent';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { getBeliefById } from '@/lib/data';

interface BeliefDetailPageProps {
  beliefId: string;
}

export const BeliefDetailPage: React.FC<BeliefDetailPageProps> = ({
  beliefId
}) => {
  const [belief, setBelief] = useState<Belief | null>(null);
  const [editingComponent, setEditingComponent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBelief = () => {
      const foundBelief = getBeliefById(beliefId);
      setBelief(foundBelief);
      setIsLoading(false);
    };

    fetchBelief();
  }, [beliefId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!belief) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Belief Not Found
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              The belief with ID &quot;{beliefId}&quot; could not be found.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
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

        {/* Component Editing Modal */}
        {editingComponent && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
                Edit {editingComponent} component
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Component editing functionality coming soon. This will allow you to propose changes to belief components.
              </p>
              <button 
                onClick={() => setEditingComponent(null)}
                className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
