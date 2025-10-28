/**
 * HoldingCardSkeleton Component
 * Loading skeleton for holding cards while data is being fetched
 */

export function HoldingCardSkeleton() {
  return (
    <article className="relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden animate-pulse">
      {/* Color accent bar placeholder */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2a2a2a]" />

      <div className="flex gap-4 p-4 pl-5">
        {/* Thumbnail skeleton */}
        <div className="flex-shrink-0 w-24 h-24 bg-[#2a2a2a] rounded-lg" />

        {/* Content skeleton */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Header row skeleton */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              {/* Title skeleton */}
              <div className="h-5 bg-[#2a2a2a] rounded w-3/4" />
              {/* Author skeleton */}
              <div className="h-4 bg-[#2a2a2a] rounded w-1/3" />
            </div>
            {/* Market badge skeleton */}
            <div className="h-7 w-20 bg-[#2a2a2a] rounded-lg" />
          </div>

          {/* Position row skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Position badge skeleton */}
              <div className="h-7 w-24 bg-[#2a2a2a] rounded-md" />
            </div>
            {/* P&L skeleton */}
            <div className="flex items-center gap-2">
              <div className="h-7 w-28 bg-[#2a2a2a] rounded" />
              <div className="h-7 w-16 bg-[#2a2a2a] rounded-md" />
            </div>
          </div>

          {/* Metrics row skeleton */}
          <div className="flex items-center gap-6">
            <div className="h-4 w-24 bg-[#2a2a2a] rounded" />
            <div className="h-4 w-24 bg-[#2a2a2a] rounded" />
            <div className="h-4 w-24 bg-[#2a2a2a] rounded ml-auto" />
          </div>
        </div>
      </div>
    </article>
  );
}
