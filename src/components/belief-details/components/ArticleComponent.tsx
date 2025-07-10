import { ArticleComponentProps } from '@/types/component.types';

export const ArticleComponent: React.FC<ArticleComponentProps> = ({
  article,
  variant,
  isEditable = false,
  onEdit
}) => {
  const isDetailView = variant === 'detail';

  return (
    <div 
      className={`article-component ${isEditable ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-xl transition-colors duration-200' : ''}`}
      onClick={isEditable ? onEdit : undefined}
    >
      {isDetailView ? (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-1 bg-amber-500 rounded-full"></div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Article</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
              {article.headline}
            </h3>
          </div>
          
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-lg">
              {article.content}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-500 dark:text-slate-400">
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
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
            {article.excerpt}
          </p>
        </div>
      )}
    </div>
  );
};
