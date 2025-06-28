import { Belief, ComponentVariant } from '@/types/belief.types';

interface ChartComponentProps {
  belief: Belief;
  variant: ComponentVariant;
  isEditable?: boolean;
  onEdit?: () => void;
}

export const ChartComponent: React.FC<ChartComponentProps> = ({
  belief,
  variant,
  isEditable = false,
  onEdit
}) => {
  const chartHeight = variant === 'card' ? 'h-32' : 'h-64';

  return (
    <div 
      className={`chart-component ${isEditable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors duration-200' : ''} my-4`}
      onClick={isEditable ? onEdit : undefined}
    >
      <div className={`bg-slate-100 dark:bg-slate-800 rounded-lg ${chartHeight} flex items-center justify-center border border-slate-200 dark:border-slate-700`}>
        <p className="text-slate-500 dark:text-slate-400">Chart Placeholder</p>
      </div>
    </div>
  );
};
