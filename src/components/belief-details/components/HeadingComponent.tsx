import { Belief, ComponentVariant } from '@/types/belief.types';

interface HeadingData {
  title?: string;
  subtitle?: string;
}

interface HeadingComponentProps {
  belief: Belief;
  variant: ComponentVariant;
  theme?: 'light' | 'dark';
  isEditable?: boolean;
  onEdit?: () => void;
}

export const HeadingComponent: React.FC<HeadingComponentProps> = ({
  belief,
  variant,
  theme,
  isEditable = false,
  onEdit
}) => {
  // Read heading data from JSON components
  const headingData = belief.components?.heading?.currentVersion as HeadingData;
  const title = (headingData?.title as string) || belief.title;
  const subtitle = headingData?.subtitle as string;
  
  // Improved typography for different variants with theme-aware colors
  const headingClass = variant === 'card' 
    ? `text-base font-semibold leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900 dark:text-white'}` 
    : 'text-3xl font-bold mb-4 text-slate-900 dark:text-slate-100';

  const subtitleClass = variant === 'card'
    ? `text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600 dark:text-slate-300'}`
    : 'text-slate-500 dark:text-slate-400 mt-1 mb-2 text-lg';

  return (
    <div 
      className={`heading-component ${isEditable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors duration-200' : ''}`}
      onClick={isEditable ? onEdit : undefined}
    >
      <h2 className={headingClass}>
        {title}
      </h2>
      
      {variant === 'detail' && (
        <div>
          {subtitle && (
            <p className={subtitleClass}>{subtitle}</p>
          )}
          <p className="text-slate-600 dark:text-slate-300 mt-2">{belief.description}</p>
        </div>
      )}
      
      {variant === 'card' && subtitle && (
        <p className={`${subtitleClass} mt-1 line-clamp-2`}>
          {subtitle}
        </p>
      )}
    </div>
  );
};
