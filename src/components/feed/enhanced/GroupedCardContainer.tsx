'use client';

import { useRouter } from 'next/navigation';
import { CardGroup } from './cards/CardGroup';
import { BeliefCard } from '@/components/feed/BeliefCard';
import { BaseBelief } from '@/types/belief.types';

interface GroupedCardContainerProps {
  beliefs: BaseBelief[];
  searchQuery: string;
}

export const GroupedCardContainer: React.FC<GroupedCardContainerProps> = ({
  beliefs,
  searchQuery
}) => {
  const router = useRouter();

  const handleBeliefClick = (beliefId: string) => {
    router.push(`/belief/${beliefId}`);
  };

  // Group beliefs by different criteria
  const featuredBeliefs = beliefs
    .filter(b => b.totalStake > 1000000 || b.participantCount > 5000)
    .slice(0, 2);

  const cryptoFinanceBeliefs = beliefs
    .filter(b => b.category === 'finance' && (
      b.title.toLowerCase().includes('bitcoin') ||
      b.title.toLowerCase().includes('crypto') ||
      b.title.toLowerCase().includes('btc') ||
      b.title.toLowerCase().includes('ethereum')
    ))
    .slice(0, 3);

  const politicsBeliefs = beliefs
    .filter(b => b.category === 'politics')
    .slice(0, 2);

  const sportsBeliefs = beliefs
    .filter(b => b.category === 'sports')
    .slice(0, 3);

  const quickBeliefs = beliefs
    .filter(b => b.totalStake < 100000)
    .slice(0, 4);

  const renderBeliefCard = (belief: BaseBelief, theme: 'light' | 'dark' = 'light', compact = false) => {
    return (
      <BeliefCard
        key={belief.id}
        belief={belief as any}
        theme={theme}
        layout="auto"
        compact={compact}
        onClick={handleBeliefClick}
      />
    );
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="py-2 space-y-8">
        {/* Featured Group - Large navy background */}
        {featuredBeliefs.length > 0 && (
          <CardGroup
            title="🔥 Breaking News"
            subtitle="High-stakes predictions everyone's watching"
            variant="featured"
            className="bg-gradient-to-br from-[#1B365D] to-[#2D4A6B] text-white"
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
              {featuredBeliefs.map(belief => renderBeliefCard(belief, 'dark'))}
            </div>
          </CardGroup>
        )}

        {/* Crypto Group - Yellow accent */}
        {cryptoFinanceBeliefs.length > 0 && (
          <CardGroup
            title="₿ Crypto & Finance"
            subtitle="Digital asset and market predictions"
            variant="accent"
            className="bg-gradient-to-br from-[#FFB800] to-[#F5A623] text-white"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {cryptoFinanceBeliefs.map(belief => renderBeliefCard(belief, 'dark'))}
            </div>
          </CardGroup>
        )}

        {/* Politics Group - Navy accent */}
        {politicsBeliefs.length > 0 && (
          <CardGroup
            title="🗳️ Political Arena"
            subtitle="Elections and policy predictions"
            variant="primary"
            className="bg-gradient-to-br from-[#1B365D] to-[#2D4A6B] text-white"
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
              {politicsBeliefs.map(belief => renderBeliefCard(belief, 'dark'))}
            </div>
          </CardGroup>
        )}

        {/* Sports Group - Mixed layout */}
        {sportsBeliefs.length > 0 && (
          <CardGroup
            title="⚽ Sports Central"
            subtitle="Championship and game predictions"
            variant="mixed"
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {sportsBeliefs.map(belief => renderBeliefCard(belief))}
            </div>
          </CardGroup>
        )}

        {/* Quick Predictions - Compact grid */}
        {quickBeliefs.length > 0 && (
          <CardGroup
            title="⚡ Quick Predictions"
            subtitle="Binary predictions with lower stakes"
            variant="compact"
            className="bg-gray-100 dark:bg-slate-800/50"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {quickBeliefs.map(belief => renderBeliefCard(belief, 'light', true))}
            </div>
          </CardGroup>
        )}

        {/* All Other Beliefs */}
        {beliefs.length > (featuredBeliefs.length + cryptoFinanceBeliefs.length + politicsBeliefs.length + sportsBeliefs.length + quickBeliefs.length) && (
          <CardGroup
            title="📊 More Predictions"
            subtitle="Additional beliefs and predictions"
            variant="mixed"
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {beliefs
                .filter(b => 
                  !featuredBeliefs.includes(b) && 
                  !cryptoFinanceBeliefs.includes(b) && 
                  !politicsBeliefs.includes(b) && 
                  !sportsBeliefs.includes(b) && 
                  !quickBeliefs.includes(b)
                )
                .slice(0, 6)
                .map(belief => renderBeliefCard(belief))}
            </div>
          </CardGroup>
        )}

        {/* No results message */}
        {beliefs.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-slate-400">
              <p className="text-lg font-medium mb-2">No beliefs found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 