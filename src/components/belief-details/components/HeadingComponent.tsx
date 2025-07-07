import { HeadingComponentProps } from '@/types/component.types';

export const HeadingComponent: React.FC<HeadingComponentProps> = ({
  heading,
  variant,
  theme,
  isEditable = false,
  onEdit
}) => {
  const headingClass = variant === 'card' 
    ? `text-base font-semibold leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900 dark:text-white'}` 
    : 'text-3xl font-bold mb-4 text-slate-900 dark:text-slate-100';

  return (
    <div 
      className={`heading-component ${isEditable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors duration-200' : ''}`}
      onClick={isEditable ? onEdit : undefined}
    >
      <h2 className={headingClass}>
        {heading.title}
      </h2>
      
      {variant === 'detail' && (
        <div>
          {heading.context && (
            <p className="text-slate-500 dark:text-slate-400 mt-1 mb-2 text-lg">
              {heading.context}
            </p>
          )}
          {heading.subtitle && (
            <p className="text-slate-600 dark:text-slate-300 mt-2">{heading.subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
};
