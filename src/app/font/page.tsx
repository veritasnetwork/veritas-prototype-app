'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import { Inter, IBM_Plex_Sans, Roboto, Source_Sans_3, Open_Sans, Lato, Work_Sans, Merriweather, Lora } from 'next/font/google';
import beliefsData from '@/data/beliefs.json';

// Font instances
const inter = Inter({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap'
});

const ibmPlexSans = IBM_Plex_Sans({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap'
});

const roboto = Roboto({ 
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap'
});

const sourceSans3 = Source_Sans_3({ 
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap'
});

const openSans = Open_Sans({ 
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap'
});

const lato = Lato({ 
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap'
});

const workSans = Work_Sans({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap'
});

const merriweather = Merriweather({ 
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap'
});

const lora = Lora({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap'
});

// Font configurations with descriptions
const fonts = [
  { 
    name: 'Inter', 
    className: inter.className,
    description: 'A modern sans-serif designed specifically for screens with excellent readability at all sizes. Features a high x-height for better legibility and is widely used by modern tech platforms including GitHub, Notion, and Linear for its exceptional clarity.',
    pros: 'Reduces cognitive load • Open source • Optimized for screens • Professional yet approachable'
  },
  { 
    name: 'IBM Plex Sans', 
    className: ibmPlexSans.className,
    description: 'Created by IBM to convey clarity and precision with even spacing. Designed for both display and body text, offering a professional aesthetic that maintains readability across all weights.',
    pros: 'Excellent readability • Multiple weights • Trusted by enterprise • Strong technical credibility'
  },
  { 
    name: 'Roboto', 
    className: roboto.className,
    description: 'Google\'s system font, known for its minimalistic design and extensive testing across billions of users. Easily readable across any screen size and the default font for Android and many Google products.',
    pros: 'Proven at scale • Minimalist design • Wide language support • Familiar to users'
  },
  { 
    name: 'Source Sans 3', 
    className: sourceSans3.className,
    description: 'Adobe\'s first open-source typeface, specifically designed for user interfaces. Its clean and neutral appearance makes it excellent for data-heavy content without drawing attention away from the information.',
    pros: 'UI optimized • Clean aesthetic • Adobe quality • Great for data visualization'
  },
  { 
    name: 'Open Sans', 
    className: openSans.className,
    description: 'One of the most popular web fonts, used by millions of websites. Commissioned by Google and optimized for print, web, and mobile interfaces with excellent legibility.',
    pros: 'Highly versatile • Neutral appearance • Extensive testing • Used by Mozilla and WordPress'
  },
  { 
    name: 'Lato', 
    className: lato.className,
    description: 'Meaning "summer" in Polish, Lato brings warmth while maintaining professional clarity. Used by over 10 million websites for its semi-rounded details that give a feeling of warmth while maintaining strong readability.',
    pros: 'Humanist qualities • Warm yet professional • Popular choice • Good for extended reading'
  },
  { 
    name: 'Work Sans', 
    className: workSans.className,
    description: 'Based on early Grotesques, optimized for on-screen text usage. Features a wide range of weights and was designed to work well at both display and text sizes.',
    pros: 'Versatile weights • Modern interpretation • Good screen optimization • Clean geometry'
  },
  { 
    name: 'Georgia', 
    className: '', 
    style: { fontFamily: 'Georgia, serif' },
    description: 'The New York Times switched to Georgia from Times New Roman for being "clearer and more legible." Designed specifically for screen compatibility and pre-installed on all major operating systems.',
    pros: 'NYTimes proven • Designed for screens • Serif authority • Excellent for long-form reading'
  },
  { 
    name: 'Merriweather', 
    className: merriweather.className,
    description: 'Designed to be a text face that is pleasant to read on screens. Features a large x-height, wider characters, and emphatic serifs that aid reading at smaller sizes.',
    pros: 'Screen-optimized serif • High readability • Good for articles • Professional gravitas'
  },
  { 
    name: 'Lora', 
    className: lora.className,
    description: 'A well-balanced contemporary serif with roots in calligraphy. Optimized for screen reading while conveying a sense of elegance and credibility often associated with traditional journalism.',
    pros: 'Modern serif • Calligraphic roots • Elegant appearance • Good contrast'
  },
];

// Simple BeliefCard replica for the Featured Insights section
interface BeliefCardCompactProps {
  belief: {
    id: string;
    heading: {
      title: string;
      subtitle?: string;
    };
    article?: {
      thumbnail?: string;
    };
    objectRankingScores: {
      truth: number;
      relevance: number;
    };
    category?: string;
  };
  onClick: (id: string) => void;
  fontClassName: string;
  fontStyle?: React.CSSProperties;
}

