/**
 * CompactProfilePostCardSkeleton Component
 * Loading skeleton for profile post cards
 */

export function CompactProfilePostCardSkeleton() {
  return (
    <article className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
      <div className="flex flex-col gap-3">
        {/* Title skeleton */}
        <div className="h-6 bg-gray-800 rounded w-3/4 animate-pulse" />

        {/* Content preview skeleton */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-800 rounded w-full animate-pulse" />
          <div className="h-4 bg-gray-800 rounded w-5/6 animate-pulse" />
        </div>

        {/* Media skeleton (if present) */}
        <div className="w-full h-48 bg-gray-800 rounded-lg animate-pulse" />

        {/* Bottom row: timestamp + pool metrics */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
          <div className="h-4 w-20 bg-gray-800 rounded animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="h-4 w-24 bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </article>
  );
}
