import React from 'react';
import { Belief } from '@/types/belief.types';
import { ChartComponent } from '@/components/belief-details/components/ChartComponent';
import { getFeedChart } from '@/lib/data';
import { Clock, Users } from 'lucide-react';

interface BeliefCardProps {
  belief: Belief;
  variant?: 'feed' | 'grid' | 'compact' | 'mobile' | 'news';
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
        return 'w-full max-w-sm min-h-[280px]'; // Grid view cards with minimum height
      case 'news':
        return 'w-full h-80'; // News-style horizontal cards with fixed height
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
      case 'news':
        return 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-blue-500/10 dark:hover:shadow-blue-400/20 transition-all duration-500 cursor-pointer group border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 hover:ring-2 hover:ring-blue-100 dark:hover:ring-blue-900/30 overflow-hidden hover:-translate-y-1';
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
  
  // News variant with horizontal layout
  if (variant === 'news') {
    return (
      <div 
        className={`
          ${getCardSizing()}
          ${getVariantStyles()}
        `}
        onClick={handleClick}
      >
        <div className="flex h-full">
          {/* Hero Image Section - Left 50% */}
          <div className="relative w-1/2 overflow-hidden">
            {belief.article.thumbnail ? (
              <img 
                src={belief.article.thumbnail}
                alt={belief.heading.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className={`w-full h-full ${getImageSrc()} flex items-center justify-center`}>
                <span className="text-white text-4xl font-bold">
                  {belief.category?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
            )}
            
            {/* Dark gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
            
            {/* Category Badge - Top Left */}
            {belief.category && (
              <div className="absolute top-4 left-4 inline-flex items-center px-3 py-1 bg-blue-600/90 backdrop-blur-sm text-blue-100 text-xs font-medium rounded-full">
                {belief.category.toUpperCase()}
              </div>
            )}
            
            {/* Text Overlay - Bottom Left */}
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <h3 className="text-2xl font-bold leading-tight mb-2 drop-shadow-lg line-clamp-2">
                {belief.heading.title}
              </h3>
              {belief.heading.subtitle && (
                <p className="text-gray-200 text-sm leading-relaxed drop-shadow line-clamp-1 mb-3">
                  {belief.heading.subtitle}
                </p>
              )}
              
              {/* News Section - Moved from right side */}
              {belief.article.excerpt && (
                <div className="mt-3 pt-3 border-t border-white/20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1 h-1 bg-blue-300 rounded-full"></div>
                    <span className="text-xs font-medium text-blue-200">News</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed drop-shadow line-clamp-2">
                    {belief.article.excerpt}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Content Section - Right 50% */}
          <div className="w-1/2 p-6 flex flex-col">
            {/* Top: Truth & Relevance Metrics */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    {belief.objectRankingScores.truth}% Truth
                  </span>
                </div>
                <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    {belief.objectRankingScores.relevance}% Relevance
                  </span>
                </div>
              </div>
            </div>
            
            {/* Middle: Chart */}
            <div className="flex-1 mb-4">
              <div className="h-42 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 flex items-center justify-center">
                {feedChart ? (
                  <ChartComponent 
                    charts={[feedChart]} 
                    variant="card" 
                    showOnlyFeedChart={true} 
                  />
                ) : (
                  <div className="text-gray-400 dark:text-gray-500 text-sm">No chart data available</div>
                )}
              </div>
            </div>
            
            {/* Bottom: Metadata Footer */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
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
      <div className={`${variant === 'compact' ? 'mb-2' : 'mb-4'}`}>
        <div className={`flex items-center ${variant === 'grid' ? 'gap-2 flex-wrap' : 'gap-3'}`}>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className={`font-bold text-green-600 dark:text-green-400 ${
              variant === 'compact' ? 'text-sm' : 'text-lg'
            }`}>
              {belief.objectRankingScores.truth}%
            </div>
            <div className={`text-gray-600 dark:text-gray-400 ${
              variant === 'compact' ? 'text-xs' : 'text-xs'
            }`}>
              {variant === 'grid' ? 'T' : 'Truth'}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className={`font-bold text-blue-600 dark:text-blue-400 ${
              variant === 'compact' ? 'text-sm' : 'text-lg'
            }`}>
              {belief.objectRankingScores.relevance}%
            </div>
            <div className={`text-gray-600 dark:text-gray-400 ${
              variant === 'compact' ? 'text-xs' : 'text-xs'
            }`}>
              {variant === 'grid' ? 'R' : 'Relevance'}
            </div>
          </div>
        </div>
        
        {/* Confidence Indicator - hide on compact and grid for space */}
        {variant !== 'compact' && variant !== 'grid' && (
          <div className="flex items-center gap-1 mt-2">
            {getConfidenceIndicator()}
          </div>
        )}
        
        {/* Status indicator - only show for resolved/closed beliefs */}
        {belief.status && variant !== 'compact' && variant !== 'grid' && (
          <div className={`
            px-2 py-1 rounded-full text-xs font-medium mt-2
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
        <div className={`pt-3 border-t border-gray-100 dark:border-gray-700 ${
          variant === 'grid' ? 'space-y-2' : 'flex items-center justify-between'
        }`}>
          <div className={`flex items-center text-xs text-gray-500 dark:text-gray-400 ${
            variant === 'grid' ? 'gap-2' : 'gap-4'
          }`}>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{variant === 'grid' ? participantCount : `${participantCount} participants`}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{timeAgo}h ago</span>
            </div>
          </div>
          
          {belief.category && (
            <div className={`px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs ${
              variant === 'grid' ? 'self-start' : ''
            }`}>
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