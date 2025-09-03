'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { 
  Content, 
  ContentType,
  isNewsContent, 
  isOpinionContent, 
  isConversationContent, 
  isBlogContent, 
  Belief 
} from '@/types/content.types';
import { ContentCard } from './ContentCard';
import { ChevronRight, Sparkles, FileText, MessageSquare, Users, BookOpen } from 'lucide-react';
import { useFeed } from '@/contexts/FeedContext';
import { rankContent } from '@/lib/algorithmEngine';
import { getAllContent } from '@/lib/data';

interface PremierHeaderProps {
  premierContents: Content[];
  onContentClick: (contentId: string) => void;
}

type ViewType = 'all' | ContentType;

interface ContentByType {
  all: Content[];
  news: Content[];
  opinion: Content[];
  conversation: Content[];
  blog: Content[];
}

export const PremierHeader: React.FC<PremierHeaderProps> = ({
  premierContents,
  onContentClick
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeView, setActiveView] = useState<ViewType>('all');
  const { currentAlgorithm, rankedContent } = useFeed();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [contentCache, setContentCache] = useState<ContentByType | null>(null);

  // Fetch and cache content by type
  const fetchAndCacheContent = useCallback(() => {
    if (!currentAlgorithm) {
      return {
        all: premierContents.slice(0, 3),
        news: [] as Content[],
        opinion: [] as Content[],
        conversation: [] as Content[],
        blog: [] as Content[]
      };
    }

    // Use rankedContent from context if available, otherwise get all content
    const allContent = rankedContent.length > 0 ? rankedContent : getAllContent();
    
    // Get top 3 overall (already ranked by context)
    const topOverall = allContent.slice(0, 3);
    
    // Filter and rank each content type separately
    const newsContent = rankContent(
      allContent.filter(c => isNewsContent(c)),
      currentAlgorithm
    ).slice(0, 3);
    
    const opinionContent = rankContent(
      allContent.filter(c => isOpinionContent(c)),
      currentAlgorithm
    ).slice(0, 3);
    
    const conversationContent = rankContent(
      allContent.filter(c => isConversationContent(c)),
      currentAlgorithm
    ).slice(0, 3);
    
    const blogContent = rankContent(
      allContent.filter(c => isBlogContent(c)),
      currentAlgorithm
    ).slice(0, 3);

    return {
      all: topOverall,
      news: newsContent,
      opinion: opinionContent,
      conversation: conversationContent,
      blog: blogContent
    };
  }, [premierContents, currentAlgorithm, rankedContent]);

  // Initialize and update cache when algorithm changes
  useEffect(() => {
    const newCache = fetchAndCacheContent();
    setContentCache(newCache);
  }, [fetchAndCacheContent]);

  // Get current view's content from cache
  const currentViewContent = useMemo(() => {
    if (!contentCache) return [];
    return contentCache[activeView] || [];
  }, [contentCache, activeView]);

  // Reset index when view changes
  useEffect(() => {
    setActiveIndex(0);
  }, [activeView]);

  // Auto-cycle through contents every 6 seconds
  useEffect(() => {
    if (currentViewContent.length <= 1) return;
    
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % currentViewContent.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [currentViewContent.length]);

  // Handle view change with smooth transition
  const handleViewChange = useCallback((view: ViewType) => {
    if (view === activeView) return;
    
    // Start transition
    setIsTransitioning(true);
    
    // Use requestAnimationFrame for smoother transitions
    requestAnimationFrame(() => {
      setTimeout(() => {
        setActiveView(view);
        setActiveIndex(0);
        
        // End transition after a short delay
        requestAnimationFrame(() => {
          setTimeout(() => {
            setIsTransitioning(false);
          }, 50);
        });
      }, 150);
    });
  }, [activeView]);

  // Handle navigation to next content
  const handleNextContent = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveIndex((prev) => (prev + 1) % currentViewContent.length);
  }, [currentViewContent.length]);

  // Navigation configuration with Veritas colors
  const viewOptions: Array<{ 
    value: ViewType; 
    label: string; 
    icon: React.ReactNode; 
  }> = [
    { 
      value: 'all', 
      label: 'All', 
      icon: null, 
    },
    { 
      value: 'news', 
      label: 'News', 
      icon: <FileText className="h-3 w-3" />, 
    },
    { 
      value: 'opinion', 
      label: 'Opinion', 
      icon: <MessageSquare className="h-3 w-3" />, 
    },
    { 
      value: 'conversation', 
      label: 'Conversation', 
      icon: <Users className="h-3 w-3" />, 
    },
    { 
      value: 'blog', 
      label: 'Blog', 
      icon: <BookOpen className="h-3 w-3" />, 
    },
  ];

  // Loading state while cache is being built
  if (!contentCache) {
    return (
      <div className="w-full bg-white dark:bg-veritas-darker-blue shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
            <div className="h-[500px] bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state for current view
  if (!currentViewContent.length) {
    return (
      <div className="w-full bg-white dark:bg-veritas-darker-blue shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header with 5-Dot Navigation */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-veritas-primary dark:text-veritas-eggshell">
                Top Ranked {activeView === 'all' ? 'Content' : activeView.charAt(0).toUpperCase() + activeView.slice(1)}
              </h2>
            </div>
            
            {/* Pill Navigation System */}
            <div className="inline-flex items-center p-1 bg-slate-200 dark:bg-veritas-darker-blue/50 rounded-full">
              {viewOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleViewChange(option.value)}
                  className={`
                    relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                    ${activeView === option.value
                      ? 'bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-dark-blue shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }
                  `}
                  title={option.label}
                >
                  <span className="flex items-center gap-1.5">
                    {option.icon && <span className={activeView === option.value ? '' : 'opacity-60'}>{option.icon}</span>}
                    {option.label}
                    {contentCache && contentCache[option.value].length > 0 && (
                      <span className={`ml-1 text-xs ${
                        activeView === option.value 
                          ? 'text-white/80 dark:text-veritas-dark-blue/80' 
                          : 'text-gray-400'
                      }`}>
                        ({contentCache[option.value].length})
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="text-center py-24 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No {activeView === 'all' ? '' : activeView} content available
            </p>
            {activeView !== 'all' && (
              <button
                onClick={() => handleViewChange('all')}
                className="mt-4 text-sm text-veritas-blue hover:text-veritas-dark-blue transition-colors"
              >
                View all content →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const activeContent = currentViewContent[Math.min(activeIndex, currentViewContent.length - 1)];

  return (
    <div className="w-full bg-white dark:bg-veritas-darker-blue shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header with Algorithm Indicator and 5-Dot Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-veritas-primary dark:text-veritas-eggshell">
              Top Ranked {activeView === 'all' ? 'Content' : activeView.charAt(0).toUpperCase() + activeView.slice(1)}
            </h2>
            <span className="text-sm text-gray-500 dark:text-veritas-eggshell/50">
              by {currentAlgorithm?.name || 'Algorithm'}
            </span>
            {currentAlgorithm?.type === 'user' && (
              <Sparkles className="w-4 h-4 text-veritas-secondary dark:text-veritas-orange" />
            )}
          </div>
          
          {/* Pill Navigation System */}
          <div className="inline-flex items-center p-1 bg-gray-100 dark:bg-veritas-darker-blue/50 rounded-full">
            {viewOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleViewChange(option.value)}
                className={`
                  relative px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200
                  ${activeView === option.value
                    ? 'bg-veritas-primary dark:bg-veritas-light-blue text-white dark:text-veritas-dark-blue shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }
                `}
                title={option.label}
              >
                <span className="flex items-center gap-1.5">
                  {option.icon && (
                    <span className={`hidden sm:inline-block ${activeView === option.value ? '' : 'opacity-60'}`}>
                      {option.icon}
                    </span>
                  )}
                  <span className="hidden sm:inline">{option.label}</span>
                  <span className="sm:hidden">{option.label.charAt(0)}</span>
                  {contentCache && contentCache[option.value].length > 0 && (
                    <span className={`ml-1 text-xs ${
                      activeView === option.value 
                        ? 'text-white/80 dark:text-veritas-dark-blue/80' 
                        : 'text-gray-400'
                    }`}>
                      {contentCache[option.value].length}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Content Grid with Enhanced Transition */}
        <div 
          className={`
            transition-all duration-300 transform
            ${isTransitioning 
              ? 'opacity-0 scale-95' 
              : 'opacity-100 scale-100'
            }
          `}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[500px]">
            
            {/* Hero Card - Left Side (2/3 width on desktop) */}
            <div 
              className={`
                lg:col-span-2 relative group cursor-pointer overflow-hidden rounded-2xl shadow-2xl
                bg-veritas-dark-blue dark:bg-veritas-darker-blue
              `}
              onClick={() => onContentClick(activeContent.id)}
            >
              
              {/* Hero Image with Overlay */}
              {'article' in activeContent && activeContent.article?.thumbnail && (
                <>
                  <div className="absolute inset-0">
                    <Image 
                      src={activeContent.article.thumbnail} 
                      alt={activeContent.heading.title}
                      width={800}
                      height={500}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
                </>
              )}
              
              {/* Content Type Badge */}
              <div className="absolute top-6 left-6 z-20 flex items-center gap-2">
                {activeView !== 'all' && (
                  <div className="inline-flex items-center px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-medium uppercase rounded-full shadow-lg border border-white/10">
                    {viewOptions.find(v => v.value === activeView)?.icon}
                    <span className="ml-1">{activeView}</span>
                  </div>
                )}
                {((activeContent as Belief).category || activeContent.signals?.category?.name) && (
                  <div className="inline-flex items-center px-3 py-1.5 bg-veritas-primary/80 dark:bg-veritas-light-blue/80 backdrop-blur-sm text-white dark:text-veritas-darker-blue text-xs font-medium uppercase rounded-full shadow-lg border border-veritas-primary/20 dark:border-veritas-light-blue/20">
                    {((activeContent as Belief).category || activeContent.signals?.category?.name || '').toUpperCase()}
                  </div>
                )}
              </div>

              {/* Hero Content */}
              <div className="relative z-10 h-full flex flex-col justify-end p-8 text-white">
                
                {/* Title */}
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4 drop-shadow-lg">
                  {activeContent.heading.title}
                </h1>
                
                {/* Context/Subtitle */}
                {activeContent.heading.context && (
                  <p className="text-lg md:text-xl text-white/90 leading-relaxed mb-4 drop-shadow">
                    {activeContent.heading.context}
                  </p>
                )}
                
                {/* Type-specific content preview */}
                {'article' in activeContent && activeContent.article?.excerpt && (
                  <p className="text-base md:text-lg text-white/80 leading-relaxed mb-6 line-clamp-2 drop-shadow">
                    {activeContent.article.excerpt}
                  </p>
                )}
                {'description' in activeContent && activeContent.description && (
                  <p className="text-base md:text-lg text-white/80 leading-relaxed mb-6 line-clamp-2 drop-shadow">
                    {activeContent.description}
                  </p>
                )}
                {'question' in activeContent && activeContent.question && (
                  <p className="text-base md:text-lg text-white/80 leading-relaxed mb-6 line-clamp-2 drop-shadow">
                    {activeContent.question}
                  </p>
                )}
                
                {/* Signal Scores */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  {activeContent.signals?.truth && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-sm font-medium text-white">
                        Truth: {activeContent.signals.truth.currentValue || 0}%
                      </span>
                    </div>
                  )}
                  {activeContent.signals?.relevance && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      <span className="text-sm font-medium text-white">
                        Relevance: {activeContent.signals.relevance.currentValue || 0}%
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Read More CTA */}
                <div className="text-sm text-white/70 font-medium">
                  Click to explore full analysis →
                </div>
              </div>
              
              {/* Navigation Controls */}
              {currentViewContent.length > 1 && (
                <button 
                  onClick={handleNextContent}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-200 shadow-lg"
                  aria-label="Next content"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              )}
            </div>
            
            {/* Small Grid - Right Side */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-veritas-primary dark:text-veritas-eggshell mb-4">
                Top {activeView === 'all' ? 'Featured' : activeView.charAt(0).toUpperCase() + activeView.slice(1)} Insights
              </h3>
              
              {/* Display all items in current view */}
              {currentViewContent.map((content, index) => (
                <div 
                  key={content.id}
                  className={`
                    cursor-pointer transition-all duration-300 rounded-xl 
                    hover:transform hover:scale-[1.02] hover:shadow-lg
                    ${index === activeIndex ? 'ring-2 ring-veritas-blue ring-opacity-50' : ''}
                  `}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Set as active or navigate
                    if (index === activeIndex) {
                      onContentClick(content.id);
                    } else {
                      setActiveIndex(index);
                    }
                  }}
                >
                  <ContentCard 
                    content={content} 
                    variant="compact"
                    onClick={onContentClick}
                  />
                </div>
              ))}
              
              {/* Fill empty slots if needed */}
              {currentViewContent.length < 3 && (
                <div className="space-y-4">
                  {Array.from({ length: 3 - currentViewContent.length }).map((_, index) => (
                    <div 
                      key={`empty-${index}`}
                      className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700"
                    >
                      <p className="text-xs text-gray-400">
                        {activeView === 'all' ? 'No more content' : `No more ${activeView} content`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Content Dots Indicator */}
        {currentViewContent.length > 1 && (
          <div className="flex justify-center mt-8 gap-2">
            {currentViewContent.map((_, index) => (
              <button
                key={`dot-${index}`}
                onClick={() => setActiveIndex(index)}
                className={`
                  w-2 h-2 rounded-full transition-all duration-300
                  ${index === activeIndex 
                    ? 'bg-veritas-primary dark:bg-veritas-eggshell w-8 shadow-lg' 
                    : 'bg-gray-300 dark:bg-veritas-eggshell/30 hover:bg-gray-400 dark:hover:bg-veritas-eggshell/50'
                  }
                `}
                aria-label={`View content ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};