'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Belief } from '@/types/belief.types';
import { BeliefCard } from './BeliefCard';
import { ChevronRight } from 'lucide-react';

interface PremierHeaderProps {
  premierBeliefs: Belief[];
  onBeliefClick: (beliefId: string) => void;
}

export const PremierHeader: React.FC<PremierHeaderProps> = ({
  premierBeliefs,
  onBeliefClick
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-cycle through beliefs every 6 seconds
  useEffect(() => {
    if (premierBeliefs.length <= 1) return;
    
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % premierBeliefs.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [premierBeliefs.length]);

  if (!premierBeliefs.length) return null;

  const activeBelief = premierBeliefs[activeIndex];

  return (
    <div className="w-full bg-white dark:bg-veritas-darker-blue mb-12 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[500px]">
          
          {/* Hero Card - Left Side (2/3 width on desktop) */}
          <div className="lg:col-span-2 relative group cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-veritas-dark-blue via-veritas-darker-blue to-veritas-dark-blue shadow-2xl"
               onClick={() => onBeliefClick(activeBelief.id)}>
            
            {/* Hero Image with Overlay */}
            {activeBelief.article?.thumbnail && (
              <>
                <div className="absolute inset-0">
                  <Image 
                    src={activeBelief.article.thumbnail} 
                    alt={activeBelief.heading.title}
                    width={800}
                    height={500}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    unoptimized
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
              </>
            )}
            
            {/* Category Badge - Top Left Corner */}
            {activeBelief.category && (
              <div className="absolute top-6 left-6 z-20 inline-flex items-center px-4 py-2 bg-veritas-primary dark:bg-veritas-light-blue backdrop-blur-sm text-white dark:text-veritas-darker-blue text-sm font-medium uppercase rounded-full shadow-lg border border-veritas-primary/20 dark:border-veritas-light-blue/20">
                {activeBelief.category.toUpperCase()}
              </div>
            )}

            {/* Hero Content - Always white text since image background */}
            <div className="relative z-10 h-full flex flex-col justify-end p-8 text-white">
              
              {/* Title */}
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4 drop-shadow-lg text-white">
                {activeBelief.heading.title}
              </h1>
              
              {/* Context/Subtitle */}
              {activeBelief.heading.context && (
                <p className="text-xl text-white/90 leading-relaxed mb-4 drop-shadow">
                  {activeBelief.heading.context}
                </p>
              )}
              
              {/* Article Excerpt */}
              {activeBelief.article?.excerpt && (
                <p className="text-lg text-white/80 leading-relaxed mb-6 line-clamp-2 drop-shadow">
                  {activeBelief.article.excerpt}
                </p>
              )}
              
              {/* Truth Score Badges */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-sm font-medium text-white">
                    Truth Score: {activeBelief.objectRankingScores.truth}%
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-sm font-medium text-white">
                    Relevance: {activeBelief.objectRankingScores.relevance}%
                  </span>
                </div>
              </div>
              
              {/* Read More CTA */}
              <div className="text-sm text-white/70 font-medium">
                Click to explore full analysis →
              </div>
            </div>
            
            {/* Navigation Controls */}
            {premierBeliefs.length > 1 && (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveIndex((prev) => (prev + 1) % premierBeliefs.length);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-200 shadow-lg cursor-pointer"
                style={{ pointerEvents: 'auto' }}
              >
                <ChevronRight className="w-6 h-6 pointer-events-none text-white" />
              </button>
            )}
          </div>
          
          {/* Small Grid - Right Side (1/3 width on desktop) */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-veritas-primary dark:text-veritas-eggshell mb-4">
              Featured Insights
            </h3>
            {premierBeliefs.slice(0, 3).map((belief) => (
              <div 
                key={belief.id}
                className="cursor-pointer transition-all duration-300 rounded-xl hover:transform hover:scale-[1.02] hover:shadow-lg"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onBeliefClick(belief.id);
                }}
              >
                <BeliefCard 
                  belief={belief} 
                  variant="compact"
                  onClick={(beliefId: string) => onBeliefClick(beliefId)}
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* Dots Indicator */}
        {premierBeliefs.length > 1 && (
          <div className="flex justify-center mt-6 gap-2">
            {premierBeliefs.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === activeIndex 
                    ? 'bg-veritas-primary dark:bg-veritas-eggshell scale-110 shadow-lg' 
                    : 'bg-gray-300 dark:bg-veritas-eggshell/30 hover:bg-gray-400 dark:hover:bg-veritas-eggshell/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 