const BeliefCardCompact = ({ belief, onClick, fontClassName, fontStyle }: BeliefCardCompactProps) => {
  
  return (
    <div 
      className={`w-full h-36 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 dark:border-gray-700 cursor-pointer group relative overflow-hidden p-3 ${fontClassName}`}
      style={fontStyle}
      onClick={() => onClick(belief.id)}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0">
          {belief.article?.thumbnail ? (
            <Image 
              src={belief.article.thumbnail}
              alt={belief.heading.title}
              width={48}
              height={48}
              className="w-12 h-12 object-cover rounded-lg border-2 border-gray-100 dark:border-gray-700"
              unoptimized
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gray-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {belief.category?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-veritas-primary dark:text-veritas-eggshell text-sm line-clamp-2">
            {belief.heading.title}
          </h3>
          {belief.heading.subtitle && (
            <p className="text-veritas-primary/70 dark:text-veritas-eggshell/70 mt-1 text-sm line-clamp-1">
              {belief.heading.subtitle}
            </p>
          )}
        </div>
      </div>
      
      <div className="mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="font-bold text-green-600 dark:text-green-400 text-sm">
              {belief.objectRankingScores.truth}%
            </div>
            <div className="text-veritas-primary dark:text-veritas-eggshell text-xs">
              Truth
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="font-bold text-blue-600 dark:text-blue-400 text-sm">
              {belief.objectRankingScores.relevance}%
            </div>
            <div className="text-veritas-primary dark:text-veritas-eggshell text-xs">
              Relevance
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// PremierHeader replica component
const PremierHeaderReplica = ({ fontClassName, fontStyle }: { fontClassName: string, fontStyle?: React.CSSProperties }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const premierBeliefs = beliefsData.filter(b => b.isPremier).slice(0, 4);
  
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
    <div className={`w-full bg-white dark:bg-veritas-darker-blue shadow-sm ${fontClassName}`} style={fontStyle}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[500px]">
          
          {/* Hero Card - Left Side */}
          <div className="lg:col-span-2 relative group cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-veritas-dark-blue via-veritas-darker-blue to-veritas-dark-blue shadow-2xl">
            
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
            
            {/* Category Badge */}
            {activeBelief.category && (
              <div className="absolute top-6 left-6 z-20 inline-flex items-center px-4 py-2 bg-veritas-primary dark:bg-veritas-light-blue backdrop-blur-sm text-white dark:text-veritas-darker-blue text-sm font-medium font-mono uppercase rounded-full shadow-lg border border-veritas-primary/20 dark:border-veritas-light-blue/20">
                {activeBelief.category.toUpperCase()}
              </div>
            )}

            {/* Hero Content */}
            <div className="relative z-10 h-full flex flex-col justify-end p-8 text-veritas-eggshell">
              
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4 drop-shadow-lg text-veritas-eggshell">
                {activeBelief.heading.title}
              </h1>
              
              {activeBelief.heading.context && (
                <p className="text-xl text-veritas-eggshell/90 leading-relaxed mb-4 drop-shadow">
                  {activeBelief.heading.context}
                </p>
              )}
              
              {activeBelief.article?.excerpt && (
                <p className="text-lg text-veritas-eggshell/80 leading-relaxed mb-6 line-clamp-2 drop-shadow">
                  {activeBelief.article.excerpt}
                </p>
              )}
              
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-sm font-medium text-veritas-eggshell">
                    Truth Score: {activeBelief.objectRankingScores.truth}%
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-sm font-medium text-veritas-eggshell">
                    Relevance: {activeBelief.objectRankingScores.relevance}%
                  </span>
                </div>
              </div>
              
              <div className="text-sm text-veritas-eggshell/70 font-medium">
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
                className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-200 shadow-lg cursor-pointer"
              >
                <ChevronRight className="w-6 h-6 text-veritas-eggshell" />
              </button>
            )}
          </div>
          
          {/* Small Grid - Right Side */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-veritas-primary dark:text-veritas-eggshell mb-4">
              Featured Insights
            </h3>
            {premierBeliefs.slice(0, 3).map((belief) => (
              <div 
                key={belief.id}
                className="cursor-pointer transition-all duration-300 rounded-xl hover:transform hover:scale-[1.02] hover:shadow-lg"
              >
                <BeliefCardCompact 
                  belief={belief} 
                  onClick={() => {}}
                  fontClassName={fontClassName}
                  fontStyle={fontStyle}
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

export default function FontTestPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Font Sections */}
      <div className="pb-20">
        {fonts.map((font) => (
          <div key={font.name} className="mb-24">
            <div className="max-w-7xl mx-auto px-4 py-8">
              <div className="mb-8">
                <h2 className={`text-4xl font-bold mb-4 text-gray-900 ${font.className}`} style={font.style}>
                  {font.name}
                </h2>
                <p className="text-gray-700 text-base leading-relaxed mb-3 max-w-4xl">
                  {font.description}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Key Benefits:</span>
                  <span className="text-sm text-gray-600">{font.pros}</span>
                </div>
              </div>
            </div>
            <PremierHeaderReplica 
              fontClassName={font.className} 
              fontStyle={font.style}
            />
          </div>
        ))}
      </div>
    </div>
  );
}