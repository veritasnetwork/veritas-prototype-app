import { Belief, ComponentVariant } from '@/types/belief.types';

interface MetadataComponentProps {
  belief: Belief;
  variant: ComponentVariant;
  isEditable?: boolean;
  onEdit?: () => void;
}

export const MetadataComponent: React.FC<MetadataComponentProps> = ({
  belief,
  variant,
  isEditable = false,
  onEdit
}) => {
  return (
    <div 
      className={`metadata-component ${isEditable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors duration-200' : ''} mt-4`}
      onClick={isEditable ? onEdit : undefined}
    >
      <div className={`flex ${variant === 'card' ? 'justify-between text-sm' : 'flex-wrap gap-4'} text-slate-500 dark:text-slate-400`}>
        <span>Participants: {belief.participantCount}</span>
        <span>Stake: ${belief.totalStake.toLocaleString()}</span>
        <span>Consensus: {Math.round(belief.consensusLevel * 100)}%</span>
      </div>
    </div>
  );
};
