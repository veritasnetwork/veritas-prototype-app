'use client';

import { ReactNode } from 'react';

interface CardGroupProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  variant: 'featured' | 'accent' | 'primary' | 'mixed' | 'compact';
  className?: string;
}

export const CardGroup: React.FC<CardGroupProps> = ({
  title,
  subtitle,
  children,
  variant,
  className = ''
}) => {
  const getHeaderStyles = () => {
    switch (variant) {
      case 'featured':
        return 'text-white';
      case 'accent':
        return 'text-white';
      case 'primary':
        return 'text-white';
      default:
        return 'text-gray-900 dark:text-slate-100';
    }
  };

  const getPadding = () => {
    switch (variant) {
      case 'featured':
        return 'p-4 sm:p-6 lg:p-8';
      case 'compact':
        return 'p-3 sm:p-4';
      default:
        return 'p-4 sm:p-6';
    }
  };

  const getSubtitleStyles = () => {
    switch (variant) {
      case 'featured':
        return 'text-white/80';
      case 'accent':
        return 'text-white/80';
      case 'primary':
        return 'text-white/80';
      default:
        return 'text-gray-600 dark:text-slate-400';
    }
  };

  const getTitleSize = () => {
    switch (variant) {
      case 'compact':
        return 'text-xl sm:text-2xl font-bold';
      default:
        return 'text-xl sm:text-2xl lg:text-3xl font-bold';
    }
  };

  return (
    <div className={`rounded-2xl ${getPadding()} ${className} transition-all duration-300 hover:shadow-lg card-group-hover`}>
      {/* Group Header */}
      <div className="mb-4 sm:mb-6">
        <h2 className={`${getTitleSize()} ${getHeaderStyles()} mb-2`}>
          {title}
        </h2>
        {subtitle && (
          <p className={`text-sm sm:text-base ${getSubtitleStyles()}`}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Group Content */}
      <div className="card-enter">
        {children}
      </div>
    </div>
  );
}; 