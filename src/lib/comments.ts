import commentsData from '@/data/comments.json';

export interface Comment {
  id: string;
  author: string;
  timestamp: string;
  content: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  likes: number;
  isExpert: boolean;
}

// Type the imported data
const typedCommentsData = commentsData as Record<string, Comment[]>;

export const getCommentsByBeliefId = (beliefId: string): Comment[] => {
  return typedCommentsData[beliefId] || [];
};

export const getCommentsCount = (beliefId: string): number => {
  return getCommentsByBeliefId(beliefId).length;
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