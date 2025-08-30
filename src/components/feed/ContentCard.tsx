import React from 'react';
import { 
  Content as ContentUnion,
  isNewsContent,
  isOpinionContent,
  isConversationContent,
  isBlogContent
} from '@/types/content.types';
import { NewsCard } from './cards/NewsCard';
import { OpinionCard } from './cards/OpinionCard';
import { ConversationCard } from './cards/ConversationCard';
import { BlogCard } from './cards/BlogCard';

interface ContentCardProps {
  content: ContentUnion;
  variant?: 'feed' | 'grid' | 'compact' | 'mobile' | 'news' | 'large' | 'premier';
  onClick: (contentId: string) => void;
}

// Determine layout based on content type
const getCardLayout = (content: ContentUnion): 'full' | 'half' => {
  // News and Blog are full width
  if (isNewsContent(content) || isBlogContent(content)) {
    return 'full';
  }
  // Opinion and Conversation are half width
  if (isOpinionContent(content) || isConversationContent(content)) {
    return 'half';
  }
  // Default to full for unknown/legacy content
  return 'full';
};

/**
 * ContentCard Dispatcher Component
 * Routes to appropriate card component based on content type
 * Handles layout (full vs half width) based on content type
 */
export const ContentCard: React.FC<ContentCardProps> = ({
  content,
  variant = 'feed',
  onClick
}) => {
  const layout = getCardLayout(content);
  
  // Route to appropriate card based on content type
  if (isOpinionContent(content)) {
    return (
      <OpinionCard
        content={content}
        variant={variant}
        onClick={onClick}
        layout={layout}
      />
    );
  }
  
  if (isConversationContent(content)) {
    return (
      <ConversationCard
        content={content}
        variant={variant}
        onClick={onClick}
        layout={layout}
      />
    );
  }
  
  if (isBlogContent(content)) {
    return (
      <BlogCard
        content={content}
        variant={variant}
        onClick={onClick}
        layout={layout}
      />
    );
  }
  
  // Default to NewsCard for news content and legacy content
  return (
    <NewsCard
      content={content}
      variant={variant}
      onClick={onClick}
      layout={layout}
    />
  );
};

// Export layout utility for use in feed components
export { getCardLayout };