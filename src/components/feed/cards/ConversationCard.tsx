import React from 'react';
import { ConversationContent } from '@/types/content.types';
import { 
  MessageCircle, 
  Users,
  Lock,
  Pin,
  MessageSquare,
  ChevronRight,
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
  const handleClick = () => {
    onClick(content.id);
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
        return 'bg-red-500 animate-pulse';
      case 'active':
        return 'bg-orange-500';
      case 'recent':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
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
    if (variant === 'compact') return 'w-full h-32';
    if (variant === 'mobile') return 'w-full';
    if (variant === 'premier') return 'w-full h-56';
    
    // Always use full width - the parent grid handles the actual sizing
    return 'w-full';
  };
  
  return (
    <div
      className={`
        ${getCardSizing()}
        bg-white dark:bg-gray-800 
        rounded-xl shadow-sm hover:shadow-lg 
        transition-all duration-300 
        border border-gray-200 dark:border-gray-700
        hover:border-veritas-light-blue dark:hover:border-veritas-light-blue
        cursor-pointer group
        overflow-hidden
        relative
      `}
      onClick={handleClick}
    >
      {/* Status badges */}
      <div className="absolute top-2 right-2 flex gap-2 z-10">
        {content.isPinned && (
          <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded-full">
            <Pin className="h-3 w-3 text-blue-600 dark:text-blue-300" />
          </div>
        )}
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
      
      <div className="p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-veritas-blue transition-colors">
              {content.topic}
            </h3>
            {variant !== 'compact' && content.heading.subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {content.heading.subtitle}
              </p>
            )}
          </div>
        </div>
        
        {/* Description */}
        {variant !== 'compact' && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
            {content.description}
          </p>
        )}
        
        {/* Activity Stats */}
        <div className="flex items-center gap-4 mb-3">
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
        {variant !== 'compact' && content.featuredComments && content.featuredComments.length > 0 && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
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
        
        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getActivityColor()}`} />
            <span className="text-xs text-gray-500">
              {getTimeAgo()}
            </span>
          </div>
          
          {/* Join Discussion CTA */}
          {!content.isLocked && variant !== 'compact' && (
            <button
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-md transition-all duration-200 transform hover:scale-105"
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
            >
              Join Discussion
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
          
          {content.isLocked && (
            <span className="text-xs text-gray-500 italic">
              Discussion Closed
            </span>
          )}
        </div>
        
        {/* Signal Indicators */}
        {content.signals && variant !== 'compact' && (
          <div className="flex gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Activity: {content.signals.relevance?.currentValue || 0}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-pink-500" />
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