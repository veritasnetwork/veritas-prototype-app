import { Belief, ComponentVariant } from '@/types/belief.types';

interface ArticleComponentProps {
  belief: Belief;
  variant: ComponentVariant;
  isEditable?: boolean;
  onEdit?: () => void;
}

export const ArticleComponent: React.FC<ArticleComponentProps> = ({
  belief,
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
        <h4 className="font-medium mb-2 text-slate-900 dark:text-slate-100">Related Article</h4>
        <p className="text-sm text-slate-600 dark:text-slate-300">Article content placeholder...</p>
      </div>
    </div>
  );
};
