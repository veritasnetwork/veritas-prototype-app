import { ArticleComponentProps } from '@/types/component.types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
          
          <div className="prose prose-slate dark:prose-invert max-w-none 
                      prose-headings:text-veritas-primary dark:prose-headings:text-veritas-eggshell
                      prose-p:text-veritas-primary/80 dark:prose-p:text-veritas-eggshell/80
                      prose-strong:text-veritas-primary dark:prose-strong:text-veritas-eggshell
                      prose-ul:text-veritas-primary/80 dark:prose-ul:text-veritas-eggshell/80
                      prose-ol:text-veritas-primary/80 dark:prose-ol:text-veritas-eggshell/80
                      prose-li:text-veritas-primary/80 dark:prose-li:text-veritas-eggshell/80
                      prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-4
                      prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3
                      prose-p:leading-relaxed prose-p:text-base
                      prose-li:my-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
