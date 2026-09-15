import React from 'react';

type Tone = 'neutral' | 'positive';

const TONE_CLASSES: Record<Tone, { bg: string; icon: string }> = {
  neutral: { bg: 'bg-gray-50', icon: 'text-gray-300' },
  positive: { bg: 'bg-green-50', icon: 'text-green-500' },
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
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center animate-scale-in ${className}`}>
    <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${TONE_CLASSES[tone].bg}`}>
      <Icon className={`w-7 h-7 ${TONE_CLASSES[tone].icon}`} />
    </div>
    <p className="text-gray-700 font-medium">{title}</p>
    {description && <p className="text-gray-400 text-sm mt-1.5 max-w-sm mx-auto">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
