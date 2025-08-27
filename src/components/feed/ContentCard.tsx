import React, { useState, useContext } from 'react';
import Image from 'next/image';
import { Content, Belief } from '@/types/content.types';
import { ChartComponent } from '@/components/content-details/components/ChartComponent';
import { Clock, Users } from 'lucide-react';
import { FeedContext } from '@/contexts/FeedContext';

interface ContentCardProps {
  content: Content;
  variant?: 'feed' | 'grid' | 'compact' | 'mobile' | 'news' | 'large';
  onClick: (contentId: string) => void;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  content,
  variant = 'feed',
  onClick
}) => {
  // State for Total Relevance editing in news variant
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [myBeliefValue, setMyBeliefValue] = useState(50);
  const [othersBeliefValue, setOthersBeliefValue] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get current algorithm from context (if available)
  const feedContext = useContext(FeedContext);
  const currentAlgorithm = feedContext?.currentAlgorithm || null;
  
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
    onClick(content.id);
  };
  
  // Get placeholder image or use article thumbnail
  const getImageSrc = () => {
    if (content.article.thumbnail) {
      return content.article.thumbnail;
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
    // Category could be a signal or legacy field - check both
    const categoryName = (content as Belief).category || content.signals?.category?.name;
    return categoryColors[categoryName as keyof typeof categoryColors] || categoryColors.default;
  };
  
  // Mock participant count and time
  const participantCount = Math.floor(Math.random() * 500) + 50;
  const timeAgo = Math.floor(Math.random() * 12) + 1;
  
  // Handle Total Relevance submit for news variant
  const handleTotalRelevanceSubmit = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setIsSubmitting(true);
    
    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Log the submission (demo only)
    console.log('📊 Quick Total Relevance Update:', {
      contentId: content.id,
      myBelief: myBeliefValue,
      othersBelief: othersBeliefValue,
      algorithm: currentAlgorithm?.name || 'Default'
    });
    
    setIsSubmitting(false);
    setIsEditingMode(false); // Toggle back to graph view
    // Reset values for next edit
    setMyBeliefValue(50);
    setOthersBeliefValue(50);
  };
  
  // Toggle edit mode
  const toggleEditMode = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setIsEditingMode(!isEditingMode);
    if (!isEditingMode) {
      // Initialize with current relevance value when entering edit mode
      const currentRelevance = (content as Belief).objectRankingScores?.relevance || 
                              content.signals?.relevance?.currentValue || 50;
      setMyBeliefValue(currentRelevance);
      setOthersBeliefValue(currentRelevance);
    }
  };
  
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
            {content.article.thumbnail ? (
              <Image 
                src={content.article.thumbnail}
                alt={content.heading.title}
                width={400}
                height={320}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <div className={`w-full h-full ${getImageSrc()} flex items-center justify-center`}>
                <span className="text-white text-4xl font-bold">
                  {((content as Belief).category || content.signals?.category?.name)?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
            )}
            
            {/* Dark gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
            
            {/* Category Badge - Top Left */}
            {((content as Belief).category || content.signals?.category?.name) && (
              <div className="absolute top-4 left-4 inline-flex items-center px-3 py-1 bg-veritas-primary dark:bg-veritas-light-blue backdrop-blur-sm text-white dark:text-veritas-darker-blue text-xs font-medium uppercase rounded-full border border-veritas-primary/20 dark:border-veritas-light-blue/20">
                {((content as Belief).category || content.signals?.category?.name || '').toUpperCase()}
              </div>
            )}
            
            {/* Text Overlay - Bottom Left (Always eggshell over image) */}
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="text-2xl font-bold leading-tight mb-2 drop-shadow-lg line-clamp-2 text-veritas-eggshell">
                {content.heading.title}
              </h3>
              {content.heading.subtitle && (
                <p className="text-sm leading-relaxed drop-shadow line-clamp-1 mb-3 text-veritas-eggshell/90">
                  {content.heading.subtitle}
                </p>
              )}
              
              {/* News Section - Moved from right side */}
              {content.article.excerpt && (
                <div className="mt-3 pt-3 border-t border-veritas-eggshell/20">
                  <div className="flex items-center gap-2 mb-1">
                  </div>
                  <p className="text-xs leading-relaxed drop-shadow line-clamp-2 text-veritas-eggshell/70">
                    {content.article.excerpt}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Content Section - Right 50% */}
          <div className="w-1/2 p-6 flex flex-col">
            {/* Relevance Progress Bar with Validate Button */}
            <div className="flex items-center justify-between mb-4 gap-4">
              {/* Relevance Progress Bar */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-veritas-primary dark:text-veritas-eggshell">
                    Relevance
                  </span>
                  <span className="text-sm font-bold text-veritas-primary dark:text-veritas-eggshell">
                    {(content as Belief).objectRankingScores?.relevance || content.signals?.relevance?.currentValue || 0}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-veritas-light-blue dark:bg-veritas-light-blue rounded-full transition-all duration-500 ease-out"
                    style={{ 
                      width: `${(content as Belief).objectRankingScores?.relevance || content.signals?.relevance?.currentValue || 0}%` 
                    }}
                  />
                </div>
              </div>
              
              {/* Validate Button */}
              <button
                onClick={toggleEditMode}
                className="px-4 py-2 text-sm font-medium bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue rounded-lg hover:bg-veritas-dark-blue dark:hover:bg-veritas-light-blue/90 transition-colors flex-shrink-0"
              >
                {isEditingMode ? 'View Graph' : 'Validate'}
              </button>
            </div>
            
            {/* Middle: Chart or Total Relevance Editor */}
            <div className="flex-1 flex flex-col">
              {isEditingMode ? (
                /* Total Relevance Editor */
                <div className="h-full flex flex-col justify-center py-2">
                  <h4 className="text-xs font-semibold text-veritas-primary dark:text-veritas-eggshell mb-3 uppercase tracking-wider">
                    Total Relevance Adjustment
                  </h4>
                  
                  <div className="space-y-3">
                    {/* My Belief Slider */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-veritas-eggshell/80">
                          What I Believe
                        </label>
                        <span className="text-xs font-bold text-veritas-primary dark:text-veritas-eggshell">
                          {myBeliefValue}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={myBeliefValue}
                        onChange={(e) => {
                          e.stopPropagation();
                          setMyBeliefValue(parseInt(e.target.value));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-veritas-darker-blue/80"
                        style={{
                          background: `linear-gradient(to right, #4BA3F5 0%, #4BA3F5 ${myBeliefValue}%, rgb(229 231 235) ${myBeliefValue}%, rgb(229 231 235) 100%)`
                        }}
                      />
                    </div>
                    
                    {/* Others Belief Slider */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-veritas-eggshell/80">
                          What Others Believe
                        </label>
                        <span className="text-xs font-bold text-veritas-primary dark:text-veritas-eggshell">
                          {othersBeliefValue}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={othersBeliefValue}
                        onChange={(e) => {
                          e.stopPropagation();
                          setOthersBeliefValue(parseInt(e.target.value));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-veritas-darker-blue/80"
                        style={{
                          background: `linear-gradient(to right, #4BA3F5 0%, #4BA3F5 ${othersBeliefValue}%, rgb(229 231 235) ${othersBeliefValue}%, rgb(229 231 235) 100%)`
                        }}
                      />
                    </div>
                    
                    {/* Submit Button */}
                    <button
                      onClick={handleTotalRelevanceSubmit}
                      disabled={isSubmitting}
                      className="w-full py-1.5 mt-2 bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue rounded-lg text-xs font-medium hover:bg-veritas-dark-blue dark:hover:bg-veritas-light-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Chart View */
                <div className="h-full">
                  <ChartComponent 
                    charts={[]} 
                    contentId={content.id}
                    variant="news" 
                    showOnlyFeedChart={true} 
                  />
                </div>
              )}
            </div>
            
            {/* Bottom Right: Metadata */}
            <div className="flex items-center justify-end gap-4 text-xs text-veritas-primary/70 dark:text-veritas-eggshell/70 mt-2">
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
          {content.article.thumbnail ? (
            <Image 
              src={content.article.thumbnail}
              alt={content.heading.title}
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
                {((content as Belief).category || content.signals?.category?.name)?.charAt(0).toUpperCase() || '?'}
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
            {content.heading.title}
          </h3>
          {content.heading.subtitle && (
            <p className={`text-veritas-primary/70 dark:text-veritas-eggshell/70 mt-1 ${
              variant === 'large' ? 'text-sm line-clamp-1' : 'text-sm line-clamp-1'
            }`}>
              {content.heading.subtitle}
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
              {(content as Belief).objectRankingScores?.truth || content.signals?.truth?.currentValue || 0}%
            </div>
            <div className="text-veritas-primary dark:text-veritas-eggshell text-xs">
              Truth
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className={`font-bold text-blue-600 dark:text-blue-400 ${
              variant === 'compact' ? 'text-sm' : variant === 'large' ? 'text-base md:text-lg' : 'text-lg'
            }`}>
              {(content as Belief).objectRankingScores?.relevance || content.signals?.relevance?.currentValue || 0}%
            </div>
            <div className="text-veritas-primary dark:text-veritas-eggshell text-xs">
              Relevance
            </div>
          </div>
          {/* Show informativeness score for large variant */}
          {variant === 'large' && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="font-bold text-purple-600 dark:text-purple-400 text-base md:text-lg">
                {(content as Belief).objectRankingScores?.informativeness || content.signals?.informativeness?.currentValue || 0}%
              </div>
              <div className="text-veritas-primary dark:text-veritas-eggshell text-xs">
                Info
              </div>
            </div>
          )}
        </div>
        
        {/* Status indicator - only show for resolved/closed beliefs */}
        {content.status && variant !== 'compact' && variant !== 'grid' && variant !== 'large' && (
          <div className={`
            px-2 py-1 rounded-full text-xs font-medium mt-2
            ${content.status === 'resolved'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
            }
          `}>
            {content.status}
          </div>
        )}
      </div>
      
      {/* Enhanced Chart Preview - only for feed variant now */}
      {variant === 'feed' && (
        <div className="mb-4 h-32 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                            <ChartComponent 
                    charts={[]} 
                    contentId={content.id}
                    variant="card" 
                    showOnlyFeedChart={true} 
                  />
        </div>
      )}
      
      {/* Enhanced News Context - removed label and blue dot */}
      {content.article.excerpt && variant !== 'compact' && (
        <div className={`mb-3 ${variant === 'large' ? 'flex-1 flex flex-col' : ''}`}>
          <p className={`text-veritas-primary/70 dark:text-veritas-eggshell/70 ${
            variant === 'large' ? 'text-sm line-clamp-3 flex-1' : 'text-sm line-clamp-2'
          }`}>
            {content.article.excerpt}
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
          
          {((content as Belief).category || content.signals?.category?.name) && (
            <div className={`px-2 py-1 bg-gray-100 dark:bg-veritas-eggshell/10 text-veritas-primary dark:text-veritas-eggshell rounded-full ${
              variant === 'grid' ? 'self-start text-xs' : variant === 'large' ? 'text-xs' : 'text-xs'
            }`}>
              {((content as Belief).category || content.signals?.category?.name)}
            </div>
          )}
        </div>
      )}
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none rounded-xl" />
    </div>
  );
};