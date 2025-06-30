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
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 dark:text-green-400';
      case 'resolved':
        return 'text-blue-600 dark:text-blue-400';
      case 'closed':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getEntropyLevel = (entropy: number) => {
    if (entropy < 0.3) return 'High Consensus';
    if (entropy < 0.6) return 'Moderate Consensus';
    return 'Low Consensus';
  };

  // For card variant, show minimal metadata since key metrics are handled in BeliefCard
  if (variant === 'card') {
    return (
      <div 
        className={`metadata-component ${isEditable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors duration-200' : ''}`}
        onClick={isEditable ? onEdit : undefined}
      >
        {/* Only show additional metadata not covered by BeliefCard */}
        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
          <span>
            Created {formatDate(belief.createdAt)}
          </span>
          {belief.resolvedAt && (
            <span className="text-blue-600 dark:text-blue-400">
              Resolved {formatDate(belief.resolvedAt)}
            </span>
          )}
        </div>
      </div>
    );
  }

  // For detail variant, show full metadata
  return (
    <div 
      className={`metadata-component ${isEditable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors duration-200' : ''} mt-4`}
      onClick={isEditable ? onEdit : undefined}
    >
      <div className="flex flex-wrap gap-6 text-slate-500 dark:text-slate-400">
        {/* Core Veritas Metrics */}
        <div className="flex flex-col">
          <span className="font-medium">Participants</span>
          <span className="text-slate-900 dark:text-slate-100">{belief.participantCount?.toLocaleString()}</span>
        </div>
        
        <div className="flex flex-col">
          <span className="font-medium">Total Stake</span>
          <span className="text-slate-900 dark:text-slate-100">${belief.totalStake?.toLocaleString()}</span>
        </div>
        
        <div className="flex flex-col">
          <span className="font-medium">Consensus</span>
          <span className="text-slate-900 dark:text-slate-100">{Math.round((belief.consensusLevel || 0) * 100)}%</span>
        </div>

        <div className="flex flex-col">
          <span className="font-medium">Status</span>
          <span className={`capitalize ${getStatusColor(belief.status)}`}>
            {belief.status}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="font-medium">Information Quality</span>
          <span className="text-slate-900 dark:text-slate-100">
            {getEntropyLevel(belief.entropy || 0.5)}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="font-medium">Created</span>
          <span className="text-slate-900 dark:text-slate-100">
            {formatDate(belief.createdAt)}
          </span>
        </div>

        {belief.resolvedAt && (
          <div className="flex flex-col">
            <span className="font-medium">Resolved</span>
            <span className="text-slate-900 dark:text-slate-100">
              {formatDate(belief.resolvedAt)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
