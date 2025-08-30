'use client';

import { useState, useEffect } from 'react';
import { OpinionContent } from '@/types/content.types';
import { RelevanceSignals } from '../RelevanceSignals';
import { SkeletonContentDetailPage } from '../skeleton/SkeletonContentDetailPage';
import { 
  ArrowLeft, 
  Users, 
  CheckCircle,
  ChevronUp,
  ChevronDown,
  Minus,
  GripVertical,
  TrendingUp,
  Activity,
  Award
} from 'lucide-react';

interface OpinionDetailPageProps {
  content: OpinionContent;
  onBack: () => void;
}

export const OpinionDetailPage: React.FC<OpinionDetailPageProps> = ({
  content,
  onBack
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userPrediction, setUserPrediction] = useState<string | number | string[] | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [rankedItems, setRankedItems] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Initialize ranked items for ranking type
    if (content.opinionType === 'ranking' && content.options) {
      setRankedItems([...content.options]);
    }
    
    // Initialize user prediction based on type
    if (content.opinionType === 'percentage') {
      setUserPrediction(content.currentValue || 50);
    } else if (content.opinionType === 'yes-no') {
      setUserPrediction(null); // Will be 'yes' or 'no'
    }
    
    // Simulate loading for smooth transition
    setTimeout(() => {
      setIsLoading(false);
    }, 300);
  }, [content]);

  if (isLoading) {
    return <SkeletonContentDetailPage />;
  }

  // Handle submission of user prediction
  const handleSubmitPrediction = async () => {
    if (userPrediction !== null && !hasVoted && !isSubmitting) {
      setIsSubmitting(true);
      
      // Simulate API call with delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setHasVoted(true);
      setIsSubmitting(false);
      // In a real app, this would send the prediction to the backend
      // User prediction submitted - In production, send to backend
    }
  };

  // Drag and drop handlers for ranking
  const handleDragStart = (e: React.DragEvent, item: string) => {
    setDraggedItem(item);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetItem: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetItem) return;

    const newItems = [...rankedItems];
    const draggedIndex = newItems.indexOf(draggedItem);
    const targetIndex = newItems.indexOf(targetItem);

    newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);

    setRankedItems(newItems);
    setUserPrediction(newItems);
  };

  // Get trend from historical data
  const getTrend = () => {
    const signal = content.signals?.truth;
    if (!signal?.historicalData || signal.historicalData.length < 2) return 'stable';
    
    const recent = signal.historicalData[signal.historicalData.length - 1].value;
    const previous = signal.historicalData[signal.historicalData.length - 2].value;
    
    if (recent > previous + 2) return 'up';
    if (recent < previous - 2) return 'down';
    return 'stable';
  };

  // Get trend icon
  const getTrendIcon = () => {
    const trend = getTrend();
    switch (trend) {
      case 'up':
        return <ChevronUp className="h-6 w-6 text-green-500" />;
      case 'down':
        return <ChevronDown className="h-6 w-6 text-red-500" />;
      default:
        return <Minus className="h-6 w-6 text-gray-400" />;
    }
  };

  // Render the main opinion display based on type
  const renderOpinionDisplay = () => {
    switch (content.opinionType) {
      case 'percentage':
        const range = content.range || { min: 0, max: 100 };
        const sliderValue = typeof userPrediction === 'number' ? userPrediction : (content.currentValue || 50);
        
        return (
          <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-8 border border-slate-200 dark:border-veritas-eggshell/10">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              {content.question}
            </h2>
            
            {/* Crowd Consensus vs User Prediction */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-2">Crowd Consensus</div>
                <div className="flex items-center justify-center gap-2">
                  <div className="text-5xl font-bold text-gray-700 dark:text-gray-300">
                    {content.currentValue || 0}
                  </div>
                  <span className="text-2xl text-gray-600 dark:text-gray-400">
                    {content.unit || '%'}
                  </span>
                  {getTrendIcon()}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-2">Your Prediction</div>
                <div className="flex items-center justify-center gap-2">
                  <div className="text-5xl font-bold bg-gradient-to-r from-veritas-blue to-veritas-light-blue bg-clip-text text-transparent">
                    {sliderValue}
                  </div>
                  <span className="text-2xl text-gray-600 dark:text-gray-400">
                    {content.unit || '%'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Interactive Slider */}
            {!hasVoted && (
              <div className="mt-8">
                <div className="flex justify-between text-sm text-gray-500 mb-2">
                  <span>{range.min}{content.unit}</span>
                  <span className="font-medium">Drag to predict</span>
                  <span>{range.max}{content.unit}</span>
                </div>
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  value={sliderValue}
                  onChange={(e) => setUserPrediction(Number(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((sliderValue - range.min) / (range.max - range.min)) * 100}%, #E5E7EB ${((sliderValue - range.min) / (range.max - range.min)) * 100}%, #E5E7EB 100%)`
                  }}
                />
                <div className="mt-6 text-center">
                  <button
                    onClick={handleSubmitPrediction}
                    disabled={isSubmitting}
                    className="px-8 py-3 bg-gradient-to-r from-veritas-blue to-veritas-light-blue text-white rounded-lg hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none inline-flex items-center justify-center min-w-[180px]"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      'Submit Prediction'
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {hasVoted && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-green-700 dark:text-green-300">
                  Your prediction of {userPrediction}{content.unit} has been recorded!
                </p>
              </div>
            )}
          </div>
        );

      case 'yes-no':
        const yesPercent = content.yesPercentage || 50;
        const noPercent = 100 - yesPercent;
        
        return (
          <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-8 border border-slate-200 dark:border-veritas-eggshell/10">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              {content.question}
            </h2>
            
            {/* Community Consensus Bar */}
            <div className="mb-8">
              <div className="text-sm text-gray-500 mb-2 text-center">Community Consensus</div>
              <div className="relative h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden">
                <div className="flex h-full">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 flex items-center justify-center"
                    style={{ width: `${yesPercent}%` }}
                  >
                    {yesPercent > 20 && (
                      <div className="text-white font-bold text-xl">
                        YES {yesPercent}%
                      </div>
                    )}
                  </div>
                  <div 
                    className="bg-gradient-to-r from-red-600 to-red-500 transition-all duration-500 flex items-center justify-center"
                    style={{ width: `${noPercent}%` }}
                  >
                    {noPercent > 20 && (
                      <div className="text-white font-bold text-xl">
                        NO {noPercent}%
                      </div>
                    )}
                  </div>
                </div>
                {yesPercent <= 20 && (
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 font-bold">
                    YES {yesPercent}%
                  </div>
                )}
                {noPercent <= 20 && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-700 font-bold">
                    NO {noPercent}%
                  </div>
                )}
              </div>
            </div>
            
            {/* Interactive Toggle Buttons */}
            {!hasVoted && (
              <div>
                <div className="text-sm text-gray-500 mb-4 text-center">Make Your Prediction</div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setUserPrediction('yes')}
                    className={`py-6 px-8 rounded-xl font-bold text-xl transition-all duration-200 ${
                      userPrediction === 'yes'
                        ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg scale-105'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    onClick={() => setUserPrediction('no')}
                    className={`py-6 px-8 rounded-xl font-bold text-xl transition-all duration-200 ${
                      userPrediction === 'no'
                        ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg scale-105'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    }`}
                  >
                    NO
                  </button>
                </div>
                {userPrediction && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={handleSubmitPrediction}
                      disabled={isSubmitting}
                      className="px-8 py-3 bg-gradient-to-r from-veritas-blue to-veritas-light-blue text-white rounded-lg hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none inline-flex items-center justify-center min-w-[180px]"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        'Submit Vote'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {hasVoted && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-green-700 dark:text-green-300">
                  You voted <strong>{String(userPrediction).toUpperCase()}</strong>
                </p>
              </div>
            )}
          </div>
        );

      case 'multiple-choice':
        const sortedOptions = content.options?.sort((a, b) => {
          const aVotes = content.optionVotes?.[a] || 0;
          const bVotes = content.optionVotes?.[b] || 0;
          return bVotes - aVotes;
        }) || [];
        
        const totalVotes = Object.values(content.optionVotes || {}).reduce((a, b) => a + b, 0);
        
        return (
          <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-8 border border-slate-200 dark:border-veritas-eggshell/10">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              {content.question}
            </h2>
            
            {/* Current Results */}
            <div className="mb-8">
              <div className="text-sm text-gray-500 mb-4">Current Results ({totalVotes.toLocaleString()} votes)</div>
              <div className="space-y-3">
                {sortedOptions.map((option, index) => {
                  const votes = content.optionVotes?.[option] || 0;
                  const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                  
                  return (
                    <div key={option} className="relative">
                      <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            index === 0 
                              ? 'bg-gradient-to-r from-veritas-blue to-veritas-light-blue' 
                              : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-between px-4">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{option}</span>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                          {Math.round(percentage)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Interactive Radio Buttons */}
            {!hasVoted && (
              <div>
                <div className="text-sm text-gray-500 mb-4">Cast Your Vote</div>
                <div className="space-y-3">
                  {content.options?.map((option) => (
                    <label
                      key={option}
                      className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        userPrediction === option
                          ? 'border-veritas-blue bg-veritas-blue/5 dark:bg-veritas-blue/10'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="multipleChoice"
                        value={option}
                        checked={userPrediction === option}
                        onChange={(e) => setUserPrediction(e.target.value)}
                        className="w-5 h-5 text-veritas-blue focus:ring-veritas-blue"
                      />
                      <span className="ml-3 text-gray-700 dark:text-gray-300 font-medium">
                        {option}
                      </span>
                    </label>
                  ))}
                </div>
                {userPrediction && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={handleSubmitPrediction}
                      disabled={isSubmitting}
                      className="px-8 py-3 bg-gradient-to-r from-veritas-blue to-veritas-light-blue text-white rounded-lg hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none inline-flex items-center justify-center min-w-[180px]"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        'Submit Vote'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {hasVoted && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-green-700 dark:text-green-300">
                  You voted for <strong>{userPrediction}</strong>
                </p>
              </div>
            )}
          </div>
        );

      case 'ranking':
        const medals = ['🥇', '🥈', '🥉'];
        const itemsToRank = hasVoted ? (userPrediction as string[]) : rankedItems;
        
        return (
          <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-8 border border-slate-200 dark:border-veritas-eggshell/10">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              {content.question}
            </h2>
            
            <div className="grid grid-cols-2 gap-8">
              {/* Community Ranking */}
              <div>
                <div className="text-sm text-gray-500 mb-4">Community Ranking</div>
                <div className="space-y-2">
                  {content.options?.map((option, index) => (
                    <div 
                      key={option} 
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        index < 3 ? 'bg-gray-50 dark:bg-gray-900' : ''
                      }`}
                    >
                      <span className="text-lg">
                        {index < 3 ? medals[index] : `${index + 1}.`}
                      </span>
                      <span className={`text-sm ${index === 0 ? 'font-bold' : ''} text-gray-900 dark:text-white`}>
                        {option}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* User Ranking */}
              <div>
                <div className="text-sm text-gray-500 mb-4">
                  {hasVoted ? 'Your Ranking' : 'Drag to Rank'}
                </div>
                <div className="space-y-2">
                  {itemsToRank.map((item, index) => (
                    <div
                      key={item}
                      draggable={!hasVoted}
                      onDragStart={(e) => !hasVoted && handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => !hasVoted && handleDrop(e, item)}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                        !hasVoted ? 'cursor-move hover:shadow-md' : ''
                      } ${
                        draggedItem === item 
                          ? 'opacity-50 scale-95' 
                          : ''
                      } ${
                        index < 3 
                          ? 'bg-gradient-to-r from-veritas-blue/10 to-veritas-light-blue/10 border-2 border-veritas-blue/20' 
                          : 'bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {!hasVoted && (
                        <GripVertical className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-lg">
                        {index < 3 ? medals[index] : `${index + 1}.`}
                      </span>
                      <span className={`text-sm ${index === 0 ? 'font-bold' : ''} text-gray-900 dark:text-white`}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
                
                {!hasVoted && rankedItems.length > 0 && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={handleSubmitPrediction}
                      disabled={isSubmitting}
                      className="px-8 py-3 bg-gradient-to-r from-veritas-blue to-veritas-light-blue text-white rounded-lg hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none inline-flex items-center justify-center min-w-[180px]"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        'Submit Ranking'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {hasVoted && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-green-700 dark:text-green-300">
                  Your ranking has been submitted!
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-veritas-darker-blue">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-veritas-darker-blue pt-20 md:pt-4">
        <div className="container mx-auto px-4 py-3 max-w-7xl">
          <button 
            onClick={onBack}
            className="flex items-center space-x-2 text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70 hover:text-veritas-primary dark:hover:text-veritas-eggshell transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Feed</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Content - 3 columns */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* Title and Description */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {content.heading.title}
              </h1>
              {content.heading.subtitle && (
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                  {content.heading.subtitle}
                </p>
              )}
              {content.description && (
                <p className="text-gray-700 dark:text-gray-300">
                  {content.description}
                </p>
              )}
              
              {/* Status Badge */}
              {content.status === 'resolved' && (
                <div className="mt-4 inline-block px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm rounded-full">
                  Resolved: {content.resolvedValue}
                </div>
              )}
            </div>

            {/* Main Opinion Display */}
            {renderOpinionDisplay()}

            {/* Participation Stats */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Participation Statistics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <Users className="h-8 w-8 text-veritas-blue mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {content.totalParticipants.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Total Participants</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <Activity className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {hasVoted ? content.totalParticipants + 1 : content.totalParticipants}
                  </div>
                  <div className="text-sm text-gray-500">Active Now</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.round(Math.random() * 20 + 5)}%
                  </div>
                  <div className="text-sm text-gray-500">24h Change</div>
                </div>
              </div>
              {content.resolutionDate && (
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm text-yellow-700 dark:text-yellow-300">
                      Resolves on {new Date(content.resolutionDate).toLocaleDateString()}
                    </span>
                  </div>
                  {content.status === 'resolved' && content.resolvedValue && (
                    <span className="text-sm font-bold text-yellow-700 dark:text-yellow-300">
                      Result: {content.resolvedValue}
                    </span>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Sidebar - 1 column */}
          <div className="lg:col-span-1">
            {/* Quick Stats */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 mb-4 border border-slate-200 dark:border-veritas-eggshell/10">
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Quick Stats</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Your Status</span>
                  <span className={`text-sm font-medium ${hasVoted ? 'text-green-600' : 'text-gray-600'}`}>
                    {hasVoted ? 'Voted' : 'Not Voted'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Trend</span>
                  <span className="text-sm font-medium text-gray-600">
                    {getTrend() === 'up' ? '↑ Rising' : getTrend() === 'down' ? '↓ Falling' : '→ Stable'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Category</span>
                  <span className="text-sm font-medium text-gray-600">
                    {content.opinionType.replace('-', ' ').toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Share */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-xl p-4 border border-slate-200 dark:border-veritas-eggshell/10">
              <button className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Share Opinion
              </button>
            </div>
          </div>

          {/* Full Width Sections */}
          <div className="lg:col-span-4">
            {/* Relevance Signals - Consistent across all content types */}
            <div className="bg-white dark:bg-veritas-darker-blue/80 rounded-2xl p-6 border border-slate-200 dark:border-veritas-eggshell/10">
              <RelevanceSignals belief={content} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};