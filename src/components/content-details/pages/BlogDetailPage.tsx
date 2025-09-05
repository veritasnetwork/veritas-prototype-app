'use client';

import { useState, useEffect } from 'react';
import { BlogContent } from '@/types/content.types';
import { ArticleComponent } from '../components/ArticleComponent';
import { RelevanceSignals } from '../RelevanceSignals';
import { 
  ArrowLeft, 
  Clock, 
  BookOpen,
  ExternalLink,
  Share2,
  List,
  Calendar,
  Hash,
  Copy,
  CheckCircle
} from 'lucide-react';
import Image from 'next/image';

interface BlogDetailPageProps {
  content: BlogContent;
  onBack: () => void;
}

interface TableOfContentsItem {
  id: string;
  text: string;
  level: number;
}

export const BlogDetailPage: React.FC<BlogDetailPageProps> = ({
  content,
  onBack
}) => {
  const [activeSection, setActiveSection] = useState<string>('');
  const [tableOfContents, setTableOfContents] = useState<TableOfContentsItem[]>([]);
  const [showToC, setShowToC] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Generate table of contents from article content
    if (content.article.content) {
      const headings = extractHeadings(content.article.content);
      setTableOfContents(headings);
      setShowToC(headings.length > 3); // Only show ToC if there are enough sections
    }
  }, [content]);

  // Set up scroll tracking for active section
  useEffect(() => {
    if (!showToC || tableOfContents.length === 0) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100; // Add offset for header
      
      // Find the current active section
      let currentSection = '';
      for (const section of tableOfContents) {
        const element = document.getElementById(section.id);
        if (element && element.offsetTop <= scrollPosition) {
          currentSection = section.id;
        }
      }
      
      if (currentSection !== activeSection) {
        setActiveSection(currentSection);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial position
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [tableOfContents, activeSection, showToC]);

  // Extract headings from article content for table of contents
  const extractHeadings = (text: string): TableOfContentsItem[] => {
    const lines = text.split('\n');
    const headings: TableOfContentsItem[] = [];
    
    lines.forEach((line) => {
      if (line.startsWith('## ')) {
        const headingText = line.replace('## ', '').trim();
        // Generate slug the same way rehype-slug does
        const id = headingText.toLowerCase()
          .replace(/[^\w\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .trim();
        headings.push({
          id,
          text: headingText,
          level: 2
        });
      } else if (line.startsWith('### ')) {
        const headingText = line.replace('### ', '').trim();
        const id = headingText.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
        headings.push({
          id,
          text: headingText,
          level: 3
        });
      }
    });
    
    return headings;
  };

  // Handle share functionality
  const handleShare = async (platform?: string) => {
    const url = window.location.href;
    const title = content.heading.title;
    
    if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'linkedin') {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'copy') {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (navigator.share) {
      navigator.share({
        title,
        text: content.heading.subtitle || '',
        url
      });
    }
  };



  // Get placeholder image or use article thumbnail
  const getImageSrc = () => {
    if (content.article.thumbnail) {
      return content.article.thumbnail;
    }
    // Generate gradient based on category
    const categoryGradients: { [key: string]: string } = {
      'Analysis': 'from-blue-500 to-purple-600',
      'Technical': 'from-green-500 to-teal-600',
      'Market': 'from-orange-500 to-red-600',
      'Opinion': 'from-purple-500 to-pink-600',
      'default': 'from-gray-500 to-gray-700'
    };
    return categoryGradients[content.category] || categoryGradients.default;
  };

  const imageSrc = getImageSrc();
  const isGradient = !content.article.thumbnail;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-veritas-darker-blue">
      {/* Header - Mobile optimized */}
      <div className="bg-slate-50 dark:bg-veritas-darker-blue pt-16 md:pt-4">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 max-w-7xl">
          <button 
            onClick={onBack}
            className="flex items-center space-x-2 text-xs sm:text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70 hover:text-veritas-primary dark:hover:text-veritas-eggshell transition-colors"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>Back to Feed</span>
          </button>
        </div>
      </div>

      {/* Main Content - Mobile optimized */}
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          
          {/* Main Article Content - 3 columns */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            
            {/* Hero Section - Mobile optimized */}
            <div className="relative w-full h-48 sm:h-64 md:h-80 lg:h-96 rounded-xl sm:rounded-2xl overflow-hidden mb-4 sm:mb-6 lg:mb-8 shadow-lg">
              {isGradient ? (
                <div className={`absolute inset-0 bg-gradient-to-br ${imageSrc}`} />
              ) : (
                <Image 
                  src={imageSrc}
                  alt={content.heading.title}
                  fill
                  className="object-cover"
                  priority
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              <div className="absolute bottom-3 sm:bottom-6 left-3 sm:left-6 right-3 sm:right-6 text-white">
                <div className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 bg-black/50 backdrop-blur-sm text-[10px] sm:text-xs uppercase tracking-wide font-medium mb-2 sm:mb-3 rounded">
                  {content.category}
                </div>
                <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold leading-tight drop-shadow-lg mb-1 sm:mb-3">
                  {content.heading.title}
                </h1>
                {content.heading.subtitle && (
                  <p className="text-xs sm:text-base lg:text-lg text-gray-200 drop-shadow line-clamp-2 sm:line-clamp-none">
                    {content.heading.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Enhanced Author Section - Mobile optimized */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 lg:mb-8 border border-slate-200 dark:border-veritas-eggshell/10">
              <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg sm:text-2xl font-bold text-white">
                    {content.author.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 w-full">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex-1">
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                        {content.author}
                      </h2>
                      {content.authorBio && (
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {content.authorBio}
                        </p>
                      )}
                    </div>
                    <button className="self-start px-3 py-1 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      Follow
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 text-xs sm:text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">{new Date(content.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                      <span className="sm:hidden">{new Date(content.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>{content.readingTime} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>{content.wordCount.toLocaleString()} words</span>
                    </div>
                  </div>
                  
                  {/* Share buttons */}
                  <div className="flex items-center gap-2 mt-4">
                    <button 
                      onClick={() => handleShare('twitter')}
                      className="p-2 text-gray-500 hover:text-veritas-primary dark:hover:text-veritas-light-blue transition-colors"
                      title="Share on X (Twitter)"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </button>
                    <button 
                      onClick={() => handleShare('linkedin')}
                      className="p-2 text-gray-500 hover:text-veritas-primary dark:hover:text-veritas-light-blue transition-colors"
                      title="Share on LinkedIn"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </button>
                    <button 
                      onClick={() => handleShare('copy')}
                      className="p-2 text-gray-500 hover:text-veritas-primary dark:hover:text-veritas-light-blue transition-colors"
                      title="Copy link"
                    >
                      {copied ? <CheckCircle className="h-4 w-4 text-veritas-primary dark:text-veritas-light-blue" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <button 
                      onClick={() => handleShare()}
                      className="p-2 text-gray-500 hover:text-veritas-blue transition-colors"
                      title="Share"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Article Content - Mobile optimized */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 lg:p-12 mb-4 sm:mb-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <ArticleComponent 
                article={content.article} 
                variant="detail" 
                isEditable={false}
                onEdit={() => {}}
              />
            </div>

            {/* Citations - Mobile optimized */}
            {content.citations && content.citations.length > 0 && (
              <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 border border-slate-200 dark:border-veritas-eggshell/10">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                  References & Citations
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  {content.citations.map((citation, index) => (
                    <div key={index} className="flex items-start gap-2 sm:gap-3">
                      <span className="text-xs sm:text-sm text-gray-500 mt-0.5">[{index + 1}]</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 break-words">
                          &quot;{citation.text}&quot;
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] sm:text-xs text-gray-500 truncate">— {citation.source}</span>
                          {citation.url && (
                            <a 
                              href={citation.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-veritas-blue hover:text-veritas-dark-blue transition-colors flex-shrink-0"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Sidebar - Mobile: Above content, Desktop: Sticky sidebar */}
          <div className="lg:col-span-1 order-1 lg:order-2 space-y-3 sm:space-y-4">
            {/* Mobile: Show ToC at top, Desktop: Sticky sidebar */}
            <div className="lg:sticky lg:top-24">
              {/* Table of Contents - Mobile optimized */}
              {showToC && tableOfContents.length > 0 && (
                <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 border border-slate-200 dark:border-veritas-eggshell/10">
                  <h3 className="text-sm font-semibold text-veritas-primary dark:text-veritas-eggshell mb-3 flex items-center gap-2">
                    <List className="h-4 w-4 text-veritas-primary/60 dark:text-veritas-eggshell/60" />
                    Table of Contents
                  </h3>
                  <nav className="space-y-1">
                    {tableOfContents.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          const element = document.getElementById(item.id);
                          if (element) {
                            const offset = 80; // Account for sticky header
                            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
                            window.scrollTo({
                              top: elementPosition - offset,
                              behavior: 'smooth'
                            });
                          }
                        }}
                        className={`block w-full text-left text-sm transition-all duration-200 py-1.5 ${
                          item.level === 3 ? 'ml-4 text-xs' : ''
                        } ${
                          activeSection === item.id
                            ? 'text-veritas-orange dark:text-veritas-orange font-medium border-l-2 border-veritas-orange pl-3 -ml-0.5'
                            : 'text-gray-600 dark:text-gray-400 hover:text-veritas-primary dark:hover:text-veritas-eggshell pl-2.5 hover:pl-3 border-l-2 border-transparent'
                        }`}
                      >
                        {item.text}
                      </button>
                    ))}
                  </nav>
                </div>
              )}
              
              {/* Reading Stats - Mobile optimized - Hidden on small screens */}
              <div className="hidden sm:block bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 border border-slate-200 dark:border-veritas-eggshell/10">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 sm:mb-3">
                  Quick Stats
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Reading Time</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {content.readingTime} min
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Word Count</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {content.wordCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Category</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {content.category}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Tags - Mobile optimized */}
              <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-veritas-eggshell/10">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 sm:mb-3 flex items-center gap-2">
                  <Hash className="h-3 w-3 sm:h-4 sm:w-4" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {content.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 sm:px-3 py-0.5 sm:py-1 bg-gray-100 dark:bg-gray-700 text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 rounded-full hover:bg-veritas-blue/10 hover:text-veritas-blue transition-colors cursor-pointer"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Full Width Sections - Outside grid */}
        <div className="mt-6 lg:mt-8">
          {/* Relevance Signals - Consistent across all content types */}
          <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
            <RelevanceSignals belief={content} />
          </div>
        </div>
      </div>
    </div>
  );
};