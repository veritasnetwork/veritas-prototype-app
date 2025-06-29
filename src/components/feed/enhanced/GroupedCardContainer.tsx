'use client';

import { useRouter } from 'next/navigation';
import { CardGroup } from './cards/CardGroup';
import { BinaryCard } from './cards/BinaryCard';
import { ElectionCard } from './cards/ElectionCard';
import { MultiChoiceCard } from './cards/MultiChoiceCard';
import { ContinuousCard } from './cards/ContinuousCard';
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

  // Real image URLs for different categories
  const getBeliefImage = (belief: BaseBelief) => {
    if (belief.title.toLowerCase().includes('bitcoin') || belief.title.toLowerCase().includes('btc')) {
      return 'https://images.unsplash.com/photo-1640340434855-6084b1f4901c?w=400&h=400&fit=crop&crop=center';
    }
    if (belief.title.toLowerCase().includes('ethereum')) {
      return 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400&h=400&fit=crop&crop=center';
    }
    if (belief.title.toLowerCase().includes('tesla')) {
      return 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=400&h=400&fit=crop&crop=center';
    }
    if (belief.title.toLowerCase().includes('netflix')) {
      return 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=400&h=400&fit=crop&crop=center';
    }
    if (belief.title.toLowerCase().includes('election') || belief.title.toLowerCase().includes('trump')) {
      return 'https://images.unsplash.com/photo-1586227740560-8cf2732c1531?w=400&h=400&fit=crop&crop=center';
    }
    if (belief.category === 'sports') {
      return 'https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?w=400&h=400&fit=crop&crop=center';
    }
    if (belief.category === 'climate') {
      return 'https://images.unsplash.com/photo-1569163139262-de96c2cb1a1b?w=400&h=400&fit=crop&crop=center';
    }
    if (belief.category === 'technology') {
      return 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=400&fit=crop&crop=center';
    }
    // Default fallback
    return 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop&crop=center';
  };

  const renderBeliefCard = (belief: BaseBelief, theme: 'light' | 'dark' = 'light', compact = false) => {
    const consensusPercentage = Math.round(belief.consensusLevel * 100);
    const volumeFormatted = `$${(belief.totalStake / 1000).toFixed(0)}K Vol.`;
    const beliefImage = getBeliefImage(belief);

    // Determine card type based on belief characteristics
    if (belief.title.toLowerCase().includes('election') || belief.title.toLowerCase().includes('wins')) {
      // Election card for political races
      const candidates = [
        { name: "Leading Option", percentage: consensusPercentage, party: "D" },
        { name: "Alternative", percentage: 100 - consensusPercentage, party: "R" }
      ];
      
      return (
        <ElectionCard
          key={belief.id}
          title={belief.title}
          image={beliefImage}
          candidates={candidates}
          volume={volumeFormatted}
          theme={theme}
          onClick={() => handleBeliefClick(belief.id)}
        />
      );
    } else if (belief.title.toLowerCase().includes('price') || belief.title.toLowerCase().includes('$')) {
      // Continuous card for price predictions
      const currentValue = belief.title.includes('bitcoin') ? 98500 : 
                          belief.title.includes('tesla') ? 240 : 
                          Math.floor(Math.random() * 1000) + 100;
      
      return (
        <ContinuousCard
          key={belief.id}
          title={belief.title}
          image={beliefImage}
          currentValue={currentValue}
          unit="USD"
          volume={volumeFormatted}
          theme={theme}
          change={Math.random() * 20 - 10} // Random change between -10% and +10%
          onClick={() => handleBeliefClick(belief.id)}
        />
      );
    } else if (belief.layoutType === 'minimal' || compact) {
      // Binary card for yes/no questions
      return (
        <BinaryCard
          key={belief.id}
          title={belief.title}
          image={beliefImage}
          percentage={consensusPercentage}
          volume={volumeFormatted}
          theme={theme}
          compact={compact}
          onClick={() => handleBeliefClick(belief.id)}
        />
      );
    } else {
      // Multi-choice card for complex options
      const options = [
        { label: "Most Likely", percentage: consensusPercentage },
        { label: "Alternative 1", percentage: Math.floor((100 - consensusPercentage) * 0.6) },
        { label: "Alternative 2", percentage: Math.floor((100 - consensusPercentage) * 0.3) },
        { label: "Other", percentage: 100 - consensusPercentage - Math.floor((100 - consensusPercentage) * 0.6) - Math.floor((100 - consensusPercentage) * 0.3) }
      ];
      
      return (
        <MultiChoiceCard
          key={belief.id}
          title={belief.title}
          image={beliefImage}
          options={options}
          volume={volumeFormatted}
          theme={theme}
          onClick={() => handleBeliefClick(belief.id)}
        />
      );
    }
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