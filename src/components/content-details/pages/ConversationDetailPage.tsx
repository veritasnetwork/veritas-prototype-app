'use client';

import { useState, useEffect } from 'react';
import { ConversationContent } from '@/types/content.types';
import { RelevanceSignals } from '../RelevanceSignals';
import { ConversationCommentsSection } from '../ConversationCommentsSection';
import { SkeletonContentDetailPage } from '../skeleton/SkeletonContentDetailPage';
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
  const [isLoading, setIsLoading] = useState(true);
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
    
    // Simulate loading for smooth transition
    setTimeout(() => {
      setIsLoading(false);
    }, 300);
  }, [content]);

  if (isLoading) {
    return <SkeletonContentDetailPage />;
  }

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

  // Get activity badge
  const getActivityBadge = () => {
    switch (activityLevel) {
      case 'hot':
        return (
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 text-sm rounded-full font-medium">
            <Flame className="h-4 w-4" />
            Hot Discussion
          </div>
        );
      case 'active':
        return (
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300 text-sm rounded-full">
            Active
          </div>
        );
      case 'recent':
        return (
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300 text-sm rounded-full">
            Recent Activity
          </div>
        );
      default:
        return null;
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-veritas-darker-blue">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-veritas-darker-blue pt-20 md:pt-4">
        <div className="container mx-auto px-4 py-3 max-w-7xl">
          <button 
            onClick={onBack}
            className="flex items-center space-x-2 text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70 hover:text-veritas-primary dark:hover:text-veritas-eggshell transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Feed</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Content - 3 columns */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Conversation Header */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {content.topic}
                    </h1>
                    {content.isPinned && (
                      <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-full">
                        <Pin className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                      </div>
                    )}
                    {content.isLocked && (
                      <div className="p-1.5 bg-red-100 dark:bg-red-900 rounded-full">
                        <Lock className="h-4 w-4 text-red-600 dark:text-red-300" />
                      </div>
                    )}
                  </div>
                  {content.heading.subtitle && (
                    <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                      {content.heading.subtitle}
                    </p>
                  )}
                </div>
                {getActivityBadge()}
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {content.description}
              </p>
              
              {/* Stats */}
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>{totalComments} comments</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{participantCount} participants</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatLastActivity()}</span>
                </div>
              </div>
            </div>

            {/* Initial Post */}
            {content.initialPost && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold text-blue-900 dark:text-blue-300">Opening Statement</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300">
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

          {/* Sidebar - 1 column */}
          <div className="lg:col-span-1 space-y-4">
            {/* Activity Timeline */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 border border-slate-200 dark:border-veritas-eggshell/10">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activity Timeline
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Created</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {new Date(content.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Last Activity</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {lastActivity ? formatLastActivity() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Activity Level</span>
                  <span className={`text-xs font-medium ${
                    activityLevel === 'hot' ? 'text-red-500' :
                    activityLevel === 'active' ? 'text-orange-500' :
                    activityLevel === 'recent' ? 'text-yellow-500' :
                    'text-gray-500'
                  }`}>
                    {activityLevel.charAt(0).toUpperCase() + activityLevel.slice(1)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Participation Stats */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 border border-slate-200 dark:border-veritas-eggshell/10">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Engagement Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Total Comments</span>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    {totalComments}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Participants</span>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    {participantCount}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Avg. per User</span>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    {participantCount > 0 ? (totalComments / participantCount).toFixed(1) : '0'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Participation CTA */}
            {!content.isLocked && (
              <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 border border-slate-200 dark:border-veritas-eggshell/10">
                <button className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-md transition-all duration-200">
                  Join Discussion
                </button>
              </div>
            )}
            
            {/* Top Contributors */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 border border-slate-200 dark:border-veritas-eggshell/10">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Top Contributors
              </h3>
              <div className="space-y-2">
                {Array.from(getUniqueParticipants(comments)).slice(0, 5).map((name, index) => (
                  <div key={name} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{name}</span>
                    {index === 0 && (
                      <span className="ml-auto text-xs text-yellow-500">👑</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full Width Sections */}
          <div className="lg:col-span-4">
            {/* Relevance Signals - Consistent across all content types */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <RelevanceSignals belief={content} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};