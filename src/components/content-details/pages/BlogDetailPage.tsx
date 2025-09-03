'use client';

import { useState, useEffect, useRef } from 'react';
import { BlogContent } from '@/types/content.types';
import { ArticleComponent } from '../components/ArticleComponent';
import { RelevanceSignals } from '../RelevanceSignals';
import { getRelatedContent } from '@/lib/data';
import { 
  ArrowLeft, 
  Clock, 
  BookOpen,
  ExternalLink,
  Share2,
  List,
  Calendar,
  Hash,
  Bookmark,
  Twitter,
  Linkedin,
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
  const contentRef = useRef<HTMLDivElement>(null);

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
    // This is a simplified version - in production, you'd parse markdown/HTML properly
    const lines = text.split('\n');
    const headings: TableOfContentsItem[] = [];
    
    lines.forEach((line, index) => {
      if (line.startsWith('## ')) {
        headings.push({
          id: `section-${index}`,
          text: line.replace('## ', ''),
          level: 2
        });
      } else if (line.startsWith('### ')) {
        headings.push({
          id: `section-${index}`,
          text: line.replace('### ', ''),
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
      {/* Header */}
      <div className="bg-slate-50 dark:bg-veritas-darker-blue pt-20 md:pt-4">
        <div className="container mx-auto px-4 py-3 max-w-7xl">
          <button 
            onClick={onBack}
            className="flex items-center space-x-2 text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70 hover:text-veritas-primary dark:hover:text-veritas-eggshell transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Feed</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Article Content - 3 columns */}
          <div className="lg:col-span-3">
            
            {/* Hero Section */}
            <div className="relative w-full h-64 md:h-80 lg:h-96 rounded-2xl overflow-hidden mb-8 shadow-lg">
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <div className="inline-block px-3 py-1 bg-black/50 backdrop-blur-sm text-xs uppercase tracking-wide font-medium mb-3 rounded">
                  {content.category}
                </div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight drop-shadow-lg mb-3">
                  {content.heading.title}
                </h1>
                {content.heading.subtitle && (
                  <p className="text-lg text-gray-200 drop-shadow">
                    {content.heading.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Enhanced Author Section */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 mb-8 border border-slate-200 dark:border-veritas-eggshell/10">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-bold text-white">
                    {content.author.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {content.author}
                      </h2>
                      {content.authorBio && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {content.authorBio}
                        </p>
                      )}
                    </div>
                    <button className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      Follow
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(content.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{content.readingTime} min read</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      <span>{content.wordCount.toLocaleString()} words</span>
                    </div>
                  </div>
                  
                  {/* Share buttons */}
                  <div className="flex items-center gap-2 mt-4">
                    <button 
                      onClick={() => handleShare('twitter')}
                      className="p-2 text-gray-500 hover:text-veritas-primary dark:hover:text-veritas-light-blue transition-colors"
                      title="Share on Twitter"
                    >
                      <Twitter className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleShare('linkedin')}
                      className="p-2 text-gray-500 hover:text-veritas-primary dark:hover:text-veritas-light-blue transition-colors"
                      title="Share on LinkedIn"
                    >
                      <Linkedin className="h-4 w-4" />
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

            {/* Article Content with Enhanced Typography */}
            <article 
              ref={contentRef}
              className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-8 lg:p-12 mb-6 border border-slate-200 dark:border-veritas-eggshell/10"
            >
              {/* Article styling for optimal reading */}
              <div className="prose prose-lg dark:prose-invert max-w-none">
                <style jsx>{`
                  .prose {
                    font-family: 'Georgia', 'Cambria', serif;
                    line-height: 1.8;
                  }
                  .prose h2 {
                    margin-top: 3rem;
                    margin-bottom: 1.5rem;
                    font-weight: 700;
                  }
                  .prose h3 {
                    margin-top: 2rem;
                    margin-bottom: 1rem;
                    font-weight: 600;
                  }
                  .prose p {
                    margin-bottom: 1.5rem;
                    color: rgba(0, 0, 0, 0.8);
                  }
                  .dark .prose p {
                    color: rgba(255, 255, 255, 0.85);
                  }
                  .prose blockquote {
                    border-left: 4px solid #3B82F6;
                    padding-left: 1.5rem;
                    font-style: italic;
                  }
                  .prose code {
                    background: rgba(59, 130, 246, 0.1);
                    padding: 0.2rem 0.4rem;
                    border-radius: 0.25rem;
                  }
                `}</style>
                <ArticleComponent 
                  article={content.article} 
                  variant="detail" 
                  isEditable={false}
                  onEdit={() => {}}
                />
              </div>
            </article>

            {/* Citations */}
            {content.citations && content.citations.length > 0 && (
              <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 mb-6 border border-slate-200 dark:border-veritas-eggshell/10">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  References & Citations
                </h3>
                <div className="space-y-3">
                  {content.citations.map((citation, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <span className="text-sm text-gray-500">[{index + 1}]</span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          &quot;{citation.text}&quot;
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">— {citation.source}</span>
                          {citation.url && (
                            <a 
                              href={citation.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-veritas-blue hover:text-veritas-dark-blue transition-colors"
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

          {/* Sidebar - 1 column */}
          <div className="lg:col-span-1 space-y-4">
            {/* Sticky container for desktop */}
            <div className="lg:sticky lg:top-24">
              {/* Table of Contents */}
              {showToC && tableOfContents.length > 0 && (
                <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 mb-4 border border-slate-200 dark:border-veritas-eggshell/10">
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <List className="h-4 w-4" />
                    Table of Contents
                  </h3>
                  <nav className="space-y-2">
                    {tableOfContents.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          const element = document.getElementById(item.id);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }}
                        className={`block w-full text-left text-sm transition-all duration-200 ${
                          item.level === 3 ? 'ml-4' : ''
                        } ${
                          activeSection === item.id
                            ? 'text-veritas-blue font-medium border-l-2 border-veritas-blue pl-2 -ml-0.5'
                            : 'text-gray-600 dark:text-gray-400 hover:text-veritas-blue hover:pl-2 hover:-ml-0.5'
                        }`}
                      >
                        {item.text}
                      </button>
                    ))}
                  </nav>
                </div>
              )}
              
              {/* Reading Stats */}
              <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 mb-4 border border-slate-200 dark:border-veritas-eggshell/10">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">
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
              
              {/* Tags */}
              <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 mb-4 border border-slate-200 dark:border-veritas-eggshell/10">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {content.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400 rounded-full hover:bg-veritas-blue/10 hover:text-veritas-blue transition-colors cursor-pointer"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Related Posts */}
              {content.relatedPosts && content.relatedPosts.length > 0 && (
                <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 border border-slate-200 dark:border-veritas-eggshell/10">
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <Bookmark className="h-4 w-4" />
                    Related Articles
                  </h3>
                  <div className="space-y-3">
                    {getRelatedContent(content.id, 3).map((relatedContent) => (
                      <div 
                        key={relatedContent.id}
                        className="group cursor-pointer"
                      >
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-veritas-blue transition-colors line-clamp-2">
                          {relatedContent.heading.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {'readingTime' in relatedContent ? `${(relatedContent as BlogContent).readingTime} min read` : 'Article'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Full Width Sections */}
          <div className="lg:col-span-4">
            {/* Relevance Signals - Consistent across all content types */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <RelevanceSignals belief={content} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};