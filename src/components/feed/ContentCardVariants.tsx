'use client';

import React from 'react';
import { Content } from '@/types/content.types';
import { ContentCard } from './ContentCard';

export type CardSize = 'small' | 'medium' | 'large' | 'extra-large';
export type CardLayout = 'vertical' | 'horizontal' | 'minimal';

interface ContentCardVariantsProps {
  content: Content;
  size?: CardSize;
  layout?: CardLayout;
  showChart?: boolean;
  showMetadata?: boolean;
  onClick: (contentId: string) => void;
  className?: string;
}

export const ContentCardVariants: React.FC<ContentCardVariantsProps> = ({
  content,
  size = 'medium',
  layout = 'vertical',
  onClick,
  className = ''
}) => {
  // Get variant based on size
  const getVariant = () => {
    switch (size) {
      case 'small':
      case 'medium':
        return 'grid';
      case 'large':
      case 'extra-large':
        return 'feed';
      default:
        return 'grid';
    }
  };

  // Get custom classes based on size and layout
  const getCardClasses = () => {
    const baseClasses = 'w-full';
    
    const sizeClasses = {
      small: 'max-w-xs',
      medium: 'max-w-sm',
      large: 'max-w-md',
      'extra-large': 'max-w-2xl'
    };

    const layoutClasses = {
      vertical: '',
      horizontal: 'flex-row',
      minimal: 'p-4'
    };

    return `${baseClasses} ${sizeClasses[size]} ${layoutClasses[layout]} ${className}`;
  };

  return (
    <div className={getCardClasses()}>
      <ContentCard
        content={content}
        variant={getVariant()}
        onClick={onClick}
      />
    </div>
  );
};

// Pre-configured variants for common use cases
export const SmallContentCard: React.FC<{ content: Content; onClick: (id: string) => void }> = ({
  content,
  onClick
}) => (
  <ContentCardVariants
    content={content}
    size="small"
    layout="vertical"
    showChart={false}
    showMetadata={false}
    onClick={onClick}
  />
);

export const MediumContentCard: React.FC<{ content: Content; onClick: (id: string) => void }> = ({
  content,
  onClick
}) => (
  <ContentCardVariants
    content={content}
    size="medium"
    layout="vertical"
    showChart={false}
    showMetadata={true}
    onClick={onClick}
  />
);

export const LargeContentCard: React.FC<{ content: Content; onClick: (id: string) => void }> = ({
  content,
  onClick
}) => (
  <ContentCardVariants
    content={content}
    size="large"
    layout="vertical"
    showChart={true}
    showMetadata={true}
    onClick={onClick}
  />
);

export const ExtraLargeContentCard: React.FC<{ content: Content; onClick: (id: string) => void }> = ({
  content,
  onClick
}) => (
  <ContentCardVariants
    content={content}
    size="extra-large"
    layout="vertical"
    showChart={true}
    showMetadata={true}
    onClick={onClick}
  />
);

// Specialized layout variants
export const HorizontalContentCard: React.FC<{ content: Content; onClick: (id: string) => void }> = ({
  content,
  onClick
}) => (
  <ContentCardVariants
    content={content}
    size="large"
    layout="horizontal"
    showChart={true}
    showMetadata={true}
    onClick={onClick}
  />
);

export const MinimalContentCard: React.FC<{ content: Content; onClick: (id: string) => void }> = ({
  content,
  onClick
}) => (
  <ContentCardVariants
    content={content}
    size="small"
    layout="minimal"
    showChart={false}
    showMetadata={false}
    onClick={onClick}
  />
);

// Responsive card that adapts to container size
export const ResponsiveContentCard: React.FC<{ 
  content: Content; 
  onClick: (id: string) => void;
  breakpoints?: {
    sm?: CardSize;
    md?: CardSize;
    lg?: CardSize;
    xl?: CardSize;
  };
}> = ({
  content,
  onClick,
  breakpoints = {
    sm: 'small',
    md: 'medium',
    lg: 'large',
    xl: 'extra-large'
  }
}) => {
  return (
    <div className="w-full">
      {/* Small screens */}
      <div className="block sm:hidden">
        <ContentCardVariants
          content={content}
          size={breakpoints.sm || 'small'}
          onClick={onClick}
        />
      </div>
      
      {/* Medium screens */}
      <div className="hidden sm:block md:hidden">
        <ContentCardVariants
          content={content}
          size={breakpoints.md || 'medium'}
          onClick={onClick}
        />
      </div>
      
      {/* Large screens */}
      <div className="hidden md:block lg:hidden">
        <ContentCardVariants
          content={content}
          size={breakpoints.lg || 'large'}
          onClick={onClick}
        />
      </div>
      
      {/* Extra large screens */}
      <div className="hidden lg:block">
        <ContentCardVariants
          content={content}
          size={breakpoints.xl || 'extra-large'}
          onClick={onClick}
        />
      </div>
    </div>
  );
};

// Grid-specific variants for different column layouts
export const GridContentCard: React.FC<{ 
  content: Content; 
  onClick: (id: string) => void;
  columns?: number;
}> = ({
  content,
  onClick,
  columns = 3
}) => {
  const getSize = (): CardSize => {
    switch (columns) {
      case 2: return 'large';
      case 3: return 'medium';
      case 4: return 'small';
      default: return 'medium';
    }
  };

  return (
    <ContentCardVariants
      content={content}
      size={getSize()}
      layout="vertical"
      showChart={columns <= 3}
      showMetadata={true}
      onClick={onClick}
    />
  );
};

// Feed-specific card variant
export const FeedContentCard: React.FC<{ 
  content: Content; 
  onClick: (id: string) => void;
}> = ({
  content,
  onClick
}) => (
  <ContentCardVariants
    content={content}
    size="extra-large"
    layout="vertical"
    showChart={true}
    showMetadata={true}
    onClick={onClick}
  />
); 