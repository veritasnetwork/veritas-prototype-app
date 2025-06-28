'use client';

import { useState } from 'react';
import { Belief } from '@/types/belief.types';
import { HeadingComponent } from './components/HeadingComponent';
import { ChartComponent } from './components/ChartComponent';
import { ArticleComponent } from './components/ArticleComponent';
import { MetadataComponent } from './components/MetadataComponent';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

interface BeliefDetailPageProps {
  beliefId: string;
}

export const BeliefDetailPage: React.FC<BeliefDetailPageProps> = ({
  beliefId
}) => {
  const [editingComponent, setEditingComponent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // TODO: Replace with actual API call
  const mockBelief: Belief = {
    id: beliefId,
    type: 'continuous',
    title: 'Bitcoin Price Prediction',
    description: 'What will Bitcoin be worth next month? This prediction aggregates community sentiment about future Bitcoin valuations.',
    category: 'Finance',
    createdAt: new Date().toISOString(),
    status: 'active',
    totalStake: 10000,
    participantCount: 45,
    consensusLevel: 0.7,
    entropy: 0.3,
    distribution: {
      mean: 50000,
      variance: 1000000
    },
    unit: 'USD'
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <HeadingComponent 
          belief={mockBelief} 
          variant="detail" 
          isEditable={true}
          onEdit={() => setEditingComponent('heading')}
        />
        
        <ChartComponent 
          belief={mockBelief} 
          variant="detail" 
          isEditable={true}
          onEdit={() => setEditingComponent('chart')}
        />
        
        <ArticleComponent 
          belief={mockBelief} 
          variant="detail" 
          isEditable={true}
          onEdit={() => setEditingComponent('article')}
        />
        
        <MetadataComponent 
          belief={mockBelief} 
          variant="detail" 
          isEditable={true}
          onEdit={() => setEditingComponent('metadata')}
        />

        {/* TODO: Add ComponentEditingModal when editingComponent is set */}
      </div>
    </div>
  );
};
