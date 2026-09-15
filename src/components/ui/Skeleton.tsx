import React from 'react';

interface SkeletonProps {
  className?: string;
}

/** A single shimmering placeholder block. Compose with width/height/rounded utility classes via className. */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`skeleton-shimmer rounded-md ${className}`} aria-hidden="true" />
);

/** Placeholder for a row of KPI/stat cards, shaped like the real thing so the page doesn't jump when data arrives. */
export const SkeletonStatGrid: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-16" />
      </div>
    ))}
  </div>
);

/** Placeholder for a stacked list of rows (sales, notifications, timeline entries, etc). */
export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <Skeleton className="h-4 w-16 flex-shrink-0" />
      </div>
    ))}
  </div>
);

/** Placeholder for a full page: a header block plus a stat grid plus a list — the common shape of most TrackWyze pages. */
export const SkeletonPage: React.FC = () => (
  <div className="space-y-6 animate-fadeIn">
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
    <SkeletonStatGrid />
    <SkeletonList />
  </div>
);

export default Skeleton;
