'use client';

import { useState, useEffect } from 'react';
import { ConversationContent } from '@/types/content.types';
import { RelevanceSignals } from '../RelevanceSignals';
import { ConversationCommentsSection } from '../ConversationCommentsSection';
import { 
  getCommentsByContentId, 
  getTotalCommentCount,
  getUniqueParticipants,
  getLastActivityTime,
  Comment
} from '@/lib/comments';
import { 
  ArrowLeft, 
  MessageSquare, 
  Users, 
  Clock,
  Lock,
  Pin,
  Flame,
  Activity,
  TrendingUp
} from 'lucide-react';

interface ConversationDetailPageProps {
  content: ConversationContent;
  onBack: () => void;
}

export const ConversationDetailPage: React.FC<ConversationDetailPageProps> = ({
  content,
  onBack
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [totalComments, setTotalComments] = useState(0);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  useEffect(() => {
    // Load comments for this conversation
    const loadedComments = getCommentsByContentId(content.id);
    setComments(loadedComments);
    
    // Calculate dynamic stats
    const participants = getUniqueParticipants(loadedComments);
    setParticipantCount(participants.size || content.participantCount);
    
    const total = getTotalCommentCount(loadedComments);
    setTotalComments(total || content.commentCount);
    
    const lastActivityTime = getLastActivityTime(loadedComments);
    setLastActivity(lastActivityTime || new Date(content.lastActivityAt));
  }, [content]);

  // Calculate activity level based on last activity
  const getActivityLevel = () => {
    if (!lastActivity) return 'normal';
    const hoursSinceActivity = Math.floor(
      (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60)
    );
    
    if (hoursSinceActivity < 1) return 'hot';
    if (hoursSinceActivity < 6) return 'active';
    if (hoursSinceActivity < 24) return 'recent';
    return 'normal';
  };

  const activityLevel = getActivityLevel();
  
  // Format last activity time
  const formatLastActivity = () => {
    if (!lastActivity) return 'No activity yet';
    const now = Date.now();
    const activityTime = lastActivity.getTime();
    const diffInMinutes = Math.floor((now - activityTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Active now';
    if (diffInMinutes < 60) return `Active ${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Active ${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Active yesterday';
    if (diffInDays < 7) return `Active ${diffInDays} days ago`;
    
    return `Last active ${lastActivity.toLocaleDateString()}`;
  };

  // Get activity badge - Mobile optimized
  const getActivityBadge = () => {
    switch (activityLevel) {
      case 'hot':
        return (
          <div className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-veritas-secondary/20 dark:bg-veritas-orange/20 text-veritas-secondary dark:text-veritas-orange text-xs sm:text-sm rounded-full font-medium">
            <Flame className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Hot Discussion</span>
            <span className="sm:hidden">Hot</span>
          </div>
        );
      case 'active':
        return (
          <div className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-veritas-secondary/10 dark:bg-veritas-orange/10 text-veritas-secondary dark:text-veritas-orange text-xs sm:text-sm rounded-full">
            Active
          </div>
        );
      case 'recent':
        return (
          <div className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-veritas-eggshell/30 dark:bg-veritas-eggshell/10 text-veritas-primary dark:text-veritas-eggshell text-xs sm:text-sm rounded-full">
            <span className="hidden sm:inline">Recent Activity</span>
            <span className="sm:hidden">Recent</span>
          </div>
        );
      default:
        return null;
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-veritas-darker-blue">
      {/* Header - Mobile optimized */}
      <div className="bg-slate-50 dark:bg-veritas-darker-blue pt-16 md:pt-4">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 max-w-7xl">
          <button 
            onClick={onBack}
            className="flex items-center space-x-2 text-xs sm:text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70 hover:text-veritas-primary dark:hover:text-veritas-eggshell transition-colors"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>Back to Feed</span>
          </button>
        </div>
      </div>

      {/* Main Content - Mobile optimized */}
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          
          {/* Main Content - 3 columns */}
          <div className="lg:col-span-3 order-2 lg:order-1 space-y-4 sm:space-y-6">
            
            {/* Conversation Header - Mobile optimized */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <div className="flex flex-col sm:flex-row items-start justify-between mb-3 sm:mb-4 gap-3">
                <div className="flex-1">
                  <div className="flex items-start sm:items-center flex-col sm:flex-row gap-2 sm:gap-3 mb-2">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                      {content.topic}
                    </h1>
                    <div className="flex items-center gap-2">
                      {content.isPinned && (
                        <div className="p-1 sm:p-1.5 bg-veritas-primary/10 dark:bg-veritas-light-blue/20 rounded-full">
                          <Pin className="h-3 w-3 sm:h-4 sm:w-4 text-veritas-primary dark:text-veritas-light-blue" />
                        </div>
                      )}
                      {content.isLocked && (
                        <div className="p-1 sm:p-1.5 bg-veritas-secondary/10 dark:bg-veritas-orange/20 rounded-full">
                          <Lock className="h-3 w-3 sm:h-4 sm:w-4 text-veritas-secondary dark:text-veritas-orange" />
                        </div>
                      )}
                    </div>
                  </div>
                  {content.heading.subtitle && (
                    <p className="text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400 mb-2">
                      {content.heading.subtitle}
                    </p>
                  )}
                </div>
                <div className="self-start">
                  {getActivityBadge()}
                </div>
              </div>
              
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                {content.description}
              </p>
              
              {/* Stats - Mobile optimized */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-500">
                <div className="flex items-center gap-1 sm:gap-2">
                  <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>{totalComments} <span className="hidden sm:inline">comments</span><span className="sm:hidden">msgs</span></span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>{participantCount} <span className="hidden sm:inline">participants</span><span className="sm:hidden">users</span></span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate">{formatLastActivity()}</span>
                </div>
              </div>
            </div>

            {/* Initial Post - Mobile optimized */}
            {content.initialPost && (
              <div className="bg-veritas-light-blue/10 dark:bg-veritas-light-blue/20 rounded-lg sm:rounded-xl p-4 sm:p-6 border border-veritas-light-blue/30 dark:border-veritas-light-blue/40">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-veritas-primary dark:text-veritas-light-blue" />
                  <span className="text-sm sm:text-base font-semibold text-veritas-primary dark:text-veritas-light-blue">Opening Statement</span>
                </div>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300">
                  {content.initialPost}
                </p>
              </div>
            )}

            {/* Enhanced Comments Section */}
            <ConversationCommentsSection 
              comments={comments}
              contentId={content.id}
              isLocked={content.isLocked}
            />

          </div>

          {/* Sidebar - Mobile: Above content, Desktop: Right column */}
          <div className="lg:col-span-1 order-1 lg:order-2 space-y-3 sm:space-y-4">
            {/* Mobile: Collapsible sections, Desktop: Regular sidebar */}
            <div className="lg:sticky lg:top-24">
              {/* Activity Timeline - Mobile optimized */}
              <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-veritas-eggshell/10">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                  <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
                  Activity Timeline
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs text-gray-500">Created</span>
                    <span className="text-[10px] sm:text-xs text-gray-700 dark:text-gray-300">
                    {new Date(content.createdAt).toLocaleDateString()}
                  </span>
                </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs text-gray-500">Last Activity</span>
                    <span className="text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 truncate max-w-[100px] sm:max-w-none">
                      {lastActivity ? formatLastActivity() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs text-gray-500">Activity Level</span>
                    <span className={`text-[10px] sm:text-xs font-medium ${
                    activityLevel === 'hot' ? 'text-veritas-secondary dark:text-veritas-orange' :
                    activityLevel === 'active' ? 'text-veritas-secondary dark:text-veritas-orange' :
                    activityLevel === 'recent' ? 'text-veritas-primary dark:text-veritas-eggshell' :
                    'text-gray-500'
                  }`}>
                    {activityLevel.charAt(0).toUpperCase() + activityLevel.slice(1)}
                  </span>
                </div>
              </div>
            </div>
            
              {/* Participation Stats - Mobile optimized */}
              <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-veritas-eggshell/10">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                  <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                  Engagement Stats
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs text-gray-500">Total Comments</span>
                    <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300">
                      {totalComments}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs text-gray-500">Participants</span>
                    <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300">
                      {participantCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs text-gray-500">Avg. per User</span>
                    <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300">
                      {participantCount > 0 ? (totalComments / participantCount).toFixed(1) : '0'}
                    </span>
                  </div>
              </div>
            </div>
            
              {/* Participation CTA - Mobile optimized, Hidden on mobile */}
              {!content.isLocked && (
                <div className="hidden sm:block bg-white dark:bg-veritas-darker-blue/80 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-veritas-eggshell/10">
                  <button className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue rounded-lg hover:bg-veritas-dark-blue dark:hover:bg-veritas-light-blue/90 hover:shadow-md transition-all duration-200 text-sm sm:text-base font-medium">
                    Join Discussion
                  </button>
                </div>
              )}
            
              {/* Top Contributors - Mobile optimized */}
              <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-veritas-eggshell/10">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                  Top Contributors
                </h3>
                <div className="space-y-1.5 sm:space-y-2">
                  {Array.from(getUniqueParticipants(comments)).slice(0, 5).map((name, index) => (
                    <div key={name} className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-veritas-primary dark:bg-veritas-light-blue flex items-center justify-center text-white dark:text-veritas-darker-blue text-[10px] sm:text-xs font-bold">
                      {name.charAt(0).toUpperCase()}
                    </div>
                      <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{name}</span>
                      {index === 0 && (
                        <span className="ml-auto text-[10px] sm:text-xs text-veritas-secondary dark:text-veritas-orange">👑</span>
                      )}
                  </div>
                ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Full Width Sections - Outside grid */}
        <div className="mt-6 lg:mt-8">
          {/* Relevance Signals - Consistent across all content types */}
          <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-veritas-eggshell/10">
            <RelevanceSignals belief={content} />
          </div>
        </div>
      </div>
    </div>
  );
};