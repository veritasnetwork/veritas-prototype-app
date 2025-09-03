import React, { useState } from 'react';
import { BlogContent } from '@/types/content.types';
import { Clock, User, BookOpen } from 'lucide-react';
import Image from 'next/image';

interface BlogCardProps {
  content: BlogContent;
  variant?: 'feed' | 'grid' | 'compact' | 'mobile' | 'news' | 'large' | 'premier';
  onClick: (contentId: string) => void;
  layout?: 'full' | 'half';
}

export const BlogCard: React.FC<BlogCardProps> = ({
  content,
  variant = 'feed',
  onClick
}) => {
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [myBeliefValue, setMyBeliefValue] = useState(50);
  const [othersBeliefValue, setOthersBeliefValue] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleClick = () => {
    onClick(content.id);
  };
  
  const handleValidate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingMode(!isEditingMode);
    if (!isEditingMode) {
      // Initialize with current relevance value when entering edit mode
      const currentRelevance = content.signals?.relevance?.currentValue || 50;
      setMyBeliefValue(currentRelevance);
      setOthersBeliefValue(currentRelevance);
    }
  };
  
  const handleTotalRelevanceSubmit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSubmitting(true);
    
    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsEditingMode(false);
    // Reset values for next edit
    setMyBeliefValue(50);
    setOthersBeliefValue(50);
  };
  
  // Card sizing based on variant
  const getCardSizing = () => {
    switch (variant) {
      case 'compact':
        return 'w-full h-36';
      case 'mobile':
        return 'w-full';
      case 'premier':
        return 'w-full h-64';
      case 'large':
        return 'w-full h-80';
      default:
        return 'w-full';
    }
  };
  
  // Get placeholder image or use article thumbnail
  const getImageSrc = () => {
    if (content.article.thumbnail) {
      return content.article.thumbnail;
    }
    // Generate gradient based on category
    const categoryGradients: { [key: string]: string } = {
      'Analysis': 'bg-gradient-to-br from-blue-500 to-purple-600',
      'Technical': 'bg-gradient-to-br from-green-500 to-teal-600',
      'Market': 'bg-gradient-to-br from-orange-500 to-red-600',
      'Opinion': 'bg-gradient-to-br from-purple-500 to-pink-600',
      'default': 'bg-gradient-to-br from-gray-500 to-gray-700'
    };
    return categoryGradients[content.category] || categoryGradients.default;
  };
  
  const imageSrc = getImageSrc();
  const isGradient = imageSrc.includes('gradient');
  
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
      `}
      onClick={handleClick}
    >
      <div className={variant === 'news' || variant === 'large' ? 'flex h-full' : ''}>
        {/* Image Section */}
        <div className={
          variant === 'news' || variant === 'large' 
            ? 'w-1/3 relative' 
            : 'relative h-48 w-full'
        }>
          {isGradient ? (
            <div className={`absolute inset-0 ${imageSrc}`} />
          ) : (
            <Image
              src={imageSrc}
              alt={content.heading.title}
              fill
              className="object-cover"
            />
          )}
          
          {/* Category Badge */}
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 text-white text-xs rounded">
            {content.category}
          </div>
          
          {/* Validate Button - Top Right */}
          {variant !== 'compact' && (
            <button
              onClick={handleValidate}
              className="absolute top-3 right-3 px-3 py-1 bg-veritas-primary/90 dark:bg-veritas-light-blue/90 backdrop-blur-sm text-white dark:text-veritas-darker-blue text-xs font-medium rounded hover:bg-veritas-primary dark:hover:bg-veritas-light-blue transition-colors z-10"
            >
              {isEditingMode ? 'View Blog' : 'Validate'}
            </button>
          )}
        </div>
        
        {/* Content Section */}
        <div className={
          variant === 'news' || variant === 'large'
            ? 'flex-1 p-4 flex flex-col'
            : 'p-4 flex flex-col'
        }>
          {/* Header */}
          <div className="mb-2">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-2 group-hover:text-veritas-primary dark:group-hover:text-veritas-light-blue transition-colors">
              {content.heading.title}
            </h3>
            {variant !== 'compact' && content.heading.subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                {content.heading.subtitle}
              </p>
            )}
          </div>
          
          {/* Excerpt or Validation Editor */}
          {variant !== 'compact' && (
            isEditingMode ? (
              /* Total Relevance Editor */
              <div className="flex-1 py-2">
                <h4 className="text-xs font-semibold text-veritas-primary dark:text-veritas-eggshell mb-2 uppercase tracking-wider">
                  Total Relevance Adjustment
                </h4>
                
                <div className="space-y-3">
                  {/* My Belief Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        What I Believe
                      </label>
                      <span className="text-xs font-bold text-veritas-primary dark:text-veritas-light-blue">
                        {myBeliefValue}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={myBeliefValue}
                      onChange={(e) => {
                        e.stopPropagation();
                        setMyBeliefValue(parseInt(e.target.value));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700"
                      style={{
                        background: `linear-gradient(to right, #B9D9EB 0%, #B9D9EB ${myBeliefValue}%, rgb(229 231 235) ${myBeliefValue}%, rgb(229 231 235) 100%)`
                      }}
                    />
                  </div>
                  
                  {/* Others Belief Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        What Others Believe
                      </label>
                      <span className="text-xs font-bold text-veritas-primary dark:text-veritas-light-blue">
                        {othersBeliefValue}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={othersBeliefValue}
                      onChange={(e) => {
                        e.stopPropagation();
                        setOthersBeliefValue(parseInt(e.target.value));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700"
                      style={{
                        background: `linear-gradient(to right, #B9D9EB 0%, #B9D9EB ${othersBeliefValue}%, rgb(229 231 235) ${othersBeliefValue}%, rgb(229 231 235) 100%)`
                      }}
                    />
                  </div>
                  
                  {/* Submit Button */}
                  <button
                    onClick={handleTotalRelevanceSubmit}
                    disabled={isSubmitting}
                    className="w-full py-1.5 mt-1 bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-darker-blue rounded-lg text-xs font-medium hover:bg-veritas-dark-blue dark:hover:bg-veritas-light-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Total Relevance'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-3">
                {content.article.excerpt}
              </p>
            )
          )}
          
          {/* Author Info */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {content.author}
                </p>
                {variant !== 'compact' && content.authorBio && (
                  <p className="text-xs text-gray-500 line-clamp-1">
                    {content.authorBio}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Tags */}
          {variant !== 'compact' && content.tags && content.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {content.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400 rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          
          {/* Footer */}
          <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{content.readingTime} min read</span>
              </div>
              <div className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                <span>{content.wordCount} words</span>
              </div>
            </div>
            
            {/* Read More CTA */}
            {variant !== 'compact' && (
              <button
                className="text-sm font-medium text-veritas-primary dark:text-veritas-light-blue hover:text-veritas-secondary dark:hover:text-veritas-eggshell transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
              >
                Read More →
              </button>
            )}
          </div>
          
          {/* Signal Indicators */}
          {content.signals && (
            <div className="flex gap-4 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="text-xs text-gray-500">
                Truth: {content.signals.truth?.currentValue || 0}%
              </div>
              <div className="text-xs text-gray-500">
                Informativeness: {content.signals.informativeness?.currentValue || 0}%
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};