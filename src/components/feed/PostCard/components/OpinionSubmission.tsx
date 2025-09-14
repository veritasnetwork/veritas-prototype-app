/**
 * OpinionSubmission Component
 * Allows users to submit their opinion on opinion-type posts
 */

'use client';

import { useState } from 'react';

interface OpinionSubmissionProps {
  onCancel: () => void;
  onSubmit: (percentage: number) => Promise<void>;
}

export function OpinionSubmission({ onCancel, onSubmit }: OpinionSubmissionProps) {
  const [userOpinion, setUserOpinion] = useState<number>(50);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    await onSubmit(userOpinion);
    setIsSubmitted(true);
  };

  const handleCancel = () => {
    setUserOpinion(50);
    setIsSubmitted(false);
    onCancel();
  };

  return (
    <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
        What&apos;s your view?
      </h3>
      
      <div className="space-y-4">
        {/* Slider */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Your belief: {userOpinion}%
          </label>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="100"
              value={userOpinion}
              onChange={(e) => setUserOpinion(Number(e.target.value))}
              className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #EA900E 0%, #EA900E ${userOpinion}%, #e5e7eb ${userOpinion}%, #e5e7eb 100%)`
              }}
              aria-label="Opinion percentage slider"
            />
            <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              <span>0% (No)</span>
              <span>50% (Neutral)</span>
              <span>100% (Yes)</span>
            </div>
          </div>
        </div>

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
              'Submit Opinion'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}