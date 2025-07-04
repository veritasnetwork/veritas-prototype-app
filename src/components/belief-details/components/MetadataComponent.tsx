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

  const getCredibilityColor = (credibility: string) => {
    switch (credibility) {
      case 'high':
        return 'text-green-600 dark:text-green-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'low':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
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
            {belief.createdAt ? `Created ${formatDate(belief.createdAt)}` : 'Recently created'}
          </span>
          <span className={`capitalize ${getCredibilityColor(belief.article.credibility)}`}>
            {belief.article.credibility} credibility
          </span>
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
        {/* Core Information Intelligence Metrics */}
        <div className="flex flex-col">
          <span className="font-medium">Truth Score</span>
          <span className="text-slate-900 dark:text-slate-100">{belief.objectRankingScores.truth}%</span>
        </div>
        
        <div className="flex flex-col">
          <span className="font-medium">Relevance Score</span>
          <span className="text-slate-900 dark:text-slate-100">{belief.objectRankingScores.relevance}%</span>
        </div>
        
        <div className="flex flex-col">
          <span className="font-medium">Informativeness Score</span>
          <span className="text-slate-900 dark:text-slate-100">{belief.objectRankingScores.informativeness}%</span>
        </div>

        <div className="flex flex-col">
          <span className="font-medium">Article Credibility</span>
          <span className={`capitalize ${getCredibilityColor(belief.article.credibility)}`}>
            {belief.article.credibility}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="font-medium">Article Sources</span>
          <span className="text-slate-900 dark:text-slate-100">
            {belief.article.sources?.length || 0}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="font-medium">Available Charts</span>
          <span className="text-slate-900 dark:text-slate-100">
            {belief.charts.length}
          </span>
        </div>

        {belief.status && (
          <div className="flex flex-col">
            <span className="font-medium">Status</span>
            <span className={`capitalize ${getStatusColor(belief.status)}`}>
              {belief.status}
            </span>
          </div>
        )}

        {belief.createdAt && (
          <div className="flex flex-col">
            <span className="font-medium">Created</span>
            <span className="text-slate-900 dark:text-slate-100">
              {formatDate(belief.createdAt)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
