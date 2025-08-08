import React from 'react';
import Image from 'next/image';
import { Belief } from '@/types/belief.types';
import { ChartComponent } from '@/components/belief-details/components/ChartComponent';
import { Clock, Users } from 'lucide-react';

interface BeliefCardProps {
  belief: Belief;
  variant?: 'feed' | 'grid' | 'compact' | 'mobile' | 'news' | 'large';
  onClick: (beliefId: string) => void;
}

export const BeliefCard: React.FC<BeliefCardProps> = ({
  belief,
  variant = 'feed',
  onClick
}) => {
  // Charts will be loaded directly by ChartComponent
  

  
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
      case 'large':
        return 'w-full h-72 md:h-80'; // Reduced height for more compact grid layout
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
        return 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-veritas-light-blue/10 dark:hover:shadow-veritas-light-blue/20 transition-all duration-200 cursor-pointer group border border-gray-200 dark:border-gray-700 hover:border-veritas-light-blue dark:hover:border-veritas-light-blue overflow-hidden';
      case 'large':
        return 'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl hover:shadow-3xl hover:shadow-veritas-light-blue/10 dark:hover:shadow-veritas-light-blue/20 transition-all duration-200 cursor-pointer group border border-gray-200 dark:border-gray-700 hover:border-veritas-light-blue dark:hover:border-veritas-light-blue overflow-hidden';
      default:
        return 'bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-200 dark:border-gray-700 hover:border-veritas-light-blue dark:hover:border-veritas-light-blue';
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
              <Image 
                src={belief.article.thumbnail}
                alt={belief.heading.title}
                width={400}
                height={320}
                className="w-full h-full object-cover"
                unoptimized
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
              <div className="absolute top-4 left-4 inline-flex items-center px-3 py-1 bg-veritas-primary dark:bg-veritas-light-blue backdrop-blur-sm text-white dark:text-veritas-darker-blue text-xs font-medium uppercase rounded-full border border-veritas-primary/20 dark:border-veritas-light-blue/20">
                {belief.category.toUpperCase()}
              </div>
            )}
            
            {/* Text Overlay - Bottom Left (Always eggshell over image) */}
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="text-2xl font-bold leading-tight mb-2 drop-shadow-lg line-clamp-2 text-veritas-eggshell">
                {belief.heading.title}
              </h3>
              {belief.heading.subtitle && (
                <p className="text-sm leading-relaxed drop-shadow line-clamp-1 mb-3 text-veritas-eggshell/90">
                  {belief.heading.subtitle}
                </p>
              )}
              
              {/* News Section - Moved from right side */}
              {belief.article.excerpt && (
                <div className="mt-3 pt-3 border-t border-veritas-eggshell/20">
                  <div className="flex items-center gap-2 mb-1">
                  </div>
                  <p className="text-xs leading-relaxed drop-shadow line-clamp-2 text-veritas-eggshell/70">
                    {belief.article.excerpt}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Content Section - Right 50% */}
          <div className="w-1/2 p-6 flex flex-col">
            {/* Truth & Relevance Metrics with Metadata */}
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
              <div className="flex items-center gap-4 text-xs text-veritas-primary dark:text-veritas-eggshell">
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
            
            {/* Middle: Chart with Title and Description */}
            <div className="flex-1 mb-2">
              <ChartComponent 
                charts={[]} 
                beliefId={belief.id}
                variant="news" 
                showOnlyFeedChart={true} 
              />
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
        ${variant === 'feed' ? 'p-6' : variant === 'compact' ? 'p-3' : variant === 'large' ? 'p-4 flex flex-col' : 'p-4'}
      `}
      onClick={handleClick}
    >
      {/* Header Section */}
      <div className="flex items-start gap-3 mb-3 flex-shrink-0">
        {/* Image */}
        <div className="flex-shrink-0">
          {belief.article.thumbnail ? (
            <Image 
              src={belief.article.thumbnail}
              alt={belief.heading.title}
              width={variant === 'large' ? 80 : 80}
              height={variant === 'large' ? 80 : 80}
              className={`object-cover rounded-lg border-2 border-gray-100 dark:border-gray-700 ${
                variant === 'compact' ? 'w-12 h-12' : variant === 'large' ? 'w-20 h-20' : 'w-20 h-20'
              }`}
              unoptimized
            />
          ) : (
            <div className={`rounded-lg ${getImageSrc()} flex items-center justify-center ${
              variant === 'compact' ? 'w-12 h-12' : variant === 'large' ? 'w-20 h-20' : 'w-20 h-20'
            }`}>
              <span className={`text-white font-bold ${
                variant === 'compact' ? 'text-lg' : variant === 'large' ? 'text-2xl' : 'text-2xl'
              }`}>
                {belief.category?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
          )}
        </div>
        
        {/* Question */}
        <div className="flex-1 min-w-0">
          <h3 className={`
            font-bold text-veritas-primary dark:text-veritas-eggshell ${variant === 'large' ? 'line-clamp-2' : 'line-clamp-2'}
            ${variant === 'feed' ? 'text-2xl' : variant === 'compact' ? 'text-sm' : variant === 'large' ? 'text-lg' : 'text-lg'}
          `}>
            {belief.heading.title}
          </h3>
          {belief.heading.subtitle && (
            <p className={`text-veritas-primary/70 dark:text-veritas-eggshell/70 mt-1 ${
              variant === 'large' ? 'text-sm line-clamp-1' : 'text-sm line-clamp-1'
            }`}>
              {belief.heading.subtitle}
            </p>
          )}
        </div>
      </div>
      
      {/* Truth & Relevance Scores Section */}
      <div className="mb-3 flex-shrink-0">
        <div className={`flex items-center flex-wrap ${variant === 'grid' ? 'gap-2' : variant === 'large' ? 'gap-2 md:gap-3' : 'gap-3'}`}>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className={`font-bold text-green-600 dark:text-green-400 ${
              variant === 'compact' ? 'text-sm' : variant === 'large' ? 'text-base md:text-lg' : 'text-lg'
            }`}>
              {belief.objectRankingScores.truth}%
            </div>
            <div className="text-veritas-primary dark:text-veritas-eggshell text-xs">
              Truth
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className={`font-bold text-blue-600 dark:text-blue-400 ${
              variant === 'compact' ? 'text-sm' : variant === 'large' ? 'text-base md:text-lg' : 'text-lg'
            }`}>
              {belief.objectRankingScores.relevance}%
            </div>
            <div className="text-veritas-primary dark:text-veritas-eggshell text-xs">
              Relevance
            </div>
          </div>
          {/* Show informativeness score for large variant */}
          {variant === 'large' && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="font-bold text-purple-600 dark:text-purple-400 text-base md:text-lg">
                {belief.objectRankingScores.informativeness}%
              </div>
              <div className="text-veritas-primary dark:text-veritas-eggshell text-xs">
                Info
              </div>
            </div>
          )}
        </div>
        
        {/* Status indicator - only show for resolved/closed beliefs */}
        {belief.status && variant !== 'compact' && variant !== 'grid' && variant !== 'large' && (
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
      
      {/* Enhanced Chart Preview - only for feed variant now */}
      {variant === 'feed' && (
        <div className="mb-4 h-32 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                            <ChartComponent 
                    charts={[]} 
                    beliefId={belief.id}
                    variant="card" 
                    showOnlyFeedChart={true} 
                  />
        </div>
      )}
      
      {/* Enhanced News Context - removed label and blue dot */}
      {belief.article.excerpt && variant !== 'compact' && (
        <div className={`mb-3 ${variant === 'large' ? 'flex-1 flex flex-col' : ''}`}>
          <p className={`text-veritas-primary/70 dark:text-veritas-eggshell/70 ${
            variant === 'large' ? 'text-sm line-clamp-3 flex-1' : 'text-sm line-clamp-2'
          }`}>
            {belief.article.excerpt}
          </p>
        </div>
      )}
      
      {/* Enhanced Metadata Footer - removed active discussion */}
      {variant !== 'compact' && (
        <div className={`pt-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0 ${
          variant === 'grid' || variant === 'large' ? 'space-y-2' : 'flex items-center justify-between'
        }`}>
          <div className={`flex items-center text-veritas-primary/60 dark:text-veritas-eggshell/60 ${
            variant === 'grid' ? 'gap-2 text-xs' : variant === 'large' ? 'gap-3 text-xs' : 'gap-4 text-xs'
          }`}>
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
            <div className={`px-2 py-1 bg-gray-100 dark:bg-veritas-eggshell/10 text-veritas-primary dark:text-veritas-eggshell rounded-full ${
              variant === 'grid' ? 'self-start text-xs' : variant === 'large' ? 'text-xs' : 'text-xs'
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