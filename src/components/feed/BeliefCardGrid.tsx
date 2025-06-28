'use client';

import { useState, useEffect } from 'react';
import { Belief } from '@/types/belief.types';
import { BeliefCard } from './BeliefCard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useRouter } from 'next/navigation';

export const BeliefCardGrid: React.FC = () => {
  const [beliefs, setBeliefs] = useState<Belief[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // TODO: Replace with actual API call
    const fetchBeliefs = async () => {
      // Mock data for now
      const mockBeliefs: Belief[] = [
        {
          id: '1',
          type: 'continuous',
          title: 'Bitcoin Price Prediction',
          description: 'What will Bitcoin be worth next month?',
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
        }
      ];
      
      setBeliefs(mockBeliefs);
      setIsLoading(false);
    };

    fetchBeliefs();
  }, []);

  const handleCardClick = (beliefId: string) => {
    router.push(`/belief/${beliefId}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {beliefs.map((belief) => (
        <BeliefCard
          key={belief.id}
          belief={belief}
          onCardClick={handleCardClick}
        />
      ))}
    </div>
  );
};
