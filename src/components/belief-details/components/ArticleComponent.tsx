import { ArticleComponentProps } from '@/types/component.types';
import Image from 'next/image';

export const ArticleComponent: React.FC<ArticleComponentProps> = ({
  article,
  variant,
  isEditable = false,
  onEdit
}) => {
  return (
    <div 
      className={`article-component ${isEditable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors duration-200' : ''} my-4`}
      onClick={isEditable ? onEdit : undefined}
    >
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        {variant === 'card' ? (
          <div className="flex space-x-3">
            {article.thumbnail && (
              <Image
                src={article.thumbnail}
                alt=""
                width={64}
                height={64}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div className="flex-1 min-w-0">
              {article.headline && (
                <h4 className="font-medium mb-2 text-slate-900 dark:text-slate-100 line-clamp-2">
                  {article.headline}
                </h4>
              )}
              {article.excerpt && (
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
                  {article.excerpt}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {article.content}
              </p>
            </div>
            {article.sources && article.sources.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">SOURCES</h5>
                <div className="flex flex-wrap gap-2">
                  {article.sources.map((source, index) => (
                    <span key={index} className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {article.credibility && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">CREDIBILITY:</span>
                <span className={`text-xs font-medium px-2 py-1 rounded ${
                  article.credibility === 'high' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : article.credibility === 'medium'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {article.credibility.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
