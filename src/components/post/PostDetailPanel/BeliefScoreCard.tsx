/**
 * BeliefScoreCard Component
 * Bubble card displaying community belief score
 */

'use client';

interface BeliefScoreCardProps {
  yesPercentage: number;
  totalParticipants: number;
  totalStake: number;
}

export function BeliefScoreCard({
  yesPercentage,
  totalParticipants,
  totalStake,
}: BeliefScoreCardProps) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Community Belief</h3>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-[#B9D9EB]">{yesPercentage}%</p>
          <p className="text-xs text-gray-500">believe this is true</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{totalParticipants} participants</p>
          <p className="text-sm font-medium text-white">${totalStake.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
