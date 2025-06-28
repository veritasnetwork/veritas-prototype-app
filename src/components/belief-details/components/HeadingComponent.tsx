import { Belief, ComponentVariant } from '@/types/belief.types';

interface HeadingComponentProps {
  belief: Belief;
  variant: ComponentVariant;
  isEditable?: boolean;
  onEdit?: () => void;
}

export const HeadingComponent: React.FC<HeadingComponentProps> = ({
  belief,
  variant,
  isEditable = false,
  onEdit
}) => {
  const headingClass = variant === 'card' 
    ? 'text-lg font-semibold line-clamp-2 mb-2 text-slate-900 dark:text-slate-100' 
    : 'text-3xl font-bold mb-4 text-slate-900 dark:text-slate-100';

  return (
    <div 
      className={`heading-component ${isEditable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors duration-200' : ''}`}
      onClick={isEditable ? onEdit : undefined}
    >
      <h2 className={headingClass}>{belief.title}</h2>
      {variant === 'detail' && (
        <p className="text-slate-600 dark:text-slate-300 mt-2">{belief.description}</p>
      )}
    </div>
  );
};
