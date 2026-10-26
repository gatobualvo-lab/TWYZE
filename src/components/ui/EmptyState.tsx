import React from 'react';

type Tone = 'neutral' | 'positive';

const TONE_CLASSES: Record<Tone, { bg: string; ring: string; icon: string }> = {
  neutral: { bg: 'bg-gray-100', ring: 'border-gray-300', icon: 'text-gray-400' },
  positive: { bg: 'bg-green-50', ring: 'border-green-300', icon: 'text-green-500' },
};

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** 'positive' for a good-news empty state (e.g. "nothing urgent") — swaps the neutral gray icon circle for a green one. */
  tone?: Tone;
}

/** Consistent "nothing here yet" block — used across every list/page in the app instead of each one hand-rolling its own. */
const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, className = '', tone = 'neutral' }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-200/70 p-10 text-center animate-scale-in ${className}`}>
    <div className="relative w-16 h-16 mx-auto mb-4">
      {/* A dashed ring around the icon. Still on purpose: only loading indicators move forever. */}
      <span aria-hidden="true" className={`absolute inset-0 rounded-full border-2 border-dashed ${TONE_CLASSES[tone].ring} opacity-60`} />
      <span className={`absolute inset-2 rounded-full flex items-center justify-center ${TONE_CLASSES[tone].bg}`}>
        <Icon className={`w-6 h-6 ${TONE_CLASSES[tone].icon}`} />
      </span>
    </div>
    <p className="font-display text-gray-800 font-semibold text-lg">{title}</p>
    {description && <p className="text-gray-500 text-sm mt-1.5 max-w-sm mx-auto">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
