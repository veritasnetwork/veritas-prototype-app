import commentsData from '@/data/comments.json';

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  likes: number;
  replies?: Comment[];
  parentId?: string;
  // Legacy fields for backward compatibility
  author?: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  isExpert?: boolean;
}

export type SortOption = 'newest' | 'oldest' | 'most-liked';

// Type the imported data - now supports nested structure
const typedCommentsData = commentsData as Record<string, Comment[]>;

export const getCommentsByBeliefId = (beliefId: string): Comment[] => {
  return typedCommentsData[beliefId] || [];
};

export const getCommentsByContentId = (contentId: string): Comment[] => {
  return typedCommentsData[contentId] || [];
};

export const getCommentsCount = (beliefId: string): number => {
  return getCommentsByBeliefId(beliefId).length;
};

// Get total comment count including nested replies
export const getTotalCommentCount = (comments: Comment[]): number => {
  let count = 0;
  const countReplies = (commentList: Comment[]) => {
    for (const comment of commentList) {
      count++;
      if (comment.replies && comment.replies.length > 0) {
        countReplies(comment.replies);
      }
    }
  };
  countReplies(comments);
  return count;
};

// Get unique participants from comments
export const getUniqueParticipants = (comments: Comment[]): Set<string> => {
  const participants = new Set<string>();
  const collectParticipants = (commentList: Comment[]) => {
    for (const comment of commentList) {
      participants.add(comment.userName || comment.author || 'Anonymous');
      if (comment.replies && comment.replies.length > 0) {
        collectParticipants(comment.replies);
      }
    }
  };
  collectParticipants(comments);
  return participants;
};

// Sort comments by different criteria
export const sortComments = (comments: Comment[], sortBy: SortOption): Comment[] => {
  const sorted = [...comments];
  
  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    case 'most-liked':
      return sorted.sort((a, b) => b.likes - a.likes);
    default:
      return sorted;
  }
};

// Get the most recent activity timestamp
export const getLastActivityTime = (comments: Comment[]): Date | null => {
  if (comments.length === 0) return null;
  
  let mostRecent = new Date(0);
  const findMostRecent = (commentList: Comment[]) => {
    for (const comment of commentList) {
      const commentDate = new Date(comment.timestamp);
      if (commentDate > mostRecent) {
        mostRecent = commentDate;
      }
      if (comment.replies && comment.replies.length > 0) {
        findMostRecent(comment.replies);
      }
    }
  };
  findMostRecent(comments);
  return mostRecent;
};

export const formatCommentTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
};

export const getSentimentColor = (sentiment: Comment['sentiment']): string => {
  switch (sentiment) {
    case 'bullish':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'bearish':
      return 'text-red-600 dark:text-red-400';
    case 'neutral':
      return 'text-slate-600 dark:text-slate-400';
    default:
      return 'text-slate-600 dark:text-slate-400';
  }
};

export const getSentimentIcon = (sentiment: Comment['sentiment']): string => {
  switch (sentiment) {
    case 'bullish':
      return '↗️';
    case 'bearish':
      return '↘️';
    case 'neutral':
      return '→';
    default:
      return '→';
  }
}; 