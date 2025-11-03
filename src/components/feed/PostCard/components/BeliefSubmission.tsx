/**
 * BeliefSubmission Component
 * Allows users to submit their belief on posts
 */

'use client';

import { useState } from 'react';
import { MobileSlider } from '@/components/common/MobileSlider';

interface BeliefSubmissionProps {
  onCancel: () => void;
  onSubmit: (percentage: number) => Promise<void>;
}

export function BeliefSubmission({ onCancel, onSubmit }: BeliefSubmissionProps) {
  const [userBelief, setUserBelief] = useState<number>(50);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    await onSubmit(userBelief);
    setIsSubmitted(true);
  };

  const handleCancel = () => {
    setUserBelief(50);
    setIsSubmitted(false);
    onCancel();
  };

  return (
    <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
        What&apos;s your view?
      </h3>
      
      <div className="space-y-4">
        {/* Slider with improved mobile touch targets */}
        <MobileSlider
          min={0}
          max={100}
          value={userBelief}
          onChange={setUserBelief}
          step={1}
          label="Your belief"
          formatValue={(v) => `${v}%`}
        />

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitted}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
              isSubmitted 
                ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' 
                : 'bg-veritas-orange text-white hover:bg-veritas-orange/90'
            }`}
          >
            {isSubmitted ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-scale-in" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Submitted
              </span>
            ) : (
              'Submit Belief'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}