'use client';

import { SkeletonCardGroup } from './SkeletonCardGroup';
import { SkeletonBeliefCard } from './SkeletonBeliefCard';

export const SkeletonGroupedContainer: React.FC = () => {
  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="py-2 space-y-8">
        
        {/* Featured Group Skeleton - Navy background */}
        <div className="animate-in slide-in-from-top-4 duration-500">
          <SkeletonCardGroup
            variant="featured"
            className="bg-gradient-to-br from-[#1B365D] to-[#2D4A6B] text-white"
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
              <div className="animate-in slide-in-from-left-4 duration-700 delay-100">
                <SkeletonBeliefCard theme="dark" />
              </div>
              <div className="animate-in slide-in-from-right-4 duration-700 delay-200">
                <SkeletonBeliefCard theme="dark" />
              </div>
            </div>
          </SkeletonCardGroup>
        </div>

        {/* Crypto Group Skeleton - Yellow accent */}
        <div className="animate-in slide-in-from-top-4 duration-500 delay-300">
          <SkeletonCardGroup
            variant="accent"
            className="bg-gradient-to-br from-[#FFB800] to-[#F5A623] text-white"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="animate-in slide-in-from-bottom-4 duration-600 delay-400">
                <SkeletonBeliefCard theme="dark" />
              </div>
              <div className="animate-in slide-in-from-bottom-4 duration-600 delay-500">
                <SkeletonBeliefCard theme="dark" />
              </div>
              <div className="animate-in slide-in-from-bottom-4 duration-600 delay-600">
                <SkeletonBeliefCard theme="dark" />
              </div>
            </div>
          </SkeletonCardGroup>
        </div>

        {/* Politics Group Skeleton - Navy accent */}
        <div className="animate-in slide-in-from-top-4 duration-500 delay-700">
          <SkeletonCardGroup
            variant="primary"
            className="bg-gradient-to-br from-[#1B365D] to-[#2D4A6B] text-white"
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
              <div className="animate-in slide-in-from-left-4 duration-600 delay-800">
                <SkeletonBeliefCard theme="dark" />
              </div>
              <div className="animate-in slide-in-from-right-4 duration-600 delay-900">
                <SkeletonBeliefCard theme="dark" />
              </div>
            </div>
          </SkeletonCardGroup>
        </div>

        {/* Sports Group Skeleton - Mixed layout */}
        <div className="animate-in slide-in-from-top-4 duration-500 delay-1000">
          <SkeletonCardGroup
            variant="mixed"
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="animate-in slide-in-from-bottom-4 duration-600 delay-1100">
                <SkeletonBeliefCard />
              </div>
              <div className="animate-in slide-in-from-bottom-4 duration-600 delay-1200">
                <SkeletonBeliefCard />
              </div>
              <div className="animate-in slide-in-from-bottom-4 duration-600 delay-1300">
                <SkeletonBeliefCard />
              </div>
            </div>
          </SkeletonCardGroup>
        </div>

        {/* Quick Predictions Skeleton - Compact grid */}
        <div className="animate-in slide-in-from-top-4 duration-500 delay-1400">
          <SkeletonCardGroup
            variant="compact"
            className="bg-gray-100 dark:bg-slate-800/50"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((index) => (
                <div key={index} className={`animate-in slide-in-from-bottom-2 duration-500 delay-${1400 + index * 100}`}>
                  <SkeletonBeliefCard compact />
                </div>
              ))}
            </div>
          </SkeletonCardGroup>
        </div>

        {/* More Predictions Skeleton */}
        <div className="animate-in slide-in-from-top-4 duration-500 delay-1800">
          <SkeletonCardGroup
            variant="mixed"
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((index) => (
                <div key={index} className={`animate-in slide-in-from-bottom-4 duration-600 delay-${1900 + index * 50}`}>
                  <SkeletonBeliefCard />
                </div>
              ))}
            </div>
          </SkeletonCardGroup>
        </div>

      </div>
    </div>
  );
}; 