import { Belief, ComponentVariant } from '@/types/belief.types';
import Image from 'next/image';

interface ArticleData {
  headline?: string;
  thumbnail?: string;
  excerpt?: string;
  source?: string;
}

interface ArticleComponentProps {
  belief: Belief;
  variant: ComponentVariant;
  isEditable?: boolean;
  onEdit?: () => void;
}

export const ArticleComponent: React.FC<ArticleComponentProps> = ({
  belief,
  isEditable = false,
  onEdit
}) => {
  // Read article data from JSON
  const articleData = (belief.components?.article?.currentVersion as ArticleData);
  
  // Don't render if no article data
  if (!articleData || (!articleData.headline && !articleData.thumbnail)) {
    return null;
  }

  const thumbnail = articleData.thumbnail;
  const headline = articleData.headline;
  const excerpt = articleData.excerpt;
  const source = articleData.source;

  return (
    <div 
      className={`article-component ${isEditable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors duration-200' : ''} my-4`}
      onClick={isEditable ? onEdit : undefined}
    >
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        {/* Article content */}
        <div className="flex space-x-3">
          {thumbnail && (
            <Image
              src={thumbnail}
              alt=""
              width={64}
              height={64}
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              onError={(e) => {
                // Hide image if it fails to load
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            {headline && (
              <h4 className="font-medium mb-2 text-slate-900 dark:text-slate-100 line-clamp-2">
                {headline}
              </h4>
            )}
            {excerpt && (
              <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 mb-2">
                {excerpt}
              </p>
            )}
            {source && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Source: {source}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
