'use client';

import { useState } from 'react';
import { Comment, SortOption, sortComments } from '@/lib/comments';
import { 
  MessageCircle, 
  ThumbsUp, 
  Reply, 
  User, 
  ChevronDown,
  ChevronUp,
  Filter
} from 'lucide-react';

interface ConversationCommentsSectionProps {
  comments: Comment[];
  contentId: string;
  isLocked?: boolean;
}

export const ConversationCommentsSection: React.FC<ConversationCommentsSectionProps> = ({ 
  comments: initialComments,
  isLocked = false
}) => {
  const [comments, setComments] = useState(initialComments);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  // Sort comments when sort option changes
  const handleSort = (newSort: SortOption) => {
    setSortBy(newSort);
    setComments(sortComments(comments, newSort));
  };

  // Toggle reply expansion
  const toggleReplies = (commentId: string) => {
    const newExpanded = new Set(expandedReplies);
    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId);
    } else {
      newExpanded.add(commentId);
    }
    setExpandedReplies(newExpanded);
  };

  // Handle reply submission
  const handleReplySubmit = (parentId: string) => {
    void parentId; // Will be used when backend is connected
    if (replyText.trim()) {
      // In a real app, this would send to backend with parentId
      // Reply submitted - In production, send to backend
      setReplyText('');
      setReplyingTo(null);
    }
  };

  // Handle new comment submission
  const handleNewCommentSubmit = () => {
    if (newCommentText.trim()) {
      // In a real app, this would send to backend
      // New comment submitted - In production, send to backend
      setNewCommentText('');
    }
  };

  // Format time ago
  const formatTimeAgo = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Render a single comment with nested replies (max 3 levels)
  const renderComment = (comment: Comment, depth: number = 0): React.ReactElement => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    const maxDepth = 3;
    const canReply = depth < maxDepth && !isLocked;

    return (
      <div key={comment.id} className={depth > 0 ? 'ml-4 sm:ml-8 mt-2 sm:mt-3' : 'mt-3 sm:mt-4'}>
        <div className={`
          p-3 sm:p-4 rounded-lg transition-all duration-200
          ${depth === 0 
            ? 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700' 
            : 'bg-gray-50 dark:bg-gray-800/50 border-l-2 border-gray-300 dark:border-gray-600'
          }
        `}>
          {/* Comment Header - Mobile optimized */}
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                  {comment.userName || comment.author || 'Anonymous'}
                </span>
                <span className="text-xs sm:text-sm text-gray-500">
                  {formatTimeAgo(comment.timestamp)}
                </span>
              </div>
              
              {/* Comment Content - Mobile optimized */}
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
                {comment.content}
              </p>
              
              {/* Comment Actions - Mobile optimized */}
              <div className="flex items-center gap-3 sm:gap-4">
                <button className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 hover:text-veritas-blue transition-colors">
                  <ThumbsUp className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>{comment.likes}</span>
                </button>
                
                {canReply && (
                  <button 
                    onClick={() => setReplyingTo(comment.id)}
                    className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 hover:text-veritas-primary dark:hover:text-veritas-light-blue transition-colors"
                  >
                    <Reply className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Reply</span>
                  </button>
                )}
                
                {hasReplies && (
                  <button 
                    onClick={() => toggleReplies(comment.id)}
                    className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 hover:text-veritas-primary dark:hover:text-veritas-light-blue transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" /> : <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />}
                    <span className="hidden sm:inline">{comment.replies!.length} {comment.replies!.length === 1 ? 'reply' : 'replies'}</span>
                    <span className="sm:hidden">{comment.replies!.length}</span>
                  </button>
                )}
              </div>
              
              {/* Reply Input - Mobile optimized */}
              {replyingTo === comment.id && (
                <div className="mt-2 sm:mt-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-veritas-primary dark:focus:ring-veritas-light-blue text-xs sm:text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit(comment.id)}
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleReplySubmit(comment.id)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue rounded-lg hover:bg-veritas-dark-blue dark:hover:bg-veritas-light-blue/90 transition-colors text-xs sm:text-sm"
                      >
                        Post
                      </button>
                      <button 
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText('');
                        }}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 text-gray-500 hover:text-gray-700 transition-colors text-xs sm:text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Nested Replies */}
        {hasReplies && isExpanded && depth < maxDepth && (
          <div className="mt-2">
            {comment.replies!.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
        
        {/* Show "View in thread" for deeply nested replies - Mobile optimized */}
        {hasReplies && depth >= maxDepth && (
          <button className="mt-2 ml-4 sm:ml-8 text-xs sm:text-sm text-veritas-blue hover:text-veritas-dark-blue transition-colors">
            View {comment.replies!.length} more {comment.replies!.length === 1 ? 'reply' : 'replies'} in thread →
          </button>
        )}
      </div>
    );
  };

  if (comments.length === 0 && isLocked) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <MessageCircle className="h-10 sm:h-12 w-10 sm:w-12 text-gray-400 mx-auto mb-2 sm:mb-3" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
            Discussion Closed
          </h3>
          <p className="text-sm sm:text-base text-gray-500">
            This conversation has been locked and no new comments can be added.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
      {/* Header with Sort Options - Mobile optimized */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-veritas-blue" />
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            Discussion
          </h2>
          <span className="text-xs sm:text-sm text-gray-500">
            ({comments.length})
          </span>
        </div>
        
        {/* Sort Dropdown - Mobile optimized */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
          <select 
            value={sortBy}
            onChange={(e) => handleSort(e.target.value as SortOption)}
            className="px-2 sm:px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-veritas-blue"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="most-liked">Top</option>
          </select>
        </div>
      </div>

      {/* New Comment Input - Mobile optimized */}
      {!isLocked && (
        <div className="mb-4 sm:mb-6">
          <textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Join the conversation..."
            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-veritas-blue resize-none text-sm sm:text-base"
            rows={3}
          />
          <div className="mt-2 flex justify-end">
            <button 
              onClick={handleNewCommentSubmit}
              disabled={!newCommentText.trim()}
              className="px-4 sm:px-6 py-1.5 sm:py-2 bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue rounded-lg hover:bg-veritas-dark-blue dark:hover:bg-veritas-light-blue/90 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              Post
            </button>
          </div>
        </div>
      )}

      {/* Comments List - Mobile optimized */}
      <div className="space-y-1 sm:space-y-2">
        {comments.length > 0 ? (
          comments.map(comment => renderComment(comment, 0))
        ) : (
          <div className="text-center py-8 sm:py-12">
            <MessageCircle className="h-10 sm:h-12 w-10 sm:w-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
            <p className="text-sm sm:text-base text-gray-500">
              No comments yet. Be the first to contribute!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};