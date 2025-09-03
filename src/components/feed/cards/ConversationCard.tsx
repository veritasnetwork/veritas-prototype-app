import React, { useState } from 'react';
import { ConversationContent } from '@/types/content.types';
import { 
  MessageCircle, 
  Users,
  Lock,
  MessageSquare,
  Flame
} from 'lucide-react';

interface ConversationCardProps {
  content: ConversationContent;
  variant?: 'feed' | 'grid' | 'compact' | 'mobile' | 'news' | 'large' | 'premier';
  onClick: (contentId: string) => void;
  layout?: 'full' | 'half';
}

export const ConversationCard: React.FC<ConversationCardProps> = ({
  content,
  variant = 'feed',
  onClick,
  layout = 'half'
}) => {
  void layout; // Layout is handled by parent grid
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [myBeliefValue, setMyBeliefValue] = useState(50);
  const [othersBeliefValue, setOthersBeliefValue] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleClick = () => {
    onClick(content.id);
  };
  
  const handleValidate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingMode(!isEditingMode);
    if (!isEditingMode) {
      // Initialize with current relevance value when entering edit mode
      const currentRelevance = content.signals?.relevance?.currentValue || 50;
      setMyBeliefValue(currentRelevance);
      setOthersBeliefValue(currentRelevance);
    }
  };
  
  const handleTotalRelevanceSubmit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSubmitting(true);
    
    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsEditingMode(false);
    // Reset values for next edit
    setMyBeliefValue(50);
    setOthersBeliefValue(50);
  };
  
  // Calculate activity heat level
  const getActivityLevel = () => {
    const hoursSinceActivity = Math.floor(
      (Date.now() - new Date(content.lastActivityAt).getTime()) / (1000 * 60 * 60)
    );
    
    if (hoursSinceActivity < 1) return 'hot';
    if (hoursSinceActivity < 6) return 'active';
    if (hoursSinceActivity < 24) return 'recent';
    return 'normal';
  };
  
  const activityLevel = getActivityLevel();
  
  // Get activity indicator color
  const getActivityColor = () => {
    switch (activityLevel) {
      case 'hot':
        return 'bg-veritas-orange animate-pulse';
      case 'active':
        return 'bg-veritas-orange';
      case 'recent':
        return 'bg-veritas-light-blue';
      default:
        return 'bg-gray-400 dark:bg-gray-600';
    }
  };
  
  // Format time since last activity
  const getTimeAgo = () => {
    const now = Date.now();
    const activityTime = new Date(content.lastActivityAt).getTime();
    const diffInMinutes = Math.floor((now - activityTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
    
    return new Date(content.lastActivityAt).toLocaleDateString();
  };
  
  // Card sizing based on variant and layout
  const getCardSizing = () => {
    if (variant === 'compact') return 'w-full h-28';
    if (variant === 'mobile') return 'w-full';
    if (variant === 'premier') return 'w-full h-56';
    
    // Always use full width - the parent grid handles the actual sizing
    return 'w-full';
  };
  
  return (
    <div
      className={`
        ${getCardSizing()}
        bg-white dark:bg-veritas-darker-blue/80 
        rounded-xl shadow-sm hover:shadow-lg 
        transition-all duration-300 
        border border-slate-200 dark:border-veritas-eggshell/10
        hover:border-veritas-primary dark:hover:border-veritas-light-blue
        cursor-pointer group
        overflow-hidden
        relative
      `}
      onClick={handleClick}
    >
      {/* Status badges */}
      <div className="absolute top-2 right-2 flex gap-2 z-10">
        {content.isLocked && (
          <div className="p-1 bg-red-100 dark:bg-red-900 rounded-full">
            <Lock className="h-3 w-3 text-red-600 dark:text-red-300" />
          </div>
        )}
        {activityLevel === 'hot' && (
          <div className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 text-xs rounded-full font-medium flex items-center gap-1">
            <Flame className="h-3 w-3" />
            Hot
          </div>
        )}
      </div>
      
      <div className={`${variant === 'compact' ? 'p-3' : 'p-4'} h-full flex flex-col`}>
        {/* Header */}
        <div className={`flex items-start gap-3 ${variant === 'compact' ? 'mb-2' : 'mb-3'}`}>
          <div className={`${variant === 'compact' ? 'p-1.5' : 'p-2'} bg-veritas-primary dark:bg-veritas-light-blue rounded-lg`}>
            <MessageSquare className={`${variant === 'compact' ? 'h-4 w-4' : 'h-5 w-5'} text-white dark:text-veritas-dark-blue`} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-veritas-primary dark:group-hover:text-veritas-light-blue transition-colors">
              {content.topic}
            </h3>
            {variant !== 'compact' && content.heading.subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {content.heading.subtitle}
              </p>
            )}
          </div>
        </div>
        
        {/* Main Content Area */}
        {isEditingMode && variant !== 'compact' && variant !== 'premier' ? (
          /* Total Relevance Editor */
          <div className="flex-1 py-3">
            <h4 className="text-sm font-semibold text-veritas-primary dark:text-veritas-eggshell mb-3 uppercase tracking-wider">
              Total Relevance Adjustment
            </h4>
            
            <div className="space-y-4">
              {/* My Belief Slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    What I Believe
                  </label>
                  <span className="text-sm font-bold text-veritas-primary dark:text-veritas-light-blue">
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
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700"
                  style={{
                    background: `linear-gradient(to right, #B9D9EB 0%, #B9D9EB ${myBeliefValue}%, rgb(229 231 235) ${myBeliefValue}%, rgb(229 231 235) 100%)`
                  }}
                />
              </div>
              
              {/* Others Belief Slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    What Others Believe
                  </label>
                  <span className="text-sm font-bold text-veritas-primary dark:text-veritas-light-blue">
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
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700"
                  style={{
                    background: `linear-gradient(to right, #B9D9EB 0%, #B9D9EB ${othersBeliefValue}%, rgb(229 231 235) ${othersBeliefValue}%, rgb(229 231 235) 100%)`
                  }}
                />
              </div>
              
              {/* Submit Button */}
              <button
                onClick={handleTotalRelevanceSubmit}
                disabled={isSubmitting}
                className="w-full py-2 mt-2 bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue rounded-lg text-sm font-medium hover:bg-veritas-dark-blue dark:hover:bg-veritas-light-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Total Relevance'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Description */}
            {variant !== 'compact' && variant !== 'premier' && (
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                {content.description}
              </p>
            )}
            
            {/* Activity Stats */}
            <div className={`flex items-center gap-4 ${variant === 'compact' ? 'mb-2' : 'mb-3'}`}>
              <div className="flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {content.commentCount}
                </span>
                {variant !== 'compact' && (
                  <span className="text-sm text-gray-500">comments</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {content.participantCount}
                </span>
                {variant !== 'compact' && (
                  <span className="text-sm text-gray-500">participants</span>
                )}
              </div>
            </div>
            
            {/* Featured Comment Preview */}
            {variant !== 'compact' && variant !== 'premier' && content.featuredComments && content.featuredComments.length > 0 && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-veritas-darker-blue/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {content.featuredComments[0].userName}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                      {content.featuredComments[0].content}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Footer */}
        <div className={`mt-auto flex items-center justify-between ${variant === 'compact' ? 'pt-2' : 'pt-3 border-t border-gray-100 dark:border-veritas-eggshell/10'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getActivityColor()}`} />
            <span className="text-xs text-gray-500">
              {getTimeAgo()}
            </span>
          </div>
          
          {/* Validate Button */}
          {!content.isLocked && variant !== 'compact' && (
            <button
              className="px-4 py-1.5 text-sm bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue rounded-lg hover:shadow-md transition-all duration-200 transform hover:scale-105"
              onClick={handleValidate}
            >
              {isEditingMode ? 'View Discussion' : 'Validate'}
            </button>
          )}
          
          {content.isLocked && (
            <span className="text-xs text-gray-500 italic">
              Discussion Closed
            </span>
          )}
        </div>
        
        {/* Signal Indicators */}
        {content.signals && variant !== 'compact' && variant !== 'premier' && (
          <div className="flex gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-veritas-eggshell/10">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-veritas-primary dark:bg-veritas-light-blue" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Activity: {content.signals.relevance?.currentValue || 0}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-veritas-orange" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Quality: {content.signals.truth?.currentValue || 0}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};