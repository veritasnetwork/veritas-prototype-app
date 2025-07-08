import React from 'react';
import { Belief } from '@/types/belief.types';
import { ChartComponent } from '@/components/belief-details/components/ChartComponent';
import { getFeedChart } from '@/lib/data';
import { Clock, Users } from 'lucide-react';

interface BeliefCardProps {
  belief: Belief;
  variant?: 'feed' | 'grid' | 'compact' | 'mobile';
  onClick: (beliefId: string) => void;
}

export const BeliefCard: React.FC<BeliefCardProps> = ({
  belief,
  variant = 'feed',
  onClick
}) => {
  const feedChart = getFeedChart(belief);
  
  // Determine overall confidence level based on truth and relevance scores
  const getConfidenceLevel = () => {
    const avgScore = (belief.objectRankingScores.truth + belief.objectRankingScores.relevance) / 2;
    if (avgScore >= 80) return 'high';
    if (avgScore >= 60) return 'medium';
    return 'low';
  };
  
  const confidenceLevel = getConfidenceLevel();
  
  // Get confidence indicator bars
  const getConfidenceIndicator = () => {
    const level = confidenceLevel;
    const bars = [];
    for (let i = 0; i < 3; i++) {
      const isEnabled = (level === 'high' && i < 3) || (level === 'medium' && i < 2) || (level === 'low' && i < 1);
      bars.push(
        <div
          key={i}
          className={`h-2 w-1 rounded-full ${
            isEnabled 
              ? level === 'high' 
                ? 'bg-green-500' 
                : level === 'medium' 
                  ? 'bg-blue-500' 
                  : 'bg-gray-500'
              : 'bg-gray-300 dark:bg-gray-700'
          }`}
        />
      );
    }
    return bars;
  };
  
    // Card sizing based on variant
  const getCardSizing = () => {
    switch (variant) {
      case 'compact':
        return 'w-full h-36'; // Small cards for premier header grid
      case 'mobile':
        return 'w-full'; // Full width mobile posts
      case 'grid':
        return 'w-full max-w-sm'; // Grid view cards
      default: // 'feed'
        return 'w-full max-w-2xl mx-auto'; // Two-column feed cards
    }
  };

  // Variant-specific styling
  const getVariantStyles = () => {
    switch (variant) {
      case 'compact':
        return 'bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 dark:border-gray-700';
      case 'mobile':
        return 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200 border-0 rounded-none';
      default:
        return 'bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-gray-200 dark:border-gray-700';
    }
  };

  const handleClick = () => {
    onClick(belief.id);
  };
  
  // Get placeholder image or use article thumbnail
  const getImageSrc = () => {
    if (belief.article.thumbnail) {
      return belief.article.thumbnail;
    }
    // Generate a placeholder based on category
    const categoryColors = {
      'politics': 'bg-blue-500',
      'finance': 'bg-green-500',
      'sports': 'bg-orange-500',
      'technology': 'bg-purple-500',
      'health': 'bg-red-500',
      'science': 'bg-indigo-500',
      'entertainment': 'bg-pink-500',
      'default': 'bg-gray-500'
    };
    return categoryColors[belief.category as keyof typeof categoryColors] || categoryColors.default;
  };
  
  // Mock participant count and time
  const participantCount = Math.floor(Math.random() * 500) + 50;
  const timeAgo = Math.floor(Math.random() * 12) + 1;
  
  return (
    <div 
      className={`
        ${getCardSizing()}
        ${getVariantStyles()}
        belief-card cursor-pointer group relative overflow-hidden
        ${variant === 'mobile' ? 'hover:scale-100' : 'hover:scale-[1.02]'}
        ${variant === 'feed' ? 'p-6' : variant === 'compact' ? 'p-3' : 'p-4'}
      `}
      onClick={handleClick}
    >
      {/* Header Section */}
      <div className="flex items-start gap-4 mb-4">
        {/* Image */}
        <div className="flex-shrink-0">
          {belief.article.thumbnail ? (
            <img 
              src={belief.article.thumbnail}
              alt={belief.heading.title}
              className={`object-cover rounded-lg border-2 border-gray-100 dark:border-gray-700 ${
                variant === 'compact' ? 'w-12 h-12' : 'w-20 h-20'
              }`}
            />
          ) : (
            <div className={`rounded-lg ${getImageSrc()} flex items-center justify-center ${
              variant === 'compact' ? 'w-12 h-12' : 'w-20 h-20'
            }`}>
              <span className={`text-white font-bold ${
                variant === 'compact' ? 'text-lg' : 'text-2xl'
              }`}>
                {belief.category?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
          )}
        </div>
        
        {/* Question */}
        <div className="flex-1 min-w-0">
          <h3 className={`
            font-bold text-gray-900 dark:text-white line-clamp-2
            ${variant === 'feed' ? 'text-2xl' : variant === 'compact' ? 'text-sm' : 'text-lg'}
          `}>
            {belief.heading.title}
          </h3>
          {belief.heading.subtitle && (
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 line-clamp-1">
              {belief.heading.subtitle}
            </p>
          )}
        </div>
      </div>
      
      {/* Truth & Relevance Scores Section */}
      <div className={`flex items-center gap-4 ${variant === 'compact' ? 'mb-2' : 'mb-4'}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className={`font-bold text-green-600 dark:text-green-400 ${
              variant === 'compact' ? 'text-sm' : 'text-lg'
            }`}>
              {belief.objectRankingScores.truth}%
            </div>
            <div className={`text-gray-600 dark:text-gray-400 ${
              variant === 'compact' ? 'text-xs' : 'text-xs'
            }`}>
              Truth
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className={`font-bold text-blue-600 dark:text-blue-400 ${
              variant === 'compact' ? 'text-sm' : 'text-lg'
            }`}>
              {belief.objectRankingScores.relevance}%
            </div>
            <div className={`text-gray-600 dark:text-gray-400 ${
              variant === 'compact' ? 'text-xs' : 'text-xs'
            }`}>
              Relevance
            </div>
          </div>
        </div>
        
        {/* Confidence Indicator - hide on compact */}
        {variant !== 'compact' && (
          <div className="flex items-center gap-1">
            {getConfidenceIndicator()}
          </div>
        )}
        
        {/* Status indicator - only show for resolved/closed beliefs */}
        {belief.status && variant !== 'compact' && (
          <div className={`
            px-2 py-1 rounded-full text-xs font-medium
            ${belief.status === 'resolved'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
            }
          `}>
            {belief.status}
          </div>
        )}
      </div>
      
      {/* Mini Chart Preview - only for feed variant */}
      {feedChart && variant === 'feed' && (
        <div className="mb-4 h-32 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <ChartComponent 
            charts={[feedChart]} 
            variant="card" 
            showOnlyFeedChart={true} 
          />
        </div>
      )}
      
      {/* News Context - hide for compact */}
      {belief.article.excerpt && variant !== 'compact' && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">News</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {belief.article.excerpt}
          </p>
        </div>
      )}
      
      {/* Metadata Footer - hide for compact */}
      {variant !== 'compact' && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{participantCount} participants</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{timeAgo}h ago</span>
            </div>
          </div>
          
          {belief.category && (
            <div className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
              {belief.category}
            </div>
          )}
        </div>
      )}
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none rounded-xl" />
    </div>
  );
};