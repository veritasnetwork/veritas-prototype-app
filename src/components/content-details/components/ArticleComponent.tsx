import { ArticleComponentProps } from '@/types/component.types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

export const ArticleComponent: React.FC<ArticleComponentProps> = ({
  article,
  variant,
  isEditable = false,
  onEdit
}) => {
  const isDetailView = variant === 'detail';

  return (
    <div 
      className={`article-component ${isEditable ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-veritas-eggshell/5 p-2 rounded-xl transition-colors duration-200' : ''}`}
      onClick={isEditable ? onEdit : undefined}
    >
      {isDetailView ? (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-1 bg-amber-500 rounded-full"></div>
              <span className="text-sm font-medium text-veritas-primary dark:text-veritas-eggshell">Article</span>
            </div>
            <h3 className="text-xl font-bold text-veritas-primary dark:text-veritas-eggshell mb-3">
              {article.headline}
            </h3>
          </div>
          
          <div className="prose prose-sm sm:prose-base lg:prose-lg prose-slate dark:prose-invert max-w-none 
                      prose-headings:text-veritas-primary dark:prose-headings:text-veritas-eggshell
                      prose-p:text-veritas-primary/90 dark:prose-p:text-veritas-eggshell/90
                      prose-p:leading-relaxed sm:prose-p:leading-[1.8] prose-p:mb-4 sm:prose-p:mb-6
                      prose-strong:text-veritas-primary dark:prose-strong:text-veritas-eggshell
                      prose-ul:text-veritas-primary/90 dark:prose-ul:text-veritas-eggshell/90
                      prose-ol:text-veritas-primary/90 dark:prose-ol:text-veritas-eggshell/90
                      prose-li:text-veritas-primary/90 dark:prose-li:text-veritas-eggshell/90
                      prose-h2:text-xl sm:prose-h2:text-2xl lg:prose-h2:text-3xl prose-h2:font-bold prose-h2:mt-8 sm:prose-h2:mt-12 prose-h2:mb-4 sm:prose-h2:mb-6 prose-h2:border-b prose-h2:border-slate-200 dark:prose-h2:border-slate-700 prose-h2:pb-2
                      prose-h3:text-lg sm:prose-h3:text-xl lg:prose-h3:text-2xl prose-h3:font-semibold prose-h3:mt-6 sm:prose-h3:mt-8 prose-h3:mb-3 sm:prose-h3:mb-4
                      prose-h4:text-base sm:prose-h4:text-lg lg:prose-h4:text-xl prose-h4:font-semibold prose-h4:mt-4 sm:prose-h4:mt-6 prose-h4:mb-2 sm:prose-h4:mb-3
                      prose-blockquote:border-l-4 prose-blockquote:border-veritas-orange prose-blockquote:pl-3 sm:prose-blockquote:pl-4 prose-blockquote:italic
                      prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1 sm:prose-code:px-2 prose-code:py-0.5 sm:prose-code:py-1 prose-code:rounded prose-code:text-xs sm:prose-code:text-sm">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[
                rehypeSlug,
                [rehypeAutolinkHeadings, { behavior: 'wrap' }]
              ]}
            >
              {article.content}
            </ReactMarkdown>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-veritas-eggshell/10">
            <div className="text-sm text-veritas-primary/60 dark:text-veritas-eggshell/60">
              Verified by Veritas Intelligence
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-1 bg-amber-500 rounded-full"></div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Article</span>
          </div>
          <p className="text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70 line-clamp-2">
            {article.excerpt}
          </p>
        </div>
      )}
    </div>
  );
};
