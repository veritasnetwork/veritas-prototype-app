import { HeadingComponentProps } from '@/types/component.types';

export const HeadingComponent: React.FC<HeadingComponentProps> = ({
  heading,
  variant,
  theme,
  isEditable = false,
  onEdit
}) => {
  const headingClass = variant === 'card' 
    ? `text-base font-semibold leading-tight ${theme === 'dark' ? 'text-veritas-eggshell' : 'text-veritas-primary dark:text-veritas-eggshell'}` 
    : 'text-3xl font-bold mb-4 text-veritas-primary dark:text-veritas-eggshell';

  return (
    <div 
      className={`heading-component ${isEditable ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-veritas-eggshell/5 p-2 rounded-xl transition-colors duration-200' : ''}`}
      onClick={isEditable ? onEdit : undefined}
    >
      <h2 className={headingClass}>
        {heading.title}
      </h2>
      
      {variant === 'detail' && (
        <div>
          {heading.context && (
            <p className="text-veritas-primary/70 dark:text-veritas-eggshell/70 mt-2 text-lg leading-relaxed">
              {heading.context}
            </p>
          )}
          {heading.subtitle && (
            <p className="text-veritas-primary/70 dark:text-veritas-eggshell/80 mt-2">{heading.subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
};
