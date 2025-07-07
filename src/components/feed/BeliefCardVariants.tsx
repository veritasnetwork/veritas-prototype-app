'use client';

import React from 'react';
import { Belief } from '@/types/belief.types';
import { BeliefCard } from './BeliefCard';

export type CardSize = 'small' | 'medium' | 'large' | 'extra-large';
export type CardLayout = 'vertical' | 'horizontal' | 'minimal';

interface BeliefCardVariantsProps {
  belief: Belief;
  size?: CardSize;
  layout?: CardLayout;
  showChart?: boolean;
  showMetadata?: boolean;
  onClick: (beliefId: string) => void;
  className?: string;
}

export const BeliefCardVariants: React.FC<BeliefCardVariantsProps> = ({
  belief,
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
      <BeliefCard
        belief={belief}
        variant={getVariant()}
        onClick={onClick}
      />
    </div>
  );
};

// Pre-configured variants for common use cases
export const SmallBeliefCard: React.FC<{ belief: Belief; onClick: (id: string) => void }> = ({
  belief,
  onClick
}) => (
  <BeliefCardVariants
    belief={belief}
    size="small"
    layout="vertical"
    showChart={false}
    showMetadata={false}
    onClick={onClick}
  />
);

export const MediumBeliefCard: React.FC<{ belief: Belief; onClick: (id: string) => void }> = ({
  belief,
  onClick
}) => (
  <BeliefCardVariants
    belief={belief}
    size="medium"
    layout="vertical"
    showChart={false}
    showMetadata={true}
    onClick={onClick}
  />
);

export const LargeBeliefCard: React.FC<{ belief: Belief; onClick: (id: string) => void }> = ({
  belief,
  onClick
}) => (
  <BeliefCardVariants
    belief={belief}
    size="large"
    layout="vertical"
    showChart={true}
    showMetadata={true}
    onClick={onClick}
  />
);

export const ExtraLargeBeliefCard: React.FC<{ belief: Belief; onClick: (id: string) => void }> = ({
  belief,
  onClick
}) => (
  <BeliefCardVariants
    belief={belief}
    size="extra-large"
    layout="vertical"
    showChart={true}
    showMetadata={true}
    onClick={onClick}
  />
);

// Specialized layout variants
export const HorizontalBeliefCard: React.FC<{ belief: Belief; onClick: (id: string) => void }> = ({
  belief,
  onClick
}) => (
  <BeliefCardVariants
    belief={belief}
    size="large"
    layout="horizontal"
    showChart={true}
    showMetadata={true}
    onClick={onClick}
  />
);

export const MinimalBeliefCard: React.FC<{ belief: Belief; onClick: (id: string) => void }> = ({
  belief,
  onClick
}) => (
  <BeliefCardVariants
    belief={belief}
    size="small"
    layout="minimal"
    showChart={false}
    showMetadata={false}
    onClick={onClick}
  />
);

// Responsive card that adapts to container size
export const ResponsiveBeliefCard: React.FC<{ 
  belief: Belief; 
  onClick: (id: string) => void;
  breakpoints?: {
    sm?: CardSize;
    md?: CardSize;
    lg?: CardSize;
    xl?: CardSize;
  };
}> = ({
  belief,
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
        <BeliefCardVariants
          belief={belief}
          size={breakpoints.sm || 'small'}
          onClick={onClick}
        />
      </div>
      
      {/* Medium screens */}
      <div className="hidden sm:block md:hidden">
        <BeliefCardVariants
          belief={belief}
          size={breakpoints.md || 'medium'}
          onClick={onClick}
        />
      </div>
      
      {/* Large screens */}
      <div className="hidden md:block lg:hidden">
        <BeliefCardVariants
          belief={belief}
          size={breakpoints.lg || 'large'}
          onClick={onClick}
        />
      </div>
      
      {/* Extra large screens */}
      <div className="hidden lg:block">
        <BeliefCardVariants
          belief={belief}
          size={breakpoints.xl || 'extra-large'}
          onClick={onClick}
        />
      </div>
    </div>
  );
};

// Grid-specific variants for different column layouts
export const GridBeliefCard: React.FC<{ 
  belief: Belief; 
  onClick: (id: string) => void;
  columns?: number;
}> = ({
  belief,
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
    <BeliefCardVariants
      belief={belief}
      size={getSize()}
      layout="vertical"
      showChart={columns <= 3}
      showMetadata={true}
      onClick={onClick}
    />
  );
};

// Feed-specific card variant
export const FeedBeliefCard: React.FC<{ 
  belief: Belief; 
  onClick: (id: string) => void;
}> = ({
  belief,
  onClick
}) => (
  <BeliefCardVariants
    belief={belief}
    size="extra-large"
    layout="vertical"
    showChart={true}
    showMetadata={true}
    onClick={onClick}
  />
); 